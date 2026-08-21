import { layoutWithOptions, slotPixels } from "../../../server/layout-kinds";

/**
 * Hình LỎNG của `LayoutOptions` — nhận cả giá trị đến từ máy chủ (nơi `aspect` là
 * chuỗi tự do trong JSON đã lưu) mà không phải ép kiểu ở mọi chỗ gọi. `layoutWithOptions`
 * tự bỏ qua giá trị lạ, nên lỏng ở đây không mở đường cho hình sai.
 */
type LayoutOptionsLike = {
  aspect?: string | null;
  fit?: string | null;
  place?: string | null;
  swap?: boolean | null;
};

/**
 * SƠ ĐỒ MỘT BỐ CỤC — vẽ đúng những ô mà bố cục ấy sẽ dựng ra.
 *
 * ## Vì sao vẽ chứ không dán ảnh
 *
 * Người dùng không đoán nổi `vuong-ngang` hay `o-lech` là hình gì; đó là tên của
 * hệ thống, không phải của họ. Cách chữa rẻ nhất là bỏ chữ đi và cho họ NHÌN.
 *
 * Nhưng ảnh chụp thật thì phải sinh, phải lưu, phải sinh lại mỗi lần bố cục đổi —
 * và tệ nhất là nó SẼ LỆCH với bố cục thật mà không ai biết. Vẽ thẳng từ
 * `slotPixels` thì sơ đồ không thể lệch được: nó gọi đúng cái hàm mà bản dựng gọi.
 * Đổi số đo trong `layout-kinds` là sơ đồ đổi theo ngay lượt vẽ sau.
 *
 * ## Vì sao nhận cả `options`
 *
 * Tuỳ chọn khung (tỉ lệ ô, đảo trên dưới) đổi hẳn hình dạng. Sơ đồ phải phản ánh
 * lựa chọn ĐANG có, không thì người dùng đổi ô sang vuông mà ảnh vẫn vẽ ô dọc.
 */
export function LayoutDiagram({
  layout,
  options,
  sourceAspect = 9 / 16,
}: {
  layout: string;
  options?: LayoutOptionsLike | null;
  /** Tỉ lệ nguồn — ô "theo tư liệu" bám số này, mặc định là khổ dọc. */
  sourceAspect?: number;
}) {
  // Khổ quy ước 9:16; mọi số đo quy về phần trăm nên thẻ chứa to nhỏ gì cũng đúng.
  const W = 90;
  const H = 160;
  const spec = layoutWithOptions(
    layout,
    options as Parameters<typeof layoutWithOptions>[1],
  );
  return (
    <span aria-hidden className="absolute inset-0 block">
      {spec.slots.map((slot, index) => {
        const rect = slotPixels(slot, W, H, sourceAspect);
        return (
          <span
            key={`${slot.role}-${index}`}
            className={
              // Ô NGƯỜI đặc, ô TƯ LIỆU kẻ viền: hai vai phải phân biệt được ngay
              // trong một hình bé bằng đầu ngón tay, mà chữ thì không nhét vào đó
              // được. Đặc/rỗng đọc nhanh hơn mọi khác biệt màu ở cỡ này.
              slot.role === "chinh"
                ? "absolute rounded-[2px] bg-foreground/45"
                : "absolute rounded-[2px] border border-foreground/60 bg-foreground/15"
            }
            style={{
              left: `${(rect.x / W) * 100}%`,
              top: `${(rect.y / H) * 100}%`,
              width: `${(rect.w / W) * 100}%`,
              height: `${(rect.h / H) * 100}%`,
            }}
          />
        );
      })}
    </span>
  );
}
