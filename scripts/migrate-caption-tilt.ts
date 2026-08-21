/**
 * Áp lại GÓC NGHIÊNG CỤM CHỮ vào caption đã lưu — cho dự án sinh TRƯỚC lúc đổi
 * góc trong catalog.
 *
 *   tsx scripts/migrate-caption-tilt.ts [projectId]
 *
 * Không truyền id → chạy MỌI dự án có `style_pack`.
 *
 * ## Vì sao cần một lượt chép tay
 *
 * `captionTilt` nằm trong `caption_block` đóng dấu lên từng cụm lúc TẠO, và render
 * đọc block chứ không đọc bộ dáng — đó là điều làm một cụm chữ hiện y hệt ở mọi
 * video, kể cả khi trộn nhiều bộ. Cái giá của nó: đổi con số trong catalog KHÔNG
 * chạm tới dự án cũ, chúng giữ nguyên góc của ngày chúng được gieo.
 *
 * Ghi đè ở đây an toàn vì góc nghiêng KHÔNG có chỗ chỉnh per-câu trong giao diện —
 * nó do phong cách quyết, cùng lối `align`/`emphasis` ở `migrate-caption-arrangement`.
 * Chỉ đụng đúng một khoá; mọi khoá khác của block giữ nguyên.
 */
import { db } from "../server/db";
import { findStylePack } from "../server/style-pack-catalog";

const only = process.argv[2];

const projects = (
  only
    ? (db
        .prepare("SELECT id, style_pack FROM projects WHERE id=?")
        .all(only) as Array<{ id: string; style_pack: string | null }>)
    : (db
        .prepare("SELECT id, style_pack FROM projects")
        .all() as Array<{ id: string; style_pack: string | null }>)
).filter((project) => project.style_pack);

const update = db.prepare("UPDATE elements SET caption_block=? WHERE id=?");

let totalCaptions = 0;
let totalProjects = 0;
for (const project of projects) {
  const want = findStylePack(project.style_pack as string).captionTilt;
  const rows = db
    .prepare(
      `SELECT id, caption_block FROM elements
       WHERE project_id=? AND kind='text' AND caption_block IS NOT NULL`,
    )
    .all(project.id) as Array<{ id: string; caption_block: string }>;

  let changed = 0;
  db.transaction(() => {
    for (const row of rows) {
      const block = JSON.parse(row.caption_block) as Record<string, unknown>;
      // `?? null` cho cả hai vế: bộ không nghiêng khai `undefined`, mà JSON đã lưu
      // ghi ra `null` — so thẳng thì lượt nào cũng thấy "khác" và viết lại cả kho.
      if ((block.captionTilt ?? null) === (want ?? null)) continue;
      if (want === undefined) delete block.captionTilt;
      else block.captionTilt = want;
      update.run(JSON.stringify(block), row.id);
      changed += 1;
    }
  })();

  if (changed > 0) {
    totalProjects += 1;
    totalCaptions += changed;
    console.log(
      `  ${project.id} (${project.style_pack}): ${changed} cụm → ${want ?? "thẳng"}°`,
    );
  }
}

console.log(
  `\nĐã áp góc nghiêng cho ${totalCaptions} cụm / ${totalProjects} dự án.`,
);
