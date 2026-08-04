import { voiBoiCanh } from "./ai-context";
import { db } from "./db";
import { ask, object } from "./llm";
import { readStylePack } from "./style-pack-store";

/**
 * Chọn từ đáng nhấn trong từng cụm phụ đề.
 *
 * Nhấn là thứ chỉ có nghĩa khi HIẾM. Nhấn đều tay mọi cụm thì mắt không còn
 * chỗ nào để dừng lại, và kết quả đọc ra y như không nhấn gì — nên trần
 * Trần `intensity.keywordShare` không phải phòng xa, nó là chính cái làm việc này có tác
 * dụng.
 *
 * Chỉ chạm vào cụm CHƯA ai đánh dấu: người dùng đã chọn tay thì đó là lựa chọn
 * của họ, không phải chỗ để sửa lưng.
 */

/*
 * Hai con số này nay nằm trong bộ dáng (`intensity.keywordShare` và
 * `intensity.keywordsPerGroup`).
 *
 * Nhấn là thứ chỉ có nghĩa khi HIẾM, nên trần phần trăm không phải phòng xa —
 * nó là chính cái làm việc này có tác dụng. Nhưng "hiếm" tới mức nào thì tuỳ
 * phong cách: bộ nhịp nhanh nhấn dày hơn bộ tối giản, và trước đây mọi bộ đều
 * nhấn y như nhau.
 *
 * Trần MỖI CỤM cũng vậy: hai từ trở lên trong một cụm ngắn là nhấn cả cụm, mà
 * cụm ngắn đến đâu thì lại do `grouping` của chính bộ dáng quyết định.
 */

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
Chọn dàn trải cả video, đừng dồn hết vào một đoạn.

Từ trả về phải chép ĐÚNG NGUYÊN VĂN như trong cụm, không đổi dấu, không chia lại.
Cụm không có gì đáng nhấn thì đừng đưa vào kết quả.`;

/**
 * Câu nói TỈ LỆ NHẮM, ghép vào cuối chỉ dẫn.
 *
 * Bản trước chỉ dẫn viết cứng *"Phần lớn cụm KHÔNG cần nhấn gì"* trong khi bộ
 * dáng khai `keywordShare` tới 0,45 — hai câu trái nhau, và câu trong chỉ dẫn
 * thắng vì mô hình chỉ đọc được câu ấy. Đo ra: bộ khai 45% mà mô hình chỉ đề
 * xuất 32%, rồi qua phép khớp chỉ còn 5% cụm thật sự có nhấn.
 *
 * Trần `keywordShare` vẫn cắt ở phía code — mô hình quá tay thì bị chặn. Nhưng
 * giờ nó biết đích mình nhắm, thay vì bị bảo một đằng rồi bị đo bằng một nẻo.
 */
/** Bỏ dấu câu hai đầu, hạ về chữ thường — dạng để SO, không phải dạng để lưu. */
const norm = (value: string) =>
  value
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+/gu, "")
    .replace(/[^\p{L}\p{N}]+$/gu, "");

const nhamTiLe = (share: number) =>
  `\n\nNhắm khoảng ${Math.round(share * 100)}% số cụm có từ nhấn. Đây là NHỊP của video, ` +
  `không phải phần thưởng cho cụm hay nhất — thấp hơn nhiều thì video đọc ra đều đều một mạch, ` +
  `cao hơn nhiều thì không còn gì là nhấn nữa.`;

/**
 * Số lượt hỏi tối đa.
 *
 * Một lượt không bao giờ đủ. Đo trên một video 133 cụm với bộ khai 45%: lượt
 * đầu mô hình chỉ đề xuất 32% số cụm, và sau phép khớp còn 20%. Nó đọc cả bản
 * chép rồi chọn những chỗ nổi nhất — hỏi lại lần nữa, lần này chỉ đưa những cụm
 * CHƯA có nhấn, thì nó thấy được lớp nổi tiếp theo.
 *
 * Dừng sớm khi đã chạm tỉ lệ nhắm hoặc khi một lượt không thêm được gì. Ba là
 * trần cho ca bản chép quá nhạt, để khỏi hỏi mãi một câu không có câu trả lời.
 */
const MAX_ROUNDS = 3;

export async function pickKeywords(projectId: string): Promise<{
  applied: number;
  rejected: number;
  rounds: number;
}> {
  const { keywordShare } = readStylePack(projectId).intensity;
  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM elements
         WHERE project_id=? AND kind='text' AND content IS NOT NULL AND content<>''`,
      )
      .get(projectId) as { n: number }
  ).n;
  const target = Math.floor(total * keywordShare);

  let applied = 0;
  let rejected = 0;
  let rounds = 0;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    // Trần còn lại tính trên TỔNG số cụm, không tính trên số cụm chưa đánh dấu:
    // lượt sau chỉ thấy phần chưa đánh dấu, nên `floor(còn lại × tỉ lệ)` cộng
    // dồn qua ba lượt sẽ vượt xa tỉ lệ bộ dáng khai.
    const pass = await pickOnce(projectId, target - applied);
    rounds = round + 1;
    applied += pass.applied;
    rejected += pass.rejected;
    if (pass.applied === 0 || applied >= target) break;
  }
  return { applied, rejected, rounds };
}

async function pickOnce(
  projectId: string,
  /** Còn được đánh dấu bao nhiêu cụm nữa. */
  room: number,
): Promise<{
  applied: number;
  rejected: number;
}> {
  if (room <= 0) return { applied: 0, rejected: 0 };
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

  // Đọc bộ dáng TRƯỚC lượt hỏi: tỉ lệ nhắm phải đi vào chính chỉ dẫn, không
  // chỉ dùng để cắt phía sau.
  const { keywordsPerGroup } = readStylePack(projectId).intensity;
  // Tỉ lệ nói với mô hình là tỉ lệ trên PHẦN CÒN LẠI của lượt này — lượt hai
  // chỉ thấy những cụm lượt một đã bỏ qua, bảo nó nhắm 45% của cả video ở đó là
  // bảo một con số không có nghĩa với thứ nó đang nhìn.
  const share = Math.min(1, room / Math.max(1, rows.length));

  const proposal = await ask<Proposal>({
    instructions: voiBoiCanh(INSTRUCTIONS + nhamTiLe(share), projectId),
    /*
     * SỐ THỨ TỰ làm tay nắm, KHÔNG phải mã CSDL.
     *
     * Mã phần tử sinh từ `Date.now()` cộng số ngẫu nhiên, và mỗi lượt gieo lại
     * là xoá sạch phần tử chữ rồi tạo mới — nên dán mã vào lời nhắc là làm câu
     * hỏi khác đi ở mọi lượt chạy, dù bản chép không đổi một chữ.
     *
     * Đo được: bộ nhớ câu trả lời trúng 1/4, và cái trúng duy nhất là chặng
     * KHÔNG dán mã. Ba lượt hỏi từ nhấn trượt sạch.
     *
     * Mô hình không cần mã thật — nó chỉ cần một cái tay nắm để trỏ lại dòng
     * nào. Số thứ tự làm được đúng việc ấy và ổn định theo bản chép.
     */
    input: rows.map((row, at) => `${at}|${row.content}`).join("\n"),
    schemaName: "keywords",
    // Việc này không cần suy luận sâu — dùng bậc mô hình rẻ.
    cheap: true,
    schema: SCHEMA,
  });

  // Ánh xạ ngược theo SỐ THỨ TỰ — cùng thứ tự `ORDER BY rowid` đã gửi đi.
  const byHandle = new Map(rows.map((row, at) => [String(at), row]));
  const update = db.prepare("UPDATE elements SET keywords=? WHERE id=?");
  let budget = Math.max(1, Math.min(room, rows.length));
  let applied = 0;
  let rejected = 0;

  db.transaction(() => {
    for (const pick of proposal.picks) {
      const row = byHandle.get(pick.id);
      const content = row?.content ?? undefined;
      if (row === undefined || content === undefined) {
        rejected += 1;
        continue;
      }
      if (budget <= 0) {
        rejected += 1;
        continue;
      }
      /*
       * Khớp RỘNG TAY, không đòi chép y hệt.
       *
       * Luật cũ là `words.includes(keyword)` — bằng nhau từng ký tự. Đo trên
       * một video thật: mô hình đề xuất 43 cụm, chỉ 8 cụm khớp, **35 bị gạt**.
       * Ba kiểu trượt, không cái nào là lỗi của mô hình:
       *
       * · **Dấu câu** — nó trả "content" còn trong cụm là "content,".
       * · **Từ ghép bị cắt qua hai cụm** — nó trả "tương lai" mà cụm dứt ở
       *   "tương", vì phép chia cụm cắt ngang từ ghép. Tiếng Việt ghi rời từng
       *   tiếng nên chuyện này xảy ra liên tục.
       * · **Chữ hoa đầu câu** — "Mình" ở đầu cụm, "mình" ở giữa.
       *
       * Nên: bỏ dấu câu hai đầu, so không phân biệt hoa thường, và TÁCH từ ghép
       * ra từng tiếng rồi giữ những tiếng có mặt. Nhấn nửa từ ghép ở cụm này
       * rồi nửa kia ở cụm sau đọc ra liền mạch — chính vì phụ đề vốn đã cắt
       * ngang nó.
       *
       * Vẫn phải CÓ MẶT trong cụm: cái đó là bất biến thật, vì khâu dựng chữ
       * tìm từ nhấn bằng chuỗi. Chỉ bỏ phần khắt khe vô cớ.
       */
      const words = content.split(/\s+/).filter(Boolean);
      const byNorm = new Map<string, string>();
      for (const word of words) {
        const key = norm(word);
        if (key && !byNorm.has(key)) byNorm.set(key, word);
      }
      const seen = new Set<string>();
      const valid = pick.keywords
        .flatMap((keyword) => keyword.split(/\s+/))
        .map((piece) => byNorm.get(norm(piece)))
        .filter((word): word is string => {
          if (!word || seen.has(word)) return false;
          seen.add(word);
          return true;
        })
        .slice(0, keywordsPerGroup);
      if (valid.length === 0) {
        rejected += 1;
        continue;
      }
      // Ghi theo mã THẬT của hàng, không theo tay nắm gửi cho mô hình.
      update.run(valid.join("|"), row.id);
      budget -= 1;
      applied += 1;
    }
  })();

  return { applied, rejected };
}
