import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import { useTextReview, type ReviewWord } from "./use-text-review";

/**
 * BƯỚC SOÁT LỜI — bản chép bày ra, sửa chính tả tại chỗ, nghe chạy để bắt lỗi.
 *
 * ══ NGHE & SOÁT (KARAOKE) ══
 *
 * Vì phụ đề CHÍNH LÀ sản phẩm, cách soát tự nhiên nhất là phát video và TÔ từ
 * đang đọc — thấy đúng thứ sẽ xuất ra. Lỗi đập vào tai/mắt trong mạch, bấm chữ
 * là dừng đúng chỗ và sửa. Mốc từng tiếng đã có sẵn nên chỉ cần một vòng đọc
 * `currentTime` → từ.
 *
 * ══ MỌI CHỮ ĐỀU SỬA, MỘT CHỖ ÁP HẾT ══
 *
 * Bấm chữ nào cũng mở ô sửa (máy tự tin vẫn sai đồng âm). Chữ lặp thì mời "Sửa
 * cả N chỗ". Sửa nhầm thì "Hoàn tác" ngay trên thông báo.
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
  /** Từ đang được đọc lúc phát — tô sáng như phụ đề chạy. */
  const [playingId, setPlayingId] = useState<string | null>(null);
  /** Chỉ một ô sửa mở tại một thời điểm — nhấc lên đây để nhảy chỗ ngờ mở được. */
  const [openId, setOpenId] = useState<string | null>(null);
  /** Mốc tự dừng: hữu hạn khi nghe một quãng, vô hạn khi nghe chạy suốt. */
  const stopAt = useRef<number>(Number.POSITIVE_INFINITY);

  const allWords = useMemo(
    () => review.sentences.flatMap((sentence) => sentence.words),
    [review.sentences],
  );

  /** Số chỗ trùng mỗi chữ (không phân biệt hoa–thường) — để mời "Sửa cả N chỗ". */
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const word of allWords) {
      const key = word.text.trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [allWords]);

  // Vòng phát: tô từ đang đọc, và dừng khi qua mốc `stopAt` (chế độ nghe-một-quãng).
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video) {
        const at = video.currentTime;
        if (at >= stopAt.current) video.pause();
        else {
          const word = allWords.find((item) => at >= item.start && at < item.end);
          setPlayingId(word?.id ?? null);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, allWords]);

  /** Nghe lại đúng quãng của một từ rồi dừng — chừa một nhịp hai đầu. */
  const hear = (start: number, end: number) => {
    const video = videoRef.current;
    if (!video) return;
    stopAt.current = end + 0.5;
    video.currentTime = Math.max(0, start - 0.5);
    void video.play();
  };

  /** Nghe CHẠY SUỐT — không tự dừng, tô từng từ. Phát/dừng dùng chung nút này. */
  const toggleKaraoke = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      stopAt.current = Number.POSITIVE_INFINITY;
      if (video.ended || video.currentTime >= (allWords.at(-1)?.end ?? 0))
        video.currentTime = 0;
      void video.play();
    } else {
      video.pause();
    }
  };

  const openWord = (word: ReviewWord) => {
    setOpenId(word.id);
    hear(word.start, word.end);
  };

  /** Nhảy tới chỗ ngờ kế/trước, mở ô sửa và đưa vào giữa khung. */
  const jumpUnsure = (dir: 1 | -1) => {
    const ids = review.unsure.map((word) => word.id);
    if (ids.length === 0) return;
    const here = openId ? ids.indexOf(openId) : -1;
    const next = here < 0 ? (dir > 0 ? 0 : ids.length - 1) : (here + dir + ids.length) % ids.length;
    const word = allWords.find((item) => item.id === ids[next]);
    if (!word) return;
    openWord(word);
    requestAnimationFrame(() =>
      document
        .querySelector(`[data-word-id="${word.id}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  };

  // Phím CÁCH: phát/dừng nghe-chạy. Bỏ qua khi đang gõ trong ô sửa.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable]")) return;
      if (event.key === " ") {
        event.preventDefault();
        toggleKaraoke();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // toggleKaraoke chỉ đọc ref — không cần vào deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allWords]);

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
  const hereIndex = openId ? review.unsure.findIndex((w) => w.id === openId) : -1;

  return (
    <div className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-cols-[1fr_26rem]">
      {/* Bản chép — chỗ soát. */}
      <Card className="lg:min-h-0">
        {/* Tiêu đề là THÔNG TIN (đếm chỗ ngờ), không nhắc lại tên bước — tên bước
            đã ở sidebar. Cùng lối bước máy bày "Máy đang làm · N/M". */}
        <CardHeader>
          <CardTitle className="tabular-nums">
            {done
              ? "Đã soát xong"
              : hereIndex >= 0
                ? `Chỗ ${hereIndex + 1} / ${review.unsure.length} máy chưa chắc`
                : `${review.unsure.length} chỗ máy nghe không chắc`}
          </CardTitle>
          {done ? null : (
            <CardAction>
              <Button
                size="icon-sm"
                variant="ghost"
                tooltip="Chỗ ngờ trước"
                aria-label="Chỗ ngờ trước"
                onClick={() => jumpUnsure(-1)}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                tooltip="Chỗ ngờ kế"
                aria-label="Chỗ ngờ kế"
                onClick={() => jumpUnsure(1)}
              >
                <ChevronRightIcon />
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="min-h-0 overflow-y-auto">
          <div className="mx-auto grid max-w-[40rem] gap-5 py-2">
            <p className="text-muted-foreground text-sm">
              Bấm chữ bất kỳ để nghe lại và sửa · chữ gạch chân là chỗ máy chưa
              chắc · phím{" "}
              <kbd className="bg-muted rounded px-1 text-xs">Cách</kbd> nghe chạy.
            </p>
            {review.sentences.map((sentence) => (
              <p key={sentence.id} className="text-2xl leading-relaxed">
                {sentence.words.map((word, index) => (
                  <Fragment key={word.id}>
                    {index > 0 ? " " : null}
                    <EditableWord
                      word={word}
                      count={counts.get(word.text.trim().toLowerCase()) ?? 1}
                      playing={playingId === word.id}
                      open={openId === word.id}
                      onOpenChange={(next) => {
                        if (next) openWord(word);
                        else if (openId === word.id) setOpenId(null);
                      }}
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

      {/* Khung xem: nút nghe nằm CHỒNG lên video, không thành hàng công cụ riêng
          — cùng lối preview của bước Cắt và bàn dựng. */}
      <Card className="lg:min-h-0">
        <CardContent className="grid min-h-0 flex-1 place-items-center overflow-hidden">
          {previewUrl ? (
            <div className="relative mx-auto aspect-[9/16] w-full max-h-full overflow-hidden rounded-lg">
              <video
                ref={videoRef}
                src={previewUrl}
                className="h-full w-full object-cover"
                onPlay={() => setPlaying(true)}
                onPause={() => {
                  setPlaying(false);
                  setPlayingId(null);
                }}
                onClick={toggleKaraoke}
              />
              <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8">
                <Button
                  variant="secondary"
                  size="icon-sm"
                  aria-label={playing ? "Tạm dừng" : "Nghe & soát"}
                  onClick={toggleKaraoke}
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </Button>
                <span className="text-xs text-white">
                  {playing
                    ? "Đang tô từng chữ — bấm một chữ để dừng và sửa"
                    : "Nghe & soát — tô từng chữ như bản xuất"}
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
 * Một từ trong bản chép — bấm mở ô sửa, tô sáng khi đang được đọc.
 *
 * Chữ ngờ gạch chân để mời mắt; chữ thường chỉ sáng nền khi rê vào — đủ để biết
 * bấm được mà không làm cả bản chép nhấp nháy.
 */
function EditableWord({
  word,
  count,
  playing,
  open,
  onOpenChange,
  onFix,
  onFixAll,
  onConfirm,
}: {
  word: ReviewWord;
  count: number;
  /** Đang được đọc lúc phát — tô sáng như phụ đề karaoke. */
  playing: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFix: (text: string) => void;
  onFixAll: (text: string) => void;
  onConfirm: () => void;
}) {
  const [text, setText] = useState(word.text);
  useEffect(() => {
    if (open) setText(word.text);
  }, [open, word.text]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            data-word-id={word.id}
            className={cn(
              "cursor-pointer rounded-sm underline-offset-4 transition-colors",
              word.unsure
                ? "text-primary underline decoration-primary decoration-dotted decoration-2 hover:bg-primary/10"
                : "hover:bg-muted",
              // Từ đang đọc — nền sắc chủ đạo, đúng cảm giác phụ đề chạy.
              playing && "bg-primary/25 ring-primary/40 rounded ring-1",
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
              onOpenChange(false);
              onFix(text);
            }
          }}
        />
        <div className="flex gap-1">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => {
              onOpenChange(false);
              onFix(text);
            }}
          >
            Sửa lại
          </Button>
          {word.unsure ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                onOpenChange(false);
                onConfirm();
              }}
            >
              <CheckIcon />
              Đúng rồi
            </Button>
          ) : null}
        </div>
        {count > 1 ? (
          <button
            type="button"
            className="border-primary/40 text-primary hover:bg-primary/10 cursor-pointer rounded-md border border-dashed px-2 py-1.5 text-left text-xs font-medium"
            onClick={() => {
              onOpenChange(false);
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
