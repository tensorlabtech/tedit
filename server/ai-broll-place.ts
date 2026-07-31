import { voiBoiCanh } from "./ai-context";
import { copyIntoProject, libraryCandidates } from "./asset-library";
import { db, newId } from "./db";
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

/** Ngắn hơn thì nháy một cái đã hết, dài hơn thì mất mặt người nói quá lâu. */
const MIN_SECONDS = 1.2;
const MAX_SECONDS = 4;
/** Tổng thời lượng bị tư liệu che, tính trên toàn video. */
const MAX_SHARE = 0.3;
/** Hai lần chèn liền nhau phải cách ngần này, không thì thành nhấp nháy. */
const MIN_GAP_SECONDS = 3;
/** Chừa đoạn mở: cắt cảnh ngay giây đầu là mất mặt người nói đúng lúc cần nhất. */
const START_MARGIN_SECONDS = 2;

type Word = { id: string; start_sec: number; end_sec: number };
type Asset = { id: string; name: string; description: string | null };

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
      `SELECT id, name, description FROM media_files
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
          "SELECT media_file_id FROM elements WHERE project_id=? AND kind='insert' AND media_file_id IS NOT NULL",
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
        ).map((item) => ({
          id: `kho:${item.file}`,
          name: item.title,
          description: item.description,
        }));

  const free = [...trongDuAn, ...tuKho];
  if (free.length === 0) return { placed: 0, rejected: 0, why: "" };

  const words = db
    .prepare(
      "SELECT id, text, start_sec, end_sec FROM words WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Array<Word & { text: string }>;
  if (words.length < 10) return { placed: 0, rejected: 0, why: "" };

  const spokenSeconds = words.at(-1)!.end_sec - words[0].start_sec;
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
  const want = Math.max(1, Math.min(free.length, Math.max(byUser, byPack)));

  // Kho kiểu hiện ra ưu tiên của bộ dáng. Kiểu ĐẦU danh sách là kiểu mọi lần
  // chèn của chặng này dùng — mô hình không chọn kiểu hiện ra, nó chỉ chọn CHỖ.
  const revealForPack = pack.effectBias.insertReveal[0] ?? "none";

  const proposal = await ask<Proposal>({
    instructions: voiBoiCanh(INSTRUCTIONS, projectId),
    input:
      `Lời dài ${spokenSeconds.toFixed(0)} giây. Nhắm khoảng ${want} chỗ chèn.\n\n` +
      `Tư liệu (mã|tên|nội dung):\n` +
      free.map((a) => `${a.id}|${a.name}|${a.description}`).join("\n") +
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
  const insert = db.prepare(
    `INSERT INTO elements (id, project_id, kind, from_word_id, to_word_id, media_file_id, align, emphasis, reveal, shape)
     VALUES (?,?,'insert',?,?,?,'center','taper',?,'full')`,
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
  const duyet: Array<{ fileId: string; lo: number; hi: number }> = [];
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
       * Nới bằng cách MỞ RỘNG DẢI TỪ, không phải sửa hai con số.
       *
       * Phần tử chèn neo vào MÃ TỪ (`from_word_id`/`to_word_id`), nên độ dài
       * thật lúc dựng là quãng của dải từ ấy — mọi phép nới trên `start`/`end`
       * chỉ sống trong hàm này rồi bị vứt. Bản trước tôi nới đúng kiểu đó: phép
       * kiểm đi qua, còn video dựng ra vẫn 0,56s vì dải từ "lập một công ty"
       * vốn chỉ dài bấy nhiêu.
       *
       * Mở đều hai phía để chỗ nhấn không trôi, và dừng khi chạm mép bản chép
       * lời.
       */
      let lo = from;
      let hi = to;
      const span = () => words[hi].end_sec - words[lo].start_sec;
      while (span() < MIN_SECONDS && (lo > 0 || hi < words.length - 1)) {
        if (hi < words.length - 1) hi += 1;
        if (span() >= MIN_SECONDS) break;
        if (lo > 0) lo -= 1;
      }
      const start = words[lo].start_sec;
      const end = words[hi].end_sec;
      const length = end - start;
      if (length > MAX_SECONDS) {
        reject("quá dài");
        continue;
      }
      if (length < MIN_SECONDS) {
        reject("hết chỗ nới");
        continue;
      }
      if (start < START_MARGIN_SECONDS) {
        reject("sát đầu");
        continue;
      }
      if (length > budget) {
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

      duyet.push({ fileId: asset.id, lo, hi });
      taken.push({ start, end });
      seen.add(asset.id);
      budget -= length;
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
        words[item.lo].id,
        words[item.hi].id,
        fileId,
        revealForPack,
      );
    }
  })();

  const rejected = Object.values(rejections).reduce((sum, n) => sum + n, 0);
  return { placed, rejected, why: summarize(rejections) };
}
