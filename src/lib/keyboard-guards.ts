/**
 * Những chỗ ƯU TIÊN HƠN phím tắt toàn cục — phím tắt phải NHƯỜNG.
 *
 * Gom về một nơi để mọi handler (bàn dựng, cắt, xem trước mạch) cùng một luật:
 * đang gõ chữ, đang mở bảng nổi, hay đang cầm một ô kéo-thả thì phím là của chỗ
 * đó, không phải của phím tắt màn.
 */

/** Con trỏ đang ở ô gõ chữ — mọi phím tắt phải nhường. */
export function isTypingIn(target: EventTarget | null) {
  const node = target instanceof HTMLElement ? target : null;
  if (!node) return false;
  if (node.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName);
}

/**
 * Có bảng nổi nào đang mở không.
 *
 * Menu và hộp thoại có luật phím riêng (dấu cách chọn mục, Escape đóng bảng).
 * Cướp phím của chúng thì bảng chọn "Chỗ nối" bấm dấu cách không chọn được gì.
 */
export function isMenuOpen() {
  return Boolean(
    document.querySelector(
      '[role="menu"],[role="listbox"],[role="dialog"],[role="alertdialog"]',
    ),
  );
}

/**
 * Đang cầm một ô KÉO-THẢ (dnd-kit) không.
 *
 * dnd-kit dùng phím Cách để NHẤC rồi THẢ ô đang focus (sắp lại thứ tự cảnh). Lúc
 * ấy Cách là của cử chỉ kéo, không phải của nút phát. dnd-kit gắn
 * `aria-roledescription="sortable"` lên tay cầm kéo — bám dấu đó để nhường đúng
 * lúc, còn ngoài ra thì Cách vẫn là phát/dừng.
 */
export function isDragHandle(target: EventTarget | null) {
  const node = target instanceof HTMLElement ? target : null;
  return Boolean(node?.closest('[aria-roledescription="sortable"]'));
}
