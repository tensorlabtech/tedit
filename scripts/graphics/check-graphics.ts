/**
 * Kiểm BẤT BIẾN của kho hình đồ hoạ. Chạy:
 *
 *   npm run check:graphics
 *
 * Bốn điều, và cả bốn đều là loại lỗi KHÔNG có triệu chứng lúc sửa mã — chúng chỉ
 * lộ ra ở video đã xuất, tức là sau khi người dùng đã chờ xong cả lượt dựng.
 *
 * 1. **Manifest và `src/` phải khớp HAI CHIỀU.** Thiếu một chiều thì hoặc bộ dáng
 *    trỏ vào một hình không tồn tại, hoặc có tệp nằm đó mà không ai biết còn dùng
 *    hay không.
 * 2. **PNG đã dựng phải có.** Nó đi theo git nên quên chạy lại script là thiếu.
 * 3. **PNG phải có kênh TRONG SUỐT.** Không có thì `alphamerge` ra một khối màu
 *    đặc phủ kín khung — đọc ra như lỗi vẽ, không như một cái hình.
 * 4. **Phần điểm ảnh đục phải nằm trong dải hợp lý.** Đây là phép bắt được ca
 *    `rsvg-convert` thiếu và ai đó lỡ dựng bằng `magick`. Thử thật trên máy này:
 *    `magick` ra một ảnh **đục 100%** — nó vẫn có kênh trong suốt, vẫn đúng khổ,
 *    vẫn qua ba phép kiểm trên, và `alphamerge` sẽ phủ kín cả khung hình.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const dir = join(root, "assets", "graphics");

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  đạt   ${label}`);
  } else {
    failed += 1;
    console.log(`  TRƯỢT ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

type Entry = { kind: string; feel: string; excludes: string[] };
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as {
  kinds: Record<string, string>;
  graphics: Record<string, Entry>;
};
const names = Object.keys(manifest.graphics);

console.log("\nManifest và tệp nguồn khớp nhau hai chiều");
for (const name of names) {
  check(`"${name}" có tệp nguồn`, existsSync(join(dir, "src", `${name}.svg`)));
}
const sources = readdirSync(join(dir, "src"))
  .filter((file) => file.endsWith(".svg"))
  .map((file) => file.replace(/\.svg$/, ""));
for (const source of sources) {
  check(
    `"${source}.svg" có mục trong manifest`,
    names.includes(source),
    "tệp mồ côi — không ai biết nó còn được dùng hay không",
  );
}

console.log("\nLoại hình nằm trong vốn từ ĐÓNG");
for (const name of names) {
  const kind = manifest.graphics[name].kind;
  check(
    `"${name}" loại "${kind}"`,
    Object.hasOwn(manifest.kinds, kind),
    `chỉ có: ${Object.keys(manifest.kinds).join(" · ")}`,
  );
}

console.log("\nPNG đã dựng: có thật, có kênh trong suốt, có nét vẽ");
/*
 * Dải 0,05%–60% điểm ảnh đục.
 *
 * Sàn bắt ca ảnh gần TRỐNG — hình dựng hỏng thành ra không còn nét nào. Đo được
 * trên bốn hình đang có: 0,34%–6,6%, nên sàn 0,05% còn xa mức thật.
 *
 * Trần bắt ca hình ĐẶC, và đây là ca đã xảy ra thật khi thử dựng bằng `magick`:
 * ra ảnh đục 100%. `alphamerge` một hình như thế là một khối màu phủ kín khung —
 * nó che sạch video, mà ba phép kiểm phía trên đều xanh.
 */
const MIN_INK = 0.0005;
const MAX_INK = 0.6;
/**
 * Hình loại `mask` đi ngược luật trên: ĐẶC mới đúng.
 *
 * Chúng không phủ lên khung mà bị áp vào chính VIDEO để cắt nó thành một hình.
 * Phần đục là phần video được GIỮ LẠI — một mặt nạ chỉ đục 5% thì cắt ra một
 * mẩu video bằng cái tem. Đo bốn mặt nạ đang có: 78,6% (ê-líp) tới 99,6% (bo
 * góc), và cả bốn đều đúng.
 *
 * Sàn 0,4 vẫn bắt được ca dựng hỏng: một mặt nạ ra gần trống thì video biến
 * mất, mà lỗi ấy nhìn vào bản xuất chỉ thấy một khung màu trơn — không đọc ra
 * được là mặt nạ hỏng.
 */
const MIN_MASK_INK = 0.4;
for (const name of names) {
  const file = join(dir, "png", `${name}.png`);
  if (!existsSync(file)) {
    check(`"${name}.png" đã dựng`, false, "chạy `npm run graphics:png`");
    continue;
  }
  check(`"${name}.png" đã dựng`, true);
  const channels = execFileSync("magick", ["identify", "-format", "%[channels]", file], {
    encoding: "utf8",
  });
  check(
    `"${name}.png" có kênh trong suốt`,
    channels.includes("a"),
    `kênh: ${channels.trim()}`,
  );
  const ink = Number(
    execFileSync("magick", [file, "-alpha", "extract", "-format", "%[fx:mean]", "info:"], {
      encoding: "utf8",
    }),
  );
  const isMask = manifest.graphics[name].kind === "mask";
  check(
    `"${name}.png" có nét vẽ (${(ink * 100).toFixed(2)}% điểm ảnh đục)`,
    isMask ? ink >= MIN_MASK_INK : ink >= MIN_INK && ink <= MAX_INK,
    isMask
      ? "mặt nạ quá thưa — cắt ra một mẩu video bằng cái tem"
      : ink < MIN_INK
        ? "gần như trống — dấu hiệu dựng bằng bộ render sai"
        : "gần như đặc — `alphamerge` sẽ phủ kín cả khung hình",
  );
}

console.log(`\n${passed} đạt, ${failed} trượt`);
process.exit(failed === 0 ? 0 : 1);
