import { Fragment, useMemo, useRef, useState } from "react";
import { CheckIcon, PauseIcon, PlayIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import { useTextReview, type ReviewWord } from "./use-text-review";

/**
 * BƯỚC SOÁT LỜI — bản chép bày ra, sửa chính tả tại chỗ.
 *
 * ══ MỌI CHỮ ĐỀU SỬA ĐƯỢC ══
 *
 * Chấm dưới chỉ là GỢI Ý mời mắt tới chỗ máy tự nhận không chắc — nhưng máy tự
 * tin vẫn sai ở đồng âm ("chuyện/chuyến"). Nên bấm chữ NÀO cũng mở được ô sửa,
 * không riêng chữ gạch chân. Bấm là nghe lại đúng quãng của từ ấy luôn.
 *
 * ══ SỬA MỘT CHỖ, ÁP HẾT ══
 *
 * Tên riêng / từ mượn sai thì sai đều: "network" chép nhầm "nem quốc" ở mấy chỗ.
 * Nên ô sửa mời "Sửa cả N chỗ giống" — một thao tác thay cho N. Chỉ đổi chữ nên
 * an toàn, và sửa nhầm thì có "Hoàn tác" ngay ở thông báo.
 */

export function SoatLoiStep({
  projectId,
  previewUrl,
}: {
  projectId: string | undefined;
  /** `base.mp4` đã cắt — để nghe lại đúng chỗ đang soát. */
  previewUrl: string | null;
}) {
  const review = useTextReview(projectId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const stopAt = useRef<number>(0);

  /** Số chỗ trùng mỗi chữ (không phân biệt hoa–thường) — để mời "Sửa cả N chỗ". */
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const sentence of review.sentences) {
      for (const word of sentence.words) {
        const key = word.text.trim().toLowerCase();
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return map;
  }, [review.sentences]);

  /** Nghe lại đúng quãng của một từ — chừa một nhịp hai đầu cho đủ ngữ cảnh. */
  const hear = (start: number, end: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, start - 0.5);
    void video.play();
    stopAt.current = end + 0.5;
    const tick = () => {
      const node = videoRef.current;
      if (!node) return;
      if (node.currentTime >= stopAt.current) node.pause();
      else if (!node.paused) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    stopAt.current = Number.POSITIVE_INFINITY;
    if (video.paused) void video.play();
    else video.pause();
  };

  const undoToast = (title: string, revert: () => Promise<void>) =>
    toast.add({
      title,
      timeout: 8000,
      actionProps: { children: "Hoàn tác", onClick: () => void revert() },
    });

  const onFix = async (word: ReviewWord, text: string) => {
    if (text.trim() === word.text.trim()) return review.confirm(word.id);
    const undo = await review.fix(word.id, text);
    undoToast(`Đã sửa “${word.text}” → “${text.trim()}”`, undo.revert);
  };
  const onFixAll = async (word: ReviewWord, text: string) => {
    const { count, revert } = await review.fixAll(word.text, text);
    undoToast(`Đã sửa ${count} chỗ thành “${text.trim()}”`, revert);
  };

  const done = !review.loading && review.unsure.length === 0;

  return (
    <div className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-cols-[1fr_22rem]">
      {/* Bản chép — chỗ soát. */}
      <Card className="lg:min-h-0">
        <CardHeader>
          <CardTitle>Soát chính tả</CardTitle>
          <CardAction>
            {done ? (
              <Badge>Đã soát xong</Badge>
            ) : (
              <Badge variant="secondary">
                {review.unsure.length} chỗ máy nghe không chắc
              </Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="min-h-0 overflow-y-auto">
          <p className="text-muted-foreground mb-3 text-sm">
            Bấm chữ bất kỳ để nghe lại và sửa · chữ gạch chân là chỗ máy nghe
            không chắc.
          </p>
          <div className="space-y-3 text-lg leading-relaxed">
            {review.sentences.map((sentence) => (
              <p key={sentence.id}>
                {sentence.words.map((word, index) => (
                  <Fragment key={word.id}>
                    {index > 0 ? " " : null}
                    <EditableWord
                      word={word}
                      count={counts.get(word.text.trim().toLowerCase()) ?? 1}
                      onHear={() => hear(word.start, word.end)}
                      onFix={(text) => void onFix(word, text)}
                      onFixAll={(text) => void onFixAll(word, text)}
                      onConfirm={() => void review.confirm(word.id)}
                    />
                  </Fragment>
                ))}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Nghe thử. */}
      <Card className="lg:min-h-0">
        <CardContent className="grid min-h-0 place-items-center overflow-hidden">
          {previewUrl ? (
            <div className="relative mx-auto aspect-[9/16] h-full overflow-hidden rounded-lg">
              <video
                ref={videoRef}
                src={previewUrl}
                className="h-full w-full object-cover"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onClick={togglePlay}
              />
              <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8">
                <Button
                  variant="secondary"
                  size="icon-sm"
                  aria-label={playing ? "Tạm dừng" : "Phát"}
                  onClick={togglePlay}
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </Button>
                <span className="text-xs text-white">
                  Bấm một chữ để nghe lại đúng chỗ đó
                </span>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-center">
              Chưa có bản xem trước. Máy đang ghép mạch chính.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Một từ trong bản chép — bấm mở ô sửa ngay tại chỗ, nghe lại đúng quãng của nó.
 *
 * Chữ ngờ gạch chân để mời mắt; chữ thường chỉ sáng nền khi rê vào — đủ để biết
 * bấm được mà không làm cả bản chép thành một hàng nút nhấp nháy.
 */
function EditableWord({
  word,
  count,
  onHear,
  onFix,
  onFixAll,
  onConfirm,
}: {
  word: ReviewWord;
  /** Số chỗ trùng chữ này — >1 thì mời "Sửa cả N chỗ". */
  count: number;
  onHear: () => void;
  onFix: (text: string) => void;
  onFixAll: (text: string) => void;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(word.text);

  const close = () => setOpen(false);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setText(word.text);
          onHear();
        }
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "cursor-pointer rounded-sm underline-offset-4",
              word.unsure
                ? "text-primary underline decoration-primary decoration-dotted decoration-2 hover:bg-primary/10"
                : "hover:bg-muted",
            )}
          />
        }
      >
        {word.text}
      </PopoverTrigger>
      <PopoverContent align="center" side="top" className="grid w-64 gap-2">
        {word.unsure ? (
          <p className="text-muted-foreground text-xs">
            Máy nghe không chắc chữ này
          </p>
        ) : null}
        <Input
          value={text}
          autoFocus
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              close();
              onFix(text);
            }
          }}
        />
        <div className="flex gap-1">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => {
              close();
              onFix(text);
            }}
          >
            Sửa lại
          </Button>
          {/* "Đúng rồi" chỉ cho chữ ngờ — chữ máy đã chắc thì không cần xác nhận. */}
          {word.unsure ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                close();
                onConfirm();
              }}
            >
              <CheckIcon />
              Đúng rồi
            </Button>
          ) : null}
        </div>
        {/* Sửa-tất-cả: chỉ hiện khi chữ này lặp — tên riêng/từ mượn sai đều. */}
        {count > 1 ? (
          <button
            type="button"
            className="border-primary/40 text-primary hover:bg-primary/10 cursor-pointer rounded-md border border-dashed px-2 py-1.5 text-left text-xs font-medium"
            onClick={() => {
              close();
              onFixAll(text);
            }}
          >
            Sửa cả <span className="tabular-nums">{count}</span> chỗ “{word.text}”
            giống nhau
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
