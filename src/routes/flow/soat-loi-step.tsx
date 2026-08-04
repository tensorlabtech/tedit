import { Fragment, useRef, useState } from "react";
import { CheckIcon, PauseIcon, PlayIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { useTextReview, type ReviewWord } from "./use-text-review";

/**
 * BƯỚC SOÁT LỜI — bản chép bày ra, chấm dưới chỗ máy nghe không chắc.
 *
 * ══ VÌ SAO KHÔNG MƯỢN BÀN DỰNG NỮA ══
 *
 * Trước đây bước này để trống và mời "Mở bàn dựng". Nhưng soát chính tả không
 * cần cả dòng thời gian, sáu lớp và một mê cung điều kiện của bàn dựng — nó chỉ
 * cần đọc bản chép và sửa vài từ. Một màn riêng thì gọn đúng việc, và người dùng
 * không rời khỏi mạch.
 *
 * ══ CHẤM DƯỚI, KHÔNG PHẢI DANH SÁCH ══
 *
 * Chỗ ngờ nằm TRONG câu, nên chấm ngay dưới chữ thì đọc ra được ngữ cảnh — "nem
 * quốc" giữa câu nói về lập công ty phần mềm lộ ngay là "network". Bấm vào chữ
 * là nghe lại đúng đoạn ấy và sửa tại chỗ; sửa xong chấm dưới biến mất.
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
  /** Bộ đếm để dừng phát sau khi nghe hết đoạn của một từ. */
  const stopAt = useRef<number>(0);

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
    stopAt.current = Number.POSITIVE_INFINITY; // phát tay thì không tự dừng
    if (video.paused) void video.play();
    else video.pause();
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
          {/* Nhắc một dòng: đây là chấm dưới, bấm vào để nghe và sửa. Không có nó
              thì người dùng không biết mấy chữ gạch chân là bấm được. */}
          <p className="text-muted-foreground mb-3 text-sm">
            {done
              ? "Không còn chữ nào đáng ngờ. Bấm “Chốt chính tả” để máy dựng nốt."
              : "Chữ gạch chân là chỗ máy nghe không chắc — bấm để nghe lại và sửa."}
          </p>
          <div className="space-y-3 text-lg leading-relaxed">
            {review.sentences.map((sentence) => (
              <p key={sentence.id}>
                {sentence.words.map((word, index) => (
                  <Fragment key={word.id}>
                    {index > 0 ? " " : null}
                    {word.unsure ? (
                      <UnsureWord
                        word={word}
                        onHear={() => hear(word.start, word.end)}
                        onFix={(text) => void review.fix(word.id, text)}
                        onConfirm={() => review.confirm(word.id)}
                      />
                    ) : (
                      word.text
                    )}
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
                  Bấm một chữ gạch chân để nghe lại đúng chỗ đó
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
 * Một từ ĐÁNG NGỜ — gạch chân, bấm mở ô sửa ngay tại chỗ.
 *
 * Mở ra là nghe lại đúng quãng của nó luôn: soát chính tả mà không nghe thì chỉ
 * là đoán chữ, mà cái cần là "tai nghe ra gì".
 */
function UnsureWord({
  word,
  onHear,
  onFix,
  onConfirm,
}: {
  word: ReviewWord;
  onHear: () => void;
  onFix: (text: string) => void;
  onConfirm: () => void;
}) {
  const [text, setText] = useState(word.text);

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) {
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
              "cursor-pointer rounded-sm underline decoration-primary decoration-dotted decoration-2 underline-offset-4",
              "text-primary hover:bg-primary/10",
            )}
          />
        }
      >
        {word.text}
      </PopoverTrigger>
      <PopoverContent align="center" side="top" className="grid w-64 gap-2">
        <p className="text-muted-foreground text-xs">
          Máy nghe không chắc chữ này
        </p>
        <Input
          value={text}
          autoFocus
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onFix(text);
          }}
        />
        <div className="flex gap-1">
          <Button size="sm" className="flex-1" onClick={() => onFix(text)}>
            Sửa lại
          </Button>
          {/* "Đúng rồi" giữ nguyên chữ, chỉ hạ cờ ngờ — máy nghe không sai. */}
          <Button size="sm" variant="secondary" onClick={onConfirm}>
            <CheckIcon />
            Đúng rồi
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
