/**
 * Dựng MỘT khung hình chữ bằng đúng đường in ra thật, để so với trang xem.
 *
 * Chỉ dùng khi kiểm; không nằm trong luồng xuất video. Có nó vì cách duy nhất
 * biết "bản in giống trang xem chưa" là đặt hai ảnh cạnh nhau — mô tả bằng lời
 * thì lần nào cũng nghe như đã giống.
 *
 * Cách chạy:
 *   npx tsx server/dev-render-frame.ts "<chữ>" <căn> <nhấn> <dải> <đường ra> [từ khoá...]
 */
import { ffmpeg } from "./media-tools";
import { resolvePackFont } from "./paths";
import { alphaExpr, positionExpr, unitDelay } from "./reveal-expr";
import { OUT_HEIGHT, OUT_WIDTH } from "./render";
import {
  textWidth,
  type AlignId,
  type Band,
  type EmphasisId,
} from "./text-layout";
import { NHIP_DEN } from "./style-pack-catalog";
import { ffmpegColor, packForElement } from "./style-pack";
import { placeWords } from "./word-layout";

const [content, align, emphasis, band, target, bgArg, ...keywords] =
  process.argv.slice(2);
// Vai chữ suy từ chính danh sách từ khoá nhận qua dòng lệnh — CÙNG luật với
// đường in thật. Truyền từ khoá là thấy vai `accent`, không truyền là `voice`.
const pack = packForElement(NHIP_DEN, null, keywords);
const fontPath = resolvePackFont(pack.font.file);
const bgColor = bgArg && bgArg !== "-" ? bgArg : "#3a3a3a";

/** Cùng phép thoát ký tự với bộ in thật. */
const escape = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\\\\\'")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%");

const { words: placed } = await placeWords(
  content,
  keywords,
  align as AlignId,
  emphasis as EmphasisId,
  band as Band,
  OUT_WIDTH,
  OUT_HEIGHT,
  pack,
);

const draws: string[] = [];
for (const [, word] of placed.entries()) {
  const startAt = unitDelay(pack, word.row, word.col);
  const spot = positionExpr(pack, {
    x: word.x,
    y: word.y,
    width: await textWidth(word.text, word.fontSize, pack),
    fontSize: word.fontSize,
    scale: word.fontSize / OUT_WIDTH,
    startAt,
  });
  const edge = pack.edge
    ? `:borderw=${Math.max(2, Math.round(word.fontSize * pack.edge.share))}` +
      `:bordercolor=${ffmpegColor(pack.edge.tone)}`
    : "";
  draws.push(
    `drawtext=fontfile='${fontPath}':text='${escape(word.text)}':` +
      `fontcolor=${word.color}:alpha='${alphaExpr(pack, startAt, word.alpha)}':` +
      `fontsize=${word.fontSize}:x='${spot.x}':y='${spot.y}'` +
      edge,
  );
}

// Lấy khung ở giây 3: mọi tiếng đã hiện xong, nên so được dáng cuối cùng.
await ffmpeg([
  "-f",
  "lavfi",
  "-i",
  `color=c=${bgColor}:s=${OUT_WIDTH}x${OUT_HEIGHT}:d=4:r=30`,
  "-f",
  "lavfi",
  "-i",
  `color=c=black@0.0:s=${OUT_WIDTH}x${OUT_HEIGHT}:d=4:r=30,format=rgba`,
  "-filter_complex",
  `[1:v]${draws.join(",")}[txt];[txt]split[g][m];` +
    `[g]colorchannelmixer=rr=0:rg=0:rb=0:gr=0:gg=0:gb=0:br=0:bg=0:bb=0:aa=0.9,` +
    `scale=${OUT_WIDTH / 2}:${OUT_HEIGHT / 2},boxblur=luma_radius=5:alpha_radius=5,` +
    `scale=${OUT_WIDTH}:${OUT_HEIGHT}[glow];` +
    `[0:v][glow]overlay=format=rgb[bg];[bg][m]overlay=format=rgb[out]`,
  "-map",
  "[out]",
  "-ss",
  "3",
  "-frames:v",
  "1",
  "-y",
  target,
]);
console.log(`${placed.length} tiếng → ${target}`);
