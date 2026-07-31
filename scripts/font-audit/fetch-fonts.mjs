/**
 * Tải font ứng viên từ kho `google/fonts` về `assets/fonts/`.
 *
 * Font phải đi THEO REPO chứ không lấy của hệ thống: `/System/Library/Fonts/`
 * chỉ có trên macOS, mà máy chủ chạy Linux. Mỗi font kéo theo tệp giấy phép của
 * nó — giấy phép là điều kiện vào danh sách, không phải chuyện kiểm sau.
 *
 * Font biến thiên (`Montserrat[wght].ttf`) không dùng thẳng được: freetype vẽ
 * thể mặc định, tức là Regular, nên chữ in ra mảnh dính. Phải đông cứng thành
 * một thể tĩnh bằng `fonttools varLib.instancer` trước khi ffmpeg đụng tới.
 *
 *   node scripts/font-audit/fetch-fonts.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");
const fontsDir = join(projectRoot, "assets", "fonts");
const RAW = "https://raw.githubusercontent.com/google/fonts/main";

const catalog = JSON.parse(
  readFileSync(join(here, "font-candidates.json"), "utf8"),
);

async function download(remotePath, target) {
  const response = await fetch(`${RAW}/${remotePath}`);
  if (!response.ok) {
    throw new Error(`${remotePath} → HTTP ${response.status}`);
  }
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
}

/**
 * Đông cứng font biến thiên thành một thể tĩnh.
 *
 * Trục nghiêng nằm ở TỆP khác chứ không ở trục biến thiên — Google Fonts tách
 * `Montserrat[wght].ttf` và `Montserrat-Italic[wght].ttf` — nên ở đây chỉ có
 * các trục hình dạng (`wght`, `wdth`) để chốt.
 */
function freezeInstance(source, target, axes) {
  const pins = Object.entries(axes).map(([tag, value]) => `${tag}=${value}`);
  execFileSync(
    "python3",
    ["-m", "fontTools.varLib.instancer", source, ...pins, "-o", target],
    { stdio: "pipe" },
  );
}

async function main() {
  mkdirSync(fontsDir, { recursive: true });
  const licenses = new Map();

  for (const family of catalog.families) {
    const target = join(fontsDir, family.file);
    if (existsSync(target)) {
      console.log(`· ${family.file} — đã có`);
    } else if (family.instanceAxes) {
      const temp = `${target}.variable`;
      await download(family.remote, temp);
      freezeInstance(temp, target, family.instanceAxes);
      execFileSync("rm", ["-f", temp]);
      const pins = Object.entries(family.instanceAxes)
        .map(([tag, value]) => `${tag}=${value}`)
        .join(" ");
      console.log(`✓ ${family.file} — đông cứng ${pins}`);
    } else {
      await download(family.remote, target);
      console.log(`✓ ${family.file}`);
    }
    licenses.set(family.license, family.licenseName);
  }

  // Một giấy phép cho cả họ font: đặt tên theo thư mục nguồn để hai họ không đè
  // lên nhau khi cùng dùng SIL OFL.
  for (const [remotePath] of licenses) {
    const familyDir = remotePath.split("/")[1];
    const target = join(fontsDir, `LICENSE-${familyDir}.txt`);
    if (existsSync(target)) continue;
    await download(remotePath, target);
    console.log(`✓ LICENSE-${familyDir}.txt`);
  }
}

await main();
