import type { Arrangement } from "./style-pack";

/**
 * BỘ CÔNG THỨC BỐ CỤC — "đóng gói" cách sắp xếp chữ editorial.
 *
 * Bản gốc (Captions) sắp chữ mỗi câu MỘT DÁNG: từ khoá to, từ dẫn nhỏ RẢI ngang
 * khác nhau (khi lệch trái, khi so le, khi bậc thang) → cảm giác "hợp ý mà
 * random". Ta gói cái đó thành một danh sách công thức = tổ hợp CỠ (`emphasis`)
 * và RẢI NGANG (`align`), rồi mỗi câu BỐC MỘT công thức theo hạt-giống ỔN ĐỊNH
 * (theo id câu) — đa dạng như bản gốc mà không đổi mỗi lần dựng, không lộn xộn.
 *
 * KHÔNG đụng `band` (dải trên/giữa/dưới): dải do `emptiestBand` chọn để TRÁNH
 * MẶT người nói — vary dải là liều đè mặt. Rải NGANG + đổi CỠ đã đủ dáng.
 *
 * Bộ công thức là trục DATA-DRIVEN của bộ dáng (`pack.arrangementRecipes`): thêm
 * một bộ có chất editorial = điền mảng đó, tệp này không cần biết bộ nào là bộ nào.
 */

/** Hash ổn định (FNV-1a) từ chuỗi → chỉ số công thức. Cùng câu, cùng dáng. */
function seedIndex(seed: string, count: number): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % count;
}

/**
 * Công thức bố cục cho MỘT câu, ổn định theo `seed` (id câu / từ đầu). Bộ dáng
 * không khai công thức (`recipes` rỗng/thiếu) → `null` = dùng `pack.defaults`.
 */
export function arrangementFor(
  recipes: Arrangement[] | undefined,
  seed: string,
): Arrangement | null {
  if (!recipes || recipes.length === 0) return null;
  return recipes[seedIndex(seed, recipes.length)];
}
