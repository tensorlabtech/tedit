import { execFile } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import { autoAudioFilter, levelAudio, measureAudio } from "../server/auto-audio";

const run = promisify(execFile);

/**
 * Kiểm bộ cân tiếng bằng cách ĐO LẠI, không bằng cách tin vào số học.
 *
 * Phép kiểm duy nhất đáng tin ở đây: chạy bộ lọc ra tệp thật rồi đo tệp ấy. Nếu
 * kết quả không nằm quanh −14 LUFS thì tính toán sai ở đâu đó, dù công thức
 * nhìn có hợp lý đến mấy.
 */

const DATA = "server/data/projects";

/*
 * Chỉ lấy `work/base.mp4` — bản đã ghép các đoạn quay của người dùng.
 *
 * Lượt kiểm đầu quét cả `assets/` và ra 0/6 đạt, nhưng đó là TƯ LIỆU CHÈN: clip
 * minh hoạ tải về, phần lớn không có giọng, có clip gần như im. Cân độ to giọng
 * nói trên một clip không có giọng nói thì con số nào cũng vô nghĩa.
 *
 * Bộ cân tiếng chạy trong `mixMusic`, tức trên bản đã dựng — nên tệp phải kiểm
 * là bản ghép, không phải nguyên liệu rời.
 */
function timTep(limit: number): string[] {
  const out: string[] = [];
  const duyet = (dir: string) => {
    if (out.length >= limit) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (out.length >= limit) return;
      const p = join(dir, e.name);
      if (e.isDirectory()) duyet(p);
      else if (e.name === "base.mp4") out.push(p);
    }
  };
  try { duyet(DATA); } catch { /* chưa có dữ liệu */ }
  return out;
}

async function main() {
  const teps = timTep(6);
  if (teps.length === 0) {
    console.log("Không tìm thấy tệp nào trong", DATA);
    return;
  }

  let dat = 0;
  let xet = 0;

  for (const tep of teps) {
    const truoc = await measureAudio(tep);
    if (!truoc) { console.log(`— ${tep}: không đo được`); continue; }

    const can = levelAudio(truoc);
    if (!can) {
      console.log(`✓ ${tep.split("/").pop()}: ${truoc.lufs.toFixed(1)} LUFS — đã đạt, không chỉnh`);
      continue;
    }

    const chain = autoAudioFilter(can)!;
    const tmp = `/tmp/can-tieng-${xet}.m4a`;
    await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-t", "15",
      "-i", tep, "-af", chain, "-c:a", "aac", "-b:a", "192k", "-y", tmp],
      { timeout: 120_000 });

    const sau = await measureAudio(tmp);
    xet++;
    const lech = sau ? Math.abs(sau.lufs - -14) : 99;
    // Sai số 1,5 dB là ngưỡng tai bắt đầu nghe ra chênh lệch.
    const ok = lech <= 1.5;
    if (ok) dat++;
    console.log(
      `${ok ? "✓" : "✗"} ${tep.split("/").pop()}: ` +
      `${truoc.lufs.toFixed(1)} → ${sau?.lufs.toFixed(1) ?? "?"} LUFS ` +
      `(${can.gainDb > 0 ? "+" : ""}${can.gainDb.toFixed(1)} dB) — ${can.lyDo.join(", ")}`,
    );
  }

  console.log(`\n${dat}/${xet} tệp về đúng đích −14 LUFS (sai số ≤1,5 dB)`);
  if (xet > 0 && dat < xet) process.exitCode = 1;
}

main();
