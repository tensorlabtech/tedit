import { cssColor, type StylePack } from "../../../server/style-pack";
import { graphicUrl } from "./overlay-render";

/**
 * NỀN TRANG ở trang xem — bản sinh đôi của nhánh `pack.page` trong `layoutPlan`.
 *
 * Server dựng nền trang bằng một lớp `color` (màu nền) rồi phủ lưới: lưới là một
 * PNG lấy alpha, tô bằng màu lưới ở độ mờ khai sẵn (`alphamerge`). Twin này làm y
 * hệt bằng CSS — `mask-image` + `background-color` chính là `alphamerge` viết bằng
 * CSS, cùng lối `StyleGraphics`.
 *
 * Đứng DƯỚI mọi lớp khác: nó là cái video-vào-ô để lộ ra quanh mép.
 *
 * Nhận thẳng `page` (không phải cả bộ dáng): nền là look Ô của CHÍNH cảnh tại
 * vạch — mỗi cảnh/b-roll mang nền riêng — nên nơi gọi truyền `frameBlock.page`
 * của cảnh đó, không phải một nền chung.
 */
export function ScenePage({ page }: { page: StylePack["page"] }) {
  if (!page) return null;
  const gridUrl = page.grid ? graphicUrl(page.grid.id) : undefined;
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{ background: cssColor(page.tone) }}
    >
      {page.grid && gridUrl && (
        <div
          className="absolute inset-0"
          style={{
            maskImage: `url(${gridUrl})`,
            WebkitMaskImage: `url(${gridUrl})`,
            maskSize: "100% 100%",
            WebkitMaskSize: "100% 100%",
            backgroundColor: page.grid.tone.color,
            opacity: page.grid.tone.alpha,
          }}
        />
      )}
    </div>
  );
}
