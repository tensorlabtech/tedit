import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import type { EditorState, Selection } from "./use-editor";

/**
 * Chuột phải trên dải — chỗ đặt những việc HUỶ HOẠI.
 *
 * Trước đây "Bỏ đoạn" là một nút nổi lên trên khối đang chọn. Nó che đúng cái
 * dấu chỗ nối ở mép khối, mà chỗ nối cũng chỉ hiện khi đang chọn — hai thứ tranh
 * nhau một chỗ thì thứ nào cũng dùng không xong.
 *
 * Việc huỷ hoại thì để ở chuột phải và phím Delete: hai chỗ người ta đã quen tìm
 * ở mọi phần mềm dựng, và không cái nào chiếm pixel nào của dải.
 */
export function TimelineContextMenu({
  editor,
  target,
  children,
}: {
  editor: EditorState;
  /** Khối bị bấm chuột phải — `null` là bấm ra chỗ trống */
  target: Selection;
  children: React.ReactNode;
}) {
  const segment =
    target?.kind === "clip"
      ? editor.segments.find((item) => item.id === target.id)
      : undefined;

  return (
    <ContextMenu>
      <ContextMenuTrigger render={<div className="contents" />}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {segment && (
          <ContextMenuItem
            onClick={() => void editor.toggleSegment(segment.id)}
          >
            {segment.removed ? "Giữ lại đoạn này" : "Bỏ đoạn này"}
          </ContextMenuItem>
        )}
        {(target?.kind === "text" || target?.kind === "insert") && (
          <ContextMenuItem onClick={() => void editor.deleteElement(target.id)}>
            {target.kind === "text" ? "Xoá chữ này" : "Gỡ tư liệu này"}
          </ContextMenuItem>
        )}
        {target?.kind === "junction" && (
          <ContextMenuItem onClick={() => void editor.deleteEffect(target.id)}>
            Xoá hiệu ứng này
          </ContextMenuItem>
        )}
        {target?.kind === "music" && (
          <ContextMenuItem onClick={() => void editor.removeMusic(target.id)}>
            Gỡ nhạc này
          </ContextMenuItem>
        )}
        {/* Luôn có ít nhất một mục: bảng rỗng bật lên rồi tắt ngay là một cú
            nhấp nháy không ai giải thích được. */}
        {!target && (
          <ContextMenuItem disabled>
            Bấm chuột phải lên một khối để bỏ hoặc gỡ nó
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
