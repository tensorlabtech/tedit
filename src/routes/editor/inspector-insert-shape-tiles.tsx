import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { SHAPES, type ShapeId } from "@/dev/overlays/overlay-model";
import { cn } from "@/lib/utils";

/**
 * Chọn HÌNH DÁNG KHUNG tư liệu bằng cách nhìn.
 *
 * Bản trước là bốn nút chữ kèm một câu tả:
 *
 *   “Đè kín” phủ toàn khung; ba dáng còn lại là một hộp thụt 8% mỗi bên,
 *   đặt ở 13% chiều cao
 *
 * Câu đó đang đọc ra một BỨC TRANH bằng lời, và còn bắt người dùng nhớ ba con
 * số. Vẽ ra thì cả câu biến mất — mỗi ô là một khung 9:16 với đúng cái hộp sẽ
 * hiện ra, đặt đúng chỗ nó sẽ nằm.
 *
 * Hình học lấy từ `OverlayRender`: `full` phủ kín khung, ba dáng còn lại là hộp
 * `inset-x-[8%] top-[13%]` theo đúng tỉ lệ của dáng.
 *
 * CÓ tooltip, khác với hàng "Chỗ đặt" hay "Căn ngang". Luật của dự án phân biệt
 * rõ: thứ bấm được mà CHỈ CÓ HÌNH thì cần tooltip, còn thứ đã có chữ nằm cạnh
 * icon thì thêm tooltip chỉ là bày một hộp đen che mất hàng nút. Bốn ô này thuần
 * hình — không tên thì không gọi ra thành lời được.
 */
export function InsertShapeTiles({
  value,
  onChange,
}: {
  value: ShapeId;
  onChange: (next: ShapeId) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {SHAPES.map((shape) => {
        const active = shape.id === value;
        return (
          <Tooltip key={shape.id}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={shape.label}
                  aria-pressed={active}
                  onClick={() => onChange(shape.id)}
                  className={cn(
                    // Nền tối cố định: hộp tư liệu vẽ bằng màu sáng, mà nền xám
                    // nhạt của thẻ thì hộp sáng chìm mất.
                    "relative aspect-[9/16] overflow-hidden rounded-lg bg-neutral-800",
                    // Viền vẽ VÀO TRONG — ô sát mép vùng cuộn thì viền ngoài bị
                    // gọt mất một cạnh.
                    active
                      ? "inset-ring-2 inset-ring-primary"
                      : "hover:inset-ring-2 hover:inset-ring-primary/40",
                  )}
                />
              }
            >
              {shape.id === "full" ? (
                <span className="absolute inset-0 bg-white/80" />
              ) : (
                <span
                  className="absolute inset-x-[8%] top-[13%] block bg-white/80"
                  style={{ aspectRatio: shape.ratio }}
                />
              )}
            </TooltipTrigger>
            <TooltipContent>{shape.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
