import { useEffect, useRef } from "react";

import { isDragHandle, isMenuOpen, isTypingIn } from "@/lib/keyboard-guards";

/**
 * Phím CÁCH = phát/dừng, và CHỈ phát/dừng — cho MỌI màn có nút phát.
 *
 * Vì sao một hook riêng dùng lại khắp nơi: mỗi màn tự viết một handler thì mỗi
 * chỗ nhớ thiếu một mẩu — chỗ quên nuốt `keyup` để nút HTML tự bấm lại, chỗ quên
 * `stopPropagation` nên bấm một nút xong gõ Cách là bấm lại chính nút đó thay vì
 * phát. Gom vào đây thì mọi màn cùng một hành vi, sửa một nơi.
 *
 * ── VÌ SAO CAPTURE + NUỐT CẢ keyup ──
 *
 * Nút HTML kích hoạt lúc NHẢ phím Cách, mà lúc ấy nút vừa bấm vẫn giữ focus — chỉ
 * `preventDefault` ở keydown thì nút vẫn tự bấm lại ở keyup. Nghe ở pha CHỤP và
 * nuốt luôn keyup để chặn cả hai nửa.
 *
 * ── NHƯỜNG CHỖ ƯU TIÊN CAO HƠN ──
 *
 * Đang gõ trong ô chữ, đang mở menu/hộp thoại, hay đang cầm một ô kéo-thả thì
 * Cách là của chỗ đó. Nhường bằng cách trả về SỚM và KHÔNG stopPropagation — để
 * sự kiện chảy tiếp tới đúng nơi xử nó. Cmd/Ctrl/Alt+Cách cũng nhường: đó là phím
 * của hệ điều hành (Spotlight, gõ tắt), không phải của bàn dựng.
 */
export function useSpacePlayPause(onTogglePlay: () => void) {
  const toggleRef = useRef(onTogglePlay);
  toggleRef.current = onTogglePlay;

  useEffect(() => {
    const yielded = (event: KeyboardEvent) =>
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      isTypingIn(event.target) ||
      isMenuOpen() ||
      isDragHandle(event.target);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== " " || yielded(event)) return;
      event.preventDefault();
      event.stopPropagation();
      toggleRef.current();
    };
    // Nút HTML tự bấm ở lúc NHẢ Cách — chặn một nửa thì nút vẫn kích hoạt.
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== " " || yielded(event)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, []);
}
