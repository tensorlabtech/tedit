import { db } from "./db";
import { listSegments, removeRange, removedCount } from "./segments";

/**
 * Bỏ CÂU BỎ DỞ RỒI NÓI LẠI — pass TẤT ĐỊNH, chạy sau `ai-cuts`.
 *
 * Mô hình cắt được khúc rác rõ ("ờ, duyệt những cái--") nhưng HAY để sót phần ĐẦU
 * LẶP ("Các bạn có thể,") vì nó trông như câu mở thật. Kết quả đọc ra lắp: "Các
 * bạn có thể, các bạn có thể duyệt...". Prompt không sửa nổi vì mô hình không tất
 * định ở chỗ này.
 *
 * Nhưng có hai TÍN HIỆU CHẮC do máy nghe để lại:
 *  1. Một từ kết thúc "--" = bị ngắt giữa chừng (lần nói HỎNG).
 *  2. Ngay sau đó (bỏ qua chỗ đã cắt/lặng) nói LẠI bằng đúng chữ mở đầu.
 * Đủ hai thì cắt TRỌN lần nói hỏng — từ tiếng đầu của nó tới chỗ "--".
 *
 * An toàn: chỉ nổ khi CẢ HAI đúng; một mình "--" hay một mình lặp chữ đều không cắt.
 */

type Word = { text: string; start_sec: number; end_sec: number };

/** Bỏ dấu câu + hạ thường để so hai tiếng có "cùng chữ" không. */
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Lần nói hỏng dài nhất cho phép cắt — dài hơn thì gần như chắc không phải bỏ-dở. */
const MAX_ATTEMPT_SECONDS = 6;
/** Khoảng nghỉ tự nhiên trong một lần nói; rộng hơn coi như sang ý khác. */
const MAX_GAP_SECONDS = 0.8;

export function trimFalseStarts(projectId: string): { trimmed: number } {
  const words = db
    .prepare(
      "SELECT text, start_sec, end_sec FROM words WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Word[];
  const removed = listSegments(projectId)
    .filter((s) => s.removed)
    .map((s) => ({ start: s.start_sec, end: s.end_sec }));
  const inRemoved = (t: number) => removed.some((r) => r.start <= t && t < r.end);
  /** Câu ĐÃ TRỌN — đừng lùi lấn sang nó. (Không dùng chỗ-đã-cắt để chặn: lần nói
   * hỏng thường ĐÃ bị AI cắt một phần nên các từ của nó nằm trong đoạn removed —
   * lấy đó làm ranh giới thì dừng ngay tại chỗ "--".) */
  const SENT_END = /[.!?…]\s*$/;

  const cuts: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < words.length; i += 1) {
    if (!/--\s*$/.test(words[i].text)) continue; // từ bị ngắt

    // Lần nói HỎNG = chuỗi từ liền mạch kết thúc ở từ "--". Lùi tới khi gặp câu đã
    // trọn (dấu chấm), khoảng nghỉ rộng, hoặc chạm trần độ dài.
    let a = i;
    while (a > 0) {
      if (SENT_END.test(words[a - 1].text)) break;
      const gap = words[a].start_sec - words[a - 1].end_sec;
      if (gap > MAX_GAP_SECONDS) break;
      if (words[i].end_sec - words[a - 1].start_sec > MAX_ATTEMPT_SECONDS) break;
      a -= 1;
    }

    // Lần nói LẠI = từ GIỮ đầu tiên sau từ "--" (bỏ qua chỗ đã cắt/lặng).
    let r = i + 1;
    while (r < words.length && inRemoved(words[r].start_sec)) r += 1;
    if (r >= words.length) continue;

    // Cùng chữ mở đầu → là nói lại → cắt trọn lần nói hỏng.
    if (norm(words[a].text) && norm(words[a].text) === norm(words[r].text)) {
      cuts.push({ start: words[a].start_sec, end: words[i].end_sec });
    }
  }

  // Bỏ từ CUỐI lên ĐẦU: `removeRange` tách đoạn, làm xuôi thì mốc sau trôi.
  cuts.sort((x, y) => y.start - x.start);
  let trimmed = 0;
  for (const c of cuts) {
    const was = removedCount(projectId);
    removeRange(projectId, c.start, c.end);
    if (removedCount(projectId) !== was) trimmed += 1;
  }
  return { trimmed };
}
