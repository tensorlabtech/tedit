import { useState } from "react";
import { ImageOffIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * ẢNH ĐẠI DIỆN của một tư liệu — ảnh thì hiện ảnh, video thì hiện khung đầu và
 * rê vào là chạy thử.
 *
 * Gom lại vì ba chỗ đang tự dựng cùng một thứ: ô trong kho tư liệu, lưới chọn từ
 * kho ở bàn dựng, và ô tư liệu trong bảng chèn. Mỗi chỗ nhớ một phần — nơi này có
 * đường lùi cho ảnh hỏng, nơi kia không; nơi này rê vào chạy, nơi kia đứng im.
 * Người dùng đi qua ba màn thì gặp ba hành vi khác nhau cho cùng một tấm hình.
 *
 * KHÔNG phải trình phát. Xem thật thì dùng thẻ `<video controls>` của trình duyệt
 * — nó cho sẵn bàn phím, toàn màn hình, hình-trong-hình, và tốc độ phát, những
 * thứ mà tự dựng lại sẽ mất cả tuần để làm cho đúng.
 */
export function MediaThumb({
  src,
  kind,
  alt = "",
  className,
  /** Rê chuột vào thì chạy thử. Tắt ở chỗ có hàng chục ô cùng lúc. */
  playOnHover = true,
}: {
  src: string;
  kind: "image" | "video";
  alt?: string;
  className?: string;
  playOnHover?: boolean;
}) {
  const [hong, setHong] = useState(false);

  // Tệp hỏng thì nói RA. Để trình duyệt vẽ biểu tượng vỡ mặc định thì nó chồng
  // lên chữ `alt` và đọc ra như lỗi dựng trang, chứ không như "tệp này hỏng".
  if (hong) {
    return (
      <div
        className={cn(
          "grid size-full place-items-center bg-muted text-muted-foreground",
          className,
        )}
        title="Không mở được tệp này"
      >
        <ImageOffIcon className="size-5" />
      </div>
    );
  }

  if (kind === "image") {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn("size-full object-cover", className)}
        onError={() => setHong(true)}
      />
    );
  }

  return (
    <video
      src={src}
      muted
      playsInline
      preload="metadata"
      className={cn("size-full object-cover", className)}
      onError={() => setHong(true)}
      // Rê vào là chạy: một khung tĩnh của video quay tay thường là cảnh mờ lúc
      // máy còn đang lấy nét — nó không nói được clip quay gì.
      onMouseEnter={
        playOnHover
          ? (event) => {
              void event.currentTarget.play().catch(() => {});
            }
          : undefined
      }
      onMouseLeave={
        playOnHover
          ? (event) => {
              event.currentTarget.pause();
              event.currentTarget.currentTime = 0;
            }
          : undefined
      }
    />
  );
}
