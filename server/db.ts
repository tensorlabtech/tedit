import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { DB_PATH } from "./paths";

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft',
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS media_files (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  role        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  duration    REAL,
  width       INTEGER,
  height      INTEGER,
  has_audio   INTEGER NOT NULL DEFAULT 0,
  stored_path TEXT NOT NULL,
  thumb_path  TEXT
);

-- Nhạc nền: MỘT HÀNG MỘT BÀI, có mốc bắt đầu/kết thúc riêng.
--
-- Trước đây nhạc là hai cột trên bảng projects (một đường dẫn, một mức âm
-- lượng), nên nó phủ nguyên video và không có chỗ nào trên dải để nhìn hay sửa.
-- Mốc ghi theo thời gian NGUỒN, đúng trục với mọi thứ khác trên dải; lúc xuất
-- mới quy sang thời gian của bản đã cắt.
CREATE TABLE IF NOT EXISTS music_tracks (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  name        TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  start_sec   REAL NOT NULL DEFAULT 0,
  end_sec     REAL NOT NULL,
  volume      REAL NOT NULL DEFAULT 0.18
);

CREATE TABLE IF NOT EXISTS sentences (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  text        TEXT NOT NULL,
  start_sec   REAL NOT NULL,
  end_sec     REAL NOT NULL,
  removed     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS words (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sentence_id TEXT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  text        TEXT NOT NULL,
  start_sec   REAL NOT NULL,
  end_sec     REAL NOT NULL,
  confidence  REAL
);

-- Phần tử gắn vào KHOẢNG TỪ, không gắn vào giây: bỏ một câu phía trước thì
-- mọi thứ phía sau vẫn dính đúng chỗ mà không phải tính lại mốc.
CREATE TABLE IF NOT EXISTS elements (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  from_word_id  TEXT NOT NULL,
  to_word_id    TEXT NOT NULL,
  content       TEXT,
  position_band TEXT,
  media_file_id TEXT REFERENCES media_files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS jobs (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  status      TEXT NOT NULL,
  progress    INTEGER NOT NULL DEFAULT 0,
  message     TEXT,
  result_path TEXT,
  updated_at  INTEGER NOT NULL
);

-- Đoạn bị cắt bằng tay, tính theo giây trên dải gốc. Tách khỏi bảng sentences vì
-- người dùng cắt được cả chỗ KHÔNG có từ nào — hít thở, im lặng, tiếng ồn.
-- CHỈ ĐỌC, để đổi dữ liệu cũ. Việc "chỗ này không vào video" giờ diễn đạt bằng
-- ĐOẠN: bỏ đoạn, hoặc gọt mép đoạn thành hở. absorbManualCuts() đổi hàng cũ sang
-- đoạn rồi xoá; không có đường nào ghi thêm vào bảng này nữa.
CREATE TABLE IF NOT EXISTS manual_cuts (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  start_sec   REAL NOT NULL,
  end_sec     REAL NOT NULL
);

-- Đoạn: đơn vị NHÌN THẤY được trên dải, và là chỗ để gắn effect về sau.
-- Giữ thứ tự theo thời gian (position tăng theo start_sec) — cho đổi chỗ thì mốc
-- gốc sang mốc xuất không còn tăng dần, và mọi phần tử neo vào từ sẽ trôi.
CREATE TABLE IF NOT EXISTS segments (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  start_sec   REAL NOT NULL,
  end_sec     REAL NOT NULL,
  label       TEXT,
  removed     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_music_project ON music_tracks(project_id, position);
CREATE INDEX IF NOT EXISTS idx_segments_project ON segments(project_id, position);
-- Những lời nhắc người dùng đã BỎ QUA.
--
-- Hàng soát tự dựng lại mỗi lần mở dự án (nó suy ra từ lời, từ chữ, từ khoảng
-- lặng), nên "bỏ qua" mà chỉ nhớ trong bộ nhớ trình duyệt thì tải lại là lời
-- nhắc mọc lại y nguyên — người dùng đã trả lời rồi mà vẫn bị hỏi lại.
--
-- Khoá là MÃ LỜI NHẮC — "unsure-" cộng mã từ, "silence-" cộng mã câu… — suy từ
-- chính hàng dữ liệu nó nói tới. Hàng đó mất thì lời nhắc cũng không dựng lại
-- nữa, nên dòng thừa ở đây vô hại.
-- Hiệu ứng người dùng đặt tay — MỘT VẬT CÓ QUÃNG, không phải một cái cờ.
--
-- Bảng trước tên là junctions, khoá bằng at_sec: mỗi dòng là "chỗ nối tại giây
-- này thì dùng kiểu khác mặc định". Vì khoá là một MỐC nên không nói được
-- "hiệu ứng này dài bằng này", và vì nó chỉ tồn tại ở chỗ có vết cắt nên không
-- đặt được hiệu ứng ở chỗ bình thường. Cả hai đều là thứ người dùng cần.
--
-- Giờ một hiệu ứng có start_sec/end_sec như chữ tự do. Chỗ nối tại vết cắt chỉ
-- là trường hợp riêng: quãng của nó vắt qua vết cắt, đỉnh xung rơi đúng vào
-- đó — nên bản cũ dựng ra hình y hệt, không đổi một khung nào.
--
-- Vẫn CHỈ lưu cái người dùng động vào. Chỗ cắt chưa ai đụng thì suy ra theo mặc
-- định của dự án, không gieo sẵn — gieo sẵn thì cắt thêm một chỗ là phải nhớ
-- gieo tiếp, quên một đường là chỗ đó câm mà chẳng ai biết.
--
-- Neo bằng giây của BẢN GỐC. Mốc trên bản đã cắt thì xê dịch mỗi lần bỏ thêm
-- một quãng ở phía trước.
CREATE TABLE IF NOT EXISTS effects (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  start_sec   REAL NOT NULL,
  end_sec     REAL NOT NULL,
  kind        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dismissed_issues (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  issue_id    TEXT NOT NULL,
  PRIMARY KEY (project_id, issue_id)
);

CREATE INDEX IF NOT EXISTS idx_effects_project ON effects(project_id, start_sec);
CREATE INDEX IF NOT EXISTS idx_cuts_project ON manual_cuts(project_id, start_sec);
CREATE INDEX IF NOT EXISTS idx_words_project ON words(project_id, position);
CREATE INDEX IF NOT EXISTS idx_sentences_project ON sentences(project_id, position);
CREATE INDEX IF NOT EXISTS idx_files_project ON media_files(project_id, role, position);
CREATE INDEX IF NOT EXISTS idx_jobs_project ON jobs(project_id, kind);
`);

// Thêm cột theo kiểu vá dần: người dùng đã có CSDL cũ thì không mất dữ liệu.
for (const [table, column, type] of [
  ["projects", "music_path", "TEXT"],
  ["projects", "music_volume", "REAL DEFAULT 0.18"],
  ["projects", "strip_second_width", "INTEGER DEFAULT 200"],
  // Số giây dải ảnh biểu diễn — bàn dựng cần để tính thang vẽ. `NULL` nghĩa là
  // dải dựng bằng bản cũ, bàn dựng tự suy ra từ thời lượng.
  ["projects", "strip_seconds", "REAL"],
  // Thang gốc của dải ảnh: một giây rộng bao nhiêu px khi ảnh vẽ đúng chiều cao
  // dải. `NULL` thì bàn dựng lấy mặc định 200 — đúng với mọi dải dựng trước đó.
  ["projects", "strip_native_second_width", "REAL"],
  // Đã sinh chữ từ lời cho dự án này chưa. Sinh ĐÚNG MỘT LẦN: xoá hết chữ đi
  // rồi mở lại mà nó tự mọc lại thì người dùng không xoá được gì cả.
  ["projects", "captions_seeded", "INTEGER DEFAULT 0"],
  // Đã dựng lại đoạn theo CỤM CHỮ và KHOẢNG LẶNG chưa. Dự án cũ chia đoạn theo
  // "10 giây một khối" nên dải phim và bảng Lời chia theo hai nhịp khác nhau.
  ["projects", "segments_by_caption", "INTEGER DEFAULT 0"],
  ["projects", "subtitles", "INTEGER DEFAULT 0"],
  // Đã đổi dáng mặc định của chữ sinh từ lời sang "Dẫn nhỏ · ý to" chưa.
  ["projects", "caption_style", "INTEGER DEFAULT 0"],
  ["elements", "layout", "TEXT DEFAULT 'flush'"],
  // Neo theo GIỜ — chỉ dùng cho chữ tự do (tiêu đề, con số), khi hai cột neo
  // theo từ để rỗng. Cùng cách nhạc nền neo: mốc của BẢN GỐC, lúc xuất thì dồn
  // theo mấy quãng đã bỏ.
  ["elements", "start_sec", "REAL"],
  ["elements", "end_sec", "REAL"],
  ["elements", "keywords", "TEXT"],
  // Hai trục bố cục. `layout` cũ (gộp cả hai) vẫn để nguyên cho phần tử cũ đọc
  // được — `fromLegacyLayout` đổi khi dựng, không sửa dữ liệu đã lưu.
  ["elements", "align", "TEXT DEFAULT 'center'"],
  ["elements", "emphasis", "TEXT"],
  // Cách tư liệu chèn hiện ra: none | fade | zoom | slide | ken
  ["elements", "reveal", "TEXT DEFAULT 'none'"],
  // Hình dáng khung tư liệu: square | portrait | wide | full
  ["elements", "shape", "TEXT DEFAULT 'full'"],
  ["projects", "subtitle_band", "TEXT DEFAULT 'bottom'"],
  // Chiều nhấn zoom ở mỗi chỗ nối đoạn: none | in | out. Mặc định TẮT — nó đổi dáng
  // cả video nên phải là lựa chọn có ý thức. Cột để TEXT vì nó là ba trạng thái, và
  // giá trị 0/1 cũ vẫn đọc được (`pipeline.ts` đổi khi dựng).
  ["projects", "zoom_punch", "TEXT DEFAULT 'none'"],
] as const) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

/**
 * Nới ràng buộc NOT NULL trên hai cột neo của `elements`.
 *
 * Chữ sinh từ lời phải neo vào TỪ — bỏ một câu phía trước thì nó vẫn dính đúng
 * mấy tiếng nó đang chép. Nhưng một cái tiêu đề thì chẳng chép tiếng nào; nó
 * thuộc về một KHOẢNH KHẮC, và neo nó vào một câu bất kỳ chỉ để cho đủ cột là
 * bịa ra một quan hệ không có thật.
 *
 * SQLite không sửa được ràng buộc tại chỗ, phải dựng bảng mới rồi đổi tên. Chép
 * cột theo `PRAGMA table_info` chứ không viết tay danh sách: bảng này đã mọc
 * thêm sáu cột qua vòng vá dần bên dưới, viết tay là mất đúng những cột đó.
 */
function noiRangBuocNeo() {
  const columns = db.prepare("PRAGMA table_info(elements)").all() as Array<{
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
  }>;
  const neo = columns.filter(
    (column) =>
      (column.name === "from_word_id" || column.name === "to_word_id") &&
      column.notnull === 1,
  );
  if (neo.length === 0) return;

  const khai = columns.map((column) => {
    const batBuoc =
      column.notnull === 1 &&
      column.name !== "from_word_id" &&
      column.name !== "to_word_id";
    return [
      column.name,
      column.type || "TEXT",
      column.name === "id" ? "PRIMARY KEY" : "",
      batBuoc ? "NOT NULL" : "",
      column.dflt_value === null ? "" : `DEFAULT ${column.dflt_value}`,
      column.name === "project_id"
        ? "REFERENCES projects(id) ON DELETE CASCADE"
        : column.name === "media_file_id"
          ? "REFERENCES media_files(id) ON DELETE CASCADE"
          : "",
    ]
      .filter(Boolean)
      .join(" ");
  });
  const ten = columns.map((column) => column.name).join(", ");

  db.pragma("foreign_keys = OFF");
  db.transaction(() => {
    db.exec(`CREATE TABLE elements_moi (${khai.join(", ")})`);
    db.exec(`INSERT INTO elements_moi (${ten}) SELECT ${ten} FROM elements`);
    db.exec("DROP TABLE elements");
    db.exec("ALTER TABLE elements_moi RENAME TO elements");
  })();
  db.pragma("foreign_keys = ON");
}
noiRangBuocNeo();

/**
 * Chuyển bản sửa chỗ nối cũ (một MỐC) sang hiệu ứng mới (một QUÃNG).
 *
 * Quãng suy ra đúng bằng nhịp hai nửa mà bản cũ đang dựng, nên video xuất ra
 * không đổi một khung nào — chỉ là cùng một thứ giờ được ghi bằng cách nói được
 * nhiều hơn.
 *
 * Bộ số phải khớp `junctionHalves` của `server/render.ts`.
 */
function doiChoNoiThanhHieuUng() {
  const co = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get("junctions");
  if (!co) return;

  const nhip: Record<string, [number, number]> = {
    "zoom-in": [0.5, 0.15],
    "zoom-out": [0.15, 0.5],
    flash: [0.12, 0.12],
    dip: [0.18, 0.18],
    none: [0.5, 0.15],
  };
  const cu = db
    .prepare("SELECT project_id, at_sec, kind FROM junctions")
    .all() as Array<{ project_id: string; at_sec: number; kind: string }>;

  db.transaction(() => {
    for (const row of cu) {
      const [truoc, sau] = nhip[row.kind] ?? nhip["zoom-in"];
      db.prepare(
        "INSERT OR IGNORE INTO effects (id, project_id, start_sec, end_sec, kind) VALUES (?,?,?,?,?)",
      ).run(
        `eff_cu_${row.project_id}_${row.at_sec.toFixed(3)}`,
        row.project_id,
        row.at_sec - truoc,
        row.at_sec + sau,
        row.kind,
      );
    }
    db.exec("DROP TABLE junctions");
  })();
}
doiChoNoiThanhHieuUng();

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
