import { db } from "./db";
import { ask, hasModel, object } from "./llm";

/**
 * CHỈ THỊ DỰNG → SỐ: dịch câu người dùng viết thành mấy con số của bộ dáng.
 *
 * ## Vì sao đáng làm
 *
 * "B-roll dày lên", "nhịp chậm thôi", "đừng che mặt tôi nhiều" — người dùng nói
 * được ngay những điều đó, còn `brollEverySec: 4` thì không ai gõ. Mà mọi thứ họ
 * muốn nói đều ĐÃ là một con số có sẵn trong bộ dáng; thiếu mỗi cái cầu nối.
 *
 * ## Vì sao ĐÈ chứ không tạo bộ dáng mới
 *
 * Bộ dáng quyết định *nhìn ra sao* — font, khung, màu, nền. Chỉ thị chỉ chỉnh
 * *liều lượng*. Cho nó đẻ ra một bộ dáng riêng thì mọi ràng buộc mà
 * `check:style-pack` đang giữ (cặp font có thật, layout hợp với nền trang…) mất
 * hiệu lực ngay lượt đầu, và mỗi dự án thành một phong cách không ai kiểm được.
 *
 * Nên kết quả ở đây là một cụm SỐ ĐÈ LÊN, kẹp trong biên an toàn, và chỉ đụng
 * đúng những trục liều lượng.
 *
 * ## Vì sao phải kẹp
 *
 * Người dùng gõ "b-roll 100%" là thật lòng, nhưng dựng ra video không còn mặt
 * người thì đó không phải thứ họ muốn — họ muốn *nhiều hơn*. Kẹp là cách tôn
 * trọng ý mà không tôn trọng con số.
 */

/** Trục liều lượng mà chỉ thị được phép đụng tới. */
export type StyleOverrides = {
  /** Giây một lần chèn tư liệu. Nhỏ = dày. */
  brollEverySec?: number;
  /** Tỉ lệ chỗ nối được đánh dấu, 0–1. Cao = cắt gắt. */
  junctionShare?: number;
};

/**
 * Biên an toàn.
 *
 * `brollEverySec` sàn 4 giây: dày hơn nữa thì mỗi chèn không đủ 2 giây sống (còn
 * phải trừ khoảng cách tối thiểu giữa hai chèn), và phim thành đèn nháy.
 * Trần 30 giây: thưa hơn thế thì tư liệu người dùng đưa vào gần như không lên
 * hình, mà họ đưa vào là để nó lên.
 */
const CLAMP = {
  brollEverySec: [4, 30] as const,
  junctionShare: [0, 1] as const,
};

const clamp = (value: number, [lo, hi]: readonly [number, number]) =>
  Math.min(hi, Math.max(lo, value));

const SCHEMA = object({
  brollEverySec: { type: ["number", "null"] },
  junctionShare: { type: ["number", "null"] },
});

const INSTRUCTIONS = `Bạn đọc CHỈ THỊ DỰNG của người dùng cho một video nói tiếng
Việt, rồi quy nó thành hai con số. Trả \`null\` cho con số nào chỉ thị KHÔNG nhắc
tới — đừng đoán, vì trả bừa là ghi đè lên lựa chọn phong cách của họ.

brollEverySec — bao nhiêu GIÂY một lần chèn tư liệu (ảnh/clip minh hoạ):
- "b-roll thật dày", "che mặt tôi nhiều", "gần như toàn hình minh hoạ" → 4-6
- "nhiều hình minh hoạ" → 7-9
- mức thường → 10-14
- "ít hình thôi", "để tôi nói là chính", "đừng che mặt tôi" → 18-30

junctionShare — bao nhiêu PHẦN chỗ nối được đánh dấu bằng hiệu ứng, từ 0 đến 1:
- "cắt gắt", "nhịp nhanh", "kiểu quảng cáo" → 0.85-1
- mức thường → 0.6-0.8
- "êm", "chậm rãi", "kể chuyện", "đừng giật" → 0.2-0.5

Chỉ thị nói về thứ khác (tên riêng, nội dung, màu, font) thì trả null cả hai:
những thứ ấy do bước khác lo.`;

/**
 * Dịch chỉ thị của một dự án rồi LƯU kết quả.
 *
 * Gọi khi chỉ thị đổi, không gọi lúc đọc bộ dáng — đọc bộ dáng xảy ra hàng chục
 * lần mỗi lượt dựng. Không có khoá mô hình thì bỏ qua: dự án vẫn chạy bằng đúng
 * bộ dáng đã chọn, chỉ là không có phần chỉnh liều.
 */
export async function refreshStyleOverrides(projectId: string): Promise<void> {
  const row = db
    .prepare("SELECT directive FROM projects WHERE id=?")
    .get(projectId) as { directive: string | null } | undefined;
  const directive = row?.directive?.trim();
  if (!directive) {
    db.prepare("UPDATE projects SET style_overrides=NULL WHERE id=?").run(projectId);
    return;
  }
  if (!hasModel()) return;

  try {
    const out = await ask<{
      brollEverySec: number | null;
      junctionShare: number | null;
    }>({
      instructions: INSTRUCTIONS,
      input: directive,
      schemaName: "style_overrides",
      schema: SCHEMA,
    });
    const overrides: StyleOverrides = {};
    if (typeof out.brollEverySec === "number")
      overrides.brollEverySec = clamp(out.brollEverySec, CLAMP.brollEverySec);
    if (typeof out.junctionShare === "number")
      overrides.junctionShare = clamp(out.junctionShare, CLAMP.junctionShare);
    db.prepare("UPDATE projects SET style_overrides=? WHERE id=?").run(
      Object.keys(overrides).length > 0 ? JSON.stringify(overrides) : null,
      projectId,
    );
  } catch {
    /* Dịch hỏng thì giữ nguyên cái đang có — thà thiếu phần chỉnh liều còn hơn
       xoá mất cụm số đang dùng được. */
  }
}

/** Đọc cụm số đã lưu. JSON hỏng = coi như không có. */
export function readStyleOverrides(projectId: string): StyleOverrides | null {
  const row = db
    .prepare("SELECT style_overrides FROM projects WHERE id=?")
    .get(projectId) as { style_overrides: string | null } | undefined;
  if (!row?.style_overrides) return null;
  try {
    return JSON.parse(row.style_overrides) as StyleOverrides;
  } catch {
    return null;
  }
}
