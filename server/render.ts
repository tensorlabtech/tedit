import { junctionHalves, type JunctionId } from "./junction-kinds";
import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { REVEALS } from "./insert-reveal";
import { ffmpeg, run } from "./media-tools";
import { outDir, workDir } from "./paths";
import { type StylePack } from "./style-pack";
import type { CaptionBlock, RevealId, TextOptions } from "./style-pack";
import {
  type AlignId,
  type Band,
  type EmphasisId,
} from "./text-layout";

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
  /** Cỡ/chỗ đứng người dùng đè cho riêng cụm — xem `TextOptions`. */
  textOpts?: TextOptions | null;
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
    // TOÀN khung khoá (`-g 1`): mọi frame giải mã ĐỘC LẬP nên tua / nhảy chỗ cắt
    // hiện NGAY. Mỗi-giây (`-g FPS`) vẫn phải giải tới ~1s hình mỗi lần seek — màn
    // "Cắt đoạn lỗi" nhảy hàng chục chỗ nên thấy GIẬT. All-intra to hơn nhưng đây
    // chỉ là proxy xem trước (540p), đổi lấy tua mượt là đáng.
    "-g",
    "1",
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
export async function cutRanges(
  projectId: string,
  base: string,
  kept: KeptRange[],
  /**
   * Tên tệp ra. Đổi khi cần cắt một luồng KHÁC theo cùng bộ khoảng — cùng `kept`
   * là cách duy nhất bảo đảm hai luồng không lệch một khung nào.
   */
  outName = "cut.mp4",
) {
  const target = join(workDir(projectId), outName);
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
        `asetpts=PTS-STARTPTS,${fadeOut}anull[a${index}]`
      );
    })
    .join(";");

  // Nối từng CẶP bằng `concat` hai luồng, xâu chuỗi các mẩu lại thành một dải.
  const joins: string[] = [];
  let vTruoc = "[v0]";
  let aTruoc = "[a0]";
  for (let index = 1; index < kept.length; index++) {
    const vRa = index === kept.length - 1 ? "[vout]" : `[vc${index}]`;
    const aRa = index === kept.length - 1 ? "[aout]" : `[ac${index}]`;
    joins.push(`${vTruoc}[v${index}]concat=n=2:v=1:a=0${vRa}`);
    joins.push(`${aTruoc}[a${index}]concat=n=2:v=0:a=1${aRa}`);
    vTruoc = vRa;
    aTruoc = aRa;
  }

  // Một đoạn duy nhất thì không có gì để nối — vẫn phải đặt tên đầu ra.
  if (kept.length === 1) {
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
