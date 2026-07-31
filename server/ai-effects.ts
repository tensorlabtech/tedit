import { db, newId } from "./db";
import { ask, object } from "./llm";
import { junctionHalves, normalizeJunction, type KeptRange } from "./render";
import { settingsForProject } from "./settings";

/**
 * Chọn kiểu hiệu ứng cho từng chỗ nối.
 *
 * Chỗ nối là chỗ hai đoạn dán vào nhau vì đã cắt mất phần ở giữa. Không đặt gì
 * thì chúng đều rơi về mặc định của dự án — cả video một kiểu, và đúng chỗ đáng
 * nhấn thì cũng nhấn y như chỗ chỉ nối cho liền.
 *
 * Chỉ ghi vào chỗ CHƯA ai đặt tay. Người dùng đã chọn thì đó là lựa chọn của họ.
 */

/**
 * MẬT ĐỘ mong muốn: trung bình bao nhiêu giây phim thì có một cú nhấn.
 *
 * Đếm theo THỜI GIAN chứ không theo phần trăm chỗ nối. Bản trước lấy "một nửa số
 * chỗ nối", mà số chỗ nối phụ thuộc vào chặng cắt lặng cắt được bao nhiêu — cùng
 * một video, lần cắt được nhiều thì đầy hiệu ứng, lần cắt được ít thì gần như
 * không có. Người xem không đếm chỗ nối, họ cảm nhận nhịp theo giây.
 *
 * Đây là con số NGƯỜI DÙNG chọn, không phải hằng số kỹ thuật — sau này lời dặn
 * của người dùng sẽ đặt lại nó (video toàn tư liệu chèn cần nhịp khác hẳn video
 * chỉ có mặt người nói).
 */
const SECONDS_PER_EFFECT = 10;
/** Hai hiệu ứng gần nhau quá thì đọc ra là giật, không phải nhịp. */
const MIN_GAP_SECONDS = 2.5;

type Proposal = {
  picks: Array<{ index: number; kind: string }>;
};

const SCHEMA = object({
  picks: {
    type: "array",
    items: object({
      index: { type: "integer" },
      kind: {
        type: "string",
        enum: ["zoom-in", "zoom-out", "flash", "dip"],
      },
    }),
  },
});

const INSTRUCTIONS = `Bạn chọn hiệu ứng cho các chỗ nối trong một video nói tiếng Việt.

Mỗi chỗ nối là nơi đã cắt mất một quãng, hai bên dán lại. Bạn được xem lời NGAY
TRƯỚC và NGAY SAU chỗ nối đó.

Chọn theo mạch chuyển:
- zoom-in: sau chỗ nối là ý mạnh hơn, dồn hơn, đáng chú ý hơn
- zoom-out: sau chỗ nối là hạ nhịp, kết đoạn, lùi lại nhìn rộng
- flash: chuyển ý đột ngột, tương phản hẳn với vế trước
- dip: chuyển hẳn sang chủ đề khác, như sang một chương mới

Bạn được cho một SỐ LƯỢNG cần nhắm. Chọn đúng chừng ấy chỗ ĐỔI MẠCH RÕ NHẤT —
không rải đều cho đủ số, cũng đừng dè dặt trả về một hai cái rồi thôi. Thiếu chỗ
xứng đáng thì trả ít hơn, nhưng phải là vì đọc hết rồi mà không có, chứ không
phải vì ngại chọn.`;

/**
 * `kept` do NƠI GỌI truyền vào, không tự đi lấy.
 *
 * `keptRanges` nằm trong `pipeline.ts`, mà `pipeline.ts` lại gọi hàm này — tự
 * lấy là thành vòng import. Nơi gọi vốn đã có sẵn danh sách ấy.
 */
export async function pickEffects(
  projectId: string,
  kept: KeptRange[],
): Promise<{ applied: number; rejected: number }> {
  if (kept.length < 2) return { applied: 0, rejected: 0 };

  const words = db
    .prepare(
      "SELECT text, start_sec, end_sec FROM words WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Array<{
    text: string;
    start_sec: number;
    end_sec: number;
  }>;

  /** Vài từ sát một mốc, để mô hình biết chỗ nối này đang ở giữa câu nào. */
  const around = (at: number, side: "before" | "after") =>
    (side === "before"
      ? words.filter((word) => word.end_sec <= at + 0.01).slice(-8)
      : words.filter((word) => word.start_sec >= at - 0.01).slice(0, 8)
    )
      .map((word) => word.text)
      .join(" ");

  const joins = kept.slice(0, -1).map((range, index) => ({
    index,
    cut: range.end,
    resume: kept[index + 1].start,
    before: around(range.end, "before"),
    after: around(kept[index + 1].start, "after"),
    // Chỗ TRỐNG hai bên mối nối — bao nhiêu giây còn vào video nằm sát nó.
    //
    // Cần vì hai nửa của cú nhấn phải nằm TRONG phần giữ lại. Đoạn giữ trước
    // mối nối chỉ dài 0,15 giây thì nửa "trước" 0,5 giây của một cú zoom nằm
    // phần lớn trong vùng đã bỏ: nó biến mất khỏi video, còn lại một vệt 0,1
    // giây trên dải. Đo trên một dự án thật: 4/5 cú nhấn mất từ 0,12 tới 0,50
    // giây theo đúng cách đó.
    roomBefore: range.end - range.start,
    roomAfter: kept[index + 1].end - kept[index + 1].start,
  }));

  const existing = db
    .prepare("SELECT start_sec, end_sec FROM effects WHERE project_id=?")
    .all(projectId) as Array<{ start_sec: number; end_sec: number }>;

  // Độ dài phim SẼ XUẤT RA, không phải độ dài bản gốc: mật độ nhịp là thứ người
  // xem cảm nhận trên bản đã cắt.
  const outputSeconds = kept.reduce(
    (total, range) => total + (range.end - range.start),
    0,
  );
  // Người dùng đặt lại được ở trang Cài đặt; thiếu thì rơi về con số mặc định.
  const nhip =
    settingsForProject(projectId).secondsPerEffect || SECONDS_PER_EFFECT;
  const want = Math.min(
    joins.length,
    Math.max(1, Math.round(outputSeconds / nhip)),
  );

  const proposal = await ask<Proposal>({
    instructions: INSTRUCTIONS,
    input:
      `Phim dài ${outputSeconds.toFixed(0)} giây. Nhắm khoảng ${want} chỗ.\n\n` +
      joins
        .map((join) => `${join.index}| …${join.before} ⟨CẮT⟩ ${join.after}…`)
        .join("\n"),
    schemaName: "effects",
    schema: SCHEMA,
  });

  const insert = db.prepare(
    "INSERT INTO effects (id, project_id, start_sec, end_sec, kind) VALUES (?,?,?,?,?)",
  );
  // Trần rộng hơn số nhắm một chút: mô hình chọn hơi quá tay thì `MIN_GAP_SECONDS`
  // và phép chặn chồng nhau đã lọc rồi, còn siết đúng bằng `want` thì mấy cú bị
  // lọc kia không có gì bù vào và kết quả luôn thấp hơn mức mong muốn.
  let budget = Math.min(joins.length, want + 2);
  const taken = existing.map((row) => ({
    start: row.start_sec,
    end: row.end_sec,
  }));
  let applied = 0;
  let rejected = 0;

  db.transaction(() => {
    for (const pick of proposal.picks) {
      const join = joins[pick.index];
      if (!join || budget <= 0) {
        rejected += 1;
        continue;
      }
      const [before, after] = junctionHalves(normalizeJunction(pick.kind));
      // Không đủ chỗ cho CẢ HAI nửa thì bỏ mối nối này, không đặt một cú nhấn
      // cụt. Một cú zoom 0,65 giây nhồi vào một đoạn giữ 0,15 giây thì trên
      // video nó chỉ là một cái giật không ai đọc ra là chủ ý — mà budget lại
      // mất một suất cho nó.
      if (join.roomBefore < before || join.roomAfter < after) {
        rejected += 1;
        continue;
      }
      // Quãng vắt QUA vết cắt: nửa trước nằm ở đoạn trước, nửa sau ở đoạn sau.
      // Đặt gọn một bên thì đỉnh xung không rơi đúng chỗ nối.
      const start = Math.max(0, join.cut - before);
      const end = join.resume + after;
      if (
        taken.some(
          (item) =>
            start < item.end + MIN_GAP_SECONDS &&
            item.start - MIN_GAP_SECONDS < end,
        )
      ) {
        rejected += 1;
        continue;
      }
      insert.run(newId("eff"), projectId, start, end, pick.kind);
      taken.push({ start, end });
      budget -= 1;
      applied += 1;
    }
  })();

  return { applied, rejected };
}
