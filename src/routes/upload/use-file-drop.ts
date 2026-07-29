import { useRef, useState } from "react";

/**
 * Nhận tệp kéo từ ngoài trình duyệt vào một thẻ.
 *
 * Dùng chung cho mọi thẻ nhận tệp: mỗi thẻ tự chép lại phần này thì cái đếm
 * chiều sâu — thứ khó nhất ở đây — bị chép sai ở đúng một chỗ và thẻ đó sáng
 * mãi không tắt.
 */
export function useFileDrop(onFiles: (files: File[]) => void) {
  /**
   * `dragenter`/`dragleave` bắn cho TỪNG phần tử con, nên rê qua một ô bên trong
   * là thẻ nhận ngay một `dragleave` dù con trỏ vẫn còn trong thẻ. Đếm vào ra
   * mới biết lúc nào là rời thật.
   */
  const depth = useRef(0);
  const [over, setOver] = useState(false);

  const dropProps = {
    onDragEnter: (event: React.DragEvent) => {
      // Chỉ sáng khi thứ đang kéo là TỆP từ ngoài vào; kéo một ô trong dải để
      // đổi thứ tự cũng bắn `dragenter` và làm cả thẻ nhấp nháy theo.
      if (!Array.from(event.dataTransfer?.types ?? []).includes("Files")) return;
      event.preventDefault();
      depth.current += 1;
      setOver(true);
    },
    onDragOver: (event: React.DragEvent) => {
      if (over) event.preventDefault();
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setOver(false);
    },
    onDrop: (event: React.DragEvent) => {
      if (!over) return;
      event.preventDefault();
      depth.current = 0;
      setOver(false);
      const dropped = Array.from(event.dataTransfer?.files ?? []);
      if (dropped.length > 0) onFiles(dropped);
    },
  };

  return { over, dropProps };
}
