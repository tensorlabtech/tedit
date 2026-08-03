import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { db } from "./db";

const run = promisify(execFile);

/**
 * TỰ CÂN HÌNH: đo video rồi tự đặt tham số, không bắt người dùng kéo thanh nào.
 *
 * Người dùng của công cụ này quay bằng điện thoại, trong phòng, đèn trần. Đo
 * một tệp thật trong `server/data`: độ sáng trung bình 40 trên thang 255, độ
 * bão hoà 2,8 — tối và bạc màu. Đó không phải ca hiếm, đó là ca thường.
 *
 * Nhưng "chỉnh cho đẹp" mà đặt một bộ số cố định thì hỏng đúng những video
 * vốn đã đẹp: video quay ngoài trời nâng sáng thêm là cháy trắng. Nên phải ĐO
 * trước rồi mới quyết, và quyết xong phải biết khi nào NÊN IM.
 *
 * Rẻ: một lượt quét hai giây đầu, chạy một lần lúc chuẩn bị video.
 */

export type HinhStats = {
  /** Độ sáng trung bình, thang 0..255. */
  yAvg: number;
  /** Tối nhất và sáng nhất — hai số này cho biết dải sáng rộng hay hẹp. */
  yMin: number;
  yMax: number;
  /** Độ bão hoà trung bình. Dưới 8 là gần như không màu. */
  satAvg: number;
};

/**
 * Đo vài giây đầu của một tệp.
 *
 * Chỉ hai giây: đủ để biết video sáng hay tối, mà không bắt người dùng chờ.
 * Quét cả tệp thì chính xác hơn về lý thuyết, nhưng một video một phút mất
 * thêm vài giây cho một quyết định chỉ có ba nấc.
 *
 * Trả `null` khi không đo được — tệp hỏng, thiếu luồng hình, ffmpeg đổi định
 * dạng in ra. Nơi gọi phải coi đó là "đừng chỉnh gì", không phải là lỗi.
 */
export async function measureImage(path: string): Promise<HinhStats | null> {
  try {
    const { stdout, stderr } = await run(
      "ffmpeg",
      [
        "-hide_banner", "-loglevel", "error",
        "-t", "2", "-i", path,
        "-vf", "signalstats,metadata=print:file=-",
        "-f", "null", "-",
      ],
      { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 },
    );
    // `metadata=print:file=-` in ra STDOUT, còn ffmpeg nói chuyện ở STDERR.
    // Đọc thiếu một trong hai là mọi tệp đều ra "không đo được".
    const raw = `${stdout}\n${stderr}`;
    const lay = (ten: string) => {
      const so = [...raw.matchAll(new RegExp(`${ten}=([\\d.]+)`, "g"))]
        .map((m) => Number(m[1]))
        .filter(Number.isFinite);
      return so.length > 0 ? so.reduce((a, b) => a + b, 0) / so.length : Number.NaN;
    };
    const stats = {
      yAvg: lay("YAVG"),
      yMin: lay("YMIN"),
      yMax: lay("YMAX"),
      satAvg: lay("SATAVG"),
    };
    return Number.isFinite(stats.yAvg) ? stats : null;
  } catch {
    return null;
  }
}

/**
 * Bộ số đã quyết, để còn giải thích được cho người dùng.
 *
 * Trả cả CON SỐ lẫn LÝ DO: hàng soát nói "video hơi tối, đã nâng sáng" chứ
 * không nói "đã áp eq=brightness=0.08". Người dùng không chuyên cần biết máy
 * đã làm gì, không cần biết nó gọi bộ lọc nào.
 */
export type CanHinh = {
  sang: number;
  tuongPhan: number;
  bhoa: number;
  giamOn: boolean;
  lamNet: boolean;
  lyDo: string[];
};

/**
 * Từ số đo ra bộ chỉnh — và ra QUYẾT ĐỊNH IM khi video vốn đã ổn.
 *
 * Ba ngưỡng, đều lấy từ chỗ mắt bắt đầu thấy khác:
 *
 * · **Sáng** — dưới 70/255 là tối thấy rõ. Nâng theo mức thiếu, nhưng chặn
 *   trần 0,12: nâng mạnh hơn thì vùng tối nhũn ra thành xám đục, mà chỗ đó
 *   chính là nơi khuôn mặt nằm khi quay ngược sáng.
 *
 * · **Tương phản** — dải sáng hẹp (chênh dưới 140) nghĩa là ảnh bết, không có
 *   đen sâu cũng không có trắng. Kéo giãn nhẹ.
 *
 * · **Màu** — bão hoà dưới 12 là bạc màu. Nâng vừa phải; nâng mạnh thì da
 *   người ra màu cam, và đó là lỗi ai cũng nhận ra ngay.
 *
 * **Giảm ồn chỉ bật khi video TỐI.** Nhiễu sinh ra ở chỗ thiếu sáng và lộ ra
 * khi nâng sáng — nâng mà không lọc thì càng nâng càng thấy hạt. Video đủ
 * sáng thì lọc chỉ làm mất chi tiết da và tốn thời gian dựng.
 */
export function gradeImage(stats: HinhStats | null): CanHinh | null {
  if (!stats) return null;

  const lyDo: string[] = [];
  let sang = 0;
  let tuongPhan = 1;
  let bhoa = 1;

  const TOI = 70;
  if (stats.yAvg < TOI) {
    sang = Math.min(0.12, ((TOI - stats.yAvg) / 255) * 0.9);
    lyDo.push("hình hơi tối nên đã nâng sáng");
  }

  const spread = stats.yMax - stats.yMin;
  if (spread < 140) {
    tuongPhan = 1 + Math.min(0.18, (140 - spread) / 700);
    lyDo.push("sáng tối bết vào nhau nên đã tách ra");
  }

  if (stats.satAvg < 12) {
    bhoa = 1 + Math.min(0.22, (12 - stats.satAvg) / 60);
    lyDo.push("màu hơi bạc nên đã nâng lên");
  }

  // Nhiễu chỉ đáng lọc khi tối — và chỉ khi ta đang nâng sáng, tức sắp làm nó
  // lộ ra.
  const giamOn = stats.yAvg < 55 && sang > 0;
  if (giamOn) lyDo.push("lọc bớt hạt nhiễu của chỗ thiếu sáng");

  // Làm nét bù lại phần mềm đi do lọc nhiễu. Không lọc thì cũng không cần nét
  // thêm — video gốc vốn đã đủ nét, làm nét nữa là ra viền trắng quanh mép.
  const lamNet = giamOn;

  if (lyDo.length === 0) return null;
  return { sang, tuongPhan, bhoa, giamOn, lamNet, lyDo };
}

/**
 * Chuỗi lọc ffmpeg của bộ chỉnh, hoặc `null` khi không cần chỉnh gì.
 *
 * Thứ tự có lý do: lọc nhiễu TRƯỚC khi nâng sáng, vì nâng sáng khuếch đại luôn
 * cả hạt nhiễu — lọc sau thì phải lọc mạnh hơn nhiều mới sạch, mà lọc mạnh thì
 * mặt người thành mặt sáp.
 */
export function autoGradeFilter(can: CanHinh | null): string | null {
  if (!can) return null;
  const parts: string[] = [];
  // `luma_spatial=3` là mức nhẹ: đủ mượt hạt mà chưa xoá vân da.
  if (can.giamOn) parts.push("hqdn3d=3:2:6:6");
  const eq: string[] = [];
  if (can.sang) eq.push(`brightness=${can.sang.toFixed(3)}`);
  if (can.tuongPhan !== 1) eq.push(`contrast=${can.tuongPhan.toFixed(3)}`);
  if (can.bhoa !== 1) eq.push(`saturation=${can.bhoa.toFixed(3)}`);
  if (eq.length > 0) parts.push(`eq=${eq.join(":")}`);
  if (can.lamNet) parts.push("unsharp=5:5:0.6:5:5:0");
  return parts.length > 0 ? parts.join(",") : null;
}

/**
 * Dự án này có bật tự cân hình không.
 *
 * Dự án cũ chưa có cột thì rơi về BẬT — cùng hướng với mặc định của cột, và
 * cũng là hướng đúng: chúng là những dự án quay bằng điện thoại từ trước khi
 * có tính năng này.
 */
export function autoGradeOn(projectId: string): boolean {
  const row = db
    .prepare("SELECT auto_grade FROM projects WHERE id=?")
    .get(projectId) as { auto_grade?: number | null } | undefined;
  return (row?.auto_grade ?? 0) !== 0;
}
