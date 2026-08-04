import { useCallback, useState } from "react";

/**
 * THANG PHÓNG CỦA DẢI — một thang duy nhất cho mọi màn có dải.
 *
 * Trước đây ba hằng số và `zoomBy` nằm trong `use-editor.ts`, hai cái trong đó
 * còn không xuất ra. Nên màn nào không có `useEditor` — bước Cắt đoạn lỗi — mà
 * cần một dải thì buộc phải tự đặt thang riêng, và hai thang sẽ lệch nhau ngay
 * lần đầu ai đó chỉnh một bên.
 *
 * Ở đây thì phóng to trên dải nào cũng nhích đúng chừng ấy, và mức mặc định
 * giống nhau — người dùng đi từ bước Cắt sang bàn dựng không thấy dải đổi cỡ.
 */

/** Thang phóng: desktop mặc định 200px/giây (xem docs/editor-interaction-spec.md §3) */
export const DEFAULT_PX_PER_SECOND = 200;
export const MIN_PX_PER_SECOND = 60;
export const MAX_PX_PER_SECOND = 600;

/**
 * Bước phóng của NÚT và PHÍM.
 *
 * Cả thang chỉ rộng 10 lần (60→600), nên bước 1,4 chia ra chưa tới bảy nấc —
 * bấm một cái là nhảy qua đúng mức mình cần. 1,25 cho mười nấc, canh được.
 */
export const ZOOM_STEP = 1.25;

export const clampZoom = (pxPerSecond: number) =>
  Math.min(Math.max(pxPerSecond, MIN_PX_PER_SECOND), MAX_PX_PER_SECOND);

/**
 * Đổi độ lăn thành hệ số phóng — theo ĐỘ LỚN cú lăn, không phải mỗi cú một nấc.
 *
 * Chụm hai ngón bắn ra hàng chục sự kiện nhỏ trong một cử chỉ; nhân 1,15 mỗi sự
 * kiện thì mới nhích ngón đã phóng gấp mấy lần, đó là chỗ "zoom nhạy quá". Hàm
 * mũ làm cú lăn nhỏ ra hệ số nhỏ, và vẫn cho con lăn chuột (mỗi nấc ~100) một
 * bước rõ ràng. Chặn hai đầu để một cú lăn dữ dội không nhảy hết cả thang.
 */
export function zoomFactorFromWheel(deltaY: number) {
  return Math.min(1.5, Math.max(1 / 1.5, Math.exp(-deltaY * 0.0035)));
}

/**
 * Trạng thái phóng của một dải — dùng chung cho bàn dựng và bước Cắt.
 *
 * ══ VÌ SAO CẬN DƯỚI ĐẶT ĐƯỢC RIÊNG ══
 *
 * Bàn dựng chặn ở 60px/giây vì nó để SỬA: dưới mức ấy thì một cụm chữ hai từ
 * co lại còn vài pixel và không bấm trúng.
 *
 * Bước Cắt thì để SOÁT, và ở 60px/giây một video 118 giây trải ra 7080px — nhìn
 * được 19 giây một lúc, tức phải cuộn sáu lượt mới xem hết chỗ máy định bỏ. Đo
 * ở mức mặc định 200px/giây còn tệ hơn: 5,8 giây. Chụp màn ra là thấy ngay cái
 * thước chỉ chạy tới 0:05.5 cho một video dài gần hai phút.
 *
 * Nên cận dưới đặt được riêng, còn BƯỚC phóng và cận trên vẫn dùng chung — hai
 * dải vẫn nhích như nhau khi bấm, chỉ khác chỗ dừng lại.
 */
export function useTimelineZoom(
  initial = DEFAULT_PX_PER_SECOND,
  floor = MIN_PX_PER_SECOND,
) {
  const [pxPerSecond, setPxPerSecond] = useState(
    Math.min(Math.max(initial, floor), MAX_PX_PER_SECOND),
  );

  const zoomBy = useCallback(
    (factor: number) =>
      setPxPerSecond((current) =>
        Math.min(Math.max(current * factor, floor), MAX_PX_PER_SECOND),
      ),
    [floor],
  );
  const resetZoom = useCallback(() => setPxPerSecond(initial), [initial]);

  return {
    pxPerSecond,
    setPxPerSecond,
    zoomBy,
    resetZoom,
    canZoomIn: pxPerSecond < MAX_PX_PER_SECOND - 1,
    canZoomOut: pxPerSecond > floor + 0.5,
  };
}
