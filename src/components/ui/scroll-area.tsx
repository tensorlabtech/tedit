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

/**
 * KÉO ĐỂ TRƯỢT dải ngang, như kéo một tờ giấy trên bàn.
 *
 * Có ba cách cuộn ngang rồi — vuốt bàn di chuột, lăn bánh xe, kéo thanh cuộn —
 * nhưng cả ba đều là "điều khiển thanh cuộn", còn cái này là cầm thẳng vào nội
 * dung. Cùng một cử chỉ với dải thời gian ở bàn dựng.
 *
 * NGƯỠNG 5px là phần khó: dải ngang thường đầy NÚT (ô phong cách, ô cảnh), nên
 * phải phân biệt "kéo" với "bấm". Dưới 5px thì để yên cho cú bấm đi tiếp; quá
 * 5px mới nuốt nó và bắt đầu trượt — và từ lúc ấy chặn luôn `click` sắp tới,
 * không thì thả tay ra là chọn nhầm đúng cái ô vừa kéo qua.
 *
 * `data-dragging` trên thẻ gốc là cơ chế sẵn có của dự án: nó lo con trỏ nắm và
 * chặn bôi đen chữ trên CẢ trang, vì chuột đi ra ngoài dải trong lúc kéo thì
 * trình duyệt vẫn quét chọn chữ ở chỗ khác.
 */
function useDragToScroll(
  ref: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;

    let startX = 0;
    let startLeft = 0;
    let dragging = false;
    let pointerId: number | null = null;

    const THRESHOLD = 5;

    const onPointerDown = (event: PointerEvent) => {
      // Chuột phải và bút cảm ứng để yên; bàn di chuột đã vuốt ngang được rồi.
      if (event.button !== 0) return;
      startX = event.clientX;
      startLeft = node.scrollLeft;
      pointerId = event.pointerId;
      dragging = false;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      const dx = event.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < THRESHOLD) return;
        dragging = true;
        node.setPointerCapture(event.pointerId);
        document.documentElement.dataset.dragging = "true";
      }
      event.preventDefault();
      node.scrollLeft = startLeft - dx;
    };

    const stop = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      if (!dragging) return;
      dragging = false;
      delete document.documentElement.dataset.dragging;
      // Nuốt đúng một cú `click` — cú sinh ra từ chính lần thả tay này.
      const swallow = (click: MouseEvent) => {
        click.stopPropagation();
        click.preventDefault();
      };
      node.addEventListener("click", swallow, { capture: true, once: true });
      // Kéo mà không bấm trúng nút nào thì chẳng có `click` nào tới, và cái bẫy
      // trên nằm lại nuốt oan cú bấm kế tiếp.
      setTimeout(
        () => node.removeEventListener("click", swallow, { capture: true }),
        0,
      );
    };

    node.addEventListener("pointerdown", onPointerDown);
    node.addEventListener("pointermove", onPointerMove);
    node.addEventListener("pointerup", stop);
    node.addEventListener("pointercancel", stop);
    return () => {
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", stop);
      node.removeEventListener("pointercancel", stop);
      delete document.documentElement.dataset.dragging;
    };
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
  useDragToScroll(viewportRef, orientation === "horizontal");

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      /*
       * `min-h-0` — vùng cuộn phải CO ĐƯỢC, nếu không thì nó không cuộn.
       *
       * Phần tử con của flex/grid mặc định `min-height: auto`, tức không bao giờ
       * nhỏ hơn nội dung. Nên trong một hàng lưới bị ép chiều cao, vùng cuộn nở
       * hết cỡ và đẩy cả thẻ tràn ra ngoài — thẻ thì `overflow-hidden` nên phần
       * thừa bị xén và không có cách nào cuộn tới. Đo ở màn chờ: hàng được cấp
       * 501px nhưng đòi 726px, mất 225px danh sách chặng.
       *
       * Chỗ nào cha không ép chiều cao thì dòng này không đổi gì — vùng cuộn vẫn
       * cao theo nội dung.
       */
      className={cn("relative min-h-0", className)}
      {...props}
    >
      {/* `p-[3px]` là chỗ thở cho MÉP của thứ nằm sát rìa vùng cuộn.
          `overflow` cắt đúng ở mép hộp đệm, nên ô đầu và ô cuối của một dải bị
          gọt mất một cạnh viền — trông khác hẳn mấy ô ở giữa mà không vì lý do
          gì. Sửa ở đây một lần thì mọi nơi gọi khỏi phải nhớ. */}
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        data-overflowing={overflowing || undefined}
        className={cn(
          "size-full rounded-[inherit] p-[3px] transition-[color,box-shadow] outline-none ",
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
