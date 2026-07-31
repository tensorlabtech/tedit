/** In toạ độ emoji mà ĐƯỜNG VẼ MÁY CHỦ tính ra, theo tỉ lệ khung. */
import { db } from "../../server/db";
import { clampEmojiTop, emojiSpot } from "../../server/emoji-layout";
import { OUT_HEIGHT, OUT_WIDTH } from "../../server/render";
import { findStylePack } from "../../server/style-pack-catalog";
import type { AlignId, Band, EmphasisId } from "../../server/style-pack";
import { SAFE } from "../../server/text-layout";
import { placeWords } from "../../server/word-layout";

const row = db
  .prepare("SELECT * FROM elements WHERE emoji IS NOT NULL AND emoji<>'' LIMIT 1")
  .get() as Record<string, string | null>;
const pack = findStylePack(
  (db.prepare("SELECT style_pack FROM projects").get() as { style_pack: string })
    .style_pack,
);
const band = (row.position_band ?? "top") as Band;
const align = (row.align ?? pack.defaults.align) as AlignId;
const { words, box } = await placeWords(
  row.content!,
  row.keywords ? row.keywords.split("|") : [],
  align,
  (row.emphasis ?? pack.defaults.emphasis) as EmphasisId,
  band,
  OUT_WIDTH,
  OUT_HEIGHT,
  pack,
);
const spot = emojiSpot(band, Math.max(...words.map((w) => w.fontSize)), pack)!;
const size = Math.round(spot.size);
const x =
  align === "center"
    ? Math.round(box.left + (box.width - spot.size) / 2)
    : align === "right"
      ? Math.round(box.left + box.width - spot.size)
      : box.left;
const y = clampEmojiTop(
  Math.round(
    spot.side === "above" ? box.top - spot.gap - spot.size : box.bottom + spot.gap,
  ),
  size,
  OUT_HEIGHT,
  SAFE,
);
console.log(
  JSON.stringify({
    x: x / OUT_WIDTH,
    y: y / OUT_HEIGHT,
    size: size / OUT_WIDTH,
    align,
    band,
    pack: pack.id,
  }),
);
