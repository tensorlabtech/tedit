import { PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Ô "thêm nữa" đứng cuối dải.
 *
 * Có nó thì nút thêm luôn nằm ngay chỗ mắt đang nhìn — đầu thẻ cũng có nút thêm,
 * nhưng khi dải đã dài thì đầu thẻ ở tít trên còn tay thì đang ở cuối dải.
 *
 * Hình dáng và bề rộng do nơi gọi đặt qua `className`: cả hai dải đều dùng khung
 * 9:16, bề rộng suy từ chiều cao vùng cuộn.
 *
 * Ở dải mạch chính nó bấm là mở hộp chọn tệp luôn; ở dải tư liệu chèn nó mở menu
 * hai đường (từ máy / từ kho). Nên nó chỉ là một cái nút — việc gì do nơi gọi gắn.
 */
export function AddMediaTile({
  label,
  className,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border p-2 text-center text-xs text-muted-foreground transition-colors outline-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      // Nhận và chuyển tiếp mọi thuộc tính còn lại: ở dải tư liệu chèn ô này
      // đóng vai nút mở menu, mà `DropdownMenuTrigger` gắn việc của nó bằng cách
      // truyền thêm props vào — nuốt mất thì bấm không ra gì.
      {...props}
    >
      <PlusIcon className="size-4" />
      {label}
    </button>
  );
}
