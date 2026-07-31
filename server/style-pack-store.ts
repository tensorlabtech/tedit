import { db } from "./db";
import type { StylePack } from "./style-pack";
import { GOC, findStylePack } from "./style-pack-catalog";

/**
 * Đọc bộ dáng của một dự án — MỘT cổng duy nhất, và là cổng duy nhất chịu trách
 * nhiệm rơi-về-mặc-định.
 *
 * Cả bộ dáng nằm trong MỘT trường trên `projects`; bảng `elements` không có cột
 * nào của nó. Đổi bộ dáng = ghi một dòng, video vẽ lại theo. Người dùng đã sửa 30
 * cụm cũng không mất gì, vì thứ họ sửa là *nội dung* và *bố cục*, không phải font.
 *
 * ## Bất biến quan trọng nhất của cả nhánh này
 *
 * **`defaults` đọc lúc SINH chữ, phần vẽ đọc lúc RENDER.** Hai thời điểm khác
 * nhau, và đó chính là lý do đổi bộ dáng chỉ đổi được phần vẽ. Đọc `defaults`
 * lúc render là phá bất biến: từ đó trở đi đổi bộ dáng sẽ ghi đè bố cục người
 * dùng đã chỉnh tay.
 *
 * Phép kiểm: đổi bộ dáng rồi so bảng `elements` — khác một hàng là sai.
 */
export function readStylePack(projectId: string): StylePack {
  const row = db
    .prepare("SELECT style_pack FROM projects WHERE id=?")
    .get(projectId) as { style_pack: string | null } | undefined;
  // Dự án không tồn tại, cột chưa vá, hay tên rác trong CSDL — cả ba đều rơi về
  // bộ gốc. Thà ra dáng mặc định còn hơn dừng cả mạch vì một chuỗi lạ.
  return row ? findStylePack(row.style_pack) : GOC;
}
