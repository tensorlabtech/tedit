import { useEffect, useRef, useState } from "react";
import { ScissorsIcon } from "lucide-react";

import { toast } from "@/components/ui/toast";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/lib/format-duration";

import { TimelineSideRail } from "../editor/timeline-side-rail";
import { useSpacePlayPause } from "../editor/use-space-play-pause";
import { ZOOM_STEP, useTimelineZoom } from "../editor/timeline-zoom";
import { CutLane, type Span } from "./cut-lane";
import { FlowPreview } from "./flow-preview";
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
}: {
  projectId: string | undefined;
  /** `base.mp4` — bản gốc chưa cắt, nên mốc của nó chính là mốc của dải. */
  previewUrl: string | null;
}) {
  const cut = useCutEdit(projectId);
  const { spans, total } = cut;
  // Bản dựng sẽ còn dài bao nhiêu sau khi bỏ các khoảng cắt — để chỉ ra cho
  // người dùng, thay cho đồng hồ chỉ biết độ dài GỐC.
  const kept = Math.max(
    0,
    total - spans.reduce((sum, span) => sum + (span.end - span.start), 0),
  );
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
  /**
   * Hẹn giờ dừng của `audit()` (xem dưới) — giữ handle để HUỶ được.
   *
   * Không giữ thì hẹn giờ cũ vẫn sống: nghe thử một khoảng rồi bấm Cách phát tự
   * do TRƯỚC khi hẹn giờ tới hạn, nó vẫn nổ đúng lúc và dừng phát ngoài ý muốn —
   * người dùng không bấm gì mà video tự đứng lại. Huỷ ở MỌI chỗ có thể đổi trạng
   * thái phát: nghe thử khoảng khác, phát/dừng tay, và khi màn bị gỡ.
   */
  const auditTimeout = useRef<number | null>(null);
  const clearAuditTimeout = () => {
    if (auditTimeout.current !== null) {
      window.clearTimeout(auditTimeout.current);
      auditTimeout.current = null;
    }
  };
  useEffect(() => clearAuditTimeout, []);
  /**
   * Mốc phát THẬT, cập nhật mỗi khung (60fps) cho dải trôi mượt mà không phải đẩy
   * state 60fps. `CutLane` đọc nó trong vòng rAF riêng để lái `transform` trực
   * tiếp; `time` state chỉ còn lo đồng hồ + cửa sổ dựng ảnh (20fps là đủ).
   */
  const liveTimeRef = useRef(0);

  const seek = (at: number) => {
    // KẸP [0, total]. Không kẹp thì kéo dải sang phải đẩy `time` xuống ÂM, và vì
    // vạch ghim giữa nên cả dải trôi tuột sang phải, rời hẳn khỏi vạch — không
    // có mép nào chặn lại. Đúng lỗi "kéo được clip xa khỏi Stick".
    const bounded = Math.max(0, Math.min(total, at));
    const video = videoRef.current;
    if (video) video.currentTime = bounded;
    liveTimeRef.current = bounded;
    setTime(bounded);
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
    // Đọc `currentTime` MỖI khung: ghi vào `liveTimeRef` để `CutLane` lái dải trôi
    // 60fps (mượt, khớp tiếng), CÒN đẩy vào state chỉ ~20 lần/giây — state giờ chỉ
    // lo đồng hồ + cửa sổ dựng ảnh, mà mỗi lần đẩy vẫn dựng lại phần đó nên 60fps
    // thì phí. Tách hai nhịp: hình trôi 60fps, dữ liệu 20fps.
    const PUSH_EVERY_MS = 50;
    let lastPush = 0;
    // ĐỒNG HỒ MEDIA NỘI SUY. `video.currentTime` chỉ nhích theo khung hình video
    // (~30fps, lại không đều) nên đọc thẳng thì dải TRÔI BẬC: có khung đứng rồi
    // khung sau bù gấp đôi — "thi thoảng giật". Neo một mốc (media, đồng hồ tường)
    // rồi chạy mượt rate 1 giữa các nấc; chỉ neo lại khi NHẢY chỗ cắt, tua lùi, hay
    // lệch xa (video khựng). Nhờ vậy dải trôi đều 60fps mà vẫn bám đúng tiếng.
    let anchorAt = 0;
    let anchorPerf = 0;
    let anchored = false;
    const tick = (now: number) => {
      const video = videoRef.current;
      if (video) {
        let at = video.currentTime;
        const here = spans.find((span) => at >= span.start && at < span.end);
        // Bỏ chủ ý nghe khi ĐÃ QUA hết khoảng ấy — từ đó các khoảng bỏ khác lại
        // nhảy qua như thường. KHÔNG bỏ chỉ vì `here` rỗng: quãng đệm dẫn vào
        // (ngay TRƯỚC khoảng) vốn là chỗ còn giữ nên `here` rỗng ở đó; bỏ cờ tại
        // đấy thì tới khoảng cần nghe lại bị nhảy mất — hụt đúng thứ muốn nghe.
        const active = auditing.current
          ? spans.find((span) => span.id === auditing.current)
          : null;
        if (active && at >= active.end) auditing.current = null;
        let jumped = false;
        if (here && auditing.current !== here.id) {
          // Khoảng bỏ CHẠM cuối bản — không còn khung GIỮ nào phía sau. Nhảy tới
          // `here.end` (= khung cuối video gốc) sẽ đứng ở khung của đoạn ĐÃ BỎ rồi
          // đơ luôn ở đó. Thay vào đó DỪNG phát ngay đầu khoảng bỏ — khung giữ cuối.
          if (here.end >= total - 0.01) {
            video.currentTime = here.start;
            video.pause();
            liveTimeRef.current = here.start;
            setTime(here.start);
            return;
          }
          video.currentTime = here.end;
          at = here.end;
          jumped = true;
        }
        // Mốc cho dải trôi — NỘI SUY để mượt: chạy tiếp từ neo bằng đồng hồ tường,
        // neo lại khi lần đầu / nhảy chỗ cắt / tua lùi / lệch > 0,2s (video khựng).
        const predicted = anchorAt + (now - anchorPerf) / 1000;
        if (!anchored || jumped || at < anchorAt - 0.02 || Math.abs(at - predicted) > 0.2) {
          anchorAt = at;
          anchorPerf = now;
          anchored = true;
          liveTimeRef.current = at;
        } else {
          liveTimeRef.current = predicted;
        }
        // Nhảy qua chỗ bỏ thì ĐẨY NGAY để đồng hồ bật tới chỗ mới không trễ; phát
        // trơn thì gộp về 20fps cho khỏi dựng lại dữ liệu quá dày.
        if (jumped || now - lastPush >= PUSH_EVERY_MS) {
          lastPush = now;
          setTime(at);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, spans, total]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    // Phát/dừng TAY thì bỏ hẹn giờ của lần nghe thử trước — không thì nó vẫn nổ
    // đúng lúc và dừng phát tự do ngoài ý muốn.
    clearAuditTimeout();
    if (video.paused) void video.play();
    else video.pause();
  };

  // Phím Cách = phát/dừng, dùng chung bộ giáp với mọi màn có nút phát.
  useSpacePlayPause(togglePlay);

  /*
   * PHÍM TẮT như bàn dựng: Delete xoá khoảng đang chọn, Esc bỏ chọn, ←/→ bước một
   * nhịp. Người dùng đi từ bước này sang bàn dựng dùng đúng một bộ phản xạ, không
   * phải học lại. (Phím Cách do `useSpacePlayPause` lo — xem trên.)
   *
   * Bỏ qua khi đang gõ trong ô nhập — nếu không, phím trong một ô chữ lại thành
   * lệnh của dải.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable]")) return;
      const video = videoRef.current;
      if (event.key === "Escape") {
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
    // `cut.deleteSpan` (không phải `cut`): `useCutEdit` trả một object literal MỚI
    // mỗi lượt vẽ, nên phụ thuộc cả `cut` khiến effect gỡ-gắn lại mỗi lần render.
    // `deleteSpan` tự nó ổn định qua `useCallback` (chỉ đổi khi `projectId` đổi).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, total, cut.deleteSpan]);

  /** Nghe thử một khoảng — phát chính nó dù bản đã-cắt vốn nhảy qua. */
  const audit = (span: Span) => {
    const video = videoRef.current;
    if (!video) return;
    // Nghe thử khoảng MỚI thì huỷ hẹn giờ của khoảng TRƯỚC — không thì hai hẹn
    // giờ đua nhau, và cái cũ dừng phát giữa lúc đang nghe khoảng mới.
    clearAuditTimeout();
    setSelectedId(span.id);
    auditing.current = span.id;
    video.currentTime = Math.max(0, span.start - SEAM);
    void video.play();
    // Dừng ngay sau khi qua hết khoảng: không dừng thì nó chạy tiếp hết video
    // trong khi câu hỏi đã trả lời xong từ lâu.
    auditTimeout.current = window.setTimeout(() => {
      auditTimeout.current = null;
      video.pause();
    }, (span.end - span.start + SEAM * 2) * 1000);
  };

  return (
    <div className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-rows-[minmax(0,1fr)_auto]">
      {/* KHÔNG còn cột "Máy định bỏ".
          Cut ở đây là FREE theo thời gian, nên bản chép lời chỉ là phụ trợ —
          không đáng chiếm một cột. Preview + dải là toàn bộ màn: xem, rồi soát
          và sửa các khoảng cắt NGAY trên dải. Chỗ máy định bỏ hiện thành lớp che
          trên dải, bấm để chọn, chuột phải để nghe/giữ lại. */}
      <div className="grid gap-2 lg:min-h-0">
        {/* Khung xem dùng chung với các bước khác — nút phát chồng lên video. */}
        <FlowPreview
          videoRef={videoRef}
          src={previewUrl}
          playing={playing}
          onToggle={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          playLabel="Phát bản đã cắt"
        >
          <span className="text-xs text-white tabular-nums">
            {formatDuration(time)} / {formatDuration(total)}
          </span>
          {/* Tóm tắt CẮT — thứ hữu ích nhất của cột "Máy định bỏ" cũ: bỏ mấy chỗ
              và bản dựng còn dài bao nhiêu. */}
          {spans.length > 0 ? (
            <span className="ml-auto flex items-center gap-1 text-xs text-white/90 tabular-nums">
              <ScissorsIcon className="size-3" />
              bỏ {spans.length} chỗ · còn {formatDuration(kept)}
            </span>
          ) : null}
        </FlowPreview>
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
              playing={playing}
              liveTimeRef={liveTimeRef}
              pxPerSecond={zoom.pxPerSecond}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onSeek={seek}
              onPause={() => {
                clearAuditTimeout();
                videoRef.current?.pause();
              }}
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
              onAudit={audit}
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
