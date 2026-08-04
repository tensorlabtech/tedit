import { useCallback, useMemo, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/lib/format-duration";

import { TimelineSideRail } from "../editor/timeline-side-rail";
import {
  DEFAULT_PX_PER_SECOND,
  ZOOM_STEP,
  useTimelineZoom,
} from "../editor/timeline-zoom";
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

/**
 * Cận dưới của thang phóng ở bước này: 4px/giây.
 *
 * Đủ để một video mười phút vẫn nằm gọn trong một khung 1100px, tức người dùng
 * luôn có một mức nhìn thấy TOÀN BẢN. Bàn dựng chặn ở 60 vì nó để sửa chi tiết;
 * đây để soát.
 */
const FIT_FLOOR = 4;

/** Đệm mỗi bên trong dải (`p-2`) — phải khớp `LANE_PAD` của `cut-lane.tsx`. */
const LANE_PADDING = 8;

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
  /*
   * Cùng thang phóng với bàn dựng, nhưng CẬN DƯỚI thấp hơn và mở màn ở mức VỪA
   * KHÍT — xem `timeline-zoom.ts`. Ở mức mặc định của bàn dựng, một video 118
   * giây chỉ hiện ra 5,8 giây; bước này để soát cả bản.
   */
  const zoom = useTimelineZoom(DEFAULT_PX_PER_SECOND, FIT_FLOOR);
  const fitted = useRef(false);
  const fitToWidth = useCallback(
    (width: number) => {
      if (fitted.current || width < 50 || total <= 0) return;
      fitted.current = true;
      // Trừ CẢ đệm hai bên (`p-2` mỗi bên) rồi mới chia: quên nó thì dải dài hơn
      // khung đúng 16px, và ở mức vừa khít 16px là gần hai giây cuối bị xén khỏi
      // màn — đúng đoạn chào kết mà người dùng hay muốn soát.
      zoom.setPxPerSecond(Math.max(FIT_FLOOR, (width - LANE_PADDING * 2) / total));
    },
    [total, zoom],
  );
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

  /** Nhảy qua chỗ đã bỏ trong lúc phát — trừ khoảng đang cố ý nghe. */
  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const at = video.currentTime;
    setTime(at);
    const here = spans.find((span) => at >= span.start && at < span.end);
    if (auditing.current && here?.id !== auditing.current) auditing.current = null;
    if (here && auditing.current !== here.id) video.currentTime = here.end;
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

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

        {/* Khung xem KHÔNG có tiêu đề.
            Bản trước để "Bỏ 12 chỗ · 0:59" làm tiêu đề cho khung xem — một con
            số về việc cắt đứng trên một khung chiếu phim, và nó lặp lại đúng
            thứ thẻ bên trái đang nói. Con số ấy về chỗ của nó; khung xem chỉ
            cần chiếu. */}
        <Card className="lg:min-h-0">
          <CardContent className="grid min-h-0 flex-1 place-items-center overflow-hidden">
            {previewUrl ? (
              <video
                ref={videoRef}
                src={previewUrl}
                className="max-h-full max-w-full rounded-lg"
                onTimeUpdate={onTimeUpdate}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onClick={togglePlay}
              />
            ) : (
              <p className="text-muted-foreground text-center">
                Chưa có bản xem trước. Máy đang ghép mạch chính.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dải chạy suốt bề ngang dưới cùng, hai nút phóng đứng ở cột bên phải —
          cùng chỗ và cùng hình với bàn dựng. */}
      <Card>
        <CardContent className="grid min-w-0 gap-2">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={togglePlay}>
              {playing ? <PauseIcon /> : <PlayIcon />}
              {playing ? "Dừng" : "Phát bản đã cắt"}
            </Button>
            <span className="text-muted-foreground tabular-nums text-xs">
              {formatDuration(time)} / {formatDuration(total)}
            </span>
            <span className="flex-1" />
            <span className="text-muted-foreground text-xs">
              Bấm dấu cộng trên vạch để thêm một khoảng · chuột phải một khoảng để
              xoá
            </span>
          </div>

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
              onResize={(id, start, end) => void cut.resizeSpan(id, start, end)}
              onAdd={async (at) => {
                // Không thêm được thì NÓI. Im lặng ở đây đọc ra thành "nút hỏng".
                if (!(await cut.addSpan(at))) {
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
              onMeasure={fitToWidth}
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
