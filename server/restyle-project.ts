import { db } from "./db";
import { findLayout, layoutFitsMedia, type LayoutKindId } from "./layout-kinds";
import { placePersonLayouts } from "./place-person-layouts";
import { blocksFromPack } from "./style-pack";
import { STYLE_PACKS } from "./style-pack-catalog";

/**
 * ĐỔI VIBE (bộ dáng) TOÀN DIỆN — giữ CONTENT, dựng lại STYLE.
 *
 * Vì render đọc LOOK từ block đóng dấu trên từng element (BLOCK-POOL), đổi mỗi cột
 * `style_pack` thì nhìn vẫn y cũ (đó là "chưa tới" của bản trước). Ở đây GHI ĐÈ
 * block look của MỌI element bằng look của bộ mới, và re-pick kiểu khung b-roll
 * theo bộ mới — nhưng KHÔNG đụng content:
 *
 *  GIỮ: cắt · chữ caption + cách chia cụm · clip b-roll & vị trí & độ dài · dấu từ nhấn.
 *  DỰNG LẠI: look chữ (`caption_block`) · look khung/nền (`frame_block`) · kiểu khung b-roll.
 *
 * FORCE: kể cả element user đã chỉnh look tay cũng bị ghi đè — đúng ý "toàn diện";
 * an toàn bằng cảnh báo + undo ở phía gọi.
 *
 * (align/emphasis/reveal KHÔNG đụng: mọi bộ khai `defaults` giống nhau nên chúng
 * đồng nhất — xem `caption-elements.ts`. Ô người + hiệu ứng re-derive ở bước sau.)
 */
export function restyleProject(projectId: string, newPackId: string): void {
  const pack = STYLE_PACKS.find((item) => item.id === newPackId);
  if (!pack) throw new Error(`Bộ dáng lạ: ${newPackId}`);

  const blocks = blocksFromPack(pack);

  db.transaction(() => {
    // 1. Đổi cột bộ dáng dự án.
    db.prepare("UPDATE projects SET style_pack=? WHERE id=?").run(
      newPackId,
      projectId,
    );

    // 2. GHI ĐÈ look block (toàn bộ, không phải fill-NULL như `stampBlocksFromPack`).
    //    `*_preset` = id bộ mới → picker tô đúng, và mọi look về đồng nhất bộ mới.
    db.prepare(
      "UPDATE elements SET caption_block=?, caption_preset=? WHERE project_id=? AND kind='text'",
    ).run(JSON.stringify(blocks.caption), pack.id, projectId);
    db.prepare(
      "UPDATE elements SET frame_block=?, frame_preset=? WHERE project_id=? AND kind='layout'",
    ).run(JSON.stringify(blocks.frame), pack.id, projectId);

    // 3. Re-pick KIỂU khung b-roll theo layouts bộ mới (giữ nguyên vị trí/clip).
    //    Bộ mới có bố cục b-roll khác (vd Cơ bản: full/fit; Prism: ô chia) — không
    //    re-pick thì b-roll vẫn dùng khung của bộ cũ, vibe không đổi thật.
    const brollLayouts = pack.layouts.filter(
      (id) => findLayout(id).needsInsert,
    ) as LayoutKindId[];
    if (brollLayouts.length > 0) {
      const brolls = db
        .prepare(
          `SELECT e.id AS id, m.width AS w, m.height AS h
             FROM elements e LEFT JOIN media_files m ON m.id = e.media_file_id
            WHERE e.project_id=? AND e.kind='layout' AND e.media_file_id IS NOT NULL`,
        )
        .all(projectId) as Array<{ id: string; w: number | null; h: number | null }>;
      const setLayout = db.prepare("UPDATE elements SET insert_layout=? WHERE id=?");
      for (const b of brolls) {
        const aspect = b.w && b.h ? b.w / b.h : null;
        const fitting = brollLayouts.filter((id) => layoutFitsMedia(id, aspect));
        const pool = fitting.length ? fitting : brollLayouts;
        // Full (cover) vs vừa-khung (contain) theo tỉ lệ — khớp `ai-broll-place`.
        const hasFullFit =
          pool.includes("broll-full") && pool.includes("broll-fit");
        const layout =
          hasFullFit && aspect != null
            ? aspect > 1
              ? "broll-fit"
              : "broll-full"
            : pool[0];
        setLayout.run(layout, b.id);
      }
    }

    // 4. Ô NGƯỜI (o-don, o-vuong…): bộ mới có bộ layout khác (vd Cơ bản không có
    //    ô). Xoá ô cũ rồi re-place theo bộ mới — bộ không có ô thì ô biến mất.
    //    `placePersonLayouts` chỉ chạy khi CHƯA có ô, nên phải xoá trước.
    db.prepare(
      `DELETE FROM elements
        WHERE project_id=? AND kind='layout' AND media_file_id IS NULL
          AND insert_layout NOT IN ('toan-khung','trang-chu')`,
    ).run(projectId);
    placePersonLayouts(projectId);
  })();
}
