/**
 * Gieo lại đoạn theo ĐÚNG độ dài video hiện tại + đánh dấu bản 4 — sửa dự án lỡ
 * bị migration gieo trên trục gốc (118s) trong khi video đã cắt (52s).
 *
 *   tsx scripts/flow-test/reseed-segments.ts <projectId>
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { db } from "../../server/db";
import { probe } from "../../server/media-tools";
import { workDir } from "../../server/paths";
import { seedSegmentsByCaption } from "../../server/segment-seed";
import { readStylePack } from "../../server/style-pack-store";

const projectId = process.argv[2];
if (!projectId) { console.error("thiếu projectId"); process.exit(1); }
db.pragma("busy_timeout = 8000");

const preview = join(workDir(projectId), "preview.mp4");
const base = join(workDir(projectId), "base.mp4");
const src = existsSync(preview) ? preview : base;
const info = await probe(src);
const n = await seedSegmentsByCaption(projectId, info.duration, readStylePack(projectId));
db.prepare("UPDATE projects SET segments_by_caption=4 WHERE id=?").run(projectId);
const span = db.prepare(
  "SELECT ROUND(MIN(start_sec),1) a, ROUND(MAX(end_sec),1) b FROM segments WHERE project_id=?",
).get(projectId) as { a: number; b: number };
console.log(`gieo ${n} đoạn theo ${info.duration.toFixed(1)}s · span ${span.a}→${span.b}`);
process.exit(0);
