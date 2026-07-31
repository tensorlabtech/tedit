import { db } from "./db";
import { ask, object } from "./llm";

/**
 * Chọn từ đáng nhấn trong từng cụm phụ đề.
 *
 * Nhấn là thứ chỉ có nghĩa khi HIẾM. Nhấn đều tay mọi cụm thì mắt không còn
 * chỗ nào để dừng lại, và kết quả đọc ra y như không nhấn gì — nên trần
 * `MAX_SHARE` ở dưới không phải phòng xa, nó là chính cái làm việc này có tác
 * dụng.
 *
 * Chỉ chạm vào cụm CHƯA ai đánh dấu: người dùng đã chọn tay thì đó là lựa chọn
 * của họ, không phải chỗ để sửa lưng.
 */

/** Nhiều nhất bao nhiêu phần trăm số cụm được có từ nhấn. */
const MAX_SHARE = 0.4;
/** Mỗi cụm nhiều nhất mấy từ — hai từ trở lên trong một cụm ngắn là nhấn cả cụm. */
const MAX_PER_GROUP = 2;

type Row = { id: string; content: string | null };

type Proposal = {
  picks: Array<{ id: string; keywords: string[] }>;
};

const SCHEMA = object({
  picks: {
    type: "array",
    items: object({
      id: { type: "string" },
      keywords: { type: "array", items: { type: "string" } },
    }),
  },
});

const INSTRUCTIONS = `Bạn chọn từ đáng nhấn cho phụ đề video tiếng Việt.

Mỗi dòng là một cụm phụ đề hiện lên màn hình. Chọn từ mang TIN MỚI của cụm —
con số, tên riêng, động từ quyết định, thứ người xem cần nhớ.

KHÔNG chọn: từ nối, đại từ, từ đệm, từ vừa nhấn ở cụm ngay trước.
KHÔNG chọn từ chỉ lượng chung chung: "một", "vài", "nhiều", "mấy", "các", "những".
Con số CÓ NGHĨA thì được ("30 tuổi", "3 tệp") — chỉ cấm từ đếm không mang tin.
Phần lớn cụm KHÔNG cần nhấn gì — chỉ chọn khi cụm đó thật sự có một từ nổi bật.
Chọn dàn trải cả video, đừng dồn hết vào một đoạn.

Từ trả về phải chép ĐÚNG NGUYÊN VĂN như trong cụm, không đổi dấu, không chia lại.
Cụm không có gì đáng nhấn thì đừng đưa vào kết quả.`;

export async function pickKeywords(projectId: string): Promise<{
  applied: number;
  rejected: number;
}> {
  const rows = db
    .prepare(
      `SELECT id, content FROM elements
       WHERE project_id=? AND kind='text'
         AND (keywords IS NULL OR keywords='')
         AND content IS NOT NULL AND content<>''
       ORDER BY rowid`,
    )
    .all(projectId) as Row[];
  if (rows.length < 5) return { applied: 0, rejected: 0 };

  const proposal = await ask<Proposal>({
    instructions: INSTRUCTIONS,
    input: rows.map((row) => `${row.id}|${row.content}`).join("\n"),
    schemaName: "keywords",
    // Việc này không cần suy luận sâu — dùng bậc mô hình rẻ.
    cheap: true,
    schema: SCHEMA,
  });

  const byId = new Map(rows.map((row) => [row.id, row.content ?? ""]));
  const update = db.prepare("UPDATE elements SET keywords=? WHERE id=?");
  let budget = Math.max(1, Math.floor(rows.length * MAX_SHARE));
  let applied = 0;
  let rejected = 0;

  db.transaction(() => {
    for (const pick of proposal.picks) {
      const content = byId.get(pick.id);
      if (content === undefined) {
        rejected += 1;
        continue;
      }
      if (budget <= 0) {
        rejected += 1;
        continue;
      }
      // Từ phải CÓ THẬT trong cụm. Mô hình chia lại từ hoặc bỏ dấu là chuyện
      // thường, mà lưu một từ không khớp thì khâu dựng chữ không tìm ra nó và
      // cụm ấy im lặng mất phần nhấn — không chỗ nào báo.
      const words = content.split(/\s+/);
      const valid = pick.keywords
        .filter((keyword) => words.includes(keyword))
        .slice(0, MAX_PER_GROUP);
      if (valid.length === 0) {
        rejected += 1;
        continue;
      }
      update.run(valid.join("|"), pick.id);
      budget -= 1;
      applied += 1;
    }
  })();

  return { applied, rejected };
}
