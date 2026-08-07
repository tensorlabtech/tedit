import * as React from "react";

/**
 * Báo khi một phần tử lần đầu lọt vào tầm nhìn — để landing chạy hiệu ứng hiện dần
 * lúc cuộn tới, thay vì bày sẵn mọi thứ ngay từ đầu.
 *
 * Mặc định `once: true`: đã hiện thì thôi. Cuộn qua lại mà cứ ẩn-hiện lặp lại thì
 * thành nhấp nháy, không phải điểm nhấn. Ai tắt hiệu ứng ở hệ điều hành thì nơi
 * gọi tự lo bằng biến thể `motion-reduce`, không phải việc của hook này.
 */
export function useInView<T extends Element = HTMLDivElement>({
  once = true,
  rootMargin = "0px 0px -10% 0px",
}: { once?: boolean; rootMargin?: string } = {}) {
  const ref = React.useRef<T>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once, rootMargin]);

  return { ref, inView };
}
