/**
 * Khôi phục nhát cắt lặng cho một dự án bằng chính `trimSilence` — dùng khi
 * migration `segments_by_caption` đã xoá mất chúng. Tất định, không gọi LLM.
 *
 *   tsx scripts/flow-test/restore-silence-cuts.ts <projectId>
 */
import { readEnvelope } from "../../server/audio-envelope";
import { trimSilence } from "../../server/auto-trim-silence";
import { db } from "../../server/db";

const projectId = process.argv[2];
if (!projectId) {
  console.error("thiếu projectId");
  process.exit(1);
}

db.pragma("busy_timeout = 8000");

const before = (
  db
    .prepare(
      "SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN removed=1 THEN end_sec-start_sec END),0) rem FROM segments WHERE project_id=?",
    )
    .get(projectId) as { n: number; rem: number }
);

const envelope = await readEnvelope(projectId);
const result = trimSilence(projectId, envelope);

const after = (
  db
    .prepare(
      "SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN removed=1 THEN end_sec-start_sec END),0) rem FROM segments WHERE project_id=?",
    )
    .get(projectId) as { n: number; rem: number }
);

console.log("trimSilence:", JSON.stringify(result));
console.log(
  `bỏ trước: ${before.rem.toFixed(1)}s (${before.n} đoạn) → sau: ${after.rem.toFixed(1)}s (${after.n} đoạn)`,
);
process.exit(0);
