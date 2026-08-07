import { db } from "./db";
import { findLayout, type LayoutKindId } from "./layout-kinds";
import type { PlacedSegment } from "./layout-schedule";
import { type KeptRange, mapToOutput } from "./render";

/**
 * NGUỒN SỰ THẬT của các segment bố cục ĐÃ ĐẶT — một khái niệm, một bảng.
 *
 * B-roll và ô người GIỜ CÙNG một bảng `elements`, cùng neo theo TỪ (sống qua cắt
 * lời). Phân biệt bằng `media_file_id`:
 * · CÓ media → b-roll (một bố cục CẦN tư liệu). `kind='insert'`.
 * · KHÔNG media → ô người (bố cục không cần tư liệu). `kind='layout'`.
 *
 * `insert_layout` giữ mã bố cục cho CẢ HAI. Bảng `scene_layouts` cũ (override
 * neo theo mốc) bỏ đi — không còn "auto để mà override".
 */

/** Tư liệu b-roll theo thứ tự segment — chỉ số `PlacedSegment.insert` tra vào đây. */
export type PlacedMedia = { mediaId: string; path: string; name: string };

type Row = {
  id: string;
  layout: string | null;
  mediaId: string | null;
  path: string | null;
  name: string | null;
  srcStart: number;
  srcEnd: number;
};

/**
 * Đọc + dựng segment ĐÃ ĐẶT trên trục ĐÃ CẮT.
 *
 * Trả `segments` (cho `scheduleScenes`) đã: map sang giây đã cắt, phân giải bố cục
 * (b-roll không hợp lệ → khung mặc định của bộ dáng; ô người không hợp lệ → bỏ),
 * và gán chỉ số tư liệu. Kèm `media` theo đúng thứ tự chỉ số ấy.
 */
export function buildPlacedSegments(
  projectId: string,
  kept: KeptRange[],
  allowedLayouts: readonly LayoutKindId[],
): { segments: PlacedSegment[]; media: PlacedMedia[] } {
  const brollLayouts = allowedLayouts.filter((id) => findLayout(id).needsInsert);
  const personLayouts = allowedLayouts.filter(
    (id) => !findLayout(id).needsInsert,
  );

  const rows = db
    .prepare(
      `SELECT e.id AS id, e.insert_layout AS layout, e.media_file_id AS mediaId,
              m.stored_path AS path, m.name AS name,
              w1.start_sec AS srcStart, w2.end_sec AS srcEnd
         FROM elements e
         JOIN words w1 ON w1.id = e.from_word_id
         JOIN words w2 ON w2.id = e.to_word_id
         LEFT JOIN media_files m ON m.id = e.media_file_id
        WHERE e.project_id=? AND e.kind IN ('insert','layout')
        ORDER BY w1.start_sec`,
    )
    .all(projectId) as Row[];

  const segments: PlacedSegment[] = [];
  const media: PlacedMedia[] = [];

  for (const row of rows) {
    const start = mapToOutput(kept, row.srcStart);
    const end = mapToOutput(kept, row.srcEnd);
    if (start === null || end === null || end <= start) continue;

    // CẤU TRÚC lấy từ `insert_layout`, KHÔNG từ media. Tư liệu chỉ LẤP ô phụ của
    // khung 2 ô — thiếu tư liệu thì ô phụ để TRỐNG (placeholder), không phải là
    // khung biến mất. Media không quyết cấu trúc; nó là một thuộc tính.
    const stored = row.layout as LayoutKindId | null;
    const wantsBroll = stored
      ? brollLayouts.includes(stored)
      : !!row.mediaId; // hàng cũ chưa có layout: có media = b-roll.

    if (wantsBroll) {
      if (brollLayouts.length === 0) continue;
      const layout =
        stored && brollLayouts.includes(stored) ? stored : brollLayouts[0];
      if (row.mediaId && row.path) {
        const index = media.length;
        media.push({
          mediaId: row.mediaId,
          path: row.path,
          name: row.name ?? "",
        });
        segments.push({ start, end, layout, insert: index, elementId: row.id });
      } else {
        // Khung 2 ô CHƯA có tư liệu → placeholder (ô phụ trống, không `insert`).
        segments.push({ start, end, layout, elementId: row.id });
      }
    } else {
      const layout =
        stored && personLayouts.includes(stored)
          ? stored
          : (personLayouts[0] ?? null);
      if (!layout) continue;
      segments.push({ start, end, layout, elementId: row.id });
    }
  }

  return { segments, media };
}
