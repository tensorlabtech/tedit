/**
 * In bảng chữ mẫu qua từng font ứng viên bằng ĐÚNG đường vẽ của máy chủ.
 *
 * Cùng bộ tham số với `server/render.ts`: `drawtext` + `borderw` theo
 * `EDGE_SHARE`, `bordercolor=black@0.7`, khung 1080×1920. Đo bề rộng bằng
 * ImageMagick với chính tệp font sẽ in — không ước theo số ký tự.
 *
 * Hai hàng đầu là hàng dấu chồng dấu LẶP LẠI ở `lineHeight = 1.0`: đó là phép
 * thử duy nhất cho câu hỏi "dấu của dòng dưới có đè chân chữ dòng trên không".
 *
 *   node scripts/font-audit/render-ffmpeg.mjs
 */
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");
const fontsDir = join(projectRoot, "assets", "fonts");
const outputDir = join(
  projectRoot,
  "plans",
  "260731-1046-caption-style-packs",
  "reports",
  "font-audit",
);

const WIDTH = 1080;
const HEIGHT = 1920;
const EDGE_SHARE = 0.022;
const EDGE_COLOR = "black@0.7";
const LINE_HEIGHT = 1;
const SAFE_LEFT = 0.11;
const USABLE = WIDTH * (1 - SAFE_LEFT - 0.11);

const catalog = JSON.parse(readFileSync(join(here, "font-candidates.json")));
const [upperMarks, lowerMarks, upperLine, lowerLine, longLine] = readFileSync(
  join(here, "sample-text.txt"),
  "utf8",
)
  .trim()
  .split("\n");

/** Trần cỡ chữ của sản phẩm, theo bề rộng khung — khớp `MAX_SCALE`. */
const MAX_SCALE = 0.15;
/** Chữ dẫn của kiểu `taper` chỉ bằng 0,45 cỡ ý — cỡ NHỎ NHẤT sản phẩm in ra. */
const LEAD_RATIO = 0.45;

/** Cắt câu dài làm đôi ở ranh giới tiếng, để nó xuống hai hàng như lúc vẽ thật. */
function splitInHalf(sentence) {
  const words = sentence.split(" ");
  const middle = Math.ceil(words.length / 2);
  return [words.slice(0, middle).join(" "), words.slice(middle).join(" ")];
}

const [longHead, longTail] = splitInHalf(longLine);

/**
 * Hàng của bảng mẫu, theo thứ tự phải soi.
 *
 * Hai hàng dấu chồng dấu LẶP LẠI liền nhau là phép thử `lineHeight`: chỉ khi hai
 * hàng giống hệt nằm sát nhau mới thấy dấu của hàng dưới chạm chân hàng trên.
 */
const ROWS = [
  { text: upperMarks, scale: 1 },
  { text: upperMarks, scale: 1 },
  { text: lowerMarks, scale: 1 },
  { text: lowerMarks, scale: 1 },
  { text: upperLine, scale: 1 },
  { text: lowerLine, scale: 1 },
  { text: longHead, scale: 1 },
  { text: longTail, scale: 1 },
  { text: lowerMarks, scale: LEAD_RATIO },
];

const escapeDrawText = (value) =>
  value.replace(/\\/g, "\\\\").replace(/'/g, "’").replace(/:/g, "\\:");

async function measureWidth(text, fontFile, fontSize) {
  const { stdout } = await run("magick", [
    "-background",
    "none",
    "-font",
    fontFile,
    "-pointsize",
    String(fontSize),
    `label:${text}`,
    "-format",
    "%w",
    "info:",
  ]);
  return Number(stdout.trim());
}

/**
 * Cỡ của MỘT hàng: chạm trần cỡ chữ của sản phẩm, hoặc thu lại cho vừa bề rộng.
 *
 * Chọn cỡ theo từng hàng chứ không một cỡ chung cho cả bảng: một cỡ chung thì
 * hàng dài nhất kéo tụt mọi hàng khác xuống 46px, và ở cỡ đó dấu tiếng Việt nào
 * cũng nhìn như nhau — bảng mẫu mất hết tác dụng.
 */
async function fitRowSize(row, fontFile) {
  const at100 = await measureWidth(row.text, fontFile, 100);
  const byWidth = ((USABLE * 0.98) / at100) * 100;
  return Math.round(Math.min(WIDTH * MAX_SCALE, byWidth) * row.scale);
}

async function renderSheet(label, fontFile, target) {
  const sizes = [];
  for (const row of ROWS) sizes.push(await fitRowSize(row, fontFile));
  const draws = [];
  let y = Math.round(HEIGHT * 0.06);
  for (const [index, row] of ROWS.entries()) {
    const fontSize = sizes[index];
    draws.push(
      `drawtext=fontfile='${fontFile}':text='${escapeDrawText(row.text)}':` +
        `fontcolor=#FFFFFF:alpha=0.92:fontsize=${fontSize}:` +
        `x=${Math.round(WIDTH * SAFE_LEFT)}:y=${y}:` +
        `borderw=${Math.max(2, Math.round(fontSize * EDGE_SHARE))}:` +
        `bordercolor=${EDGE_COLOR}`,
    );
    y += Math.round(fontSize * LINE_HEIGHT);
  }
  // Nhãn tên font in ở đáy bằng chính font đang kiểm — thiếu glyph thì lộ ngay.
  draws.push(
    `drawtext=fontfile='${fontFile}':text='${escapeDrawText(label)} · ${sizes[0]}px':` +
      `fontcolor=#FFD400:fontsize=34:x=${Math.round(WIDTH * SAFE_LEFT)}:y=${HEIGHT - 120}`,
  );

  await run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=#3A3F45:s=${WIDTH}x${HEIGHT}`,
    "-vf",
    draws.join(","),
    "-frames:v",
    "1",
    target,
  ]);
  return sizes[0];
}

mkdirSync(outputDir, { recursive: true });
const entries = catalog.families.map((family) => ({
  id: family.id,
  label: family.label,
  file: join(fontsDir, family.file),
}));
entries.push({
  id: catalog.reference.id,
  label: catalog.reference.label,
  file: catalog.reference.file,
});

for (const entry of entries) {
  const target = join(outputDir, `ffmpeg-${entry.id}.png`);
  const top = await renderSheet(entry.label, entry.file, target);
  console.log(`✓ ffmpeg-${entry.id}.png — cỡ hàng dấu ${top}px`);
}
