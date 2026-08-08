import { useEffect, useRef, useState } from "react";

import { zoomFactorFromWheel } from "./timeline-zoom";
import { setPageDragging } from "./use-editor-guards";

/** Kéo bao nhiêu px mới tính là KÉO chứ không phải bấm. */
const DRAG_THRESHOLD = 3;

/** Loại khối gọt mép được — bàn dựng có sáu, màn cắt chỉ dùng "clip". */
export type TrimKind = "clip" | "music" | "insert" | "text" | "effect" | "scene";

/**
 * Bộ ĐIỀU KHIỂN một dải — đúng phần `useTimelineDrag` cần, không hơn.
 *
 * Trước đây hook này nhận nguyên `EditorState`, nên chỉ bàn dựng dùng được. Màn
 * Cắt đoạn lỗi cũng cần Y HỆT cách kéo, lăn, phóng và ghim vạch giữa — mà nó
 * không có `useEditor` và không nên có. Tách ra một interface nhỏ thì HAI dải
 * chạy cùng một mã: giống nhau vì là một, không phải vì bắt chước.
 *
 * `toOutput`/`toSource` ở màn cắt là hàm đồng nhất — bản cắt chưa nướng vào phim
 * nên chỉ có một trục thời gian. Ở bàn dựng chúng quy đổi giữa mốc gốc và mốc
 * xuất ra.
 */
export interface TimelineController {
  time: number;
  pxPerSecond: number;
  seek: (at: number) => void;
  scrubByPixels: (deltaX: number) => void;
  zoomBy: (factor: number) => void;
  toOutput: (at: number) => number;
  toSource: (at: number) => number;
  trim: (kind: TrimKind, id: string, edge: "start" | "end", at: number) => void;
  commitTrim: () => void;
}

/**
 * Mọi thao tác kéo trên dải: chạy dải, lăn để tua, phóng, và gọt mép khối.
 *
 * Tách khỏi `timeline.tsx` vì nó là phần duy nhất đụng thẳng vào sự kiện chuột
 * ở mức thấp — gắn listener tay, tự quản cờ kéo — còn phần kia chỉ là dựng hình.
 */
export function useTimelineDrag({
  ctrl,
  viewportRef,
  timeAtClientX,
}: {
  ctrl: TimelineController;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  timeAtClientX: (clientX: number) => number;
}) {
  const { time, pxPerSecond, seek, scrubByPixels, zoomBy } = ctrl;
  const { toOutput, toSource } = ctrl;
  const drag = useRef({ active: false, moved: false, x: 0, time: 0 });
  const [dragging, setDragging] = useState(false);
  const [trimming, setTrimming] = useState<{
    kind: TrimKind;
    id: string;
    edge: "start" | "end";
  } | null>(null);

  // Con lăn: lăn thường thì chạy dải, Ctrl+lăn thì phóng to. Phải nghe thủ công vì
  // React gắn wheel ở chế độ passive nên preventDefault trong onWheel vô hiệu.
  //
  // `preventDefault` ở đây còn gánh một việc thứ hai: chặn cử chỉ vuốt hai ngón
  // sang ngang của trình duyệt (lùi/tiến trang). CSS `overscroll-behavior` một
  // mình không đủ trên mọi máy, mà lùi trang lúc đang trượt dải là mất trắng
  // chỗ đang làm.
  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        zoomBy(zoomFactorFromWheel(event.deltaY));
        return;
      }
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      scrubByPixels(-delta);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [scrubByPixels, zoomBy]);

  // Kéo tay nắm để gọt mép. Tách riêng khỏi kéo-chạy-dải vì `trimming` là state
  // nên effect chạy lại đúng lúc, còn cờ kéo dải nằm trong ref (xem `startScrub`).
  useEffect(() => {
    if (!trimming) return;
    setPageDragging(true);
    const onMove = (event: PointerEvent) =>
      ctrl.trim(
        trimming.kind,
        trimming.id,
        trimming.edge,
        timeAtClientX(event.clientX),
      );
    const onUp = () => {
      void ctrl.commitTrim();
      setTrimming(null);
      // Nhả cờ sau một nhịp để cú click sinh ra lúc thả tay bị bỏ qua.
      window.setTimeout(() => (drag.current.moved = false), 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      setPageDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [trimming, ctrl, timeAtClientX]);

  // Kéo bất kỳ đâu trên dải để chạy dải. Gắn listener ngay tại pointerdown —
  // KHÔNG qua useEffect, vì cờ kéo nằm trong ref nên không có lượt render nào
  // để effect kịp chạy lại. Cũng không dùng setPointerCapture: nó nuốt mất sự
  // kiện click của các khối bên trong, mà khối cần click để chọn.
  const startScrub = (event: React.PointerEvent) => {
    if (trimming) return;
    // Nút giữa mở chế độ tự cuộn của Windows/Linux — con trỏ thành hình la bàn
    // và trang tự trôi. Ở đây nó chỉ phá.
    if (event.button === 1) event.preventDefault();
    if (event.button !== 0) return;
    const startX = event.clientX;
    // Mốc bắt đầu tính bằng giờ XUẤT RA, không phải giờ gốc.
    //
    // Dải vẽ theo giờ xuất ra, nên kéo đi `dx` pixel phải là đi `dx` giây xuất
    // ra. Cộng thẳng vào giờ GỐC thì vạch đi xuyên qua những quãng đã bỏ — mà
    // vạch không được đứng trong đó (§22), nên nó bị đẩy ra ngay lập tức, rồi
    // nhịp kéo sau lại đẩy vào: vạch nhấp nháy qua lại ở mọi chỗ cắt.
    const startOut = toOutput(time);
    drag.current = { active: true, moved: false, x: startX, time };
    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      if (Math.abs(dx) > DRAG_THRESHOLD) {
        drag.current.moved = true;
        // Cờ kéo phải là STATE, không chỉ là ref: ref không sinh lượt dựng nào nên
        // cái nhãn giây ở vạch sẽ không bao giờ hiện ra.
        setDragging(true);
        // Chuột đi ra khỏi dải lúc kéo thì trình duyệt quét chọn chữ ở bản chép
        // lời phía trên — cờ này tắt bôi đen trên cả trang.
        setPageDragging(true);
      }
      if (drag.current.moved) seek(toSource(startOut - dx / pxPerSecond));
    };
    const onUp = () => {
      drag.current.active = false;
      setDragging(false);
      setPageDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      // Nhả sau một nhịp để cú click ngay sau đó biết vừa có kéo mà bỏ qua.
      window.setTimeout(() => (drag.current.moved = false), 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return { drag, dragging, trimming, setTrimming, startScrub };
}
