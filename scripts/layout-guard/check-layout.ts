/**
 * BỘ KIỂM BỐ CỤC — quét nhiều tổ hợp, khẳng định khối chữ không bao giờ tràn.
 *
 *   npm run check:layout
 *   npx tsx scripts/layout-guard/check-layout.ts --update   # ghi lại đường cơ sở
 *
 * ## Vì sao tệp này tồn tại
 *
 * `style-pack.ts` nhắc tới "bộ kiểm 1920 tổ hợp" như một thứ đang có. Nó KHÔNG
 * có trong repo này — `docs/editor-interaction-spec.md:541` ghi rõ nó thuộc dự
 * án trước. Nên bảo đảm lớn nhất của sản phẩm ("chữ không bao giờ tràn khung")
 * đang được canh bằng trí nhớ.
 *
 * ## Hai loại kết quả, và chúng khác hẳn nhau
 *
 * - **Bất biến cứng** — chữ ra ngoài dải an toàn, hoặc quá trần dòng. Trượt là
 *   sản phẩm hỏng, không bàn.
 * - **Đường cơ sở** — số dòng, cỡ chữ, chỗ đứng của từng tổ hợp. Lệch không có
 *   nghĩa là sai; nó có nghĩa là *"bố cục vừa đổi, bạn có định thế không"*. Đây
 *   là thứ giữ cho bảy bộ ngoài phạm vi không trôi khi ai đó sửa một bộ khác.
 *
 * Cỡ chữ KHÔNG bị chặn sàn ở đây, và đó là cố ý. `word-layout.ts` ghi rõ *"bề
 * rộng thắng sàn cỡ chữ"*: hàng đã chốt số dòng thì sàn và bề rộng không thể
 * cùng thoả, mà giữa "chữ nhỏ hơn ngưỡng đọc" và "chữ ra ngoài khung" thì bảo
 * đảm không-bao-giờ-tràn là thứ không được hy sinh. Nên cỡ nhỏ nhất được GHI
 * LẠI vào đường cơ sở để nhìn thấy, không dựng thành phép chặn.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { OUT_HEIGHT, OUT_WIDTH } from "../../server/render";
import { boxPadShare, contentRect, shownPacks } from "../../server/style-pack";
import type { AlignId, Band, EmphasisId } from "../../server/style-pack";
import { STYLE_PACKS } from "../../server/style-pack-catalog";
import { MAX_LINES, SAFE, textWidth, usableWidthOf } from "../../server/text-layout";
import { placeWords } from "../../server/word-layout";

const BASELINE = join(import.meta.dirname, "baseline.json");
const updating = process.argv.includes("--update");

/**
 * Sáu câu, chọn theo CHỖ DỄ HỎNG chứ không chọn ngẫu nhiên.
 *
 * Ngẫu nhiên thì mỗi lượt chạy kiểm một tập khác, và một lượt xanh không nói
 * được gì về lượt sau. Cố định thì đường cơ sở so được.
 */
const TEXTS = [
  // Chạm trần CỠ CHỮ: ngắn tới mức không gì cản nó phình ra.
  "Đủ",
  "Bắt đầu đi",
  // Chạm trần BỀ RỘNG: một hàng vừa đúng gần hết chỗ.
  "Mình đã từng nghĩ chuyện này rất khó",
  // Chạm trần DÒNG.
  "Nghĩ kỹ trước khi quyết định điều gì đó thật sự quan trọng với chính mình",
  // Chữ HOA có dấu chồng dấu — chỗ hai đường đo xa nhau nhất, và chỗ bước dòng
  // dưới 1 sẽ cắt cụt dấu.
  "ĐỪNG BỎ CUỘC Ở ĐÂY DÙ CHUYỆN NÀY KHÓ",
  // Một tiếng RẤT dài: ca duy nhất mà bẻ dòng không cứu được, chỉ còn hạ cỡ.
  "Nghiêng nghiêng nghiêng nghiêng nghiêng",
];

const BANDS: Band[] = ["top", "middle", "bottom"];
const ALIGNS: AlignId[] = ["left", "center", "right", "stair", "stagger"];
const EMPHASES: EmphasisId[] = ["even", "keyword-large", "mixed-size", "taper"];

/**
 * Hai mươi tổ hợp mỗi bộ dáng — đủ dày để bắt hồi quy, đủ mỏng để ai cũng chạy.
 *
 * Bốn trục bước theo bốn chu kỳ khác nhau (6 · 3 · 5 · 4) nên trong hai mươi
 * bước, mỗi giá trị của từng trục đều xuất hiện, và **cả hai mươi cặp
 * căn × nhấn xuất hiện đúng một lần**. Lấy tích đầy đủ là 360 tổ hợp mỗi bộ,
 * tức 3600 lượt gọi ImageMagick — không ai chạy nữa, mà một phép kiểm không ai
 * chạy thì bằng không có.
 */
const CASES = Array.from({ length: 20 }, (_, i) => ({
  text: TEXTS[i % TEXTS.length],
  band: BANDS[i % BANDS.length],
  align: ALIGNS[i % ALIGNS.length],
  emphasis: EMPHASES[i % EMPHASES.length],
  // Cụm có từ khoá đi VAI CHỮ THỨ HAI. Cứ ba tổ hợp một cái, để cả hai vai đều
  // bị soi ở nhiều dải và nhiều kiểu căn.
  keywords: i % 3 === 0 ? [] : ["nghĩ", "khó", "quyết", "ĐỪNG"],
}));

type Row = {
  pack: string;
  /** Tệp font đang vẽ — hai vai của cùng một bộ ra hai hàng khác nhau. */
  font: string;
  case: number;
  rows: number;
  /** Cỡ nhỏ nhất trong khối, theo bề rộng khung. */
  minScale: number;
  top: number;
  bottom: number;
  /** Mép phải xa nhất mà một tiếng chạm tới, theo bề rộng khung. */
  maxRight: number;
  /**
   * Chỗ đứng DỌC của từng tiếng, gói thành hai số.
   *
   * Hộp bao không đủ: nó là hộp DÒNG, tính từ số hàng và cỡ chữ, nên một thay
   * đổi dịch riêng từng tiếng theo chiều dọc — như phép bù chân chữ — đi qua nó
   * mà không để lại dấu vết nào. Đường cơ sở phải nhìn thấy được điều đó, không
   * thì lời hứa "kết quả y hệt" chỉ đúng với thứ nó tình cờ ghi lại.
   */
  wordTop: number;
  wordBottom: number;
};

let failed = 0;
function fail(label: string, detail: string) {
  failed += 1;
  console.log(`  TRƯỢT ${label} — ${detail}`);
}

const round = (value: number) => Math.round(value * 10000) / 10000;
const rows: Row[] = [];

for (const pack of STYLE_PACKS) {
  for (const shown of shownPacks(pack)) {
    for (const [index, item] of CASES.entries()) {
      /*
       * Đo theo VÙNG HÌNH, không theo khung.
       *
       * Bộ dáng đưa video vào khung thì chữ sống trong vùng hình nhỏ hơn. Vẫn đo
       * theo khung 1080×1920 thì chữ nằm ngoài vùng hình mà mọi phép kiểm vẫn
       * xanh — `SAFE` cũ vẫn thoả. Đó là loại hỏng tệ nhất: sai mà không ai báo.
       *
       * Bộ không khai `frame` thì `contentRect` trả về đúng cả khung, nên bảy bộ
       * đối chứng không lệch một hàng.
       */
      const rect = contentRect(pack, OUT_WIDTH, OUT_HEIGHT);
      const { words, box } = await placeWords(
        item.text,
        item.keywords,
        item.align,
        item.emphasis,
        item.band,
        rect.w,
        rect.h,
        shown,
      );
      if (words.length === 0) continue;
      const where = `"${pack.label}" · ${shown.font.file.split("/").pop()} · ca ${index}`;

      // ---- Bất biến cứng 1: khối chữ nằm trong dải an toàn theo CHIỀU DỌC ----
      // Sai một pixel không đáng báo động; sai hẳn ra ngoài mới là hỏng. Nới 1px
      // vì mọi toạ độ đều đã làm tròn.
      if (box.top < SAFE.top * rect.h - 1) {
        fail(where, `mép trên khối ${box.top} vượt lên trên dải an toàn`);
      }
      if (box.bottom > (1 - SAFE.bottom) * rect.h + 1) {
        fail(where, `mép dưới khối ${box.bottom} tụt xuống dưới dải an toàn`);
      }

      // ---- Bất biến cứng 2: KHÔNG tiếng nào chạm ra ngoài mép ngang ----
      // Đo trên từng tiếng chứ không đo hộp bao: hộp bao là vùng DÙNG ĐƯỢC của
      // dải, nó đúng theo định nghĩa nên không nói được gì. Thứ tràn ra ngoài
      // là nét mực của một tiếng cụ thể — cộng cả nền khối, vì nền chìa ra
      // ngoài nét chữ.
      const left = SAFE.left * rect.w;
      const right = left + usableWidthOf(item.band, rect.w);
      let maxRight = 0;
      let minScale = 1;
      for (const word of words) {
        const pad = word.fontSize * boxPadShare(shown);
        const ink = await textWidth(word.text, word.fontSize, shown);
        const wordLeft = word.x - pad;
        const wordRight = word.x + ink + pad;
        maxRight = Math.max(maxRight, wordRight);
        minScale = Math.min(minScale, word.fontSize / rect.w);
        if (wordLeft < left - 1) {
          fail(where, `"${word.text}" bắt đầu ở ${Math.round(wordLeft)}, lấn mép trái ${Math.round(left)}`);
        }
        if (wordRight > right + 1) {
          fail(where, `"${word.text}" kết thúc ở ${Math.round(wordRight)}, vượt mép phải ${Math.round(right)}`);
        }
      }

      // ---- Bất biến cứng 3: không quá trần dòng ----
      const rowCount = new Set(words.map((word) => word.row)).size;
      if (rowCount > MAX_LINES) {
        fail(where, `${rowCount} hàng, quá trần ${MAX_LINES}`);
      }

      rows.push({
        pack: pack.id,
        font: shown.font.file,
        case: index,
        rows: rowCount,
        minScale: round(minScale),
        top: round(box.top / rect.h),
        bottom: round(box.bottom / rect.h),
        maxRight: round(maxRight / rect.w),
        wordTop: round(Math.min(...words.map((w) => w.y)) / rect.h),
        wordBottom: round(
          Math.max(...words.map((w) => w.y + w.fontSize)) / rect.h,
        ),
      });
    }
  }
}

console.log(`\n${rows.length} tổ hợp, ${failed} trượt bất biến cứng`);
const floor = Math.min(...rows.map((row) => row.minScale));
console.log(`Cỡ chữ nhỏ nhất gặp phải: ${floor} bề rộng khung (chỉ để nhìn, không phải phép chặn)`);

// ---- Đường cơ sở ----
if (updating) {
  writeFileSync(BASELINE, `${JSON.stringify(rows, null, 1)}\n`);
  console.log(`Đã ghi lại đường cơ sở: ${rows.length} hàng`);
  process.exit(failed === 0 ? 0 : 1);
}

if (!existsSync(BASELINE)) {
  console.log(
    "Chưa có đường cơ sở. Chạy `npx tsx scripts/layout-guard/check-layout.ts --update`.",
  );
  process.exit(1);
}

const before: Row[] = JSON.parse(readFileSync(BASELINE, "utf8"));
const keyOf = (row: Row) => `${row.pack}|${row.font}|${row.case}`;
const beforeByKey = new Map(before.map((row) => [keyOf(row), row]));
let drifted = 0;
for (const row of rows) {
  const old = beforeByKey.get(keyOf(row));
  if (!old) {
    drifted += 1;
    console.log(`  MỚI   ${keyOf(row)}`);
    continue;
  }
  beforeByKey.delete(keyOf(row));
  const fields = [
    "rows", "minScale", "top", "bottom", "maxRight", "wordTop", "wordBottom",
  ] as const;
  const diff = fields.filter((field) => old[field] !== row[field]);
  if (diff.length > 0) {
    drifted += 1;
    console.log(
      `  LỆCH  ${keyOf(row)} — ${diff
        .map((field) => `${field}: ${old[field]} → ${row[field]}`)
        .join(" · ")}`,
    );
  }
}
for (const key of beforeByKey.keys()) {
  drifted += 1;
  console.log(`  MẤT   ${key}`);
}

if (drifted > 0) {
  console.log(
    `\n${drifted} tổ hợp lệch khỏi đường cơ sở.\n` +
      "Lệch không tự nó là sai — nhưng nó phải là thứ bạn CHỦ Ý đổi. Xem lại danh\n" +
      "sách trên; đúng ý thì chạy lại với `--update` và commit tệp baseline.json\n" +
      "cùng lượt sửa, để lượt sau lại có mốc so.",
  );
}
process.exit(failed === 0 && drifted === 0 ? 0 : 1);
