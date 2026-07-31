import { useEffect, useRef, useState } from "react";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

import { cn } from "@/lib/utils";

/**
 * Vùng này có thật sự tràn không.
 *
 * `scroll-fade-b` che mờ 1.5rem cuối vùng cuộn để nói "còn nữa" — nhưng nó là
 * một `mask-image` thuần CSS nên che mờ CẢ KHI nội dung vừa đủ chỗ. Lúc đó dòng
 * cuối cùng bị làm nhạt đi mà chẳng có gì ở dưới, đọc ra thành một lỗi vẽ. Đã
 * gặp đúng chuyện này ở ô tư liệu chèn, và bảng chọn tư liệu bên bàn dựng thì
 * phải né hẳn class đó bằng một dòng ghi chú — tức là né ở nơi gọi, mỗi chỗ một
 * kiểu. Đo tại thành phần thì mọi nơi gọi được sửa một lượt.
 */
function useOverflowing(ref: React.RefObject<HTMLElement | null>) {
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const check = () =>
      setOverflowing(
        element.scrollHeight > element.clientHeight + 1 ||
          element.scrollWidth > element.clientWidth + 1,
      );
    check();
    // Theo dõi cả vùng nhìn lẫn nội dung: thêm bớt một ô con không làm vùng nhìn
    // đổi cỡ, mà đó chính là lúc "có tràn hay không" đổi.
    const observer = new ResizeObserver(check);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => observer.disconnect();
  });

  return overflowing;
}

/**
 * Dải cuộn NGANG nhận cả cú lăn DỌC của chuột.
 *
 * Bàn di chuột vuốt ngang được nên trên máy Mac không ai thấy thiếu. Nhưng
 * chuột thường chỉ có bánh xe dọc, và trình duyệt không tự chuyển nó thành cuộn
 * ngang — nên với chuột, một dải ngang chỉ còn cách kéo cái thanh cuộn mảnh ở
 * đáy. Đo được: lăn dọc trên dải phong cách để `scrollLeft` đứng nguyên ở 0.
 *
 * Chỉ nhận khi cú lăn là DỌC THUẦN (`deltaX === 0`): bàn di chuột vuốt chéo
 * gửi cả hai trục, mà cộng thêm deltaY vào đó thì dải trượt nhanh gấp đôi ý
 * người dùng.
 *
 * `passive: false` vì có `preventDefault` — không chặn thì trang phía sau cuộn
 * theo, và dải trôi ngang trong lúc cả màn trôi dọc.
 */
function useWheelToHorizontal(
  ref: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;

    const onWheel = (event: WheelEvent) => {
      if (event.deltaX !== 0 || event.deltaY === 0) return;
      // Hết dải rồi thì trả cú lăn về cho trang, đừng nuốt nó.
      const limit = node.scrollWidth - node.clientWidth;
      const next = node.scrollLeft + event.deltaY;
      if ((next < 0 && node.scrollLeft <= 0) || (next > limit && node.scrollLeft >= limit)) {
        return;
      }
      event.preventDefault();
      node.scrollLeft = Math.max(0, Math.min(limit, next));
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [ref, enabled]);
}

function ScrollArea({
  className,
  viewportClassName,
  scrollbar = true,
  orientation = "vertical",
  children,
  ...props
}: ScrollAreaPrimitive.Root.Props & {
  viewportClassName?: string
  /**
   * Vẽ thanh cuộn hay không. Vẫn cuộn được khi tắt.
   *
   * Tắt khi vùng cuộn đã tự nói "còn nữa" bằng cách khác — chẳng hạn mép dưới
   * mờ dần (`scroll-fade-b`). Lúc đó thanh cuộn chỉ là một vạch xám thứ hai nói
   * đúng điều vừa được nói rồi, mà lại ăn chỗ của nội dung.
   */
  scrollbar?: boolean
  /**
   * Chiều nào cuộn được thì vẽ thanh cuộn chiều đó.
   *
   * Bản gốc chỉ vẽ thanh dọc, nên vùng cuộn NGANG — dải cảnh chẳng hạn — trôi
   * đi mà không có gì báo là còn nữa; nơi gọi phải tự dựng thanh cuộn thứ hai
   * và mỗi chỗ lại vẽ một kiểu.
   */
  orientation?: "vertical" | "horizontal" | "both"
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const overflowing = useOverflowing(viewportRef);
  useWheelToHorizontal(viewportRef, orientation === "horizontal");

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      {/* `p-[3px]` KHÔNG phải trang trí — nó là chỗ cho VIỀN TIÊU ĐIỂM thở.
          Cả hệ vẽ tiêu điểm bằng `focus-visible:ring-3`, mà `ring` của Tailwind
          là bóng đổ nằm NGOÀI hộp viền. Vùng cuộn thì `overflow` cắt đúng ở mép
          hộp đệm, nên thứ nào nằm sát mép là ring bị gọt mất một cạnh — đây là
          lỗi lặp đi lặp lại ở dự án này, và soát bằng DOM thì MỌI chỗ dính đều
          quy về đúng thành phần này.
          3px là con số vừa đủ: bằng đúng bề dày ring. Sửa ở đây một lần thì mọi
          nơi gọi khỏi phải nhớ. */}
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        data-overflowing={overflowing || undefined}
        className={cn(
          "size-full rounded-[inherit] p-[3px] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
          viewportClassName,
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {scrollbar && orientation !== "horizontal" && <ScrollBar />}
      {scrollbar && orientation !== "vertical" && (
        <ScrollBar orientation="horizontal" />
      )}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };
