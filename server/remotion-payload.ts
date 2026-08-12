import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import { buildPlacedSegments } from "./layout-segments";
import { scheduleScenes } from "./layout-schedule";
import { PICKABLE_LAYOUTS } from "./layout-kinds";
import { ffmpeg, probe } from "./media-tools";
import { VIDEO } from "./routes/media-formats";
import { workDir } from "./paths";
import { behindElement, keptRanges, resolveElements } from "./pipeline";
import { emptiestBand } from "./subject-mask";
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
  sourceAspect: number | null;
  /** URL (tương đối `public/`) video người đã dựng. */
  personUrl: string;
  /** Mặt nạ tách người (trắng=người), null nếu chưa có. */
  maskUrl: string | null;
  /** Nền trang gốc của bộ dáng (mỗi cảnh có thể đè bằng `frameBlock.page`). */
  basePage: FrameBlock["page"];
  /** Bộ dáng dự án — để composition gọi `packForElement` cho từng cụm chữ. */
  pack: StylePack;
  scenes: RemotionScene[];
  inserts: Array<{ url: string; aspect: number }>;
  captions: RemotionCaption[];
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

  // Thư mục tĩnh cho Remotion đọc. Copy một lần mỗi lần dựng payload.
  const outDir = join(process.cwd(), "public", "remotion", projectId);
  mkdirSync(outDir, { recursive: true });
  const rel = (name: string) => `remotion/${projectId}/${name}`;

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
      return { url: rel(name), aspect };
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

  // CHỮ-SAU-NGƯỜI mở màn: chữ chìm, người tách nền đè lên (chữ hở quanh người).
  // Người-đã-tách dựng SẴN thành webm ALPHA bằng ffmpeg (tiền xử lý — mask video
  // không dùng thẳng làm alpha trong Chromium được), rồi Remotion chỉ việc layer.
  let behind: RemotionPayload["behind"] = null;
  if (pack.behindText) {
    const behindEl = behindElement(projectId);
    const line = behindEl?.content.trim() ? behindEl.content : null;
    if (line) {
      const band =
        (await emptiestBand(projectId, baseInfo.duration / 2).catch(() => null))
          ?.index ?? 0;
      const secs = pack.behindText.seconds;
      // behindText mở màn đang TẮT (SHOW_BEHIND=false ở composition) → KHÔNG encode
      // webm alpha (nặng, mỗi lần dựng payload sẽ chậm). Giữ line/band phòng khi
      // bật lại; lúc đó thêm lại bước tách người (xem lịch sử `behind-person.webm`).
      behind = { line, band, seconds: secs, personCutUrl: null };
    }
  }

  // KHUNG XEM hạ khổ (540×960) → ít pixel vẽ mỗi frame; hình học tỉ lệ nên LOOK y
  // hệt (Player phóng lại vừa khung). Export giữ 1080×1920.
  const width = opts?.scrubProxy ? 540 : WIDTH;
  const height = opts?.scrubProxy ? 960 : HEIGHT;
  return {
    fps: FPS,
    width,
    height,
    seconds: keptTotal,
    sourceAspect:
      baseInfo.width && baseInfo.height ? baseInfo.width / baseInfo.height : null,
    personUrl,
    maskUrl,
    basePage: blocksFromPack(pack).frame.page,
    pack,
    scenes: schedule.map((s) => ({
      start: s.start,
      end: s.end,
      layout: s.layout,
      insert: s.insert ?? null,
      frameBlock: s.frameBlock ?? null,
    })),
    inserts,
    captions,
    behind,
  };
}
