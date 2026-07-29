import { useCallback, useMemo } from "react";

import type { EditorState } from "./use-editor";

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
  const veSegments = useMemo(
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
  const veTheoLoi = useCallback(
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

  return { veSegments, veTheoLoi };
}
