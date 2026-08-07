import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/use-in-view";

/**
 * Bọc một khối để nó hiện dần (mờ + trượt lên nhẹ) khi cuộn tới.
 *
 * Gom vào một chỗ vì MỌI section của landing đều cần đúng một hiệu ứng này — để
 * mỗi chỗ tự viết thì độ trễ, quãng trượt và cách tôn trọng "tắt hiệu ứng" sẽ
 * trôi khỏi nhau. `delay` để xếp so le các mục trong cùng một hàng.
 *
 * `motion-reduce:*`: ai bật "giảm chuyển động" ở hệ điều hành thì thấy nội dung
 * đứng yên, đủ rõ ngay, không mờ không trượt.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li";
}) {
  const { ref, inView } = useInView();

  return (
    <Tag
      ref={ref as never}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "transition-all duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
        inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
