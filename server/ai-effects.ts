import { voiBoiCanh } from "./ai-context";
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

/**
 * Kho kiểu cho hiệu ứng ở RANH GIỚI Ý — chỉ họ ZOOM AN TOÀN, tự dài ≥2,5s.
 *
 * Người dùng muốn mỗi cú nhấn ≥2–3s VÀ chỉ kiểu quen thuộc (sợ kiểu lạ phản tác
 * dụng). Kiểu ánh-sáng/màu ngắn (flash, dip, hue-shift…) bị loại vì giữ ngắn 0,4s;
 * kiểu sắc ngắn (punch/whip/shake) nới lên 2,5s thì kỳ; kiểu LẠ (drift trôi ngang,
 * zoom-blur nhoè) dễ đọc ra "cố tình" → cũng bỏ. Còn ba kiểu ZOOM mượt, quen mắt,
 * tự dài: zoom-in/out 2,5s; push-in 4–5s (phóng chậm cả đoạn).
 */
const IDEA_EFFECT_KINDS = ["zoom-in", "zoom-out", "push-in"] as const;

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
        // CHỈ NĂM họ ZOOM AN TOÀN (≥2,5s). Bỏ (1) cross-* — ranh giới ý là mạch liền,
        // không có khe cắt để hoà tan hai cảnh; (2) kiểu ÁNH SÁNG/MÀU ngắn (flash,
        // dip, hue-shift…) ngắn 0,4s; kiểu SẮC ngắn (punch/whip/shake — nới 2,5s thì
        // kỳ); và kiểu LẠ (drift trôi ngang, zoom-blur nhoè — dễ phản tác dụng). Còn
        // lại là họ ZOOM an toàn, quen mắt, tự dài 2–5s.
        enum: IDEA_EFFECT_KINDS,
      },
    }),
  },
});

const INSTRUCTIONS = `Bạn chọn hiệu ứng NHẤN cho các RANH GIỚI Ý trong một video nói tiếng Việt.

Video là một mạch nói liền. Mỗi ứng viên là ranh giới giữa hai CÂU; bạn được xem
lời NGAY TRƯỚC và NGAY SAU nó. Chỉ nhấn ở chỗ MỞ MỘT ĐOẠN Ý MỚI — chuyển chủ đề,
sang một bước kể mới, đổi mạch rõ rệt. KHÔNG nhấn giữa những câu CÙNG một ý.

Chỉ dùng BA kiểu ZOOM mượt, quen mắt, MỖI CÚ DÀI KHOẢNG 2–3 GIÂY — đủ để mắt cảm
nhận là một CHUYỂN ĐỘNG có chủ đích, không phải một cái giật. Ranh giới Ý là chỗ
chuyển mạch êm; giữ AN TOÀN, đừng cầu kỳ:

- zoom-in: phóng nhẹ VÀO — sau ranh giới là ý mạnh hơn, dồn hơn, đáng chú ý hơn
- zoom-out: nới RA — hạ nhịp, khép một đoạn, lùi lại nhìn rộng
- push-in: phóng dần CHẬM suốt cả đoạn rồi hạ về — dồn dần vào người nói; hợp đoạn
  kể chuyện, tâm sự, chỗ cần người xem nghiêng vào nghe

Xen zoom-in / zoom-out / push-in cho đỡ đơn điệu; zoom-in và zoom-out là chủ lực.

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
  // Thiên lệch của bộ dáng — LỌC còn kiểu trong kho ranh-giới-ý (bias có thể trỏ
  // cross-* hay kiểu ngắn không còn được phép chọn; giữ chúng lại là gợi ý hão).
  const preferred = pack.effectBias.junction.filter((k) =>
    (IDEA_EFFECT_KINDS as readonly string[]).includes(k),
  );
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
      const target = before + after;
      // Cần TỔNG chỗ hai câu kề đủ chứa cú nhấn — KHÔNG cần mỗi bên đủ, vì phân bổ
      // LỆCH được (câu trước ngắn thì dồn cú nhấn về câu sau). Thiếu cả tổng thì bỏ:
      // thà không có còn hơn một cú CỤT dưới mức nhìn ra là chuyển động.
      if (join.roomBefore + join.roomAfter < target) {
        rejected += 1;
        continue;
      }
      // Phân bổ trước/sau: lấy tối đa theo tỉ lệ tự nhiên của kiểu, bên nào chạm
      // trần chỗ thì dồn phần thiếu sang bên còn chỗ — giữ đủ tổng độ dài (2,5–5s).
      let bef = Math.min(join.roomBefore, before);
      let aft = Math.min(join.roomAfter, after);
      let thieu = target - bef - aft;
      if (thieu > 0) {
        const themB = Math.min(join.roomBefore - bef, thieu);
        bef += themB;
        thieu -= themB;
        aft += Math.min(join.roomAfter - aft, thieu);
      }
      // Quãng vắt QUA ranh giới: nửa trước ở câu trước, nửa sau ở câu sau.
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
