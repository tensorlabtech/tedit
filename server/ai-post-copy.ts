import { voiBoiCanh } from "./ai-context";
import { db } from "./db";
import { ask, object } from "./llm";

/**
 * Viết sẵn LỜI ĐĂNG BÀI: tiêu đề, mô tả, thẻ tìm kiếm.
 *
 * Dựng xong video mới là nửa việc. Nửa còn lại — nghĩ tiêu đề, viết mô tả, chọn
 * thẻ — là chỗ người không chuyên tắc lâu nhất, và tắc ở đúng lúc video đã sẵn
 * sàng nên chẳng còn hứng nữa. Bản chép lời thì đã nằm sẵn trong máy.
 *
 * Đây là GỢI Ý, luôn sửa được, và ba tiêu đề chứ không một: máy không biết kênh
 * này nói với ai. Nó chỉ đọc được lời và rút ra thứ đáng nói trước.
 *
 * Chạy khi người dùng bấm, không chạy trong mạch dựng: không phải ai cũng cần,
 * và mỗi lượt gọi là tiền thật.
 */

export type PostCopy = {
  titles: string[];
  description: string;
  hashtags: string[];
};

const SCHEMA = object({
  titles: { type: "array", items: { type: "string" } },
  description: { type: "string" },
  hashtags: { type: "array", items: { type: "string" } },
});

const INSTRUCTIONS = `Bạn viết lời đăng bài cho một video ngắn tiếng Việt, để đăng
lên TikTok, Reels hoặc YouTube Shorts.

Bạn được đọc bản chép lời của cả video.

TIÊU ĐỀ — viết 3 cái, mỗi cái dưới 60 ký tự:
- nói bằng chính giọng và chính chữ của người trong video
- nêu thẳng thứ đáng xem nhất, KHÔNG rào đón, không "hôm nay mình sẽ chia sẻ"
- KHÔNG hứa điều video không nói tới, KHÔNG giật tít quá thứ thật sự có trong lời
- ba cái phải khác nhau về CÁCH VÀO: một nêu kết quả, một nêu vấn đề, một nêu chi
  tiết hoặc con số cụ thể nhất có trong lời

MÔ TẢ — 2 tới 4 câu:
- kể video nói về gì, bằng giọng người nói chứ không phải giọng quảng cáo
- câu đầu phải đứng được một mình, vì các nền tảng cắt phần sau đi

THẺ — 5 tới 8 cái, viết không dấu cách, KHÔNG kèm dấu thăng:
- bám vào nội dung thật của video
- trộn thẻ rộng (nhiều người tìm) với thẻ hẹp (đúng chủ đề này)
- KHÔNG nhồi thẻ chỏi nội dung chỉ vì nó đang thịnh

Viết tiếng Việt có dấu. Nếu lời trong video quá ngắn hoặc không rõ nói về gì, cứ
viết ngắn theo đúng chừng ấy chứ đừng bịa thêm nội dung.`;

export async function writePostCopy(projectId: string): Promise<PostCopy | null> {
  const sentences = db
    .prepare(
      "SELECT text FROM sentences WHERE project_id=? AND removed=0 ORDER BY position",
    )
    .all(projectId) as Array<{ text: string }>;
  if (sentences.length === 0) return null;

  const proposal = await ask<PostCopy>({
    instructions: voiBoiCanh(INSTRUCTIONS, projectId),
    input: sentences.map((row) => row.text).join(" "),
    schemaName: "post_copy",
    schema: SCHEMA,
  });

  const titles = (proposal.titles ?? [])
    .map((line) => String(line).trim())
    .filter(Boolean)
    .slice(0, 3);
  if (titles.length === 0) return null;

  return {
    titles,
    description: String(proposal.description ?? "").trim(),
    // Bỏ dấu thăng nếu mô hình vẫn thêm vào: chỗ dán thẻ ở mỗi nền tảng một
    // khác, có nơi tự thêm — dán vào thành "##tag" thì thẻ hỏng mà nhìn qua
    // không thấy sai.
    hashtags: (proposal.hashtags ?? [])
      .map((tag) => String(tag).trim().replace(/^#+/, ""))
      .filter(Boolean)
      .slice(0, 8),
  };
}
