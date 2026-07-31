import { db } from "./db";
import { removeRange } from "./segments";

/**
 * Rút ngắn các quãng KHÔNG AI NÓI GÌ.
 *
 * KHÔNG dùng mô hình, và đó là chủ ý. Khoảng lặng không có chữ nào để mà đọc —
 * `ai-cuts.ts` chỉ nhận danh sách từ nên nó không hề nhìn thấy chỗ lặng, và đó
 * là lý do lượt đầu nó chỉ cắt được 3 giây trong một video có 53 giây im lặng.
 * Ở đây đã có sẵn mốc thời gian từng từ, nên một phép trừ là đủ: thêm mô hình
 * vào chỉ tốn tiền, chậm hơn, và cho kết quả dao động giữa các lượt.
 *
 * RÚT chứ không XOÁ HẲN: cắt sạch thì các câu dính liền nhau thành một tràng
 * dồn dập không có chỗ thở, và mỗi mối nối lại là một cú giật hình.
 */

/**
 * Lặng ngắn hơn thì là nhịp thở tự nhiên, đụng vào là hỏng.
 *
 * Đây là mức mặc định; mỗi dự án đặt lại được ở màn nạp tệp
 * (`projects.min_silence`). Người kể chuyện chậm cần ngưỡng cao hơn, còn video
 * hướng dẫn nhanh thì hạ xuống cắt được nhiều hơn.
 */
const MIN_SILENCE = 0.8;
/**
 * Chừa lại ngần này ở mỗi chỗ lặng — đủ nghe ra một nhịp ngắt.
 *
 * Phải LỚN HƠN `MIN_LENGTH` (0,3s) của `segments.ts`: đoạn ngắn hơn thế thì
 * `splitAt` từ chối tách, và vì mẩu dư không nằm TRỌN trong khoảng bỏ nên
 * `removeRange` nuốt luôn cả nó. Đo thật với 0,32 chia đôi hai bên (0,16 mỗi
 * bên): 15 chỗ rút mà chỉ còn 2,3 giây nghỉ trong cả video — nghe dồn không
 * kịp thở.
 */
const KEEP = 0.45;
/**
 * Chừa hai đầu video.
 *
 * Cắt sát từ đầu tiên thì video mở ra là người đã đang nói dở; cắt sát từ cuối
 * thì hết phim ngay lúc âm còn chưa tắt.
 */
const HEAD = 0.35;
const TAIL = 0.6;

export function trimSilence(projectId: string): {
  trimmed: number;
  saved: number;
} {
  const setting = db
    .prepare("SELECT min_silence FROM projects WHERE id=?")
    .get(projectId) as { min_silence: number | null } | undefined;
  // `0` là một lựa chọn THẬT — "đừng tự rút" — nên không được coi là rỗng rồi
  // rơi về mặc định. Chỉ `null` mới là chưa đặt.
  const minSilence = setting?.min_silence ?? MIN_SILENCE;
  if (minSilence <= 0) return { trimmed: 0, saved: 0 };
  const words = db
    .prepare(
      "SELECT start_sec, end_sec FROM words WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Array<{ start_sec: number; end_sec: number }>;
  if (words.length < 2) return { trimmed: 0, saved: 0 };

  const total = (
    db
      .prepare(
        "SELECT COALESCE(SUM(duration),0) AS total FROM media_files WHERE project_id=? AND role='main'",
      )
      .get(projectId) as { total: number }
  ).total;

  /** Mọi quãng lặng: hai đầu video, và khe giữa mỗi cặp từ liền nhau. */
  const gaps: Array<{ start: number; end: number }> = [];
  if (words[0].start_sec > HEAD + minSilence) {
    gaps.push({ start: 0, end: words[0].start_sec - HEAD });
  }
  for (let index = 0; index < words.length - 1; index += 1) {
    gaps.push({ start: words[index].end_sec, end: words[index + 1].start_sec });
  }
  const last = words[words.length - 1].end_sec;
  if (total > last + TAIL + minSilence) {
    gaps.push({ start: last + TAIL, end: total });
  }

  // Bỏ từ CUỐI lên ĐẦU: `removeRange` tách đoạn, nên làm ngược lại thì các mốc
  // phía sau xê dịch hết sau lần bỏ đầu tiên.
  const targets = gaps
    .filter((gap) => gap.end - gap.start >= minSilence)
    .sort((a, b) => b.start - a.start);

  let trimmed = 0;
  let saved = 0;
  for (const gap of targets) {
    const length = gap.end - gap.start;
    // Chừa MỘT KHỐI LIỀN ngay sau câu vừa dứt rồi cắt phần còn lại. Chia đôi
    // hai bên thì sinh ra hai mẩu vụn, mà mẩu dưới `MIN_LENGTH` thì không tách
    // được nên mất sạch. Nhịp nghỉ vốn cũng thuộc về câu vừa nói xong.
    const cutLength = length - KEEP;
    if (cutLength < 0.12) continue;
    removeRange(projectId, gap.start + KEEP, gap.end);
    trimmed += 1;
    saved += cutLength;
  }

  return { trimmed, saved };
}
