import { useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  AudioLinesIcon,
  CaptionsIcon,
  CheckIcon,
  FilmIcon,
  HighlighterIcon,
  ImagePlusIcon,
  ImagesIcon,
  type LucideIcon,
  MinusIcon,
  MusicIcon,
  PencilLineIcon,
  ScanSearchIcon,
  ScissorsIcon,
  SparklesIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ApiStep } from "@/lib/api";

import { STEP_LABELS, STEP_DESCRIPTIONS } from "../pipeline/pipeline-page";

/**
 * MÀN "MÁY ĐANG LÀM" — quãng chờ máy dựng, dựng như đang-sống chứ không đứng im.
 *
 * ══ VÌ SAO KHÔNG PHẢI MỘT DANH SÁCH PHẲNG ══
 *
 * Bản trước là danh sách `StepRow`: chấm/spinner/tick + tên chặng + "đang chạy
 * 12s". Đúng thông tin, nhưng đọc ra "nhạt" — vì thứ ĐANG BÁN chính là quãng chờ
 * tự động này, mà nó lại trông như một form đang tải.
 *
 * Nay chia hai tầng. HERO nêu chặng máy đang làm NGAY BÂY GIỜ: biểu tượng thở
 * trong quầng sáng, tên chặng có ánh sáng quét qua, đồng hồ đếm. Dưới là mạch
 * các chặng với đường nối tô dần theo tiến độ — liếc là biết còn mấy chặng.
 *
 * Hiệu ứng ở `index.css` (`flow-*`), một sắc primary, tắt theo "giảm chuyển
 * động". Ở đây chỉ gắn class và bày dữ liệu.
 */

/** Biểu tượng cho từng chặng máy — client giữ, không nhét vào bảng chặng chung. */
const STAGE_ICONS: Record<string, LucideIcon> = {
  prepare: FilmIcon,
  describe: ImagesIcon,
  transcribe: AudioLinesIcon,
  silence: ScissorsIcon,
  cuts: ScanSearchIcon,
  "commit-cut": ScissorsIcon,
  "review-text": PencilLineIcon,
  captions: CaptionsIcon,
  keywords: HighlighterIcon,
  place: ImagePlusIcon,
  effects: SparklesIcon,
  music: MusicIcon,
};

/** "đang chạy 12s" / "đang chạy 2p05s". Mốc là lúc chặng đổi sang `running`. */
function elapsedLabel(updatedAt: number, now: number) {
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (seconds < 60) return `đang chạy ${seconds}s`;
  return `đang chạy ${Math.floor(seconds / 60)}p${String(seconds % 60).padStart(2, "0")}s`;
}

/** Đồng hồ đẩy lại mỗi giây — để hero đếm mượt thay vì nhích theo nhịp hỏi máy chủ. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

export function MachineWorkingPanel({
  steps,
  onRetry,
}: {
  /** Các chặng THUỘC bước máy đang chạy — đã lọc sẵn ở nơi gọi. */
  steps: ApiStep[];
  onRetry: (key: string) => void;
}) {
  const running = steps.find((step) => step.status === "running");
  const blocking = steps.find(
    (step) => step.status === "failed" && step.required,
  );
  // Chặng để nêu ở hero: đang chạy > vấp-chặn-đường > chặng chưa tới đầu tiên.
  const current =
    running ??
    blocking ??
    steps.find((step) => step.status === "waiting") ??
    steps[steps.length - 1];
  const now = useNow(!!running);

  const done = steps.filter((step) => step.status === "done").length;
  const HeroIcon = current
    ? (STAGE_ICONS[current.key] ?? SparklesIcon)
    : SparklesIcon;
  const hurt = current?.status === "failed" && current.required;

  return (
    <Card className="lg:h-full lg:min-h-0">
      {/* Căn GIỮA theo chiều dọc và gom vào một cột hẹp ở giữa: màn chờ vốn thưa
          nội dung, dồn lên góc trên-trái để lại một mảng đen lớn phía dưới — đọc
          ra như thẻ hỏng. Cụm hero + mạch chặng đứng giữa thẻ mới ra dáng "đang
          chờ", cân với phần còn lại của bento. */}
      <CardContent className="flex min-h-0 flex-1 flex-col justify-center gap-4 overflow-y-auto py-6">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
          {/* ── HERO: chặng máy đang làm ngay bây giờ ── */}
          <div
            className={cn(
              "grid place-items-center gap-3 rounded-xl border border-border px-4 py-8 text-center",
              // Quầng sáng chỉ trôi khi ĐANG chạy — vấp rồi thì để nền tĩnh, không
              // tô hồng một lỗi.
              running && "flow-aurora",
            )}
          >
            <div
              className={cn(
                "grid size-14 place-items-center rounded-full border",
                hurt
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-primary/40 bg-primary/10 text-primary",
              )}
            >
              {running ? (
                <Spinner className="size-6" />
              ) : hurt ? (
                <AlertTriangleIcon className="size-6" />
              ) : (
                <HeroIcon className="size-6" />
              )}
            </div>

            <div className="grid gap-1">
              <span
                className={cn(
                  "text-lg font-medium",
                  running
                    ? "flow-shimmer-text"
                    : hurt
                      ? "text-destructive"
                      : "text-foreground",
                )}
              >
                {current
                  ? (STEP_LABELS[current.key] ?? current.key)
                  : "Đang dựng"}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {running
                  ? `${elapsedLabel(current!.updatedAt, now)} · ${done}/${steps.length} chặng xong`
                  : hurt
                    ? (current!.error ?? "Máy vấp ở chặng này")
                    : `${done}/${steps.length} chặng xong`}
              </span>
            </div>

            {/* Trấn an: người dùng KHÔNG cần ngồi canh. Đây là điểm bán, nói thẳng. */}
            {!hurt ? (
              <p className="text-muted-foreground max-w-xs text-xs leading-relaxed">
                Cứ để đó — máy tự chạy hết rồi mở bước tiếp cho bạn. Không cần
                canh.
              </p>
            ) : null}
          </div>

          {/* ── MẠCH CHẶNG: đường nối tô dần theo tiến độ ── */}
          <div className="grid gap-0 px-1">
            {steps.map((step, index) => {
              const isDone = step.status === "done";
              const isRunning = step.status === "running";
              const isFail = step.status === "failed";
              const last = index === steps.length - 1;
              const Icon = STAGE_ICONS[step.key] ?? SparklesIcon;

              return (
                // `min-h-14` cho MỌI bước cao BẰNG nhau: bước có dòng phụ ("bỏ 55s…")
                // vốn cao hơn bước một dòng, để nguyên thì các mốc so le, mạch đọc ra
                // "lệch". Chiều cao tối thiểu đều thì mốc cách đều, dòng phụ nằm gọn
                // trong khoảng ấy.
                <div key={step.key} className="flex min-h-14 items-start gap-3">
                  {/* Cột dấu hiệu + đoạn nối xuống chặng sau. Đoạn nối TÔ primary khi
                    chặng này đã xong — mạch sáng dần từ trên xuống theo tiến độ. */}
                  <div className="flex flex-col items-center self-stretch">
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full border",
                        isDone
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : isRunning
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : isFail
                              ? step.required
                                ? "border-destructive/40 bg-destructive/10 text-destructive"
                                : "border-border text-muted-foreground"
                              : "border-border text-muted-foreground/50",
                      )}
                    >
                      {isDone ? (
                        <CheckIcon className="size-3.5" />
                      ) : isRunning ? (
                        <Spinner className="size-3.5" />
                      ) : isFail ? (
                        step.required ? (
                          <AlertTriangleIcon className="size-3.5" />
                        ) : (
                          <MinusIcon className="size-3.5" />
                        )
                      ) : (
                        <Icon className="size-3.5" />
                      )}
                    </span>
                    {!last ? (
                      <span
                        className={cn(
                          "w-px flex-1",
                          isDone ? "bg-primary/40" : "bg-border",
                        )}
                      />
                    ) : null}
                  </div>

                  {/* Nội dung chặng — chừa đáy để đường nối có chỗ thở giữa hai hàng. */}
                  <div className="flex min-w-0 flex-1 items-start gap-2 pb-4">
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span
                        className={cn(
                          "text-sm",
                          isRunning
                            ? "flow-shimmer-text font-medium"
                            : isDone
                              ? "text-foreground"
                              : "text-muted-foreground",
                        )}
                      >
                        {STEP_LABELS[step.key] ?? step.key}
                      </span>
                      {/* Dòng phụ: kết quả khi xong, lý do khi hỏng, còn lại là MÔ
                        TẢ ngắn (chặng làm gì) để hàng nào cũng hai dòng, không cụt. */}
                      {isDone && step.result ? (
                        <span className="text-muted-foreground text-xs">
                          {step.result}
                        </span>
                      ) : isFail ? (
                        <span
                          className={cn(
                            "text-xs",
                            step.required
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {step.error ?? (step.required ? "hỏng" : "bỏ qua")}
                        </span>
                      ) : STEP_DESCRIPTIONS[step.key] ? (
                        <span className="text-muted-foreground/70 text-xs">
                          {STEP_DESCRIPTIONS[step.key]}
                        </span>
                      ) : null}
                    </div>

                    {/* Thử lại ở MỌI chặng hỏng — kể cả chặng bỏ-qua-được, vì lý do
                      hỏng có thể chỉ là tạm (mạng, mô hình quá tải). */}
                    {isFail ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onRetry(step.key)}
                      >
                        Thử lại
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
