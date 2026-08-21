import { cn } from "@/lib/utils";

import { LayoutDiagram } from "./layout-diagram";

/** Cùng hình với `LayoutOptions` bên máy chủ; khai lỏng để picker khỏi kéo cả kiểu. */
type LayoutOptionsLike = {
  aspect?: string | null;
  fit?: string | null;
  place?: string | null;
  swap?: boolean | null;
};

/**
 * Một lựa chọn: mã + tên. `imageUrl` để sau thay bằng ảnh xem trước.
 *
 * `swatch` = xem trước LOOK THẬT của lựa chọn (nền + viền). Màu là DỮ LIỆU của
 * block (nền kem/viền vàng của Phấn, nền tối của Nhịp đen), nên vẽ thẳng vào thẻ
 * để nhìn PHÂN BIỆT được ngay — không phải style bừa mà là nội dung.
 */
export type PickOption = {
  id: string;
  label: string;
  imageUrl?: string;
  /**
   * Vẽ SƠ ĐỒ Ô của một bố cục thay cho ảnh — xem `LayoutDiagram`.
   *
   * Có nó thì tên tụt xuống thành chú thích ở chân thẻ: người dùng chọn bằng thứ
   * họ NHÌN RA, còn chữ chỉ để gọi tên lại về sau.
   */
  diagram?: { layout: string; options?: LayoutOptionsLike | null };
  swatch?: { bg: string; border?: string | null };
};

/**
 * Màu chữ đọc rõ trên nền swatch — nền sáng (kem) thì chữ tối, nền tối thì chữ
 * sáng. Dùng chung cho thẻ trong picker và thẻ "đang chọn" ở pane.
 */
export function swatchTextColor(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "inherit";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1a1a1a" : "#f5f5f5";
}

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
      // Hàng NGANG (`overflow-x-auto`) là HỘP CUỘN → nó NUỐT lăn DỌC, nên đặt chuột
      // lên picker mà lăn thì bảng "Đang sửa" đứng im. Chuyển lăn dọc lên hộp cuộn
      // DỌC gần nhất (viewport ScrollArea) để cuộn như thường.
      onWheel={
        variant === "row"
          ? (event) => {
              if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
              let el = event.currentTarget.parentElement as HTMLElement | null;
              while (el) {
                const oy = getComputedStyle(el).overflowY;
                if (
                  (oy === "auto" || oy === "scroll") &&
                  el.scrollHeight > el.clientHeight
                ) {
                  el.scrollTop += event.deltaY;
                  event.preventDefault();
                  return;
                }
                el = el.parentElement;
              }
            }
          : undefined
      }
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
          {option.diagram && (
            <LayoutDiagram
              layout={option.diagram.layout}
              options={option.diagram.options}
            />
          )}
          {/* Xem trước look: nền phủ kín + viền vẽ vào trong (gợi mép khung, vd
              viền vàng của Phấn). Đặt DƯỚI chữ nhờ `relative` của span. */}
          {option.swatch && (
            <span
              aria-hidden
              className="absolute inset-0"
              style={{ backgroundColor: option.swatch.bg }}
            />
          )}
          {option.swatch?.border && (
            <span
              aria-hidden
              className="absolute inset-[3px] rounded-md border-2"
              style={{ borderColor: option.swatch.border }}
            />
          )}
          {/* Có SƠ ĐỒ thì tên tụt xuống chân thẻ: đặt giữa như cũ là chữ nằm đè
              lên đúng cái hình mà nó đang mô tả, và cả hai cùng khó đọc. */}
          <span
            className={cn(
              "relative line-clamp-3 leading-tight",
              variant === "grid" || size === "lg" ? "text-xs" : "text-[10px]",
              option.diagram &&
                "absolute inset-x-0 bottom-0 bg-background/75 px-0.5 py-[3px] leading-none",
            )}
            style={
              option.swatch
                ? { color: swatchTextColor(option.swatch.bg) }
                : undefined
            }
          >
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
}
