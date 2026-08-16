import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * KHUNG XEM DÙNG CHUNG — video dọc, nút phát CHỒNG lên khung.
 *
 * Mọi bước có khung xem (Cắt, Soát lời, …) dùng chung đây, để nút phát, nền
 * chuyển mờ, tỉ lệ và đệm khung đều MỘT kiểu — sửa một chỗ là cả luồng theo. Phần
 * chữ bên phải nút phát (đồng hồ, tóm tắt, lời nhắc) truyền vào qua `children`.
 *
 * Đệm thẻ rút còn nhỏ để video lấp gần kín — nó là nội dung chính của thẻ. Video
 * là DỌC 9:16, khống chế theo CHIỀU CAO (lấp trọn chiều cao khung); bước nào đặt
 * nó trong cột hẹp thì cột phải đủ rộng cho bề ngang, không thì `max-w-full` xén.
 */
export function FlowPreview({
  videoRef,
  src,
  playing,
  onToggle,
  onPlay,
  onPause,
  playLabel = "Phát",
  children,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** `null` khi máy chưa ghép xong bản xem trước. */
  src: string | null;
  playing: boolean;
  onToggle: () => void;
  onPlay: () => void;
  onPause: () => void;
  /** Nhãn nút phát lúc đang dừng — mỗi bước một việc ("Phát bản đã cắt"…). */
  playLabel?: string;
  /** Chữ bên phải nút phát trên dải điều khiển. */
  children?: ReactNode;
}) {
  // `src` 404 hay hỏng khung hình thì `<video>` không tự báo gì lên UI — khung
  // đứng im, trông như treo. Bắt `onError` và rơi về ĐÚNG thông báo của nhánh
  // `src == null`, chỉ đổi câu chữ cho đúng lý do.
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <Card className="lg:min-h-0 [--card-spacing:--spacing(2)]">
      <CardContent className="grid min-h-0 flex-1 place-items-center overflow-hidden">
        {src && !failed ? (
          <div className="relative mx-auto aspect-[9/16] h-full max-w-full overflow-hidden rounded-lg">
            <video
              ref={videoRef}
              src={src}
              className="h-full w-full object-cover"
              onPlay={onPlay}
              onPause={onPause}
              onClick={onToggle}
              onError={() => setFailed(true)}
            />
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8">
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label={playing ? "Tạm dừng" : playLabel}
                onClick={onToggle}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </Button>
              {children}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-center">
            {failed
              ? "Không tải được bản xem trước. Thử tải lại trang."
              : "Chưa có bản xem trước. Máy đang ghép mạch chính."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
