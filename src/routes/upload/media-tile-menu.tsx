import {
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  ArrowRightIcon,
  MoreVerticalIcon,
  RotateCcwIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  mainRoleRejection,
  type MediaFile,
  type MediaRole,
} from "./upload-data";

/**
 * Mọi thao tác với một ô tư liệu, gom vào một bảng.
 *
 * Bày thẳng bốn nút lên ô thì ô rộng 80px không còn chỗ cho ảnh — mà ảnh mới là
 * thứ giúp người dùng nhận ra mình đang thao tác với cảnh nào.
 */
export function MediaTileMenu({
  file,
  label,
  index,
  count,
  moveTo,
  onReorder,
  onMove,
  onRemove,
  onCancel,
  onRetry,
}: {
  file: MediaFile;
  /** Tên rút gọn, dùng cho nhãn trợ năng — tên đầy đủ đã nằm ở dòng chú thích */
  label: string;
  index?: number;
  count: number;
  moveTo: MediaRole;
  onReorder?: (direction: -1 | 1) => void;
  onMove: () => void;
  onRemove: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const moveBlocked = moveTo === "main" ? mainRoleRejection(file) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="secondary"
            size="icon-xs"
            aria-label={`Thao tác với ${label}`}
            // Chỉ hiện khi rê vào đúng ô này hoặc ô đang giữ tiêu điểm: một dải
            // hai chục ô bày sẵn hai chục nút thì không còn nhìn ra ảnh nữa.
            className="absolute top-1 right-1 opacity-0 transition-opacity group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 data-popup-open:opacity-100"
          />
        }
      >
        <MoreVerticalIcon />
      </DropdownMenuTrigger>
      {/* Rộng hơn trần mặc định: "Chuyển sang tư liệu chèn" là mục dài nhất, ở
          224px nó gãy làm hai dòng và một mục hai dòng đọc ra như hai mục. */}
      <DropdownMenuContent align="end" className="w-64">
        {file.status === "uploading" && (
          <DropdownMenuItem onClick={onCancel}>
            <SquareIcon />
            Huỷ tải
          </DropdownMenuItem>
        )}
        {file.status === "error" && (
          <DropdownMenuItem onClick={onRetry}>
            <RotateCcwIcon />
            Thử lại
          </DropdownMenuItem>
        )}
        {/* Chỉ có một cảnh thì không có thứ tự nào để đổi — bày hai mục xám ra
            chỉ tổ làm người dùng tưởng mình bấm sai. */}
        {onReorder && count > 1 && (
          <>
            <DropdownMenuItem
              disabled={index === 0}
              onClick={() => onReorder(-1)}
            >
              <ArrowLeftIcon />
              Đưa lên trước
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index === count - 1}
              onClick={() => onReorder(1)}
            >
              <ArrowRightIcon />
              Đưa xuống sau
            </DropdownMenuItem>
          </>
        )}
        {/* Mục bị khoá thì chữ phải nói LÝ DO, không lặp lại tên việc: đọc đúng
            cái việc mình vừa không làm được thì vẫn không biết vì sao. */}
        <DropdownMenuItem disabled={Boolean(moveBlocked)} onClick={onMove}>
          <ArrowLeftRightIcon />
          {moveBlocked ??
            (moveTo === "main"
              ? "Chuyển sang cảnh chính"
              : "Chuyển sang tư liệu chèn")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onRemove}>
          <XIcon />
          Gỡ khỏi dự án
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
