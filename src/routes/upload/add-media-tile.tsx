import { PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Ô "thêm nữa" đứng cuối dải.
 *
 * Có nó thì nút thêm luôn nằm ngay chỗ mắt đang nhìn — đầu thẻ cũng có nút thêm,
 * nhưng khi dải đã dài thì đầu thẻ ở tít trên còn tay thì đang ở cuối dải.
 *
 * Hình dáng do nơi gọi đặt qua `className`: dải cảnh dùng khung 9:16 cho khớp
 * hàng ô bên cạnh, kho tư liệu thì để vuông vì ô ở đó cao thấp không đều.
 */
export function AddMediaTile({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border p-2 text-center text-xs text-muted-foreground transition-colors outline-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <PlusIcon className="size-4" />
      {label}
    </button>
  );
}
