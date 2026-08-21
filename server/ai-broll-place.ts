import { voiBoiCanh } from "./ai-context";
import { db, newId } from "./db";
import { findLayout, layoutFitsMedia, type LayoutKindId } from "./layout-kinds";
import { ask, object } from "./llm";
import { pickWindow, readClipAnalysis } from "./clip-analysis";
import { readStyleOverrides } from "./ai-directive";
import { neoTheoLoi } from "./broll-anchor";
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
/**
 * SÀN CỨNG giữa hai lần chèn — dưới ngưỡng này mắt đọc ra là lỗi kỹ thuật.
 *
 * Khác `brollMinGap` (nhịp của bộ dáng, thuộc hàng thứ yếu): con số này không
 * nhường cho nội dung, vì hai cảnh cách nhau nửa giây thì không còn là hai cảnh.
 */
const HARD_GAP = 0.8;

/**
 * Clip được phép NGẮN HƠN khối bao nhiêu lần trước khi thôi kéo dài.
 *
 * `1,25` = cho lặp lại tối đa một phần tư vòng. Hụt chừng ấy thì mắt đọc ra là
 * hình còn chạy; lặp trọn một vòng thì đọc ra ngay là ảnh động lặp — và cái đó
 * lộ hơn hẳn việc khối ngắn hơn lời một chút rồi về mặt người.
 */
const LOOP_TOLERANCE = 1.25;

/** Chừa đoạn mở: cắt cảnh ngay giây đầu là mất mặt người nói đúng lúc cần nhất. */
const START_MARGIN_SECONDS = 2;

type Word = {
  id: string;
  start_sec: number;
  end_sec: number;
  /** Câu chứa tiếng này — để nới mép ra tới chỗ người nói ngắt câu. */
  sentence_id: string;
};
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

QUÃNG DÀI BAO NHIÊU — quan trọng, vì quãng bạn chọn QUYẾT ĐỊNH hình hiện bao lâu:
- Bọc TRỌN Ý mà hình minh hoạ: từ lúc người nói bắt đầu nói về điều đó cho tới
  lúc chuyển sang điều khác. Thường là cả một mệnh đề hoặc cả câu.
- ĐỪNG bọc vài từ lẻ. Quãng ba, bốn tiếng làm hình vừa hiện đã tắt — người xem
  chưa kịp nhận ra nó là hình gì.
- Nhưng cũng đừng kéo sang phần lời đã nói chuyện khác: hình ở lại sau khi ý đã
  qua thì đọc ra là lỗi dựng.

Hãy cố tìm chỗ cho TỪNG tư liệu một. Chỉ bỏ ra khi đọc hết bản chép lời mà thật
sự không có đoạn nào hình đó minh hoạ được. Rải khắp video.

DÙNG LẠI MỘT TƯ LIỆU: mặc định mỗi tư liệu một lần. Chỉ khi số chỗ chèn cần đặt
NHIỀU HƠN số tư liệu thì mới dùng lại — và chỉ dùng lại ở quãng lời mà nó thật sự
minh hoạ được lần nữa, đừng rải bừa cho đủ số.`;

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
      "SELECT id, text, start_sec, end_sec, sentence_id FROM words WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Array<Word & { text: string }>;
  if (words.length < 10) return { placed: 0, rejected: 0, why: "" };

  const spokenEnd = words.at(-1)!.end_sec;
  const spokenSeconds = spokenEnd - words[0].start_sec;
  const pack = readStylePack(projectId);
  /*
   * BAO NHIÊU CHỖ CHÈN — nhịp của bộ dáng nói, không phải số tệp user có.
   *
   * Bản trước nhắm ĐÚNG số tư liệu dự án ("mỗi tệp một chỗ") và có hẳn một bước
   * "đặt nốt" để clip nào chưa được đặt thì nhét vào khoảng trống. Nghĩa là kho
   * tư liệu quyết định nhịp phim: tải 20 clip thì máy cố nhét 20 lần cắt cảnh.
   *
   * Mỗi bộ dáng đã khai nhịp của mình (`rhythm.brollEverySec`, 9-15 giây/lần) —
   * nhưng con số ấy trước giờ chỉ được đọc để ghép câu mô tả cho người dùng xem,
   * không chỗ nào trong bước đặt đụng tới. Nối nó vào đây thì nhịp thành thật.
   *
   * Lấy min với số tệp: nhịp cho phép 8 chỗ mà chỉ có 3 clip thì vẫn là 3.
   */
  const offered = trongDuAn;
  const byRhythm = Math.max(
    1,
    Math.floor(spokenSeconds / pack.rhythm.brollEverySec),
  );
  /*
   * NHỊP đòi bao nhiêu chỗ, và SỐ TỆP có đủ để lấp không.
   *
   * Bản trước lấy `min(số tệp, nhịp)` nên số tệp luôn là trần — người dùng viết
   * "b-roll thật dày" mà chỉ đưa 7 clip thì bản dựng vẫn đúng 7 chèn, tức chỉ thị
   * không có tác dụng gì. Đo được: chỉ thị dày cho ra 31% thời lượng, còn không
   * chỉ thị lại 37%.
   *
   * Nên khi nhịp đòi nhiều hơn số tệp, cho phép một tệp lên hình nhiều lần —
   * nhưng mỗi lần lấy một ĐOẠN KHÁC của nó (xem `pickWindow`, tham số `nth`).
   * Cùng một cuộn phim cho ra mấy cảnh khác nhau là điều người dựng thật vẫn làm;
   * cái lộ liễu là lặp đúng một đoạn, chứ không phải dùng lại một tệp.
   *
   * Trần 3 lần: quá đó thì dù khác đoạn, người xem vẫn nhận ra cùng một bối cảnh
   * quay đi quay lại.
   */
  /*
   * CHỈ THỊ CỦA NGƯỜI DÙNG ĐƯỢC PHÉP BỎ BỚT TƯ LIỆU.
   *
   * Luật nền là "dùng hết tư liệu họ đưa" — người ta bỏ công chọn thì phải thấy
   * nó lên hình. Nhưng khi chính họ viết "ít hình thôi, để tôi nói là chính" thì
   * họ vừa nói ngược lại luật ấy, và giữ luật lúc đó là cãi lại người dùng.
   *
   * Đo được trước khi có nhánh này: chỉ thị "ít hình thôi" cho ra 51% thời lượng
   * là b-roll, còn "b-roll thật dày" chỉ 31% — vòng ĐẶT NỐT nhét đủ bảy tệp bất
   * kể nhịp, nên chỉ thị không đổi được gì.
   */
  const chiThiNhip = readStyleOverrides(projectId)?.brollEverySec != null;
  const want = Math.max(1, byRhythm);
  /*
   * DÙNG LẠI một tư liệu: CHỈ khi người dùng đã dặn muốn dày.
   *
   * Thứ tự ưu tiên của sản phẩm là "đặt đúng chỗ" trước, "dùng hết tư liệu" sau,
   * rồi mới tới nhịp. Dùng LẠI một clip không nằm trong "dùng hết" — nó là vượt
   * quá — nên nó không được phép mua thêm nhịp bằng cách hạ chất lượng chỗ đặt.
   *
   * Đo trên dự án thật: cho dùng lại theo nhịp thì clip "Teamwork" lên hình hai
   * lần, lần đầu đúng chỗ nói "teamwork được", lần sau rơi vào "thực tế, các
   * bạn..." — chẳng liên quan gì.
   *
   * Còn khi người dùng tự viết "b-roll thật dày" thì họ đã chọn: dày hơn, đổi lại
   * chấp nhận vài chỗ kém khớp. Lúc ấy mới mở tới ba lần.
   */
  const maxUses = chiThiNhip
    ? Math.min(3, Math.max(1, Math.ceil(want / Math.max(1, offered.length))))
    : 1;
  /*
   * Nhịp là GỢI Ý, không phải cổng chặn — và chỗ này từng suýt bị làm sai.
   *
   * Chặn cứng "đủ nhịp thì thôi" nghe hợp lý nhưng phản tác dụng: vòng ĐẶT NỐT ở
   * cuối vẫn nhét bằng được clip user còn thừa, nên clip bị cổng gạt không biến
   * mất — nó chỉ tụt từ chỗ KHỚP NGHĨA xuống "khoảng trống rộng nhất". Tức là
   * cổng ấy không làm phim thưa hơn, chỉ làm mỗi chèn kém liên quan hơn.
   *
   * Muốn phim thưa thật thì phải BỎ clip của người dùng, mà "dùng hết tư liệu họ
   * đưa" là luật họ đã chốt. Nên ở đây chỉ ghi nhận lệch để báo lên, còn quyết
   * định bỏ bớt để người dùng cầm.
   */
  const overRhythm = offered.length > byRhythm;

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
      `hãy DÙNG HẾT ${offered.length} tư liệu dưới đây.` +
      (maxUses > 1
        ? ` Số chỗ cần nhiều hơn số tư liệu, nên mỗi tệp được dùng tối đa ` +
          `${maxUses} lần — chỉ dùng lại ở quãng nó thật sự minh hoạ được.\n\n`
        : ` Mỗi tệp một chỗ.\n\n`) +
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
    `INSERT INTO elements (id, project_id, kind, from_word_id, to_word_id, start_sec, end_sec, media_file_id, insert_layout, align, emphasis, reveal, shape, media_in_sec, media_out_sec)
     VALUES (?,?,'layout',?,?,?,?,?,?,'center','taper',?,'full',?,?)`,
  );
  // KHUNG chiếm NỬA TRÊN (người/tư liệu ở trên, chừa đáy) → phụ đề đè lên đó phải
  // XUỐNG DƯỚI cho khỏi che. Đặt khung xong thì đẩy mọi cụm chữ CHẠM khoảng thời
  // gian của khung về `bottom` (cụm có tiếng đầu rơi trong quãng khung).
  // ĐẶT TAY THẮNG MÁY: cụm nào người dùng đã tự kéo chỗ đứng (`text_opts.posY`)
  // thì KHÔNG đẩy nữa. Máy tự dời đúng cái họ vừa kéo là cách nhanh nhất khiến họ
  // tin rằng app hỏng — cùng luật với khung chọn tay được giữ nguyên.
  const pushCaptionsDown = db.prepare(
    `UPDATE elements SET position_band='bottom'
     WHERE project_id=? AND kind='text' AND COALESCE(position_band,'') <> 'bottom'
       AND (text_opts IS NULL OR json_extract(text_opts, '$.posY') IS NULL)
       AND from_word_id IN (
         SELECT id FROM words WHERE project_id=? AND start_sec >= ? AND start_sec < ?
       )`,
  );
  const taken: Array<{ start: number; end: number }> = [];
  /** Tệp nào đã lên hình mấy lần — thay cho tập "đã dùng" một-lần của bản trước. */
  const uses = new Map<string, number>();
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
    /** Lần dùng thứ mấy của chính tệp này — chọn cửa sổ khác cho lần sau. */
    nth: number;
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
  const considerPlace = (
    place: {
      fileId: string;
      fromWordId: string;
      toWordId: string;
    },
    /**
     * Chỗ này do NGƯỜI DÙNG chỉ định (neo theo lời), không phải máy đoán.
     *
     * Neo được phép nằm sát nhau: hai câu liền nhau trong thoại mà người dùng chỉ
     * định cả hai thì hai hình liền nhau chính là điều họ muốn. Chỉ còn chặn CHỒNG
     * LẤN thật — hai hình không thể cùng chiếm một khoảnh khắc.
     */
    laNeo = false,
  ): boolean => {
    const from = index.get(place.fromWordId);
    const to = index.get(place.toWordId);
    const asset = free.find((item) => item.id === place.fileId);
    if (from === undefined || to === undefined || to < from || !asset) {
      reject("mã sai");
      return false;
    }
    // Số lần một tệp được lên hình. Mặc định `maxUses = 1` (đủ tệp cho nhịp) —
    // đúng luật cũ "mỗi tệp một lần". Chỉ khi nhịp đòi nhiều hơn số tệp thì trần
    // này mới nới ra, và mỗi lần lấy một đoạn khác của clip.
    // Đủ số theo nhịp NGƯỜI DÙNG đã dặn thì dừng — chỉ khi họ có dặn.
    if (chiThiNhip && placed >= want) {
      reject("đủ nhịp");
      return false;
    }
    const daDung = uses.get(asset.id) ?? 0;
    if (daDung >= maxUses) {
      reject("trùng tệp");
      return false;
    }

    /**
     * ĐỘ DÀI THEO LỜI, không theo đồng hồ và không theo độ dài clip.
     *
     * Mô hình đã trả CẢ HAI đầu của quãng lời mà hình minh hoạ được (`fromWordId`
     * → `toWordId`); bản trước chỉ đọc đầu vào rồi cho khối chạy trọn clip, tức
     * vứt đi đúng câu trả lời mình vừa hỏi. Hệ quả đo được trên dự án thật: khối
     * dài tới 10s và 23s — hình ở lại rất lâu sau khi lời đã sang chuyện khác.
     *
     * Ngược lại, ép khối về một con số cố định cũng sai, và sai theo cách tệ hơn:
     * người không muốn lên hình nhiều thì họ nói dài về một ý, và b-roll phủ hết
     * quãng ấy mới là ĐÚNG ý họ. Đó là lý do bản ép-2,5–4s ngày trước bị bỏ.
     *
     * Nên ràng buộc là NGỮ NGHĨA: khối sống đúng bằng quãng lời nó minh hoạ. Chỉ
     * còn hai cái chặn, và cả hai đều không phải chuyện thẩm mỹ:
     *
     *  · SÀN `MIN_SECONDS` — dưới ngưỡng ấy mắt chưa kịp nhận ra hình là gì.
     *  · TRẦN LẶP — clip ngắn hơn quãng lời nhiều thì chạy hết clip rồi về mặt
     *    người, vì lặp trọn vòng lộ liễu hơn hẳn một khối dài (xem `brollLoop`).
     *
     * Neo theo GIÂY (`start_sec/end_sec`); cột mã-từ chỉ còn để tương thích.
     */
    const start = words[from].start_sec;
    if (start < START_MARGIN_SECONDS) {
      reject("sát đầu");
      return false;
    }
    /*
     * NỚI MÉP RA TỚI HẾT CÂU.
     *
     * Mô hình bọc quãng quanh CỤM TỪ mang ý — hỏi kỹ tới đâu nó vẫn trả quãng
     * hẹp, và điều đó hợp lý với việc nó đang làm: tìm chỗ KHỚP, không phải chia
     * cảnh. Đo trên dự án thật: quãng nó chọn thường 1–2 giây, tức phần lớn khối
     * rơi thẳng xuống sàn `MIN_SECONDS`.
     *
     * Nhưng chỗ tự nhiên để hình biến mất là chỗ người nói NGẮT CÂU, không phải
     * chỗ hết một cụm từ giữa câu — cắt giữa câu thì tai nghe lời chạy tiếp mà mắt
     * thấy hình đổi, và đó đọc ra là lỗi dựng. Nới tới hết câu chứa tiếng cuối là
     * lấy đúng biên mà người nghe vốn đã cảm thấy.
     */
    const lastOfSentence = (() => {
      const sentence = words[to].sentence_id;
      let at = to;
      while (at + 1 < words.length && words[at + 1].sentence_id === sentence)
        at += 1;
      return at;
    })();
    const spokenSpan = words[lastOfSentence].end_sec - start;
    const wantLen = Math.max(MIN_SECONDS, spokenSpan);
    // Ảnh tĩnh và tệp kho chưa dò ra thời lượng: không có gì để lặp nên không kẹp.
    const clipLen =
      asset.duration && asset.duration > 0.05 ? asset.duration : null;
    const len = clipLen ? Math.min(wantLen, clipLen * LOOP_TOLERANCE) : wantLen;
    // Không tràn khỏi lời: kẹp mép ra vào cuối bản chép, chừa một nhịp.
    const end = Math.min(start + len, spokenEnd - 0.1);
    const length = end - start;
    if (length < 0.5) {
      reject("hết chỗ");
      return false;
    }
    /*
     * CHỖ KHỚP NỘI DUNG THẮNG NHỊP — thứ tự ưu tiên của sản phẩm, không phải sở
     * thích của bước này:
     *
     *   1. hình lên đúng chỗ lời nói về nó   ← tối thượng
     *   2. dùng hết tư liệu người dùng đưa
     *   3. nhịp, khoảng cách, độ dài          ← thứ yếu
     *
     * Bản trước gạt mọi đề xuất nằm trong `minGap` của một chèn đã đặt (bộ Prism:
     * 3,75 giây). Đo trên dự án thật: 6 đề xuất bị gạt như thế, và chúng KHÔNG
     * biến mất — chúng rơi xuống vòng "đặt nốt" vốn mù nội dung, rồi hạ cánh ở
     * những quãng lời chẳng liên quan gì. Tức cổng ấy đổi 6 chỗ ĐÚNG lấy 6 chỗ
     * SAI, chỉ để giữ một con số nhịp thuộc hàng thứ yếu.
     *
     * Nên chỉ còn một sàn CỨNG, và nó không phải chuyện thẩm mỹ: hai lần cắt cảnh
     * cách nhau dưới `HARD_GAP` thì mắt đọc ra là lỗi kỹ thuật chứ không ra là
     * hai cảnh. Rộng hơn ngần ấy thì để nội dung quyết.
     */
    const gap = laNeo ? 0 : HARD_GAP;
    if (taken.some((item) => start < item.end + gap && item.start - gap < end)) {
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
    // Khung PHỦ KÍN (cover, cắt) vs VỪA-KHUNG (contain, nền đen): chọn theo tỉ lệ
    // clip, KHÔNG xoay vòng — clip NGANG (screen recording) letterbox cho khỏi cắt
    // mất thông tin; clip DỌC/VUÔNG phủ kín cho khỏi viền đen thừa. Chỉ khi pool có
    // cả hai và biết tỉ lệ; còn lại (ô chia, tỉ lệ ẩn) xoay vòng như cũ cho đa dạng.
    const hasFullFit =
      pool.includes("broll-full") && pool.includes("broll-fit");
    const layout =
      hasFullFit && mediaAspect != null
        ? mediaAspect > 1
          ? "broll-fit"
          : "broll-full"
        : pool.length
          ? pool[duyet.length % pool.length]
          : null;

    // `to_word_id`: từ cuối cùng bắt đầu trước mép ra — cột neo cũ, đủ để bảng
    // sửa hiển thị; mốc thật là GIÂY ở trên.
    let hiIdx = from;
    while (hiIdx + 1 < words.length && words[hiIdx + 1].start_sec < end)
      hiIdx += 1;
    duyet.push({
      fileId: asset.id,
      nth: daDung,
      loWordId: words[from].id,
      hiWordId: words[hiIdx].id,
      startSec: start,
      endSec: end,
      layout,
    });
    taken.push({ start, end });
    uses.set(asset.id, daDung + 1);
    placed += 1;
    return true;
  };

  /*
   * PASS 0 — NEO THEO LỜI, chạy TRƯỚC mô hình và thắng mô hình.
   *
   * Người dùng hay viết mô tả tư liệu bằng chính câu họ nói ("Không biết gì về
   * code cả"). Đó không phải mô tả hình, đó là CHỈ CHỖ — và chỗ ấy tra ra được
   * bằng khớp chuỗi, chắc chắn tuyệt đối. Hỏi mô hình một câu đã có đáp án sẵn là
   * đổi chắc chắn lấy may rủi: đo ba lượt trên cùng dữ liệu, mô hình cho 3/8, 5/9
   * rồi 1/8 chỗ khớp.
   *
   * Chạy trước nên nó chiếm chỗ trước; mô hình chỉ còn lo những tư liệu mà người
   * dùng mô tả bằng HÌNH, đúng phần việc cần đoán.
   */
  // Chắc chắn nhất đi trước: hai neo hiếm khi chồng nhau, nhưng khi có thì chỗ
  // khớp rõ hơn phải được giữ.
  const neo = free
    .filter((asset) => asset.description?.trim())
    .map((asset) => ({ asset, hit: neoTheoLoi(asset.description!, words) }))
    .filter((x) => x.hit)
    .sort((a, b) => b.hit!.score - a.hit!.score);
  for (const { asset, hit: h } of neo) {
    const hit = h!;
    considerPlace(
      {
        fileId: asset.id,
        fromWordId: words[hit.from].id,
        toWordId: words[hit.to].id,
      },
      true,
    );
  }

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
    const soter = trongDuAn.filter((asset) => (uses.get(asset.id) ?? 0) === 0);
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
  // Có chỉ thị nhịp thì `want` thành trần CỨNG: quá số ấy là thôi, kể cả còn tệp
  // chưa dùng. Không có chỉ thị thì giữ nguyên luật dùng-hết như trước.
  const conThua = trongDuAn.filter((asset) => (uses.get(asset.id) ?? 0) === 0);
  if (conThua.length > 0 && !(chiThiNhip && placed >= want)) {
    // Cùng SÀN CỨNG với vòng khớp-nội-dung: chừa 0,2 giây thì hai khối dính sát
    // nhau và đọc ra là nhấp nháy — đo được trên dự án thật, ba khối liền nhau
    // cách 0,2s và 0,4s.
    const GAP_MARGIN = HARD_GAP;
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
      if (chiThiNhip && placed >= want) break;
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
        nth: uses.get(asset.id) ?? 0,
        loWordId: words[lo].id,
        hiWordId: words[hi].id,
        startSec: start,
        endSec: end,
        layout,
      });
      taken.push({ start, end });
      uses.set(asset.id, (uses.get(asset.id) ?? 0) + 1);
      placed += 1;
    }
  }

  /*
   * LẤY ĐOẠN NÀO CỦA CLIP — chọn trước khi ghi, vì phép đo là bất đồng bộ còn
   * `db.transaction` thì không.
   *
   * Bản trước luôn lấy từ giây 0. Đo trên tư liệu thật cho thấy đó là chỗ tệ nhất
   * để bắt đầu: `b-roll-1.mp4` có khoảnh khắc người ngẩng mặt nhìn camera ở giây
   * 7,5 — khối cũ lấy 5,2 giây đầu, tức giữ trọn cảnh quay lưng rồi cắt ngay
   * trước lúc đáng xem. Cửa sổ chọn theo điểm nhấn cho ra 6,0–10,0.
   *
   * Song song vì mỗi clip là một lượt ffmpeg độc lập, và kết quả có cache nên
   * lượt gieo sau không phải đo lại.
   */
  // Khoá theo VỊ TRÍ trong `duyet`, không theo tệp: một tệp có thể lên hình mấy
  // lần, mỗi lần một cửa sổ khác — khoá theo tệp thì các lần sau đè lên nhau.
  const windows = new Map<number, { in: number; out: number }>();
  // Mỗi tệp lên hình TẤT CẢ mấy lần — biết tổng thì mới chia đều chỗ đứng được,
  // mà lúc đặt từng chỗ thì chưa biết còn mấy chỗ nữa cho cùng tệp ấy.
  const usesTotal = new Map<string, number>();
  for (const item of duyet)
    usesTotal.set(item.fileId, (usesTotal.get(item.fileId) ?? 0) + 1);
  await Promise.all(
    duyet.map(async (item, at) => {
      const analysis = await readClipAnalysis(item.fileId).catch(() => null);
      // Ảnh tĩnh và clip đo hỏng: để trống = lấy trọn clip, đúng như trước.
      if (!analysis) return;
      windows.set(
        at,
        pickWindow(
          analysis,
          item.endSec - item.startSec,
          item.nth,
          usesTotal.get(item.fileId) ?? 1,
        ),
      );
    }),
  );

  // Mọi tư liệu đều là tệp THẬT của dự án (không còn kho phải chép về) — ghi thẳng.
  db.transaction(() => {
    for (const [at, item] of duyet.entries()) {
      const window = windows.get(at);
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
        window?.in ?? null,
        window?.out ?? null,
      );
      // Phụ đề chạm khung này → xuống dưới cho khỏi che khung.
      pushCaptionsDown.run(projectId, projectId, item.startSec, item.endSec);
    }
  })();

  const rejected = Object.values(rejections).reduce((sum, n) => sum + n, 0);
  const why = summarize(rejections);
  const nhipWarn = overRhythm
    ? `${offered.length} tư liệu cho ${spokenSeconds.toFixed(0)} giây lời — nhịp bộ dáng ` +
      `(${pack.rhythm.brollEverySec} giây/lần) hợp với khoảng ${byRhythm}. Đã dùng hết như luật, ` +
      `nhưng cắt cảnh sẽ dày hơn nhịp bộ dáng.`
    : "";
  if (nhipWarn) console.warn(`[b-roll] ${nhipWarn}`);
  return { placed, rejected, why: [why, nhipWarn].filter(Boolean).join(" · ") };
}
