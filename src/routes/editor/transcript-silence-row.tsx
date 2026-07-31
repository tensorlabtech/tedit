import { EyeOffIcon, Undo2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { formatTime, silenceLabel } from "./editor-data";
import type { EditorState } from "./use-editor";

/**
 * Khoảng KHÔNG AI NÓI — một dòng như mọi dòng khác, chỉ đặt trong ngoặc.
 *
 * Trước đây nó là chỗ trống giữa hai dòng: không nhìn thấy, không bấm được, và
 * chỉ được nhắc tới nếu dài quá 4 giây ở hàng "Cần bạn xem". Nhưng bỏ chỗ hít
 * thở thừa là việc người ta làm suốt.
 *
 * Bản đầu vẽ nó thành một vạch kẻ có chữ ở giữa — trông như dấu phân cách chứ
 * không như một thứ bấm được. Cùng một dáng với dòng chữ thì tay đi tới đâu
 * cũng biết mình đang làm gì; dấu ngoặc đủ để biết đây không phải lời nói.
 */
export function SilenceRow({
  start,
  end,
  editor,
}: {
  start: number;
  end: number;
  editor: EditorState;
}) {
  const mid = (start + end) / 2;
  const removed = editor.skipRanges.some(
    (span) => mid >= span.start && mid < span.end,
  );

  return (
    <div className="group/row flex items-start gap-2 rounded-lg px-2 py-1 hover:bg-accent/50">
      <button
        type="button"
        onClick={() => editor.seek(start)}
        className="min-h-6 pt-0.5 text-xs text-muted-foreground tabular-nums"
      >
        {formatTime(start)}
      </button>
      <button
        type="button"
        onClick={() => editor.seek(start)}
        className={cn(
          "min-h-6 flex-1 text-left text-sm text-muted-foreground italic",
          removed && "line-through",
        )}
      >
        {silenceLabel(end - start)}
      </button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={removed ? "Giữ lại khoảng lặng" : "Bỏ khoảng lặng"}
        tooltip={
          removed ? "Giữ lại khoảng lặng này" : "Bỏ khoảng lặng này khỏi video"
        }
        className={cn(
          "shrink-0",
          removed ? "opacity-100" : "opacity-0 group-hover/row:opacity-100",
        )}
        onClick={() =>
          removed
            ? void editor.restoreRange(mid)
            : void editor.cutRange(start, end)
        }
      >
        {removed ? <Undo2Icon /> : <EyeOffIcon />}
      </Button>
    </div>
  );
}
