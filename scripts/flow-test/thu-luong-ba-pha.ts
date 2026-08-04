/**
 * CHẠY THỬ LUỒNG BA PHA đầu-cuối. Chạy:
 *
 *   npm run check:flow-e2e
 *
 * Dựng một dự án tại chỗ rồi lái qua cả ba pha. `check:flow` chỉ soát BẢNG
 * chặng — thứ tự, cổng, trạng thái — nên nó xanh cả khi mạch không chạy nổi.
 * Tệp này chạy thật, và nó đã bắt được hai lỗi mà bảng không thấy:
 *
 * · **`base.mp4` chưa có lúc chốt.** Bản chất lượng dựng bằng một việc NỀN xếp
 *   hàng riêng, mà người dùng bấm qua cổng nhanh hơn lượt mã hoá là chuyện
 *   thường với video ngắn. Pha hai ném lỗi ffprobe không tìm thấy tệp.
 * · **Cổng không đóng khi bước qua.** `awaiting` trả về `soat-cat` mãi, nên
 *   giao diện vẫn bày nút cũ và bảng dừng ở 12/14 — mạch trông như chết.
 *
 * Cả hai đều là lỗi người dùng gặp ngay lần đầu, và cả hai đều lọt qua mọi
 * phép kiểm ở mức trạng thái.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.TEDDIT_DATA_ROOT = mkdtempSync(join(tmpdir(), "luong-"));

const { db, newId } = await import("../../server/db");
const { ensureProjectDirs, mediaDir } = await import("../../server/paths");
const { run } = await import("../../server/media-tools");
const { pipelineState } = await import("../../server/pipeline-steps");
const P = await import("../../server/pipeline");

const id = "prj_thu_luong";
ensureProjectDirs(id);
db.prepare("INSERT INTO projects (id,title,created_at,owner_id) VALUES (?,?,?,NULL)").run(id, "thử luồng", 0);
const src = join(mediaDir(id), "goc.mp4");
await run("ffmpeg", ["-y","-v","error","-f","lavfi","-i","testsrc=size=540x960:rate=25:duration=12",
  "-f","lavfi","-i","sine=frequency=300:duration=12","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",src]);
const { statSync } = await import("node:fs");
db.prepare(
  "INSERT INTO media_files (id,project_id,role,stored_path,position,name,size,has_audio) VALUES (?,?,?,?,?,?,?,1)",
).run(newId("f"), id, "main", src, 0, "goc.mp4", statSync(src).size);

const show = (nhan: string) => {
  const st = pipelineState(id);
  const done = st.steps.filter(s => s.status === "done").length;
  console.log(`  ${nhan.padEnd(10)} xong ${done}/${st.steps.length} · cổng=${st.awaiting ?? "—"} · mở bàn dựng=${st.settled && !st.blocked}`);
  const bad = st.steps.filter(s => s.status === "failed" && s.required);
  if (bad.length) console.log("    HỎNG BẮT BUỘC:", bad.map(s => `${s.key}: ${s.error}`).join(" · "));
};

try {
  await P.runTranscribe(id); show("pha 1");
  await P.resumeAfterCutReview(id); show("pha 2");
  await P.resumeAfterTextReview(id); show("pha 3");
  const cuoi = pipelineState(id);
  const ok = cuoi.settled && !cuoi.blocked && cuoi.awaiting === null;
  console.log(ok ? "\n1 đạt, 0 trượt" : "\n0 đạt, 1 trượt");
  db.prepare("DELETE FROM projects WHERE id=?").run(id);
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.log("  NÉM LỖI:", (e as Error).message.slice(0, 200));
  show("lúc hỏng");
  console.log("\n0 đạt, 1 trượt");
  process.exit(1);
}
