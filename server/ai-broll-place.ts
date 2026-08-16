import { voiBoiCanh } from "./ai-context";
import { copyIntoProject, libraryCandidates } from "./asset-library";
import { db, newId } from "./db";
import { findLayout, layoutFitsMedia, type LayoutKindId } from "./layout-kinds";
import { ask, object } from "./llm";
import { settingsForProject } from "./settings";
import { readStylePack } from "./style-pack-store";

/** Nguồn tư liệu đã chốt lúc tạo dự án; dự án cũ chưa có thì theo cài đặt. */
function insertSourceOf(projectId: string) {
  const row = db
    .prepare("SELECT insert_source, owner_id FROM projects WHERE id=?")
    .get(projectId) as
    { insert_source: string | null; owner_id: string | null } | undefined;
  const chot = row?.insert_source;
  if (chot === "project" || chot === "starred" || chot === "library")
    return { nguon: chot, ownerId: row?.owner_id ?? null };
  return {
    nguon: settingsForProject(projectId).insertSource,
    ownerId: row?.owner_id ?? null,
  };
}

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
/** Tổng thời lượng bị tư liệu che, tính trên toàn video. */
const MAX_SHARE = 0.3;
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
  const trongDuAn = assets.filter((asset) => !used.has(asset.id));

  /**
   * Ứng viên TỪ KHO dùng chung, nếu người dùng cho phép.
   *
   * Chưa chép về dự án ở bước này: chép hết cả kho về rồi mô hình chỉ chọn ba cái
   * là dự án phình ra hàng trăm tệp không ai dùng. Chỉ cái nào được CHỌN mới chép,
   * ở dưới kia.
   *
   * Mã tạm mang tiền tố `kho:` để phân biệt với mã hàng thật trong `media_files` —
   * mô hình chỉ trả lại đúng chuỗi ta đưa, nên tiền tố là đủ.
   */
  const { nguon, ownerId } = insertSourceOf(projectId);
  const tuKho =
    nguon === "project" || !ownerId
      ? []
      : libraryCandidates(
          ownerId,
          nguon === "library" ? "library" : "starred",
        ).map(
          (item): Asset => ({
            id: `kho:${item.file}`,
            name: item.title,
            description: item.description,
            // Chưa biết tỉ lệ/độ dài ở bước này — chép về mới có. Null → khung
            // hợp mọi tỉ lệ + độ dài rơi về mặc định.
            width: null,
            height: null,
            duration: null,
          }),
        );

  const free = [...trongDuAn, ...tuKho];
  if (free.length === 0) return { placed: 0, rejected: 0, why: "" };

  const words = db
    .prepare(
      "SELECT id, text, start_sec, end_sec FROM words WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Array<Word & { text: string }>;
  if (words.length < 10) return { placed: 0, rejected: 0, why: "" };

  const spokenEnd = words.at(-1)!.end_sec;
  const spokenSeconds = spokenEnd - words[0].start_sec;
  // Mật độ do người dùng đặt ở trang Cài đặt. Đặt 0 nghĩa là "đừng tự chèn" —
  // tôn trọng đúng nghĩa đó, không kẹp lên 1.
  const moiPhut = settingsForProject(projectId).placesPerMinute;
  if (moiPhut <= 0)
    return { placed: 0, rejected: 0, why: "người dùng tắt tự chèn" };
  // Không nhắm nhiều hơn số tư liệu đang có: bảo nó tìm 5 chỗ trong khi chỉ có 2
  // tấm hình là mời nó đặt cùng một tấm hai lần, mà luật dưới kia sẽ gạt ngay.
  const pack = readStylePack(projectId);
  // NHỊP của bộ dáng: mấy giây một lần chèn. Nó là con số, không phải enum —
  // "nhanh" khác "êm" chủ yếu ở đây chứ không ở danh sách kiểu hiện ra.
  //
  // Lấy mức DÀY HƠN trong hai nguồn (cài đặt của người dùng và nhịp của bộ
  // dáng), rồi vẫn kẹp bởi số tư liệu đang có: bảo mô hình tìm 5 chỗ trong khi
  // chỉ có 2 tấm hình là mời nó đặt cùng một tấm hai lần.
  const byUser = Math.round((spokenSeconds / 60) * moiPhut);
  const byPack = Math.round(spokenSeconds / pack.rhythm.brollEverySec);
  // LUẬT: DÙNG HẾT b-roll USER tự tải (`trongDuAn`) — họ chỉ thêm cái cần dùng.
  // Số nhắm = MAX(số user, nhịp cài đặt, nhịp bộ dáng). KHO chỉ BÙ nếu user chưa
  // đủ nhịp; đủ rồi thì không mời kho (khỏi lấp video bằng tư liệu tự-lấy).
  const target = Math.max(trongDuAn.length, byUser, byPack);
  const offered = [
    ...trongDuAn,
    ...tuKho.slice(0, Math.max(0, target - trongDuAn.length)),
  ];
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
  let budget = spokenSeconds * MAX_SHARE;

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
  {
    for (const place of proposal.places) {
      const from = index.get(place.fromWordId);
      const to = index.get(place.toWordId);
      const asset = free.find((item) => item.id === place.fileId);
      if (from === undefined || to === undefined || to < from || !asset) {
        reject("mã sai");
        continue;
      }
      // Mỗi tệp một lần. Mô hình lặp lại một tệp là chuyện thường, mà cùng một
      // hình hiện hai lần trong một video ngắn thì lộ ngay là máy làm.
      if (seen.has(asset?.id ?? place.fileId)) {
        reject("trùng tệp");
        continue;
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
        continue;
      }
      const clipLen =
        asset.duration && asset.duration > 0.05 ? asset.duration : MIN_SECONDS;
      // Không tràn khỏi lời: kẹp mép ra vào cuối bản chép, chừa một nhịp.
      const end = Math.min(start + clipLen, spokenEnd - 0.1);
      const length = end - start;
      if (length < 0.5) {
        reject("hết chỗ");
        continue;
      }
      // B-roll USER tự tải MIỄN budget (luật: dùng hết cái họ đưa); chỉ tư liệu
      // từ KHO (`kho:…`) mới bị trần 30% để khỏi lấp video bằng kho tự-lấy.
      const isUserBroll = !asset.id.startsWith("kho:");
      if (!isUserBroll && length > budget) {
        reject("hết ngân sách");
        continue;
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
        continue;
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
      budget -= length;
      placed += 1;
    }
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
      // Khoảng RỘNG NHẤT còn lại — tính lại mỗi lần (đã trừ chỗ vừa chèn).
      const gaps = freeGaps();
      if (gaps.length === 0) break; // video đã kín thật
      const gap = gaps.reduce((big, g) =>
        g.end - g.start > big.end - big.start ? g : big,
      );
      const avail = gap.end - gap.start - 2 * GAP_MARGIN;
      if (avail < 0.5) break; // khoảng lớn nhất cũng không đủ → dừng, số còn lại đành chịu
      // Giữ full-length nếu vừa; chật thì gọt ĐÚNG chỗ trống (thà ngắn còn hơn rơi).
      const clipLen =
        asset.duration && asset.duration > 0.05 ? asset.duration : MIN_SECONDS;
      const start = gap.start + GAP_MARGIN;
      const end = start + Math.min(clipLen, avail);
      // Khung theo tỉ lệ (như vòng chính).
      const mediaAspect =
        asset.width && asset.height ? asset.width / asset.height : null;
      const fitting = brollLayouts.filter((id) =>
        layoutFitsMedia(id, mediaAspect),
      );
      const pool = fitting.length ? fitting : brollLayouts;
      const layout = pool.length ? pool[duyet.length % pool.length] : null;
      // Từ neo gần mốc — cột cũ cho bảng sửa; mốc thật là GIÂY.
      let lo = 0;
      for (let i = 1; i < words.length; i += 1)
        if (
          Math.abs(words[i].start_sec - start) <
          Math.abs(words[lo].start_sec - start)
        )
          lo = i;
      let hi = lo;
      while (hi + 1 < words.length && words[hi + 1].start_sec < end) hi += 1;
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

  // Giờ mới chép, và chỉ chép cái ĐÃ ĐƯỢC CHỌN.
  const daChep = new Map<string, string>();
  for (const item of duyet) {
    if (!item.fileId.startsWith("kho:") || daChep.has(item.fileId)) continue;
    const row = await copyIntoProject(projectId, item.fileId.slice(4));
    if (row) daChep.set(item.fileId, String(row.id));
  }

  db.transaction(() => {
    for (const item of duyet) {
      // Tệp từ kho mà chép hỏng thì bỏ qua: neo phần tử vào mã `kho:…` là bàn
      // dựng mở ra thấy một khối chèn không có tệp nào phía sau.
      const fileId = item.fileId.startsWith("kho:")
        ? daChep.get(item.fileId)
        : item.fileId;
      if (!fileId) {
        placed -= 1;
        continue;
      }
      insert.run(
        newId("e"),
        projectId,
        item.loWordId,
        item.hiWordId,
        item.startSec,
        item.endSec,
        fileId,
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
