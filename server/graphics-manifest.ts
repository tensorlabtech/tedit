/**
 * Đọc `assets/graphics/manifest.json` — cửa DUY NHẤT tới danh mục hình.
 *
 * Tách khỏi `style-pack.ts` vì tệp đó bị import từ trang xem nên không được đụng
 * `node:*`. Bộ dáng chỉ khai một chuỗi `id`; mọi thứ khác về cái hình ấy — khổ
 * danh nghĩa, bề rộng hai đầu, luật loại trừ — nằm ở manifest và đọc ở đây.
 *
 * Đọc MỘT lần lúc nạp module: manifest là tệp đi theo repo, không đổi lúc chạy,
 * và đọc lại cho mỗi cụm chữ là năm mươi lượt chạm đĩa cho một lượt xuất video.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PROJECT_ROOT } from "./paths";

export type GraphicKind = "plate" | "wrap" | "spot";

export type GraphicEntry = {
  kind: GraphicKind;
  feel: string;
  /** Khổ lúc vẽ. Chỉ hình `wrap` có — hình `plate` vốn dựng đúng khổ khung. */
  nominal?: { w: number; h: number };
  /** Bề rộng hai đầu giữ nguyên khi cắt ba lát. Chỉ hình `wrap` có. */
  cap?: number;
  /**
   * Cách đặt hình `wrap` quanh khối chữ.
   *
   * - `around` — bao quanh cả khối, cao bằng khối. Vòng khoanh.
   * - `under` — nằm dưới chân khối, cao theo CỠ CHỮ. Gạch chân.
   *
   * Đặt nhầm là lỗi nhìn thấy ngay: một cái gạch chân kéo cao bằng khối ba
   * hàng thì nó cắt ngang giữa chữ.
   */
  fit?: "around" | "under";
  /** Trục nào không được khai cùng lúc với hình này. */
  excludes: string[];
};

const manifest = JSON.parse(
  readFileSync(join(PROJECT_ROOT, "assets", "graphics", "manifest.json"), "utf8"),
) as { kinds: Record<string, string>; graphics: Record<string, GraphicEntry> };

export const GRAPHICS = manifest.graphics;

/**
 * Số đo cắt ba lát của một hình `wrap`.
 *
 * Ném lỗi thay vì trả `null` khi thiếu: bộ dáng trỏ vào một hình không có số đo
 * là một lỗi khai báo, và `check:style-pack` đã canh nó từ trước lúc chạy. Tới
 * đây mà còn thiếu thì im lặng bỏ qua chỉ làm video xuất ra thiếu một trục mà
 * không ai biết.
 */
export function wrapMeta(id: string) {
  const entry = GRAPHICS[id];
  if (!entry?.nominal || entry.cap === undefined) {
    throw new Error(`Hình "${id}" không phải loại wrap, hoặc thiếu nominal/cap trong manifest`);
  }
  return {
    nominalWidth: entry.nominal.w,
    nominalHeight: entry.nominal.h,
    cap: entry.cap,
    fit: entry.fit ?? "around",
  };
}
