import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api, type ApiFile } from "@/lib/api";

import { formatTime, isVideoName } from "./editor-data";

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
export function InsertPreview({ file }: { file: ApiFile }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const video = isVideoName(file.name);

  // Đổi tệp thì trả về đầu: giữ nguyên trạng thái đang phát của tệp trước sẽ
  // thành bấm một cái là nghe tiếp từ giữa một clip khác.
  useEffect(() => {
    setPlaying(false);
    setTime(0);
  }, [file.id]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (playing) void element.play().catch(() => setPlaying(false));
    else element.pause();
  }, [playing]);

  const duration = file.duration ?? 0;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-black">
        {video ? (
          <video
            key={file.id}
            ref={videoRef}
            src={api.mediaUrl(file.id)}
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
            key={file.id}
            src={api.mediaUrl(file.id)}
            alt=""
            className="size-full object-contain"
          />
        )}

        {video && (
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
              {formatTime(time)} / {formatTime(duration)}
            </span>
          </div>
        )}
      </div>

      {/* Tên đầy đủ chỉ có MỘT chỗ trên cả bảng — ở đây. Trong lưới thì mỗi ô
          một dòng tên là hai chục chuỗi vô nghĩa cùng lúc. */}
      <div className="min-w-0">
        <p className="truncate text-sm" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {[
            video && duration ? formatTime(duration) : null,
            file.width && file.height ? `${file.width}×${file.height}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}
