import Database from "better-sqlite3";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { arrangementFor } from "./caption-arrangement";
import { findStylePack } from "./style-pack-catalog";
import { CROSS_TO_VISIBLE } from "./junction-kinds";
import { DB_PATH } from "./paths";

mkdirSync(dirname(DB_PATH), { recursive: true });

/**
 * Chép một bản CSDL sang bên cạnh trước khi dựng lại một bảng.
 *
 * Khối dựng lại nằm trong transaction nên an toàn về mặt CSDL — hoặc xong cả,
 * hoặc không gì. Nhưng nó `DROP TABLE`, và transaction không cứu được trường hợp
 * danh sách cột dựng ra SAI: lúc ấy lệnh chạy trót lọt, dữ liệu cũ đi mất, và
 * không có gì để quay về.
 *
 * Đây là dữ liệu KHÔNG TÁI TẠO LẠI ĐƯỢC (xem `deploy/docker-compose.yml`), nên
 * vài trăm MB đĩa cho một bản chép là cái giá rẻ nhất trong cả dự án.
 *
 * Giữ ba bản gần nhất. Giữ hết thì mỗi lượt deploy lại thêm một bản và chính chỗ
 * sao lưu làm đầy ổ mà nó sinh ra để bảo vệ.
 */
function backupBeforeRebuild(label: string) {
  if (!existsSync(DB_PATH)) return;
  const dir = dirname(DB_PATH);
  const stem = `${basename(DB_PATH)}.bak-`;
  try {
    // `VACUUM INTO` chứ không chép tệp: chế độ WAL để một phần dữ liệu mới nằm
    // trong `-wal` chưa nhập vào tệp chính, nên `copyFile` ra một bản thiếu đúng
    // những thay đổi gần nhất — bản sao lưu trông có vẻ ổn mà lại cũ hơn hiện tại.
    db.prepare("VACUUM INTO ?").run(
      join(dir, `${stem}${label}-${Date.now()}`),
    );
  } catch (error) {
    // Sao lưu hỏng thì NÓI RA rồi dừng hẳn, không dựng lại bảng. Chạy tiếp là
    // đúng lúc không có lưới lại đi làm động tác nguy hiểm nhất.
    throw new Error(
      `Không sao lưu được CSDL trước khi dựng lại bảng ${label}: ${error}`,
    );
  }
  const olds = readdirSync(dir)
    .filter((name) => name.startsWith(stem))
    .sort();
  for (const name of olds.slice(0, Math.max(0, olds.length - 3))) {
    rmSync(join(dir, name), { force: true });
  }
}

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

-- KHO NHẠC DÙNG CHUNG — khác hẳn music_tracks ở trên.
--
-- music_tracks là bài ĐÃ ĐẶT vào một dự án, có mốc và âm lượng riêng. Còn đây
-- là danh mục để CHỌN: mọi dự án nhìn thấy cùng một kho.
--
-- Tệp nằm ở server/data/music/, và THƯ MỤC MỚI LÀ NGUỒN SỰ THẬT. Bảng này chỉ
-- ghi thêm những gì thư mục không tự nói được (tên đẹp, tông nhạc, ai tải lên).
-- Thả một tệp vào thư mục mà không có hàng nào ở đây thì nó vẫn hiện ra trong
-- kho — lời hứa đó có từ đầu và không được phá.
CREATE TABLE IF NOT EXISTS library_tracks (
  file        TEXT PRIMARY KEY,
  title       TEXT,
  tags        TEXT,
  seconds     REAL,
  uploaded_by TEXT,
  created_at  INTEGER NOT NULL
);

-- Bài được đánh dấu, RIÊNG TỪNG NGƯỜI.
--
-- Không để một cột starred trên library_tracks: kho dùng chung, nên một cột
-- chung nghĩa là người này bỏ dấu thì người kia mất dấu.
-- KHO TƯ LIỆU DÙNG CHUNG — ảnh và video chèn, cùng khuôn với library_tracks.
--
-- hash là vân tay NỘI DUNG (sha256). Tư liệu hay bị tải lại nhiều lần: cùng một
-- tấm ảnh gửi qua Zalo rồi tải về thì tên đổi mà nội dung y hệt. Trùng thì kho
-- phình ra, và tệ hơn là chặng ghép tư liệu thấy hai bản của cùng một hình rồi
-- đặt cả hai vào hai chỗ khác nhau trong cùng một video.
-- Cài đặt của người dùng: MỘT hàng một người, nội dung là JSON.
--
-- Không tách mỗi mục một cột: danh sách này còn đổi nhiều, mà mỗi lần thêm một
-- nút lại phải sửa lược đồ thì cái giá không đáng. Đọc ra bao nhiêu cũng kẹp về
-- khoảng có nghĩa ở settings.ts, nên JSON méo cũng không làm gãy lượt dựng.
CREATE TABLE IF NOT EXISTS user_settings (
  user_id    TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS library_assets (
  file        TEXT PRIMARY KEY,
  title       TEXT,
  tags        TEXT,
  description TEXT,
  seconds     REAL,
  hash        TEXT,
  uploaded_by TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assets_hash ON library_assets(hash);

CREATE TABLE IF NOT EXISTS library_stars (
  user_id    TEXT NOT NULL,
  file       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, file)
);

-- Dấu sao của kho TƯ LIỆU. Bảng riêng chứ không thêm một cột phân loại vào bảng
-- trên: khoá chính ở đó là (người, tệp), thêm loại vào là phải dựng lại cả bảng —
-- mà hai kho vốn chẳng dùng chung gì ngoài cái tên cột.
CREATE TABLE IF NOT EXISTS library_asset_stars (
  user_id    TEXT NOT NULL,
  file       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, file)
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

-- Bố cục người dùng CHỌN TAY cho một màn — ghi đè bố cục máy tự xếp.
--
-- Neo bằng mốc BẮT ĐẦU MÀN trên dải đã cắt (mili-giây). Lịch màn xếp lại mỗi lượt
-- dựng, nên neo là một MỐC chứ không phải chỉ số màn: màn nào CHỨA mốc ấy thì
-- nhận bố cục đã chọn. Sửa lời làm màn xê dịch thì mốc vẫn rơi vào đúng màn.
--
-- Chỉ lưu màn người dùng ĐỘNG VÀO. Màn chưa ai đụng thì máy tự xếp — gieo sẵn cả
-- lịch thì đổi phong cách hay sửa lời là phải nhớ gieo lại từng màn.
CREATE TABLE IF NOT EXISTS scene_layouts (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  anchor_ms   INTEGER NOT NULL,
  layout      TEXT NOT NULL,
  PRIMARY KEY (project_id, anchor_ms)
);

-- Từng chặng của lượt dựng, để màn chờ nói được máy đang ở đâu.
--
-- Không đọc ra từ bảng jobs được: ở đó cả lượt dựng là MỘT dòng với một con số
-- phần trăm, nên chặng đã xong không còn dấu vết — mà thứ đáng xem lại chính là
-- cái nó đẻ ra ("219 đoạn"), không phải phần trăm.
--
-- required = 0 là chặng hỏng thì BỎ QUA rồi đi tiếp. Chạy tuần tự mà chặng nào
-- hỏng cũng chặn thì một lượt nhận diện ảnh gãy là mất cả video, trong khi
-- thiếu tư liệu chèn thì bản dựng vẫn đủ lời và chữ.
--
-- (Không dùng dấu nháy ngược trong khối này: nó đóng luôn template literal bao
-- ngoài, và lỗi báo ra là lỗi cú pháp TypeScript ở giữa một câu SQL.)
CREATE TABLE IF NOT EXISTS steps (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  position    INTEGER NOT NULL,
  status      TEXT NOT NULL,
  result      TEXT,
  error       TEXT,
  required    INTEGER NOT NULL DEFAULT 1,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (project_id, key)
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

/**
 * Bốn bảng của Better Auth — người dùng, phiên, tài khoản nhà cung cấp, mã xác thực.
 *
 * Nguyên văn do `npx @better-auth/cli generate` sinh ra, chỉ thêm `IF NOT EXISTS`
 * để chạy lại không lỗi. KHÔNG sửa tên cột: Better Auth truy vấn đúng những tên
 * này (`emailVerified`, `expiresAt`, `userId`… kiểu lạc đà, khác hẳn lối
 * `snake_case` của phần còn lại) và không có chỗ nào đổi được.
 *
 * Đổi phiên bản Better Auth thì sinh lại rồi so, đừng đoán:
 *   npx @better-auth/cli generate --config server/auth.ts
 *
 * `user` phải dựng TRƯỚC vòng vá cột bên dưới, vì `projects.owner_id` trỏ vào nó.
 */
db.exec(`
CREATE TABLE IF NOT EXISTS "user" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "name"          TEXT NOT NULL,
  "email"         TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL,
  "image"         TEXT,
  "createdAt"     DATE NOT NULL,
  "updatedAt"     DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "expiresAt" DATE NOT NULL,
  "token"     TEXT NOT NULL UNIQUE,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId"    TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id"                    TEXT NOT NULL PRIMARY KEY,
  "accountId"             TEXT NOT NULL,
  "providerId"            TEXT NOT NULL,
  "userId"                TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken"           TEXT,
  "refreshToken"          TEXT,
  "idToken"               TEXT,
  "accessTokenExpiresAt"  DATE,
  "refreshTokenExpiresAt" DATE,
  "scope"                 TEXT,
  "password"              TEXT,
  "createdAt"             DATE NOT NULL,
  "updatedAt"             DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value"      TEXT NOT NULL,
  "expiresAt"  DATE NOT NULL,
  "createdAt"  DATE NOT NULL,
  "updatedAt"  DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");
`);

// Thêm cột theo kiểu vá dần: người dùng đã có CSDL cũ thì không mất dữ liệu.
for (const [table, column, type] of [
  // Mô tả nội dung tư liệu chèn, do mô hình nhìn ảnh sinh ra. Lưu lại để ĐỌC
  // MỘT LẦN: đọc lại mỗi lượt dựng thì mỗi lần bấm chạy lại là một lần trả tiền
  // cho cùng một tấm ảnh không đổi.
  ["media_files", "description", "TEXT"],
  // Người dùng tự giới thiệu: ngành nghề, việc đang làm, thuật ngữ hay dùng.
  // Dùng để MỒI cho máy nghe (xem `server/asr-bias.ts`) — sửa trước khi sai
  // rẻ hơn nhiều so với sửa sau.
  ["projects", "profile", "TEXT"],
  // Lời dặn TẠI LÚC chép lời. So với `profile` hiện tại là biết bản chép có còn
  // biết những gì người dùng vừa dặn hay không — mà biết được cả sau khi tải lại
  // trang, chứ không chỉ trong một lượt dựng của màn hình.
  ["projects", "profile_at_transcribe", "TEXT"],
  // Danh sách id cảnh chính TẠI LÚC chép lời, nối bằng dấu phẩy. So với mạch hiện
  // tại là biết bản chép còn khớp hay không — mà biết được cả sau khi tải lại trang.
  ["projects", "main_files_at_transcribe", "TEXT"],
  // Quãng không ai nói dài hơn ngần này giây thì chặng `silence` rút nó lại.
  // 0 nghĩa là KHÔNG tự rút — người dùng tự cắt ở bàn dựng.
  ["projects", "min_silence", "REAL DEFAULT 0.8"],
  // Có gieo chữ từ bản chép lời hay không. Tắt thì chặng `captions` chỉ dựng đoạn,
  // không sinh phần tử chữ nào — người dùng tự thêm ở bàn dựng.
  ["projects", "want_captions", "INTEGER DEFAULT 1"],
  // Có để chặng `music` tự chọn một bài nhạc nền hay không.
  ["projects", "want_music", "INTEGER DEFAULT 1"],
  ["projects", "music_path", "TEXT"],
  ["projects", "music_volume", "REAL DEFAULT 0.18"],
  ["projects", "strip_second_width", "INTEGER DEFAULT 200"],
  // Số giây dải ảnh biểu diễn — bàn dựng cần để tính thang vẽ. `NULL` nghĩa là
  // dải dựng bằng bản cũ, bàn dựng tự suy ra từ thời lượng.
  ["projects", "strip_seconds", "REAL"],
  // Độ dài THẬT của `base.mp4` đang có — tính từ tệp, không phải cộng các tệp
  // cảnh gốc. Sau `commit-cut` video ngắn lại (118s → 52s) mà các tệp cảnh vẫn
  // giữ độ dài gốc, nên tổng chúng KHÔNG còn là độ dài video. Chỗ nào cần "video
  // dài bao nhiêu" (nối đoạn đuôi, gieo lại đoạn, độ dài dải) phải đọc con số
  // này. `NULL` ở dự án cũ thì rơi về tổng tệp cảnh — đúng vì chúng chưa cắt.
  ["projects", "video_seconds", "REAL"],
  // Thang gốc của dải ảnh: một giây rộng bao nhiêu px khi ảnh vẽ đúng chiều cao
  // dải. `NULL` thì bàn dựng lấy mặc định 200 — đúng với mọi dải dựng trước đó.
  ["projects", "strip_native_second_width", "REAL"],
  // Đã sinh chữ từ lời cho dự án này chưa. Sinh ĐÚNG MỘT LẦN: xoá hết chữ đi
  // rồi mở lại mà nó tự mọc lại thì người dùng không xoá được gì cả.
  ["projects", "captions_seeded", "INTEGER DEFAULT 0"],
  // Cụm chữ được chia bằng break của MÔ HÌNH (1) hay tụt heuristic vì gọi-hỏng /
  // không có khoá (0). Mặc định 0 để dự án cũ tính là "chưa chắc LLM" → đủ điều
  // kiện tự-cứu chia lại (còn chặn thêm bởi "chưa có cụm bị người sửa").
  ["projects", "captions_llm_ok", "INTEGER DEFAULT 0"],
  // Tự-cứu chia-lại ĐÃ chạy một lần chưa. Tách khỏi `captions_llm_ok` vì cần chặn
  // LẶP kể cả khi chia lại THẤT BẠI (mô hình hỏng → llm_ok vẫn 0): thiếu cờ này thì
  // mỗi GET lại tự-cứu, gọi mô hình vô hạn. Đặt 1 sau lần thử ĐẦU (thành hay bại).
  ["projects", "captions_auto_healed", "INTEGER DEFAULT 0"],
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
  // Bố cục HIỆN b-roll (chỉ cho element kind='insert'): hai-o | vuong-ngang |
  // ngang-vuong. NULL là để máy tự chọn (xoay vòng họ hai-ô).
  ["elements", "insert_layout", "TEXT"],
  ["projects", "subtitle_band", "TEXT DEFAULT 'bottom'"],
  // DÒNG TIÊU ĐỀ của cả video — một dòng chữ đại diện, không neo vào tiếng nào.
  //
  // MỘT cột ở đây chứ không phải một hàng trong `elements`, và đó là cả quyết
  // định: mọi chữ trong `elements` neo bằng `from_word_id`/`to_word_id`, mà
  // tiêu đề không thuộc tiếng nào. Neo nó vào một từ thì người dùng cắt mất câu
  // đầu là tiêu đề biến mất theo — một lỗi hẹn giờ.
  //
  // Đi đúng nếp của `style_pack`: nằm trên `projects` nên đổi bộ dáng không đụng
  // tới nó, và ngược lại. Watermark, thanh tiến trình, chữ CTA cuối video sau
  // này cũng thuộc loại này.
  //
  // `NULL` mặc định nên dự án cũ không cần migration nào.
  ["projects", "headline", "TEXT"],
  // BỘ DÁNG CHỮ của cả dự án — font, màu, viền, quầng, mật độ, nhịp.
  //
  // MỘT cột cho cả bộ dáng, và bảng `elements` không có cột nào của nó. Đó là
  // điều làm việc đổi bộ dáng an toàn tuyệt đối: đổi = ghi một dòng, video vẽ
  // lại theo, còn nội dung và bố cục người dùng đã chỉnh thì không đụng tới.
  //
  // Default là bộ mặc định HIỆN HÀNH (`prism-pro`), KHÔNG phải "goc" đã xoá: dự án
  // mới không set cột này sẽ dính default, mà "goc" thì không có bố cục. Dự án cũ
  // đã lỡ mang "goc" thì `readStylePack` rơi về bộ mặc định để render, nhưng layout
  // đã lưu thì vẫn rỗng — cần migration riêng nếu muốn chúng có bố cục.
  ["projects", "style_pack", "TEXT DEFAULT 'prism-pro'"],
  // BA TRỤC NHÃN của kho nhạc — vốn từ ĐÓNG, xem `server/music-tags.ts`.
  //
  // Tách khỏi cột `tags` tự do chứ không nhét chung: `tags` là chữ NGƯỜI đọc
  // ("chiptune", "buồn"), ba cột này là thứ MÁY lọc. Trộn vào một cột thì bộ
  // dáng không khai được thiên lệch, vì hai bên không nói cùng một ngôn ngữ.
  //
  // Để RỖNG là hợp lệ: thư mục mới là nguồn sự thật của kho, nên bài vừa thả
  // vào chưa có hàng nào ở bảng này. Mọi phép lọc phải cho bài chưa gán nhãn đi
  // qua, không thì bài mới biến mất khỏi kho cho tới khi có người gán.
  // Bộ dáng ĐANG DÙNG lúc chặng hiệu ứng chạy lần cuối.
  //
  // Khác `style_pack` hiện tại nghĩa là người dùng đã đổi dáng SAU khi máy đặt
  // hiệu ứng — hàng soát mời họ đặt lại. Không tự đặt lại: hiệu ứng và tư liệu
  // chèn là những vật nằm trên dải, người dùng nhìn thấy và có thể đã sắp lại.
  ["projects", "effects_style_pack", "TEXT"],
  // PHONG CÁCH CHỮ mặc định của cả video — chỉ mượn phần CHỮ (font, HOA/thường,
  // màu, viền, quầng) của một bộ khác, KHÔNG đụng nhịp/b-roll/bố cục/nhạc. Tách
  // khỏi `style_pack` chính vì đây là trục đổi được AN TOÀN (không lệch nhịp).
  // `NULL` = theo font của chính `style_pack`.
  ["projects", "font_style", "TEXT"],
  // Phong cách chữ RIÊNG của một cụm — đè lên mặc định dự án. `NULL` = theo dự
  // án. Cùng loại cột-đè-mặc-định với `keyword_color`/`letter_case` của cụm.
  ["elements", "font_style", "TEXT"],
  // HAI TRỤC người dùng đè được cho RIÊNG một cụm. `NULL` = theo bộ dáng.
  //
  // Đây là cột ĐÈ, không phải cột giá trị: đổi bộ dáng KHÔNG BAO GIỜ ghi vào
  // chúng. Nhờ vậy cụm chưa đè thì đổi theo dáng mới, còn cụm người dùng đã tự
  // đặt thì giữ nguyên — lời hứa "đổi dáng an toàn" mạnh lên chứ không mất đi.
  //
  // Chép giá trị của bộ dáng vào đây lúc SINH chữ là hỏng hết: lúc đó mọi cụm
  // đều thành "đã đặt tay" và đổi bộ dáng không còn tác dụng gì.
  ["elements", "letter_case", "TEXT"],
  ["elements", "key_color", "TEXT"],
  // BLOCK look đã STAMP (JSON) — element đọc trực tiếp thay vì tra bộ dáng toàn
  // cục. Block nào không hợp loại element thì để NULL. Xem `blocksFromPack`.
  ["elements", "frame_block", "TEXT"],
  ["elements", "caption_block", "TEXT"],
  ["elements", "scene_block", "TEXT"],
  ["elements", "junction_block", "TEXT"],
  // Mã PRESET đã đóng dấu block (id bộ dáng nguồn) — CHỈ để picker tô đúng khung/
  // chữ đang chọn khi cụm/cảnh đã TRỘN look khác preset dự án. Không ai đọc để
  // dựng; look thật nằm trong `*_block`. `NULL` = chưa stamp (rơi về preset dự án).
  ["elements", "frame_preset", "TEXT"],
  ["elements", "caption_preset", "TEXT"],
  // LẤY PHẦN clip nguồn cho b-roll: giây bắt đầu / kết thúc TRONG clip gốc. NULL =
  // dùng cả clip (phát từ 0, lặp) như cũ. Cho phép "clip 10s, lấy giây 2→8".
  ["elements", "media_in_sec", "REAL"],
  ["elements", "media_out_sec", "REAL"],
  ["library_tracks", "energy", "TEXT"],
  ["library_tracks", "density", "TEXT"],
  ["library_tracks", "vocal", "TEXT"],
  // Chiều nhấn zoom ở mỗi chỗ nối đoạn: none | in | out. Mặc định TẮT — nó đổi dáng
  // cả video nên phải là lựa chọn có ý thức. Cột để TEXT vì nó là ba trạng thái, và
  // giá trị 0/1 cũ vẫn đọc được (`pipeline.ts` đổi khi dựng).
  ["projects", "zoom_punch", "TEXT DEFAULT 'none'"],
  /**
   * Chủ của dự án. MỌI bảng khác đều có `project_id`, nên một cột ở đây là đủ để
   * suy ra chủ của bất cứ hàng nào — không phải rắc `owner_id` khắp mười hai bảng.
   *
   * Để rỗng được, và rỗng nghĩa là KHÔNG AI thấy: mấy dự án dựng trước lúc có
   * đăng nhập không có chủ, mà gán chúng cho người đăng nhập đầu tiên thì người
   * đó nhận cả đống thứ không phải của mình. Dữ liệu vẫn nằm trong CSDL.
   *
   * `ON DELETE CASCADE`: xoá một người là xoá dự án của họ. Cột thêm bằng
   * `ALTER TABLE` có `REFERENCES` thì SQLite đòi mặc định phải là NULL — đúng
   * điều ta cần ở đây, nên không khai `DEFAULT`.
   */
  ["projects", "owner_id", 'TEXT REFERENCES "user"(id) ON DELETE CASCADE'],
  /**
   * Chặng tự ghép tư liệu được lấy từ đâu: "project" | "starred" | "library".
   *
   * Chép vào TỪNG DỰ ÁN chứ không đọc thẳng cài đặt lúc dựng: đổi cài đặt sau đó
   * thì dự án cũ giữ nguyên nguồn nó đã dựng, không tự nhiên mọc thêm tư liệu lạ
   * ở lượt chạy lại.
   */
  ["projects", "insert_source", "TEXT"],
  /**
   * Tư liệu này LẤY TỪ KHO chứ không phải người dùng tải lên cho dự án.
   *
   * Cần vì máy tự lấy về được: mở bàn dựng thấy một clip mình không nhớ đã thêm
   * mà không có gì đánh dấu thì đọc ra như máy bịa ra tệp.
   */
  ["media_files", "from_library", "INTEGER NOT NULL DEFAULT 0"],
  /**
   * Tên tệp TRONG KHO mà bản này chép ra.
   *
   * Nhờ nó hộp chọn từ kho đánh dấu được "đã có trong dự án" — không thì người
   * dùng chọn lại đúng tấm mình thêm mười phút trước và dự án có hai bản y hệt.
   * So theo tên tệp trong dự án không thay được: tên ấy lấy từ tiêu đề tư liệu,
   * mà tiêu đề sửa lúc nào cũng được.
   */
  ["media_files", "library_file", "TEXT"],
  // Dải ảnh (filmstrip) của CHÍNH clip này — cache để bàn dựng bày thumbnail lúc
  // cắt đoạn (in/out). Sinh một lần bằng ffmpeg rồi giữ; ba số này khớp cách vẽ
  // sprite của `makeFilmstrip` (bề ngang một giây, tổng số giây, bề ngang gốc).
  ["media_files", "strip_second_width", "REAL"],
  ["media_files", "strip_seconds", "REAL"],
  ["media_files", "strip_native_second_width", "REAL"],
  // ĐẾM SỬA để biết bản XUẤT còn tươi hay đã cũ. `content_rev` tăng mỗi lần sửa
  // gì ĐỘNG TỚI HÌNH (elements/nhạc — do trigger bên dưới bump tự động).
  // `exported_rev` là con số lúc XUẤT gần nhất. Khác nhau = "đã sửa sau khi xuất"
  // → bản dựng trên đĩa CŨ, nút phải là "Xuất lại" chứ không "Tải bản cũ".
  ["projects", "content_rev", "INTEGER NOT NULL DEFAULT 0"],
  ["projects", "exported_rev", "INTEGER NOT NULL DEFAULT 0"],
] as const) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    // BACKFILL đúng một lần lúc TẠO cột `captions_llm_ok`: dự án ĐÃ gieo chữ từ
    // trước bản này thì coi là "ổn" (=1) — KHÔNG tự chia lại hàng loạt (người dùng
    // chọn chỉ chữa dự án lỗi-lúc-gieo về SAU, không đụng dự án cũ/đã tinh chỉnh).
    // Muốn chữa dự án cũ vỡ cụm thì bấm nút "Chia lại cụm". Seed MỚI mới nhận cờ thật.
    if (table === "projects" && column === "captions_llm_ok") {
      db.exec("UPDATE projects SET captions_llm_ok=1 WHERE captions_seeded=1");
    }
    // Dự án cũ coi như đã "yên" — không tự-cứu chúng (chỉ chữa qua nút tay).
    if (table === "projects" && column === "captions_auto_healed") {
      db.exec("UPDATE projects SET captions_auto_healed=1 WHERE captions_seeded=1");
    }
  }
}

/**
 * TRIGGER đếm sửa: mọi thay đổi trên `elements` (chữ/khung/b-roll/hiệu ứng) và
 * `music_tracks` (nhạc) đều bump `projects.content_rev`. Đặt ở TẦNG DB nên bắt
 * ĐƯỢC HẾT, khỏi nhớ gọi ở từng endpoint. Không trigger trên `projects` → không
 * vòng lặp. Nhờ nó, "sửa sau khi xuất" tự lộ (content_rev > exported_rev).
 */
for (const [tbl, col] of [
  ["elements", "project_id"],
  ["music_tracks", "project_id"],
] as const) {
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS bump_rev_${tbl}_ins AFTER INSERT ON ${tbl}
    BEGIN UPDATE projects SET content_rev = content_rev + 1 WHERE id = NEW.${col}; END;
    CREATE TRIGGER IF NOT EXISTS bump_rev_${tbl}_upd AFTER UPDATE ON ${tbl}
    BEGIN UPDATE projects SET content_rev = content_rev + 1 WHERE id = NEW.${col}; END;
    CREATE TRIGGER IF NOT EXISTS bump_rev_${tbl}_del AFTER DELETE ON ${tbl}
    BEGIN UPDATE projects SET content_rev = content_rev + 1 WHERE id = OLD.${col}; END;
  `);
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
function relaxAnchorConstraints() {
  const columns = db.prepare("PRAGMA table_info(elements)").all() as Array<{
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
  }>;
  const anchorColumns = columns.filter(
    (column) =>
      (column.name === "from_word_id" || column.name === "to_word_id") &&
      column.notnull === 1,
  );
  if (anchorColumns.length === 0) return;

  const columnDefs = columns.map((column) => {
    const required =
      column.notnull === 1 &&
      column.name !== "from_word_id" &&
      column.name !== "to_word_id";
    return [
      column.name,
      column.type || "TEXT",
      column.name === "id" ? "PRIMARY KEY" : "",
      required ? "NOT NULL" : "",
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
  const names = columns.map((column) => column.name).join(", ");

  backupBeforeRebuild("elements");
  db.pragma("foreign_keys = OFF");
  db.transaction(() => {
    db.exec(`CREATE TABLE elements_new (${columnDefs.join(", ")})`);
    db.exec(
      `INSERT INTO elements_new (${names}) SELECT ${names} FROM elements`,
    );
    db.exec("DROP TABLE elements");
    db.exec("ALTER TABLE elements_new RENAME TO elements");
  })();
  db.pragma("foreign_keys = ON");
}
relaxAnchorConstraints();

// NEO-GIÂY cho b-roll: khối cũ neo-TỪ được điền `start_sec/end_sec` từ mốc của từ,
// một lần — để b-roll thành neo-GIÂY (kéo/gọt tự do như nhạc, kéo mép = in/out
// nguồn). Chỉ điền chỗ TRỐNG (idempotent); render đã ưu tiên sec, lùi về từ nếu
// khối nào chưa điền. Chỉ b-roll (`media_file_id`), khung người để giai đoạn sau.
db.exec(`
  UPDATE elements
  SET start_sec = (SELECT start_sec FROM words WHERE id = elements.from_word_id),
      end_sec   = (SELECT end_sec   FROM words WHERE id = elements.to_word_id)
  WHERE media_file_id IS NOT NULL
    AND start_sec IS NULL
    AND from_word_id IN (SELECT id FROM words)
    AND to_word_id   IN (SELECT id FROM words)
`);

/**
 * Chuyển bản sửa chỗ nối cũ (một MỐC) sang hiệu ứng mới (một QUÃNG).
 *
 * Quãng suy ra đúng bằng nhịp hai nửa mà bản cũ đang dựng, nên video xuất ra
 * không đổi một khung nào — chỉ là cùng một thứ giờ được ghi bằng cách nói được
 * nhiều hơn.
 *
 * Bộ số phải khớp `junctionHalves` của `server/render.ts`.
 */
function migrateJunctionsToEffects() {
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get("junctions");
  if (!exists) return;

  const rhythm: Record<string, [number, number]> = {
    "zoom-in": [0.5, 0.15],
    "zoom-out": [0.15, 0.5],
    flash: [0.12, 0.12],
    dip: [0.18, 0.18],
    none: [0.5, 0.15],
  };
  const legacy = db
    .prepare("SELECT project_id, at_sec, kind FROM junctions")
    .all() as Array<{ project_id: string; at_sec: number; kind: string }>;

  db.transaction(() => {
    for (const row of legacy) {
      const [before, after] = rhythm[row.kind] ?? rhythm["zoom-in"];
      db.prepare(
        "INSERT OR IGNORE INTO effects (id, project_id, start_sec, end_sec, kind) VALUES (?,?,?,?,?)",
      ).run(
        `eff_legacy_${row.project_id}_${row.at_sec.toFixed(3)}`,
        row.project_id,
        row.at_sec - before,
        row.at_sec + after,
        row.kind,
      );
    }
    db.exec("DROP TABLE junctions");
  })();
}
migrateJunctionsToEffects();

/**
 * Đổi tên hai trục dáng chữ sang tiếng Anh.
 *
 * Chỉ đổi CÁCH GHI, không đổi ý nghĩa: mỗi giá trị cũ ứng đúng một giá trị mới
 * nên mọi phần tử vẫn hiện ra y hệt. Phải chạm vào dữ liệu vì hai cột này lưu
 * thẳng chuỗi chứ không qua bảng tra.
 *
 * `UPDATE` có `WHERE` nên chạy lại lần nữa không đổi thêm dòng nào.
 */
function migrateLayoutAxisNames() {
  const align: Record<string, string> = { "so-le": "stagger" };
  const emphasis: Record<string, string> = {
    deu: "even",
    "tu-khoa-to": "keyword-large",
    "xen-co": "mixed-size",
    "dan-nho": "taper",
  };
  db.transaction(() => {
    for (const [from, to] of Object.entries(align)) {
      db.prepare("UPDATE elements SET align=? WHERE align=?").run(to, from);
    }
    for (const [from, to] of Object.entries(emphasis)) {
      db.prepare("UPDATE elements SET emphasis=? WHERE emphasis=?").run(
        to,
        from,
      );
    }
  })();
}
migrateLayoutAxisNames();

/**
 * Gộp `kind='insert'` (b-roll cũ) về `kind='layout'`.
 *
 * B-roll và ô người GIỜ là MỘT loại "khung"; cái phân biệt là có `media_file_id`
 * hay không, không phải `kind`. Một `kind` duy nhất cho khung. Idempotent — chạy
 * lại không còn hàng nào khớp.
 */
db.prepare("UPDATE elements SET kind='layout' WHERE kind='insert'").run();

/**
 * Áp lại BỐ CỤC editorial (từ khoá TO, dẫn nhỏ) cho caption đã bị ép cỡ ĐỀU.
 *
 * Trước đây có bước ép mọi caption về `even` (chữ đồng đều, chỉ nhấn bằng màu) —
 * nhưng Prism nhấn bằng CỠ (như bản gốc), màu từ nhấn của nó lại trùng màu chữ nên
 * `even` ra caption PHẲNG hoàn toàn. Giờ trả về recipe cỡ (`keyword-large`/`taper`)
 * bốc theo hạt-giống ỔN ĐỊNH (id từ đầu cụm), hệt lúc SEED.
 *
 * CHỪA caption KHUNG MỜ (`align='center'` do `blur-frames` đặt): chúng CỐ Ý đều +
 * canh giữa (chữ lớn phủ nền mờ), không phải bị ép phẳng. Idempotent: recipe không
 * bao giờ trả `even`, nên caption đã sửa lần sau không còn khớp `emphasis='even'`.
 */
{
  const flat = db
    .prepare(
      "SELECT id, from_word_id, caption_preset FROM elements WHERE kind='text' AND emphasis='even' AND from_word_id IS NOT NULL AND (align IS NULL OR align <> 'center')",
    )
    .all() as Array<{
    id: string;
    from_word_id: string;
    caption_preset: string | null;
  }>;
  const applyRecipe = db.prepare(
    "UPDATE elements SET emphasis=?, align=? WHERE id=?",
  );
  for (const cap of flat) {
    const recipe = arrangementFor(
      findStylePack(cap.caption_preset ?? "prism-pro").arrangementRecipes,
      cap.from_word_id,
    );
    if (recipe) applyRecipe.run(recipe.emphasis, recipe.align, cap.id);
  }
}

/**
 * Bo góc NHẸ cho thẻ b-roll đã đóng dấu GÓC VUÔNG (`cornerShare = 0`).
 *
 * Chỉ Prism có `insetCard.cornerShare` (bộ khác `insetCard: null`), nên `= 0` là
 * đủ nhắm đúng thẻ vuông của Prism — không đụng bộ khác. Đọc look từ BLOCK ĐÃ ĐÓNG
 * DẤU nên phải sửa trong block, không thể chỉ đổi ở catalog. Idempotent: sửa xong
 * `cornerShare = 0.04`, lần sau `= 0` không còn khớp.
 */
db.prepare(
  "UPDATE elements SET frame_block = json_set(frame_block, '$.insetCard.cornerShare', 0.04) WHERE json_extract(frame_block, '$.insetCard') IS NOT NULL AND COALESCE(json_extract(frame_block, '$.insetCard.cornerShare'), 0) = 0",
).run();

/**
 * Dự án CŨ: bản dựng trên đĩa (nếu có) làm TRƯỚC khi có đếm-sửa, nên không biết
 * còn tươi không. Đặt `content_rev = 1` (khác `exported_rev = 0`) để coi là ĐÃ CŨ
 * → nút hiện "Xuất lại" thay vì mời tải bản có thể thiếu chỉnh sửa. Idempotent:
 * chạm project còn `= 0`; đã có sửa (trigger bump) hoặc đã đánh dấu thì bỏ qua.
 */
db.prepare("UPDATE projects SET content_rev = 1 WHERE content_rev = 0").run();

/**
 * Quy chỗ nối CHUYỂN-CẢNH-THẬT (cross) cũ về kiểu MỘT LUỒNG thấy-ở-preview.
 *
 * Preview chưa vẽ được cross → chọn cross là "gắn mà preview trống". Picker nay đã
 * ẩn cross (không phát sinh mới), nhưng dữ liệu CŨ đã lỡ gắn vẫn còn — cả effect
 * đặt tay (`effects.kind`) lẫn mặc định dự án (`projects.zoom_punch`). Đổi mỗi
 * cross về một-luồng cùng cảm giác (bảng ở junction-kinds) để preview lẫn xuất đều
 * THẤY. Idempotent: xong không còn giá trị cross nào khớp.
 */
{
  const fixEffect = db.prepare("UPDATE effects SET kind=? WHERE kind=?");
  const fixDefault = db.prepare(
    "UPDATE projects SET zoom_punch=? WHERE zoom_punch=?",
  );
  for (const [from, to] of Object.entries(CROSS_TO_VISIBLE)) {
    fixEffect.run(to, from);
    fixDefault.run(to, from);
  }
}

/**
 * Dọn chỗ nối 'none' (cắt thẳng) THỪA ở dự án có mặc định ĐÃ là cắt thẳng.
 *
 * "Bỏ đánh dấu" một chỗ nối trước đây ghi một hàng 'none' đè để chặn cái tự-suy
 * mọc lại. Nhưng khi mặc định dự án vốn đã 'none' (cột `zoom_punch` = '0'/'none'/
 * rỗng/NULL), cái tự-suy cũng đã 'none' → hàng đè này vô nghĩa và chỉ để lại rác.
 * Xoá cho sạch. GIỮ 'none' ở dự án có mặc định KHÁC (ở đó nó thật sự chặn mặc
 * định). Idempotent: xong không còn hàng nào khớp.
 */
db.prepare(
  `DELETE FROM effects WHERE kind='none' AND project_id IN (
     SELECT id FROM projects WHERE zoom_punch IS NULL OR zoom_punch IN ('0','none','')
   )`,
).run();

/**
 * Dọn dấu vết của chặng gắn emoji đã bỏ.
 *
 * Hàng `steps` phải xoá chứ không để lại làm lịch sử: trang mạch dựng tra tên
 * chặng theo khoá, khoá lạ thì nó hiện đúng chữ `emoji` trần — đọc ra như một
 * chặng hỏng chứ không đọc ra như một chặng đã gỡ. Còn cột `elements.emoji` thì
 * để nguyên: SQLite bỏ cột phải dựng lại cả bảng, mà không còn chỗ nào đọc nó
 * nên nó chỉ là mấy byte nằm im.
 *
 * `WHERE` nên chạy lại lần nữa không đổi thêm dòng nào.
 */
db.prepare("DELETE FROM steps WHERE key='emoji'").run();

// Danh sách dự án luôn lọc theo chủ, nên cột này nằm trong mọi truy vấn đọc.
// Đặt sau vòng vá cột vì lúc đó `owner_id` mới chắc chắn tồn tại.
db.exec(
  "CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id, created_at)",
);

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
