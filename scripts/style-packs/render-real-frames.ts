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
import { ffmpeg } from "../../server/media-tools";
import { resolvePackFont, workDir } from "../../server/paths";
import { OUT_HEIGHT, OUT_WIDTH } from "../../server/render";
import { alphaExpr, positionExpr } from "../../server/reveal-expr";
import {
  boxBorderW,
  ffmpegColor,
  gradeFilter,
  type StylePack,
} from "../../server/style-pack";
import { STYLE_PACKS } from "../../server/style-pack-catalog";
import type { AlignId, Band, EmphasisId } from "../../server/style-pack";
import { textWidth } from "../../server/text-layout";
import { placeWords } from "../../server/word-layout";

const [projectId, outputDir] = process.argv.slice(2);
if (!projectId || !outputDir) {
  console.error("Cần: <projectId> <thư mục ra>");
  process.exit(1);
}

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
  const fontPath = resolvePackFont(pack.font.file);
  const keywords = row.keywords ? row.keywords.split("|") : [];

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
  const { words: placed } = await placeWords(
    shownText,
    keywords,
    pack.defaults.align as AlignId,
    pack.defaults.emphasis as EmphasisId,
    (row.position_band ?? "bottom") as Band,
    OUT_WIDTH,
    OUT_HEIGHT,
    pack,
  );

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

  const draws: string[] = [];
  for (const [flat, word] of placed.entries()) {
    const startAt = rebase(startsAt[flat]);
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
    const box = pack.box
      ? `:box=1:boxcolor=${ffmpegColor(pack.box.tone)}` +
        `:boxborderw=${boxBorderW(word.fontSize, pack)}`
      : "";
    const body =
      `fontfile='${fontPath}':text='${escape(word.text)}':` +
      `fontsize=${word.fontSize}:x='${spot.x}':y='${spot.y}'`;
    draws.push(
      `drawtext=${body}${edge}${box}:fontcolor=${word.color}:` +
        `alpha='${alphaExpr(pack, startAt, word.alpha)}'`,
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
  const grade = gradeFilter(pack.grade);
  const plate = grade ? `[0:v]${grade}[bgc];` : "";
  const source = grade ? "[bgc]" : "[0:v]";

  const glow = pack.glow;
  const chain = plate +
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
