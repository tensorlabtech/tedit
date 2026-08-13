import { db, newId } from "./db";
import { blocksFromPack, type StylePack } from "./style-pack";

/**
 * Đặt KHUNG MỜ ở các cụm-CHỐT — "đóng gói" defocus thành một LOẠI KHUNG.
 *
 * Trước đây "cả người mờ, chữ nổi" là hiệu ứng tự-động-theo-caption tính lúc
 * render (`punchlineSet`), không sửa được. Giờ nó là KHUNG THẬT: một element
 * `toan-khung` đóng dấu `frame_block.blur=true`. Sửa/bỏ như mọi khung, "dùng đâu
 * cũng mờ y hệt" (block-pool). Bước này CHỈ đặt SẴN vài cái ở chỗ chốt cho đẹp
 * mặc định — sau đó người dùng tự thêm/bỏ/dời, kệ họ.
 *
 * Luật chọn (giữ nhịp như defocus cũ): cụm CÓ từ khoá, cách cụm-mờ trước ≥
 * `minGapSec`, và KHÔNG đè khung đã có (b-roll/ô người). Chữ trong khung mờ để
 * FULL TO (`even` + canh giữa) — nổi bật trên hình đã mờ.
 *
 * Chỉ bộ dáng CÓ `punchDefocus` (vd Prism) mới đặt; bộ khác trả 0.
 * Idempotent: xoá khung mờ cũ trước khi đặt lại.
 */
export function placeBlurFrames(projectId: string, pack: StylePack): number {
  const gap = pack.punchDefocus?.minGapSec;
  if (!gap) return 0;

  // Xoá khung mờ CŨ (chạy lại không nhân đôi).
  db.prepare(
    `DELETE FROM elements WHERE project_id=? AND kind='layout'
       AND insert_layout='toan-khung' AND frame_block LIKE '%"blur":true%'`,
  ).run(projectId);

  const caps = db
    .prepare(
      `SELECT e.id, e.from_word_id, e.to_word_id, e.keywords,
              wf.start_sec AS start, wt.end_sec AS "end"
         FROM elements e
         JOIN words wf ON wf.id=e.from_word_id
         JOIN words wt ON wt.id=e.to_word_id
        WHERE e.project_id=? AND e.kind='text'
        ORDER BY wf.start_sec`,
    )
    .all(projectId) as Array<{
    id: string;
    from_word_id: string;
    to_word_id: string;
    keywords: string | null;
    start: number;
    end: number;
  }>;

  // Khung ĐÃ CÓ (b-roll/2-ô/ô người) — né, không đặt khung mờ đè lên.
  const frames = db
    .prepare(
      `SELECT wf.start_sec AS start, wt.end_sec AS "end"
         FROM elements e
         JOIN words wf ON wf.id=e.from_word_id
         JOIN words wt ON wt.id=e.to_word_id
        WHERE e.project_id=? AND e.kind IN ('layout','insert')
          AND e.insert_layout IS NOT NULL AND e.insert_layout!='toan-khung'`,
    )
    .all(projectId) as Array<{ start: number; end: number }>;
  const overlapsFrame = (s: number, e: number) =>
    frames.some((f) => s < f.end && f.start < e);

  // KHUNG MỜ = look toan-khung của bộ + `blur`. `insetCard: null` vì người phủ kín
  // (không thẻ). Chữ FULL TO: `even` + canh giữa.
  const blurBlock = JSON.stringify({
    ...blocksFromPack(pack).frame,
    insetCard: null,
    blur: true,
  });
  const insertFrame = db.prepare(
    `INSERT INTO elements (id, project_id, kind, from_word_id, to_word_id, insert_layout, frame_block, frame_preset)
     VALUES (?,?,'layout',?,?,'toan-khung',?,?)`,
  );
  const bigCaption = db.prepare(
    `UPDATE elements SET emphasis='even', align='center' WHERE id=?`,
  );

  let lastEnd = -Infinity;
  let placed = 0;
  db.transaction(() => {
    for (const c of caps) {
      if (!c.keywords) continue; // không từ khoá → không phải cụm chốt
      if (c.start - lastEnd < gap) continue; // thưa cho có nhịp
      if (overlapsFrame(c.start, c.end)) continue; // né khung có sẵn
      insertFrame.run(
        newId("e"),
        projectId,
        c.from_word_id,
        c.to_word_id,
        blurBlock,
        pack.id,
      );
      bigCaption.run(c.id);
      lastEnd = c.end;
      placed += 1;
    }
  })();
  return placed;
}
