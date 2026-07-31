import type { AlignId, EmphasisId } from "./overlay-model";

/**
 * Đổi giá trị `layout` gộp kiểu cũ sang HAI trục.
 *
 * Bảng này phải giống `fromLegacyLayout` của `server/text-layout.ts`: cùng một
 * phần tử mà giao diện đổi ra một dáng, bản in ra đổi ra dáng khác thì còn tệ hơn
 * là không đổi. Hai bản riêng vì client không nhập được mã máy chủ — nên chỗ nào
 * sửa thì phải sửa cả hai, và đó là lý do bảng để ngắn.
 */
export function fromLegacyLayout(value: string | null | undefined): {
  align: AlignId;
  emphasis: EmphasisId;
} {
  switch (value) {
    case "center":
      return { align: "center", emphasis: "even" };
    case "right":
    case "lech-tam":
      return { align: "right", emphasis: "even" };
    case "stair-right":
    case "stair-left":
    case "stair":
      return { align: "stair", emphasis: "even" };
    case "split":
    case "so-le":
      return { align: "stagger", emphasis: "even" };
    case "mot-tieng-khong-lo":
      return { align: "left", emphasis: "keyword-large" };
    case "xen-co":
      return { align: "left", emphasis: "mixed-size" };
    case "duoi-len":
      return { align: "left", emphasis: "taper" };
    case "left":
      return { align: "left", emphasis: "even" };
    // `flush` và mọi giá trị lạ: căn giữa, cỡ đều — đúng thứ bản in ra vẫn làm.
    default:
      return { align: "center", emphasis: "even" };
  }
}
