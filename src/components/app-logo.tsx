import { cn } from "@/lib/utils";

/**
 * Dấu nhận diện của ứng dụng.
 *
 * Gọi bằng `<img>` chứ không dán SVG vào JSX: tệp có `<linearGradient>` mang một
 * mã định danh, mà dán nhiều lần trong một trang thì các mã đó trùng nhau và
 * trình duyệt lấy cái đầu tiên cho tất cả — đủ để logo ở chỗ này ăn màu của chỗ
 * khác. Qua `<img>` thì mỗi lần vẽ là một tài liệu riêng.
 *
 * `alt=""` và `aria-hidden`: chữ "Trình dựng video" ngay bên cạnh đã là tên, nên
 * máy đọc mà đọc thêm dấu này chỉ lặp lại một lần nữa.
 */
export function AppLogo({
  className,
  showName = true,
}: {
  className?: string;
  showName?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      {/* `size-8` khớp chiều cao nút icon đứng cạnh (32px), nên hai thứ ở đầu
          thanh bên nằm đúng một hàng mà không cái nào trông lệch. */}
      <img src="/logo.svg" alt="" aria-hidden className="size-8 shrink-0" />
      {showName ? (
        <span className="font-heading truncate font-medium">
          Trình dựng video
        </span>
      ) : null}
    </span>
  );
}
