import { db } from "./db";
import { blocksFromPack } from "./style-pack";
import { readStylePack } from "./style-pack-store";

/**
 * ĐÓNG DẤU BLOCK — copy look của bộ dáng vào TỪNG element.
 *
 * Đích của kiến trúc: element mang look của CHÍNH nó, không đọc một "pack toàn
 * cục" ở lúc dựng. Bước này là cầu: xẻ bộ dáng ra block (`blocksFromPack`) rồi
 * ghi bản sao vào cột block theo LOẠI element — b-roll/ô người mang `frame_block`,
 * cụm chữ mang `caption_block`. (Chữ-nền/nắn-màu/chỗ-nối để lượt sau khi chúng
 * thành block độc lập.)
 *
 * CHỈ điền chỗ CÒN TRỐNG (`IS NULL`): không đè block người dùng đã sửa; và gọi
 * lại bao nhiêu lần cũng vô hại (idempotent) — nên đặt thẳng ở CỬA ĐỌC (dựng khung
 * xem + xuất video). Cách này phủ hết: dữ liệu cũ, element vừa sinh, lẫn element
 * người dùng thêm tay giữa chừng — mọi element đều có block trước khi bị đọc, mà
 * không cần cờ seed-once (cờ sẽ bỏ sót element thêm SAU khi cờ đã cắm).
 */
export function stampBlocksFromPack(projectId: string): void {
  const blocks = blocksFromPack(readStylePack(projectId));
  db.prepare(
    "UPDATE elements SET frame_block=? WHERE project_id=? AND kind='layout' AND frame_block IS NULL",
  ).run(JSON.stringify(blocks.frame), projectId);
  db.prepare(
    "UPDATE elements SET caption_block=? WHERE project_id=? AND kind='text' AND caption_block IS NULL",
  ).run(JSON.stringify(blocks.caption), projectId);
}
