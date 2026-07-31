import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

/**
 * Ô RỖNG dùng chung cho mọi màn danh sách.
 *
 * Có mặt vì ba màn kho — Dự án, Tư liệu, Thư viện nhạc — đều cần đúng một hình
 * dạng: biểu tượng, một câu nói rõ đang thiếu gì, một câu chỉ việc tiếp theo, và
 * một cái nút làm ngay việc ấy. Mỗi màn tự dựng thì chúng trôi khỏi nhau ngay ở
 * lần sửa thứ hai: màn này có biểu tượng, màn kia không; màn này có nút, màn kia
 * bắt người dùng tự tìm đường.
 *
 * KHÔNG gói `Empty` của design system lại thành một thứ khác — chỉ cố định thứ
 * TỰ Ở NGOÀI quyết định: dùng bao nhiêu mảnh và xếp theo thứ tự nào.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  loading,
}: {
  /** Biểu tượng của thứ đang thiếu — video, ảnh, nốt nhạc… */
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  /** Việc tiếp theo, dựng sẵn thành nút. Bỏ trống khi không có việc gì để làm. */
  action?: React.ReactNode;
  /** Đang chờ máy chủ — thay biểu tượng bằng con quay, và bỏ nút đi. */
  loading?: boolean;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">{loading ? <Spinner /> : icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && !loading && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
