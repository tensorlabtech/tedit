import { cn } from "@/lib/utils";

/**
 * Khung dọc chung cho mỗi khối của landing: canh giữa, chặn bề ngang tối đa, và
 * cùng một nhịp đệm trên–dưới. Gom vào đây để mọi khối thở đều nhau, không mỗi
 * chỗ một khoảng cách.
 */
export function Section({
  children,
  className,
  width = "wide",
  id,
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  /** `wide` cho lưới/nội dung nhiều cột; `narrow` cho khối chữ đọc một dòng. */
  width?: "wide" | "narrow";
  id?: string;
  /** Tên cho vùng khi khối không có tiêu đề riêng — để máy đọc màn định danh được. */
  ariaLabel?: string;
}) {
  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={cn("px-4 py-20 sm:py-28", className)}
    >
      <div
        className={cn(
          "mx-auto",
          width === "wide" ? "max-w-6xl" : "max-w-3xl",
        )}
      >
        {children}
      </div>
    </section>
  );
}
