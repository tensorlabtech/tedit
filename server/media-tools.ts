import { execFile } from "node:child_process";
import { promisify } from "node:util";

/** Chạy một lệnh, trả stdout. Xuất ra ngoài để `render.ts` gọi ffprobe trực tiếp. */
export const run = promisify(execFile);

export type ProbeResult = {
  duration: number;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
  videoCodec: string | null;
  audioCodec: string | null;
  /** Khác 0 nghĩa là video quay ngang/dọc bằng metadata, không phải bằng pixel */
  rotation: number;
  /** Nhịp khung thay đổi — nguồn gây lệch tiếng dần theo thời gian */
  variableFrameRate: boolean;
  /** Cảnh báo cần nói cho người dùng biết ngay lúc tải lên */
  warnings: string[];
};

/** Codec tiếng ffmpeg trên máy này không giải được — video sẽ ra không có tiếng. */
const UNDECODABLE_AUDIO = ["apac"];

export async function probe(path: string): Promise<ProbeResult> {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate:stream_side_data=rotation:stream_tags=rotate",
    "-of",
    "json",
    path,
  ]);
  const data = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{
      codec_type: string;
      codec_name?: string;
      width?: number;
      height?: number;
      avg_frame_rate?: string;
      r_frame_rate?: string;
      tags?: { rotate?: string };
      side_data_list?: Array<{ rotation?: number }>;
    }>;
  };
  const video = data.streams?.find((s) => s.codec_type === "video");
  const audio = data.streams?.find((s) => s.codec_type === "audio");

  const ratio = (value?: string) => {
    if (!value) return 0;
    const [a, b] = value.split("/").map(Number);
    return b ? a / b : a;
  };
  // `avg` lệch `r` quá 1% là nhịp khung thay đổi. Đây là nguồn làm tiếng lệch
  // dần theo thời gian — video càng dài càng lệch, và không ai nhận ra ở phút đầu.
  const avg = ratio(video?.avg_frame_rate);
  const real = ratio(video?.r_frame_rate);
  const variableFrameRate =
    avg > 0 && real > 0 && Math.abs(avg - real) / real > 0.01;

  const rotation =
    Number(video?.side_data_list?.[0]?.rotation ?? video?.tags?.rotate ?? 0) ||
    0;

  const warnings: string[] = [];
  if (audio && UNDECODABLE_AUDIO.includes(audio.codec_name ?? "")) {
    warnings.push(
      `Tiếng ở định dạng ${audio.codec_name} — máy không đọc được, video sẽ mất tiếng`,
    );
  }
  if (variableFrameRate) {
    warnings.push(
      "Nhịp khung thay đổi — đã chuẩn hoá về 30 khung/giây khi dựng",
    );
  }
  // Chỉ báo góc XOAY LẺ. Quay 90° bằng metadata là chuyện thường của mọi video
  // quay dọc bằng điện thoại: bề rộng/cao trả về đã đổi chỗ cho đúng, ffmpeg
  // cũng tự xoay khi dựng — báo nữa thì tải năm tệp là năm dòng cảnh báo về một
  // chuyện chẳng có gì để người dùng làm.
  if (rotation % 90 !== 0) {
    warnings.push(
      `Video quay ${rotation}° bằng metadata — đã xoay lại khi dựng`,
    );
  }

  // Bề rộng/cao khi XEM, không phải khi lưu. Điện thoại quay dọc ghi luồng
  // 1920×1080 kèm `rotation: -90` — đọc thẳng số của luồng thì một video dọc bị
  // gọi là khung ngang, và người dùng đọc được đúng câu ngược với thứ họ vừa quay.
  const quarterTurned = Math.abs(rotation) % 180 === 90;
  const rawWidth = video?.width ?? null;
  const rawHeight = video?.height ?? null;

  return {
    duration: Number(data.format?.duration ?? 0),
    width: quarterTurned ? rawHeight : rawWidth,
    height: quarterTurned ? rawWidth : rawHeight,
    hasAudio: Boolean(audio),
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    rotation,
    variableFrameRate,
    warnings,
  };
}

/** Một khung hình gần đầu, cắt vuông — dùng làm ảnh xem trước trong danh sách. */
/**
 * `seekSeconds = 0` là bắt buộc với ẢNH tĩnh: ảnh chỉ có một khung ở giây 0,
 * nhảy tới 0,5 giây là ffmpeg không tìm thấy khung nào và báo lỗi. Chỗ gọi
 * nuốt lỗi đó nên mọi ảnh chèn đều không có ảnh thu nhỏ — im lặng suốt.
 */
export async function makeThumbnail(
  source: string,
  target: string,
  seekSeconds = 0.5,
) {
  await run("ffmpeg", [
    "-y",
    ...(seekSeconds > 0 ? ["-ss", String(seekSeconds)] : []),
    "-i",
    source,
    "-frames:v",
    "1",
    "-vf",
    // Cắt theo đúng khung 9:16 của video thành phẩm, không cắt vuông: lưới dự
    // án bày ảnh dọc, ảnh vuông nhét vào đó phải cắt thêm lần nữa và mất nét.
    "scale=360:640:force_original_aspect_ratio=increase,crop=360:640",
    target,
  ]);
}

/** Tách audio 16kHz mono — đúng thứ whisper cần, và nhẹ hơn video nhiều lần. */
export async function extractAudio(source: string, target: string) {
  await run("ffmpeg", [
    "-y",
    "-i",
    source,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    target,
  ]);
}

/**
 * Đo bề rộng chữ THẬT bằng ImageMagick thay vì ước lượng theo số ký tự.
 *
 * Ước lượng theo số ký tự sai rất xa với tiếng Việt: "IIIII" và "mmmmm" cùng 5
 * ký tự nhưng rộng gấp đôi nhau, còn dấu chồng thì ăn thêm chiều cao.
 */
export async function measureText(
  text: string,
  fontFile: string,
  fontSize: number,
): Promise<{ width: number; height: number }> {
  const { stdout } = await run("magick", [
    "-background",
    "none",
    "-font",
    fontFile,
    "-pointsize",
    String(fontSize),
    `label:${text}`,
    "-format",
    "%w %h",
    "info:",
  ]);
  const [width, height] = stdout.trim().split(/\s+/).map(Number);
  return { width, height };
}

/**
 * VỆT MỰC của một chuỗi bắt đầu cách mép trên hộp dòng bao xa.
 *
 * Cần vì `drawtext` neo theo mép trên VỆT MỰC, không neo theo hộp dòng: hai
 * tiếng vẽ ở cùng một `y` mà một tiếng có dấu chồng dấu còn tiếng kia không thì
 * chân chữ của chúng lệch nhau. Đo trên chính ffmpeg ở cỡ 120: lệch 37px với
 * Anton, 73px với Dancing Script — tức 31–61% cỡ chữ.
 *
 * Trang xem KHÔNG có lỗi này (CSS xếp theo chân chữ), nên đây là lỗi "xem một
 * đằng xuất một nẻo" mà phép so hộp bao không bắt được: nó so hộp DÒNG, còn chỗ
 * lệch nằm ở vệt mực bên trong hộp.
 *
 * Trả `0` cho chuỗi không có nét mực nào — `-trim` trên ảnh trong suốt hoàn toàn
 * thì ImageMagick báo lỗi chứ không trả số.
 */
export async function measureInkTop(
  text: string,
  fontFile: string,
  fontSize: number,
): Promise<number> {
  try {
    const { stdout } = await run("magick", [
      "-background",
      "none",
      "-font",
      fontFile,
      "-pointsize",
      String(fontSize),
      `label:${text}`,
      "-trim",
      "-format",
      "%O",
      "info:",
    ]);
    // `%O` viết theo dạng `+x+y`; chỉ cần phần dọc.
    const match = /^[+-]\d+([+-]\d+)$/.exec(stdout.trim());
    return match ? Number(match[1]) : 0;
  } catch {
    return 0;
  }
}

/** Làm tròn lên số chẵn — ffmpeg đòi bề rộng/cao chẵn với luồng yuv420. */
const chan = (value: number) => (value % 2 === 0 ? value : value + 1);

/**
 * Dải ảnh thu nhỏ để vẽ lên dải thời gian.
 *
 * Lấy `framesPerSecond` khung mỗi giây, mỗi khung rộng đúng
 * `secondWidth / framesPerSecond` px — nhân lên là vừa khít một giây trên dải,
 * nên KHÔNG phải giãn gì cả. Bản trước lấy một khung rồi giãn 4,2 lần cho đủ
 * một giây, mặt người bẹt thành vệt.
 *
 * `density` là số điểm ảnh THẬT trên mỗi px CSS: màn Retina có 2 điểm ảnh cho
 * một px, nên dựng dải đúng bằng cỡ hiển thị là ảnh bị nội suy lên gấp đôi và
 * nhoè. Dựng 2× rồi để trình duyệt thu lại thì nét.
 *
 * Khung cắt theo kiểu PHỦ: phóng cho cả hai chiều đều ≥ ô đích rồi xén phần
 * giữa. Bản trước phóng theo bề rộng rồi xén cứng `laneHeight` — với ô hẹp thì
 * ảnh phóng ra còn thấp hơn chiều cao cần xén và ffmpeg lỗi.
 */
export async function makeFilmstrip(
  source: string,
  target: string,
  durationSeconds: number,
  // PHẢI KHỚP `LANE_HEIGHT` bên client (`timeline-clip-lane.tsx`). Ảnh sprite chỉ
  // không méo khi vẽ ở đúng chiều cao này: client vẽ dải ở `LANE_HEIGHT`px, mà
  // scale ngang do `nativeSecondWidth` cố định ở 1/density — nên scale dọc
  // (`LANE_HEIGHT`/cellHeight) chỉ bằng scale ngang khi `laneHeight === LANE_HEIGHT`.
  // Lệch một con số là mặt người bị kéo dài/bẹt ở mọi mức phóng.
  laneHeight = 56,
  density = 2,
  // Khung/giây MONG MUỐN (trần vẫn hạ tiếp nếu vượt giới hạn texture). Dải thời
  // gian dùng 4 (mịn). Thanh CẮT ĐOẠN dùng ÍT hơn (vd 2) để mỗi khung RỘNG gấp
  // đôi → cao gấp đôi khi vẽ vừa bề ngang thanh, nhìn rõ hơn.
  startFps = 4,
) {
  /*
   * Trần bề ngang của dải — do GPU đặt ra, không phải do JPEG.
   *
   * **Card đồ hoạ hầu hết chỉ nạp được texture rộng 16.384px.** Vượt là trình
   * duyệt không dựng nổi một texture cho cả tấm: nó rã ra nhiều mảnh hoặc rơi về
   * vẽ bằng CPU — mà dải thời gian vẽ tấm ấy ở hàng chục ô, mỗi ô một
   * `background-position` khác. Nên tổng bề ngang (`columns * cellWidth`) phải
   * nằm dưới trần này; video dài thì hạ số khung/giây chứ không phá trần.
   */
  const MAX_WIDTH = 16384;
  const seconds = Math.max(1, Math.ceil(durationSeconds));
  const cellHeight = chan(Math.round(laneHeight * density));

  // TỈ LỆ THẬT của video (đã bù xoay ở `probe`) — mỗi ô hiện TRỌN khung ở ĐÚNG tỉ
  // lệ này, không xén hai mép. Trước đây `cellWidth` lấy theo MẬT ĐỘ khung
  // (perSecond/fps), không theo tỉ lệ video: khung dọc 9:16 bị nhét vào ô hẹp rồi
  // cắt hai bên, tỉ lệ ô (~0,30) hẹp hơn tỉ lệ khung (0,56) — thumbnail "sai
  // ratio", mất cả cảnh hai mép. Giờ `cellWidth = cellHeight × tỉ lệ` nên ô bằng
  // đúng khung.
  const meta = await probe(source);
  const aspect = meta.width && meta.height ? meta.width / meta.height : 16 / 9;
  let cellWidth = chan(Math.max(8, Math.round(cellHeight * aspect)));

  // Số khung/giây: DÀY NHẤT mà cả dải vẫn dưới trần texture (kể cả 1 giây dôi ở
  // cuối — xem `columns`). Ô rộng (khung dọc) thì ít khung/giây hơn — đổi độ mịn
  // thời gian lấy ĐÚNG tỉ lệ, vì tỉ lệ sai đọc ra ngay còn thưa khung thì không.
  let framesPerSecond = Math.max(1, Math.round(startFps));
  while (
    framesPerSecond > 1 &&
    (seconds + 1) * framesPerSecond * cellWidth > MAX_WIDTH
  ) {
    framesPerSecond -= 1;
  }
  const columns = seconds * framesPerSecond + framesPerSecond;

  // Chốt bằng bề ngang THẬT: video RẤT dài + ô rộng có thể vẫn vượt trần dù fps đã
  // về 1 — khi đó đành thu hẹp ô (xén chút) để giữ trong trần. Bớt 2 mỗi lượt để
  // bề ngang CHẴN (ffmpeg đòi vậy với luồng yuv420).
  while (cellWidth > 8 && columns * cellWidth > MAX_WIDTH) cellWidth -= 2;

  await run("ffmpeg", [
    "-y",
    "-i",
    source,
    "-vf",
    `fps=${framesPerSecond},` +
      `scale=${cellWidth}:${cellHeight}:force_original_aspect_ratio=increase,` +
      `crop=${cellWidth}:${cellHeight},tile=${columns}x1`,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    target,
  ]);
  return {
    cellWidth,
    framesPerSecond,
    secondWidth: cellWidth * framesPerSecond,
    laneHeight: cellHeight,
    /**
     * Số GIÂY mà ảnh biểu diễn. Bàn dựng chia bề rộng ảnh cho con số này để ra
     * thang, nên thiếu nó là vẽ sai tỉ lệ — không phải số trang trí.
     */
    totalSeconds: columns / framesPerSecond,
    /**
     * Một giây rộng bao nhiêu px khi ảnh vẽ ở ĐÚNG chiều cao dải (`laneHeight`).
     *
     * Đây là thang mà khung hình không bị bóp méo. Bàn dựng phóng to hơn thì
     * lặp lại khung, thu nhỏ hơn thì bỏ bớt khung — chứ không kéo giãn ảnh, vì
     * kéo giãn là mặt người bẹt đi ở mọi mức phóng trừ đúng một mức.
     */
    nativeSecondWidth: (cellWidth * framesPerSecond * laneHeight) / cellHeight,
  };
}

/**
 * Số luồng cho ffmpeg — cùng nguồn với số luồng của máy nghe.
 *
 * ffmpeg để mặc định sẽ mở luồng theo số core NHÌN THẤY, mà trong container đó
 * là số core của máy chủ chứ không phải hạn mức `cpus` của cgroup. Thừa luồng
 * không cho thêm tốc độ, chỉ cho thêm nhịp bị cgroup bóp — và trên VPS dùng
 * chung thì phần bóp ấy lấy đi của stack bên cạnh.
 *
 * Chưa đặt thì để rỗng và ffmpeg tự quyết, giữ nguyên hành vi cũ ở máy phát
 * triển.
 */
const WORKER_THREADS = process.env.TEDDIT_WORKER_THREADS?.trim();

export const ffmpeg = (args: string[]) =>
  run("ffmpeg", WORKER_THREADS ? ["-threads", WORKER_THREADS, ...args] : args, {
    maxBuffer: 32 * 1024 * 1024,
  });

/**
 * Mặt nạ hình chữ nhật BO GÓC — trắng ở trong, đen ở ngoài.
 *
 * Cần vì `overlay` của ffmpeg chỉ dán được hình chữ nhật: muốn bo góc thì phải khoét
 * kênh trong suốt của lớp tư liệu theo mặt nạ này. Dựng bằng ImageMagick vì viết
 * biểu thức bo góc trong ffmpeg (`geq`) chậm và khó đọc hơn nhiều.
 */
export async function makeRoundedMask(
  target: string,
  width: number,
  height: number,
  radius: number,
) {
  await run("magick", [
    "-size",
    `${width}x${height}`,
    "xc:black",
    "-fill",
    "white",
    "-draw",
    `roundrectangle 0,0 ${width - 1},${height - 1} ${radius},${radius}`,
    target,
  ]);
  return target;
}
