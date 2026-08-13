import { PICKABLE_LAYOUTS } from "./layout-kinds";
import { blocksFromPack, type FrameBlock } from "./style-pack";
import { STYLE_PACKS } from "./style-pack-catalog";

/**
 * POOL KHUNG — mọi khung của MỌI preset, phẳng và bình đẳng.
 *
 * Ở màn dựng KHÔNG còn khái niệm "video thuộc preset nào": khung là một BLOCK độc
 * lập (cấu trúc + look ô đi kèm), người dùng nhặt cái nào cũng được. Preset chỉ là
 * cái RỔ để gom sẵn — mỗi preset khai `layouts` của nó, và look ô (`frameLook`) là
 * của preset ấy. "Phấn · 2-ô" và "Nhịp đen · 2-ô" là HAI block: cùng cấu trúc,
 * khác look. Nhặt block nào thì look của nó ĐÓNG DẤU vào cảnh (`frame_block`), nên
 * một video trộn được khung Phấn nền vàng với khung Nhịp-đen nền đen.
 */
export type FrameBlockChoice = {
  /** `presetId:layoutId` — duy nhất trong pool. */
  id: string;
  /** Mã preset gốc — để picker nhóm/prefix. */
  presetId: string;
  /** Nhãn preset ("Phấn", "Nhịp đen") — picker ghép trước tên khung. */
  presetLabel: string;
  /** Mã cấu trúc khung. */
  layout: string;
  /** Look ô của khung này (nền/viền/dồn/doodle) — đóng dấu vào cảnh khi nhặt. */
  frameLook: FrameBlock;
};

/**
 * Liệt kê pool = hợp các khung MỌI preset khai. Trừ `trang-chu` (khung KHÔNG
 * video, chỉ chữ). GIỮ `toan-khung`: dù `PICKABLE_LAYOUTS` (dùng cho scheduler)
 * loại nó, người dùng VẪN cần chọn "toàn khung người" cho một cảnh (đưa b-roll về
 * người), và picker cần nó để TÔ SÁNG đúng khung đang dùng khi cảnh là toàn-khung.
 */
export function frameBlockPool(): FrameBlockChoice[] {
  const out: FrameBlockChoice[] = [];
  for (const pack of STYLE_PACKS) {
    const frameLook = blocksFromPack(pack).frame;
    for (const layout of pack.layouts) {
      // Cho toan-khung qua (picker cần), nhưng vẫn theo `PICKABLE_LAYOUTS` cho các
      // khung còn lại — nên trang-chu và mọi ca đặc biệt khác vẫn bị loại.
      if (layout !== "toan-khung" && !PICKABLE_LAYOUTS.includes(layout)) continue;
      out.push({
        id: `${pack.id}:${layout}`,
        presetId: pack.id,
        presetLabel: pack.label,
        layout,
        frameLook,
      });
    }
  }
  // KHUNG MỜ — dùng CHUNG (như Toàn khung): người phủ kín + defocus, nền che nên
  // không phụ thuộc preset. `insetCard: null` (không thẻ), `blur: true`. Chọn nó =
  // đóng dấu cảnh thành "người mờ, chữ nổi".
  out.push({
    id: "chung:khung-mo",
    presetId: "chung",
    presetLabel: "Chung",
    layout: "toan-khung",
    frameLook: { ...blocksFromPack(STYLE_PACKS[0]).frame, insetCard: null, blur: true },
  });
  return out;
}
