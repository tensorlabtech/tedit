import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckIcon, FilmIcon, ImageIcon, StarIcon } from "lucide-react";

import { MediaThumb } from "@/components/media-thumb";
import { Badge } from "@/components/ui/badge";
import type { PickerItem } from "@/components/media-picker-item";
import { formatDuration } from "@/lib/format-duration";
import { cn } from "@/lib/utils";

/**
 * Một ô trong lưới của hộp chọn tư liệu.
 *
 * Ô theo khung 9:16 vì video thành phẩm là 9:16, và ảnh thu nhỏ máy chủ dựng ra
 * cũng vậy. Cùng một khung cho CẢ HAI TAB dù tệp trong kho hay xem ở tỉ lệ gốc:
 * hai tab đứng cạnh nhau trong một hộp, mà ô lệch khuôn thì mỗi lần đổi tab là cả
 * lưới nhảy một nhịp.
 *
 * Tên nằm trong DẢI MỜ đè lên đáy ảnh. Ô từng không in tên, với lý do "tên tệp do
 * máy ảnh đặt thì không phân biệt được gì" — nhưng đo trên kho thật thì lý do ấy
 * không đứng: ba trong bảy clip là "hai bàn tay trên bàn phím", ảnh nào cũng như
 * ảnh nào, và cách duy nhất phân biệt là đọc "Gõ bàn phím cận cảnh" với "Ngồi bàn
 * làm việc gõ phím". Cột xem trước chỉ trả lời được cho MỘT ô mỗi lần bấm, nên nó
 * dùng để xác nhận, không dùng để quét cả lưới.
 *
 * Đè lên ảnh chứ không thành dòng riêng bên dưới: dòng riêng thì mỗi ô cao thêm và
 * lưới mất gần một hàng, còn đáy ảnh vốn là phần ít nội dung nhất.
 */
export function MediaPickerTile({
  item,
  active,
  onSelect,
  disabled = false,
  onUseNow,
}: {
  item: PickerItem;
  active: boolean;
  onSelect: () => void;
  /** Đã nằm trong dự án — bấm nữa chỉ đẻ ra bản sao. */
  disabled?: boolean;
  /** Bấm đúp — làm luôn việc chính, khỏi đi thêm một vòng xuống nút ở chân */
  onUseNow?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            onClick={onSelect}
            onDoubleClick={onUseNow}
            aria-pressed={active}
            className="group/tile relative aspect-[9/16] w-full cursor-pointer overflow-hidden rounded-lg bg-muted text-left disabled:cursor-default disabled:opacity-45"
          />
        }
      >
      {item.thumbUrl ? (
        <MediaThumb
          src={item.thumbUrl}
          kind={item.thumbKind}
          alt=""
          // Không chạy khi rê chuột: lưới này có hàng chục ô, mà cột xem trước
          // bên phải đã cho xem thật rồi.
          playOnHover={false}
        />
      ) : (
        <span className="grid size-full place-items-center text-muted-foreground">
          <FilmIcon className="size-5" />
        </span>
      )}

      {/* Viền là một LỚP PHỦ, không phải viền của chính cái nút.
          · Viền ngoài (`ring-*`) bị vùng cuộn gọt mất một cạnh khi ô nằm sát mép.
          · Viền trong (`inset-ring`) thì bị chính tấm ảnh đè lên — `box-shadow:
            inset` vẽ DƯỚI nội dung, mà ảnh phủ kín ô.
          Một lớp phủ tuyệt đối nằm sau ảnh trong thứ tự vẽ nên hiện lên trên nó,
          mà vẫn nằm gọn trong hộp của ô nên không ai cắt được. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] border transition-colors",
          active ? "border-2 border-primary" : "border-border/60",
        )}
      />

      {/* Dấu tích: trên một tấm ảnh nhiều chi tiết, một đường viền 2px vẫn có thể
          lẫn vào cảnh. Dấu tích thì không lẫn vào đâu được. */}
      {active && (
        <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon className="size-3" />
        </span>
      )}

      <span className="absolute top-1 left-1 flex items-center gap-1">
        <span className="grid size-5 place-items-center rounded bg-black/55 text-white">
          {item.isVideo ? (
            <FilmIcon className="size-3" />
          ) : (
            <ImageIcon className="size-3" />
          )}
        </span>
        {item.starred && (
          <span className="grid size-5 place-items-center rounded bg-black/55 text-white">
            <StarIcon className="size-3 fill-current" />
          </span>
        )}
      </span>

      {/* "Đã có" chỉ NHẮC, không chặn: một cảnh dùng hai lần trong cùng video là
          chuyện bình thường. Còn "chưa mô tả" có hậu quả thật — chặng tự ghép bỏ
          qua hẳn tệp ấy — nên nó mang màu cảnh báo. */}
      {/* Nhường chỗ cho dấu tích khi ô đang được chọn: lời nhắc "đã có" có ích
          NHẤT ở lúc chưa chọn, còn khi đã chọn rồi thì người dùng vừa đọc nó xong. */}
      {item.note && !active && (
        <Badge
          variant={item.note === "already" ? "secondary" : "destructive"}
          className="absolute top-1 right-1"
        >
          {item.note === "already" ? "đã có" : "chưa mô tả"}
        </Badge>
      )}

      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-1 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-6 pb-1">
        <span className="min-w-0 flex-1 text-[11px] leading-tight text-white line-clamp-2">
          {item.name}
        </span>
        {item.seconds > 0 && (
          <span className="shrink-0 text-[11px] text-white/80 tabular-nums">
            {formatDuration(item.seconds)}
          </span>
        )}
      </span>
      </TooltipTrigger>
      <TooltipContent>{item.name}</TooltipContent>
    </Tooltip>
  );
}
