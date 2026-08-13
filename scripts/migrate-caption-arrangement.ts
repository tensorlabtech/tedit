/**
 * Áp BỘ CÔNG THỨC BỐ CỤC vào caption đã lưu — cho dự án sinh TRƯỚC khi có bộ công
 * thức (kẹt `align`/`emphasis` đồng nhất theo `defaults` cũ, vd Prism kẹt "even").
 *
 *   tsx scripts/migrate-caption-arrangement.ts [projectId]
 *
 * Không truyền id → chạy MỌI dự án có `style_pack` là bộ có công thức (prism-pro).
 * `align`/`emphasis` KHÔNG có UI chỉnh per-câu (do phong cách quyết) nên ghi đè an
 * toàn — không đụng nội dung, từ khoá, dải, hay chỉnh sửa nào của người dùng.
 */
import { arrangementFor } from "../server/caption-arrangement";
import { placeBlurFrames } from "../server/blur-frames";
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
).filter((p) => p.style_pack);

const update = db.prepare(
  "UPDATE elements SET align=?, emphasis=? WHERE id=?",
);

let totalCaptions = 0;
let totalBlur = 0;
let totalProjects = 0;
for (const project of projects) {
  const rows = db
    .prepare(
      `SELECT id, from_word_id FROM elements
       WHERE project_id=? AND kind='text'`,
    )
    .all(project.id) as Array<{ id: string; from_word_id: string }>;

  let changed = 0;
  db.transaction(() => {
    for (const row of rows) {
      const recipe = arrangementFor(project.style_pack as string, row.from_word_id);
      if (!recipe) continue; // bộ dáng không có công thức → để nguyên
      update.run(recipe.align, recipe.emphasis, row.id);
      changed += 1;
    }
  })();

  // Đặt KHUNG MỜ ở cụm-chốt (sau arrangement — nó ghi đè cụm chốt thành even+giữa
  // để chữ full to). Chỉ bộ có defocus (Prism) mới đặt.
  const blurred = placeBlurFrames(
    project.id,
    findStylePack(project.style_pack as string),
  );

  if (changed > 0 || blurred > 0) {
    totalProjects += 1;
    totalCaptions += changed;
    totalBlur += blurred;
    console.log(
      `  ${project.id} (${project.style_pack}): ${changed} câu, ${blurred} khung mờ`,
    );
  }
}

console.log(
  `\nĐã áp công thức cho ${totalCaptions} câu, đặt ${totalBlur} khung mờ / ${totalProjects} dự án.`,
);
