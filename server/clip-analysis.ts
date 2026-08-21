import { db } from "./db";
import { ffmpeg } from "./media-tools";

/**
 * ĐỌC MỘT CLIP TƯ LIỆU: đoạn nào dùng được, và khoảnh khắc nào đáng xem.
 *
 * ## Vì sao cần
 *
 * Trước đây khối b-roll luôn bắt đầu từ giây 0 của clip. Hai kiểu hỏng, cả hai
 * đo được trên tư liệu thật:
 *
 * · Clip TỰ QUAY hay dính đầu/cuối rác — tay với máy, khung còn đen, máy đã dừng
 *   mà vẫn ghi. Lấy từ giây 0 là lấy trúng chỗ đó.
 * · Clip nào cũng có chỗ đáng xem hơn chỗ khác. Đo `b-roll-1.mp4` (10,3s): nền
 *   chuyển động 0,7–1,4 suốt, rồi vọt lên 2,8→4,5→4,4 ở giây 7,5–8,75 — đúng lúc
 *   người ngẩng mặt nhìn thẳng camera. Khối cũ lấy 5,2 giây ĐẦU, tức giữ trọn
 *   cảnh quay lưng và vứt đúng khoảnh khắc đắt nhất.
 *
 * ## Vì sao đo chứ không hỏi mô hình
 *
 * Cả hai câu trên đều là câu về TÍN HIỆU HÌNH, không phải câu về ý nghĩa: khung
 * đen là khung đen, chuyển động vọt lên là chuyển động vọt lên. Đo thì tất định,
 * lặp lại được, không tốn credit, và không có ngày nào nó đổi ý.
 */

/** Đường chuyển động lấy mẫu — 4 mẫu/giây đủ bắt một cú ngẩng đầu, chưa đắt. */
const SAMPLE_FPS = 4;
/**
 * Khổ ảnh lúc đo. Nhỏ đến mức này là cố ý: đang đo ĐỘ ĐỔI giữa hai khung, không
 * đọc chi tiết — mà thu nhỏ còn lọc bớt nhiễu hạt của cảnh thiếu sáng.
 */
const SAMPLE_SIZE = "64x36";
/**
 * Dưới ngưỡng này coi như KHÔNG có chuyển động (máy chưa quay, hoặc khung đứng).
 * Nhiễu cảm biến ở cảnh tối cũng tạo ra chút khác biệt giữa hai khung, nên số 0
 * tuyệt đối không bao giờ xảy ra trên video thật.
 */
const STILL_LEVEL = 0.25;
/** Điểm nhấn = chuyển động vượt ngần này lần mức nền. */
const PEAK_RATIO = 1.8;

export type ClipAnalysis = {
  /** Giây bắt đầu phần dùng được (đã bỏ rác đầu). */
  usableIn: number;
  /** Giây kết thúc phần dùng được (đã bỏ rác cuối). */
  usableOut: number;
  /** Giây của khoảnh khắc đáng xem nhất; `null` khi clip đều đều, không có đỉnh. */
  peak: number | null;
};

/**
 * Đường chuyển động: mỗi phần tử là độ khác giữa khung này và khung trước.
 *
 * `tblend=difference` cho ffmpeg tự trừ hai khung liên tiếp, `signalstats` đọc
 * mức sáng trung bình của ảnh hiệu — một lệnh ra cả đường, không phải trích vài
 * trăm tấm PNG rồi so từng cặp.
 */
async function motionCurve(path: string): Promise<number[]> {
  // `file=-` của `metadata=print` ghi ra STDOUT, còn log của ffmpeg ra stderr —
  // đọc cả hai để khỏi phụ thuộc phiên bản nào in chỗ nào.
  const { stdout, stderr } = await ffmpeg([
    "-i",
    path,
    "-filter:v",
    `fps=${SAMPLE_FPS},scale=${SAMPLE_SIZE.replace("x", ":")},` +
      `tblend=all_mode=difference,signalstats,metadata=print:file=-`,
    "-f",
    "null",
    "-",
  ]);
  const out: number[] = [];
  for (const line of `${stdout}\n${stderr}`.split("\n")) {
    const at = line.indexOf("lavfi.signalstats.YAVG=");
    if (at >= 0) out.push(Number(line.slice(at + 23)));
  }
  return out;
}

/** Giây của mẫu thứ `i`. */
const secondsAt = (i: number) => i / SAMPLE_FPS;

/**
 * Đọc một clip.
 *
 * `trimEnds` tắt cho tư liệu lấy từ KHO: kho đã dọn sẵn (đo `b-roll-1.mp4`: 0
 * đoạn đen, 0 đoạn đóng băng), nên cắt hai đầu chỉ tổ ăn mất hình tốt. Clip user
 * tự tải thì ngược lại — đó mới là chỗ có rác bật/tắt máy.
 */
export async function analyzeClip(
  path: string,
  duration: number,
  { trimEnds }: { trimEnds: boolean },
): Promise<ClipAnalysis> {
  let curve: number[];
  try {
    curve = await motionCurve(path);
  } catch {
    // Đo hỏng thì trả nguyên clip — thà không biết gì còn hơn cắt theo số rác.
    return { usableIn: 0, usableOut: duration, peak: null };
  }
  if (curve.length < 4) return { usableIn: 0, usableOut: duration, peak: null };

  let lo = 0;
  let hi = curve.length - 1;
  if (trimEnds) {
    // Gặm hai đầu chừng nào còn đứng im. Chỉ gặm được tối đa một phần tư clip mỗi
    // đầu: quá ngưỡng ấy thì không còn là "rác bật/tắt máy" nữa mà là một clip vốn
    // tĩnh (cảnh chờ, ảnh động chậm), và cắt nó đi là cắt mất chính nội dung.
    const maxBite = Math.floor(curve.length / 4);
    while (lo < maxBite && curve[lo] < STILL_LEVEL) lo += 1;
    while (hi > curve.length - 1 - maxBite && curve[hi] < STILL_LEVEL) hi -= 1;
  }

  // Mức NỀN lấy bằng trung vị của phần dùng được, không lấy trung bình: một đỉnh
  // đủ cao kéo trung bình lên theo nó, rồi chính nó lại không vượt nổi ngưỡng.
  const inner = curve.slice(lo, hi + 1);
  const sorted = [...inner].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;

  let peakAt = -1;
  let peakValue = 0;
  for (let i = 0; i < inner.length; i += 1) {
    if (inner[i] > peakValue) {
      peakValue = inner[i];
      peakAt = i;
    }
  }
  const hasPeak = median > 0 && peakValue > median * PEAK_RATIO;

  return {
    usableIn: secondsAt(lo),
    usableOut: Math.min(duration, secondsAt(hi + 1)),
    peak: hasPeak ? secondsAt(lo + peakAt) : null,
  };
}

/**
 * Chọn CỬA SỔ dài `want` giây trong clip — ôm điểm nhấn, tránh rác.
 *
 * Điểm nhấn đặt ở khoảng một phần ba cửa sổ tính từ đầu, không đặt giữa: một cú
 * chuyển (ngẩng đầu, quay mặt) cần một nhịp LẤY ĐÀ trước nó để đọc ra là chuyển
 * động, nhưng phần SAU cú chuyển mới là phần mang thông tin — cắt ngay sau đỉnh
 * thì người xem thấy động tác mà không thấy kết quả của nó.
 *
 * Clip không dài hơn cửa sổ cần thì trả nguyên phần dùng được — vẫn là một cửa
 * sổ thật, vì phần rác hai đầu (nếu có) đã bị gặm khỏi nó rồi.
 */
export function pickWindow(
  analysis: ClipAnalysis,
  want: number,
  /**
   * Lần dùng thứ mấy của CHÍNH clip này (0 là lần đầu).
   *
   * Một clip có thể lên hình nhiều lần khi nhịp đòi nhiều chèn hơn số tệp người
   * dùng đưa. Lấy đúng một đoạn hai lần thì đọc ra ngay là máy bí; lấy đoạn KHÁC
   * thì cùng một cuộn phim cho ra hai cảnh khác nhau, đúng như người dựng thật
   * làm với một cú quay dài.
   */
  nth = 0,
  /** Clip này lên hình TẤT CẢ mấy lần — để chia đều chỗ đứng giữa các lần. */
  outOf = 1,
): { in: number; out: number } {
  const room = analysis.usableOut - analysis.usableIn;
  if (room <= want + 0.05)
    return { in: analysis.usableIn, out: analysis.usableOut };

  /*
   * DÙNG LẠI CLIP: chia đều vùng dùng được thành `outOf` chỗ đứng, lần thứ `nth`
   * lấy chỗ thứ `nth`.
   *
   * Bản trước trượt theo bước rồi lấy dư (`%`) — và phép lấy dư quấn ngược về gần
   * chỗ cũ: đo thật trên clip 8 giây dùng ba lần, ba cửa sổ ra 4,7–7,8 · 3,9–7,7 ·
   * 3,6–7,2, tức gần như cùng một cảnh ba lần. Chia đều thì lần đầu ở đầu clip,
   * lần cuối ở cuối clip, và chúng không thể chồng nhau quá nửa.
   *
   * Bỏ qua điểm nhấn ở nhánh này: điểm nhấn chỉ có một, lần nào cũng ôm lấy nó
   * thì mọi lần dùng lại cho ra cùng một cảnh — đúng thứ đang cần tránh.
   */
  if (outOf > 1) {
    const span = room - want;
    const start = analysis.usableIn + (span * Math.min(nth, outOf - 1)) / (outOf - 1);
    return { in: start, out: Math.min(start + want, analysis.usableOut) };
  }
  const lead = want / 3;
  const start =
    analysis.peak == null
      ? analysis.usableIn
      : Math.min(
          Math.max(analysis.usableIn, analysis.peak - lead),
          analysis.usableOut - want,
        );
  return { in: start, out: start + want };
}

/**
 * Đọc clip có CACHE — đo một lần rồi giữ trên `media_files`.
 *
 * Đo là một lượt ffmpeg trên cả clip; bước đặt b-roll chạy lại mỗi lần người dùng
 * đổi vibe hay gieo lại, nên không cache thì cùng một clip bị quét đi quét lại.
 *
 * `trimEnds` bật cho clip NGƯỜI DÙNG TỰ TẢI (`from_library = 0`) — chỉ ở đó mới có
 * rác bật/tắt máy quay; clip lấy từ kho đã dọn sẵn nên gặm hai đầu là ăn vào hình.
 */
export async function readClipAnalysis(
  fileId: string,
): Promise<ClipAnalysis | null> {
  const row = db
    .prepare(
      `SELECT stored_path, duration, from_library, usable_in_sec, usable_out_sec, peak_sec
         FROM media_files WHERE id=?`,
    )
    .get(fileId) as
    | {
        stored_path: string;
        duration: number | null;
        from_library: number | null;
        usable_in_sec: number | null;
        usable_out_sec: number | null;
        peak_sec: number | null;
      }
    | undefined;
  // Ảnh tĩnh (không thời lượng) không có gì để đọc — chúng đứng im theo định nghĩa.
  if (!row || !row.duration || row.duration <= 0.05) return null;
  if (row.usable_out_sec != null)
    return {
      usableIn: row.usable_in_sec ?? 0,
      usableOut: row.usable_out_sec,
      peak: row.peak_sec,
    };

  const analysis = await analyzeClip(row.stored_path, row.duration, {
    trimEnds: !row.from_library,
  });
  db.prepare(
    "UPDATE media_files SET usable_in_sec=?, usable_out_sec=?, peak_sec=? WHERE id=?",
  ).run(analysis.usableIn, analysis.usableOut, analysis.peak, fileId);
  return analysis;
}
