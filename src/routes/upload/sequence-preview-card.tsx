import { useEffect, useRef, useState } from "react";

import type { StylePack } from "../../../server/style-pack";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";

import { GradeFilterDefs, gradeStyle } from "@/dev/overlays/grade-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  baseName,
  formatDuration,
  isVideo,
  type MediaFile,
} from "./upload-data";

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
  onDescribe,
  pack,
  className,
}: {
  /** Mạch chính, theo đúng thứ tự sẽ ghép */
  scenes: MediaFile[];
  /** Thứ đang xem — có thể là một cảnh trong mạch, hoặc một miếng tư liệu chèn */
  file: MediaFile | null;
  source: File | undefined;
  onSelect: (id: string) => void;
  /** Ghi mô tả một tư liệu chèn. Chuỗi rỗng nghĩa là trả lại cho máy đọc. */
  onDescribe: (id: string, description: string) => void;
  /**
   * Bộ dáng ĐANG CHỌN — khung xem này nắn màu theo nó.
   *
   * Thẻ chọn phong cách nằm ngay bên trái khung này. Không nắn thì chọn xong
   * chẳng thấy gì đổi, và trục MÀU HÌNH — trục khó hình dung nhất qua một cái
   * tên — thành vô hình đúng ở chỗ để chọn nó.
   */
  pack: StylePack;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const describeRef = useRef<HTMLInputElement>(null);

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
    return () => {
      /*
       * BUÔNG tệp ở thẻ video TRƯỚC khi thu hồi đường dẫn.
       *
       * Thu hồi thẳng thì mấy lượt đọc dở dang của thẻ `<video>` — nó tải video
       * theo từng khoảng byte — trỏ vào một `blob:` không còn tồn tại, và console
       * đỏ lên `ERR_FILE_NOT_FOUND`. Vô hại về mặt hình ảnh, nhưng một người dùng
       * đã mở devtools đi tìm lý do tải tệp hỏng và tưởng đó là nguyên nhân.
       *
       * `load()` sau khi gỡ `src` là cách chuẩn để dừng hẳn các lượt đọc đó.
       */
      const video = videoRef.current;
      if (video) {
        video.removeAttribute("src");
        video.load();
      }
      URL.revokeObjectURL(next);
    };
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

  /**
   * Bấm một ô tư liệu chèn là con trỏ vào luôn ô mô tả.
   *
   * Bấm ô tư liệu gần như luôn để LÀM một việc — thêm hoặc sửa mô tả, thứ chặng
   * đặt tư liệu đọc để chọn chỗ đặt. Không tự vào thì mỗi lần lại phải rê chuột
   * xuống dưới khung hình bấm thêm một lần nữa, cho cùng một ý định.
   *
   * `preventScroll`: khung xem nằm trong một cột có `overflow` riêng, để trình duyệt
   * tự cuộn tới ô là nó xê dịch cả cột.
   *
   * KHÔNG bôi đen chữ đang có: mô tả máy đọc thường đúng gần hết, người dùng chỉ
   * sửa một hai từ — bôi đen thì phím đầu tiên gõ vào là xoá sạch nó.
   */
  const focusKey = inSequence ? null : (file?.id ?? null);
  useEffect(() => {
    if (!focusKey) return;
    describeRef.current?.focus({ preventScroll: true });
  }, [focusKey]);
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
              <GradeFilterDefs pack={pack} />
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
                  style={gradeStyle(pack)}
                  onTimeUpdate={(event) => {
                    const video = event.currentTarget;
                    if (video.duration)
                      setAt(video.currentTime / video.duration);
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
                  style={gradeStyle(pack)}
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
                Thêm video vào mạch rồi bấm phát để xem cả mạch chạy liền một
                hơi.
              </EmptyDescription>
            </Empty>
          )}
        </div>

        {/* MỘT hàng cao cố định, hai thứ thay nhau đứng trong đó.
            
            Xem cảnh chính thì đó là thanh mạch; xem tư liệu chèn thì đó là ô nhập mô
            tả. Hai thứ khác hẳn nhau về chiều cao (thanh 6px, ô nhập 36px), nên nếu
            để chúng tự định chiều cao thì mỗi lần bấm sang tư liệu là cả khung hình
            nhảy một nấc. Khối `h-9` giữ chỗ sẵn cho cả hai — và cũng giữ chỗ khi
            chưa chọn gì. `h-10` là chiều cao ĐO ĐƯỢC của `Input` — ở `h-9` thì ô
            nhập tràn 4px và đè lên hàng nút bên dưới.

            Ô mô tả nằm ĐÂY, không ở khối Dự án như trước: mô tả nói về đúng tấm hình
            đang hiện ngay trên nó, mà ở khối Dự án thì người dùng phải nhớ mình đang
            mô tả tư liệu nào. Ô tư liệu chưa có mô tả mang một dấu "?" để chỉ đường
            tới đây. */}
        <div className="flex h-10 shrink-0 items-center">
          {file && !inSequence ? (
            <Input
              ref={describeRef}
              // `key`: ô KHÔNG có kiểm soát, nên đổi tư liệu mà không dựng lại ô thì
              // nó giữ chữ của tư liệu trước — và người dùng lưu mô tả của cái này
              // sang cái khác.
              key={file.id}
              aria-label={`Mô tả ${baseName(file.name)}`}
              spellCheck={false}
              placeholder="Tư liệu này là gì? Bỏ trống thì máy tự đọc"
              defaultValue={file.description ?? ""}
              onBlur={(event) => {
                const clean = event.target.value.trim();
                if (clean !== (file.description ?? "")) {
                  onDescribe(file.id, clean);
                }
              }}
            />
          ) : (
            inSequence &&
            scenes.length > 0 && (
              /* Mỗi cảnh một khúc, rộng theo đúng thời lượng của nó — chạy tới đâu
                 khúc đó đầy tới đó. Đây là chỗ duy nhất thấy được cảnh nào dài cảnh
                 nào ngắn mà không phải in ra một con số nào cả. */
              <div className="flex h-1.5 w-full gap-0.5">
                {scenes.map((scene, order) => (
                  // Khúc này cao 6px và không có nhãn nào — rê vào là cách DUY NHẤT
                  // biết nó là cảnh nào trước khi bấm.
                  <Tooltip key={scene.id}>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          aria-label={`Tới cảnh ${order + 1}`}
                          style={{ flexGrow: scene.duration || 1 }}
                          onClick={() => onSelect(scene.id)}
                          // Khúc ĐANG XEM có nền đậm hơn, không chỉ dựa vào phần
                          // đã chạy: chưa bấm phát thì mọi khúc đều rỗng và sáu
                          // khúc giống nhau hoàn toàn, trong khi nhãn bên dưới nói
                          // "Cảnh 1/6" — người đọc không biết khúc nào là cảnh 1.
                          className={cn(
                            "h-full min-w-1 overflow-hidden rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            order === index ? "bg-primary/30" : "bg-muted",
                          )}
                        />
                      }
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
                    </TooltipTrigger>
                    <TooltipContent>
                      Cảnh {order + 1} · {baseName(scene.name)}
                      {scene.duration
                        ? ` · ${formatDuration(scene.duration)}`
                        : ""}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )
          )}
        </div>

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
            // Nhãn phải nói đúng thứ nút này sẽ phát. Đang xem một tư liệu chèn thì
            // nó chỉ phát ĐÚNG miếng đó — `onEnded` không nhảy sang cảnh sau vì tư
            // liệu không nằm trong mạch. Gọi là "phát cả mạch" ở đó là hứa một việc
            // nút không làm.
            aria-label={
              playing
                ? "Dừng"
                : inSequence
                  ? "Phát cả mạch"
                  : "Phát tư liệu này"
            }
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
            {/* Chưa chọn gì thì KHÔNG nói lại: khối giữa thẻ đã nói "Chưa có gì
                để xem" ngay bên trên, và hai câu cùng nghĩa xếp trên nhau đọc ra
                như màn hình đang lặp. */}
            {!file
              ? ""
              : inSequence
                ? `Cảnh ${index + 1}/${scenes.length} · ${baseName(file.name)}`
                : // "Tư liệu" chứ không "Tư liệu chèn", và tên không kèm phần mở
                  // rộng: chỗ này còn khoảng 130px sau ba cái nút và nút "Về
                  // mạch", nên nhãn dài bị cắt thành "Tư liệu chèn · …" — mất đúng
                  // phần nói nó là tệp nào.
                  `Tư liệu · ${baseName(file.name)}`}
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
