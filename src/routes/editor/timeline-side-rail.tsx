import { MinusIcon, PlusIcon, Undo2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ZOOM_STEP, type EditorState } from "./use-editor";

/**
 * Ba nút đứng CẠNH dải: hoàn tác ở trên, phóng to/thu nhỏ ở dưới.
 *
 * Chúng từng nằm trong một hàng ngang phía trên dải, cùng với bốn nút thêm-một-
 * thứ. Bốn nút kia đã về gắn vào vạch chạy (xem `TimelinePlayheadButtons`), nên
 * hàng ấy chỉ còn ba nút mà vẫn ăn trọn 40px BỀ CAO của thẻ dải — thứ đang thiếu,
 * vì khung xem ở trên chia nhau đúng chỗ đó.
 *
 * Cột dọc lấy ~40px BỀ NGANG, thứ thẻ dải đang thừa, và không lấy một pixel bề
 * cao nào.
 *
 * Nút NỀN ĐẶC chứ không phải nút chìm: đứng một mình ở mép thẻ, không có hàng
 * nào quanh để đọc ra là "chỗ có nút", nên nút chìm 32px trông như một cái bóng.
 * Hai nút phóng dính nhau thành một cặp, hoàn tác tách ra trên đầu — chúng là
 * hai loại việc khác nhau.
 *
 * Không có ô đọc "200 px/giây" nữa — nó nằm trong tooltip của chính hai nút
 * phóng. Cũng không có "0:00 / 1:13": khung xem đã in sẵn ở góc dưới bên trái,
 * hai chỗ cùng nói một câu thì một chỗ là thừa.
 */
export function TimelineSideRail({ editor }: { editor: EditorState }) {
  return (
    <div className="flex shrink-0 flex-col justify-between py-1">
      <Button
        variant="secondary"
        size="icon"
        tooltipSide="left"
        disabled={!editor.undoLabel}
        // Nhãn đầy đủ nằm trong tooltip. Ở hàng ngang nó là chữ hiện sẵn, rộng
        // tới 231px và ĐỔI mỗi lần người dùng làm gì — nên cả thanh xô sang một
        // cái sau từng thao tác. Vào tooltip thì vẫn đọc được mà không xô gì.
        aria-label={
          editor.undoLabel ? `Hoàn tác: ${editor.undoLabel}` : "Chưa có gì để lùi"
        }
        onClick={() => void editor.undo()}
      >
        <Undo2Icon />
      </Button>
      <div className="flex flex-col gap-1">
        <Button
          variant="secondary"
          size="icon"
          tooltipSide="left"
          disabled={!editor.canZoomIn}
          aria-label={`Phóng to dải (${Math.round(editor.pxPerSecond)} px/giây)`}
          onClick={() => editor.zoomBy(ZOOM_STEP)}
        >
          <PlusIcon />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          tooltipSide="left"
          disabled={!editor.canZoomOut}
          aria-label={`Thu nhỏ dải (${Math.round(editor.pxPerSecond)} px/giây)`}
          onClick={() => editor.zoomBy(-ZOOM_STEP)}
        >
          <MinusIcon />
        </Button>
      </div>
    </div>
  );
}
