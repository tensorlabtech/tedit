import { db, newId } from "./db";
import { ask, object } from "./llm";
import { soundsAlike } from "./phonetic-distance";

/**
 * Sửa chỗ nghe nhầm trong bản chép lời, dựa vào CHỦ ĐỀ của cả bài.
 *
 * Whisper nghe từng đoạn ngắn nên không biết bài đang nói về cái gì. Từ mượn
 * tiếng Anh trong câu tiếng Việt là chỗ nó gãy nhiều nhất: "network" ra "nem
 * quốc", "dev" ra "ép". Đọc riêng một câu thì không cách nào biết; đọc cả bài
 * rồi thấy chủ đề là lập công ty phần mềm thì "nem quốc ổn định" lộ ra ngay.
 *
 * SỬA chứ không CẮT. Bản trước tôi cho `ai-cuts` bỏ hẳn những câu chép hỏng —
 * mất luôn nội dung thật chỉ vì máy nghe sai. Chặng này chạy TRƯỚC nên tới lượt
 * cắt thì phần lớn "câu vô nghĩa" đã thành câu có nghĩa.
 *
 * Mốc thời gian là thứ KHÔNG được đụng vào: mọi phần tử neo vào từ, và cả dải
 * hình lẫn phụ đề đều đọc mốc từ đó.
 */

/** Sửa quá nhiều là dấu hiệu mô hình đang viết lại bài, không phải sửa lỗi nghe. */
const MAX_SHARE = 0.15;
/**
 * Chạy lại mấy lượt.
 *
 * Sửa lời là việc LẶP: mỗi chỗ sửa được lại làm chủ đề rõ thêm, và chỗ sai kế
 * tiếp mới lộ ra. Đo thật trên một clip: lượt đầu chủ đề còn là "khởi nghiệp
 * phần mềm" nên "nem quốc" trôi qua; sửa xong "ép" thành "dev" thì chủ đề sắc
 * lại thành "từ dev thành CEO", và lượt sau nó nhận ra ngay "network".
 *
 * Dừng khi một lượt không sửa được gì nữa, nên phần lớn video chỉ tốn hai lượt.
 */
const MAX_ROUNDS = 3;

/**
 * Bản sửa được phép DÀI HƠN gốc nhiều nhất ngần này từ.
 *
 * Máy nghe gộp cả một cụm tiếng Anh thành MỘT từ tiếng Việt vô nghĩa — đo thật:
 * "frontend dev" chép ra "Fanandef". Đó chính là ca mô-đun này sinh ra để sửa,
 * mà luật cũ "không được nhiều từ hơn gốc" lại chặn đúng nó: một từ không bao
 * giờ sửa được thành hai.
 *
 * Mốc thời gian cho từ mới chia theo SỐ CHỮ CÁI trong khoảng của cụm gốc. Không
 * phải mốc thật, nhưng cụm gốc chỉ dài vài phần mười giây nên sai số nằm dưới
 * ngưỡng thấy được, và phụ đề vẫn hiện đúng lúc người ta nói tới.
 *
 * Trần đặt ở hai: quá đó thì không còn là một cụm nghe nhầm nữa mà là mô hình
 * đang viết thêm lời.
 */
const MAX_TACH = 2;

type Word = {
  id: string;
  text: string;
  start_sec: number;
  end_sec: number;
  sentence_id: string;
  position: number;
};

type Proposal = {
  topic: string;
  fixes: Array<{ fromWordId: string; toWordId: string; text: string }>;
};

const SCHEMA = object({
  topic: { type: "string" },
  fixes: {
    type: "array",
    items: object({
      fromWordId: { type: "string" },
      toWordId: { type: "string" },
      text: { type: "string" },
    }),
  },
});

const INSTRUCTIONS = `Bạn sửa lỗi NGHE NHẦM trong bản chép lời tiếng Việt do máy tạo ra.

Bước 1 — đọc cả bài, xác định chủ đề và lĩnh vực (trả về ở "topic").
Bước 2 — đọc lại, tìm chỗ máy nghe sai, dựa vào chủ đề vừa xác định.

Chỗ hay sai nhất là TỪ MƯỢN TIẾNG ANH bị nghe thành tiếng Việt nghe na ná:
máy chép ra một cụm tiếng Việt vô nghĩa hoặc lạc lõng, trong khi đọc theo chủ đề
thì rõ ràng người nói đang dùng một thuật ngữ quen thuộc của lĩnh vực đó.
Ngoài ra: tên riêng, tên sản phẩm, số liệu, từ chuyên môn.

Trả về đoạn thay thế cho từng chỗ (mã từ đầu, mã từ cuối, chữ đúng).

CHỈ sửa khi bạn CHẮC nhờ ngữ cảnh. Không chắc thì bỏ qua — chép sai còn đoán ra
được, chứ sửa sai thành một từ khác hẳn thì người xem không có đường nào biết.
KHÔNG viết lại cho hay hơn, KHÔNG sửa ngữ pháp, KHÔNG rút gọn. Chỉ sửa đúng chỗ
máy nghe nhầm.
Tên riêng thì lấy ĐÚNG cách viết trong phần tự giới thiệu, đừng đoán theo cảm giác
"tên này nghe hợp lý hơn".
Chữ thay thế được dài hơn đoạn gốc NHIỀU NHẤT 2 từ. Máy nghe hay gộp cả một cụm
tiếng Anh thành một từ vô nghĩa, nên tách ra là đúng — nhưng tách xong phải vẫn
là đúng cụm người ta đã nói, không thêm chữ cho câu xuôi tai.`;

export async function fixTranscript(projectId: string): Promise<{
  fixed: number;
  rejected: number;
  rounds: number;
  /**
   * Đã hết chỗ sai, hay chỉ là hết lượt.
   *
   * Không có cờ này thì `rounds: 3` đọc ra hai nghĩa trái ngược nhau — "soát ba
   * lượt cho chắc" và "đụng trần, có thể còn sót" — mà chỉ nghĩa thứ hai mới
   * đáng phải làm gì đó.
   */
  settled: boolean;
  topic: string;
}> {
  let fixed = 0;
  let rejected = 0;
  let topic = "";
  let rounds = 0;
  let settled = false;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const pass = await fixOnce(projectId);
    rounds = round + 1;
    fixed += pass.fixed;
    rejected += pass.rejected;
    if (pass.topic) topic = pass.topic;
    if (pass.fixed === 0) {
      settled = true;
      break;
    }
  }
  return { fixed, rejected, rounds, settled, topic };
}

async function fixOnce(projectId: string): Promise<{
  fixed: number;
  rejected: number;
  topic: string;
}> {
  const words = db
    .prepare(
      "SELECT id, text, start_sec, end_sec, sentence_id, position FROM words WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Word[];
  if (words.length < 20) return { fixed: 0, rejected: 0, topic: "" };

  /**
   * Hồ sơ người dùng tự khai — nguồn ĐÁNG TIN NHẤT cho tên riêng.
   *
   * Không đưa vào thì mô hình đoán theo lối "công ty công nghệ chắc tên là
   * Tensor Lab". Đo thật: hồ sơ ghi rõ "tên Tensolab" mà chặng này vẫn sửa
   * thành "Tensor Lab" — vì nó chưa từng được đọc hồ sơ, chỉ máy nghe mới đọc.
   */
  const profile = (
    db.prepare("SELECT profile FROM projects WHERE id=?").get(projectId) as
      { profile: string | null } | undefined
  )?.profile?.trim();

  const proposal = await ask<Proposal>({
    instructions: INSTRUCTIONS,
    input:
      (profile
        ? `Người nói tự giới thiệu (tin theo đây, nhất là TÊN RIÊNG):\n${profile}\n\n`
        : "") +
      `Toàn văn:\n${words.map((word) => word.text).join(" ")}\n\n` +
      `Từng từ (thứ tự|mã|chữ):\n` +
      words.map((word, at) => `${at}|${word.id}|${word.text}`).join("\n"),
    schemaName: "transcript_fixes",
    schema: SCHEMA,
    /**
     * Hạ mức suy luận — chặng này từng chiếm quá nửa cả lượt dựng.
     *
     * Đo trên một bản chép 221 từ, cùng mô hình, cùng dữ liệu: để mặc định thì
     * 48,6 giây một lượt và mô hình đốt 3.904 token chỉ để nghĩ; `low` còn 24,9
     * giây với 1.600 token, mà vẫn đề xuất đúng chừng ấy chỗ sửa. Chặng chạy hai
     * lượt nên người dùng ngồi chờ gần ba phút, giờ còn khoảng năm mươi giây.
     *
     * Không xuống `minimal` (3,6 giây, 0 token suy luận): ở mức đó nó đề xuất 4
     * chỗ sửa trên một bản chép ĐÃ ĐÚNG, tức là bắt đầu sờ vào chữ không cần sửa.
     * `soundsAlike` chặn được phần lớn, nhưng chặng này viết lại lời của người ta
     * nên thà chậm hơn hai mươi giây còn hơn đổi lấy một cú sửa sai không ai thấy.
     */
    effort: "low",
  });

  const index = new Map(words.map((word, at) => [word.id, at]));
  // Từ nào đang là MÉP của một phần tử thì không được xoá: phần tử neo vào mã
  // từ, mất mép là phần tử mồ côi và biến khỏi bản dựng mà không ai báo.
  const meps = db
    .prepare("SELECT from_word_id, to_word_id FROM elements WHERE project_id=?")
    .all(projectId) as Array<{
    from_word_id: string | null;
    to_word_id: string | null;
  }>;
  const anchors = new Set(
    meps.flatMap((row) => [row.from_word_id, row.to_word_id].filter(Boolean)),
  );
  // Riêng mép CUỐI: chỉ chỗ này mới chặn phép tách. Xem lý do ở nơi dùng.
  const endAnchors = new Set(meps.map((row) => row.to_word_id).filter(Boolean));

  const setText = db.prepare("UPDATE words SET text=? WHERE id=?");
  const stretch = db.prepare("UPDATE words SET end_sec=? WHERE id=?");
  const drop = db.prepare("DELETE FROM words WHERE id=?");
  const retime = db.prepare("UPDATE words SET start_sec=?, end_sec=? WHERE id=?");
  const shift = db.prepare(
    "UPDATE words SET position=position+? WHERE sentence_id=? AND position>?",
  );
  const insertWord = db.prepare(
    "INSERT INTO words (id, project_id, sentence_id, position, text, start_sec, end_sec) VALUES (?,?,?,?,?,?,?)",
  );

  let budget = Math.max(1, Math.floor(words.length * MAX_SHARE));
  let fixed = 0;
  let rejected = 0;

  db.transaction(() => {
    for (const fix of proposal.fixes) {
      const from = index.get(fix.fromWordId);
      const to = index.get(fix.toWordId);
      const next = fix.text.trim().split(/\s+/).filter(Boolean);
      if (from === undefined || to === undefined || to < from || budget <= 0) {
        rejected += 1;
        continue;
      }
      const inside = words.slice(from, to + 1);
      if (next.length === 0 || next.length > inside.length + MAX_TACH) {
        rejected += 1;
        continue;
      }
      // Sửa ĐÚNG thì bản mới phải NGHE giống bản cũ. Mô hình thấy câu đọc lên
      // hơi lạ là hay viết lại thành câu xuôi tai hơn nhưng chẳng liên quan gì
      // tới thứ người ta đã nói — tài liệu gọi đó là *over-correction*, và đây
      // là luật chặn nó.
      if (!soundsAlike(inside.map((w) => w.text).join(" "), next.join(" "))) {
        rejected += 1;
        continue;
      }
      const extras = inside.slice(next.length);
      if (extras.some((word) => anchors.has(word.id))) {
        rejected += 1;
        continue;
      }
      /*
       * Tách thì từ CUỐI của cụm gốc không được là mép CUỐI của phần tử nào.
       *
       * Từ mới chèn vào SAU từ cuối ấy. Phần tử nào dừng ở đó thì sau khi tách
       * nó dừng ở "frontend" và bỏ rơi "dev" — phụ đề thiếu chữ mà không chỗ
       * nào báo. Mép ĐẦU thì ngược lại, không sao: hàng đầu giữ nguyên mã, và
       * phần chèn thêm nằm gọn bên trong khoảng của phần tử.
       */
      const themVao = next.length - inside.length;
      if (themVao > 0 && endAnchors.has(inside.at(-1)!.id)) {
        rejected += 1;
        continue;
      }

      next.slice(0, inside.length).forEach((text, at) => setText.run(text, inside[at].id));
      // Gộp phần dư vào từ cuối còn lại: đoạn tiếng vẫn kéo dài bấy nhiêu, chỉ
      // là giờ nó thuộc về một từ thay vì hai.
      if (extras.length > 0) {
        stretch.run(extras.at(-1)!.end_sec, inside[next.length - 1].id);
        for (const word of extras) drop.run(word.id);
      }
      if (themVao > 0) {
        /*
         * Chia khoảng của CẢ cụm theo số chữ cái, không chia đều: "frontend"
         * dài gấp đôi "dev" nên nó cũng chiếm chừng gấp đôi thời gian đọc.
         */
        const dau = inside[0].start_sec;
        const cuoi = inside.at(-1)!.end_sec;
        const tongChu = next.reduce((sum, text) => sum + text.length, 0);
        let moc = dau;
        const bien = next.map((text) => {
          const tu = moc;
          moc += ((cuoi - dau) * text.length) / tongChu;
          return { text, start: tu, end: moc };
        });
        // Từ cuối lấy đúng mép gốc, không lấy mốc vừa cộng dồn: cộng dồn số
        // thực để lại vài phần triệu giây lệch, mà mép này là chỗ phần tử kế
        // tiếp nối vào.
        bien.at(-1)!.end = cuoi;

        inside.forEach((word, at) => retime.run(bien[at].start, bien[at].end, word.id));
        // Dời chỗ cho từ mới TRƯỚC khi chèn, nếu không hai từ trùng số thứ tự
        // trong câu và thứ tự đọc ra thành tuỳ bảng trả về.
        const chot = inside.at(-1)!;
        shift.run(themVao, chot.sentence_id, chot.position);
        bien.slice(inside.length).forEach((phan, at) => {
          insertWord.run(
            newId("w"),
            projectId,
            chot.sentence_id,
            chot.position + 1 + at,
            phan.text,
            phan.start,
            phan.end,
          );
        });
      }
      budget -= 1;
      fixed += 1;
    }
  })();

  return { fixed, rejected, topic: proposal.topic };
}
