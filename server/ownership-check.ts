/**
 * Kiểm luật phân quyền bằng dữ liệu thật. Chạy:
 *
 *   npm run check:ownership
 *
 * Không phải bộ test đầy đủ — dự án chưa có bộ chạy test nào. Đây là phép kiểm
 * cho ĐÚNG phần dễ sai âm thầm nhất: `ownership.ts` quyết định ai xem được gì,
 * mà sai ở đó thì không có lỗi nào hiện ra — cửa cứ mở cho tới hôm có người đi
 * qua. Chạy lại sau mỗi lần đụng vào `ownership.ts` hay đổi schema.
 *
 * Lệnh npm trỏ `TEDDIT_DATA_ROOT` sang thư mục tạm nên nó KHÔNG chạm vào CSDL
 * thật. Nhập trực tiếp `tsx server/ownership-check.ts` là ghi vào CSDL thật —
 * dòng chặn bên dưới có để đúng chuyện đó không xảy ra vì gõ nhầm.
 */
import { db, newId } from "./db";
import { DATA_ROOT } from "./paths";
import {
  AccessError,
  assertInProject,
  assertOwnerIs,
  assertOwnsFilePath,
  assertOwnsUrlTarget,
} from "./ownership";

if (!process.env.TEDDIT_DATA_ROOT) {
  console.error(
    "Phép kiểm này ghi dữ liệu thử vào CSDL. Chạy bằng `npm run check:ownership`\n" +
      "để nó dùng thư mục tạm, đừng gọi tsx trực tiếp.",
  );
  process.exit(1);
}
console.log(`CSDL thử: ${DATA_ROOT}`);

const now = Date.now();

function makeUser(label: string) {
  const id = newId("u");
  const email = `${label}@test.local`;
  db.prepare(
    `INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES (?,?,?,0,?,?)`,
  ).run(id, label, email, now, now);
  return { id, email };
}

function makeProject(owner: string | null) {
  const id = newId("prj");
  db.prepare(
    "INSERT INTO projects (id,title,status,created_at,owner_id) VALUES (?,?,?,?,?)",
  ).run(id, "thử", "draft", now, owner);
  return id;
}

const alice = makeUser("alice");
const bob = makeUser("bob");
const prjA = makeProject(alice.id);
const prjB = makeProject(bob.id);
/** Dự án dựng trước lúc có đăng nhập: không chủ, nên phải vô hình với mọi người. */
const prjOrphan = makeProject(null);

const fileA = newId("f");
db.prepare(
  "INSERT INTO media_files (id,project_id,name,size,role,position,stored_path) VALUES (?,?,?,?,?,?,?)",
).run(fileA, prjA, "a.mp4", 1, "main", 0, "/x");
const sentenceA = newId("s");
db.prepare(
  "INSERT INTO sentences (id,project_id,position,text,start_sec,end_sec) VALUES (?,?,?,?,?,?)",
).run(sentenceA, prjA, 0, "x", 0, 1);
const wordA = newId("w");
db.prepare(
  "INSERT INTO words (id,project_id,sentence_id,position,text,start_sec,end_sec) VALUES (?,?,?,?,?,?,?)",
).run(wordA, prjA, sentenceA, 0, "x", 0, 1);

let passed = 0;
let failed = 0;

/** `blocked` là điều MONG ĐỢI: true nghĩa là phép kiểm phải chặn lời gọi này. */
function check(label: string, blocked: boolean, run: () => void) {
  let threw = false;
  try {
    run();
  } catch (error) {
    // Chỉ `AccessError` mới tính là "đã chặn". Lỗi khác — SQL sai, cột thiếu — là
    // hỏng thật, và nuốt nó ở đây sẽ khiến một phép kiểm hỏng trông như đã đạt.
    if (!(error instanceof AccessError)) throw error;
    threw = true;
  }
  const ok = threw === blocked;
  console.log(`  ${ok ? "đạt  " : "TRƯỢT"} ${label}`);
  if (ok) passed++;
  else failed++;
}

console.log("\nMã trên đường dẫn");
check("chủ xem dự án mình", false, () => assertOwnerIs(alice, "project", prjA));
check("xem dự án người khác", true, () => assertOwnerIs(alice, "project", prjB));
check("xem dự án không chủ", true, () =>
  assertOwnerIs(alice, "project", prjOrphan),
);
check("xem dự án không tồn tại", true, () =>
  assertOwnerIs(alice, "project", "prj_khong_co"),
);
check("chủ xem tệp mình (qua join)", false, () =>
  assertOwnerIs(alice, "file", fileA),
);
check("xem tệp người khác", true, () => assertOwnerIs(bob, "file", fileA));
check("xem từ người khác", true, () => assertOwnerIs(bob, "word", wordA));

console.log("\nCổng theo dạng đường dẫn");
check("GET /api/projects (không mã) đi qua", false, () =>
  assertOwnsUrlTarget(alice, "/api/projects"),
);
check("POST /api/layout đi qua", false, () =>
  assertOwnsUrlTarget(alice, "/api/layout"),
);
check("dự án mình", false, () =>
  assertOwnsUrlTarget(alice, `/api/projects/${prjA}/segments`),
);
check("dự án người khác", true, () =>
  assertOwnsUrlTarget(alice, `/api/projects/${prjB}/segments`),
);
check("tệp người khác", true, () =>
  assertOwnsUrlTarget(bob, `/api/files/${fileA}/raw`),
);
check("từ người khác", true, () =>
  assertOwnsUrlTarget(bob, `/api/words/${wordA}`),
);

console.log("\nMã trong thân request");
check("đính tệp của chính dự án đó", false, () =>
  assertInProject(prjA, "file", fileA),
);
check("đính tệp của người khác", true, () =>
  assertInProject(prjB, "file", fileA),
);
check("đính tệp từ dự án khác của chính mình", true, () =>
  assertInProject(prjOrphan, "file", fileA),
);
check("neo vào từ của dự án khác", true, () =>
  assertInProject(prjB, "word", wordA),
);
check("neo vào câu của dự án khác", true, () =>
  assertInProject(prjB, "sentence", sentenceA),
);
check("mã rỗng thì bỏ qua", false, () =>
  assertInProject(prjA, "file", undefined),
);

console.log("\nĐường dẫn /files/");
check("chủ tải tệp dự án mình", false, () =>
  assertOwnsFilePath(alice, `/files/projects/${prjA}/out/final.mp4`),
);
check("tải video đã xuất của người khác", true, () =>
  assertOwnsFilePath(bob, `/files/projects/${prjA}/out/final.mp4`),
);
check("tải thẳng tệp CSDL", true, () =>
  assertOwnsFilePath(alice, "/files/teddit.db"),
);
check("leo thư mục bằng ..", true, () =>
  assertOwnsFilePath(alice, `/files/projects/${prjA}/../../teddit.db`),
);
check("dự án không chủ", true, () =>
  assertOwnsFilePath(alice, `/files/projects/${prjOrphan}/out/final.mp4`),
);
// `..` VIẾT DƯỚI DẠNG MÃ HOÁ. Phép kiểm chuỗi thô không thấy hai dấu chấm nào ở
// đây, nên nếu đường dẫn không được giải mã trước khi soi thì trường hợp này đi
// lọt và cả cái khoá chỉ còn sống nhờ `@fastify/static` chặn hộ.
check("leo thư mục bằng .. mã hoá", true, () =>
  assertOwnsFilePath(alice, `/files/projects/${prjA}/%2e%2e/%2e%2e/teddit.db`),
);
// Dấu `%` lạc: phải chối, KHÔNG được ném `URIError` ra ngoài — ra ngoài là 500,
// tức là một đường dẫn rác đọc ra như máy chủ hỏng.
check("đường dẫn mã hoá hỏng", true, () =>
  assertOwnsFilePath(alice, "/files/projects/%zz/out/final.mp4"),
);
check("mã dự án mã hoá hỏng trên /api/", true, () =>
  assertOwnsUrlTarget(alice, "/api/projects/%zz"),
);

console.log(`\n${passed} đạt, ${failed} trượt`);
process.exit(failed === 0 ? 0 : 1);
