import { useEffect, useMemo, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/lib/format-duration";

import { TimelineSideRail } from "../editor/timeline-side-rail";
import { ZOOM_STEP, useTimelineZoom } from "../editor/timeline-zoom";
import { CutLane } from "./cut-lane";
import { CutSpanList, type SpanRow } from "./cut-span-list";
import { useCutEdit } from "./use-cut-edit";

/**
 * BƯỚC CẮT ĐOẠN LỖI — máy đề xuất trước, người sửa trên dải.
 *
 * ══ VÌ SAO KHÔNG PHẢI MỘT DANH SÁCH CÂU ══
 *
 * Đời đầu của màn này là danh sách câu, bỏ hoặc giữ từng câu. Nó hỏng ở đúng chỗ
 * bước này sinh ra để chữa: **không bỏ được nửa câu**. Mà vấp, hắng giọng, lặp
 * một từ — gần như toàn bộ thứ đáng cắt — đều nằm TRONG lòng một câu.
 *
 * Tôi từng bênh danh sách ấy bằng một phép đo: 91,5% cặp từ liền nhau hở ≤ 0
 * giây, nên mép TỪ không có thật. Phép đo đúng, kết luận sai chỗ — nó chỉ bác
 * việc hít mốc theo từ, không bác việc kéo tay. Kéo tay thì mép do TAI người
 * đặt, không do Whisper đặt.
 *
 * ══ MÁY CHẠY TRƯỚC, NGƯỜI SỬA SAU ══
 *
 * `ai-cuts.ts` đã chạy ở bước Chuẩn bị và ÁP luôn đề xuất. Mở màn này ra là đã
 * thấy chỗ máy định bỏ; việc còn lại là soát, không phải bắt đầu từ dải trắng.
 * Đó là chênh lệch giữa "sửa bản nháp" và "tự cắt".
 *
 * ══ MỘT TRỤC THỜI GIAN DUY NHẤT ══
 *
 * Bàn dựng phải quy đổi qua lại giữa mốc gốc và mốc xuất ra ở 29 chỗ, và đó là
 * nguồn của những lỗi trôi khó tìm nhất. Ở đây không có chuyện đó: bản cắt chưa
 * nướng vào phim, nên `base.mp4`, dải, và lát đều chung mốc gốc. Việc gộp về một
 * trục để dành cho `commit-cut` chạy SAU bước này.
 *
 * ══ XẾP THEO BÀN DỰNG ══
 *
 * Hàng soát trái, xem trước phải, dải chạy suốt bề ngang phía dưới — cùng hình
 * với `/editor` để người dùng không phải học lại. Chép phần cần sang chứ không
 * dùng chung: bàn dựng có sáu lớp trên dải và một mê cung điều kiện quanh chúng.
 */

/** Bao quanh chỗ nghe thử: đủ nghe câu vào và câu ra. */
const SEAM = 1;

export type CutWord = { text: string; start: number; end: number };

export function CutStep({
  projectId,
  previewUrl,
  words,
}: {
  projectId: string | undefined;
  /** `base.mp4` — bản gốc chưa cắt, nên mốc của nó chính là mốc của dải. */
  previewUrl: string | null;
  words: CutWord[];
}) {
  const cut = useCutEdit(projectId);
  const { spans, total, loading } = cut;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Cùng thang phóng, cùng mức mặc định với bàn dựng: vạch ghim GIỮA và người
  // dùng KÉO/LĂN để soát cả bản, thay vì thu hết cỡ cho vừa khung. Đó là mô hình
  // của bàn dựng, và giữ đúng nó thì hai màn dùng một phản xạ.
  const zoom = useTimelineZoom();
  /**
   * Khoảng người dùng cố ý nghe dù nó đã bị bỏ.
   *
   * Phát bình thường thì NHẢY QUA chỗ bỏ — đó là điểm của xem trước, nghe ra
   * ngay bản dựng sẽ thế nào. Nhưng để quyết "có nên bỏ chỗ này không" thì phải
   * nghe được chính chỗ ấy. Hai việc trái nhau, nên tách bằng chủ ý.
   */
  const auditing = useRef<string | null>(null);

  const rows: SpanRow[] = useMemo(
    () =>
      spans.map((span) => ({
        ...span,
        // Từ tính theo ĐIỂM GIỮA: từ vắt qua mép chỉ được đếm cho một bên, nếu
        // không nó hiện ở cả hai chỗ và đọc ra như bị lặp.
        text: words
          .filter((word) => {
            const mid = (word.start + word.end) / 2;
            return mid >= span.start && mid < span.end;
          })
          .map((word) => word.text)
          .join(" "),
      })),
    [spans, words],
  );

  const cutSeconds = spans.reduce((sum, span) => sum + (span.end - span.start), 0);

  const seek = (at: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = at;
    setTime(at);
  };

  /*
   * VÒNG PHÁT MƯỢT bằng requestAnimationFrame — không theo `timeupdate`.
   *
   * `video.timeupdate` chỉ bắn ~4 lần/giây, nên nếu vạch (và cả dải cuộn theo)
   * đọc từ đó thì lúc phát nó nhảy giật từng nấc ~250ms. Bàn dựng chạy vòng rAF
   * 60fps cho mượt; màn cắt phải theo, nếu không hai màn phát khác cảm giác hẳn.
   *
   * Trong mỗi khung: nếu vạch rơi vào chỗ đã bỏ (mà không phải chỗ đang cố ý
   * nghe) thì NHẢY tới cuối khoảng — đó là điểm của "phát bản đã cắt".
   */
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video) {
        let at = video.currentTime;
        const here = spans.find((span) => at >= span.start && at < span.end);
        if (auditing.current && here?.id !== auditing.current)
          auditing.current = null;
        if (here && auditing.current !== here.id) {
          video.currentTime = here.end;
          at = here.end;
        }
        setTime(at);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, spans]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  /*
   * PHÍM TẮT như bàn dựng: Space phát/dừng, Delete xoá khoảng đang chọn, Esc bỏ
   * chọn, ←/→ bước một nhịp. Người dùng đi từ bước này sang bàn dựng dùng đúng
   * một bộ phản xạ, không phải học lại.
   *
   * Bỏ qua khi đang gõ trong ô nhập — nếu không, bấm cách trong một ô chữ lại
   * thành phát video.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable]")) return;
      const video = videoRef.current;
      if (event.key === " ") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "Escape") {
        setSelectedId(null);
      } else if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedId
      ) {
        event.preventDefault();
        void cut.deleteSpan(selectedId);
        setSelectedId(null);
      } else if (video && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        seek(
          Math.max(
            0,
            Math.min(total, video.currentTime + (event.key === "ArrowLeft" ? -1 : 1)),
          ),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, total, cut]);

  const audit = (span: SpanRow) => {
    const video = videoRef.current;
    if (!video) return;
    setSelectedId(span.id);
    auditing.current = span.id;
    video.currentTime = Math.max(0, span.start - SEAM);
    void video.play();
    // Dừng ngay sau khi qua hết khoảng: không dừng thì nó chạy tiếp hết video
    // trong khi câu hỏi đã trả lời xong từ lâu.
    window.setTimeout(
      () => video.pause(),
      (span.end - span.start + SEAM * 2) * 1000,
    );
  };

  return (
    <div className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-rows-[minmax(0,1fr)_auto]">
      <div className="grid gap-2 lg:min-h-0 lg:grid-cols-[20rem_1fr]">
        <CutSpanList
          heading={
            loading
              ? "Đang mở bản cắt"
              : `Máy định bỏ ${spans.length} chỗ · ${formatDuration(cutSeconds)}`
          }
          rows={rows}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            const row = rows.find((item) => item.id === id);
            if (row) seek(row.start);
          }}
          onAudit={audit}
          onDelete={(id) => {
            void cut.deleteSpan(id);
            setSelectedId(null);
          }}
        />

        {/* Khung xem: nút phát và đồng hồ nằm CHỒNG lên video, không thành một
            hàng công cụ riêng — đúng preview của bàn dựng. Một hàng nút riêng ở
            dưới dải là hai chỗ điều khiển phát cho một video. */}
        <Card className="lg:min-h-0">
          <CardContent className="grid min-h-0 flex-1 place-items-center overflow-hidden">
            {previewUrl ? (
              // Khung khít video, khống chế theo CHIỀU CAO: `h-full aspect-[9/16]`
              // → cao bằng ô, rộng theo tỉ lệ, căn giữa. Không dùng `AspectRatio`
              // (nó tính theo bề ngang) vì ô preview ở đây RỘNG nên khung 9:16
              // theo bề ngang sẽ cao quá và dải điều khiển tràn xuống dưới khung.
              <div className="relative mx-auto aspect-[9/16] h-full overflow-hidden rounded-lg">
                <video
                  ref={videoRef}
                  src={previewUrl}
                  className="h-full w-full object-cover"
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onClick={togglePlay}
                />
                {/* Dải điều khiển chồng đáy khung, nền chuyển mờ để chữ trắng đọc
                    được trên khung hình sáng — cùng lối `PreviewPanel`. */}
                <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8">
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    aria-label={playing ? "Tạm dừng" : "Phát bản đã cắt"}
                    onClick={togglePlay}
                  >
                    {playing ? <PauseIcon /> : <PlayIcon />}
                  </Button>
                  <span className="text-xs text-white tabular-nums">
                    {formatDuration(time)} / {formatDuration(total)}
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

      {/* Dải chạy suốt bề ngang dưới cùng, ba nút (hoàn tác, +/−) đứng cột bên
          phải — cùng chỗ và cùng hình với bàn dựng. KHÔNG còn hàng công cụ phát:
          nó đã lên khung xem. */}
      <Card>
        <CardContent className="min-w-0">
          <div className="flex min-w-0 gap-1">
            <CutLane
              clips={cut.clips}
              strip={cut.strip}
              envelope={cut.envelope}
              spans={spans}
              total={total}
              time={time}
              pxPerSecond={zoom.pxPerSecond}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onSeek={seek}
              onZoom={zoom.zoomBy}
              onResize={(id, start, end) => void cut.resizeSpan(id, start, end)}
              onAddAt={async (at) => {
                const created = await cut.addSpanAt(at);
                if (created) {
                  // Thêm xong ACTIVE luôn: người dùng biết ngay đoạn nào vừa hiện
                  // ra để còn kéo mép cho vừa.
                  setSelectedId(created);
                } else {
                  // Không thêm được thì NÓI — im lặng đọc ra thành "nút hỏng".
                  toast.add({
                    title: "Chỗ này không thêm được",
                    description:
                      "Vạch đang nằm sát một khoảng đã cắt. Dời vạch vào giữa chỗ còn giữ rồi bấm lại.",
                    type: "error",
                  });
                }
              }}
              onDelete={(id) => {
                void cut.deleteSpan(id);
                setSelectedId(null);
              }}
            />
            <TimelineSideRail
              pxPerSecond={zoom.pxPerSecond}
              canZoomIn={zoom.canZoomIn}
              canZoomOut={zoom.canZoomOut}
              onZoom={(direction) =>
                zoom.zoomBy(direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP)
              }
              undoLabel={cut.canUndo ? "lần cắt vừa rồi" : null}
              onUndo={() => {
                void cut.undo();
                setSelectedId(null);
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
