import { voiBoiCanh } from "./ai-context";
import { db, newId } from "./db";
import { findLayout, layoutFitsMedia, type LayoutKindId } from "./layout-kinds";
import { ask, object } from "./llm";
import { readStylePack } from "./style-pack-store";

/**
 * Đặt tư liệu chèn vào đúng chỗ lời đang nói về nó.
 *
 * Khác hẳn bản v1 (`place-broll-cutaways.ts`): ở đó tư liệu được RẢI ĐỀU theo
 * khoảng cách, không đọc nội dung — nó trả lời "chỗ nào đặt được mà không
 * hỏng", chứ không phải "cái nào nên đặt ở đâu". Bộ ràng buộc của v1 thì giữ
 * nguyên vì nó đã chạy đúng trên clip thật, chỉ thay phép CHỌN CHỖ.
 *
 * Mô hình chỉ đề xuất theo mã từ; mọi ràng buộc do code giữ.
 */

/**
 * Ngắn hơn thì nháy một cái đã hết chưa kịp đọc ra hình gì; dài hơn thì mất mặt
 * người nói quá lâu. 2,5s là mức tối thiểu để một tư liệu HIỆN CÓ NGHĨA — mắt kịp
 * nhận ra nó minh hoạ điều đang nói.
 */
const MIN_SECONDS = 2.5;
/** Hai lần chèn liền nhau phải cách ngần này, không thì thành nhấp nháy. */
const MIN_GAP_SECONDS = 3;
/** Chừa đoạn mở: cắt cảnh ngay giây đầu là mất mặt người nói đúng lúc cần nhất. */
const START_MARGIN_SECONDS = 2;

type Word = { id: string; start_sec: number; end_sec: number };
type Asset = {
  id: string;
  name: string;
  description: string | null;
  /** Tỉ lệ + độ dài clip — có với tư liệu TRONG dự án; tệp KHO thì thiếu (undefined). */
  width?: number | null;
  height?: number | null;
  duration?: number | null;
};

type Proposal = {
  places: Array<{ fileId: string; fromWordId: string; toWordId: string }>;
};

const SCHEMA = object({
  places: {
    type: "array",
    items: object({
      fileId: { type: "string" },
      fromWordId: { type: "string" },
      toWordId: { type: "string" },
    }),
  },
});

const INSTRUCTIONS = `Bạn ghép tư liệu chèn vào một video nói tiếng Việt.

Với mỗi tư liệu, tìm quãng lời mà hình đó MINH HOẠ ĐƯỢC, rồi trả về mã từ đầu và
mã từ cuối của quãng ấy.

ĐƯỢC TÍNH LÀ KHỚP — cả ba loại dưới đây đều nên đặt:
- Lời gọi thẳng tên thứ trong hình ("bàn phím" ↔ hình bàn phím)
- Hình MINH HOẠ điều đang nói, dù lời không gọi tên nó
  ("mình lập một công ty" ↔ hình hợp đồng có con dấu đỏ — ĐẶT)
  ("thâu đêm xuất sáng" ↔ hình ngồi máy tính lúc đêm — ĐẶT)
- Hình cho thấy việc đang được kể ("mình quay video này" ↔ hình đang quay)

KHÔNG khớp: hình chẳng dính gì tới điều đang nói ở chỗ đó.

Hãy cố tìm chỗ cho TỪNG tư liệu một. Chỉ bỏ ra khi đọc hết bản chép lời mà thật
sự không có đoạn nào hình đó minh hoạ được. Quãng nên bọc đúng cụm từ mang ý,
đừng bọc cả câu dài. Mỗi tư liệu dùng nhiều nhất một lần, rải khắp video.`;

/**
 * Pass 2 — ép khớp NỐT những clip pass 1 bỏ sót.
 *
 * Pass 1 để model tự do "bỏ ra nếu không khớp" — và nó lạm quyền đó: đo trên dự
 * án thật, v4-pro chỉ đặt 2/6 clip dù được bảo dùng hết, kể cả clip có chỗ khớp
 * hiển nhiên (ảnh "Mình là Thái" ↔ lời "Mình là Thái, founder…" ở cuối). Bốn
 * clip còn lại rơi xuống "đặt nốt" MÙ nội dung → dồn cục vào khoảng trống lớn
 * nhất (đầu video), lời khớp ở nửa sau thì trơ mặt người.
 *
 * Pass 2 hỏi lại với danh sách HẸP (chỉ clip còn thừa) và CẤM bỏ trống: việc nhỏ
 * hơn, model làm kỹ hơn. Chỉ clip nào pass 2 vẫn không ra mới xuống "đặt nốt".
 */
const INSTRUCTIONS_FILL = `Một số tư liệu chèn CHƯA được đặt vào video. Với TỪNG
tư liệu dưới đây, tìm quãng lời khớp NHẤT mà hình đó minh hoạ được — trả mã từ
đầu và mã từ cuối của quãng ấy.

BẮT BUỘC đặt HẾT, mỗi tệp đúng một chỗ. Không có chỗ khớp hoàn hảo thì chọn chỗ
CHỦ ĐỀ GẦN NHẤT (đang nói về việc/thứ mà hình gợi tới) — đừng bỏ trống. Quãng
bọc đúng cụm từ mang ý, đừng bọc cả câu dài. TRÁNH các quãng đã có tư liệu.`;

/**
 * Đếm số lần gạt THEO TỪNG LUẬT.
 *
 * Một con số "gạt 1" gộp chung thì không nói được máy đang quá tay hay mô hình
 * đang chọn ẩu — mà đó đúng là điều duy nhất cần biết để chỉnh. Đo thật một
 * lần: chặng này trả "đặt 0 · gạt 1" và không có cách nào lần ra vì sao.
 */
type Rejections = Record<string, number>;

function summarize(rejections: Rejections) {
  const parts = Object.entries(rejections)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => `${reason} ${count}`);
  return parts.length > 0 ? parts.join(", ") : "";
}

export async function placeInserts(projectId: string): Promise<{
  placed: number;
  rejected: number;
  why: string;
}> {
  const assets = db
    .prepare(
      `SELECT id, name, description, width, height, duration FROM media_files
       WHERE project_id=? AND role='insert' AND description IS NOT NULL AND description<>''`,
    )
    .all(projectId) as Asset[];
  if (assets.length === 0) return { placed: 0, rejected: 0, why: "" };

  // Chỉ đặt vào chỗ CHƯA có tư liệu nào. Người dùng (hoặc lượt trước) đã đặt
  // thì giữ nguyên — đây là chặng thêm vào, không phải chặng dựng lại.
  const used = new Set(
    (
      db
        .prepare(
          "SELECT media_file_id FROM elements WHERE project_id=? AND media_file_id IS NOT NULL",
        )
        .all(projectId) as Array<{ media_file_id: string }>
    ).map((row) => row.media_file_id),
  );
  // CHỈ tư liệu CỦA DỰ ÁN, và DÙNG HẾT (mỗi tệp một chỗ). Không còn kho tự-lấy
  // (nguồn 3-nấc project/starred/library đã bỏ) — "chọn ở bước 2, dùng hết" (KISS).
  // Người dùng thêm từ kho ở bước nạp thì nó đã thành tư liệu dự án ở đây.
  const trongDuAn = assets.filter((asset) => !used.has(asset.id));
  const free = trongDuAn;
  if (free.length === 0) return { placed: 0, rejected: 0, why: "" };

  const words = db
    .prepare(
      "SELECT id, text, start_sec, end_sec FROM words WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Array<Word & { text: string }>;
  if (words.length < 10) return { placed: 0, rejected: 0, why: "" };

  const spokenEnd = words.at(-1)!.end_sec;
  const spokenSeconds = spokenEnd - words[0].start_sec;
  const pack = readStylePack(projectId);
  // Nhắm ĐÚNG số tư liệu dự án — mỗi tệp một chỗ. Bước "đặt nốt" ở cuối bảo đảm
  // clip nào mô hình không tìm được chỗ vẫn được nhét vào khoảng trống.
  const offered = trongDuAn;
  const want = Math.max(1, offered.length);

  // KIỂU KHUNG xoay vòng cho ĐA DẠNG (trước đây mọi chèn cùng một kiểu). Lấy các
  // bố cục b-roll (cần tư liệu) của bộ dáng; chèn thứ i dùng kiểu i%N. Người dùng
  // vẫn đổi từng cái ở bảng sửa.
  const brollLayouts = pack.layouts.filter(
    (id) => findLayout(id as LayoutKindId).needsInsert,
  ) as LayoutKindId[];
  const revealForPack = pack.effectBias.insertReveal[0] ?? "none";

  const proposal = await ask<Proposal>({
    instructions: voiBoiCanh(INSTRUCTIONS, projectId),
    input:
      `Lời dài ${spokenSeconds.toFixed(0)} giây. Nhắm khoảng ${want} chỗ chèn — ` +
      `hãy DÙNG HẾT tư liệu dưới đây, mỗi tệp một chỗ.\n\n` +
      `Tư liệu (mã|tên|nội dung):\n` +
      offered.map((a) => `${a.id}|${a.name}|${a.description}`).join("\n") +
      `\n\nLời (mã|chữ):\n` +
      words.map((w) => `${w.id}|${w.text}`).join("\n"),
    schemaName: "broll_places",
    schema: SCHEMA,
  });

  const index = new Map(words.map((word, at) => [word.id, at]));

  // `reveal` lấy từ bộ dáng thay vì chôn cứng `'none'`: đây là chỗ DUY NHẤT
  // sinh ra tư liệu chèn tự động, nên nó quyết định dáng của cả video. Người
  // dùng vẫn đổi từng cái ở bảng sửa, và bảng sửa vẫn bày đủ mọi kiểu.
  // B-roll = khung CÓ tư liệu, `kind='layout'` như mọi khung. Phân biệt bằng
  // `media_file_id`, không bằng `kind`.
  // B-roll NEO-GIÂY: ghi thẳng `start_sec/end_sec` (mốc nguồn của dải từ đã chọn) —
  // để kéo/gọt tự do như nhạc, kéo mép = in/out nguồn. Vẫn ghi `from/to_word_id`
  // (chưa bỏ cột) nhưng render đọc GIÂY (`layout-segments` ưu tiên sec).
  const insert = db.prepare(
    `INSERT INTO elements (id, project_id, kind, from_word_id, to_word_id, start_sec, end_sec, media_file_id, insert_layout, align, emphasis, reveal, shape)
     VALUES (?,?,'layout',?,?,?,?,?,?,'center','taper',?,'full')`,
  );
  // KHUNG chiếm NỬA TRÊN (người/tư liệu ở trên, chừa đáy) → phụ đề đè lên đó phải
  // XUỐNG DƯỚI cho khỏi che. Đặt khung xong thì đẩy mọi cụm chữ CHẠM khoảng thời
  // gian của khung về `bottom` (cụm có tiếng đầu rơi trong quãng khung).
  const pushCaptionsDown = db.prepare(
    `UPDATE elements SET position_band='bottom'
     WHERE project_id=? AND kind='text' AND COALESCE(position_band,'') <> 'bottom'
       AND from_word_id IN (
         SELECT id FROM words WHERE project_id=? AND start_sec >= ? AND start_sec < ?
       )`,
  );
  const taken: Array<{ start: number; end: number }> = [];
  const seen = new Set<string>();
  let placed = 0;
  const rejections: Rejections = {};
  const reject = (reason: string) => {
    rejections[reason] = (rejections[reason] ?? 0) + 1;
  };

  /**
   * Duyệt TRƯỚC, ghi SAU.
   *
   * Vòng này chỉ chấm đề xuất nào qua được luật, không đụng cơ sở dữ liệu. Cần
   * tách vì tư liệu lấy từ kho phải CHÉP thành tệp thật, mà chép thì bất đồng bộ
   * còn `db.transaction` thì đồng bộ. Chép trước khi duyệt cũng chạy, nhưng đề
   * xuất nào bị luật gạt sẽ để lại một tệp thừa nằm trong dự án mà không phần tử
   * nào trỏ tới.
   */
  const duyet: Array<{
    fileId: string;
    loWordId: string;
    hiWordId: string;
    startSec: number;
    endSec: number;
    layout: LayoutKindId | null;
  }> = [];
  /**
   * Chấm MỘT đề xuất qua bảy cổng luật rồi ghi vào `duyet` nếu qua. Trả `true`
   * khi đặt được. Dùng chung cho cả hai pass khớp-nội-dung (pass 1 tự do, pass 2
   * ép nốt) để luật đặt CHỈ có một bản — sửa một chỗ là cả hai pass theo.
   */
  const considerPlace = (place: {
    fileId: string;
    fromWordId: string;
    toWordId: string;
  }): boolean => {
    const from = index.get(place.fromWordId);
    const to = index.get(place.toWordId);
    const asset = free.find((item) => item.id === place.fileId);
    if (from === undefined || to === undefined || to < from || !asset) {
      reject("mã sai");
      return false;
    }
    // Mỗi tệp một lần. Mô hình lặp lại một tệp là chuyện thường, mà cùng một
    // hình hiện hai lần trong một video ngắn thì lộ ngay là máy làm.
    if (seen.has(asset.id)) {
      reject("trùng tệp");
      return false;
    }

    /**
     * GIỮ NGUYÊN ĐỘ DÀI: khối dài ĐÚNG bằng clip gốc.
     *
     * Bản trước ép khối về 2,5–4s bằng cách nới dải TỪ — tư liệu bị cắt cụt còn
     * vài giây, mất phần lớn footage user tải lên. Giờ khối bắt đầu ĐÚNG chỗ lời
     * khớp (`from`) và chạy trọn độ dài clip; user tự cắt ngắn sau nếu muốn.
     *
     * Neo theo GIÂY (`start_sec/end_sec`) — cột mã-từ `from/to_word_id` chỉ còn
     * để tương thích, render đọc giây. Ảnh (không có thời lượng) hoặc tệp KHO
     * (chưa biết độ dài ở bước này) rơi về `MIN_SECONDS` đủ để hiện có nghĩa.
     */
    const start = words[from].start_sec;
    if (start < START_MARGIN_SECONDS) {
      reject("sát đầu");
      return false;
    }
    const clipLen =
      asset.duration && asset.duration > 0.05 ? asset.duration : MIN_SECONDS;
    // Không tràn khỏi lời: kẹp mép ra vào cuối bản chép, chừa một nhịp.
    const end = Math.min(start + clipLen, spokenEnd - 0.1);
    const length = end - start;
    if (length < 0.5) {
      reject("hết chỗ");
      return false;
    }
    // Chồng nhau HOẶC sát nhau quá đều loại: hai lần cắt cảnh cách nhau một
    // giây đọc ra là lỗi kỹ thuật chứ không phải dụng ý.
    if (
      taken.some(
        (item) =>
          start < item.end + MIN_GAP_SECONDS &&
          item.start - MIN_GAP_SECONDS < end,
      )
    ) {
      reject("sát cái khác");
      return false;
    }

    // KIỂU KHUNG chọn theo TỈ LỆ tư liệu: dùng ĐỦ mọi khung b-roll của style,
    // nhưng chỉ những khung mà ô đựng KHÔNG cắt hỏng clip (dọc không nhét ô
    // ngang…). Trong nhóm hợp thì xoay vòng cho đa dạng. Không biết tỉ lệ (tệp
    // kho) thì mọi khung đều hợp. Rỗng → null (toàn-khung mặc định).
    const mediaAspect =
      asset.width && asset.height ? asset.width / asset.height : null;
    const fitting = brollLayouts.filter((id) =>
      layoutFitsMedia(id, mediaAspect),
    );
    const pool = fitting.length ? fitting : brollLayouts;
    const layout = pool.length ? pool[duyet.length % pool.length] : null;

    // `to_word_id`: từ cuối cùng bắt đầu trước mép ra — cột neo cũ, đủ để bảng
    // sửa hiển thị; mốc thật là GIÂY ở trên.
    let hiIdx = from;
    while (hiIdx + 1 < words.length && words[hiIdx + 1].start_sec < end)
      hiIdx += 1;
    duyet.push({
      fileId: asset.id,
      loWordId: words[from].id,
      hiWordId: words[hiIdx].id,
      startSec: start,
      endSec: end,
      layout,
    });
    taken.push({ start, end });
    seen.add(asset.id);
    placed += 1;
    return true;
  };

  // PASS 1 — model tự do đọc cả bản chép, đặt chỗ nào nó thấy khớp.
  for (const place of proposal.places) considerPlace(place);

  // PASS 2 — ÉP KHỚP NỐT clip pass 1 bỏ sót (theo NỘI DUNG, không phải chỗ trống).
  //
  // Trước "đặt nốt" mù: cho model một cơ-hội-thứ-hai với danh sách hẹp + cấm bỏ.
  // Nhờ vậy clip có chỗ khớp rõ ở nửa sau (vd ảnh chân dung ↔ lời tự giới thiệu
  // cuối video) về đúng chỗ, thay vì bị nhét bừa ra đầu. Clip nào pass 2 vẫn
  // không đặt được (trùng chỗ, hết chỗ…) mới rơi xuống "đặt nốt" bên dưới.
  //
  // THỬ TỐI ĐA 2 LƯỢT vì model KHÔNG tất định: nó phải CHÉP LẠI mã từ dài (12 ký
  // tự) cho mỗi chỗ, và v4-pro chép sai bữa được bữa không (đo: cùng đầu vào ra
  // "gạt 107 · 41 · 32 · 28"). Một lượt bốc trúng đặt đúng cả 4 clip theo nội
  // dung; lượt trượt bịa mã → bị gạt sạch. Lượt sau đổi tiền tố `[lần N]` để
  // KHÔNG trúng cache lượt trước (mỗi lượt một xúc xắc mới). Đã đặt hết thì dừng.
  const MAX_FILL_TRIES = 2;
  for (let tries = 0; tries < MAX_FILL_TRIES; tries += 1) {
    const soter = trongDuAn.filter((asset) => !seen.has(asset.id));
    if (soter.length === 0) break;
    const busy = [...taken]
      .sort((a, b) => a.start - b.start)
      .map((t) => `${t.start.toFixed(0)}-${t.end.toFixed(0)}s`)
      .join(", ");
    const fill = await ask<Proposal>({
      instructions: voiBoiCanh(INSTRUCTIONS_FILL, projectId),
      input:
        (tries > 0 ? `[lần ${tries + 1}]\n` : "") +
        `Tư liệu CHƯA đặt (mã|tên|nội dung):\n` +
        soter.map((a) => `${a.id}|${a.name}|${a.description}`).join("\n") +
        (busy ? `\n\nQuãng ĐÃ có tư liệu (tránh ra): ${busy}` : "") +
        `\n\nLời (mã|chữ):\n` +
        words.map((w) => `${w.id}|${w.text}`).join("\n"),
      schemaName: "broll_fill",
      schema: SCHEMA,
    });
    for (const place of fill.places) considerPlace(place);
  }

  // ── ĐẶT NỐT: bảo đảm DÙNG HẾT b-roll USER tự tải ──────────────────────────
  //
  // Vòng trên chỉ đặt được clip mà mô hình TÌM ĐƯỢC chỗ lời khớp và qua hết bảy
  // cổng gạt (cách nhau, sát đầu…). Clip user không được đề xuất, hoặc bị gạt vì
  // chật chỗ, thì rơi rụng — trái luật "dùng hết cái họ đưa". Ở đây nhét NỐT từng
  // clip user còn thừa vào KHOẢNG TRỐNG LỚN NHẤT còn lại: nới luật khớp-nội-dung
  // (đặt theo chỗ trống, không theo lời) và luật cách-nhau — đổi độ-liên-quan lấy
  // CHẮC CHẮN có mặt. CHỈ áp cho b-roll USER (`trongDuAn`), KHÔNG cho kho.
  const conThua = trongDuAn.filter((asset) => !seen.has(asset.id));
  if (conThua.length > 0) {
    const GAP_MARGIN = 0.2; // chừa mép để clip không dính khít clip cạnh
    const freeGaps = () => {
      const busy = [...taken].sort((a, b) => a.start - b.start);
      const gaps: Array<{ start: number; end: number }> = [];
      let cursor = START_MARGIN_SECONDS;
      for (const b of busy) {
        if (b.start > cursor + 0.5)
          gaps.push({ start: cursor, end: Math.min(b.start, spokenEnd) });
        cursor = Math.max(cursor, b.end);
      }
      if (cursor < spokenEnd - 0.5) gaps.push({ start: cursor, end: spokenEnd });
      return gaps;
    };
    for (const asset of conThua) {
      // Khoảng RỘNG NHẤT ĐẶT ĐƯỢC còn lại — tính lại mỗi lần (đã trừ chỗ vừa chèn).
      //
      // Xét các khoảng theo bề rộng GIẢM DẦN và lấy khoảng lớn nhất mà VỪA đủ
      // rộng VỪA có từ để neo. Bản trước chỉ lấy khoảng lớn nhất rồi `break` cả
      // vòng nếu nó quá hẹp hoặc TOÀN LẶNG (không từ) — bỏ oan mọi clip còn thừa
      // dù các khoảng nhỏ hơn vẫn neo được. Giờ chỉ dừng khi KHÔNG khoảng nào đặt
      // được.
      //
      // NEO MÉP VÀO TỪ trong khoảng trống — TUYỆT ĐỐI không đặt theo giây thô của
      // `gap.start`. Giây thô có thể rơi đúng một HỞ giữa hai đoạn (breath-pause);
      // bước dựng lịch BỎ hở đó (`keptRanges`) nên element neo vào hở map ra null →
      // RỚT KHỎI VIDEO. Mép của một TỪ luôn nằm trong vùng GIỮ, nên neo vào từ thì
      // không bao giờ rớt.
      const gaps = freeGaps().sort(
        (a, b) => b.end - b.start - (a.end - a.start),
      );
      let winEnd = 0;
      let lo = -1;
      for (const g of gaps) {
        const ws = g.start + GAP_MARGIN;
        const we = g.end - GAP_MARGIN;
        if (we - ws < 0.5) continue; // khoảng này quá hẹp → thử khoảng kế
        let i0 = -1;
        for (let i = 0; i < words.length; i += 1)
          if (words[i].start_sec >= ws && words[i].start_sec < we) {
            i0 = i;
            break;
          }
        if (i0 < 0) continue; // khoảng toàn lặng, không từ để neo → thử khoảng kế
        winEnd = we;
        lo = i0;
        break;
      }
      if (lo < 0) break; // không còn khoảng nào đặt được → dừng thật
      const clipLen =
        asset.duration && asset.duration > 0.05 ? asset.duration : MIN_SECONDS;
      const targetEnd = Math.min(words[lo].start_sec + clipLen, winEnd);
      let hi = lo;
      while (
        hi + 1 < words.length &&
        words[hi + 1].start_sec < targetEnd &&
        words[hi + 1].end_sec <= winEnd
      )
        hi += 1;
      const start = words[lo].start_sec;
      const end = words[hi].end_sec;
      // Khung theo tỉ lệ (như vòng chính).
      const mediaAspect =
        asset.width && asset.height ? asset.width / asset.height : null;
      const fitting = brollLayouts.filter((id) =>
        layoutFitsMedia(id, mediaAspect),
      );
      const pool = fitting.length ? fitting : brollLayouts;
      const layout = pool.length ? pool[duyet.length % pool.length] : null;
      duyet.push({
        fileId: asset.id,
        loWordId: words[lo].id,
        hiWordId: words[hi].id,
        startSec: start,
        endSec: end,
        layout,
      });
      taken.push({ start, end });
      seen.add(asset.id);
      placed += 1;
    }
  }

  // Mọi tư liệu đều là tệp THẬT của dự án (không còn kho phải chép về) — ghi thẳng.
  db.transaction(() => {
    for (const item of duyet) {
      insert.run(
        newId("e"),
        projectId,
        item.loWordId,
        item.hiWordId,
        item.startSec,
        item.endSec,
        item.fileId,
        item.layout,
        revealForPack,
      );
      // Phụ đề chạm khung này → xuống dưới cho khỏi che khung.
      pushCaptionsDown.run(projectId, projectId, item.startSec, item.endSec);
    }
  })();

  const rejected = Object.values(rejections).reduce((sum, n) => sum + n, 0);
  return { placed, rejected, why: summarize(rejections) };
}
