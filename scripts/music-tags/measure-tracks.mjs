/**
 * Đo đặc trưng âm thanh của từng bài trong kho, in ra JSON.
 *
 * Vì sao đo bằng máy: gán nhãn 55 bài bằng tai là một buổi, và một buổi ấy
 * KHÔNG lặp lại được — thả thêm ba mươi bài vào thư mục là lại một buổi nữa, do
 * người khác gán, với ba trục thành ba mươi cách hiểu. Phép đo thì lặp lại được
 * và cho cùng kết quả.
 *
 * Đo bằng gì và vì sao:
 * - `RMS_level` — to nhỏ trung bình sau khi đã master. Bản thân nó phân biệt
 *   kém (mọi bản master đều quanh −14 dB), nhưng nó là mốc để đọc hai số kia.
 * - `Crest_factor` — đỉnh chia RMS. Nhạc nén mạnh (phonk, chiptune dồn dập) có
 *   crest thấp; nhạc thoáng có crest cao.
 * - `centroid` — trọng tâm phổ, tức ĐỘ SÁNG. Đây là số phân biệt "mạnh" và "êm"
 *   tốt nhất trong kho này: lo-fi lọc hết dải cao còn phonk thì không.
 * - `flatness` — phổ phẳng như tiếng ồn hay nhọn như một nốt. Mix DÀY nhiều lớp
 *   chồng nhau thì phổ phẳng hơn.
 * - `rolloff` — tần số dưới đó chứa 85% năng lượng. Đi cùng `centroid`.
 *
 * Đo 45 giây từ giây thứ 20 — bỏ phần mở đầu, vì rất nhiều bài mở bằng một đoạn
 * thưa rồi mới vào nhịp, và đo trúng đoạn đó là đọc ra "êm" cho một bài mạnh.
 *
 *   node scripts/music-tags/measure-tracks.mjs > /tmp/music-features.json
 */
import { execFile } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const library = join(here, "..", "..", "server", "data", "music");
const AUDIO = /\.(mp3|m4a|aac|wav|ogg|flac)$/i;

/** Trung bình cộng các giá trị hữu hạn; mảng rỗng trả `null`. */
function mean(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (usable.length === 0) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

async function measure(path) {
  const { stderr } = await run(
    "ffmpeg",
    [
      "-hide_banner",
      "-v",
      "error",
      "-ss",
      "20",
      "-t",
      "45",
      "-i",
      path,
      "-af",
      "aresample=22050," +
        "aspectralstats=measure=centroid+flatness+rolloff," +
        "astats=metadata=1:reset=1," +
        // In sang stderr chứ không sang stdout: stdout của script này là JSON
        // kết quả, trộn vào là hỏng cả hai.
        "ametadata=print:file=/dev/stderr",
      "-f",
      "null",
      "-",
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );

  const pick = (key) =>
    [...stderr.matchAll(new RegExp(`${key}=(-?[\\d.]+)`, "g"))].map((match) =>
      Number(match[1]),
    );

  return {
    rms: mean(pick("astats\\.Overall\\.RMS_level")),
    // `Crest_factor` chỉ có theo TỪNG KÊNH, không có dòng `Overall` — lấy nhầm
    // khoá thì mảng rỗng và cả trục "dày/thưa" mất một nửa bằng chứng.
    crest: mean(pick("astats\\.\\d+\\.Crest_factor")),
    centroid: mean(pick("aspectralstats\\.\\d+\\.centroid")),
    flatness: mean(pick("aspectralstats\\.\\d+\\.flatness")),
    rolloff: mean(pick("aspectralstats\\.\\d+\\.rolloff")),
  };
}

const files = readdirSync(library).filter((name) => AUDIO.test(name));
const rows = [];
for (const file of files) {
  const features = await measure(join(library, file));
  rows.push({ file, ...features });
  process.stderr.write(
    `· ${file} — sáng ${Math.round(features.centroid ?? 0)}Hz\n`,
  );
}
console.log(JSON.stringify(rows, null, 2));
