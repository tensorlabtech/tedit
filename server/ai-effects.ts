import { voiBoiCanh } from "./ai-context";
import { JUNCTION_SPECS } from "./junction-kinds";
import { db, newId } from "./db";
import { ask, object } from "./llm";
import {type KeptRange} from "./render";
import {junctionHalves, normalizeJunction} from "./junction-kinds";
import { settingsForProject } from "./settings";
import { readStylePack } from "./style-pack-store";

/**
 * Chọn hiệu ứng NHẤN cho các RANH GIỚI Ý của video.
 *
 * Ứng viên là ranh giới giữa các CÂU (không phải vết cắt). Buộc hiệu ứng vào vết
 * cắt là sai hai đường: (1) sau `commit-cut` vết cắt nướng vào phim, biến mất khỏi
 * dữ liệu — không còn mốc nào để đặt; (2) video quay MỘT MẠCH không cắt thì chẳng
 * có vết cắt nào, nên phẳng lì không nhịp. Ranh giới câu thì LUÔN có, rải khắp
 * video, và AI chọn những chỗ MỞ ĐOẠN Ý MỚI (chuyển chủ đề) để nhấn.
 *
 * Chỉ NHẤN (không "chuyển cảnh thật"): mạch liền không có khe để hoà tan hai cảnh.
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
/**
 * Cửa sổ PHÔ TRƯƠNG — dày hơn hẳn phần còn lại.
 *
 * Khớp `SHOWCASE_SECONDS` của `style-pack.ts`: viền quanh người và chuyển cảnh
 * phải dồn về CÙNG một cửa sổ, không thì hai thứ đập lệch nhau và phần đầu vừa
 * dày vừa lộn xộn.
 */
const SHOWCASE_SECONDS = 30;
/** Hai hiệu ứng gần nhau quá thì đọc ra là giật, không phải nhịp. */
const MIN_GAP_SECONDS = 2.5;
/** Cú nhấn ngắn hơn ngần này đọc ra là GIẬT — nới cho đủ nhìn (trong chỗ còn). */
const MIN_EFFECT = 0.45;
/**
 * `junctionShare` của bộ THAM CHIẾU — mốc để quy các bộ khác thành hệ số nhân.
 *
 * Bằng đúng số của bộ `Mộc`, bộ không có trục riêng nào và là chuẩn so sánh của
 * cả kho. Nhờ vậy `Mộc` giữ nguyên nhịp mà người dùng đặt, còn các bộ khác lệch
 * đi quanh nó: 0,25 thành một nửa, 0,8 thành gấp rưỡi.
 *
 * Sửa số này là dịch nhịp của CẢ MƯỜI bộ cùng lúc — nó là gốc toạ độ, không
 * phải một tham số chỉnh cho đẹp.
 */
const NHIP_GOC = 0.5;

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
        // CHỈ kiểu NHẤN (không có `cross`): ranh giới ý là một mạch nói liền, KHÔNG
        // có khe cắt để hoà tan hai cảnh, nên "chuyển cảnh thật" (cross-*) không
        // dựng được ở đây — bỏ khỏi lựa chọn để AI khỏi chọn thứ sẽ vỡ.
        enum: JUNCTION_SPECS.filter(
          (spec) => spec.id !== "none" && !spec.cross,
        ).map((spec) => spec.id),
      },
    }),
  },
});

const INSTRUCTIONS = `Bạn chọn hiệu ứng NHẤN cho các RANH GIỚI Ý trong một video nói tiếng Việt.

Video là một mạch nói liền. Mỗi ứng viên là ranh giới giữa hai CÂU; bạn được xem
lời NGAY TRƯỚC và NGAY SAU nó. Chỉ nhấn ở chỗ MỞ MỘT ĐOẠN Ý MỚI — chuyển chủ đề,
sang một bước kể mới, đổi mạch rõ rệt. KHÔNG nhấn giữa những câu CÙNG một ý.

Chọn theo mạch chuyển. Mỗi kiểu có một CẢM GIÁC riêng:

MẠNH — dùng cho chỗ đổi ý gắt, lên cao trào:
- punch: nảy một cái rất ngắn, nhấn mà không kéo dài
- zoom-blur: phóng kèm nhoè, cú nhấn mạnh nhất — dùng dè
- flash-hard: loé và đanh cùng lúc, hợp nhịp nhạc mạnh
- whip-left / whip-right / whip-up: khung lia một nhát, như máy quay hất đi

VỪA — dùng cho đổi ý bình thường:
- zoom-in: sau chỗ nối là ý mạnh hơn, dồn hơn, đáng chú ý hơn
- zoom-out: sau chỗ nối là hạ nhịp, kết đoạn, lùi lại nhìn rộng
- flash: chuyển ý đột ngột, tương phản hẳn với vế trước
- shake: rung một nhịp, nhấn mà không đổi khuôn hình
- tilt: nghiêng rồi thẳng lại, chệch nhịp một chút cho có duyên
- saturate: màu bừng lên, nhấn mà không đụng sáng tối

ÊM — dùng cho chuyển đoạn, hạ giọng, sang chương mới:
- dip: chuyển hẳn sang chủ đề khác, như sang một chương mới
- desaturate: xám đi một nhịp rồi có màu lại, hợp lúc hạ giọng
- vignette: bốn góc sụp tối rồi mở, dồn mắt vào giữa khung
- hue-shift: màu trượt sắc một nhát — cú nhiễu nhẹ, dùng rất dè
- push-in: phóng dần suốt cả đoạn rồi hạ về, dồn dần vào người nói — hợp đoạn
  kể chuyện, tâm sự, chỗ cần người xem nghiêng vào nghe
- drift: khung trôi chậm sang ngang — cứu một cảnh người nói ngồi yên không động
  đậy, chỗ hình tĩnh mà lời vẫn đang chạy

ĐỪNG dùng một kiểu quá hai lần trong cùng một video, trừ zoom-in và zoom-out.
Lặp một kiểu lạ ba bốn lần thì nó thành tật của video chứ không còn là điểm nhấn.
Và ĐỪNG rải kiểu MẠNH liên tiếp — mạnh chỉ mạnh khi quanh nó có chỗ êm.

Bạn được cho một SỐ LƯỢNG cần nhắm. Chọn đúng chừng ấy chỗ MỞ ĐOẠN Ý RÕ NHẤT —
những mốc mà chủ đề/mạch kể thật sự SANG TRANG. Không rải đều cho đủ số, cũng
đừng dè dặt trả về một hai cái rồi thôi. Thiếu chỗ xứng đáng thì trả ít hơn, nhưng
phải là vì đọc hết rồi mà không có, chứ không phải vì ngại chọn.`;

/**
 * `spans` = các đơn vị Ý liền nhau (CÂU) trên trục ĐÃ CẮT; ranh giới giữa hai
 * span kề nhau là một ứng viên "chỗ nối". Nơi gọi truyền vào (nó có sẵn danh
 * sách câu) — tự đọc ở đây thành vòng import.
 */
export async function pickEffects(
  projectId: string,
  spans: KeptRange[],
): Promise<{ applied: number; rejected: number }> {
  if (spans.length < 2) return { applied: 0, rejected: 0 };

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

  const joins = spans.slice(0, -1).map((range, index) => ({
    index,
    cut: range.end,
    resume: spans[index + 1].start,
    before: around(range.end, "before"),
    after: around(spans[index + 1].start, "after"),
    // Chỗ TRỐNG hai bên ranh giới — độ dài câu hai bên. Hai nửa của cú nhấn phải
    // nằm TRONG câu kề: câu quá ngắn thì nửa "trước" 0,5s của một cú zoom tràn
    // sang câu khác, nên bên dưới bóp cú nhấn vừa với câu ngắn hơn.
    roomBefore: range.end - range.start,
    roomAfter: spans[index + 1].end - spans[index + 1].start,
  }));

  const existing = db
    .prepare("SELECT start_sec, end_sec FROM effects WHERE project_id=?")
    .all(projectId) as Array<{ start_sec: number; end_sec: number }>;

  // KHUNG đã đặt (b-roll + ô người) — cú nhấn KHÔNG được rơi TRÚNG khung: một cú
  // zoom/whip đè lên thẻ b-roll đọc ra là lỗi, không ra chuyển cảnh. Effects chạy
  // SAU `place` + `layout` (chặng `layout` chặn giữa) nên khung đã có mặt để né.
  // Mốc GIÂY: sau chốt-cắt chỉ còn MỘT trục, khung neo-giây (hoặc lùi về mốc từ).
  const frames = db
    .prepare(
      `SELECT COALESCE(e.start_sec, w1.start_sec) AS s,
              COALESCE(e.end_sec,   w2.end_sec)   AS en
         FROM elements e
         LEFT JOIN words w1 ON w1.id = e.from_word_id
         LEFT JOIN words w2 ON w2.id = e.to_word_id
        WHERE e.project_id=? AND e.kind='layout'`,
    )
    .all(projectId) as Array<{ s: number | null; en: number | null }>;
  const frameSpans = frames
    .filter((f) => f.s != null && f.en != null && f.en > f.s)
    .map((f) => ({ start: f.s as number, end: f.en as number }));

  // Độ dài phim SẼ XUẤT RA, không phải độ dài bản gốc: mật độ nhịp là thứ người
  // xem cảm nhận trên bản đã cắt.
  const outputSeconds = spans.reduce(
    (total, range) => total + (range.end - range.start),
    0,
  );
  // Người dùng đặt lại được ở trang Cài đặt; thiếu thì rơi về con số mặc định.
  const nhip =
    settingsForProject(projectId).secondsPerEffect || SECONDS_PER_EFFECT;
  const pack = readStylePack(projectId);
  /*
   * Bộ dáng NHÂN vào nhịp của người dùng, không tranh với nó.
   *
   * Hai con số này trả lời hai câu khác nhau: `nhip` là "bao lâu thì nên có một
   * cú" — một nhịp độ; `junctionShare` là "bao nhiêu phần trăm chỗ nối đáng
   * đánh dấu" — một tỉ lệ. Bản trước lấy `Math.min` của hai cái, tức là bên nào
   * dè dặt hơn thì bên ấy thắng, nên bộ dáng chỉ làm ÊM được chứ không bao giờ
   * làm NHANH được.
   *
   * Và với video bị cắt nhiều thì nó tắt hẳn: đo một bản 132 chỗ nối, `Nhịp`
   * muốn 86 còn trần thời gian cho 14 — mọi bộ dáng đều ra đúng 14, tức trục
   * này chưa từng có tác dụng. Sau khi sửa, cùng bản ấy: `Lặng` 7, `Mộc` 14,
   * `Thép` 23.
   *
   * Tỉ lệ vẫn giữ vai trò TRẦN — "đừng đánh dấu quá ngần này phần trăm chỗ nối"
   * là một câu vẫn đúng. Nó chỉ thôi làm trần cho cả nhịp độ.
   */
  const wantByTime = outputSeconds / nhip;
  const paced = Math.round((wantByTime * pack.rhythm.junctionShare) / NHIP_GOC);
  const ceiling = Math.round(joins.length * pack.rhythm.junctionShare);
  const want = Math.min(joins.length, Math.max(1, Math.min(paced, ceiling) || 1));

  // Kho ưu tiên của bộ dáng — THIÊN LỆCH, không phải hàng rào: mô hình vẫn được
  // chọn kiểu ngoài kho khi mạch chuyển đòi thế, và bảng sửa vẫn bày đủ mọi kiểu.
  const preferred = pack.effectBias.junction;
  const biasLine =
    preferred.length > 0
      ? `\n\nDáng của video này thiên về: ${preferred.join(", ")}. Ưu tiên mấy kiểu đó khi hai lựa chọn ngang nhau, nhưng đừng ép nếu mạch chuyển đòi kiểu khác.`
      : "";

  const proposal = await ask<Proposal>({
    instructions: voiBoiCanh(INSTRUCTIONS, projectId),
    input:
      `Phim dài ${outputSeconds.toFixed(0)} giây. Nhắm khoảng ${want} chỗ.${biasLine}\n\n` +
      `DỒN VỀ ĐẦU: đặt chừng một nửa số cú ấy vào ${SHOWCASE_SECONDS} giây đầu, ` +
      `phần còn lại rải thưa dần về cuối. Mấy giây đầu là chỗ người xem quyết định ` +
      `ở lại hay lướt, nên phải phô ra ngay; sau khi họ đã ở lại thì thứ họ theo là lời nói.\n\n` +
      joins
        /*
         * Đánh dấu chỗ nối nào nằm trong cửa sổ phô trương.
         *
         * Bảo suông "dồn về đầu" thì không ăn — đo được: 1/7 cú rơi vào 30 giây
         * đầu. Mô hình đọc một danh sách chỗ nối không có mốc thời gian nào, nên
         * nó không biết chỗ nào là "đầu". Ghi dấu vào chính dòng dữ liệu thì nó
         * thấy, và đó là chỗ duy nhất nó thấy được.
         */
        .map(
          (join) =>
            `${join.index}|${join.cut < SHOWCASE_SECONDS ? "[ĐẦU]" : ""} ` +
            `…${join.before} ⟨│⟩ ${join.after}…`,
        )
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
      // MIN ĐỘ DÀI: cú quá ngắn (chớp 0,12s / dip 0,18s) đọc ra như GIẬT, không
      // ra nhịp. Nới đều hai nửa cho tổng ≥ MIN_EFFECT, NHƯNG chỉ trong phần đoạn
      // giữ còn (không lấn vùng đã bỏ — cùng lý do với chặn "không đủ chỗ").
      let bef = before;
      let aft = after;
      if (bef + aft < MIN_EFFECT) {
        const grow = (MIN_EFFECT - before - after) / 2;
        bef = Math.min(join.roomBefore, before + grow);
        aft = Math.min(join.roomAfter, after + grow);
      }
      // Quãng vắt QUA vết cắt: nửa trước nằm ở đoạn trước, nửa sau ở đoạn sau.
      // Đặt gọn một bên thì đỉnh xung không rơi đúng chỗ nối.
      const start = Math.max(0, join.cut - bef);
      const end = join.resume + aft;
      // NÉ KHUNG: cú nhấn CHẠM một khung (b-roll/ô người) đọc ra là lỗi, không ra
      // chuyển cảnh → bỏ. Effects chạy sau place+layout nên khung đã có mặt.
      if (frameSpans.some((f) => start < f.end && f.start < end)) {
        rejected += 1;
        continue;
      }
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

  // Ghi lại bộ dáng vừa dùng: hàng soát so nó với bộ dáng hiện tại để biết có
  // nên mời người dùng đặt lại hay không.
  db.prepare("UPDATE projects SET effects_style_pack=? WHERE id=?").run(
    pack.id,
    projectId,
  );

  return { applied, rejected };
}
