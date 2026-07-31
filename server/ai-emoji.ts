import { voiBoiCanh } from "./ai-context";
import { db } from "./db";
import { EMOJI_VOCAB, emojiMenu, isKnownEmoji } from "./emoji-vocab";
import { ask, object } from "./llm";
import { readStylePack } from "./style-pack-store";

/**
 * Gắn emoji cho một số ít cụm phụ đề.
 *
 * Cùng kỷ luật với `ai-keywords.ts`, và vì cùng một lý do: emoji chỉ có nghĩa
 * khi HIẾM. Gắn đều tay thì mắt hết chỗ dừng và video đọc ra như một dãy nhãn
 * dán — nên trần `pack.emoji.share` không phải phòng xa, nó là chính cái làm
 * việc này có tác dụng.
 *
 * Bộ dáng để `emoji: null` thì chặng này KHÔNG chạy: ba bộ nhóm "Gọn" bán đúng
 * cái khoảng thở mà emoji phá.
 */

type Row = { id: string; content: string | null };

type Proposal = { picks: Array<{ id: string; emoji: string }> };

const SCHEMA = object({
  picks: {
    type: "array",
    items: object({
      id: { type: "string" },
      // Không dùng `enum` ở lược đồ: danh sách 36 hình lặp trong lược đồ làm
      // phình lời nhắc mà vẫn phải kiểm lại ở đây (mô hình trả hình lạ là
      // chuyện thường). Kiểm một chỗ, chỗ có thật.
      emoji: { type: "string" },
    }),
  },
});

const INSTRUCTIONS = `Bạn gắn emoji cho phụ đề video tiếng Việt.

Mỗi dòng là một cụm phụ đề hiện lên màn hình. Chọn cụm có một hình ảnh RÕ RÀNG
bật ra từ nội dung, rồi gắn đúng MỘT emoji.

CHỈ được dùng emoji trong danh sách dưới đây, chép đúng ký tự:

${emojiMenu()}

Phần lớn cụm KHÔNG cần emoji — chỉ gắn khi hình đó thật sự nói thêm được điều gì.
Cụm chỉ có từ nối, từ đệm, hoặc nội dung chung chung thì bỏ qua.
KHÔNG gắn cho hai cụm liền nhau.
KHÔNG lặp lại một emoji quá hai lần trong cả video.
Cụm không cần gì thì đừng đưa vào kết quả.`;

/**
 * Số cụm tối thiểu mới chạy. Video quá ngắn thì mọi tỉ lệ đều ra một hai cụm,
 * và một cái emoji lẻ giữa video ngắn đọc ra như lỗi chứ không như thiết kế.
 */
const MIN_GROUPS = 8;

export async function pickEmoji(projectId: string): Promise<{
  applied: number;
  rejected: number;
}> {
  const pack = readStylePack(projectId);
  if (!pack.emoji) return { applied: 0, rejected: 0 };

  const rows = db
    .prepare(
      `SELECT id, content FROM elements
       WHERE project_id=? AND kind='text'
         AND (emoji IS NULL OR emoji='')
         AND content IS NOT NULL AND content<>''
       ORDER BY rowid`,
    )
    .all(projectId) as Row[];
  if (rows.length < MIN_GROUPS) return { applied: 0, rejected: 0 };

  const proposal = await ask<Proposal>({
    instructions: voiBoiCanh(INSTRUCTIONS, projectId),
    input: rows.map((row) => `${row.id}|${row.content}`).join("\n"),
    schemaName: "emoji",
    cheap: true,
    schema: SCHEMA,
  });

  const order = new Map(rows.map((row, index) => [row.id, index]));
  const update = db.prepare("UPDATE elements SET emoji=? WHERE id=?");
  let budget = Math.max(1, Math.floor(rows.length * pack.emoji.share));
  let applied = 0;
  let rejected = 0;
  // Chỉ số cụm vừa gắn, để giữ luật "không hai cụm liền nhau". Mô hình được
  // dặn rồi nhưng dặn không phải là bảo đảm — mà hai emoji cạnh nhau thì lộ
  // ngay, khác hẳn mấy lỗi chỉ người soi mới thấy.
  let lastIndex = -2;
  const used = new Map<string, number>();

  db.transaction(() => {
    for (const pick of proposal.picks) {
      const index = order.get(pick.id);
      if (index === undefined || budget <= 0) {
        rejected += 1;
        continue;
      }
      // Ngoài vốn từ là không có tệp ảnh để dán — cụm đó sẽ im lặng mất emoji ở
      // khâu vẽ mà không chỗ nào báo. Chặn ngay tại đây.
      if (!isKnownEmoji(pick.emoji)) {
        rejected += 1;
        continue;
      }
      if (index - lastIndex < 2) {
        rejected += 1;
        continue;
      }
      const seen = used.get(pick.emoji) ?? 0;
      if (seen >= 2) {
        rejected += 1;
        continue;
      }
      update.run(pick.emoji, pick.id);
      used.set(pick.emoji, seen + 1);
      lastIndex = index;
      budget -= 1;
      applied += 1;
    }
  })();

  return { applied, rejected };
}

/** Cho phép kiểm tra vốn từ ở bộ kiểm mà không phải mở tệp dữ liệu. */
export const EMOJI_COUNT = EMOJI_VOCAB.length;
