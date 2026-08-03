/**
 * In cùng một cụm chữ qua CẢ NĂM bộ dáng, bằng đúng đường vẽ của bản xuất video.
 *
 * Đây là phép thử của phase 4: bảng giá trị không nói được hai bộ có đọc ra khác
 * nhau hay không — chỉ ảnh đặt cạnh nhau mới nói được.
 *
 * Lấy khung ở giây 3: mọi tiếng đã hiện xong nên so được dáng cuối cùng. Bộ
 * "Đứng yên" tắt hiệu ứng nên nó vốn đã xong từ giây 0.
 *
 *   npx tsx scripts/style-packs/render-pack-sheets.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { ffmpeg } from "../../server/media-tools";
import { GRAPHICS_DIR, PROJECT_ROOT, resolvePackFont } from "../../server/paths";
import { OUT_HEIGHT, OUT_WIDTH } from "../../server/render";
import { alphaExpr, positionExpr, unitDelay } from "../../server/reveal-expr";
import {
  boxBorderW,
  contentRect,
  frameFilter,
  graphicsSteps,
  ffmpegColor,
  plateFilter,
  type StylePack,
  withFontRole,
} from "../../server/style-pack";
import { STYLE_PACKS } from "../../server/style-pack-catalog";
import type { AlignId, Band, EmphasisId } from "../../server/style-pack";
import { textWidth } from "../../server/text-layout";
import { placeWords } from "../../server/word-layout";

const outputDir = join(
  PROJECT_ROOT,
  "plans",
  "260731-1046-caption-style-packs",
  "reports",
  "style-packs",
);

/**
 * Mốc lấy khung.
 *
 * Bình thường lấy ở giây 3: mọi tiếng đã hiện xong nên so được dáng cuối cùng.
 * Nhưng bộ dáng có TÔ SÁNG thì ở giây 3 vệt sáng đã chạy qua hết — ảnh ra y hệt
 * bộ không tô sáng, tức là tấm ảnh nói dối. Với chúng, lấy khung ở giữa lúc vệt
 * sáng còn đang chạy.
 */
const frameAt = (pack: StylePack) => (pack.highlight ? "0.5" : "3");

/**
 * Bốn cảnh, chọn theo chỗ dễ vỡ nhất chứ không chọn cho đẹp.
 *
 * Cụm DÀI là cụm đang chạm trần bề rộng — chỗ bộ chữ hoa dễ tràn khung nhất.
 * Cụm có TỪ KHOÁ là phép thử của trục màu nhấn: nhìn không ra thì trục đó vô ích.
 */
const SCENES: Array<{
  id: string;
  text: string;
  /** Bỏ trống thì lấy BỐ CỤC MẶC ĐỊNH của chính bộ dáng đang in. */
  align?: AlignId;
  emphasis?: EmphasisId;
  band: Band;
  keywords: string[];
}> = [
  {
    // Cảnh này cố ý KHÔNG khai bố cục: nó là cảnh "người dùng sẽ nhận được gì",
    // nên phải chạy đúng `defaults` của từng bộ. Ba cảnh còn lại khai cứng để so
    // riêng phần vẽ, với bố cục giữ nguyên qua cả tám bộ.
    id: "cum-dai",
    text: "Mình đã từng nghĩ chuyện này rất khó nhưng hoá ra chỉ cần bắt đầu",
    band: "top",
    keywords: ["bắt", "đầu"],
  },
  {
    id: "tu-khoa-deu",
    text: "Ba mươi tuổi vẫn chưa có gì trong tay",
    align: "center",
    emphasis: "even",
    band: "middle",
    keywords: ["tuổi"],
  },
  {
    id: "cum-ngan",
    text: "Đừng bỏ cuộc ở đây",
    align: "center",
    emphasis: "keyword-large",
    band: "top",
    keywords: ["bỏ", "cuộc"],
  },
  {
    id: "xen-co",
    text: "Chuyện này khó hơn tôi tưởng rất nhiều",
    align: "left",
    emphasis: "mixed-size",
    band: "bottom",
    keywords: ["khó"],
  },
];

const escape = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\\\\\'")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%");

async function renderScene(pack: StylePack, scene: (typeof SCENES)[number]) {
  // Bảng bày vai PHỤ ĐỀ: đây là dáng chiếm gần hết thời lượng video.
  const shown = withFontRole(pack, "voice");
  const fontPath = resolvePackFont(shown.font.file);
  // Áp luật CHIA CỤM của bộ dáng ngay tại đây.
  //
  // Trong mạch thật, việc chia cụm xảy ra ở `buildCaptionGroups` — tức TRƯỚC
  // `placeWords` — nên bộ "Từng chữ" mà in nguyên cả câu ở đây thì tấm ảnh nói
  // dối: nó bày ra một thứ người dùng sẽ không bao giờ thấy.
  const shownText = scene.text
    .split(/\s+/)
    .slice(0, pack.grouping.maxWords)
    .join(" ");
  const rect = contentRect(pack, OUT_WIDTH, OUT_HEIGHT);
  const { words: rawPlaced } = await placeWords(
    shownText,
    scene.keywords,
    scene.align ?? pack.defaults.align,
    scene.emphasis ?? pack.defaults.emphasis,
    scene.band,
    rect.w,
    rect.h,
    shown,
  );
  const placed = rawPlaced.map((w) => ({ ...w, x: w.x + rect.x, y: w.y + rect.y }));

  const draws: string[] = [];
  const startsAt = placed.map((word) => unitDelay(pack, word.row, word.col));
  for (const [flat, word] of placed.entries()) {
    const startAt = startsAt[flat];
    const spot = positionExpr(shown, {
      x: word.x,
      y: word.y,
      width: await textWidth(word.text, word.fontSize, shown),
      fontSize: word.fontSize,
      scale: word.fontSize / OUT_WIDTH,
      startAt,
    });
    const edge = pack.edge
      ? `:borderw=${Math.max(2, Math.round(word.fontSize * pack.edge.share))}` +
        `:bordercolor=${ffmpegColor(pack.edge.tone)}`
      : "";
    const box = pack.box
      ? `:box=1:boxcolor=${ffmpegColor(pack.box.tone)}` +
        `:boxborderw=${boxBorderW(word.fontSize, pack)}`
      : "";
    const body =
      `fontfile='${fontPath}':text='${escape(word.text)}':` +
      `fontsize=${word.fontSize}:x='${spot.x}':y='${spot.y}'` +
      edge +
      box;
    draws.push(
      `drawtext=${body}:` +
        `fontcolor=${word.color}:alpha='${alphaExpr(shown, startAt, word.alpha)}'`,
    );
    // Lớp TÔ SÁNG, vẽ đè — cùng cách `render.ts` làm. Không có nó thì bộ dáng
    // bật trục tô sáng ra ảnh y hệt bộ không bật, và cả tấm ảnh nói dối.
    if (pack.highlight) {
      const until = startsAt[flat + 1] ?? startAt + 0.6;
      const litBox = pack.highlight.box
        ? `:box=1:boxcolor=${ffmpegColor(pack.highlight.box)}` +
          `:boxborderw=${boxBorderW(word.fontSize, pack)}`
        : box;
      const litBody =
        `fontfile='${fontPath}':text='${escape(word.text)}':` +
        `fontsize=${word.fontSize}:x='${spot.x}':y='${spot.y}'` +
        edge +
        litBox;
      draws.push(
        `drawtext=${litBody}:fontcolor=${pack.highlight.tone.color}:` +
          `alpha='${pack.highlight.tone.alpha}*between(t,${startAt.toFixed(3)},${until.toFixed(3)})'`,
      );
    }
  }

  // MẢNG MÀU trước lớp chữ — cùng thứ tự lớp với `render.ts`.
  // `false`: bảng dựng một khung tĩnh nên phải là trạng thái ĐÃ YÊN của
  // mảng màu, không phải nửa đường trượt vào.
  const plate = plateFilter(pack, rect, false);
  // Cùng thứ tự lớp với `render.ts`: khung → HÌNH DÁN → mảng màu.
  //
  // Hình dán tách khỏi chuỗi nối tiếp vì mỗi hình cần một luồng riêng rồi
  // `overlay` vào. Bỏ nó thì bảng bày ra một dáng không tồn tại.
  const before = frameFilter(pack, rect, OUT_WIDTH, OUT_HEIGHT);
  const gfx = graphicsSteps(pack, GRAPHICS_DIR, OUT_WIDTH, OUT_HEIGHT, null, false, []);
  const bits: string[] = [];
  let bg = "[0:v]";
  if (before) {
    bits.push(`${bg}${before}[bg0]`);
    bg = "[bg0]";
  }
  for (const [index, step] of gfx.entries()) {
    bits.push(step.chain);
    bits.push(`${bg}${step.label}overlay=0:0[bg${index + 1}]`);
    bg = `[bg${index + 1}]`;
  }
  if (plate) {
    bits.push(plate.chain);
    bits.push(`${bg}${plate.label}overlay=${plate.x}:${plate.yExpr}[bgc]`);
    bg = "[bgc]";
  }
  const prep = bits.length > 0 ? `${bits.join(";")};` : "";
  const source = bg;

  const glow = pack.glow;
  const chain = prep + (glow
    ? `[1:v]${draws.join(",")}[txt];[txt]split[g][m];` +
      `[g]colorchannelmixer=rr=0:rg=0:rb=0:gr=0:gg=0:gb=0:br=0:bg=0:bb=0:aa=${glow.opacity},` +
      `scale=${OUT_WIDTH / 2}:${OUT_HEIGHT / 2},` +
      `boxblur=luma_radius=${glow.radiusPx / 2}:alpha_radius=${glow.radiusPx / 2},` +
      `scale=${OUT_WIDTH}:${OUT_HEIGHT}[glow];` +
      `${source}[glow]overlay=format=rgb[bg];[bg][m]overlay=format=rgb[out]`
    : `[1:v]${draws.join(",")}[txt];${source}[txt]overlay=format=rgb[out]`);

  const target = join(outputDir, `${pack.id}-${scene.id}.png`);
  await ffmpeg([
    "-f",
    "lavfi",
    "-i",
    `color=c=#3A3F45:s=${OUT_WIDTH}x${OUT_HEIGHT}:d=4:r=30`,
    "-f",
    "lavfi",
    "-i",
    `color=c=black@0.0:s=${OUT_WIDTH}x${OUT_HEIGHT}:d=4:r=30,format=rgba`,
    "-filter_complex",
    chain,
    "-map",
    "[out]",
    "-ss",
    frameAt(pack),
    "-frames:v",
    "1",
    "-y",
    target,
  ]);
  return placed.length;
}

mkdirSync(outputDir, { recursive: true });
for (const pack of STYLE_PACKS) {
  for (const scene of SCENES) {
    const count = await renderScene(pack, scene);
    console.log(`✓ ${pack.id}-${scene.id}.png — ${count} tiếng`);
  }
}
