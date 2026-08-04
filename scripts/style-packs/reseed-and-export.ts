/**
 * Đổi bộ dáng cho một dự án rồi GIEO LẠI mọi thứ bộ dáng quyết định, và xuất.
 *
 *   npx tsx scripts/style-packs/reseed-and-export.ts <projectId> <packId> <tệp ra>
 *
 * KHÔNG chép lại lời — chặng ấy tốn phút và cho kết quả khác nhau mỗi lượt, mà
 * lời thì không phụ thuộc bộ dáng. Chỉ gieo lại đúng những thứ có phụ thuộc:
 *
 * · **Cụm chữ** — `grouping` của bộ dáng quyết định mấy tiếng một cụm, và
 *   `defaults` (căn lề, kiểu nhấn) được ghi THẲNG vào bảng `elements` lúc gieo.
 *   Giữ cụm cũ mà đổi bộ là xuất ra một bản mang bố cục của bộ trước.
 * · **Dải phụ đề** — bộ có mảng màu chiếm dải nào thì phụ đề tránh dải đó.
 * · **Từ nhấn** — `keywordShare` của mỗi bộ khác nhau.
 * · **Chỗ nối** — `rhythm.junctionShare` khác nhau.
 *
 * Đây là script SO SÁNH, không phải một đường trong sản phẩm: nó ghi thẳng vào
 * dự án. Chạy xong thì dự án mang bộ dáng vừa truyền vào.
 */
import { copyFile } from "node:fs/promises";

import { pickEffects } from "../../server/ai-effects";
import { pickKeywords } from "../../server/ai-keywords";
import { pickCaptionBand } from "../../server/caption-band";
import { createCaptionElements } from "../../server/caption-elements";
import { db } from "../../server/db";
import { probe } from "../../server/media-tools";
import { workDir } from "../../server/paths";
import { keptRanges, runExport } from "../../server/pipeline";
import { OUT_HEIGHT, OUT_WIDTH } from "../../server/render";
import { cacheSpend, modelSpend } from "../../server/llm";
import { findStylePack } from "../../server/style-pack-catalog";
import { join } from "node:path";

const [projectId, packId, outPath] = process.argv.slice(2);
if (!projectId || !packId || !outPath) {
  console.error("Cần: <projectId> <packId> <tệp ra>");
  process.exit(1);
}

const pack = findStylePack(packId);
if (pack.id !== packId) {
  console.error(`Không có bộ dáng "${packId}"`);
  process.exit(1);
}

db.prepare("UPDATE projects SET style_pack=? WHERE id=?").run(pack.id, projectId);
console.log(`bộ dáng → ${pack.label}`);

// Xoá cụm chữ cũ. Chỉ loại `text`: tư liệu chèn do người dùng đặt, không phải
// thứ bộ dáng sinh ra.
db.prepare("DELETE FROM elements WHERE project_id=? AND kind='text'").run(projectId);

const base = join(workDir(projectId), "base.mp4");
const info = await probe(base);
const picked = await pickCaptionBand(
  base,
  info.width ?? OUT_WIDTH,
  info.height ?? OUT_HEIGHT,
  pack,
);
db.prepare("UPDATE projects SET subtitle_band=? WHERE id=?").run(picked.band, projectId);
console.log(`dải phụ đề → ${picked.band} (${picked.why})`);

await createCaptionElements(projectId, picked.band, pack);
const texts = (
  db
    .prepare("SELECT COUNT(*) AS n FROM elements WHERE project_id=? AND kind='text'")
    .get(projectId) as { n: number }
).n;
console.log(`cụm chữ → ${texts}`);

const keywords = await pickKeywords(projectId);
console.log(
  `nhấn → ${keywords.applied}/${texts} cụm (${((keywords.applied / texts) * 100).toFixed(0)}%)` +
    ` · ${keywords.rounds} lượt · gạt ${keywords.rejected}`,
);

// Chỗ nối gieo lại theo `junctionShare` của bộ mới.
db.prepare("DELETE FROM effects WHERE project_id=?").run(projectId);
const effects = await pickEffects(projectId, keptRanges(projectId, info.duration));
console.log(`chỗ nối → ${effects.applied} đặt · ${effects.rejected} gạt`);

const beganRender = Date.now();
await runExport(projectId);
await copyFile(join(workDir(projectId), "..", "out", "final.mp4"), outPath);
const render = (Date.now() - beganRender) / 1000;
// Mô hình chiếm bao nhiêu trong cả lượt — không đo thì mọi câu "đổi mô hình cho
// nhanh" đều là đoán.
console.log(
  `mô hình → ${modelSpend.calls} lượt gọi · ${(modelSpend.ms / 1000).toFixed(0)}s` +
    ` · nhớ sẵn ${cacheSpend.hits}/${cacheSpend.hits + cacheSpend.misses}` +
    ` · dựng ${render.toFixed(0)}s`,
);
console.log(`✓ ${outPath}`);
