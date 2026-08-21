import { useEffect, useRef } from "react";

import { isDragHandle, isMenuOpen, isTypingIn } from "@/lib/keyboard-guards";

/**
 * Phím tắt của BÀN DỰNG — hiện chỉ Hoàn tác (⌘Z / Ctrl+Z).
 *
 * Tách hook riêng thay vì nhét vào một màn: cùng lý do với `useSpacePlayPause` —
 * mỗi chỗ tự viết handler là mỗi chỗ quên một mẩu (nhường ô nhập, nhường menu,
 * chặn phím mặc định của trình duyệt).
 *
 * ── NHƯỜNG CHỖ ƯU TIÊN CAO HƠN ──
 *
 * Đang gõ trong ô chữ thì ⌘Z là "lùi chữ vừa gõ", không phải "lùi thao tác dựng"
 * — cướp nó thì người dùng gõ nhầm một chữ mà mất luôn cả lần cắt trước đó. Đang
 * mở menu/hộp thoại hay đang cầm một ô kéo-thả cũng nhường, đúng cùng luật.
 *
 * ── VÌ SAO KHÔNG LÀM REDO ──
 *
 * `useUndoStack` giữ 50 bước lùi nhưng không có chiều tiến, nên ⇧⌘Z chưa có gì để
 * gọi. Bày một phím tắt không làm gì còn tệ hơn không có phím tắt: người dùng bấm,
 * không thấy phản ứng, và kết luận cả bàn phím không ăn.
 */
export function useEditorHotkeys({ onUndo }: { onUndo?: () => void }) {
  const undoRef = useRef(onUndo);
  undoRef.current = onUndo;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.key.toLowerCase() !== "z" || event.shiftKey) return;
      if (isTypingIn(event.target) || isMenuOpen() || isDragHandle(event.target))
        return;
      if (!undoRef.current) return;
      event.preventDefault();
      undoRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/**
 * Ký hiệu phím tắt hợp với máy đang dùng — `⌘Z` trên Mac, `Ctrl+Z` chỗ khác.
 *
 * Ghi phím tắt vào chính nhãn nút là cách duy nhất để người ta biết nó tồn tại;
 * còn ghi sai hệ điều hành thì đọc ra là app làm ẩu.
 */
export const modKey = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘"
    : "Ctrl+";
