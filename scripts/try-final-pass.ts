/**
 * Dựng THẬT một đoạn ngắn qua đúng đường mà bản xuất đi qua, rồi so hai bản:
 * có tự cân hình và không.
 *
 *   npx tsx scripts/try-final-pass.ts
 *
 * Khác `try-image-grade.ts` ở chỗ: bản kia chỉ áp bộ lọc lên một khung, bản này
 * chạy cả chuỗi — nắn màu bộ dáng, hiệu ứng chỗ nối, tự cân hình — để bắt lỗi
 * thứ tự nối chuỗi mà một khung đơn lẻ không lộ ra.
 */
import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import { autoGradeFilter, gradeImage, measureImage } from "../server/auto-grade";
import { JUNCTION_SPECS } from "../server/junction-kinds";
import { junctionFilter } from "../server/render";

const run = promisify(execFile);
const pack = { intensity: { punchScale: 0.08, flashAmount: 0.7 } } as never;

async function main() {
  const root = "server/data/projects";
  let nguon = "";
  for (const prj of readdirSync(root)) {
    const media = join(root, prj, "media");
    if (!existsSync(media)) continue;
    const f = readdirSync(media).find((x) => /\.(mp4|mov)$/i.test(x));
    if (f) { nguon = join(media, f); break; }
  }
  if (!nguon) return console.log("không có tệp nào để thử");
  console.log(`nguồn: ${nguon}\n`);

  const canh = gradeImage(await measureImage(nguon));
  const tuCan = autoGradeFilter(canh);
  console.log(`tự cân hình: ${canh ? canh.lyDo.join(" · ") : "không cần"}`);

  // Chuỗi ĐẦY ĐỦ: tự cân hình → hiệu ứng chỗ nối, đúng thứ tự của `burnElements`
  let loi = 0;
  for (const spec of JUNCTION_SPECS.slice(0, 6)) {
    const junc = junctionFilter([{ start: 0.6, end: 1.2, peak: 0.9 }], spec.id, pack);
    const chain = [tuCan, junc].filter(Boolean).join(",");
    if (!chain) continue;
    try {
      await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
        "-t", "2", "-i", nguon, "-vf", chain,
        "-frames:v", "40", "-f", "null", "-"], { timeout: 90_000 });
      console.log(`  OK    cả chuỗi với ${spec.id}`);
    } catch (e) {
      const line = String((e as { stderr?: string }).stderr ?? e).split("\n")
        .filter((l) => /Error|Invalid|failed/i.test(l))[0];
      console.log(`  HỎNG  ${spec.id} — ${(line ?? "").trim().slice(0, 110)}`);
      loi++;
    }
  }
  console.log(loi === 0 ? "\nchuỗi đầy đủ chạy trót lọt" : `\n${loi} chỗ hỏng`);
  if (loi > 0) process.exitCode = 1;
}

void main();
