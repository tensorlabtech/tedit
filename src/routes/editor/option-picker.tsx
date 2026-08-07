import { cn } from "@/lib/utils";

/** Một lựa chọn: mã + tên. `imageUrl` để sau thay bằng ảnh xem trước. */
export type PickOption = { id: string; label: string; imageUrl?: string };

/**
 * PICKER CHUẨN cho khung "Đang sửa" — mọi thứ chọn được đều là thẻ 9:16, TÊN Ở
 * GIỮA. Đồng bộ một kiểu, và là chỗ SAU NÀY dán ảnh xem trước vào (chỉ cần thêm
 * `imageUrl`).
 *
 * · `row` (mặc định): cuộn NGANG một hàng — dùng khi chỗ chứa thấp.
 * · `grid`: lưới NHIỀU DÒNG — dùng trong modal, nơi có chỗ và danh sách dài.
 */
export function OptionPicker({
  options,
  value,
  onSelect,
  variant = "row",
  size = "sm",
}: {
  options: readonly PickOption[];
  /** Mã đang chọn; `null` là chưa chọn cái nào. */
  value: string | null;
  onSelect: (id: string) => void;
  variant?: "row" | "grid";
  /** Cỡ thẻ cho hàng NGANG: `sm` (mặc định) hay `lg` (to hơn, dễ ngắm). */
  size?: "sm" | "lg";
}) {
  return (
    <div
      className={cn(
        variant === "grid"
          ? "grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3"
          : "flex gap-1.5 overflow-x-auto pb-1",
      )}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          title={option.label}
          onClick={() => onSelect(option.id)}
          className={cn(
            // `outline-none` + focus bằng NỀN nhạt, không bằng viền: viền focus
            // trắng nằm trên thẻ KHÁC thẻ đang chọn đọc ra như chọn hai cái.
            "relative grid aspect-[9/16] shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg p-1 text-center outline-none focus-visible:bg-secondary",
            variant === "grid" ? "w-full" : size === "lg" ? "w-20" : "w-12",
            // Viền vẽ VÀO TRONG (`inset-ring`): viền ngoài (`ring`) bị vùng cuộn
            // `overflow` xén mất một cạnh ở thẻ sát mép — đọc ra như lỗi vẽ.
            value === option.id
              ? "inset-ring-2 inset-ring-primary"
              : "inset-ring-1 inset-ring-border hover:bg-secondary",
          )}
        >
          {option.imageUrl && (
            <img
              src={option.imageUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          )}
          <span
            className={cn(
              "relative line-clamp-3 leading-tight",
              variant === "grid" || size === "lg" ? "text-xs" : "text-[10px]",
            )}
          >
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
}
