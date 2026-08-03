/**
 * `buildBase` phải ra HAI tệp dùng được, từ MỘT lượt giải mã.
 *
 * Vì sao đáng có phép kiểm riêng: lệnh ffmpeg hai đầu ra gãy rất im lặng. Quên
 * `split`/`asplit` thì ffmpeg chối vì nhãn dùng hai lần — cái đó lộ ngay. Nhưng
 * quên `+faststart` hay quên `-g` thì **cả hai tệp vẫn ra, vẫn phát được, vẫn
 * qua mọi phép kiểm hình thức** — chỉ có người dùng kéo thanh thời gian mới thấy
 * hình giật, mà lúc đó không ai nghĩ tới ffmpeg nữa. Đúng cái đã xảy ra.
 *
 * Ba điều được khẳng định:
 * 1. Ra đủ hai tệp, cùng độ dài, bản xem trước đúng khổ và nhẹ hơn hẳn.
 * 2. `moov` nằm TRƯỚC `mdat` ở cả hai — trình duyệt phát được từ byte đầu.
 * 3. Bản xem trước có khung khoá dày (~1 giây), tức tua tới đâu hiện tới đó.
 */

import { execFile } from "node:child_process";
import { mkdtempSync, openSync, readSync, closeSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const DATA_ROOT = mkdtempSync(join(tmpdir(), "tedit-render-"));
process.env.TEDDIT_DATA_ROOT = DATA_ROOT;

const { ensureProjectDirs, workDir } = await import("../../server/paths");
const { buildBase, PREVIEW_WIDTH, PREVIEW_HEIGHT } = await import(
  "../../server/render"
);

let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  if (ok) {
    passed += 1;
    console.log(`  đạt   ${label}`);
  } else {
    failed += 1;
    console.log(`  TRƯỢT ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

/**
 * Thứ tự các hộp ở TẦNG ĐẦU của tệp MP4.
 *
 * `moov` là bảng mục lục. Nằm sau `mdat` thì trình duyệt phải với tới tận cuối
 * tệp mới biết cấu trúc — với một tệp vài trăm MB qua mạng thì đó là chờ và
 * giật. `-movflags +faststart` là thứ đưa nó lên đầu.
 */
function atomOrder(path: string): string[] {
  const fd = openSync(path, "r");
  const size = statSync(path).size;
  const head = Buffer.alloc(8);
  const names: string[] = [];
  let at = 0;
  try {
    while (at < size && names.length < 12) {
      if (readSync(fd, head, 0, 8, at) < 8) break;
      const length = head.readUInt32BE(0);
      names.push(head.toString("latin1", 4, 8));
      if (length < 8) break;
      at += length;
    }
  } finally {
    closeSync(fd);
  }
  return names;
}

const probeValue = async (path: string, entries: string) => {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", entries,
    "-of", "default=nw=1:nk=1",
    path,
  ]);
  return stdout.trim().split("\n");
};

/** Trung bình bao nhiêu khung mới có một khung khoá, đo trên 6 giây đầu. */
async function keyframeGap(path: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "frame=key_frame",
    "-read_intervals", "%+6",
    "-of", "default=nw=1:nk=1",
    path,
  ]);
  const flags = stdout.trim().split("\n");
  const keys = flags.filter((f) => f === "1").length;
  return keys > 0 ? flags.length / keys : Number.POSITIVE_INFINITY;
}

const PROJECT = "prj_thu_dung_hinh";
ensureProjectDirs(PROJECT);

// Hai cảnh NGANG ở nhịp khung khác nhau — đúng hình dạng video điện thoại gửi
// lên, và là thứ ép `fps` với `scale`/`crop` phải thật sự làm việc.
const sources: string[] = [];
for (const [index, fps] of [60, 50].entries()) {
  const path = join(DATA_ROOT, `canh-${index}.mp4`);
  await run("ffmpeg", [
    "-f", "lavfi", "-i", `testsrc=size=1920x1080:rate=${fps}:duration=2`,
    "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
    "-y", path,
  ]);
  sources.push(path);
}

console.log("\nGhép mạch chính");

await buildBase(PROJECT, sources);

const base = join(workDir(PROJECT), "base.mp4");
const preview = join(workDir(PROJECT), "preview.mp4");

check("ra tệp bản dựng", statSync(base).size > 0);
check("ra tệp bản xem trước", statSync(preview).size > 0);

const [baseW] = await probeValue(base, "stream=width");
const [baseH] = await probeValue(base, "stream=height");
const [prevW] = await probeValue(preview, "stream=width");
const [prevH] = await probeValue(preview, "stream=height");
check("bản dựng đúng khổ dọc 1080×1920", baseW === "1080" && baseH === "1920",
  `${baseW}×${baseH}`);
check(
  `bản xem trước đúng khổ ${PREVIEW_WIDTH}×${PREVIEW_HEIGHT}`,
  prevW === String(PREVIEW_WIDTH) && prevH === String(PREVIEW_HEIGHT),
  `${prevW}×${prevH}`,
);

const baseSize = statSync(base).size;
const prevSize = statSync(preview).size;
check("bản xem trước nhẹ hơn hẳn bản dựng", prevSize * 2 < baseSize,
  `${(prevSize / 1024) | 0} KB so với ${(baseSize / 1024) | 0} KB`);

const [baseDur] = await probeValue(base, "format=duration");
const [prevDur] = await probeValue(preview, "format=duration");
check("hai tệp cùng độ dài", Math.abs(+baseDur - +prevDur) < 0.15,
  `${baseDur} so với ${prevDur}`);
// Hai cảnh 2 giây: tổng phải là 4, không phải 4 cộng phần `tpad` đệm thừa.
check("độ dài đúng tổng hai cảnh", Math.abs(+baseDur - 4) < 0.3, baseDur);

console.log("\nPhát được ngay từ byte đầu");

for (const [label, path] of [["bản dựng", base], ["bản xem trước", preview]] as const) {
  const order = atomOrder(path);
  const moov = order.indexOf("moov");
  const mdat = order.indexOf("mdat");
  check(`${label}: moov nằm trước mdat`, moov >= 0 && mdat >= 0 && moov < mdat,
    order.join(" → "));
}

console.log("\nTua mượt");

const prevGap = await keyframeGap(preview);
check("bản xem trước có khung khoá mỗi ~1 giây", prevGap <= 35,
  `trung bình ${prevGap.toFixed(0)} khung mới có một khung khoá`);

console.log("\nDải ảnh không vượt trần texture của GPU");

{
  /*
   * Card đồ hoạ hầu hết chỉ nạp được texture rộng 16.384px. Dải rộng hơn thế thì
   * trình duyệt phải rã ra hoặc vẽ bằng CPU — mà dải thời gian vẽ tấm ấy ở hàng
   * chục ô cùng lúc, nên bàn dựng giật.
   *
   * Đây là thứ KHÔNG lộ ra ở đâu khác: ảnh vẫn dựng thành công, vẫn hiện đúng,
   * chỉ máy người dùng ì ra. Đo bằng một video DÀI vì video ngắn vốn đã dưới trần.
   */
  const { makeFilmstrip } = await import("../../server/media-tools");
  const GPU_TEXTURE_LIMIT = 16384;
  const strip = join(DATA_ROOT, "strip.jpg");
  // Khai 600 giây: đủ dài để bản cũ (trần 60.000px) chắc chắn vượt trần GPU.
  await makeFilmstrip(base, strip, 600);
  const [width] = await probeValue(strip, "stream=width");
  check(
    `dải của video 10 phút vẫn dưới ${GPU_TEXTURE_LIMIT}px`,
    Number(width) <= GPU_TEXTURE_LIMIT,
    `${width}px`,
  );
}

console.log(`\n${passed} đạt, ${failed} trượt\n`);
process.exit(failed > 0 ? 1 : 0);
