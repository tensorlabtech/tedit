/**
 * Render lại ffmpeg export từ DATA HIỆN TẠI (để A/B công bằng với Remotion — cùng
 * schedule). Ghi đè out/final.mp4 của project.
 *   npx tsx scripts/remotion/run-fresh-export.ts <projectId>
 */
import { runExport } from "../../server/pipeline";

const projectId = process.argv[2];
if (!projectId) {
  console.error("Thiếu projectId");
  process.exit(1);
}

console.log(`runExport ${projectId}…`);
await runExport(projectId);
console.log("XONG export ffmpeg mới");
