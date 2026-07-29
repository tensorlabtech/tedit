import { useEffect } from "react";

/**
 * Hai hàng rào giữ việc đang dở khỏi mất trắng vì một thao tác lỡ tay.
 *
 * Tách riêng khỏi `use-upload` vì chúng không đụng tới trạng thái nào của màn:
 * chỉ nghe ở cấp cửa sổ và chặn hành vi mặc định của trình duyệt.
 */
export function useWorkInProgressGuards(uploading: boolean) {
  /**
   * Đóng tab giữa chừng thì tệp đang tải mất trắng và dự án còn lại một nửa.
   * Trình duyệt chỉ cho chặn khi thật sự có việc dở, nên chỉ gắn lúc đang tải.
   */
  useEffect(() => {
    if (!uploading) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  /**
   * Thả tệp trượt ra ngoài vùng nhận thì trình duyệt tự mở tệp đó và rời trang,
   * mất sạch những gì đang tải. Vùng nhận thật đã `preventDefault` trước khi sự
   * kiện nổi lên tới đây nên hàng rào này không cướp mất thao tác hợp lệ nào.
   */
  useEffect(() => {
    const swallow = (event: DragEvent) => event.preventDefault();
    window.addEventListener("dragover", swallow);
    window.addEventListener("drop", swallow);
    return () => {
      window.removeEventListener("dragover", swallow);
      window.removeEventListener("drop", swallow);
    };
  }, []);
}
