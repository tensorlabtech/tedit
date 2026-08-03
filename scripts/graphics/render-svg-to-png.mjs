/**
 * Đổi SVG nguồn thành PNG — tầng hai trong ba tầng assets.
 *
 *   node scripts/graphics/render-svg-to-png.mjs
 *
 * ## Vì sao chỉ chạy lúc PHÁT TRIỂN, không chạy lúc xuất video
 *
 * Đo thật trên máy này: cùng một tệp SVG, `rsvg-convert` dựng đúng còn `magick`
 * ra một ảnh **trắng trơn, mất cả hình** — nó rơi về bộ MSVG nội bộ. Một phụ
 * thuộc render âm thầm sai còn tệ hơn một phụ thuộc thiếu hẳn: thiếu thì dừng
 * ngay, sai thì cả trăm video xuất ra hỏng mà không ai báo.
 *
 * Nên PNG **đi theo git**, y như `assets/fonts/`. Máy chủ không cần `librsvg`,
 * và ràng buộc *"máy chủ không thêm phụ thuộc nào"* của đợt này giữ nguyên.
 *
 * KHÔNG rơi về `magick` khi thiếu `rsvg-convert`. Dừng hẳn.
 *
 * ## Vì sao thư mục ra tên `png/` chứ không tên `build/`
 *
 * Những tệp này PHẢI được commit. Một thư mục tên `build` là thứ mà bất kỳ luật
 * `.gitignore` chung nào cũng có thể nuốt mất về sau, và lúc đó lỗi lộ ra ở máy
 * chủ dưới dạng "không tìm thấy hình" chứ không lộ ra lúc sửa.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = join(root, "assets", "graphics");

try {
  execFileSync("rsvg-convert", ["--version"], { stdio: "pipe" });
} catch {
  console.error(
    "Thiếu `rsvg-convert`. Cài bằng `brew install librsvg`.\n" +
      "KHÔNG rơi về `magick`: đo được là nó dựng SVG sai — ra ảnh trắng trơn,\n" +
      "mà sai kiểu ấy thì không chỗ nào báo.",
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
const names = Object.keys(manifest.graphics);

const orphans = readdirSync(join(dir, "src"))
  .filter((file) => file.endsWith(".svg"))
  .map((file) => file.replace(/\.svg$/, ""))
  .filter((name) => !names.includes(name));
if (orphans.length > 0) {
  console.error(`SVG không có mục trong manifest: ${orphans.join(", ")}`);
  process.exit(1);
}

for (const name of names) {
  const entry = manifest.graphics[name];
  /*
   * Hình `plate` dựng đúng khổ khung xuất; hình `wrap` giữ KHỔ DANH NGHĨA.
   *
   * `wrap` co giãn theo bề rộng cụm chữ nên nó không có một khổ đúng nào cả —
   * ép về 1080×1920 là kéo giãn sẵn một lần rồi lại kéo lần nữa lúc dùng, và nét
   * ra răng cưa. Khổ danh nghĩa khai trong manifest, cùng chỗ với bề rộng hai
   * đầu, để phép cắt ba lát đọc được một nguồn duy nhất.
   */
  const size =
    entry.kind === "wrap"
      ? ["-w", String(entry.nominal.w), "-h", String(entry.nominal.h)]
      : ["-w", "1080", "-h", "1920"];
  writeFileSync(
    join(dir, "png", `${name}.png`),
    execFileSync("rsvg-convert", [...size, join(dir, "src", `${name}.svg`)]),
  );
  console.log(`✓ ${name}.png`);
}
