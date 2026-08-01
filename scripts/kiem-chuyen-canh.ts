import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { JUNCTION_SPECS, CROSS_SECONDS } from "../server/junction-kinds";

const run = promisify(execFile);

/**
 * Kiểm CHUYỂN CẢNH THẬT: chạy được, và KHÔNG làm video dài ngắn đi.
 *
 * Cái thứ hai mới là điều đáng sợ. Mọi mốc chữ, tư liệu và nhạc đều tính theo
 * "tổng độ dài các khoảng còn giữ"; chuyển cảnh nào nuốt mất dù chỉ vài phần
 * trăm giây thì ở chỗ nối thứ hai mươi phụ đề đã rơi sang câu khác — mà nhìn
 * bản dựng thì chỉ thấy chữ hơi lệch, không thấy vì sao.
 *
 * Nên phép kiểm không hỏi "có chạy không", nó hỏi "dài đúng bằng bản cắt thẳng
 * không", và so tới từng phần nghìn giây.
 */

const CHEO = JUNCTION_SPECS.filter((spec) => spec.cross);
const DIR = mkdtempSync(join(tmpdir(), "kiem-cheo-"));

/** Nguồn dựng sẵn: hai màu khác hẳn nhau để nhìn ra chỗ chuyển, kèm tiếng. */
async function dungNguon(): Promise<string> {
  const path = join(DIR, "nguon.mp4");
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=360x640:rate=30:duration=20",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=20",
    "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-y", path,
  ]);
  return path;
}

async function doDai(path: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path,
  ]);
  return Number(stdout.trim());
}

/**
 * Dựng hai đoạn nối nhau — có hoặc không có chuyển cảnh — rồi trả độ dài.
 *
 * Dựng lại bằng tay đúng phép của `cutRanges` thay vì gọi nó: hàm ấy cần cơ sở
 * dữ liệu và thư mục dự án, mà thứ cần kiểm chỉ là số học của việc mượn đệm.
 */
async function ghep(
  nguon: string,
  transition: string | null,
  ten: string,
): Promise<number> {
  // Giữ [0 · 5] và [10 · 15]; quãng [5 · 10] bị bỏ, đó là chỗ mượn đệm.
  const path = join(DIR, `${ten}.mp4`);
  const dem = CROSS_SECONDS / 2;
  const filter = transition
    ? `[0:v]trim=0:${5 + dem},setpts=PTS-STARTPTS[v0];` +
      `[0:v]trim=${10 - dem}:15,setpts=PTS-STARTPTS[v1];` +
      `[0:a]atrim=0:${5 + dem},asetpts=PTS-STARTPTS[a0];` +
      `[0:a]atrim=${10 - dem}:15,asetpts=PTS-STARTPTS[a1];` +
      `[v0][v1]xfade=transition=${transition}:duration=${CROSS_SECONDS}:offset=${5 - dem}[vout];` +
      `[a0][a1]acrossfade=d=${CROSS_SECONDS}[aout]`
    : `[0:v]trim=0:5,setpts=PTS-STARTPTS[v0];[0:v]trim=10:15,setpts=PTS-STARTPTS[v1];` +
      `[0:a]atrim=0:5,asetpts=PTS-STARTPTS[a0];[0:a]atrim=10:15,asetpts=PTS-STARTPTS[a1];` +
      `[v0][v1]concat=n=2:v=1:a=0[vout];[a0][a1]concat=n=2:v=0:a=1[aout]`;

  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-i", nguon,
    "-filter_complex", filter, "-map", "[vout]", "-map", "[aout]",
    "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-y", path,
  ], { timeout: 120_000 });
  return doDai(path);
}

async function main() {
  const nguon = await dungNguon();
  const chuan = await ghep(nguon, null, "cat-thang");
  console.log(`bản cắt thẳng: ${chuan.toFixed(3)}s — đây là mốc phải giữ\n`);

  let dat = 0;
  let truot = 0;
  for (const spec of CHEO) {
    try {
      const dai = await ghep(nguon, spec.cross!, spec.id);
      const lech = Math.abs(dai - chuan);
      // Một khung hình ở 30 hình/giây là 0,033 giây. Lệch dưới nửa khung thì
      // không khung nào rơi đi đâu cả.
      const ok = lech <= 0.017;
      if (ok) dat++;
      else truot++;
      console.log(
        `${ok ? "✓" : "✗"} ${spec.id.padEnd(18)} ${spec.cross!.padEnd(12)} ` +
          `${dai.toFixed(3)}s (lệch ${(lech * 1000).toFixed(0)}ms)`,
      );
    } catch (error) {
      truot++;
      console.log(`✗ ${spec.id.padEnd(18)} KHÔNG DỰNG ĐƯỢC — ${(error as Error).message.slice(0, 60)}`);
    }
  }

  console.log(`\n${dat} đạt · ${truot} trượt`);
  if (truot > 0) process.exitCode = 1;
}

main();
