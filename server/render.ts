import {
  findJunction,
  junctionHalves,
  type JunctionId,
} from "./junction-kinds";
import { existsSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  POP_HOLD,
  POP_SNAP,
  REVEALS,
  REVEAL_RISE,
  REVEAL_SECONDS,
  SLIDE_SHIFT,
} from "./insert-reveal";
import { ffmpeg, probe, run } from "./media-tools";
import { wrapMeta } from "./graphics-manifest";
import { layoutHeadline } from "./headline";
import { GRAPHICS_DIR, outDir, resolvePackFont, workDir } from "./paths";
import { layoutPlan, sourceCount } from "./layout-render";
import type { ScheduledScene } from "./timing";
import {
  boxBorderW,
  ffmpegColor,
  contentRect,
  subjectCutChain,
  HEADLINE_FADE,
  headlineHold,
  fontRoleFor,
  frameFilter,
  graphicsSteps,
  doodleSteps,
  sweepSteps,
  wrapBox,
  wrapSteps,
  gradeFilter,
  packForElement,
  plateFilter,
  withFontRole,
  blocksFromPack,
  type StylePack,
} from "./style-pack";
import type {
  CaptionBlock,
  FrameBlock,
  JunctionBlock,
  RevealId,
  SceneBlock,
} from "./style-pack";
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
/**
 * Quầng tối và viền mảnh nay nằm trong bộ dáng (`glow`, `edge`).
 *
 * Viền: chỉ có quầng mờ thì chữ trắng đặt lên tư liệu sáng — ảnh chụp màn hình
 * nền trắng là ca hay gặp nhất — nhoè tới mức không đọc được, vì quầng đã loãng
 * ngay tại mép nét. Cách đúng về mặt hình ảnh là thêm một lớp quầng bán kính
 * nhỏ, nhưng làm mờ ở cỡ đầy đủ trên cả khung tốn gấp ba thời gian xuất.
 * `drawtext` vẽ viền cùng lúc với chữ nên không tốn thêm gì, và ở độ dày ≈2% cỡ
 * chữ nó đọc như một quầng chặt chứ không ra "chữ dán". Bản trước dùng 5,5% —
 * dày tới mức nhìn ra ngay là nhãn dán.
 */

/** Mỗi tầng chữ-sau-người vào sau tầng trước ngần này giây. */
const BEHIND_TIER_STEP = 0.22;
/** Cả chồng chữ trôi lên ngần này điểm ảnh trong suốt lúc nó hiện. */
const BEHIND_DRIFT = 90;
/** Số dải mà `emptiestBand` chia khung — phải khớp bên đo. */
export const BEHIND_BANDS = 5;
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
  /** Cụm này tự đè trục viết hoa; rỗng thì theo bộ dáng của dự án */
  letterCase?: StylePack["letterCase"] | null;
  /** Cụm này tự đè màu nhấn; rỗng thì theo bộ dáng của dự án */
  keyColor?: string | null;
  /** Cụm này tự đè phong cách chữ; rỗng thì theo mặc định của dự án */
  fontStyle?: string | null;
  /** Look chữ ĐÃ ĐÓNG DẤU của cụm (`element.caption_block`) — cụm tự mang look. */
  captionBlock?: CaptionBlock | null;
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

/**
 * Đưa chữ người dùng vào `drawtext` qua MỘT TỆP, không qua tham số `text`.
 *
 * Sửa HAI lỗi cùng lúc, cả hai đều thuộc loại im lặng:
 *
 * 1. Phép escape cũ đổi `'` thành `’` — lặng lẽ sửa chữ người dùng gõ. `don't`
 *    in ra `don’t`, không ai báo gì. Qua tệp thì `'` và `:` hết là ký tự phân
 *    cách của cú pháp filter nên giữ nguyên được.
 * 2. Escape `\%` bên trong `text='...'` làm `drawtext` bỏ HẲN cả từ chứa nó.
 *    Đo trên đúng đường vẽ này: `khong dau nhay: 50% xong` in ra thành
 *    `khong dau nhay: xong`. Mất chữ mà không lỗi, không cảnh báo. Cùng chuỗi
 *    `\%` ấy đặt trong TỆP thì vẽ ra `%` đúng.
 *
 * `\` và `%` vẫn phải escape: chúng là chuyện của lớp KHAI TRIỂN bên trong
 * `drawtext`, không phải của lớp cú pháp, nên đổi cách đưa chữ vào không đụng
 * tới chúng. Bỏ escape `%` thì lại rơi vào đúng lỗi (2) — đã đo.
 */
function textFileFor(projectId: string, id: string, value: string) {
  const path = join(workDir(projectId), `text-${id}.txt`);
  writeFileSync(path, value.replace(/\\/g, "\\\\").replace(/%/g, "\\%"), "utf8");
  return path;
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

/**
 * Bản XEM TRƯỚC: nửa bề ngang, đủ nét cho một khung cao chưa tới 700px trên màn.
 *
 * Bàn dựng từng phát thẳng `base.mp4` — đo thật một dự án 159 giây: 212 MB,
 * 10,5 Mbps, `moov` nằm CUỐI tệp, khung khoá cách nhau 6–7 giây. Bốn thứ ấy cộng
 * lại thành "kéo thanh thời gian thì hình giật đùng đùng", và Cloudflare không
 * cache nên mỗi lượt xem kéo nguyên 212 MB từ VPS ở châu Âu.
 *
 * Bản này ra khoảng 1/8 dung lượng, `+faststart` để trình duyệt phát được ngay
 * từ byte đầu, và `-g` bằng đúng một giây để tua tới đâu là hiện tới đó.
 */
export const PREVIEW_WIDTH = 540;
export const PREVIEW_HEIGHT = 960;

/**
 * Bộ lọc chuẩn hoá và nối mạch chính — dùng chung cho cả hai bản dựng.
 *
 * Trả về đồ thị kết thúc bằng `[vout]` (1080×1920, 30fps) và `[aout]` (48kHz
 * stereo). Ai dùng thì tự nối tiếp phần của mình vào hai nhãn đó.
 */
async function mainGraph(sources: string[]) {
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
  return `${parts};${concat}`;
}

/**
 * Thứ BÀN DỰNG cần: bản xem trước nhẹ và tệp tiếng cho máy nghe. KHÔNG có
 * `base.mp4`.
 *
 * Đây là cú tách quan trọng nhất về thời gian chờ. Trước đây `audio.wav` được
 * tách RA TỪ `base.mp4`, nên máy nghe phải đợi xong cả lượt mã hoá 1080×1920 mới
 * được bắt đầu — đo thật trên một dự án 159 giây: **6 phút 26 giây** ngồi nhìn
 * "Chuẩn bị video", trong khi thứ máy nghe cần chỉ là mấy MB tiếng.
 *
 * Bản 540×960 ít hơn bốn lần số điểm ảnh nên dựng nhanh hơn hẳn, và bàn dựng
 * không cần gì hơn thế: `base.mp4` chỉ `cutRanges` lúc XUẤT VIDEO mới đụng tới.
 *
 * Hai tệp vẫn ra từ MỘT lượt giải mã — `asplit` cho tiếng đi hai đường, một
 * đường nén AAC cho bản xem trước, một đường PCM 16kHz mono cho máy nghe.
 */
export async function buildPreview(projectId: string, sources: string[]) {
  const preview = join(workDir(projectId), "preview.mp4");
  const audio = join(workDir(projectId), "audio.wav");
  const inputs = sources.flatMap((path) => ["-i", path]);
  const graph = await mainGraph(sources);

  await ffmpeg([
    ...inputs,
    "-filter_complex",
    `${graph};[vout]scale=${PREVIEW_WIDTH}:${PREVIEW_HEIGHT}[vprev];` +
      `[aout]asplit=2[axem][anghe]`,

    // ── bản xem trước cho bàn dựng ──────────────────────────────────────────
    "-map",
    "[vprev]",
    "-map",
    "[axem]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "28",
    // Khung khoá mỗi giây: tua tới đâu hiện tới đó. Mặc định của x264 là 250
    // khung (hơn 8 giây), và kéo thanh thời gian trên đó thì hình giật.
    "-g",
    String(FPS),
    // `moov` lên đầu tệp để trình duyệt phát được ngay từ byte đầu.
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-y",
    preview,

    // ── tệp tiếng cho máy nghe: 16kHz mono, đúng thứ whisper ăn ─────────────
    "-map",
    "[anghe]",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    "-y",
    audio,
  ]);
  return { preview, audio };
}

/**
 * Bản CHẤT LƯỢNG — nguồn duy nhất cho bản xuất cuối (`cutRanges`).
 *
 * Chạy NỀN, sau khi bàn dựng đã mở được. Không ai ngồi đợi nó: người dùng đang
 * đọc bản chép lời thì nó dựng xong từ lúc nào không biết.
 *
 * Đổi lại là giải mã nguồn hai lượt thay vì một — tổng công việc của máy tăng
 * khoảng 30%. Đáng, vì thứ đắt không phải công của máy mà là thời gian người
 * ngồi chờ, và chỗ này cắt được hơn bốn phút khỏi quãng chờ ấy.
 */
export async function buildMaster(projectId: string, sources: string[]) {
  const target = join(workDir(projectId), "base.mp4");
  /*
   * Dựng ra tên TẠM rồi mới đổi tên — `rename` trên cùng ổ là một thao tác
   * không thể đứt đôi.
   *
   * Ghi thẳng vào `base.mp4` thì một lượt bị giết giữa chừng (máy chủ khởi động
   * lại, Docker dừng container, hết đĩa) để lại một tệp CỤT mang đúng cái tên
   * ấy. Lần sau `runMaster` thấy tệp tồn tại nên bỏ qua, và lượt xuất video cắt
   * trên một tệp hỏng — hỏng ở đúng bước ăn tiền, sau khi người dùng đã sửa
   * xong xuôi.
   */
  const partial = join(workDir(projectId), "base.dang-dung.mp4");
  const inputs = sources.flatMap((path) => ["-i", path]);
  const graph = await mainGraph(sources);

  await ffmpeg([
    // Không cần cờ xoay: ffmpeg tự áp ma trận xoay của metadata theo mặc định.
    // Bản trước truyền `-autorotate 1` — cờ này không nhận giá trị nên `1` bị
    // hiểu thành tên tệp xuất và cả lệnh chết.
    ...inputs,
    "-filter_complex",
    graph,
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
    "-movflags",
    "+faststart",
    "-y",
    partial,
  ]);
  await rename(partial, target);
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
/**
 * Chuyển cảnh HAI LUỒNG đặt ở một ranh giới: `sau` là chỉ số đoạn đứng trước nó.
 *
 * `dem` là số giây mượn thêm ở MỖI bên, lấy từ chính quãng vừa bị cắt bỏ. Nơi
 * gọi đã kiểm quãng đó đủ dài — ở đây chỉ việc dùng.
 */
export type CrossAt = { sau: number; transition: string; dem: number };

export async function cutRanges(
  projectId: string,
  base: string,
  kept: KeptRange[],
  crossAt: CrossAt[] = [],
  /**
   * Tên tệp ra. Đổi khi cần cắt một luồng KHÁC theo cùng bộ khoảng.
   *
   * Ca thật: mặt nạ người dựng trên `base.mp4` chưa cắt, mà bản xuất thì đã bỏ
   * hai mươi sáu giây — hai trục lệch nhau, và cái viền bám dáng người rơi vào
   * một tư thế cách đó mấy giây. Cắt mặt nạ bằng CHÍNH hàm này, cùng `kept`,
   * cùng `crossAt`, là cách duy nhất bảo đảm chúng không lệch một khung nào.
   */
  outName = "cut.mp4",
) {
  const target = join(workDir(projectId), outName);
  if (kept.length === 0) throw new Error("Không còn đoạn nào để xuất");

  const cross = new Map(crossAt.map((item) => [item.sau, item]));

  /*
   * Biên CẮT khác biên GIỮ: chỗ nối nào có chuyển cảnh thì hai đoạn được kéo dài
   * về phía nhau, lấn vào quãng vừa bỏ.
   *
   * `kept` gốc KHÔNG được đụng tới — mọi phép quy mốc chữ, tư liệu và nhạc đều
   * đọc nó, sửa ở đây là lệch hết. Bảng dưới chỉ sống trong hàm này.
   */
  const bounds = kept.map((range) => ({ ...range }));
  for (const [sau, item] of cross) {
    bounds[sau].end += item.dem;
    bounds[sau + 1].start -= item.dem;
  }

  const parts = bounds
    .map((range, index) => {
      // Vuốt 8ms ở hai đầu mỗi mẩu tiếng.
      //
      // Nối hai mẩu sóng âm ở hai mức khác nhau tạo ra một bước nhảy — tai nghe
      // ra tiếng "bụp" ngay chỗ cắt. Đo một bản cắt thẳng: mức rơi từ −28dB
      // xuống −62dB trong đúng một ô 10ms. Vuốt ngắn hơn một khung hình thì
      // không ai nghe thấy là đã vuốt, mà bước nhảy thì biến mất.
      //
      // Ranh giới có chuyển cảnh thì `acrossfade` lo phần nối, nên không vuốt
      // thêm ở đầu ấy — vuốt chồng lên nhau thành một lỗ thủng nghe rõ.
      const duration = Math.max(0, range.end - range.start);
      const fade = Math.min(0.008, duration / 4);
      const vuotDau = fade > 0 && !cross.has(index - 1);
      const vuotCuoi = fade > 0 && !cross.has(index);
      const fadeOut =
        (vuotDau ? `afade=t=in:st=0:d=${fade.toFixed(3)},` : "") +
        (vuotCuoi
          ? `afade=t=out:st=${Math.max(0, duration - fade).toFixed(3)}:d=${fade.toFixed(3)},`
          : "");
      /*
       * `settb=AVTB` — chỉ đặt khi bản dựng CÓ chuyển cảnh, và bắt buộc khi có.
       *
       * `concat` trả ra luồng ở thang thời gian 1/1000000, còn `trim` giữ nguyên
       * thang của tệp gốc (1/15360 với video điện thoại đo được). Chuỗi nối trộn
       * hai loại ấy, nên tới chỗ `xfade` nhận một luồng từ `concat` và một luồng
       * từ `trim` là nó từ chối thẳng: "input link timebases do not match", và cả
       * lệnh dựng chết.
       *
       * Kéo mọi luồng về cùng một thang trước khi nối thì hết. Không đặt khi
       * không có chuyển cảnh: đường ấy đang chạy đúng, không có lý do đụng vào.
       */
      const tb = cross.size > 0 ? ",settb=AVTB" : "";
      return (
        `[0:v]trim=start=${range.start.toFixed(3)}:end=${range.end.toFixed(3)},` +
        `setpts=PTS-STARTPTS${tb}[v${index}];` +
        `[0:a]atrim=start=${range.start.toFixed(3)}:end=${range.end.toFixed(3)},` +
        `asetpts=PTS-STARTPTS${tb ? ",asettb=AVTB" : ""},${fadeOut}` +
        `anull[a${index}]`
      );
    })
    .join(";");

  /*
   * Nối TỪNG CẶP một thay vì `concat` cả loạt.
   *
   * `xfade` chỉ ăn đúng hai luồng, và nó phải biết `offset` — mốc bắt đầu hoà,
   * tính trên luồng bên trái đã dài bao nhiêu. Nên phải xâu chuỗi và đi kèm một
   * bộ đếm độ dài; `concat` một phát không cho chỗ nào chen việc đó vào.
   *
   * Ranh giới không có chuyển cảnh vẫn dùng `concat`, chỉ là dạng hai luồng.
   */
  const joins: string[] = [];
  let vTruoc = "[v0]";
  let aTruoc = "[a0]";
  let duration = bounds[0].end - bounds[0].start;

  for (let index = 1; index < bounds.length; index++) {
    const item = cross.get(index - 1);
    const vRa = index === bounds.length - 1 ? "[vout]" : `[vc${index}]`;
    const aRa = index === bounds.length - 1 ? "[aout]" : `[ac${index}]`;
    const daiNay = bounds[index].end - bounds[index].start;

    if (item) {
      const d = item.dem * 2;
      // `offset` đo từ đầu luồng TRÁI: hoà bắt đầu sớm hơn mép cuối đúng bằng
      // thời lượng hoà, để nó kết thúc vừa lúc luồng trái hết.
      const offset = Math.max(0, duration - d);
      joins.push(
        `${vTruoc}[v${index}]xfade=transition=${item.transition}:` +
          `duration=${d.toFixed(3)}:offset=${offset.toFixed(3)}${vRa}`,
      );
      joins.push(`${aTruoc}[a${index}]acrossfade=d=${d.toFixed(3)}${aRa}`);
      // Gối nhau `d` giây nên tổng ngắn đi đúng `d` — và `d` cũng đúng bằng
      // phần vừa mượn thêm ở hai bên. Hai số triệt tiêu nhau, độ dài không đổi.
      duration = duration + daiNay - d;
    } else {
      joins.push(`${vTruoc}[v${index}]concat=n=2:v=1:a=0${vRa}`);
      joins.push(`${aTruoc}[a${index}]concat=n=2:v=0:a=1${aRa}`);
      duration += daiNay;
    }
    vTruoc = vRa;
    aTruoc = aRa;
  }

  // Một đoạn duy nhất thì không có gì để nối — vẫn phải đặt tên đầu ra.
  if (bounds.length === 1) {
    joins.push("[v0]null[vout]", "[a0]anull[aout]");
  }

  const scriptPath = join(workDir(projectId), `${outName}.filter.txt`);
  await writeFile(scriptPath, `${parts};${joins.join(";")}`, "utf8");

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
  // Không nhạc thì không có gì để trộn — cho bản vào đi thẳng ra.
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
export type { RevealId } from "./style-pack";

/** Giá trị cũ trong CSDL đổi về một kiểu còn dùng được. */
export function normalizeReveal(value: string | null | undefined): RevealId {
  if (REVEALS.some((item) => item.id === value)) return value as RevealId;
  // `zoom`, `ken` của bản trước: gần nhất là bản có chuyển động.
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

function insertFilter(
  insert: RenderElement,
  index: number,
  label: string,
  pack: StylePack,
) {
  const reveal = normalizeReveal(insert.reveal);
  const shape = insert.shape ?? "full";
  const box = shapeBox(shape);
  // Tư liệu chèn nắn màu ĐÚNG như dải chính. Không nắn thì mỗi lần chèn là một
  // lần màu nhảy: nền ấm, tư liệu lạnh — người xem đọc ra ngay là "dán vào".
  const grade = gradeFilter(blocksFromPack(pack).scene.grade);
  const base =
    `[${index + 1}:v]scale=${box.w}:${box.h}:force_original_aspect_ratio=increase,` +
    `crop=${box.w}:${box.h},setsar=1,fps=${FPS}` +
    (grade ? `,${grade}` : "");
  // Bo góc TRƯỚC khi dịch mốc và mờ dần: `fade` nhân vào kênh trong suốt sẵn có,
  // nên làm ngược thứ tự thì góc bo bị ghi đè lại thành vuông.
  // Dáng `full` không bo: nó phủ kín khung nên bo sẽ thành bốn góc đen.
  const round = shape === "full" ? "" : roundCorners(box);
  const shift = `,setpts=PTS-STARTPTS+${insert.start.toFixed(3)}/TB`;
  const at = insert.start.toFixed(3);
  // `slide` KHÔNG mờ: cái đọc được ở kiểu đó là chuyển động, thêm mờ vào là nó
  // lẫn với `fade-up`. `pop` thì đứng ngoài suốt quãng giữ rồi vào phắt — một
  // lần `fade` rất ngắn, bắt đầu muộn.
  const alpha =
    reveal === "none" || reveal === "slide"
      ? ""
      : reveal === "pop"
        ? `,format=yuva420p,fade=t=in:st=${(insert.start + POP_HOLD).toFixed(3)}:d=${POP_SNAP}:alpha=1`
        : `,format=yuva420p,fade=t=in:st=${at}:d=${REVEAL_SECONDS}:alpha=1`;
  return `${base}${round}${shift}${alpha}${label}`;
}

/**
 * Toạ độ `x` của lớp chèn: mép trái của hộp dáng, cộng phần trượt của `slide`.
 *
 * Trượt bằng `overlay` chứ không bằng luồng phụ, cùng lý do với `insertY`:
 * `overlay` nhận biểu thức có `t` nên cả chuyển động chỉ tốn một lần dán.
 */
function insertX(insert: RenderElement) {
  const box = shapeBox(insert.shape ?? "full");
  if (normalizeReveal(insert.reveal) !== "slide") return String(box.x);
  const st = insert.start.toFixed(3);
  const shift = Math.round(box.w * SLIDE_SHIFT);
  const p = `min(1,(t-${st})/${REVEAL_SECONDS})`;
  return `'${box.x}-if(lt(t,${st}+${REVEAL_SECONDS}),${shift}*pow(1-${p},3),0)'`;
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
/*
 * Mức ĐẨY của cú zoom và mức SÁNG của cú nháy nay nằm trong bộ dáng
 * (`intensity.punchScale` · `intensity.flashAmount`).
 *
 * Chúng từng là hằng dùng chung, nên bộ dáng chỉ chọn được KIỂU chuyển cảnh mà
 * không chọn được độ mạnh: bộ "nhịp nhanh" và bộ "nhịp êm" đều đẩy 8% và đều
 * sáng 0,7. Xem bảng giá trị thì hai bộ rất khác, xem video thật thì hao hao.
 *
 * Thời lượng thì vẫn là hằng — 0,12 giây là ngưỡng thấy-được-mà-chưa-nhức-mắt,
 * không phải chuyện phong cách.
 */

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

export function junctionFilter(
  spans: Array<{ start: number; end: number; peak: number }>,
  kind: JunctionId,
  pack: StylePack,
) {
  const drive = findJunction(kind).drive;
  if (spans.length === 0 || Object.keys(drive).length === 0) return null;

  const pulse = pulseExpr(spans);
  const parts: string[] = [];

  /*
   * HÌNH HỌC gộp làm một chặng: phóng, dịch, xoay đều là phép biến khuôn hình,
   * và làm rời từng cái thì mỗi lần đều phải phóng bù rồi cắt lại — ba vòng
   * lấy mẫu chồng lên nhau, ảnh nhũn đi thấy rõ.
   *
   * Thứ tự BẮT BUỘC là phóng → xoay → cắt. Xoay trước khi phóng thì bốn góc
   * trống lọt vào khung trước lúc có gì che; cắt trước khi phóng thì `crop`
   * chốt cửa sổ một lần và không phóng được chút nào.
   */
  const zoomAmt = (drive.zoom ?? 0) * pack.intensity.punchScale;
  const { dichX = 0, dichY = 0, xoay = 0 } = drive;
  if (zoomAmt || dichX || dichY || xoay) {
    const z = `(1+${zoomAmt.toFixed(4)}*(${pulse}))`;
    const w = `${OUT_WIDTH}*${z}`;
    const h = `${OUT_HEIGHT}*${z}`;
    let chain = `scale=w='${w}':h='${h}':eval=frame`;
    if (xoay) {
      // `c=none` giữ nguyên nền: đã phóng bù nên bốn góc không lọt vào khung,
      // mà tô đen thì chỗ nào hụt sẽ thành vệt đen thay vì lộ ảnh.
      chain += `,rotate=a='${(xoay * Math.PI) / 180}*(${pulse})':ow=rotw(0):oh=roth(0):c=none`;
    }
    // Mép trái/trên phải nói RÕ. `crop` tính `w`/`h` một lần lúc dựng chuỗi,
    // nên mặc định `x=(in_w-out_w)/2` dùng bề ngang CHỐT TỪ ĐẦU và luôn ra 0 —
    // phần bị cắt dồn hết sang phải, nhìn ra là hình trượt ngang chứ không
    // phải phóng từ tâm.
    const cx = `(${w}-${OUT_WIDTH})/2${dichX ? `+${((dichX / 100) * OUT_WIDTH).toFixed(2)}*(${pulse})` : ""}`;
    const cy = `(${h}-${OUT_HEIGHT})/2${dichY ? `+${((dichY / 100) * OUT_HEIGHT).toFixed(2)}*(${pulse})` : ""}`;
    chain += `,crop=${OUT_WIDTH}:${OUT_HEIGHT}:x='${cx}':y='${cy}'`;
    parts.push(chain);
  }

  // SÁNG và TƯƠNG PHẢN — một bộ lọc `eq` cho cả hai.
  const sang = (drive.sang ?? 0) * pack.intensity.flashAmount;
  const tuongPhan = drive.tuongPhan ?? 0;
  if (sang || tuongPhan) {
    const bits = [`eval=frame`];
    if (sang) bits.unshift(`brightness='${sang.toFixed(3)}*(${pulse})'`);
    if (tuongPhan) bits.unshift(`contrast='1+${(tuongPhan * 0.6).toFixed(3)}*(${pulse})'`);
    parts.push(`eq=${bits.join(":")}`);
  }

  // MÀU — `hue` lo cả bão hoà lẫn lệch sắc, và nó nhận biểu thức theo `t`.
  const { bhoa = 0, sac = 0 } = drive;
  if (bhoa || sac) {
    const bits: string[] = [];
    if (bhoa) bits.push(`s='1+${bhoa.toFixed(3)}*(${pulse})'`);
    if (sac) bits.push(`h='${sac.toFixed(1)}*(${pulse})'`);
    parts.push(`hue=${bits.join(":")}`);
  }

  // TỐI VIỀN — `vignette` nhận biểu thức khi bật `eval=frame`.
  if (drive.vien) {
    parts.push(
      `vignette=angle='${(drive.vien * 0.9).toFixed(3)}*(${pulse})':eval=frame`,
    );
  }

  /*
   * NHOÈ là kiểu DUY NHẤT không mượt được: `gblur` chốt `sigma` một lần lúc
   * dựng chuỗi, không nhận biểu thức theo `t`. Nên nó chỉ bật/tắt trong cửa sổ
   * quanh đỉnh — chấp nhận được vì cửa sổ ấy chỉ vài phần mười giây, và mắt
   * đọc ra "một nhịp nhoè" chứ không đọc ra "nhoè dần".
   */
  if (drive.nhoe) {
    const windows = spans
      .map((span) => {
        const half = Math.min(0.09, (span.end - span.start) / 3);
        return `between(t,${(span.peak - half).toFixed(3)},${(span.peak + half).toFixed(3)})`;
      })
      .join("+");
    parts.push(`gblur=sigma=${drive.nhoe}:enable='${windows}'`);
  }

  return parts.length > 0 ? parts.join(",") : null;
}

/** In chữ và đè tư liệu chèn lên dải đã cắt. */
export async function burnElements(
  projectId: string,
  cut: string,
  elements: RenderElement[],
  /** Bộ dáng của dự án — quyết định font, màu, viền, quầng, nhịp */
  pack: StylePack,
  /** Hiệu ứng trên dải ĐÃ CẮT — mỗi cái mang kiểu và quãng của riêng nó */
  effects: Array<{ start: number; end: number; kind: JunctionId }> = [],
  /**
   * Dòng tiêu đề của dự án. `null` là không vẽ.
   *
   * Nhận qua tham số chứ không tự đọc CSDL: tệp này là tầng ffmpeg, và một tầng
   * vẽ mà biết đường tới bảng `projects` thì lần sau nó biết thêm một bảng nữa.
   * Mọi dữ liệu khác cũng đã vào theo đúng đường này (`elements`, `pack`).
   */
  headlineText: string | null = null,
  /**
   * Độ sáng trung bình khung hình (`yAvg`, thang 0–255) — độ đục hình dán nội
   * suy theo. Hiện LUÔN `null` (đã bỏ bước đo độ sáng), nên độ đục lấy điểm giữa
   * hai mức, một con số xác định. Giữ tham số để bước Chuẩn bị sau nối lại nguồn.
   */
  sceneLuma: number | null = null,
  /**
   * Đường tới `work/subject.mp4`. `null` là dự án chưa tách nền.
   *
   * Nạp bằng `movie=` chứ không bằng `-i`: mọi nhãn `[N:v]` trong đồ thị này
   * đánh theo SỐ TƯ LIỆU CHÈN, nên thêm một đầu vào là dịch hết chúng đi một
   * bậc — và lỗi ấy chỉ lộ ra ở dự án CÓ tư liệu chèn.
   */
  subjectPath: string | null = null,
  /**
   * Chữ vẽ chạy sau người, và dải nào của khung để đặt nó.
   *
   * Dải do `emptiestBand` đo từ chính mặt nạ; truyền vào đây thay vì tự đo, vì
   * tệp này là tầng vẽ và phép đo cần đọc tệp mặt nạ.
   */
  behindLine: string | null = null,
  behindBand = 0,
  /**
   * Lịch màn. Rỗng là không dùng bố cục — dòng chính giữ nguyên khung hình.
   *
   * Xếp ở `layout-schedule.ts` chứ không ở đây: tệp này là tầng vẽ, còn xếp lịch
   * cần đọc mép cụm chữ và luật thời gian.
   */
  schedule: readonly ScheduledScene[] = [],
  /** Các tệp tư liệu cho ô phụ, xoay vòng theo màn. Rỗng là chưa có. */
  layoutInserts: readonly string[] = [],
  /** Tỉ lệ (rộng/cao) của từng tệp trên, cùng thứ tự. Ô phụ đo theo số này. */
  layoutInsertAspects: readonly number[] = [],
  /** Tỉ lệ video nguồn — ô bám theo để phép cắt không bỏ gì. */
  sourceAspect: number | undefined = undefined,
) {
  const target = join(outDir(projectId), "final.mp4");
  const inserts = elements.filter(
    (item) =>
      item.kind === "insert" && item.mediaPath && existsSync(item.mediaPath),
  );
  const texts = elements.filter((item) => item.kind === "text" && item.content);

  const filters: string[] = [];
  let stream = "[0:v]";

  /*
   * NẮN MÀU đứng ĐẦU CHUỖI — trước hiệu ứng chỗ nối, trước tư liệu chèn, trước chữ.
   *
   * Nắn màu là việc làm với KHUNG HÌNH GỐC, giống hệt cách một người dựng làm.
   * Đặt sau thì nó nắn luôn cả chữ và tư liệu chèn: màu nhấn vàng của bộ dáng ra
   * một màu vàng khác, và cả bảng màu đã cân công phu thành vô nghĩa.
   */
  // Chữ-nền / nắn-màu / vệt-quét đọc từ block (xẻ từ preset qua `blocksFromPack`),
  // không đọc `pack.*` trực tiếp — cùng seam với frame/caption. Còn TOÀN CỤC một
  // bộ cho cả video; thành block per-element/độc-lập là bước cấu trúc sau.
  const sceneBlock: SceneBlock = blocksFromPack(pack).scene;
  const junctionBlock: JunctionBlock = blocksFromPack(pack).junction;
  // Quầng chữ (`glow`) áp cho LỚP chữ GỘP của cả video (một layer, không tách
  // theo cụm) → đọc qua seam preset thay vì `captionLook.glow` trực tiếp, cùng lối các
  // block khác. Là hiệu ứng toàn-cục, không per-cụm (khác `caption_block` per-cụm).
  const captionLook = blocksFromPack(pack).caption;
  const grade = gradeFilter(sceneBlock.grade);
  if (grade) {
    filters.push(`${stream}${grade}[graded]`);
    stream = "[graded]";
  }

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
    const chain = junctionFilter(spans, kind, pack);
    if (!chain) continue;
    const label = `[junction${junctionIndex++}]`;
    filters.push(`${stream}${chain}${label}`);
    stream = label;
  }

  /*
   * B-roll vẽ đè (shape) CHỈ khi bộ dáng không có bố cục ô. Bộ có bố cục thì chính
   * b-roll ấy đã hiện trong Ô PHỤ của màn nó đè lên (`layoutPlan` dưới) — vẽ thêm
   * một lớp đè nữa là hiện đôi. "Chèn tư liệu" và "bố cục hai ô" là một việc.
   */
  // Look Ô đọc từ BLOCK, không tra bộ dáng toàn-cục. Sau khi mọi element mang
  // block riêng, chỗ này lấy theo từng cảnh; nay các block đã đóng dấu đều bằng
  // nhau nên một cục là đủ, và đường dựng bố cục hết đọc `pack.*`.
  const frame: FrameBlock = blocksFromPack(pack).frame;
  const layoutActive = schedule.length > 0 && frame.page !== null;
  if (!layoutActive) {
    inserts.forEach((insert, index) => {
      const label = `[ins${index}]`;
      // `setpts` dịch mốc luồng chèn về đúng chỗ trên dải chính; không dịch thì nó
      // khớp theo thời gian của chính nó và luôn rơi về đầu video.
      filters.push(insertFilter(insert, index, label, pack));

      const next = `[ov${index}]`;
      filters.push(
        `${stream}${label}overlay=x=${insertX(insert)}:y=${insertY(insert)}:` +
          `${enableRange(insert.start, insert.end)}${next}`,
      );
      stream = next;
    });
  }

  /*
   * KHUNG BAO QUANH HÌNH — sau tư liệu chèn, trước mọi thứ bộ dáng vẽ.
   *
   * Đặt ở đây chứ không sớm hơn: tư liệu chèn thuộc phần HÌNH nên nó phải bị thu
   * vào khung cùng với hình. Đặt sớm hơn thì b-roll vẽ ở toạ độ khung ngoài rồi
   * bị thu nhỏ hai lần.
   *
   * `scale`+`crop` giữ tỉ lệ rồi cắt, KHÔNG kéo giãn: lề bốn phía khác nhau thì
   * vùng hình có tỉ lệ khác 9:16, và kéo cho vừa là mặt người bị bóp méo. Cùng
   * cách `buildBase` xử lý tệp nguồn nhiều tỉ lệ khác nhau.
   *
   * `pad` dán vùng hình lên nền màu — một bộ lọc, không thêm luồng đầu vào, nên
   * không phải lo chuyện luồng nền vô hạn kéo dài cả video.
   */
  /*
   * CHỮ CHẠY SAU NGƯỜI — sớm nhất trong mọi thứ bộ dáng vẽ.
   *
   * Phải sớm vì nó không phải một lớp phủ: nó tách khung hình làm hai, vẽ chữ
   * lên phần nền, rồi dán người trở lại lên trên. Mọi thứ vẽ sau đó — khung,
   * hình dán, mảng màu, phụ đề — đều nằm trên cả hai.
   *
   * Đặt muộn hơn thì chữ chui ra sau cả những lớp ấy, và một cái viền khung
   * cũng che mất nó.
   */
  const behind = sceneBlock.behindText;
  if (behind && subjectPath && behindLine) {
    const size = Math.round(OUT_WIDTH * behind.sizeShare);
    // VIẾT HOA như "YOUTH" của Chalk — chữ-nền đậm đặc hẹp đọc mạnh nhất khi hoa.
    const file = textFileFor(projectId, "behind", behindLine.toUpperCase());
    const font = resolvePackFont(behind.font.file);
    // Dải ít người nhất, đo từ chính mặt nạ — xem `emptiestBand`.
    const bandTop = Math.round((OUT_HEIGHT * behindBand) / BEHIND_BANDS);
    const draws: string[] = [];
    for (let tier = 0; tier < behind.repeats; tier += 1) {
      // Mỗi tầng nhạt dần: tầng đầu đặc, các tầng sau lùi về nền.
      const alpha = behind.tone.alpha * (1 - tier / (behind.repeats + 0.6));
      /*
       * Mỗi tầng vào MUỘN dần rồi cùng tắt — chữ xây lên từng tầng.
       *
       * Chalk dựng "YOUTH" bằng cách thêm từng chữ cái. Ta không tách được chữ
       * cái trong một lệnh `drawtext`, nhưng tách được TẦNG — và ba tầng lần
       * lượt hiện ra đọc cũng ra "đang xây", không ra "đã có sẵn".
       */
      const enterAt = tier * BEHIND_TIER_STEP;
      draws.push(
        `drawtext=fontfile='${font}':textfile='${file}':fontsize=${size}:` +
          `x=(w-tw)/2:` +
          // Cả chồng chữ TRÔI LÊN chậm suốt lúc nó hiện. Đứng im thì ba tầng
          // đọc ra một khối in sẵn; trôi thì đọc ra một thứ đang chạy qua sau
          // lưng người nói. `drawtext` tính lại `y` theo từng khung — đã đo.
          `y='${bandTop + Math.round(size * 1.02 * tier)}` +
          `-${BEHIND_DRIFT}*min(1,t/${behind.seconds})':` +
          `fontcolor=${behind.tone.color}:` +
          `alpha='${alpha.toFixed(3)}*min(min(1,max(0,(t-${enterAt.toFixed(2)})/${HEADLINE_FADE})),` +
          `max(0,1-(t-${behind.seconds})/${HEADLINE_FADE}))':` +
          `enable='lt(t,${(behind.seconds + HEADLINE_FADE).toFixed(2)})'`,
      );
    }
    const cut = subjectCutChain("[bhfg]", subjectPath, OUT_WIDTH, OUT_HEIGHT, "bh");
    filters.push(`${stream}split[bhbg][bhfg]`);
    /*
     * NÉT PHẤN SẦN cho chữ-nền — như "YOUTH" của Chalk.
     *
     * Vẽ chữ lên lớp TRONG SUỐT rồi xén hạt phấn vào KÊNH TRONG (nhân grain vào
     * alpha), sau đó mới dán lên video. Xén vào alpha chứ không nhân thẳng lên
     * hình: nhân lên hình thì hạt phấn phủ CẢ KHUNG (nền đen đè mất video); xén
     * vào alpha thì hạt chỉ ăn vào NÉT chữ, ngoài nét vẫn trong suốt.
     */
    const bhDur = (behind.seconds + HEADLINE_FADE + 1).toFixed(3);
    const grainFile = `${GRAPHICS_DIR}/../../masks/chalk-grain.png`;
    filters.push(
      `color=c=black@0:s=${OUT_WIDTH}x${OUT_HEIGHT}:d=${bhDur}:r=${FPS},` +
        `format=rgba,${draws.join(",")}[bhraw]`,
    );
    filters.push(`[bhraw]alphaextract[bhta]`);
    filters.push(`movie=${grainFile},format=gray,scale=${OUT_WIDTH}:${OUT_HEIGHT}[bhgr]`);
    filters.push(`[bhta][bhgr]blend=all_mode=multiply[bhta2]`);
    filters.push(`color=c=${behind.tone.color}:s=${OUT_WIDTH}x${OUT_HEIGHT}:d=${bhDur}[bhwht]`);
    filters.push(`[bhwht][bhta2]alphamerge[bhtxt]`);
    filters.push(`[bhbg][bhtxt]overlay=0:0[bhtext]`);
    filters.push(cut.chain);
    filters.push(`[bhtext]${cut.label}overlay=0:0[bhon]`);
    stream = "[bhon]";
  }

  const rect = contentRect(pack, OUT_WIDTH, OUT_HEIGHT);
  const framed = frameFilter(pack, rect, OUT_WIDTH, OUT_HEIGHT);
  if (framed) {
    filters.push(`${stream}${framed}[framed]`);
    stream = "[framed]";
  }

  /*
   * HÌNH DÁN — sau khung, trước mảng màu và chữ.
   *
   * Sau khung vì hình dán phủ đúng khổ KHUNG, không phủ vùng hình: một cái viền
   * chạy quanh mép video đã thu vào thì nó là hai lớp viền chồng nhau, còn chạy
   * quanh mép khung mới ra dáng "cả video nằm trong một cái gì đó".
   *
   * Trước chữ vì nó là NỀN, cùng lý lẽ với mảng màu.
   */
  // Độ dài bản ĐÃ CẮT — mép cuối của quãng cuối khi chia quãng bật/tắt, và cũng
  // là `-t` của lệnh xuất ở cuối hàm. Đo một lần, dùng hai chỗ.
  const cutSeconds = (await probe(cut)).duration;

  /*
   * BỐ CỤC — sớm nhất trong mọi thứ bộ dáng vẽ, và là thứ DUY NHẤT đổi luồng nền.
   *
   * Mọi trục khác đều là lớp dán lên khung hình. Trục này thì ngược: nó bắt đầu
   * từ NỀN TRANG rồi đặt khung hình vào một Ô trên đó. Nên nó phải chạy trước —
   * mọi lớp sau đều vẽ lên kết quả của nó.
   *
   * Không có lịch màn thì bỏ qua hẳn, và dòng chính vẫn là khung hình như cũ.
   * Bộ dáng nào không khai `layouts` thì không trả giá gì.
   */
  if (schedule.length > 0 && frame.page) {
    const copies = sourceCount(schedule);
    const labels = Array.from({ length: copies }, (_, i) => `[lysrc${i}]`);
    const plan = layoutPlan(
      frame, schedule, labels, GRAPHICS_DIR, OUT_WIDTH, OUT_HEIGHT,
      layoutInserts, layoutInsertAspects, cutSeconds, sourceAspect,
    );
    if (plan.page) {
      filters.push(`${stream}split=${copies}${labels.join("")}`);
      filters.push(...plan.chains);
      let cursor = plan.page;
      plan.overlays.forEach((item, index) => {
        const next = `[lyon${index}]`;
        filters.push(
          `${cursor}${item.label}overlay=${item.x}:${item.y}:enable='${item.enable}'${next}`,
        );
        cursor = next;
      });
      stream = cursor;
    }
  }

  const cutMarks = effects
    .filter((item) => item.kind !== "none")
    .map((item) => effectPeak(item.start, item.end, item.kind));
  for (const step of graphicsSteps(
    pack, GRAPHICS_DIR, OUT_WIDTH, OUT_HEIGHT, sceneLuma, true, cutMarks,
  )) {
    const next = `[gfxon${filters.length}]`;
    filters.push(step.chain);
    filters.push(`${stream}${step.label}overlay=0:0${next}`);
    stream = next;
    if (step.pulse) {
      const hit = `[gfxhit${filters.length}]`;
      filters.push(step.pulse.chain);
      filters.push(
        `${stream}${step.pulse.label}overlay=0:0:enable='${step.pulse.enable}'${hit}`,
      );
      stream = hit;
    }
  }

  // NÉT VẼ TAY (doodle) — với Phấn, bám CẢNH B-ROLL SOLO: vẽ vào lề quanh ảnh.
  const brollWindows = schedule
    .filter((s) => s.layout === "broll-don")
    .map((s) => ({ start: s.start, end: s.end }));
  for (const step of doodleSteps(
    frame, GRAPHICS_DIR, OUT_WIDTH, OUT_HEIGHT, cutMarks, cutSeconds, brollWindows,
  )) {
    const next = `[ddlon${filters.length}]`;
    filters.push(step.chain);
    filters.push(
      `${stream}${step.label}overlay=0:0:enable='${step.enable}'${next}`,
    );
    stream = next;
  }

  // Viền vàng CHỈ quanh ảnh b-roll (nướng trong `layout-render.ts`). KHÔNG viền
  // quanh người: trên footage tối/áo lẫn nền, mặt nạ tách nền phình ra nền và
  // giật từng frame — nét sắc thì bò/rung, nét lỏng thì thành quầng trôi ngoài
  // người, cả hai đọc ra lỗi. Chỉ dựng lại khi có mặt nạ tách người sạch.

  /*
   * VỆT QUÉT — trên hình dán, dưới mảng màu và chữ.
   *
   * Trên hình dán vì nó là thứ ĐẬY cú cắt: một cái viền hay bốn dấu góc mà nổi
   * lên trên vệt thì vệt hoá ra chạy phía sau khung hình, và cú đậy hỏng.
   *
   * Dưới chữ vì chữ vẫn phải đọc được lúc vệt đi qua. Chỗ nối là chỗ phụ đề
   * đang đổi cụm, nên hai thứ gặp nhau là chuyện thường — mà thứ đọc được luôn
   * phải nằm trên.
   *
   * Mốc lấy từ chính các hiệu ứng chỗ nối: đó là những chỗ mô hình đã chọn để
   * đánh dấu. Chọn riêng một tập mốc khác thì video có hai nhịp không liên quan
   * gì tới nhau.
   */
  for (const step of sweepSteps(
    junctionBlock,
    cutMarks,
    OUT_WIDTH,
    OUT_HEIGHT,
  )) {
    const next = `[swpon${filters.length}]`;
    filters.push(step.chain);
    filters.push(
      `${stream}${step.label}overlay=x='${step.xExpr}':y=0:` +
        `${enableRange(step.from, step.to)}${next}`,
    );
    stream = next;
  }

  /*
   * MẢNG MÀU — sau hình và tư liệu chèn, TRƯỚC chữ.
   *
   * Thứ tự này là cả ý nghĩa của trục: mảng màu là NỀN cho chữ, không phải lớp
   * phủ lên chữ. Đặt sau lớp chữ thì nó che mất đúng thứ nó sinh ra để đỡ.
   *
   * Đặt sau tư liệu chèn chứ không trước: tư liệu chèn thuộc về phần HÌNH, mà
   * mảng màu phải nổi trên hình. Vẽ trước thì một đoạn b-roll toàn màn phủ kín
   * mảng màu và bộ dáng nhấp nháy mất một trục mỗi lần có tư liệu.
   *
   * Một tấm màu phủ lên chứ không phải `drawbox`: xem `plateFilter`.
   */
  /*
   * Xếp chữ tiêu đề SỚM hơn chỗ vẽ nó, vì mảng màu cần biết tiêu đề sống bao
   * lâu — mảng màu nào chở tiêu đề thì nó tắt cùng lúc.
   */
  const headline = sceneBlock.title
    ? await layoutHeadline(
        headlineText,
        // Tiêu đề dùng lại cặp font của chính bộ dáng, không khai họ mới.
        withFontRole(pack, sceneBlock.title.font),
        rect.w,
        rect.h,
      )
    : null;
  const headlineUntil = headline ? headlineHold(headline.text) : null;

  const plate = plateFilter(pack, rect, true, headlineUntil);
  if (plate) {
    filters.push(plate.chain);
    filters.push(
      `${stream}${plate.label}overlay=${plate.x}:'${plate.yExpr}'` +
        // Thôi vẽ hẳn sau khi trượt ra: ghép một lớp nằm ngoài khung cho mọi
        // khung hình còn lại của phim là công đổ đi.
        (plate.until === null ? "" : `:enable='lt(t,${plate.until.toFixed(2)})'`) +
        `[plate]`,
    );
    stream = "[plate]";
  }

  /*
   * DÒNG TIÊU ĐỀ — sau mảng màu, TRƯỚC lớp phụ đề.
   *
   * Vẽ thẳng lên dòng hình chứ không vào lớp chữ trong suốt: lớp đó tồn tại để
   * làm quầng tối mềm cho phụ đề, mà tiêu đề thường nằm trên mảng màu đặc nên
   * nó không cần quầng — và cho nó vào lớp ấy là quầng của nó lan sang phụ đề.
   *
   * Dưới phụ đề vì phụ đề là chữ PHẢI đọc được: hai thứ có chồng nhau thì thứ
   * đọc được phải ở trên.
   *
   * Chỉ hiện ĐẦU video rồi mờ dần — xem `headlineHold`.
   */
  if (sceneBlock.title && headline && headlineUntil !== null) {
    {
      // Chữ đi qua một TỆP, không qua tham số `text` — cùng đường thoát ký tự
      // với phụ đề. Đây là chữ người dùng gõ vào, và `drawtext` đọc `:` `'` `%`
      // `\` như cú pháp của chính nó.
      const file = textFileFor(projectId, "headline", headline.text);
      /*
       * `enable` cắt hẳn lệnh vẽ sau khi mờ xong, `alpha` lo phần mờ dần.
       *
       * Cần CẢ HAI: chỉ có `alpha` thì ffmpeg vẫn dựng chữ ở mọi khung rồi nhân
       * với 0 — tốn công cho một thứ không ai thấy, suốt phần còn lại của phim.
       * Còn chỉ có `enable` thì chữ tắt phụt.
       */
      const hold = headlineUntil;
      const alpha = headline.tone.alpha;
      filters.push(
        `${stream}drawtext=fontfile='${resolvePackFont(pack.fonts[sceneBlock.title.font].file)}':` +
          `textfile='${file}':fontsize=${headline.fontSize}:` +
          `x=${rect.x + headline.x}:y=${rect.y + headline.y}:` +
          `fontcolor=${headline.tone.color}:` +
          /*
           * Hiện dần vào rồi mờ dần ra, cùng một khoảng thời gian.
           *
           * Phần hiện dần không phải để cho đẹp: mảng màu chở tiêu đề mất nửa
           * giây trượt vào, mà chữ thì đứng sẵn ngay từ khung đầu. Đo được ở
           * giây 0,05 — chữ lơ lửng trên áo người nói trong khi cái khay của nó
           * còn chưa tới. Cho hai thứ cùng một nhịp là hết.
           */
          `alpha='${alpha}*min(min(1,t/${HEADLINE_FADE}),max(0,1-(t-${hold})/${HEADLINE_FADE}))':` +
          `enable='lt(t,${(hold + HEADLINE_FADE).toFixed(2)})'[headline]`,
      );
      stream = "[headline]";
    }
  }

  // Mọi chữ đi CHUNG một đường: xếp theo từng tiếng, rồi mỗi tiếng một lệnh vẽ
  // có biểu thức thời gian riêng. Trước đây kiểu "cỡ đều" đi đường bẻ dòng (một
  // lệnh mỗi DÒNG) cho nhẹ, nhưng vẽ cả dòng bằng một lệnh thì không cách nào
  // cho từng tiếng hiện lần lượt — mà đó lại là kiểu chữ của cả hệ này.
  const draws: string[] = [];
  // Số thứ tự riêng cho hình bám chữ — mỗi cụm cần một bộ nhãn không trùng.
  let wrapSeq = 0;
  // Số thứ tự phẳng cho tên tệp chữ — chỉ cần duy nhất trong một lượt dựng.
  let textFileSeq = 0;

  for (const text of texts) {
    // Bộ dáng HIỆU LỰC của riêng cụm này: bộ của dự án, cộng phần nó tự đè.
    // Mọi phép đo và mọi biểu thức phía dưới đều chạy theo bộ này.
    const shown = packForElement(
      pack,
      {
        letterCase: text.letterCase ?? null,
        keyColor: text.keyColor ?? null,
        fontStyle: text.fontStyle ?? null,
      },
      // VAI CHỮ theo chính cụm này: có từ khoá thì `accent`, không thì `voice`.
      // Đọc `elements.keywords` — dữ liệu `ai-keywords.ts` đã ghi sẵn, không mở
      // thêm trục nào.
      text.keywords,
      // Look chữ của CHÍNH cụm này — cụm tự mang, không đọc ngược bộ dáng dự án.
      text.captionBlock,
    );
    // Tệp font nằm TRONG vòng lặp vì mỗi cụm chọn vai riêng. Để ngoài vòng như
    // trước là mọi cụm in bằng một font trong khi phép đo đã tính theo font
    // khác — chữ tràn khung mà không lệnh nào sai.
    const fontPath = resolvePackFont(shown.font.file);
    const { words: rawPlaced } = await placeWords(
      text.content!,
      text.keywords ?? [],
      text.align ?? "center",
      // CỠ suy THẲNG từ từ-nhấn (khớp preview): có tiếng nhấn → PHÓNG TO tiếng đó
      // (keyword-large), không → ĐỀU cỡ. Bỏ trục "kiểu nhấn"; đánh dấu là nổi.
      (text.keywords?.length ?? 0) > 0 ? "keyword-large" : "even",
      text.band ?? "top",
      rect.w,
      rect.h,
      shown,
    );
    // Bố cục tính trong hệ toạ độ VÙNG HÌNH; dời một lần ở đây thay vì cộng gốc
    // vào từng biểu thức phía dưới — cộng rải rác là chỗ để quên đúng một chỗ.
    const placed = rawPlaced.map((word) => ({
      ...word,
      x: word.x + rect.x,
      y: word.y + rect.y,
    }));
    // Mốc bắt đầu của TỪNG tiếng, tính trước cả lượt: lớp tô sáng cần biết
    // tiếng SAU bắt đầu lúc nào để tắt đúng chỗ, mà trong vòng lặp thì chưa có.
    const startsAt = placed.map((_, flat) => {
      const spoken = text.wordStarts?.[flat];
      if (spoken !== undefined) return spoken;
      // Không có mốc thật thì RẢI ĐỀU số tiếng trong đúng khoảng của cụm — nhịp
      // cố định 0,07 giây/tiếng thì cụm 2 giây chạy hết trong nửa giây rồi đứng im.
      return placed.length > 1
        ? text.start + ((text.end - text.start) * flat) / placed.length
        : text.start;
    });

    /*
     * HÌNH BÁM CHỮ — vẽ lên dòng hình, TRƯỚC lớp chữ, và chỉ hiện trong đúng
     * khoảng của cụm.
     *
     * Hộp bao lấy từ VỆT MỰC thật của từng tiếng, không lấy từ `box` mà
     * `placeWords` trả về: `box` là vùng DÙNG ĐƯỢC của dải, rộng bằng cả bề ngang
     * cho phép, nên khoanh theo nó là khoanh một hình chữ nhật trống hai bên.
     */
    const inScope =
      shown.wrap &&
      (shown.wrap.scope === "all" || fontRoleFor(text.keywords) === "accent");
    if (inScope && placed.length > 0) {
      let left = Infinity;
      let right = -Infinity;
      let top = Infinity;
      let bottom = -Infinity;
      for (const word of placed) {
        const ink = await textWidth(word.text, word.fontSize, shown);
        left = Math.min(left, word.x);
        right = Math.max(right, word.x + ink);
        top = Math.min(top, word.y);
        bottom = Math.max(bottom, word.y + word.fontSize);
      }
      const meta = wrapMeta(shown.wrap!.id);
      const box = wrapBox(
        meta.fit,
        { left, right, top, bottom },
        Math.max(...placed.map((word) => word.fontSize)),
        shown.wrap!.padShare,
        rect,
      );
      /*
       * Hình khoanh vào khi cụm đã hiện QUÁ NỬA — không sớm hơn, không muộn hơn.
       *
       * Vào cùng tiếng đầu thì nó bao quanh một khoảng trống: nó được cắt theo
       * bề rộng CẢ cụm, mà chữ chạy vào từng tiếng. Đúng cái lỗi "mảng màu
       * trống" phiên brainstorm đã đo được một lần.
       *
       * Đợi tiếng CUỐI hiện xong thì nó không bao giờ vào: phụ đề khớp lời nói
       * nên tiếng cuối bắt đầu gần đúng lúc cụm tắt. Thử thật — không cụm nào
       * trong năm cụm đầu vẽ ra được gì.
       *
       * Nửa cụm là chỗ cả hai điều kia cùng thoả, và nó cũng đúng nhịp: người
       * ta khoanh lại khi đã nghe đủ để biết mình muốn khoanh cái gì.
       */
      const halfWay =
        shown.motion.reveal === "none"
          ? text.start
          : (startsAt[Math.floor(startsAt.length / 2)] ?? text.start) +
            shown.motion.enterSeconds;
      // Luôn kịp hiện ít nhất 0,3 giây. Ngắn hơn thì mắt đọc ra một cái nháy,
      // và một cái nháy trông như lỗi vẽ chứ không như một nét thiết kế.
      const settled = Math.min(halfWay, text.end - 0.3);
      // Mốc `settled` tính TRƯỚC khi dựng hình: phần hiện dần của hình bám vào
      // đúng mốc ấy, nên `wrapSteps` phải nhận được nó.
      const step = wrapSteps(
        pack,
        meta,
        GRAPHICS_DIR,
        box,
        sceneLuma,
        wrapSeq++,
        settled,
      );
      if (step) {
        if (settled > text.start - 0.01) {
          filters.push(step.chain);
          for (const piece of step.overlays) {
            const next = `[wrapon${filters.length}]`;
            filters.push(
              `${stream}${piece.label}overlay=${piece.x}:${piece.y}:` +
                `${enableRange(settled, text.end)}${next}`,
            );
            stream = next;
          }
        }
      }
    }

    for (const [flat, word] of placed.entries()) {
      // Thứ tự phẳng của `placed` giữ nguyên thứ tự tiếng trong câu ở mọi kiểu
      // nhấn, nên chỉ số này khớp thẳng với mảng mốc.
      const startAt = startsAt[flat];
      const spot = positionExpr(shown, {
        x: word.x,
        y: word.y,
        width: await textWidth(word.text, word.fontSize, shown),
        fontSize: word.fontSize,
        scale: word.fontSize / rect.w,
        startAt,
      });
      // Không viền thì BỎ HẲN hai tham số, đừng đặt `borderw=0`: `drawtext` vẫn
      // chạy nhánh vẽ viền và nét chữ dày lên một chút so với lúc không khai.
      const edge = shown.edge
        ? `borderw=${Math.max(2, Math.round(word.fontSize * shown.edge.share))}:` +
          `bordercolor=${ffmpegColor(shown.edge.tone)}:`
        : "";
      // Nền khối vẽ theo TỪNG TIẾNG vì mỗi tiếng là một lệnh `drawtext`.
      // `boxborderw` là đệm quanh nét chữ, tính theo cỡ chữ như mọi số đo khác.
      const box = shown.box
        ? `box=1:boxcolor=${ffmpegColor(shown.box.tone)}:` +
          `boxborderw=${boxBorderW(word.fontSize, shown)}:`
        : "";
      // MỘT tệp cho mỗi tiếng, dùng chung cho cả lượt vẽ thường lẫn lượt vẽ
      // sáng — hai lượt vẽ ĐÚNG một chữ, nên hai tệp là hai chỗ để lệch.
      const wordTextFile = textFileFor(projectId, String(textFileSeq++), word.text);
      // RUNG TAY NHẸ (boiling) như Chalk: mỗi tiếng dao động vài px theo sin(t),
      // lệch pha theo vị trí — đọc ra nét vẽ tay "sống" chứ không phải cả dòng rung
      // đều. CHỈ bộ có chữ-nền (Phấn/viết tay); bộ in đậm (Nhịp đen) giữ chữ đứng.
      const wig = sceneBlock.behindText
        ? `+${Math.max(1, Math.round(word.fontSize * 0.013))}*sin(t*5.5+${flat})`
        : "";
      const wigY = sceneBlock.behindText
        ? `+${Math.max(1, Math.round(word.fontSize * 0.011))}*sin(t*4.5+${(flat * 1.7).toFixed(2)})`
        : "";
      const body =
        `fontfile='${fontPath}':textfile='${wordTextFile}':` +
        `fontsize=${word.fontSize}:x='${spot.x}${wig}':y='${spot.y}${wigY}':` +
        edge +
        box;
      draws.push(
        `drawtext=${body}` +
          // Không có tham số nghiêng: nghiêng nằm trong chính tệp font
          // (bộ dáng khai `font.italic` cho trang xem biết). Cờ `italic` cũ ở
          // đây không làm gì cả, nên video in ra đứng thẳng trong khi trang xem
          // nghiêng.
          `fontcolor=${word.color}:alpha='${alphaExpr(shown, startAt, word.alpha)}':` +
          enableRange(text.start, text.end),
      );

      // TÔ SÁNG tiếng đang được nói: vẽ ĐÈ một bản thứ hai bằng màu sáng, chỉ
      // hiện trong đúng quãng tiếng đó được nói.
      //
      // Phải vẽ hai lần vì `drawtext` KHÔNG đổi được `fontcolor` theo thời gian
      // — chỉ `alpha`, `x`, `y` mới nhận biểu thức có `t`. Bản đè nằm ngay sau
      // bản gốc trong cùng chuỗi lọc nên nó luôn ở trên, đúng chỗ, đúng cỡ.
      //
      // Chỉ chạy khi chữ CÒN KHỚP lời: `wordStarts` rỗng nghĩa là người dùng đã
      // viết lại, không còn tiếng nào ứng với tiếng nào. Tô theo nhịp đều lúc đó
      // là tô bừa.
      if (shown.highlight && text.wordStarts) {
        // Sáng cho tới khi tiếng SAU bắt đầu — đúng cách karaoke chạy. Tiếng
        // cuối thì sáng tới hết cụm.
        const until = startsAt[flat + 1] ?? text.end;
        // Nền của tiếng đang nói: nếu bộ dáng khai `highlight.box` thì bản đè
        // mang nền riêng, đè lên cả nền thường. Đây là dáng "ô sáng chạy theo
        // lời" — khác hẳn dáng chỉ đổi màu chữ.
        // Đệm RIÊNG cho hộp chạy-theo-lời, KHÔNG mượn `pack.box`: `pack.box` mà
        // đặt thì MỌI chữ có hộp (dáng khác hẳn). Hộp karaoke cần đệm rộng rãi để
        // đọc ra là một "ô đánh dấu" chứ không phải nền ôm sát nét chữ.
        // Đệm NGANG hẹp: hộp rộng quá thì tiếng đang nói đè lên tiếng bên cạnh
        // (đã hiện). Ôm sát chữ để mỗi hộp chỉ phủ đúng tiếng của nó.
        const litPadY = Math.max(2, Math.round(word.fontSize * 0.1));
        const litPadX = Math.max(3, Math.round(word.fontSize * 0.08));
        const litBox = shown.highlight.box
          ? `box=1:boxcolor=${ffmpegColor(shown.highlight.box)}:` +
            `boxborderw=${litPadY}|${litPadX}|${litPadY}|${litPadX}:`
          : box;
        const litBody =
          `fontfile='${fontPath}':textfile='${wordTextFile}':` +
          `fontsize=${word.fontSize}:x='${spot.x}${wig}':y='${spot.y}${wigY}':` +
          edge +
          litBox;
        draws.push(
          `drawtext=${litBody}` +
            `fontcolor=${shown.highlight.tone.color}:` +
            `alpha='${shown.highlight.tone.alpha}*between(t,${startAt.toFixed(3)},${until.toFixed(3)})':` +
            enableRange(text.start, text.end),
        );
      }
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
    // Chỉ số lớp chữ = sau BASE và sau các input CHÈN. Nhưng bộ có bố cục KHÔNG
    // nạp input chèn (b-roll vào ô qua `movie=`), nên lúc ấy lớp chữ tụt về ngay
    // sau base. Thiếu phép trừ này thì nhãn `[N:v]` trỏ vào một input không có.
    const layer = `[${1 + (layoutActive ? 0 : inserts.length)}:v]`;
    filters.push(`${layer}${draws.join(",")}[txtraw]`);
    // TEXTURE PHẤN cho chữ caption (chỉ bộ CÓ chữ-nền = Phấn): xén hạt phấn NHẸ
    // vào KÊNH TRONG, GIỮ NGUYÊN màu (vàng/trắng/hộp) — nét chữ ra "bụi phấn" thay
    // vì nét máy sạch bong. Grain nhẹ (mostly sáng) nên chữ vẫn đọc tốt.
    if (sceneBlock.behindText) {
      const capGrain = `${GRAPHICS_DIR}/../../masks/caption-grain.png`;
      filters.push(`[txtraw]split[capa][capb]`);
      filters.push(`[capa]alphaextract[capal]`);
      filters.push(`movie=${capGrain},format=gray,scale=${OUT_WIDTH}:${OUT_HEIGHT}[capgr]`);
      filters.push(`[capal][capgr]blend=all_mode=multiply[capal2]`);
      // Nhòe RẤT NHẸ để mép chữ "lem nhem" như phấn — Chalk thật không có viền sắc
      // như dao. Sigma nhỏ nên chỉ mềm mép, không xoá hạt phấn ở lòng chữ.
      filters.push(`[capb][capal2]alphamerge,gblur=sigma=0.6[txt]`);
    } else {
      filters.push(`[txtraw]null[txt]`);
    }
    if (captionLook.glow) {
      filters.push(`[txt]split[glowsrc][txtmain]`);
      // Bóp hết màu về đen nhưng GIỮ hình dạng (kênh trong), rồi làm mờ ở NỬA CỠ
      // và phóng lại: kết quả vốn là một vệt mờ nên thu nhỏ trước không thấy khác,
      // mà làm mờ thẳng ở cỡ đầy đủ tốn gấp đôi thời gian xuất.
      const blur = captionLook.glow.radiusPx / 2;
      filters.push(
        `[glowsrc]colorchannelmixer=rr=0:rg=0:rb=0:gr=0:gg=0:gb=0:br=0:bg=0:bb=0:` +
          `aa=${captionLook.glow.opacity},scale=${OUT_WIDTH / 2}:${OUT_HEIGHT / 2},` +
          `boxblur=luma_radius=${blur}:alpha_radius=${blur},` +
          `scale=${OUT_WIDTH}:${OUT_HEIGHT}[glow]`,
      );
      // `format=rgb` khi chồng: để mặc định thì ffmpeg chồng trong không gian dải
      // hẹp và chữ trắng mất độ sáng.
      filters.push(`${stream}[glow]overlay=format=rgb[bg]`);
      filters.push(`[bg][txtmain]overlay=format=rgb[out]`);
    } else {
      filters.push(`${stream}[txt]overlay=format=rgb[out]`);
    }
    stream = "[out]";
  }

  if (filters.length === 0) {
    await ffmpeg(["-i", cut, "-c", "copy", "-y", target]);
    return target;
  }

  // Lớp chữ dài hơn dải đã cắt một giây cho chắc; đầu ra bị cắt lại đúng độ dài
  // dải bằng `-t` phía dưới.
  /*
   * BƯỚC CHUẨN HOÁ CUỐI — chốt định dạng và dải màu ngay trong đồ thị lọc.
   *
   * Không có bước này thì đầu ra là thứ chuỗi lọc tình cờ đàm phán được, và nó
   * khác nhau theo từng bộ dáng: bộ dùng hình bám chữ ép `format=rgba` nên cả
   * chuỗi chạy ở RGB và ra `yuvj420p` (dải đầy đủ), còn bộ khác ra `yuv420p`
   * (dải hẹp). Hai video cùng một dự án ra hai dải màu khác nhau — và lệch dải
   * là hình xỉn đi hoặc cháy sáng, tuỳ trình phát.
   *
   * `-pix_fmt` ở phía ĐẦU RA không đủ: nó chốt cách xếp mẫu, không chốt dải.
   * Chốt ở đây thì mọi nhánh của đồ thị đều đi qua đúng một cửa.
   */
  filters.push(`${stream}scale=out_range=tv,format=yuv420p[xuat]`);

  const layerSeconds = cutSeconds + 1;

  await ffmpeg([
    "-i",
    cut,
    // Ảnh tĩnh chỉ có MỘT khung: không lặp thì điều kiện thời gian không bao
    // giờ khớp vì luồng ảnh đã hết ngay tại giây 0.
    //
    // Bộ có bố cục thì KHÔNG nạp input chèn: b-roll đã vào ô phụ (`layoutPlan`
    // nạp bằng `movie=`), không vẽ lớp đè nên không cần `-i` — thêm vào là input
    // thừa, và nhãn `[N:v]` phải khớp với phần đã bỏ ở trên.
    ...(layoutActive
      ? []
      : inserts.flatMap((insert) =>
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
        )),
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
      /*
       * Ghi RA TỆP, không in 600 ký tự đầu.
       *
       * Đồ thị lọc của một lượt dựng thật dài hơn 20 KB, nên 600 ký tự đầu chỉ
       * cho thấy nền trang — đúng phần không bao giờ hỏng. Mọi câu hỏi cần tới
       * biến này ("tệp tư liệu nào được nạp", "màn nào có số hạng dồn") đều nằm
       * ở giữa đồ thị.
       */
      if (process.env.TEDDIT_LOG_FILTER) {
        const at = process.env.TEDDIT_LOG_FILTER;
        const path = at === "1" ? join(outDir(projectId), "bo-loc.txt") : at;
        writeFileSync(path, value, "utf8");
        console.log(`[bộ lọc] ${value.length} ký tự → ${path}`);
      }
      return value;
    })(),
    "-map",
    "[xuat]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    /*
     * CHỐT `yuv420p` cho đầu ra, đừng để đồ thị lọc tự thoả thuận.
     *
     * Không chốt thì định dạng ra là thứ chuỗi lọc tình cờ đàm phán được, và đo
     * thật trên chính repo này:
     *
     * - phần lớn bộ dáng ra `yuv444p` → **H.264 High 4:4:4 Predictive**, mà
     *   Chrome, Safari và Firefox đều KHÔNG giải mã được. Video mở bằng
     *   QuickTime thì chạy, mở bằng trình duyệt thì đen sì.
     * - bộ có hình bám chữ (chuỗi ép `format=rgba`) ra thẳng `gbrp`, và trình
     *   phát đọc RGB phẳng như YUV nên cả video **ám tím**.
     *
     * Cả hai đều là lỗi không có triệu chứng ở máy phát triển: `ffprobe` báo tệp
     * hợp lệ, thời lượng đúng, `magick` mở được. Chỉ người xem mới thấy.
     *
     * `yuv420p` là định dạng duy nhất mọi trình duyệt và mọi điện thoại đều
     * giải mã được, và là thứ TikTok/Reels nhận.
     */
    "-pix_fmt",
    "yuv420p",
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
