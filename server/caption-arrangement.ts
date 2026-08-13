import type { AlignId, EmphasisId } from "./style-pack";

/**
 * BỘ CÔNG THỨC BỐ CỤC — "đóng gói" cách sắp xếp chữ editorial của Prism.
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
 * Chỉ Prism dùng bộ này (chất editorial). Bộ khác trả `null` → giữ `defaults`.
 */
export type Arrangement = { align: AlignId; emphasis: EmphasisId };

// Chỉ dùng `keyword-large` (từ khoá to, dẫn nhỏ — đã chạy đẹp ở bản xuất) và
// `taper` (dẫn nhỏ-mờ trên, ý to dưới). Bỏ `mixed-size` (từng cho chữ chồng đè
// lộn xộn). Rải ngang đổi giữa lệch-trái / so-le / bậc-thang cho đa dạng.
const PRISM_RECIPES: Arrangement[] = [
  { emphasis: "keyword-large", align: "left" },
  { emphasis: "keyword-large", align: "stagger" },
  { emphasis: "keyword-large", align: "stair" },
  { emphasis: "taper", align: "left" },
  { emphasis: "keyword-large", align: "left" },
  { emphasis: "taper", align: "stagger" },
];

const RECIPES_BY_PACK: Record<string, Arrangement[]> = {
  "prism-pro": PRISM_RECIPES,
};

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
 * Công thức bố cục cho MỘT câu của bộ dáng `packId`, ổn định theo `seed` (id
 * câu / từ đầu). `null` = bộ này không có bộ công thức → dùng `pack.defaults`.
 */
export function arrangementFor(
  packId: string,
  seed: string,
): Arrangement | null {
  const recipes = RECIPES_BY_PACK[packId];
  if (!recipes || recipes.length === 0) return null;
  return recipes[seedIndex(seed, recipes.length)];
}
