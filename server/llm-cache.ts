import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DATA_ROOT } from "./paths";

/**
 * LƯU CÂU TRẢ LỜI CỦA MÔ HÌNH — cùng đầu vào thì dùng lại, không hỏi nữa.
 *
 * ══ VÌ SAO KHÔNG DÙNG `seed` ══
 *
 * Thân yêu cầu vẫn gửi `seed`, nhưng đo thì nó KHÔNG cho lặp lại: hai lượt dựng
 * gpt-5 cùng seed 7, cùng dữ liệu, ra "3 lượt · gạt 107" và "2 lượt · gạt 41",
 * hai tệp lệch nhau 10 MB. Thử thẳng vào API cũng thế — cùng seed, cùng nhà
 * cung cấp, hai danh sách từ khác nhau. Mô hình suy luận sinh phần suy luận
 * không nằm dưới quyền hạt giống, mà suy luận mới là thứ lái kết quả.
 *
 * Nên chỗ duy nhất chắc chắn là **không hỏi lại**.
 *
 * ══ VÌ SAO ĐÁNG LÀM ══
 *
 * Không có nó thì mọi phép so đều vô nghĩa, và điều đó đã xảy ra thật trong một
 * buổi: đem "gạt 46" của một mô hình so với "gạt 107" của mô hình kia rồi kết
 * luận cái này bám văn bản hơn — trong khi chính mô hình kia chạy lần nữa ra 41.
 *
 * Có nó thì so được hai mô hình trên cùng đầu vào, so được hai bản dựng khi sửa
 * mã đồ hoạ, và thử đồ hoạ không phải trả tiền mô hình lại từ đầu.
 *
 * ══ KHOÁ ══
 *
 * Vân tay của MỌI thứ đi vào câu trả lời: mô hình, tên schema, lời nhắc hệ
 * thống, đầu vào, ảnh kèm, mức suy luận. Thiếu một thứ là dùng lại nhầm câu trả
 * lời của một câu hỏi khác — và lỗi ấy im lặng tuyệt đối.
 *
 * KHÔNG gộp `seed` vào khoá: nó không đổi kết quả (đo ở trên), nên đưa vào chỉ
 * làm hỏng mọi lần trúng khi ai đó đổi biến môi trường.
 */

/**
 * Mặc định BẬT.
 *
 * Trong sản phẩm thật mỗi dự án một bản chép khác nhau nên vân tay khác nhau và
 * bộ nhớ này gần như không bao giờ trúng — nó không đổi hành vi, chỉ nằm im.
 * Lần trúng duy nhất là xuất lại đúng một dự án không đổi gì, và lúc ấy ra đúng
 * video cũ mới là điều người dùng mong.
 *
 * Đặt `TEDDIT_LLM_CACHE=0` để tắt.
 */
const ENABLED = process.env.TEDDIT_LLM_CACHE !== "0";

const ROOT = join(DATA_ROOT, "llm-cache");

/** Đếm trúng/trượt để dòng tổng kết của lượt dựng nói được nó tiết kiệm bao nhiêu. */
export const cacheSpend = { hits: 0, misses: 0 };

export function cacheKey(parts: {
  model: string;
  schemaName: string;
  instructions: string;
  input: string;
  images: readonly { mimeType: string; base64: string }[];
  effort: string | undefined;
}): string {
  const canon = JSON.stringify([
    parts.model,
    parts.schemaName,
    parts.instructions,
    parts.input,
    // Băm ảnh thay vì nhét cả chuỗi base64 vào — ảnh vài trăm KB thì phép băm
    // ngoài kia phải nuốt cả chuỗi ấy mỗi lần gọi.
    parts.images.map((i) => `${i.mimeType}:${sha(i.base64)}`),
    parts.effort ?? "",
  ]);
  return sha(canon);
}

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Đường dẫn tệp của một khoá. Chia hai tầng để một thư mục không phình quá. */
function fileOf(key: string): string {
  return join(ROOT, key.slice(0, 2), `${key}.json`);
}

/** Câu trả lời đã lưu, hoặc `null`. Hỏng tệp thì coi như chưa có. */
export function readCache(key: string): unknown | null {
  if (!ENABLED) return null;
  const path = fileOf(key);
  if (!existsSync(path)) {
    cacheSpend.misses += 1;
    return null;
  }
  try {
    const saved = JSON.parse(readFileSync(path, "utf8")) as { value: unknown };
    cacheSpend.hits += 1;
    return saved.value;
  } catch {
    // Tệp hỏng thì hỏi lại mô hình, không ném lỗi: bộ nhớ đệm hỏng không được
    // phép làm sập một lượt dựng.
    cacheSpend.misses += 1;
    return null;
  }
}

export function writeCache(key: string, value: unknown, model: string): void {
  if (!ENABLED) return;
  try {
    const path = fileOf(key);
    mkdirSync(join(ROOT, key.slice(0, 2)), { recursive: true });
    // Ghi kèm mô hình và mốc thời gian để dọn tay được; chúng KHÔNG nằm trong
    // khoá nên không ảnh hưởng phép tra.
    writeFileSync(path, JSON.stringify({ model, at: Date.now(), value }), "utf8");
  } catch {
    // Ghi hỏng — đĩa đầy, không có quyền — thì thôi. Lượt dựng vẫn phải xong.
  }
}
