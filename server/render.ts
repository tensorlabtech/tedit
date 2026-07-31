import { existsSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { ffmpeg, probe, run } from "./media-tools";
import { OVERLAY_FONT, outDir, workDir } from "./paths";
import {
  textWidth,
  type AlignId,
  type Band,
  type EmphasisId,
} from "./text-layout";
import { placeWords } from "./word-layout";
import { alphaExpr, positionExpr } from "./reveal-expr";

/**
 * Quầng tối sau lưng chữ — thay cho viền cứng, khớp `textShadow` của trang xem.
 *
 * Bán kính 10 cho độ lệch chuẩn ≈ 6px, đúng bằng `text-shadow` bán kính 12 mà
 * trang xem dùng (CSS lấy bán kính gấp đôi độ lệch chuẩn).
 */
const GLOW_RADIUS = 10;
const GLOW_OPACITY = 0.9;

/**
 * Viền mảnh bám sát nét chữ, tính theo cỡ chữ.
 *
 * Chỉ có quầng mờ thì chữ trắng đặt lên tư liệu sáng — ảnh chụp màn hình nền
 * trắng là ca hay gặp nhất — nhoè tới mức không đọc được, vì quầng đã loãng
 * ngay tại mép nét. Cách đúng về mặt hình ảnh là thêm một lớp quầng bán kính
 * nhỏ, nhưng làm mờ ở cỡ đầy đủ trên cả khung tốn gấp ba thời gian xuất.
 * `drawtext` vẽ viền cùng lúc với chữ nên không tốn thêm gì, và ở độ dày này
 * (≈2% cỡ chữ) nó đọc như một quầng chặt chứ không ra "chữ dán".
 *
 * Bản trước dùng 5,5% — dày tới mức nhìn ra ngay là nhãn dán.
 */
const EDGE_SHARE = 0.022;
const EDGE_COLOR = "black@0.7";

export const OUT_WIDTH = 1080;
export const OUT_HEIGHT = 1920;
const FPS = 30;

export type KeptRange = { start: number; end: number };

export type RenderElement = {
  kind: "text" | "insert";
  /** Trục CĂN: các hàng nằm đâu theo bề ngang */
  align?: AlignId;
  /** Trục NHẤN: tiếng nào to hơn tiếng nào trong cụm */
  emphasis?: EmphasisId;
  keywords?: string[];
  start: number;
  end: number;
  content?: string;
  band?: Band;
  mediaPath?: string;
  /** Ảnh tĩnh phải lặp khung; video thì không */
  isStill?: boolean;
  /** Cách tư liệu hiện ra */
  reveal?: RevealId;
  /** Hình dáng khung tư liệu */
  shape?: InsertShape;
  /**
   * Mốc hiện ra của TỪNG TIẾNG, đã quy về dải đã cắt.
   *
   * Chỉ có khi chữ CÒN đúng bằng lời của khoảng từ nó neo vào — lúc đó mới biết
   * chính xác tiếng nào được nói lúc nào. Người dùng viết lại thì nội dung có
   * thể chẳng liên quan gì tới lời nữa, và các tiếng được rải đều trong khoảng.
   */
  wordStarts?: number[];
};

/** Escape cho drawtext: dấu nháy, hai chấm, phần trăm và gạch chéo đều là ký tự điều khiển. */
function escapeDrawText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "’")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%");
}

/**
 * Ghép các video chính thành một dải liền, chuẩn hoá về 9:16.
 *
 * Chuẩn hoá TRƯỚC khi ghép chứ không dùng concat demuxer: các take quay ở máy
 * khác nhau có codec, khung hình, tần số mẫu khác nhau, ghép thô sẽ ra tệp hỏng
 * hoặc mất tiếng ở đoạn thứ hai.
 */
/**
 * Độ dài một mảnh khi ghép: lấy luồng dài hơn trong hai luồng hình/tiếng.
 *
 * Không lấy `format.duration`: với tệp .MOV nhịp thay đổi của iPhone, độ dài
 * khai trong vỏ chứa và độ dài thật của từng luồng lệch nhau, mà chỗ nối thì
 * cần con số của LUỒNG.
 */
async function segmentLength(path: string) {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,duration:format=duration",
    "-of",
    "json",
    path,
  ]);
  const data = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{ codec_type: string; duration?: string }>;
  };
  const num = (value?: string) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const durations = (data.streams ?? [])
    .filter((s) => s.codec_type === "video" || s.codec_type === "audio")
    .map((s) => num(s.duration));
  return Math.max(...durations, num(data.format?.duration));
}

export async function buildBase(projectId: string, sources: string[]) {
  const target = join(workDir(projectId), "base.mp4");
  const inputs = sources.flatMap((path) => ["-i", path]);

  // Độ dài CHỐT của từng mảnh, đo trước khi ghép.
  //
  // Mỗi mảnh phải ra đúng một độ dài cho CẢ hình lẫn tiếng, không thì `concat`
  // nối các luồng lệch nhau và mọi thứ phía sau trôi. Lấy mảnh dài hơn trong hai
  // luồng: hình ngắn hơn thì đệm khung, tiếng ngắn hơn thì đệm im lặng.
  const lengths = await Promise.all(sources.map((path) => segmentLength(path)));

  const parts = sources
    .map((_, index) => {
      const duration = lengths[index].toFixed(3);
      // `fps` đặt TRƯỚC scale để chuẩn hoá nhịp khung ngay từ đầu: video nhịp
      // thay đổi (iPhone hay quay vậy) mà chuẩn hoá muộn thì tiếng lệch dần.
      // `aresample=async=1` bù trôi tiếng ở chỗ nhịp gãy.
      //
      // `tpad`/`apad` đệm cho ĐỦ rồi `trim`/`atrim` cắt về đúng `duration`. Đệm mà
      // không cắt là lỗi cũ: `tpad ... stop_duration=30` nhồi 30 giây khung
      // đứng vào ĐUÔI MỖI mảnh. Với một video thì `-shortest` cắt hộ nên không
      // ai thấy; với ba video thì hai chỗ nối đầu tiên mỗi chỗ ăn nguyên 30 giây
      // hình đứng — đo thật: ba tệp cộng lại 110,9s mà `base.mp4` ra 170,9s,
      // dôi đúng 2 × 30s. Video thứ hai vì thế bắt đầu muộn 30 giây so với chỗ
      // bàn dựng tưởng, và cả bản chép lời lệch theo.
      return (
        `[${index}:v]fps=${FPS},scale=${OUT_WIDTH}:${OUT_HEIGHT}:force_original_aspect_ratio=increase,` +
        `crop=${OUT_WIDTH}:${OUT_HEIGHT},setsar=1,tpad=stop_mode=clone:stop_duration=5,` +
        `trim=duration=${duration},setpts=PTS-STARTPTS[v${index}];` +
        `[${index}:a]aresample=48000:async=1:first_pts=0,aformat=channel_layouts=stereo,` +
        `apad,atrim=duration=${duration},asetpts=PTS-STARTPTS[a${index}]`
      );
    })
    .join(";");
  const concat =
    sources.map((_, index) => `[v${index}][a${index}]`).join("") +
    `concat=n=${sources.length}:v=1:a=1[vout][aout]`;

  await ffmpeg([
    // Không cần cờ xoay: ffmpeg tự áp ma trận xoay của metadata theo mặc định.
    // Bản trước truyền `-autorotate 1` — cờ này không nhận giá trị nên `1` bị
    // hiểu thành tên tệp xuất và cả lệnh chết.
    ...inputs,
    "-filter_complex",
    `${parts};${concat}`,
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    // Không còn `-shortest`: mỗi mảnh đã cắt đúng độ dài của mình, nên tổng là
    // tổng. Để lại thì nó cắt theo luồng ngắn nhất của CẢ bản ghép và có ngày
    // nuốt mất đuôi mảnh cuối.
    "-y",
    target,
  ]);
  return target;
}

/**
 * Cắt bỏ những đoạn người dùng đã gạch ngang.
 *
 * Dùng `trim`/`atrim` rồi `concat` chứ KHÔNG dùng `select`/`aselect`: đo thật
 * thấy `aselect` với biểu thức nhiều khoảng bỏ khung hình đúng nhưng không cắt
 * tiếng — video ra 24 giây mà tiếng vẫn nguyên 45 giây.
 *
 * Biểu thức lọc ghi ra tệp thay vì truyền thẳng: một video dài có thể có hàng
 * trăm khoảng, chuỗi tham số sẽ vượt giới hạn dòng lệnh.
 */
export async function cutRanges(
  projectId: string,
  base: string,
  kept: KeptRange[],
) {
  const target = join(workDir(projectId), "cut.mp4");
  if (kept.length === 0) throw new Error("Không còn đoạn nào để xuất");

  const parts = kept
    .map((range, index) => {
      // Vuốt 8ms ở hai đầu mỗi mẩu tiếng.
      //
      // Nối hai mẩu sóng âm ở hai mức khác nhau tạo ra một bước nhảy — tai nghe
      // ra tiếng "bụp" ngay chỗ cắt. Đo một bản cắt thẳng: mức rơi từ −28dB
      // xuống −62dB trong đúng một ô 10ms. Vuốt ngắn hơn một khung hình thì
      // không ai nghe thấy là đã vuốt, mà bước nhảy thì biến mất.
      const duration = Math.max(0, range.end - range.start);
      const fade = Math.min(0.008, duration / 4);
      const fadeOut =
        fade > 0
          ? `afade=t=in:st=0:d=${fade.toFixed(3)},` +
            `afade=t=out:st=${Math.max(0, duration - fade).toFixed(3)}:d=${fade.toFixed(3)},`
          : "";
      return (
        `[0:v]trim=start=${range.start.toFixed(3)}:end=${range.end.toFixed(3)},` +
        `setpts=PTS-STARTPTS[v${index}];` +
        `[0:a]atrim=start=${range.start.toFixed(3)}:end=${range.end.toFixed(3)},` +
        `asetpts=PTS-STARTPTS,${fadeOut}` +
        `anull[a${index}]`
      );
    })
    .join(";");
  const concat =
    kept.map((_, index) => `[v${index}][a${index}]`).join("") +
    `concat=n=${kept.length}:v=1:a=1[vout][aout]`;

  const scriptPath = join(workDir(projectId), "cut-filter.txt");
  await writeFile(scriptPath, `${parts};${concat}`, "utf8");

  await ffmpeg([
    "-i",
    base,
    "-filter_complex_script",
    scriptPath,
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-y",
    target,
  ]);
  return target;
}

/**
 * Điều kiện hiện: mốc đầu tính, mốc cuối KHÔNG tính.
 *
 * `between(t,a,b)` của ffmpeg tính cả hai đầu, nên tại đúng mốc giao nhau của hai
 * cụm liền kề thì cả hai cùng được vẽ — một khung có hai khối chữ đè nhau, và nó
 * xảy ra ở MỌI lần đổi cụm (video 66 giây có 54 lần). Nháy đúng một khung nên
 * xem thường thì tưởng nhiễu, chỉ lộ ra khi trích đúng khung đó.
 */
const enableRange = (start: number, end: number) =>
  `enable='gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})'`;

/** Đổi mốc trên dải GỐC sang mốc trên dải ĐÃ CẮT. Trả `null` nếu mốc rơi vào đoạn đã bỏ. */
export function mapToOutput(kept: KeptRange[], sourceTime: number) {
  let offset = 0;
  for (const range of kept) {
    if (sourceTime >= range.start && sourceTime <= range.end) {
      return offset + (sourceTime - range.start);
    }
    offset += range.end - range.start;
  }
  return null;
}

/**
 * Bao nhiêu giây được GIỮ LẠI tính từ đầu video tới mốc này.
 *
 * Khác `mapToOutput` ở chỗ luôn trả về một con số: mốc rơi đúng vào đoạn đã bỏ
 * thì lấy mép của đoạn đó. Nhạc cần thế — hai đầu một bài nhạc có thể nằm bất
 * kỳ đâu, kể cả giữa một quãng vừa bị cắt, mà vẫn phải ra được một mốc để đặt.
 */
export function keptBefore(kept: KeptRange[], sourceTime: number) {
  let total = 0;
  for (const range of kept) {
    if (sourceTime <= range.start) break;
    total += Math.min(sourceTime, range.end) - range.start;
  }
  return total;
}

/** Một bài nhạc đã quy về mốc trên dải ĐÃ CẮT. */
export type MusicCue = {
  path: string;
  /** Giây bắt đầu trên bản xuất ra */
  start: number;
  /** Độ dài trên bản xuất ra */
  length: number;
  volume: number;
};

/** Vuốt lên/xuống ở hai đầu bài — nhạc vào và ra đột ngột nghe như lỗi. */
const FADE = 0.75;

/**
 * Trộn nhạc nền vào bản đã dựng.
 *
 * Trộn bằng `amix` ở bước RIÊNG sau khi in chữ, không nhét chung vào bộ lọc
 * hình: gộp chung thì mỗi lần sửa chữ phải mã hoá lại cả tiếng.
 *
 * Mỗi bài là một luồng vào riêng: `-stream_loop -1` cho bài ngắn hơn khoảng đặt
 * thì lặp lại, `atrim` cắt đúng độ dài, `adelay` đẩy tới đúng chỗ. `duration=first`
 * để nhạc không kéo dài video quá phần hình.
 */
export async function mixMusic(
  projectId: string,
  video: string,
  cues: MusicCue[],
) {
  if (cues.length === 0) return video;
  const target = join(outDir(projectId), "final-music.mp4");

  const inputs: string[] = ["-i", video];
  const filters: string[] = [];
  for (const [index, cue] of cues.entries()) {
    inputs.push("-stream_loop", "-1", "-i", cue.path);
    const fade = Math.min(FADE, cue.length / 3);
    const label = `bg${index}`;
    filters.push(
      `[${index + 1}:a]` +
        `atrim=0:${cue.length.toFixed(3)},asetpts=PTS-STARTPTS,` +
        `volume=${cue.volume.toFixed(3)},` +
        `afade=t=in:st=0:d=${fade.toFixed(3)},` +
        `afade=t=out:st=${Math.max(0, cue.length - fade).toFixed(3)}:d=${fade.toFixed(3)},` +
        `adelay=${Math.round(cue.start * 1000)}:all=1[${label}]`,
    );
  }
  // `normalize=0` là bắt buộc: mặc định `amix` chia đều biên độ cho số luồng,
  // nên thêm nhạc lại làm GIỌNG NÓI nhỏ đi 6dB. Mức nhạc điều bằng `volume`.
  const musicLabels = cues.map((_, index) => `[bg${index}]`).join("");
  filters.push(
    `[0:a]${musicLabels}amix=inputs=${cues.length + 1}:duration=first:dropout_transition=0:normalize=0[aout]`,
  );

  await ffmpeg([
    ...inputs,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "0:v",
    "-map",
    "[aout]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    "-y",
    target,
  ]);
  await rename(target, video);
  return video;
}

/**
 * Cách tư liệu chèn HIỆN RA — chỉ HAI kiểu.
 *
 * Bản trước có năm kiểu, mỗi kiểu 0,4 giây. Đo thì đúng, nhưng xem thì không thấy:
 * 0,4 giây với biên độ 6% là dưới ngưỡng nhận ra trên điện thoại. Thà hai kiểu rõ
 * hơn năm kiểu phải căng mắt tìm.
 *
 * `fade-up` (mờ dần + trượt từ dưới lên) là kiểu chính; `fade` là bản nhẹ hơn cho
 * chỗ không muốn có chuyển động.
 */
export type RevealId = "none" | "fade" | "fade-up";

/** 0,8 giây — gấp đôi bản trước, để nhìn là thấy. */
const REVEAL_SECONDS = 0.8;
/** Trượt lên 10% chiều cao khung: 3% là không ai thấy, 20% là như bị quăng. */
const REVEAL_RISE = 0.1;

/** Giá trị cũ trong CSDL đổi về hai kiểu còn lại. */
export function normalizeReveal(value: string | null | undefined): RevealId {
  if (value === "fade" || value === "none" || value === "fade-up") return value;
  // `zoom`, `slide`, `ken` của bản trước: gần nhất là bản có chuyển động.
  if (value) return "fade-up";
  return "none";
}

/**
 * Chuỗi bộ lọc cho luồng tư liệu, gồm cả hiệu ứng hiện ra.
 *
 * `fade` đo theo mốc của dải chính (`st`) nên đặt SAU `setpts`. Cần
 * `format=yuva420p` trước nó, thiếu thì `alpha=1` không có tác dụng gì.
 */
/**
 * HÌNH DÁNG khung tư liệu — bốn dáng, tính bằng tỉ lệ khung 9:16.
 *
 * `full` đè kín; ba dáng còn lại là một hộp thụt 8% mỗi bên, đặt ở 13% chiều cao.
 * Cùng bộ số với thẻ Tư liệu chèn ở màn Style, không thì chọn dáng ở đó xong xuất
 * ra lại thấy dáng khác.
 */
export type InsertShape = "square" | "portrait" | "wide" | "full";

const SHAPE_RATIO: Record<InsertShape, number> = {
  square: 1,
  portrait: 3 / 4,
  wide: 16 / 9,
  full: 9 / 16,
};

/**
 * Bán kính bo góc của khung tư liệu, tính trên khung 1080×1920.
 *
 * 24px ở bề rộng 1080 tương đương `rounded-md` của giao diện ở cỡ xem trước — hai
 * bên phải cùng một con số, không thì xem một đằng in một nẻo.
 */
const CORNER_RADIUS = 24;

/**
 * Kích thước hộp phải là số CHẴN.
 *
 * `scale` của ffmpeg tự làm tròn về số chẵn (yêu cầu của định dạng màu 4:2:0), nên
 * đặt 907 thì ra 906 — mà mặt nạ bo góc dựng đúng 907 sẽ không ghép được:
 * "Input frame sizes do not match". Chẵn hoá ngay ở đây để hai bên luôn khớp.
 */
const even = (value: number) => Math.round(value / 2) * 2;

function shapeBox(shape: InsertShape) {
  if (shape === "full") {
    return { x: 0, y: 0, w: OUT_WIDTH, h: OUT_HEIGHT };
  }
  const w = even(OUT_WIDTH * 0.84);
  const h = even(w / SHAPE_RATIO[shape]);
  return {
    x: even(OUT_WIDTH * 0.08),
    y: even(OUT_HEIGHT * 0.13),
    w,
    // Cao quá khung thì hạ về vừa khung: dáng dọc trên khung 9:16 rất dễ vượt.
    h: Math.min(h, even(OUT_HEIGHT * 0.74)),
  };
}

/**
 * Khoét góc tròn bằng biểu thức TẠI CHỖ, không dùng mặt nạ làm luồng riêng.
 *
 * Mặt nạ luồng riêng (`alphamerge`) thì `ffmpeg` phải khớp mốc thời gian hai luồng —
 * mà lớp tư liệu đã bị dịch mốc (`setpts`) sang giữa video, còn mặt nạ là ảnh tĩnh
 * bắt đầu ở giây 0. Không khớp thì `alphamerge` **chờ mãi**: lệnh treo, không lỗi,
 * không xong.
 *
 * Công thức: điểm nào cách góc gần nhất quá bán kính thì trong suốt. Ở vùng mép
 * (không phải góc) thì một trong hai khoảng bằng 0 nên luôn giữ lại.
 */
function roundCorners(box: { w: number; h: number }) {
  const r = CORNER_RADIUS;
  const dx = `max(0,max(${r}-X,X-${box.w - 1 - r}))`;
  const dy = `max(0,max(${r}-Y,Y-${box.h - 1 - r}))`;
  return (
    `,format=yuva420p,` +
    `geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':` +
    `a='if(lte(hypot(${dx},${dy}),${r}),255,0)'`
  );
}

function insertFilter(insert: RenderElement, index: number, label: string) {
  const reveal = normalizeReveal(insert.reveal);
  const shape = insert.shape ?? "full";
  const box = shapeBox(shape);
  const base =
    `[${index + 1}:v]scale=${box.w}:${box.h}:force_original_aspect_ratio=increase,` +
    `crop=${box.w}:${box.h},setsar=1,fps=${FPS}`;
  // Bo góc TRƯỚC khi dịch mốc và mờ dần: `fade` nhân vào kênh trong suốt sẵn có,
  // nên làm ngược thứ tự thì góc bo bị ghi đè lại thành vuông.
  // Dáng `full` không bo: nó phủ kín khung nên bo sẽ thành bốn góc đen.
  const round = shape === "full" ? "" : roundCorners(box);
  const shift = `,setpts=PTS-STARTPTS+${insert.start.toFixed(3)}/TB`;
  const fade = `,format=yuva420p,fade=t=in:st=${insert.start.toFixed(3)}:d=${REVEAL_SECONDS}:alpha=1`;
  if (reveal === "none") return `${base}${round}${shift}${label}`;
  return `${base}${round}${shift}${fade}${label}`;
}

/** Toạ độ `x` của lớp chèn: mép trái của hộp dáng. */
function insertX(insert: RenderElement) {
  return String(shapeBox(insert.shape ?? "full").x);
}

/**
 * Toạ độ `y` của lớp chèn: mép trên của hộp dáng, cộng phần trượt của `fade-up`.
 *
 * Trượt bằng `overlay` chứ không bằng luồng phụ: `overlay` nhận biểu thức có `t`.
 * Dùng nới chậm (1-p)³ thay vì đều: vào nhanh rồi dừng êm mới ra chuyển động, còn
 * tuyến tính đọc ra như bị kéo bằng tay.
 */
function insertY(insert: RenderElement) {
  const top = shapeBox(insert.shape ?? "full").y;
  if (normalizeReveal(insert.reveal) !== "fade-up") return String(top);
  const st = insert.start.toFixed(3);
  const rise = Math.round(OUT_HEIGHT * REVEAL_RISE);
  const p = `min(1,(t-${st})/${REVEAL_SECONDS})`;
  return `'${top}+if(lt(t,${st}+${REVEAL_SECONDS}),${rise}*pow(1-${p},3),0)'`;
}

/**
 * Nhấn zoom ở mỗi chỗ nối đoạn — hai CHIỀU, không phải một kiểu.
 *
 * - **Vào**: đẩy vào 1,08 rồi thả về 1,00. Cảnh mới "ập" tới.
 * - **Ra**: bắt đầu ở 1,08 rồi mở dần về 1,00. Cảnh mới "mở ra".
 *
 * Đặt ở đầu chuỗi bộ lọc, tức chỉ zoom HÌNH GỐC: chữ và tư liệu chèn vẽ sau nên
 * không bị phóng theo. Phóng cả chữ thì cỡ chữ đã tính công phu thành vô nghĩa.
 *
 * `zoompan` không có biến `t`, chỉ có `on` (số khung ra), nên mọi mốc đổi về khung.
 * `zoompan` cũng không nhận `z < 1`, nên "ra" phải làm bằng cách bắt đầu ở mức
 * phóng rồi hạ về 1 — chứ không phải thu nhỏ xuống dưới 1 rồi nở ra.
 */
/**
 * Cách đánh dấu CHỖ NỐI giữa hai đoạn.
 *
 * Bốn kiểu, và điểm chung quan trọng nhất: **không kiểu nào ăn thời gian**. Mờ chồng
 * (`xfade`) thì ăn — hai đoạn gối nhau 0,4 giây là tổng ngắn đi 0,4 giây, mà cả hệ
 * đứng trên phép "mốc ra = tổng độ dài các khoảng còn giữ": mốc từng chữ, từng tư
 * liệu, cả 50+ cụm phụ đề, và chính mốc các chỗ nối này. Thêm mờ chồng mà không
 * tính lại hết thì mọi thứ trôi dần 0,4 giây mỗi chỗ nối — bảy chỗ nối là lệch gần
 * ba giây ở cuối video, tức phụ đề rơi sang câu khác. Nên chưa làm.
 *
 * Giá trị cũ `in`/`out` vẫn đọc được (xem `normalizeJunction`).
 */
export type JunctionId = "none" | "zoom-in" | "zoom-out" | "flash" | "dip";

export function normalizeJunction(
  value: string | number | null | undefined,
): JunctionId {
  if (value === "in" || value === 1 || value === "1") return "zoom-in";
  if (value === "out") return "zoom-out";
  if (
    value === "zoom-in" ||
    value === "zoom-out" ||
    value === "flash" ||
    value === "dip"
  ) {
    return value;
  }
  return "none";
}

const PUNCH_SECONDS = 0.5;
/** Nửa NGẮN của một chỗ nối — đủ thấy là một cú giật, chưa thành một cú lắc. */
const PUNCH_QUICK = 0.15;
const PUNCH_SCALE = 0.08;
/** Nháy sáng phải RẤT ngắn: 0,12 giây là thấy được mà chưa thành nhức mắt. */
const FLASH_SECONDS = 0.12;
const FLASH_AMOUNT = 0.7;
/** Chìm đen dài hơn nháy sáng một chút, không thì đọc ra như lỗi khung. */
const DIP_SECONDS = 0.18;

/**
 * Xung tại mỗi chỗ nối, giá trị 0..1 — HAI PHÍA, hai nửa dài ngắn khác nhau.
 *
 * Chuyển cảnh là việc của HAI đoạn, không phải của một mốc. Bản trước áp một hàm
 * đối xứng cho ba kiểu và một hàm nửa vời cho `zoom-out` — nên không nói được
 * "đoạn trước làm một đằng, đoạn sau một nẻo", mà đó chính là thứ làm nên chuyển
 * cảnh (xem `handles` của Premiere: nó ăn tư liệu của cả hai bên đúng vì lẽ đó).
 *
 * RÀNG BUỘC không né được: hiệu ứng nằm trên MỘT luồng đã ghép, và thang phóng
 * không xuống dưới 1 được (dưới 1 là lộ mép đen, `crop` không cứu). Nên hai đầu
 * cửa sổ BẮT BUỘC bằng 1 — không thì chỗ vào cửa sổ giật một cái.
 *
 * Vậy thứ còn tự do là NHỊP: nửa trước và nửa sau dài ngắn khác nhau.
 * · dồn chậm rồi buông nhanh  → cảnh cũ ập tới, cắt, xong ngay
 * · giật nhanh rồi trôi chậm  → cắt đánh một nhát, cảnh mới từ từ mở ra
 *
 * Thứ CHƯA làm được: chuyển cảnh mà hai đoạn cùng hiện một lúc (hoà tan, trượt
 * chồng). Cái đó cần giữ hai đoạn tách rời rồi chồng lên nhau.
 */
/**
 * Nhịp hai nửa MẶC ĐỊNH của từng kiểu, tính bằng giây: [trước đỉnh, sau đỉnh].
 *
 * · Zoom vào — dồn chậm (0,5s) rồi buông nhanh (0,15s): cảnh cũ ập tới rồi cắt.
 * · Zoom ra  — giật một nhát (0,15s) rồi trôi ra chậm (0,5s): cảnh mới từ từ mở.
 * · Nháy, chìm — đối xứng: một cú đập, không có "trước" với "sau".
 *
 * Phải khớp `junctionHalves` của `src/dev/overlays/overlay-model.ts` và bộ số
 * trong `doiChoNoiThanhHieuUng` của `server/db.ts`.
 */
export function junctionHalves(kind: JunctionId): [number, number] {
  if (kind === "flash") return [FLASH_SECONDS, FLASH_SECONDS];
  if (kind === "dip") return [DIP_SECONDS, DIP_SECONDS];
  if (kind === "zoom-out") return [PUNCH_QUICK, PUNCH_SECONDS];
  return [PUNCH_SECONDS, PUNCH_QUICK];
}

/**
 * ĐỈNH của xung bên trong một quãng — giữ nguyên tỉ lệ nhịp của kiểu.
 *
 * Đây là chỗ mô hình "hiệu ứng có quãng" khớp lại với mô hình "chỗ nối có mốc":
 * quãng mặc định của một chỗ nối là [cắt−trước, cắt+sau], thay vào đây thì đỉnh
 * rơi đúng vào vết cắt. Người dùng kéo quãng dài ra thì cả hai nửa giãn theo
 * cùng tỉ lệ, nên "zoom vào" vẫn còn là dồn-chậm-buông-nhanh chứ không biến
 * thành một thứ khác.
 */
export function effectPeak(start: number, end: number, kind: JunctionId) {
  const [before, after] = junctionHalves(kind);
  return start + (end - start) * (before / (before + after));
}

/** Xung 0..1 của từng hiệu ứng, mỗi cái mang quãng của riêng nó. */
function pulseExpr(spans: Array<{ start: number; end: number; peak: number }>) {
  const shape = (span: { start: number; end: number; peak: number }) => {
    // Chống chia cho 0: quãng ngắn quá thì kẹp lại còn một khung ở mỗi nửa.
    const before = Math.max(0.04, span.peak - span.start).toFixed(3);
    const after = Math.max(0.04, span.end - span.peak).toFixed(3);
    const at = span.peak.toFixed(3);
    const a = `if(between(t,${at}-${before},${at}),1-(${at}-t)/${before},0)`;
    const b = `if(between(t,${at},${at}+${after}),1-(t-${at})/${after},0)`;
    return `max(${a},${b})`;
  };
  return spans.map(shape).reduce((a, b) => `max(${a},${b})`);
}

function junctionFilter(
  spans: Array<{ start: number; end: number; peak: number }>,
  kind: JunctionId,
) {
  if (kind === "none" || spans.length === 0) return null;

  if (kind === "flash" || kind === "dip") {
    const amount = kind === "flash" ? FLASH_AMOUNT : -1;
    const pulse = pulseExpr(spans);
    return `eq=brightness='${amount}*(${pulse})':eval=frame`;
  }

  const pulse = pulseExpr(spans);
  const z = `(1+${PUNCH_SCALE}*(${pulse}))`;
  // `crop` phải được nói RÕ mép trái/trên, không dùng mặc định.
  //
  // Trong ffmpeg, `crop` tính `w`/`h` MỘT LẦN lúc dựng chuỗi lọc, còn `x`/`y`
  // tính theo từng khung. Mặc định `x=(in_w-out_w)/2` dùng `in_w` của LIÊN KẾT
  // — con số chốt từ đầu, tức 1080 — nên `x` luôn bằng 0. Ảnh phóng to ra thì
  // phần bị cắt dồn hết sang phải: nhìn ra là hình TRƯỢT NGANG chứ không phải
  // phóng từ tâm.
  //
  // Đo thật trên một hình có chữ thập ở giữa: tâm lệch +42px lúc đỉnh. Viết
  // thẳng mép theo `t` (qua chính biểu thức phóng) thì tâm đứng yên trong ±0,8px
  // mà mức phóng vẫn đủ.
  //
  // Không đảo thứ tự thành `crop` rồi `scale` được: `crop` chốt `w`/`h` một lần
  // nên cửa sổ cắt không bao giờ đổi — đo ra là không phóng một chút nào.
  return (
    `scale=w='${OUT_WIDTH}*${z}':h='${OUT_HEIGHT}*${z}':eval=frame,` +
    `crop=${OUT_WIDTH}:${OUT_HEIGHT}:` +
    `x='(${OUT_WIDTH}*${z}-${OUT_WIDTH})/2':` +
    `y='(${OUT_HEIGHT}*${z}-${OUT_HEIGHT})/2'`
  );
}

/** In chữ và đè tư liệu chèn lên dải đã cắt. */
export async function burnElements(
  projectId: string,
  cut: string,
  elements: RenderElement[],
  /** Hiệu ứng trên dải ĐÃ CẮT — mỗi cái mang kiểu và quãng của riêng nó */
  effects: Array<{ start: number; end: number; kind: JunctionId }> = [],
) {
  const target = join(outDir(projectId), "final.mp4");
  const inserts = elements.filter(
    (item) =>
      item.kind === "insert" && item.mediaPath && existsSync(item.mediaPath),
  );
  const texts = elements.filter((item) => item.kind === "text" && item.content);

  const filters: string[] = [];
  let stream = "[0:v]";

  // Gom hiệu ứng THEO KIỂU rồi nối chuỗi lọc của từng kiểu.
  //
  // Mỗi kiểu là một bộ lọc khác nhau (phóng thì `scale`+`crop`, nháy/chìm thì
  // `eq`), không nhét chung một biểu thức được. Nhưng chúng không giẫm chân nhau:
  // mỗi bộ lọc chỉ động vào cửa sổ quanh quãng của chính nó, ngoài đó trả về
  // đúng khung gốc.
  const byKind = new Map<
    JunctionId,
    Array<{ start: number; end: number; peak: number }>
  >();
  for (const item of effects) {
    if (item.kind === "none" || item.end <= item.start) continue;
    const list = byKind.get(item.kind) ?? [];
    list.push({
      start: item.start,
      end: item.end,
      peak: effectPeak(item.start, item.end, item.kind),
    });
    byKind.set(item.kind, list);
  }
  let junctionIndex = 0;
  for (const [kind, spans] of byKind) {
    const chain = junctionFilter(spans, kind);
    if (!chain) continue;
    const label = `[junction${junctionIndex++}]`;
    filters.push(`${stream}${chain}${label}`);
    stream = label;
  }

  inserts.forEach((insert, index) => {
    const label = `[ins${index}]`;
    // `setpts` dịch mốc luồng chèn về đúng chỗ trên dải chính; không dịch thì nó
    // khớp theo thời gian của chính nó và luôn rơi về đầu video.
    filters.push(insertFilter(insert, index, label));

    const next = `[ov${index}]`;
    filters.push(
      `${stream}${label}overlay=x=${insertX(insert)}:y=${insertY(insert)}:` +
        `${enableRange(insert.start, insert.end)}${next}`,
    );
    stream = next;
  });

  // Mọi chữ đi CHUNG một đường: xếp theo từng tiếng, rồi mỗi tiếng một lệnh vẽ
  // có biểu thức thời gian riêng. Trước đây kiểu "cỡ đều" đi đường bẻ dòng (một
  // lệnh mỗi DÒNG) cho nhẹ, nhưng vẽ cả dòng bằng một lệnh thì không cách nào
  // cho từng tiếng hiện lần lượt — mà đó lại là kiểu chữ của cả hệ này.
  const draws: string[] = [];
  for (const text of texts) {
    const placed = await placeWords(
      text.content!,
      text.keywords ?? [],
      text.align ?? "center",
      text.emphasis ?? "even",
      text.band ?? "top",
      OUT_WIDTH,
      OUT_HEIGHT,
    );
    for (const [flat, word] of placed.entries()) {
      // Có mốc thật thì theo mốc thật; không thì RẢI ĐỀU số tiếng trong đúng
      // khoảng của cụm. Thứ tự phẳng của `placed` giữ nguyên thứ tự tiếng trong
      // câu ở mọi kiểu nhấn, nên chỉ số này khớp thẳng với mảng mốc.
      //
      // Nhịp cố định (0,07 giây một tiếng) là sai ở đây: cụm 2 giây thì chữ
      // chạy hết trong nửa giây rồi đứng im, mà nói nhanh nói chậm gì cũng thế.
      // Rải đều thì chữ vẫn bám theo nhịp của chính quãng nói đó — đây là luật
      // của `OverlayTextBlock` ở khung xem, hai bên phải giống nhau.
      const spoken = text.wordStarts?.[flat];
      const startAt =
        spoken !== undefined
          ? spoken
          : placed.length > 1
            ? text.start + ((text.end - text.start) * flat) / placed.length
            : text.start;
      const spot = positionExpr({
        x: word.x,
        y: word.y,
        width: await textWidth(word.text, word.fontSize),
        fontSize: word.fontSize,
        scale: word.fontSize / OUT_WIDTH,
        startAt,
      });
      draws.push(
        `drawtext=fontfile='${OVERLAY_FONT}':text='${escapeDrawText(word.text)}':` +
          // Không có tham số nghiêng: nghiêng nằm trong chính tệp font
          // (`OVERLAY_FONT` là bản Bold Italic). Cờ `italic` cũ ở đây không làm
          // gì cả, nên video in ra đứng thẳng trong khi trang xem nghiêng.
          `fontcolor=${word.color}:alpha='${alphaExpr(startAt, word.alpha)}':` +
          `fontsize=${word.fontSize}:x='${spot.x}':y='${spot.y}':` +
          `borderw=${Math.max(2, Math.round(word.fontSize * EDGE_SHARE))}:` +
          `bordercolor=${EDGE_COLOR}:` +
          enableRange(text.start, text.end),
      );
    }
  }
  if (draws.length > 0) {
    // Chữ vẽ lên một LỚP TRONG SUỐT riêng chứ không vẽ thẳng lên hình, để làm
    // được quầng tối mềm sau lưng chữ.
    //
    // Trước đây tách chữ khỏi nền bằng `borderw` — một đường viền đen sắc cạnh.
    // Nó đọc được, nhưng nhìn ra ngay là "chữ dán lên", trong khi trang xem dùng
    // `text-shadow` toả đều nên chữ như nằm trong hình. Làm mờ thì phải có cả
    // khối chữ trên một lớp riêng: mờ trực tiếp trên hình thì mờ luôn cả hình.
    //
    // Nối các lệnh vẽ bằng dấu phẩy thành MỘT chuỗi thay vì mỗi tiếng một nhãn:
    // năm mươi cụm phụ đề là hơn hai trăm nhãn, đủ để đồ thị lọc dài quá mức.
    const layer = `[${1 + inserts.length}:v]`;
    filters.push(`${layer}${draws.join(",")}[txt]`);
    filters.push(`[txt]split[glowsrc][txtmain]`);
    // Bóp hết màu về đen nhưng GIỮ hình dạng (kênh trong), rồi làm mờ ở NỬA CỠ
    // và phóng lại: kết quả vốn là một vệt mờ nên thu nhỏ trước không thấy khác,
    // mà làm mờ thẳng ở cỡ đầy đủ tốn gấp đôi thời gian xuất.
    filters.push(
      `[glowsrc]colorchannelmixer=rr=0:rg=0:rb=0:gr=0:gg=0:gb=0:br=0:bg=0:bb=0:` +
        `aa=${GLOW_OPACITY},scale=${OUT_WIDTH / 2}:${OUT_HEIGHT / 2},` +
        `boxblur=luma_radius=${GLOW_RADIUS / 2}:alpha_radius=${GLOW_RADIUS / 2},` +
        `scale=${OUT_WIDTH}:${OUT_HEIGHT}[glow]`,
    );
    // `format=rgb` khi chồng: để mặc định thì ffmpeg chồng trong không gian dải
    // hẹp và chữ trắng mất độ sáng.
    filters.push(`${stream}[glow]overlay=format=rgb[bg]`);
    filters.push(`[bg][txtmain]overlay=format=rgb[out]`);
    stream = "[out]";
  }

  if (filters.length === 0) {
    await ffmpeg(["-i", cut, "-c", "copy", "-y", target]);
    return target;
  }

  // Lớp chữ dài hơn dải đã cắt một giây cho chắc; đầu ra bị cắt lại đúng độ dài
  // dải bằng `-t` phía dưới.
  const cutSeconds = (await probe(cut)).duration;
  const layerSeconds = cutSeconds + 1;

  await ffmpeg([
    "-i",
    cut,
    // Ảnh tĩnh chỉ có MỘT khung: không lặp thì điều kiện thời gian không bao
    // giờ khớp vì luồng ảnh đã hết ngay tại giây 0.
    ...inserts.flatMap((insert) =>
      insert.isStill
        ? [
            "-loop",
            "1",
            "-t",
            (insert.end - insert.start + 0.5).toFixed(3),
            "-i",
            insert.mediaPath!,
          ]
        : ["-i", insert.mediaPath!],
    ),
    // Lớp trong suốt để vẽ chữ. PHẢI có thời lượng: nguồn `color` không giới hạn
    // thì bộ điều phối của ffmpeg kéo khung từ nó không ngừng — nó luôn sẵn sàng
    // trả khung tiếp theo nên không bao giờ chờ luồng video. Thiếu `d=` thì lệnh
    // xuất chạy hàng chục phút cho một video một phút mà vẫn không xong, và
    // không có thông báo lỗi nào.
    //
    // Phải là `format=rgba` ngay trong chuỗi nguồn:
    // `color` một mình sinh ra khung KHÔNG có kênh trong, và bước đổi định dạng
    // sau đó điền kênh trong bằng 1 — thành ra cả khung đen kịt đè lên video.
    ...(draws.length > 0
      ? [
          "-f",
          "lavfi",
          "-i",
          // `format=rgba` phải nằm NGAY trong chuỗi nguồn: `color` một mình sinh
          // khung KHÔNG có kênh trong, và bước đổi định dạng sau đó điền kênh
          // trong bằng 1 — thành ra cả khung đen kịt đè lên video.
          //
          // Giữ RGB chứ không hạ xuống `yuva420p` cho nhanh: `yuva420p` là dải
          // hẹp, chữ trắng tụt từ 255 xuống 235 và cả lớp chữ xỉn đi thấy rõ khi
          // đặt cạnh trang xem.
          `color=c=black@0.0:s=${OUT_WIDTH}x${OUT_HEIGHT}:r=${FPS}:d=${layerSeconds.toFixed(3)},format=rgba`,
        ]
      : []),
    "-filter_complex",
    (() => {
      const value = filters.join(";");
      if (process.env.TEDDIT_LOG_FILTER)
        console.log("[bộ lọc]", value.slice(0, 600));
      return value;
    })(),
    "-map",
    (() => {
      if (process.env.TEDDIT_LOG_FILTER) console.log("[map]", stream);
      return stream;
    })(),
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    // Remotion và một số nguồn để lại chương/metadata làm trình phát báo sai
    // thời lượng — cắt sạch cho chắc.
    "-map_chapters",
    "-1",
    "-map_metadata",
    "-1",
    // Chốt độ dài ĐẦU RA bằng độ dài dải đã cắt.
    //
    // Lớp chữ là một nguồn dài hơn video, và `overlay` kéo đầu ra tới luồng DÀI
    // NHẤT — video ra thừa một giây đóng băng khung cuối, lại còn câm tiếng ở
    // đoạn thừa đó. `shortest=1` của `overlay` đáng lẽ chặn được, nhưng khi phía
    // trước còn mấy lớp tư liệu chèn thì nó mất tác dụng. `-t` ở đầu ra thì luôn
    // đúng, bất kể chuỗi lọc dài ngắn ra sao.
    "-t",
    cutSeconds.toFixed(3),
    "-y",
    target,
  ]);
  return target;
}
