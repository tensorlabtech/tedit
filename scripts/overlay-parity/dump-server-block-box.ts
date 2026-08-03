/**
 * In HỘP BAO khối chữ mà đường vẽ máy chủ tính ra, theo tỉ lệ khung.
 *
 * Nửa dưới của phép so chỗ đứng; nửa trên là `block-box-page.html`.
 *
 *   npx tsx scripts/overlay-parity/dump-server-block-box.ts
 */
import { OUT_HEIGHT, OUT_WIDTH } from "../../server/render";
import { packForElement } from "../../server/style-pack";
import { STYLE_PACKS } from "../../server/style-pack-catalog";
import { placeWords } from "../../server/word-layout";
import { CASES } from "./parity-cases";

const rows = [];
for (const pack of STYLE_PACKS) {
  for (const [index, item] of CASES.entries()) {
    const shown = packForElement(pack, null, item.keywords);
    const { box } = await placeWords(
      item.text,
      item.keywords ?? [],
      pack.defaults.align,
      pack.defaults.emphasis,
      item.band,
      OUT_WIDTH,
      OUT_HEIGHT,
      shown,
    );
    rows.push({
      pack: pack.id,
      caseIndex: index,
      top: box.top / OUT_HEIGHT,
      bottom: box.bottom / OUT_HEIGHT,
    });
  }
}
console.log(JSON.stringify(rows));
