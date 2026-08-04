/**
 * Dựng lại tệp dẫn xuất (preview/dải ảnh/đường bao) trên trục HIỆN TẠI của base.mp4.
 * Cùng phép mà `commit-cut` giờ chạy; dùng để sửa dự án lỡ có artifacts theo trục cũ.
 *
 *   tsx scripts/flow-test/rebuild-derived.ts <projectId>
 */
import { join } from "node:path";
import { buildEnvelope } from "../../server/audio-envelope";
import { db } from "../../server/db";
import { makeFilmstrip, probe } from "../../server/media-tools";
import { thumbDir, workDir } from "../../server/paths";
import { buildPreview } from "../../server/render";

const projectId = process.argv[2];
if (!projectId) { console.error("thiếu projectId"); process.exit(1); }
db.pragma("busy_timeout = 8000");

const base = join(workDir(projectId), "base.mp4");
const { preview, audio } = await buildPreview(projectId, [base]);
const info = await probe(preview);
const strip = await makeFilmstrip(preview, join(thumbDir(projectId), "strip.jpg"), info.duration);
db.prepare(
  "UPDATE projects SET strip_second_width=?, strip_seconds=?, strip_native_second_width=? WHERE id=?",
).run(strip.secondWidth, strip.totalSeconds, strip.nativeSecondWidth, projectId);
await buildEnvelope(projectId, audio);
console.log(`preview ${info.duration.toFixed(1)}s · strip_seconds ${strip.totalSeconds.toFixed(1)} · xong`);
process.exit(0);
