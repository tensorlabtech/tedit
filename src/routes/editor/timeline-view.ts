import { useCallback, useMemo } from "react";

import type { EditorState } from "./use-editor";

/**
 * Mép khối cách mép đoạn dưới ngần này giây thì coi như cùng một chỗ.
 *
 * Khớp `SPEECH_MARGIN` của `server/segment-seed.ts` cộng một chút dư: đó đúng là
 * biên độ mà mép đoạn có thể nới ra so với mốc từ, nên mọi lệch nằm trong đó là
 * lệch DO PHÉP NỚI, không phải do người dùng đã dời gì.
 */
const SNAP_LIMIT = 0.45;

/**
 * Quy đổi mọi thứ trên dải sang mốc VIDEO SẼ XUẤT RA.
 *
 * Tách khỏi `timeline.tsx` vì nó là một việc riêng và đủ nặng: dải vẽ theo mốc
 * xuất ra, còn kho dữ liệu vẫn giữ mốc gốc, nên chỗ nối giữa hai hệ phải nằm
 * gọn một chỗ để còn dò khi lệch.
 */
export function useTimelineView(editor: EditorState) {
  const { toOutput } = editor;

  /**
   * Chỉ vẽ những đoạn CÒN vào video, đặt theo mốc xuất ra.
   *
   * `srcStart` đi kèm vì dải ảnh phim lấy khung theo giây của BẢN GỐC — đoạn dời
   * sang chỗ mới trên dải vẫn phải lấy đúng hình của chính nó.
   */
  const visibleSegments = useMemo(
    () =>
      editor.segments
        .filter((clip) => !clip.removed)
        .map((clip) => ({
          ...clip,
          start: toOutput(clip.start),
          end: toOutput(clip.end),
          srcStart: clip.start,
        })),
    [editor.segments, toOutput],
  );

  /** Khối chữ / tư liệu / nhạc: chỉ đổi mốc để vẽ, giữ nguyên mọi thứ khác. */
  const toVisible = useCallback(
    <T extends { start: number; end: number }>(items: T[]) =>
      items
        .map((item) => ({
          ...item,
          start: toOutput(item.start),
          end: toOutput(item.end),
        }))
        // Khối nằm trọn trong quãng đã bỏ co về bề rộng 0 — bỏ hẳn, không vẽ
        // một vạch mảnh vô nghĩa.
        .filter((item) => item.end - item.start > 0.02),
    [toOutput],
  );

  /**
   * Hít mép khối về mép ĐOẠN khi hai mép chỉ lệch nhau một chút.
   *
   * Mép đoạn được nới ra tới chỗ tiếng thật tắt (§51) nên nó không còn trùng mốc
   * TỪ mà cụm chữ neo vào. Lệch ấy nhỏ — 40–100ms, tức 8–11px ở mức phóng
   * thường — nhưng nó chỉ xảy ra ở những cụm đứng trước một quãng lặng, nên dải
   * đọc ra thành hai hàng khối SO LE nhau ở chỗ này, khớp ở chỗ kia. Đúng chỗ
   * người dùng chỉ ra: "cái chữ với cái đoạn nó loạn lạc quá".
   *
   * Hít ở tầng VẼ, không đổi dữ liệu: mốc chữ vẫn là mốc từ, nên chữ vẫn hiện
   * lên video đúng lúc tiếng được nói. Chỉ cái khối trên dải nói lại điều mà mắt
   * cần nghe — "chữ này thuộc khúc phim này".
   *
   * Chỉ hít trong tầm phần nới (0,45 giây). Lệch hơn thế là chữ THẬT SỰ nằm
   * lệch đoạn — người dùng vừa gộp cụm, vừa tách đoạn — và lúc đó vẽ đúng sự
   * thật mới là việc phải làm.
   */
  const snapToSegments = useCallback(
    <T extends { start: number; end: number }>(items: T[]) => {
      const edges = visibleSegments;
      if (edges.length === 0) return items;
      const nearest = (at: number) => {
        let best = at;
        let gap = SNAP_LIMIT;
        for (const segment of edges) {
          for (const edge of [segment.start, segment.end]) {
            const distance = Math.abs(edge - at);
            if (distance < gap) {
              gap = distance;
              best = edge;
            }
          }
        }
        return best;
      };
      return items.map((item) => {
        const start = nearest(item.start);
        const end = nearest(item.end);
        // Hít xong mà khối lộn đầu đuôi thì thà giữ nguyên: hai mốc rơi vào cùng
        // một mép đoạn khi cả khối ngắn hơn cả phần nới.
        return end - start > 0.02 ? { ...item, start, end } : item;
      });
    },
    [visibleSegments],
  );

  return { visibleSegments, toVisible, snapToSegments };
}
