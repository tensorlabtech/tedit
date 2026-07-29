import { useEffect, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

import { isVideo, type MediaFile } from "./upload-data";

/**
 * Khung xem trước — chạy CẢ MẠCH liền một hơi, hết cảnh này tự sang cảnh sau.
 *
 * Đây là thứ duy nhất trả lời được câu hỏi chính của màn này: thứ tự vừa xếp có
 * xuôi không. Rê chuột qua ô chỉ nói "cảnh này là cảnh nào" — một việc khác hẳn.
 *
 * Khung cắt 9:16 vì đó ĐÚNG là khung sẽ xuất ra: xem trước mà không cắt thì cái
 * mình xem không phải cái mình sắp dựng.
 */
export function SequencePreviewCard({
  scenes,
  file,
  source,
  onSelect,
  className,
}: {
  /** Mạch chính, theo đúng thứ tự sẽ ghép */
  scenes: MediaFile[];
  /** Thứ đang xem — có thể là một cảnh trong mạch, hoặc một miếng tư liệu chèn */
  file: MediaFile | null;
  source: File | undefined;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Tệp gốc trước, đường máy chủ sau: lúc đang tải thì trên máy chủ chưa có gì,
  // còn lúc mở lại một dự án dở thì trong trình duyệt không còn `File` nào.
  const remoteUrl = file?.remoteUrl;
  useEffect(() => {
    if (!source) {
      setUrl(remoteUrl ?? null);
      setAt(0);
      return;
    }
    const next = URL.createObjectURL(source);
    setUrl(next);
    setAt(0);
    return () => URL.revokeObjectURL(next);
  }, [source, remoteUrl]);

  // Đổi cảnh thì phát tiếp, không dừng lại: đang xem một mạch mà mỗi lần sang
  // cảnh mới lại phải bấm phát thì không còn là xem mạch nữa.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      // Trình duyệt chặn tự phát khi thao tác bấm đã đi quá xa — thà dừng hẳn
      // còn hơn để nút vẫn hiện "đang phát" trong khi hình đứng im.
      void video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  }, [playing, url]);

  const index = scenes.findIndex((item) => item.id === file?.id);
  const inSequence = index >= 0;
  const step = (direction: -1 | 1) => {
    const next = scenes[index + direction];
    if (next) onSelect(next.id);
  };

  /**
   * `←` `→` đi cảnh trước / cảnh sau.
   *
   * Xem một mạch mười cảnh bằng cách rê chuột tới đúng hai cái mũi tên rộng
   * 32px là việc của tay, không phải của mắt — mà mắt mới là thứ đang bận nhìn
   * khung hình. Hai phím này là cách duy nhất soát mạch mà không rời mắt.
   *
   * `defaultPrevented`: lúc đang kéo ô bằng bàn phím, dnd-kit cũng nghe hai
   * phím này để dời chỗ và đã chặn sự kiện — nhảy cảnh lúc đó là cướp phím
   * giữa một cử chỉ đang dở.
   */
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target as HTMLElement | null;
      // Đang gõ trong một ô nhập thì hai phím này là của con trỏ chữ.
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        return;
      }
      stepRef.current(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Xem trước</CardTitle>
      </CardHeader>

      <CardContent className="flex min-h-60 flex-col gap-3 lg:min-h-0 lg:flex-1">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {file && url ? (
            <div className="relative flex aspect-[9/16] h-full max-h-full max-w-full items-center justify-center overflow-hidden rounded-xl bg-muted">
              {isVideo(file.name) ? (
                <video
                  ref={videoRef}
                  src={url}
                  poster={file.thumbnail}
                  playsInline
                  aria-label={`Xem trước ${file.name}`}
                  // Cảnh chính cắt theo khung 9:16 vì đó là khung sẽ xuất ra.
                  // Tư liệu chèn thì KHÔNG: nó dán đè lên một góc màn, cắt nó ở
                  // đây là bày ra một khung hình nó không bao giờ có.
                  className={cn(
                    "size-full",
                    inSequence ? "object-cover" : "object-contain",
                  )}
                  onTimeUpdate={(event) => {
                    const video = event.currentTarget;
                    if (video.duration) setAt(video.currentTime / video.duration);
                  }}
                  onEnded={() => {
                    // Hết cảnh cuối thì dừng, không quay vòng: quay vòng thì
                    // không biết mạch đã hết hay mình xem lộn lần thứ hai.
                    if (inSequence && index < scenes.length - 1) {
                      setAt(0);
                      step(1);
                      return;
                    }
                    setPlaying(false);
                  }}
                />
              ) : (
                <img
                  src={url}
                  alt={file.name}
                  className={cn(
                    "size-full",
                    inSequence ? "object-cover" : "object-contain",
                  )}
                />
              )}
            </div>
          ) : (
            <Empty>
              <EmptyMedia variant="icon">
                <PlayIcon />
              </EmptyMedia>
              <EmptyTitle>Chưa có gì để xem</EmptyTitle>
              <EmptyDescription>
                Thêm video vào mạch rồi bấm phát để xem cả mạch chạy liền một hơi.
              </EmptyDescription>
            </Empty>
          )}
        </div>

        {/* Mỗi cảnh một khúc, rộng theo đúng thời lượng của nó — chạy tới đâu
            khúc đó đầy tới đó. Đây là chỗ duy nhất thấy được cảnh nào dài cảnh
            nào ngắn mà không phải in ra một con số nào cả. */}
        {inSequence && scenes.length > 0 && (
          <div className="flex h-1.5 gap-0.5">
            {scenes.map((scene, order) => (
              <button
                key={scene.id}
                type="button"
                aria-label={`Tới cảnh ${order + 1}`}
                style={{ flexGrow: scene.duration || 1 }}
                onClick={() => onSelect(scene.id)}
                className="h-full min-w-1 overflow-hidden rounded-full bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className="block h-full bg-primary transition-[width] duration-100"
                  style={{
                    width:
                      order < index
                        ? "100%"
                        : order === index
                          ? `${at * 100}%`
                          : "0%",
                  }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Hàng điều khiển luôn có chỗ, kể cả khi chưa chọn gì: nó nằm ngay dưới
            khung hình, mà khung hình cao theo phần còn lại của thẻ — thêm bớt
            hàng này là khung hình nhảy một nấc mỗi lần chọn cảnh đầu tiên. */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Cảnh trước"
            disabled={!inSequence || index === 0}
            onClick={() => step(-1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label={playing ? "Dừng" : "Phát cả mạch"}
            disabled={!file || !isVideo(file.name)}
            onClick={() => setPlaying((current) => !current)}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Cảnh sau"
            disabled={!inSequence || index >= scenes.length - 1}
            onClick={() => step(1)}
          >
            <ChevronRightIcon />
          </Button>
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-xs",
              inSequence ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {!file
              ? "Chưa chọn cảnh nào"
              : inSequence
                ? `Cảnh ${index + 1}/${scenes.length} · ${file.name}`
                : `Tư liệu chèn · ${file.name}`}
          </span>
          {/* Xem tư liệu chèn là đi ra khỏi mạch — phải có đường quay lại, không
              thì lối duy nhất về là bấm bừa một ô trên dải. */}
          {file && !inSequence && scenes[0] && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onSelect(scenes[0].id)}
            >
              Về mạch
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
