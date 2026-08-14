import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import { buildPlacedSegments } from "./layout-segments";
import { scheduleScenes } from "./layout-schedule";
import { PICKABLE_LAYOUTS } from "./layout-kinds";
import { db } from "./db";
import { effectPeak, mapToOutput } from "./render";
import { normalizeJunction } from "./junction-kinds";
import { ffmpeg, probe } from "./media-tools";
import { VIDEO } from "./routes/media-formats";
import { workDir } from "./paths";
import { keptRanges, resolveElements } from "./pipeline";
import {
  blocksFromPack,
  type AlignId,
  type Band,
  type CaptionBlock,
  type EmphasisId,
  type FrameBlock,
  type StylePack,
} from "./style-pack";
import { readStylePack } from "./style-pack-store";
import { stampBlocksFromPack } from "./stamp-blocks";
import { subjectPath } from "./subject-mask";

/**
 * CẦU DỮ LIỆU cho Remotion — một máy vẽ.
 *
 * Trả ĐÚNG lịch màn + tư liệu mà bản xuất ffmpeg dùng (`buildPlacedSegments` →
 * `scheduleScenes`, cùng nguồn `pipeline.ts`), đóng gói thành JSON + copy media vào
 * `public/remotion/<id>/` để Remotion (headless Chrome) đọc bằng `staticFile`. Nhờ
 * ăn cùng nguồn với export/preview, composition Remotion KHÔNG phải là "máy vẽ thứ
 * ba" — nó là chính cây render preview, chỉ khác nơi chạy.
 */

export type RemotionScene = {
  start: number;
  end: number;
  layout: string;
  /** Chỉ số tư liệu chèn cho ô phụ; null nếu màn không có b-roll. */
  insert: number | null;
  frameBlock: FrameBlock | null;
};

/** Một cụm phụ đề — đủ để dựng `OverlayTextBlock` (cùng cấu hình preview). */
export type RemotionCaption = {
  start: number;
  end: number;
  content: string;
  align?: AlignId;
  emphasis?: EmphasisId;
  band?: Band;
  keywords?: string[];
  captionBlock: CaptionBlock | null;
  /** Đè trục chữ của riêng cụm (packForElement dùng). */
  letterCase?: StylePack["letterCase"] | null;
  keyColor?: string | null;
  fontStyle?: string | null;
  /** Mốc từng tiếng, ĐÃ trừ đầu cụm (OverlayTextBlock đếm giây từ đầu cụm). */
  wordStarts?: number[];
  span: number;
};

export type RemotionPayload = {
  fps: number;
  width: number;
  height: number;
  seconds: number;
  /** Bản KHUNG XEM (editor), không phải bản xuất — bật gợi ý chỉ-dành-cho-editor
      (vd ô b-roll trống vẽ placeholder để người dùng hiểu chỗ đặt tư liệu). */
  preview: boolean;
  sourceAspect: number | null;
  /** URL (tương đối `public/`) video người đã dựng. */
  personUrl: string;
  /** Mặt nạ tách người (trắng=người), null nếu chưa có. */
  maskUrl: string | null;
  /**
   * TIẾNG chỉ cho KHUNG XEM (preview). Bản XUẤT ghép tiếng bằng ffmpeg SAU khi
   * Remotion vẽ hình câm, nên hai trường này RỖNG ở export (`null`/`[]`) — không
   * thì tiếng bị nhân đôi. `voiceUrl` = giọng đã cắt (khớp 1:1 dải output).
   */
  voiceUrl: string | null;
  music: Array<{ url: string; start: number; end: number; volume: number }>;
  /** Nền trang gốc của bộ dáng (mỗi cảnh có thể đè bằng `frameBlock.page`). */
  basePage: FrameBlock["page"];
  /** Bộ dáng dự án — CHỈ để `packForElement` gộp `caption_block` (look chữ cấp
   * CỤM) lên trên; KHÔNG được đọc trục LOOK khác của nó ở render (xem CLAUDE.md). */
  pack: StylePack;
  /**
   * DEFOCUS toàn-khung — RESOLVE ở đây (lúc dựng payload) từ bộ dáng, KHÔNG để
   * component render đọc `payload.pack.punchDefocus`. Cảnh toàn-khung là `scene ==
   * null` (không có frame_block), nên defocus là giá trị cấp VIDEO, không phải trục
   * của một khung — vì thế nó nằm ở payload chứ không trong block.
   */
  punchDefocus: StylePack["punchDefocus"];
  scenes: RemotionScene[];
  inserts: Array<{
    url: string;
    aspect: number;
    isVideo: boolean;
    /** LẤY PHẦN clip: giây bắt đầu/kết thúc trong clip + độ dài clip. `null` = cả clip. */
    in: number | null;
    out: number | null;
    duration: number | null;
  }>;
  captions: RemotionCaption[];
  /** Chỗ nối (zoom/nháy/nghiêng) — xung tam giác quanh mỗi vết cắt, dải ĐÃ CẮT. */
  junctions: Array<{ start: number; end: number; peak: number; kind: string }>;
  /** Chữ-sau-người mở màn (null nếu bộ dáng không có / ô trống). */
  behind: {
    line: string;
    band: number;
    seconds: number;
    /** webm ALPHA của người (đã cắt nền) cho cửa sổ mở màn — layer đè lên chữ. */
    personCutUrl: string | null;
  } | null;
};

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;

/**
 * Bản PROXY tua-tức-thì: 480p TOÀN KEYFRAME (`-g 1`) — mọi frame giải mã độc lập
 * nên seek không phải giải mã lại từ xa. Cache `dest`, dựng lại chỉ khi nguồn mới
 * hơn. Encode fail → trả nguồn (vẫn chạy, chỉ lag). ~1s cho một clip.
 */
async function makeScrubProxy(src: string, dest: string): Promise<string> {
  const fresh =
    existsSync(dest) &&
    statSync(dest).size > 0 &&
    statSync(dest).mtimeMs >= statSync(src).mtimeMs;
  if (!fresh) {
    await ffmpeg([
      "-y",
      "-i",
      src,
      "-vf",
      "scale=480:-2",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-g",
      "1",
      "-an",
      dest,
    ]).catch(() => undefined);
  }
  return existsSync(dest) && statSync(dest).size > 0 ? dest : src;
}

/**
 * Trích TIẾNG (giọng) từ video người ĐÃ CẮT ra tệp audio nhẹ cho khung xem —
 * proxy người bị `-an` (tắt tiếng) để tua nhanh, nên tiếng phải lấy riêng. Cache
 * theo mtime như proxy: trim/dời không dựng lại tệp này. `null` nếu nguồn không
 * có tiếng.
 */
async function extractVoiceProxy(
  src: string,
  dest: string,
): Promise<string | null> {
  const fresh =
    existsSync(dest) &&
    statSync(dest).size > 0 &&
    statSync(dest).mtimeMs >= statSync(src).mtimeMs;
  if (!fresh) {
    // `-c:a copy` khi nguồn đã aac (preview.mp4) → gần như tức thì; hỏng thì
    // ffmpeg tự bỏ, trả null.
    await ffmpeg(["-y", "-i", src, "-vn", "-c:a", "copy", dest]).catch(
      () => undefined,
    );
  }
  return existsSync(dest) && statSync(dest).size > 0 ? dest : null;
}

export async function buildRemotionPayload(
  projectId: string,
  /**
   * Video NGƯỜI dùng cho ô (mặc định `base.mp4`). Bản tích hợp export truyền video
   * ĐÃ CẮT (`cut`) → hình + lịch màn + tiếng cùng dải cắt, hết lệch ~0.5s.
   */
  personVideo?: string,
  /**
   * `scrubProxy`: dựng bản người ĐỘ PHÂN GIẢI THẤP + TOÀN KEYFRAME (all-intra) cho
   * KHUNG XEM — tua tức thì (không giải mã lại từ keyframe). Kèm hạ khổ preview.
   * Export KHÔNG bật (giữ full-res). Proxy cache ở `work/`, chỉ dựng lại khi nguồn
   * mới hơn.
   */
  opts?: { scrubProxy?: boolean },
): Promise<RemotionPayload | null> {
  const pack = readStylePack(projectId);
  if (pack.layouts.length === 0) return null;

  // Element mang block look của chính nó — đóng dấu trước khi đọc (cùng cổng với
  // preview/export).
  stampBlocksFromPack(projectId);

  const base = join(workDir(projectId), "base.mp4");
  if (!existsSync(base)) return null;
  const baseInfo = await probe(base).catch(() => null);
  if (!baseInfo) return null;

  const kept = keptRanges(projectId, baseInfo.duration);
  const keptTotal = kept.reduce((sum, r) => sum + (r.end - r.start), 0);

  const { segments, media } = buildPlacedSegments(
    projectId,
    kept,
    PICKABLE_LAYOUTS,
    pack.layouts,
  );
  const schedule = scheduleScenes(keptTotal, segments);

  // Thư mục tĩnh cho Remotion đọc. TÁCH preview vs export: preview ghi PROXY thấp,
  // export ghi FULL-RES — chung thư mục sẽ đè nhau (export bundle nhầm proxy → video
  // mờ). Tách theo `scrubProxy` để không race.
  const dir = opts?.scrubProxy ? "remotion-preview" : "remotion";
  const outDir = join(process.cwd(), "public", dir, projectId);
  mkdirSync(outDir, { recursive: true });
  const rel = (name: string) => `${dir}/${projectId}/${name}`;

  // Người: dùng base.mp4 (cắt tối thiểu ở dự án thử; bản production sẽ cắt đúng
  // theo `kept`). Mặt nạ: cut-mask nếu có, không thì subject gốc.
  // Người: ưu tiên video ĐÃ CẮT (export truyền `cut`; preview rơi về `preview.mp4`
  // đã cắt) để khớp dải cắt của lịch màn + phụ đề. Cùng lắm mới về base (chưa cắt).
  const previewCut = join(workDir(projectId), "preview.mp4");
  const personSrc =
    personVideo && existsSync(personVideo)
      ? personVideo
      : existsSync(previewCut)
        ? previewCut
        : base;

  // KHUNG XEM: proxy tua-tức-thì cho người (nguồn tua chính).
  const personFinal = opts?.scrubProxy
    ? await makeScrubProxy(personSrc, join(workDir(projectId), "scrub-person.mp4"))
    : personSrc;
  copyFileSync(personFinal, join(outDir, "person.mp4"));
  const personUrl = rel("person.mp4");

  const cutMask = join(workDir(projectId), "cut-mask.mp4");
  const rawMask = subjectPath(projectId);
  let maskUrl: string | null = null;
  if (existsSync(cutMask)) {
    copyFileSync(cutMask, join(outDir, "mask.mp4"));
    maskUrl = rel("mask.mp4");
  } else if (existsSync(rawMask)) {
    copyFileSync(rawMask, join(outDir, "mask.mp4"));
    maskUrl = rel("mask.mp4");
  }

  // TIẾNG cho KHUNG XEM (chỉ preview; export ghép bằng ffmpeg): giọng = tiếng của
  // video người ĐÃ CẮT (`personSrc`, khớp 1:1 output), nhạc = music_tracks đã đặt.
  let voiceUrl: string | null = null;
  const music: RemotionPayload["music"] = [];
  if (opts?.scrubProxy) {
    const voiceFile = await extractVoiceProxy(
      personSrc,
      join(workDir(projectId), "preview-voice.m4a"),
    );
    if (voiceFile) {
      copyFileSync(voiceFile, join(outDir, "voice.m4a"));
      voiceUrl = rel("voice.m4a");
    }
    const tracks = db
      .prepare(
        "SELECT stored_path AS path, start_sec AS s, end_sec AS e, volume AS v FROM music_tracks WHERE project_id=? ORDER BY position",
      )
      .all(projectId) as Array<{
      path: string;
      s: number;
      e: number;
      v: number | null;
    }>;
    tracks.forEach((t, i) => {
      if (!existsSync(t.path)) return;
      const name = `music-${i}${extname(t.path) || ".mp3"}`;
      copyFileSync(t.path, join(outDir, name));
      music.push({ url: rel(name), start: t.s, end: t.e, volume: t.v ?? 1 });
    });
  }

  const inserts = await Promise.all(
    media.map(async (item, i) => {
      const isVid = VIDEO.test(item.name);
      // Khung xem: proxy tua-tức-thì cho b-roll VIDEO (ảnh tĩnh không cần).
      const src =
        opts?.scrubProxy && isVid
          ? await makeScrubProxy(
              item.path,
              join(workDir(projectId), `scrub-insert-${i}.mp4`),
            )
          : item.path;
      const ext = isVid ? ".mp4" : extname(item.path) || ".jpg";
      const name = `insert-${i}${ext}`;
      copyFileSync(src, join(outDir, name));
      // Tỉ lệ đo từ NGUỒN gốc (proxy giữ tỉ lệ) — chính xác hơn.
      const info = await probe(item.path).catch(() => null);
      const aspect =
        info?.width && info?.height ? info.width / info.height : 1;
      // LẤY PHẦN clip: in/out (giây trong clip) + độ dài clip. `null` = cả clip.
      return {
        url: rel(name),
        aspect,
        isVideo: isVid,
        in: item.in ?? null,
        out: item.out ?? null,
        duration: item.duration ?? null,
      };
    }),
  );

  // Phụ đề — CÙNG nguồn với export (`resolveElements`), mốc từng tiếng đã quy dải
  // cắt. Trừ đầu cụm để `OverlayTextBlock` đếm giây từ đầu cụm (như preview).
  const captions: RemotionCaption[] = resolveElements(projectId, kept)
    .filter((e) => e.kind === "text" && !!e.content)
    .map((e) => ({
      start: e.start,
      end: e.end,
      content: e.content as string,
      align: e.align,
      emphasis: e.emphasis,
      band: e.band,
      keywords: e.keywords,
      captionBlock: e.captionBlock ?? null,
      letterCase: e.letterCase,
      keyColor: e.keyColor,
      fontStyle: e.fontStyle,
      wordStarts: e.wordStarts?.map((at) => at - e.start),
      span: e.end - e.start,
    }));

  // CHỮ-SAU-NGƯỜI mở màn hiện đang TẮT (SHOW_BEHIND=false ở composition) → không
  // tính (đỡ gọi emptiestBand mỗi payload). Bật lại thì khôi phục theo lịch sử git.
  const behind: RemotionPayload["behind"] = null;

  // KHUNG XEM hạ khổ (540×960) → ít pixel vẽ mỗi frame; hình học tỉ lệ nên LOOK y
  // hệt (Player phóng lại vừa khung). Export giữ 1080×1920.
  const width = opts?.scrubProxy ? 540 : WIDTH;
  const height = opts?.scrubProxy ? 960 : HEIGHT;
  // Chỗ nối: đọc bảng `effects`, quy mốc sang dải ĐÃ CẮT + tính đỉnh xung
  // (`effectPeak`) — cùng nguồn với bản xuất/khung xem.
  const junctions = (
    db
      .prepare(
        "SELECT start_sec, end_sec, kind FROM effects WHERE project_id=? ORDER BY start_sec",
      )
      .all(projectId) as Array<{
      start_sec: number;
      end_sec: number;
      kind: string;
    }>
  )
    .map((r) => {
      const kind = normalizeJunction(r.kind);
      const start = mapToOutput(kept, r.start_sec) ?? 0;
      const end = mapToOutput(kept, r.end_sec) ?? 0;
      return { start, end, peak: effectPeak(start, end, kind), kind };
    })
    .filter((j) => j.end > j.start);

  return {
    fps: FPS,
    width,
    height,
    seconds: keptTotal,
    preview: !!opts?.scrubProxy,
    sourceAspect:
      baseInfo.width && baseInfo.height ? baseInfo.width / baseInfo.height : null,
    personUrl,
    maskUrl,
    voiceUrl,
    music,
    basePage: blocksFromPack(pack).frame.page,
    pack,
    punchDefocus: pack.punchDefocus,
    scenes: schedule.map((s) => ({
      start: s.start,
      end: s.end,
      layout: s.layout,
      insert: s.insert ?? null,
      frameBlock: s.frameBlock ?? null,
    })),
    inserts,
    captions,
    junctions,
    behind,
  };
}
