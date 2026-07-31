import { db } from "./db";
import { ask, object } from "./llm";

/**
 * Gợi ý CÂU MỞ ĐẦU cho video, dựa trên chính nội dung người dùng đã nói.
 *
 * Vì sao chỉ là GỢI Ý và luôn sửa được: máy không biết video này hay ở chỗ nào
 * với người xem của kênh đó. Nó chỉ đọc được bản chép lời và rút ra thứ đáng
 * nói trước — phần quyết định vẫn là người.
 *
 * Đây là tầng SAU. Thứ có tác dụng nhất ở màn "3 giây đầu" không phải AI viết
 * hộ, mà là bắt người dùng NGHE LẠI ba giây đầu của chính mình — gần như không
 * ai từng làm việc đó một cách có ý thức. Nút nghe thử chạy được mà không cần
 * tệp này.
 */

type Proposal = { lines: string[] };

const SCHEMA = object({
  lines: { type: "array", items: { type: "string" } },
});

const INSTRUCTIONS = `Bạn viết CÂU MỞ ĐẦU cho một video ngắn nói tiếng Việt.

Bạn được đọc bản chép lời của cả video. Viết 3 câu mở khác nhau, mỗi câu:
- dưới 12 tiếng, đọc hết trong khoảng 3 giây
- nói bằng chính giọng và chính chữ của người trong video, không trang trọng hơn
- nêu thẳng thứ đáng nghe nhất, không rào đón, không "hôm nay mình sẽ chia sẻ"
- KHÔNG hứa điều video không nói tới

Ba câu phải khác nhau về CÁCH VÀO, không phải khác nhau về cách diễn đạt cùng
một ý: một câu nêu kết quả, một câu nêu vấn đề, một câu nêu con số hoặc chi tiết
cụ thể nhất có trong lời.`;

/** Ba câu mở gợi ý. Mảng rỗng nghĩa là chưa có lời, hoặc không gọi được mô hình. */
export async function suggestOpeningLines(
  projectId: string,
): Promise<string[]> {
  const sentences = db
    .prepare(
      "SELECT text FROM sentences WHERE project_id=? AND removed=0 ORDER BY position",
    )
    .all(projectId) as Array<{ text: string }>;
  if (sentences.length === 0) return [];

  const proposal = await ask<Proposal>({
    instructions: INSTRUCTIONS,
    input: sentences.map((row) => row.text).join(" "),
    schemaName: "opening_lines",
    schema: SCHEMA,
  });

  return (proposal.lines ?? [])
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
}
