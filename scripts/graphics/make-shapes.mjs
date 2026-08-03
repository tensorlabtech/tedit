/**
 * Sinh SVG hình học từ tham số — nguồn của tầng một trong ba tầng assets.
 *
 *   node scripts/graphics/make-shapes.mjs
 *
 * Sinh chứ không vẽ tay, và đó là cả điểm của đợt này: một cái khung là bốn con
 * số, không phải một tệp ai đó gửi qua. Sửa độ dày viền là sửa một số rồi chạy
 * lại, không phải mở phần mềm vẽ.
 *
 * Tệp ra đi theo git và **sửa tay được** — script này là chỗ bắt đầu, không phải
 * cái cổng duy nhất. Ngày nào cần một hình mà tham số không tả nổi thì cứ thả
 * SVG vào `src/`; `check:graphics` chỉ đòi nó có mục trong manifest.
 *
 * Nét vẽ để TRẮNG. Chỉ kênh trong suốt có nghĩa — màu áp lúc chạy bằng
 * `alphamerge`, nên một hình dùng cho cả mười bộ dáng.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "graphics", "src");
const W = 1080;
const H = 1920;

const svgAt = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n` +
  `  <!-- Sinh bởi scripts/graphics/make-shapes.mjs — nét TRẮNG, màu áp lúc chạy -->\n` +
  `${body}\n</svg>\n`;

/** Hình phủ đúng khổ khung xuất. */
const svg = (body) => svgAt(W, H, body);

/** Viền bao quanh khung, dày `stroke`, lùi vào `inset`. */
const border = (inset, stroke) =>
  svg(
    `  <rect x="${inset + stroke / 2}" y="${inset + stroke / 2}" ` +
      `width="${W - 2 * inset - stroke}" height="${H - 2 * inset - stroke}" ` +
      `fill="none" stroke="#FFFFFF" stroke-width="${stroke}"/>`,
  );

/** Lưới một phần ba — hai dọc hai ngang, dấu bố cục của máy ảnh. */
const thirds = (stroke) => {
  const lines = [];
  for (const at of [1 / 3, 2 / 3]) {
    lines.push(`  <line x1="${W * at}" y1="0" x2="${W * at}" y2="${H}" stroke="#FFFFFF" stroke-width="${stroke}"/>`);
    lines.push(`  <line x1="0" y1="${H * at}" x2="${W}" y2="${H * at}" stroke="#FFFFFF" stroke-width="${stroke}"/>`);
  }
  return svg(lines.join("\n"));
};

/** Bốn dấu góc kiểu khung ngắm — chỉ có góc, không có cạnh. */
const corners = (inset, stroke, arm) => {
  const parts = [];
  for (const [x, y, dx, dy] of [
    [inset, inset, 1, 1],
    [W - inset, inset, -1, 1],
    [inset, H - inset, 1, -1],
    [W - inset, H - inset, -1, -1],
  ]) {
    parts.push(
      `  <path d="M ${x} ${y + dy * arm} L ${x} ${y} L ${x + dx * arm} ${y}" ` +
        `fill="none" stroke="#FFFFFF" stroke-width="${stroke}" stroke-linecap="square"/>`,
    );
  }
  return svg(parts.join("\n"));
};

/**
 * Hình BÁM CHỮ vẽ ở khổ danh nghĩa rồi cắt ba lát lúc dùng.
 *
 * Hai đầu giữ nguyên, khúc giữa kéo dài — nên cụm một tiếng và cụm năm tiếng có
 * hai đầu GIỐNG HỆT nhau. Kéo giãn cả hình thì nét dọc ở hai đầu mảnh dần theo
 * bề rộng cụm, và cùng một bộ dáng đọc ra hai kiểu.
 */
const WRAP_W = 900;

/** Vòng khoanh — ê-líp hở, dáng bút khoanh tay. */
const oval = (h, stroke) =>
  svgAt(WRAP_W, h,
    `  <ellipse cx="${WRAP_W / 2}" cy="${h / 2}" rx="${WRAP_W / 2 - stroke}" ry="${h / 2 - stroke}" ` +
      `fill="none" stroke="#FFFFFF" stroke-width="${stroke}"/>`);

/** Gạch chân — nét dày ở giữa, thon dần về hai đầu. */
const underline = (h, stroke) =>
  svgAt(WRAP_W, h,
    `  <path d="M ${stroke} ${h * 0.62} Q ${WRAP_W / 2} ${h * 0.34} ${WRAP_W - stroke} ${h * 0.62}" ` +
      `fill="none" stroke="#FFFFFF" stroke-width="${stroke}" stroke-linecap="round"/>`);

/*
 * ── MẶT NẠ Ô HÌNH ───────────────────────────────────────────────────────────
 *
 * Khác mọi hình trên ở chỗ dùng: những hình kia PHỦ LÊN khung, mấy hình này bị
 * áp vào chính VIDEO qua `alphamerge` để cắt nó thành một hình dạng. Nên nét
 * phải ĐẶC (một khối trắng), không phải viền — viền thì cắt ra một cái vòng
 * video rỗng ruột.
 *
 * Khổ nhỏ hơn khung xuất: ô hình vốn không phủ kín khung, và dựng đúng khổ nó
 * được dùng thì không phải thu lần nữa lúc chạy.
 */
const MASK_W = 820;

/** Chữ nhật bo góc — ô hình cơ bản nhất. */
const maskRound = (h, r) =>
  svgAt(MASK_W, h, `  <rect width="${MASK_W}" height="${h}" rx="${r}" ry="${r}" fill="#FFFFFF"/>`);

/** Ê-líp trọn — dáng ống kính, mềm hẳn so với mọi hình vuông vức khác. */
const maskOval = (h) =>
  svgAt(MASK_W, h,
    `  <ellipse cx="${MASK_W / 2}" cy="${h / 2}" rx="${MASK_W / 2}" ry="${h / 2}" fill="#FFFFFF"/>`);

/** Vòm — nửa tròn trên, vuông dưới. Dáng cửa sổ nhà thờ, rất dễ nhận ra. */
const maskArch = (h) =>
  svgAt(MASK_W, h,
    `  <path d="M0 ${h} V${MASK_W / 2} A${MASK_W / 2} ${MASK_W / 2} 0 0 1 ${MASK_W} ${MASK_W / 2} V${h} Z" fill="#FFFFFF"/>`);

/**
 * Mép rách — bốn cạnh gợn sóng không đều, dáng ảnh xé từ tạp chí.
 *
 * Biên độ gợn tính theo PHẦN TRĂM cạnh chứ không theo pixel: cùng một hàm dùng
 * cho mọi khổ, và mép rách của một ô cao 1000 trông cùng độ "rách" với ô cao
 * 600. Số bước lẻ (7) để hai cạnh đối không đối xứng nhau — đối xứng thì nó đọc
 * ra là hoa văn chứ không ra là rách.
 */
const maskTorn = (h, amp) => {
  const steps = 7;
  const pt = [];
  const jitter = (i) => (i % 2 === 0 ? amp : -amp) * (0.6 + ((i * 7) % 5) / 10);
  for (let i = 0; i <= steps; i += 1) pt.push([(MASK_W / steps) * i, jitter(i)]);
  for (let i = 1; i <= steps; i += 1) pt.push([MASK_W + jitter(i), (h / steps) * i]);
  for (let i = steps - 1; i >= 0; i -= 1) pt.push([(MASK_W / steps) * i, h + jitter(i)]);
  for (let i = steps - 1; i >= 1; i -= 1) pt.push([jitter(i), (h / steps) * i]);
  const d = pt.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return svgAt(MASK_W, h, `  <path d="${d} Z" fill="#FFFFFF"/>`);
};

/*
 * ── NÉT VẼ TAY ──────────────────────────────────────────────────────────────
 *
 * Hình trang trí rời, đặt vào chỗ trống của trang. Nét TRẮNG như mọi hình khác
 * nên một tệp dùng cho mọi bộ dáng.
 *
 * Vẽ bằng đường cong tay chứ không bằng hình học đều: một hình tròn hoàn hảo
 * đọc ra là đồ hoạ máy, còn một vòng hơi méo đọc ra là có người vừa vẽ. Đó là
 * cả điểm của nhóm này.
 */
const DOODLE = 320;

/** Ngoằn ngoèo — ba nhịp sóng, nét bo đầu. */
const doodleSquiggle = () =>
  svgAt(DOODLE, 120,
    `  <path d="M12 84 Q64 12 116 66 T220 60 T308 40" fill="none" stroke="#FFFFFF" ` +
      `stroke-width="14" stroke-linecap="round"/>`);

/** Mặt cười — hai chấm mắt, một cung miệng. Không có vòng mặt, đúng lối vẽ vội. */
const doodleSmile = () =>
  svgAt(DOODLE, DOODLE,
    `  <circle cx="108" cy="118" r="13" fill="#FFFFFF"/>\n` +
    `  <circle cx="212" cy="112" r="13" fill="#FFFFFF"/>\n` +
    `  <path d="M84 186 Q160 252 238 178" fill="none" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round"/>`);

/** Dấu tích — hai nét, nét sau dài gấp đôi nét trước. */
const doodleCheck = () =>
  svgAt(DOODLE, 240,
    `  <path d="M40 132 L118 200 L284 44" fill="none" stroke="#FFFFFF" ` +
      `stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>`);

/** Đám mây — ba cung chồng, hở đáy. */
const doodleCloud = () =>
  svgAt(DOODLE, 200,
    `  <path d="M52 152 Q18 106 62 88 Q70 34 128 44 Q160 8 206 42 Q268 40 268 96 Q300 118 268 152 Z" ` +
      `fill="none" stroke="#FFFFFF" stroke-width="13" stroke-linejoin="round"/>`);

const shapes = {
  "khung-mong": border(28, 6),
  "khung-day": border(28, 24),
  "luoi-ba": thirds(3),
  "dau-goc": corners(52, 9, 96),
  "khoanh-oval": oval(300, 14),
  "gach-chan": underline(90, 16),
  "o-bo-goc": maskRound(1080, 64),
  "o-oval": maskOval(1080),
  "o-vom": maskArch(1120),
  "o-mep-rach": maskTorn(1040, 16),
  "net-ngoan-ngoeo": doodleSquiggle(),
  "net-mat-cuoi": doodleSmile(),
  "net-dau-tich": doodleCheck(),
  "net-may": doodleCloud(),
};

for (const [name, body] of Object.entries(shapes)) {
  writeFileSync(join(OUT, `${name}.svg`), body);
  console.log(`✓ ${name}.svg`);
}
