/**
 * Tải ảnh emoji về `assets/emoji/` — chỉ đúng những hình có trong vốn từ đóng.
 *
 * Nguồn: kho `googlefonts/noto-emoji`, giấy phép SIL Open Font License 1.1 —
 * cùng loại giấy phép với mấy tệp font đang mang theo trong `assets/fonts/`.
 * KHÔNG lấy từ Apple Color Emoji: hình đẹp hơn nhưng giấy phép của Apple không
 * cho phát hành kèm phần mềm, và máy chủ Linux cũng không có nó.
 *
 * Thu về 192 điểm ảnh chứ không giữ 512: cỡ emoji lớn nhất mà bộ dáng đặt ra là
 * 15% bề rộng khung 1080, tức 162 điểm ảnh. Giữ 512 là mang thừa gấp bảy lần
 * dung lượng để đổi lấy đúng không gì.
 *
 *   npx tsx scripts/emoji/fetch-emoji-assets.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { EMOJI_VOCAB, emojiFileName } from "../../server/emoji-vocab";
import { PROJECT_ROOT } from "../../server/paths";

const run = promisify(execFile);

const SOURCE = "https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512";
const TARGET = join(PROJECT_ROOT, "assets", "emoji");
const SIZE = 192;

mkdirSync(TARGET, { recursive: true });

let ok = 0;
const missing: string[] = [];

for (const entry of EMOJI_VOCAB) {
  const name = emojiFileName(entry.char);
  const response = await fetch(`${SOURCE}/${name}`);
  if (!response.ok) {
    // Báo tên tệp chứ không báo emoji: emoji hiện trên terminal thì đúng, nhưng
    // thứ cần đi tra lại là cái tên tệp không tồn tại.
    missing.push(`${entry.char} → ${name} (${response.status})`);
    continue;
  }
  const target = join(TARGET, name);
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  await run("magick", [target, "-resize", `${SIZE}x${SIZE}`, target]);
  ok += 1;
  console.log(`✓ ${entry.char} ${name}`);
}

if (missing.length > 0) {
  console.error(`\n✗ ${missing.length} hình không có ở nguồn:`);
  for (const line of missing) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`\n${ok}/${EMOJI_VOCAB.length} hình đã về ${TARGET}`);
