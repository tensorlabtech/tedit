/**
 * Thử bộ TỰ CÂN HÌNH trên các tệp thật trong `server/data`.
 *
 *   npx tsx scripts/thu-can-hinh.ts
 *
 * In ra số đo, quyết định, và xuất một ảnh so trước/sau để nhìn tận mắt —
 * vì "sáng hơn 8%" trên giấy không nói được nó có đẹp hơn hay không.
 */
import { execFile } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import { autoGradeFilter, canHinh, doHinh } from "../server/auto-grade";

const run = promisify(execFile);
const ROOT = "server/data/projects";

async function main() {
  if (!existsSync(ROOT)) return console.log("chưa có dự án nào");
  const files: string[] = [];
  for (const prj of readdirSync(ROOT)) {
    const media = join(ROOT, prj, "media");
    if (!existsSync(media)) continue;
    for (const f of readdirSync(media)) {
      if (/\.(mp4|mov|m4v)$/i.test(f)) files.push(join(media, f));
    }
  }
  console.log(`${files.length} tệp\n`);

  for (const path of files.slice(0, 6)) {
    const stats = await doHinh(path);
    if (!stats) {
      console.log(`${path.split("/").pop()}  — không đo được`);
      continue;
    }
    const can = canHinh(stats);
    const chain = autoGradeFilter(can);
    console.log(`${path.split("/").pop()}`);
    console.log(
      `  đo:  sáng ${stats.yAvg.toFixed(0)}/255 · dải ${stats.yMin.toFixed(0)}–${stats.yMax.toFixed(0)} · màu ${stats.satAvg.toFixed(1)}`,
    );
    console.log(`  quyết: ${can ? can.lyDo.join(" · ") : "video đã ổn, không chỉnh gì"}`);
    if (chain) console.log(`  lọc: ${chain}`);
    console.log();
  }

  // Xuất ảnh so trước/sau của tệp đầu tiên có chỉnh
  for (const path of files) {
    const can = canHinh(await doHinh(path));
    const chain = autoGradeFilter(can);
    if (!chain) continue;
    const out = "/tmp/can-hinh-so.png";
    await run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-ss", "3", "-i", path, "-ss", "3", "-i", path,
      "-filter_complex",
      `[0:v]scale=360:-2[a];[1:v]${chain},scale=360:-2[b];[a][b]hstack`,
      "-frames:v", "1", out,
    ]);
    console.log(`ảnh so trước/sau: ${out}  (trái = gốc, phải = đã chỉnh)`);
    break;
  }
}

void main();
