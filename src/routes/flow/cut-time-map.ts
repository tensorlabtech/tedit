/** Một khoảng còn GIỮ lại, theo mốc của video GỐC. */
export type Kept = { start: number; end: number };

/**
 * QUY ĐỔI MỐC giữa hai trục thời gian của màn cắt.
 *
 * Màn cắt có hai trục, và lẫn chúng là lỗi tệ nhất có thể xảy ra ở đây:
 *
 * · trục GỐC — dải ô ảnh, các khoảng bỏ, mọi thứ người dùng kéo đều theo trục này;
 * · trục ĐÃ CẮT — bản ghép sẵn (`cut-preview.ts`) chỉ chứa phần còn giữ, nên mốc
 *   của nó ngắn hơn và không khớp trục gốc ở bất kỳ đâu sau khoảng bỏ đầu tiên.
 *
 * Vạch chạy theo tệp đang phát, mà dải vẽ theo trục gốc — thiếu bảng quy đổi thì
 * vạch trôi lệch dần khỏi tiếng, mỗi khoảng bỏ lệch thêm một đoạn.
 *
 * Hai hàm dưới đây là nghịch đảo của nhau trên miền hợp lệ, và có phép kiểm số
 * đi kèm (`scripts/cut-preview/`), vì đây là chỗ mà một dấu cộng sai không hiện
 * ra thành lỗi mà hiện ra thành "app này lệch tiếng".
 */

/**
 * Mốc GỐC → mốc trong bản ĐÃ CẮT.
 *
 * Mốc rơi vào một khoảng đã bỏ thì trả về mép của phần giữ liền trước — đó là
 * chỗ bản đã cắt sẽ phát khi tới đúng khoảnh khắc ấy.
 */
export function srcToCut(kept: readonly Kept[], at: number): number {
  let truoc = 0;
  for (const r of kept) {
    if (at < r.start) return truoc;
    if (at <= r.end) return truoc + (at - r.start);
    truoc += r.end - r.start;
  }
  return truoc;
}

/** Mốc trong bản ĐÃ CẮT → mốc GỐC. */
export function cutToSrc(kept: readonly Kept[], at: number): number {
  let con = at;
  for (const r of kept) {
    const dai = r.end - r.start;
    if (con <= dai) return r.start + con;
    con -= dai;
  }
  return kept.at(-1)?.end ?? at;
}

/** Tổng thời lượng bản đã cắt. */
export const cutDuration = (kept: readonly Kept[]): number =>
  kept.reduce((sum, r) => sum + (r.end - r.start), 0);
