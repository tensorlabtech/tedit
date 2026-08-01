import { autoAudioFilter, type CanTieng } from "./auto-audio";
import { autoGradeFilter, type CanHinh } from "./auto-grade";
import {
  findJunction,
  junctionHalves,
  type JunctionId,
} from "./junction-kinds";
import { existsSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
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
import { outDir, resolvePackFont, workDir } from "./paths";
import {
  boxBorderW,
  ffmpegColor,
  gradeFilter,
  packForElement,
  type StylePack,
} from "./style-pack";
import type { RevealId } from "./style-pack";
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
) {
  const target = join(workDir(projectId), "cut.mp4");
  if (kept.length === 0) throw new Error("Không còn đoạn nào để xuất");

  const cross = new Map(crossAt.map((item) => [item.sau, item]));

  /*
   * Biên CẮT khác biên GIỮ: chỗ nối nào có chuyển cảnh thì hai đoạn được kéo dài
   * về phía nhau, lấn vào quãng vừa bỏ.
   *
   * `kept` gốc KHÔNG được đụng tới — mọi phép quy mốc chữ, tư liệu và nhạc đều
   * đọc nó, sửa ở đây là lệch hết. Bảng dưới chỉ sống trong hàm này.
   */
  const bien = kept.map((range) => ({ ...range }));
  for (const [sau, item] of cross) {
    bien[sau].end += item.dem;
    bien[sau + 1].start -= item.dem;
  }

  const parts = bien
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
  const noi: string[] = [];
  let vTruoc = "[v0]";
  let aTruoc = "[a0]";
  let dai = bien[0].end - bien[0].start;

  for (let index = 1; index < bien.length; index++) {
    const item = cross.get(index - 1);
    const vRa = index === bien.length - 1 ? "[vout]" : `[vc${index}]`;
    const aRa = index === bien.length - 1 ? "[aout]" : `[ac${index}]`;
    const daiNay = bien[index].end - bien[index].start;

    if (item) {
      const d = item.dem * 2;
      // `offset` đo từ đầu luồng TRÁI: hoà bắt đầu sớm hơn mép cuối đúng bằng
      // thời lượng hoà, để nó kết thúc vừa lúc luồng trái hết.
      const offset = Math.max(0, dai - d);
      noi.push(
        `${vTruoc}[v${index}]xfade=transition=${item.transition}:` +
          `duration=${d.toFixed(3)}:offset=${offset.toFixed(3)}${vRa}`,
      );
      noi.push(`${aTruoc}[a${index}]acrossfade=d=${d.toFixed(3)}${aRa}`);
      // Gối nhau `d` giây nên tổng ngắn đi đúng `d` — và `d` cũng đúng bằng
      // phần vừa mượn thêm ở hai bên. Hai số triệt tiêu nhau, độ dài không đổi.
      dai = dai + daiNay - d;
    } else {
      noi.push(`${vTruoc}[v${index}]concat=n=2:v=1:a=0${vRa}`);
      noi.push(`${aTruoc}[a${index}]concat=n=2:v=0:a=1${aRa}`);
      dai += daiNay;
    }
    vTruoc = vRa;
    aTruoc = aRa;
  }

  // Một đoạn duy nhất thì không có gì để nối — vẫn phải đặt tên đầu ra.
  if (bien.length === 1) {
    noi.push("[v0]null[vout]", "[a0]anull[aout]");
  }

  const scriptPath = join(workDir(projectId), "cut-filter.txt");
  await writeFile(scriptPath, `${parts};${noi.join(";")}`, "utf8");

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
  /** Bộ cân giọng đã đo sẵn; `null` là không chỉnh gì. */
  canhTieng: CanTieng | null = null,
) {
  // Không nhạc VÀ không phải cân giọng thì mới bỏ qua được bước này. Trước đây
  // chỉ xét nhạc, nên video không nhạc đi thẳng ra ngoài — mà đó lại chính là
  // những video chỉ có giọng, tức những video cần cân giọng nhất.
  if (cues.length === 0 && !canhTieng) return video;
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
  /*
   * Cân GIỌNG trước khi trộn nhạc, không phải sau.
   *
   * Sau khi trộn thì thứ đo được là hỗn hợp giọng + nhạc, mà mức nhạc lại do
   * người dùng chỉnh — nâng cả hỗn hợp lên thì nhạc to theo, và tỉ lệ giọng
   * trên nhạc mà người dùng vừa canh bị phá.
   */
  const voiceChain = autoAudioFilter(canhTieng);

  if (cues.length === 0) {
    // Chỉ cân giọng, không nhạc: `amix` một luồng vào là phép trộn không trộn
    // gì — cho giọng đi thẳng ra.
    filters.push(`[0:a]${voiceChain}[aout]`);
  } else {
    const voice = voiceChain ? "[voice]" : "[0:a]";
    if (voiceChain) filters.push(`[0:a]${voiceChain}[voice]`);

    // `normalize=0` là bắt buộc: mặc định `amix` chia đều biên độ cho số luồng,
    // nên thêm nhạc lại làm GIỌNG NÓI nhỏ đi 6dB. Mức nhạc điều bằng `volume`.
    const musicLabels = cues.map((_, index) => `[bg${index}]`).join("");
    filters.push(
      `${voice}${musicLabels}amix=inputs=${cues.length + 1}:duration=first:dropout_transition=0:normalize=0[aout]`,
    );
  }

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
  const grade = gradeFilter(pack.grade);
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
  /** Bộ tự cân hình đã đo sẵn; `null` là không chỉnh gì. */
  canh: CanHinh | null = null,
) {
  const fontPath = resolvePackFont(pack.font.file);
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
  /*
   * TỰ CÂN HÌNH đứng TRƯỚC cả nắn màu của bộ dáng.
   *
   * Nắn màu của bộ dáng là một ý đồ thẩm mỹ — nó giả định khung hình đã phơi
   * sáng đúng. Áp ý đồ ấy lên một khung tối thui thì ra một khung tối thui có
   * ám màu. Sửa chỗ phơi sáng trước, rồi mới tô phong cách lên trên.
   */
  const autoChain = autoGradeFilter(canh);
  if (autoChain) {
    filters.push(`${stream}${autoChain}[canhinh]`);
    stream = "[canhinh]";
  }

  const grade = gradeFilter(pack.grade);
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

  // Mọi chữ đi CHUNG một đường: xếp theo từng tiếng, rồi mỗi tiếng một lệnh vẽ
  // có biểu thức thời gian riêng. Trước đây kiểu "cỡ đều" đi đường bẻ dòng (một
  // lệnh mỗi DÒNG) cho nhẹ, nhưng vẽ cả dòng bằng một lệnh thì không cách nào
  // cho từng tiếng hiện lần lượt — mà đó lại là kiểu chữ của cả hệ này.
  const draws: string[] = [];
  for (const text of texts) {
    // Bộ dáng HIỆU LỰC của riêng cụm này: bộ của dự án, cộng phần nó tự đè.
    // Mọi phép đo và mọi biểu thức phía dưới đều chạy theo bộ này.
    const shown = packForElement(pack, {
      letterCase: text.letterCase ?? null,
      keyColor: text.keyColor ?? null,
    });
    const { words: placed } = await placeWords(
      text.content!,
      text.keywords ?? [],
      text.align ?? "center",
      text.emphasis ?? "even",
      text.band ?? "top",
      OUT_WIDTH,
      OUT_HEIGHT,
      shown,
    );
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

    for (const [flat, word] of placed.entries()) {
      // Thứ tự phẳng của `placed` giữ nguyên thứ tự tiếng trong câu ở mọi kiểu
      // nhấn, nên chỉ số này khớp thẳng với mảng mốc.
      const startAt = startsAt[flat];
      const spot = positionExpr(shown, {
        x: word.x,
        y: word.y,
        width: await textWidth(word.text, word.fontSize, shown),
        fontSize: word.fontSize,
        scale: word.fontSize / OUT_WIDTH,
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
      const body =
        `fontfile='${fontPath}':text='${escapeDrawText(word.text)}':` +
        `fontsize=${word.fontSize}:x='${spot.x}':y='${spot.y}':` +
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
        const litBox = shown.highlight.box
          ? `box=1:boxcolor=${ffmpegColor(shown.highlight.box)}:` +
            `boxborderw=${boxBorderW(word.fontSize, shown)}:`
          : box;
        const litBody =
          `fontfile='${fontPath}':text='${escapeDrawText(word.text)}':` +
          `fontsize=${word.fontSize}:x='${spot.x}':y='${spot.y}':` +
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
    const layer = `[${1 + inserts.length}:v]`;
    filters.push(`${layer}${draws.join(",")}[txt]`);
    if (pack.glow) {
      filters.push(`[txt]split[glowsrc][txtmain]`);
      // Bóp hết màu về đen nhưng GIỮ hình dạng (kênh trong), rồi làm mờ ở NỬA CỠ
      // và phóng lại: kết quả vốn là một vệt mờ nên thu nhỏ trước không thấy khác,
      // mà làm mờ thẳng ở cỡ đầy đủ tốn gấp đôi thời gian xuất.
      const blur = pack.glow.radiusPx / 2;
      filters.push(
        `[glowsrc]colorchannelmixer=rr=0:rg=0:rb=0:gr=0:gg=0:gb=0:br=0:bg=0:bb=0:` +
          `aa=${pack.glow.opacity},scale=${OUT_WIDTH / 2}:${OUT_HEIGHT / 2},` +
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
