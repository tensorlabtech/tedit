/**
 * In khung hình THẬT của một dự án thật, qua từng phong cách.
 *
 * Khác `render-pack-sheets.ts` ở chỗ quan trọng nhất: nền là **video thật của
 * người dùng**, chữ là **lời thật**, mốc là **mốc nói thật**. Ảnh trên nền xám
 * chỉ so được font với màu; chữ đè lên mặt người trong phòng thiếu sáng mới trả
 * lời được câu "cái này có dùng được không".
 *
 * CHỈ ĐỌC dự án. Ghi ra thư mục truyền vào, không đụng `out/final.mp4` —
 * đó là bản xuất của người dùng.
 *
 *   npx tsx scripts/style-packs/render-real-frames.ts <projectId> <thư mục ra>
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { db } from "../../server/db";
import { layoutHeadline } from "../../server/headline";
import { ffmpeg } from "../../server/media-tools";
import { wrapMeta } from "../../server/graphics-manifest";
import { GRAPHICS_DIR, resolvePackFont, workDir } from "../../server/paths";
import { OUT_HEIGHT, OUT_WIDTH } from "../../server/render";
import { alphaExpr, positionExpr } from "../../server/reveal-expr";
import {
  boxBorderW,
  contentRect,
  frameFilter,
  graphicsSteps,
  wrapBox,
  wrapSteps,
  ffmpegColor,
  gradeFilter,
  plateFilter,
  type StylePack,
  packForElement,
  withFontRole,
} from "../../server/style-pack";
import { STYLE_PACKS } from "../../server/style-pack-catalog";
import type { AlignId, Band, EmphasisId } from "../../server/style-pack";
import { textWidth } from "../../server/text-layout";
import { placeWords } from "../../server/word-layout";

const [projectId, outputDir, headlineArg] = process.argv.slice(2);
if (!projectId || !outputDir) {
  console.error("Cần: <projectId> <thư mục ra> [dòng tiêu đề]");
  process.exit(1);
}
/**
 * Dòng tiêu đề dùng cho cả bảng.
 *
 * Nhận qua dòng lệnh chứ không đọc `projects.headline`: bảng này để SO MƯỜI BỘ,
 * nên mọi ô phải mang đúng một chuỗi chữ. Đọc từ dự án thì bảng đo được "bộ nào
 * hợp với tiêu đề này", chứ không đo được "mười bộ khác nhau ở đâu".
 */
const headlineText = headlineArg ?? "Ba năm mới hiểu";

type Row = {
  content: string;
  position_band: string | null;
  align: string | null;
  emphasis: string | null;
  keywords: string | null;
  from_start: number;
  to_end: number;
};

/**
 * Ba cụm chữ, chọn theo chỗ khó nhất chứ không chọn cụm đẹp nhất: cụm DÀI nhất
 * (chạm trần bề rộng), cụm NGẮN nhất (chạm trần cỡ chữ), và một cụm giữa.
 */
const rows = db
  .prepare(
    `SELECT e.content, e.position_band, e.align, e.emphasis, e.keywords,
            wf.start_sec AS from_start, wt.end_sec AS to_end
     FROM elements e
     JOIN words wf ON wf.id = e.from_word_id
     JOIN words wt ON wt.id = e.to_word_id
     WHERE e.project_id = ? AND e.kind = 'text' AND e.content <> ''
     ORDER BY wf.start_sec`,
  )
  .all(projectId) as Row[];

if (rows.length === 0) {
  console.error("Dự án này chưa có cụm chữ nào");
  process.exit(1);
}

const byLength = [...rows].sort(
  (a, b) => a.content.length - b.content.length,
);
const picks = [
  { id: "cum-dai", row: byLength[byLength.length - 1] },
  { id: "cum-ngan", row: byLength[0] },
  { id: "cum-giua", row: byLength[Math.floor(byLength.length / 2)] },
];

/*
 * Ô thứ TƯ: một cụm CÓ TỪ KHOÁ.
 *
 * Cụm có từ khoá vẽ bằng vai chữ thứ hai. Bảng chỉ có ba ô không từ khoá thì
 * nửa dáng của mọi bộ dùng cặp font không bao giờ hiện ra — và người nhìn bảng
 * kết luận "hai bộ này giống nhau" trên đúng cái nửa mà chúng khác nhau.
 */
const withKeyword = rows.find((row) => row.keywords && row.keywords.trim());
if (withKeyword) picks.push({ id: "cum-tu-khoa", row: withKeyword });
else console.warn("! Dự án này không có cụm nào đánh dấu từ khoá — thiếu ô vai cảm xúc");

const escape = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\\\\\'")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%");

/** Mốc từng tiếng trong cụm, lấy từ bảng `words` — nhịp nói THẬT. */
function beatsOf(row: Row): number[] {
  const words = db
    .prepare(
      "SELECT start_sec FROM words WHERE project_id=? AND start_sec>=? AND start_sec<=? ORDER BY start_sec",
    )
    .all(projectId, row.from_start - 0.01, row.to_end + 0.01) as Array<{
    start_sec: number;
  }>;
  return words.map((word) => word.start_sec);
}

async function render(pack: StylePack, pick: (typeof picks)[number]) {
  const row = pick.row;
  const keywords = row.keywords ? row.keywords.split("|") : [];
  /*
   * VAI CHỮ theo đúng luật của đường in, không chốt cứng vai phụ đề.
   *
   * Bản trước ghi thẳng `withFontRole(pack, "voice")`, nên bảng so vẽ cụm CÓ TỪ
   * KHOÁ bằng font phụ đề trong khi video xuất ra vẽ bằng font cảm xúc. Một
   * bảng so nói sai về thứ nó đang so thì tệ hơn không có bảng nào.
   */
  const shown = packForElement(pack, null, keywords);
  const fontPath = resolvePackFont(shown.font.file);

  // Áp luật CHIA CỤM của phong cách, đúng như `buildCaptionGroups` làm trước bộ
  // vẽ — không có bước này thì bộ "Gõ" in nguyên cả cụm.
  const shownText = row.content
    .split(/\s+/)
    .slice(0, pack.grouping.maxWords)
    .join(" ");

  // Bố cục lấy từ PHONG CÁCH, không lấy từ cụm đang lưu.
  //
  // Cụm trong dự án này sinh ra từ hồi mọi phong cách còn chung một bố cục, nên
  // đọc nó là in ra mười ảnh cùng bố cục — đúng thứ đang cần so thì lại không so
  // được. Câu hỏi ở đây là "dự án MỚI chọn phong cách này thì ra gì".
  const rect = contentRect(pack, OUT_WIDTH, OUT_HEIGHT);
  const { words: rawPlaced } = await placeWords(
    shownText,
    keywords,
    pack.defaults.align as AlignId,
    pack.defaults.emphasis as EmphasisId,
    (row.position_band ?? "bottom") as Band,
    rect.w,
    rect.h,
    shown,
  );
  // Dời sang hệ toạ độ khung, y như `render.ts` — bảng so phải dựng bằng cùng
  // phép tính với bản xuất, không thì nó so nhầm thứ.
  const placed = rawPlaced.map((w) => ({ ...w, x: w.x + rect.x, y: w.y + rect.y }));

  const beats = beatsOf(row);
  const startsAt = placed.map(
    (_, index) =>
      beats[index] ??
      row.from_start +
        ((row.to_end - row.from_start) * index) / Math.max(1, placed.length),
  );
  /*
   * Lấy khung lúc MỌI TIẾNG đã hiện xong — sát mép cuối cụm.
   *
   * Bản đầu lấy `min(cuối, đầu + 1,2s)`, tức là giữa lúc chữ còn đang chạy vào:
   * mấy tiếng cuối mờ một nửa và ảnh đọc ra như chữ bị lỗi. Đó là lỗi của phép
   * đo, không phải của sản phẩm — và nó suýt làm tôi báo nhầm.
   *
   * Phong cách có tô sáng thì phải lùi về giữa cụm, vì ở mép cuối vệt sáng đã
   * chạy qua hết.
   */
  const frameAt = pack.highlight
    ? (row.from_start + row.to_end) / 2
    : Math.max(row.from_start + 0.05, row.to_end - 0.08);

  /*
   * Dời MỐC của mọi biểu thức về gốc khung đang lấy.
   *
   * `-ss` tua tệp nguồn, nên khung ra nằm ở `t = 0` của luồng ra — trong khi mốc
   * nói thật là 68 giây. Không dời thì mọi `alpha` tính ở `t=0` đều ra 0 và ảnh
   * ra không có chữ nào (đã đo đúng thế). Tiếng đã nói xong có mốc ÂM, và đó là
   * điều đúng: `clip(...,0,1)` kẹp lại thành "đã hiện xong".
   */
  const rebase = (at: number) => at - frameAt;

  /*
   * HÌNH BÁM CHỮ — cùng phép cắt ba lát với `render.ts`.
   *
   * Bảng so thiếu một bước vẽ là nó bày ra một dáng không tồn tại. Lỗi này đã
   * mắc bốn lần trong hai đợt, mỗi lần một trục khác — nên nó vào đây ngay cùng
   * lúc với trục, không để lần sau.
   */
  const wrapBits: string[] = [];
  const wrapOverlays: Array<{ label: string; x: number; y: number }> = [];
  if (pack.wrap && (pack.wrap.scope === "all" || keywords.length > 0) && placed.length > 0) {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const word of placed) {
      const ink = await textWidth(word.text, word.fontSize, shown);
      left = Math.min(left, word.x);
      right = Math.max(right, word.x + ink);
      top = Math.min(top, word.y);
      bottom = Math.max(bottom, word.y + word.fontSize);
    }
    const meta = wrapMeta(pack.wrap.id);
    const wbox = wrapBox(
      meta.fit,
      { left, right, top, bottom },
      Math.max(...placed.map((w) => w.fontSize)),
      pack.wrap.padShare,
      rect,
    );
    const step = wrapSteps(pack, meta, GRAPHICS_DIR, wbox, null, 0, null);
    if (step) {
      wrapBits.push(step.chain);
      wrapOverlays.push(...step.overlays);
    }
  }

  const draws: string[] = [];
  for (const [flat, word] of placed.entries()) {
    const startAt = rebase(startsAt[flat]);
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
      `fontsize=${word.fontSize}:x='${spot.x}':y='${spot.y}'`;
    draws.push(
      `drawtext=${body}${edge}${box}:fontcolor=${word.color}:` +
        `alpha='${alphaExpr(shown, startAt, word.alpha)}'`,
    );
    if (pack.highlight) {
      const until = rebase(startsAt[flat + 1] ?? row.to_end);
      const litBox = pack.highlight.box
        ? `:box=1:boxcolor=${ffmpegColor(pack.highlight.box)}` +
          `:boxborderw=${boxBorderW(word.fontSize, pack)}`
        : box;
      draws.push(
        `drawtext=${body}${edge}${litBox}:fontcolor=${pack.highlight.tone.color}:` +
          `alpha='${pack.highlight.tone.alpha}*between(t,${startAt.toFixed(3)},${until.toFixed(3)})'`,
      );
    }
  }

  // Nắn màu đứng ĐẦU, y hệt `render.ts`: khung ra phải là khung người dùng
  // thấy, mà nắn màu là thứ đầu tiên chạm vào hình.
  // Nắn màu rồi tới MẢNG MÀU, trước lớp chữ — cùng thứ tự với `render.ts`.
  const grade = gradeFilter(pack.grade);
  // `false`: khung tĩnh nên lấy trạng thái ĐÃ YÊN — xem `render-pack-sheets.ts`.
  const plate = plateFilter(pack, rect, false);
  /*
   * DÒNG TIÊU ĐỀ nằm trong chuỗi nền, sau mảng màu và trước lớp chữ — cùng thứ
   * tự lớp với `render.ts`. Thiếu nó thì bảng so bày ra một nửa chữ ký của ba bộ
   * mới, và ai nhìn bảng cũng kết luận trên dữ liệu thiếu.
   */
  let headlineStep: string | null = null;
  if (pack.title) {
    const titlePack = withFontRole(pack, pack.title.font);
    const drawn = await layoutHeadline(headlineText, titlePack, OUT_WIDTH, OUT_HEIGHT);
    if (drawn) {
      headlineStep =
        `drawtext=fontfile='${resolvePackFont(titlePack.font.file)}':` +
        `text='${drawn.text.replace(/'/g, "\\\\\\'").replace(/:/g, "\\:")}':` +
        `fontsize=${drawn.fontSize}:x=${drawn.x}:y=${drawn.y}:` +
        `fontcolor=${drawn.tone.color}:alpha=${drawn.tone.alpha}`;
    }
  }
  // Khung đứng NGAY SAU nắn màu và trước mọi thứ bộ dáng vẽ — cùng thứ tự
  // lớp với `render.ts`.
  /*
   * Chuỗi nền dựng theo ĐÚNG thứ tự lớp của `render.ts`:
   *   nắn màu → khung → HÌNH DÁN → mảng màu → tiêu đề → (chữ ở lớp riêng)
   *
   * Hình dán tách ra khỏi `steps` vì nó không phải một bộ lọc nối tiếp: mỗi hình
   * cần một luồng riêng rồi `overlay` vào. Bảng so mà bỏ nó thì nó bày ra một
   * dáng KHÔNG tồn tại — lỗi đã mắc ba lần trong hai đợt, mỗi lần một trục khác.
   */
  const before = [grade, frameFilter(pack, rect, OUT_WIDTH, OUT_HEIGHT)]
    .filter(Boolean)
    .join(",");
  const after = [headlineStep].filter(Boolean).join(",");
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
  // MẢNG MÀU tách khỏi chuỗi nối tiếp vì nó cũng là một lớp phủ rồi — cùng
  // `render.ts`. Trước tiêu đề, đúng thứ tự lớp bên ấy.
  if (plate) {
    bits.push(plate.chain);
    bits.push(`${bg}${plate.label}overlay=${plate.x}:${plate.yExpr}[bgp]`);
    bg = "[bgp]";
  }
  if (after) {
    bits.push(`${bg}${after}[bgc]`);
    bg = "[bgc]";
  }
  // Hình bám chữ vẽ SAU mảng màu và tiêu đề, TRƯỚC lớp chữ — cùng `render.ts`.
  bits.push(...wrapBits);
  for (const [index, piece] of wrapOverlays.entries()) {
    bits.push(`${bg}${piece.label}overlay=${piece.x}:${piece.y}[bgw${index}]`);
    bg = `[bgw${index}]`;
  }
  const prep = bits.length > 0 ? `${bits.join(";")};` : "";
  const source = bg;

  const glow = pack.glow;
  const chain = prep +
    (glow
    ? `[1:v]${draws.join(",")}[txt];[txt]split[g][m];` +
      `[g]colorchannelmixer=rr=0:rg=0:rb=0:gr=0:gg=0:gb=0:br=0:bg=0:bb=0:aa=${glow.opacity},` +
      `scale=${OUT_WIDTH / 2}:${OUT_HEIGHT / 2},` +
      `boxblur=luma_radius=${glow.radiusPx / 2}:alpha_radius=${glow.radiusPx / 2},` +
      `scale=${OUT_WIDTH}:${OUT_HEIGHT}[glow];` +
      `${source}[glow]overlay=format=rgb[bg];[bg][m]overlay=format=rgb[out]`
    : `[1:v]${draws.join(",")}[txt];${source}[txt]overlay=format=rgb[out]`);

  const base = join(workDir(projectId), "base.mp4");
  const target = join(outputDir, `${pack.id}-${pick.id}.png`);
  await ffmpeg([
    "-ss",
    frameAt.toFixed(3),
    "-i",
    base,
    "-f",
    "lavfi",
    "-i",
    `color=c=black@0.0:s=${OUT_WIDTH}x${OUT_HEIGHT}:d=4:r=30,format=rgba`,
    "-filter_complex",
    chain,
    "-map",
    "[out]",
    "-frames:v",
    "1",
    "-y",
    target,
  ]);
  return { words: placed.length, at: frameAt, text: shownText };
}

mkdirSync(outputDir, { recursive: true });
for (const pack of STYLE_PACKS) {
  for (const pick of picks) {
    const info = await render(pack, pick);
    console.log(
      `✓ ${pack.id}-${pick.id}.png — "${info.text}" @ ${info.at.toFixed(1)}s`,
    );
  }
}
