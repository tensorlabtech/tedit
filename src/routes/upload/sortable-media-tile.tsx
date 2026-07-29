import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";

import { MediaTile } from "./media-tile";

/**
 * Một ô trong dải kéo được, có hàng xóm tự xô ra nhường chỗ.
 *
 * Bản tự viết trước đây chỉ vẽ một vạch chèn rồi nhảy phắt sang thứ tự mới —
 * đúng chức năng nhưng đọc ra như một bảng biểu, không ra một mạch phim. `dnd-kit`
 * lo phần chuyển động (ô đang kéo bám tay, các ô khác trượt sang) và cả lối đi
 * bằng bàn phím: đưa tiêu điểm vào tay nắm, `Space` nhấc lên, mũi tên dời chỗ.
 */
export function SortableMediaTile({
  className,
  ...props
}: React.ComponentProps<typeof MediaTile>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.file.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // Ô đang kéo phải nằm TRÊN mọi ô khác: không có nó thì lúc trượt qua hàng
      // xóm, ô đang cầm chui xuống dưới và mất hút một nhịp.
      className={cn(isDragging && "relative z-10", className)}
    >
      <MediaTile
        {...props}
        handleProps={{ ...attributes, ...listeners }}
        dragging={isDragging}
      />
    </div>
  );
}
