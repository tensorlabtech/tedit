import { blocksFromPack, type CaptionBlock } from "./style-pack";
import { STYLE_PACKS } from "./style-pack-catalog";

/**
 * POOL LOOK CHỮ — look chữ của MỌI preset, phẳng và bình đẳng.
 *
 * Cùng lẽ với pool khung (`frame-blocks.ts`): ở màn dựng không có "video thuộc
 * preset nào". Look chữ (font, HOA/thường, màu, glow, hộp...) là một BLOCK độc
 * lập; nhặt cái nào thì nó ĐÓNG DẤU vào cụm (`caption_block`), nên một video trộn
 * được chữ Phấn (nét tay) với chữ Nhịp-đen (đậm đặc) tuỳ từng cụm. Preset chỉ là
 * cái RỔ gom sẵn một bộ look hợp vibe cho AI lúc sinh.
 *
 * Mỗi preset cho MỘT block look chữ (khác pool khung: khung nhân với cấu trúc, còn
 * look chữ là một cục nguyên gói theo preset).
 */
export type CaptionBlockChoice = {
  /** Mã preset gốc — cũng là mã block (mỗi preset một look chữ). */
  id: string;
  /** Nhãn preset ("Phấn", "Nhịp đen") — picker hiện thẳng. */
  presetLabel: string;
  /** Look chữ của preset này — đóng dấu vào cụm khi nhặt. */
  captionLook: CaptionBlock;
};

/** Liệt kê pool = look chữ mỗi preset khai. */
export function captionBlockPool(): CaptionBlockChoice[] {
  return STYLE_PACKS.map((pack) => ({
    id: pack.id,
    presetLabel: pack.label,
    captionLook: blocksFromPack(pack).caption,
  }));
}
