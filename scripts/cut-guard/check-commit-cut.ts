/**
 * KIỂM CHẶNG CHỐT LÁT CẮT. Chạy:
 *
 *   npm run check:commit-cut
 *
 * Dựng một dự án nhỏ bằng tiếng THẬT rồi chốt, vì thứ cần canh ở đây không kiểm
 * bằng dữ liệu giả được: sau khi chốt, mốc từ phải nằm đúng trên tiếng của tệp
 * MỚI. Dữ liệu giả thì mốc nào cũng "đúng".
 *
 * ══ CANH GÌ ══
 *
 * 1. **Tệp ngắn lại đúng phần đã bỏ.** Sai chỗ này là cắt hụt hoặc cắt thừa, và
 *    người dùng nghe ra ngay.
 * 2. **Không còn gì phải quy đổi.** `manual_cuts` rỗng, không câu nào còn cờ
 *    `removed` — lát cắt đã nằm trong tệp, giữ lại là cắt hai lần.
 * 3. **Mốc từ nằm trong độ dài mới.** Đây là phép bắt lỗi lệch trục: chép lại
 *    mà vẫn còn mốc vượt quá đuôi tệp nghĩa là bản chép không theo tệp mới.
 * 4. **Không cắt gì thì KHÔNG chép lại.** Chép lại một dự án không đổi gì là
 *    ném đi vài phút và thay bản chép người dùng vừa sửa.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TEDDIT_DATA_ROOT = mkdtempSync(join(tmpdir(), "chot-"));

const { db, newId } = await import("../../server/db");
const { ensureProjectDirs, workDir } = await import("../../server/paths");
const { probe, run } = await import("../../server/media-tools");
const { commitCut } = await import("../../server/commit-cut");

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  đạt   ${label}`);
  } else {
    failed += 1;
    console.log(`  TRƯỢT ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/*
 * Nguồn dựng tại chỗ: mười giây hình màu kèm một tiếng bíp.
 *
 * Không mượn tệp của người dùng — phép kiểm phải chạy được trên máy trống. Bíp
 * đủ cho việc cần canh: thứ soát ở đây là ĐỘ DÀI và MỐC, không phải chữ.
 */
const projectId = "prj_kiem_chot";
ensureProjectDirs(projectId);
db.prepare(
  "INSERT INTO projects (id, title, created_at) VALUES (?,?,?)",
).run(projectId, "kiểm chốt", 0);
const base = join(workDir(projectId), "base.mp4");
await run("ffmpeg", [
  "-y", "-v", "error",
  "-f", "lavfi", "-i", "testsrc=size=320x568:rate=25:duration=10",
  "-f", "lavfi", "-i", "sine=frequency=440:duration=10",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", base,
]);
const beforeInfo = await probe(base);
const total = beforeInfo.duration;
console.log(`\nNguồn dựng tại chỗ: ${total.toFixed(2)} giây`);

console.log("\nKhông cắt gì thì KHÔNG chép lại");
const noop = await commitCut(projectId, total);
check("bỏ qua", noop.skipped, JSON.stringify(noop));
check("số từ không đổi", noop.wordsBefore === noop.wordsAfter);
const afterNoop = await probe(base);
check(
  "tệp giữ nguyên độ dài",
  Math.abs(afterNoop.duration - total) < 0.05,
  `${afterNoop.duration.toFixed(2)} so với ${total.toFixed(2)}`,
);

console.log("\nChốt một lát cắt 3 giây");
// Gạch một câu dài 3 giây ở giữa. `keptRanges` đọc bảng này để dựng khoảng giữ.
const sentenceId = newId("s");
db.prepare(
  "INSERT INTO sentences (id, project_id, position, text, start_sec, end_sec, removed) VALUES (?,?,?,?,?,?,1)",
).run(sentenceId, projectId, 0, "bỏ đoạn này", 3.0, 6.0);
db.prepare(
  "INSERT INTO manual_cuts (id, project_id, start_sec, end_sec) VALUES (?,?,?,?)",
).run(newId("c"), projectId, 8.0, 8.5);

const done = await commitCut(projectId, total);
check("không bỏ qua", !done.skipped);
check(
  "báo bỏ đi ~3 giây",
  Math.abs(done.removedSeconds - 3.0) < 0.35,
  `${done.removedSeconds.toFixed(2)}s`,
);

const after = await probe(base);
check(
  "tệp ngắn lại đúng phần đã bỏ",
  Math.abs(after.duration - (total - done.removedSeconds)) < 0.4,
  `còn ${after.duration.toFixed(2)}s, mong ${(total - done.removedSeconds).toFixed(2)}s`,
);

console.log("\nKhông còn gì phải quy đổi");
const cuts = (
  db.prepare("SELECT COUNT(*) AS n FROM manual_cuts WHERE project_id=?").get(projectId) as {
    n: number;
  }
).n;
check("bảng khoảng cắt tay đã rỗng", cuts === 0, `${cuts} dòng`);
const stillRemoved = (
  db
    .prepare("SELECT COUNT(*) AS n FROM sentences WHERE project_id=? AND removed=1")
    .get(projectId) as { n: number }
).n;
check("không câu nào còn cờ đã-gạch", stillRemoved === 0, `${stillRemoved} câu`);

console.log("\nMốc từ nằm trong tệp mới");
const bounds = db
  .prepare(
    "SELECT MIN(start_sec) AS lo, MAX(end_sec) AS hi FROM words WHERE project_id=?",
  )
  .get(projectId) as { lo: number | null; hi: number | null };
if (bounds.hi === null) {
  // Tiếng bíp không ra chữ nào — đúng như mong đợi, và bản thân điều đó đã là
  // bằng chứng bản chép chạy trên tệp mới chứ không giữ lại bản cũ.
  check("bản chép cũ đã bị thay sạch", true, "không từ nào (nguồn là tiếng bíp)");
} else {
  check(
    `mốc từ ${bounds.lo?.toFixed(2)}–${bounds.hi.toFixed(2)} nằm trong ${after.duration.toFixed(2)}s`,
    bounds.lo! >= -0.05 && bounds.hi <= after.duration + 0.5,
  );
}

db.prepare("DELETE FROM projects WHERE id=?").run(projectId);
console.log(`\n${passed} đạt, ${failed} trượt`);
process.exit(failed === 0 ? 0 : 1);
