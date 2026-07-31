import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";

import type { PickerItem } from "@/components/media-picker-item";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format-duration";

/**
 * Xem to tệp đang chọn, dựng theo đúng khung 9:16 của video thành phẩm.
 *
 * Không dùng `controls` của trình duyệt: thanh đó không style được bằng CSS, mỗi
 * trình duyệt vẽ một kiểu, và nó đen sì giữa một bảng sáng. Thay bằng đúng bộ
 * điều khiển của khung xem trước bên bàn dựng — cùng một sản phẩm thì cùng một
 * cách bấm phát.
 *
 * Nút phát là `button` thật nên vẫn tới được bằng Tab và bấm bằng dấu cách —
 * phần bàn phím mà `controls` vốn cho không.
 */
export function MediaPickerPreview({ item }: { item: PickerItem | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);

  // Đổi tệp thì trả về đầu: giữ nguyên trạng thái đang phát của tệp trước sẽ
  // thành bấm một cái là xem tiếp từ giữa một clip khác.
  useEffect(() => {
    setPlaying(false);
    setTime(0);
  }, [item?.key]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (playing) void element.play().catch(() => setPlaying(false));
    else element.pause();
  }, [playing]);

  // Chỗ này để TRỐNG chứ không xoá đi: xoá thì lưới giãn ra chiếm cả cột phải,
  // chọn một tệp lại co lại — cả bảng nhảy một cái.
  if (!item) {
    return (
      <div className="grid aspect-[9/16] place-items-center rounded-lg bg-muted/50 p-3 text-center text-xs text-muted-foreground">
        Bấm một tệp để xem trước
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-black">
        {item.isVideo ? (
          <video
            key={item.key}
            ref={videoRef}
            src={item.previewUrl}
            // `object-contain`: tư liệu quay ngang mà cắt cho vừa khung dọc thì
            // khung xem trước nói dối — lúc chèn nó nằm gọn trong khung, không
            // bị cắt như thế này.
            className="size-full object-contain"
            muted
            playsInline
            onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
            onEnded={() => setPlaying(false)}
          />
        ) : (
          <img
            key={item.key}
            src={item.previewUrl}
            alt=""
            className="size-full object-contain"
          />
        )}

        {item.isVideo && (
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8">
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label={playing ? "Tạm dừng" : "Xem thử"}
              onClick={() => setPlaying((on) => !on)}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </Button>
            {/* Trắng cứng chứ không `text-foreground`: nền là hình của người
                dùng, không phải nền giao diện. */}
            <span className="text-xs text-white tabular-nums">
              {formatDuration(time)} / {formatDuration(item.seconds)}
            </span>
          </div>
        )}
      </div>

      {/* Tên đầy đủ chỉ có MỘT chỗ trên cả bảng — ở đây. Trong lưới thì mỗi ô một
          dòng tên là hai chục chuỗi vô nghĩa cùng lúc. */}
      <div className="min-w-0">
        <p className="truncate text-sm" title={item.name}>
          {item.name}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {[
            item.isVideo && item.seconds ? formatDuration(item.seconds) : null,
            item.width && item.height ? `${item.width}×${item.height}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}
