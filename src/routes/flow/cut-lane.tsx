import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PlusIcon, ScissorsIcon, Trash2Icon } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ClipLane } from "../editor/timeline-clip-lane";
import type { AudioEnvelope } from "../editor/timeline-audio-lane";
import { TimelineRuler } from "../editor/timeline-ruler";
import { TrimHandles } from "../editor/timeline-trim-handle";
import { formatTime } from "../editor/editor-data";
import {
  useTimelineDrag,
  type TimelineController,
} from "../editor/use-timeline-drag";
import type { CutClip } from "./use-cut-edit";

/**
 * DẢI CẮT — CÙNG mô hình tương tác với bàn dựng, không phải một dải trông giống.
 *
 * ══ VÌ SAO DÙNG CHUNG `useTimelineDrag` ══
 *
 * Đời trước tôi tự dựng một dải: vạch chạy theo giờ, bấm để tua, không kéo được,
 * không lăn được. Nhìn thì hao hao bàn dựng, nhưng đụng vào là khác hẳn — và đó
 * là kiểu "mang sang mà không mang được cái hồn".
 *
 * Giờ dùng THẲNG `useTimelineDrag` của bàn dựng qua một bộ điều khiển nhỏ. Nhờ
 * thế, MIỄN PHÍ mà đúng từng nết:
 *   · vạch GHIM GIỮA (`left-1/2`), phim trôi qua nó — không phải vạch chạy;
 *   · KÉO bất kỳ đâu trên dải để tua;
 *   · LĂN chuột để tua, Ctrl/⌘+lăn để phóng;
 *   · con trỏ `grab`/`grabbing`, không bôi đen chữ khi kéo.
 * Giống vì là MỘT MÃ, không phải vì bắt chước.
 *
 * ══ MỘT TRỤC THỜI GIAN ══
 *
 * `toOutput`/`toSource` ở đây là hàm đồng nhất: bản cắt chưa nướng vào phim nên
 * mốc dải = mốc `base.mp4`. Bàn dựng thì quy đổi giữa hai trục.
 */

/** Khoảng ngắn hơn thì `removeRange` bỏ qua (`server/segments.ts:286`). */
const MIN_SPAN = 0.08;

export type Span = { id: string; start: number; end: number };

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);

export function CutLane({
  clips,
  strip,
  envelope,
  spans,
  total,
  time,
  pxPerSecond,
  selectedId,
  onSelect,
  onSeek,
  onZoom,
  onResize,
  onAddAt,
  onDelete,
}: {
  clips: CutClip[];
  strip: { url: string; seconds: number; nativeSecondWidth: number };
  envelope: AudioEnvelope | null;
  spans: Span[];
  total: number;
  time: number;
  pxPerSecond: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onSeek: (at: number) => void;
  onZoom: (factor: number) => void;
  onResize: (id: string, start: number, end: number) => void;
  /** Thêm một khoảng cắt quanh mốc `at` — hook tự đo độ lặng để định bề rộng. */
  onAddAt: (at: number) => void;
  onDelete: (id: string) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  /** Khoảng đang gọt mép — vẽ theo cái này để mép bám tay, không đợi máy chủ. */
  const [dragSpan, setDragSpan] = useState<Span | null>(null);
  const dragRef = useRef<Span | null>(null);
  /**
   * Mốc của cú CHUỘT PHẢI vừa rồi — để "Thêm tại đây" thêm ĐÚNG chỗ bấm.
   *
   * Menu chuột phải không chuyền được toạ độ vào mục của nó, mà người dùng bấm ở
   * đâu là muốn cắt ở đó — không phải ở vạch giữa. Ghi lại lúc mở menu.
   */
  const rmbTime = useRef(0);

  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const watch = new ResizeObserver(() => setWidth(node.clientWidth));
    watch.observe(node);
    setWidth(node.clientWidth);
    return () => watch.disconnect();
  }, []);

  const center = width / 2;
  // Vạch ghim giữa: dịch cả dải sao cho `time` rơi đúng chính giữa khung. Đúng
  // công thức `timeline.tsx` — phim trôi, vạch đứng yên.
  const offset = center - time * pxPerSecond;

  const timeAtClientX = useCallback(
    (clientX: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect || pxPerSecond === 0) return time;
      return clamp((clientX - rect.left - offset) / pxPerSecond, 0, total);
    },
    [offset, pxPerSecond, time, total],
  );

  /*
   * Bộ điều khiển cho `useTimelineDrag` — đúng mười thành viên nó cần.
   *
   * `trim`/`commitTrim` ở đây gọt mép một KHOẢNG CẮT: `trim` vẽ tạm theo mốc
   * đang kéo, `commitTrim` mới ghi xuống máy chủ. Y hệt bàn dựng gọt mép đoạn.
   */
  const ctrl: TimelineController = useMemo(
    () => ({
      time,
      pxPerSecond,
      seek: onSeek,
      scrubByPixels: (dx: number) =>
        onSeek(clamp(time - dx / pxPerSecond, 0, total)),
      zoomBy: onZoom,
      toOutput: (at: number) => at,
      toSource: (at: number) => at,
      trim: (_kind, id, edge, at) => {
        const base = spans.find((span) => span.id === id);
        if (!base) return;
        const next =
          edge === "start"
            ? { ...base, start: clamp(at, 0, base.end - MIN_SPAN) }
            : { ...base, end: clamp(at, base.start + MIN_SPAN, total) };
        dragRef.current = next;
        setDragSpan(next);
      },
      commitTrim: () => {
        const next = dragRef.current;
        dragRef.current = null;
        setDragSpan(null);
        if (next) onResize(next.id, next.start, next.end);
      },
    }),
    [time, pxPerSecond, total, spans, onSeek, onZoom, onResize],
  );

  const { drag, dragging, setTrimming, startScrub } = useTimelineDrag({
    ctrl,
    viewportRef,
    timeAtClientX,
  });

  const view = spans.map((span) =>
    dragSpan?.id === span.id ? dragSpan : span,
  );
  const shown = view.find((span) => span.id === selectedId) ?? null;
  const range = {
    from: Math.max(0, -offset / (pxPerSecond || 1)),
    to: (-offset + width) / (pxPerSecond || 1),
  };
  const laneWidth = total * pxPerSecond;

  return (
    // Khung định vị: viewport lấp đầy, vạch giữa và nút `+` neo theo tâm của nó —
    // đúng cách `timeline.tsx` xếp (`relative min-w-0 flex-1`).
    <div className="relative min-w-0 flex-1">
      {/* Nút `+` GẮN VÀO VẠCH, ra menu như `+` của bàn dựng. Đứng NGOÀI viewport
          vì viewport `overflow-hidden` sẽ xén phần thò lên. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon-sm"
              tooltipSide="top"
              aria-label="Thêm đoạn cắt tại vạch"
              className="absolute -top-3 left-1/2 z-40 -translate-x-1/2 rounded-full shadow-md hover:bg-primary"
            />
          }
        >
          <PlusIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuItem onClick={() => onAddAt(time)}>
            <ScissorsIcon />
            Thêm đoạn cắt tại vạch
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ContextMenu>
        {/* Chuột phải RA CHỖ TRỐNG (không trúng khoảng cắt nào) hiện menu thêm.
            Trúng một khoảng thì menu riêng của nó (xoá) tiếp quản — xem dưới. */}
        <ContextMenuTrigger
          render={
            <div
              ref={viewportRef}
              data-cut-lane
              // `select-none` + `touch-none`: thiếu cái đầu, kéo dải thành bôi
              // đen chữ; thiếu cái sau, vuốt trên cảm ứng thành cuộn trang. Đúng
              // như `data-timeline` của bàn dựng.
              className="relative h-24 cursor-grab touch-none overflow-hidden rounded-lg bg-muted/40 select-none active:cursor-grabbing"
              onPointerDown={startScrub}
              // Ghi mốc chuột phải TRƯỚC khi menu mở, để "Thêm tại đây" đúng chỗ.
              onContextMenu={(event) =>
                (rmbTime.current = timeAtClientX(event.clientX))
              }
            />
          }
        >
          <div
            className="relative grid gap-1.5 p-2"
            style={{
              transform: `translateX(${offset}px)`,
              width: laneWidth || "100%",
            }}
          >
          <TimelineRuler pxPerSecond={pxPerSecond} range={range} />

          <div className="relative">
            {/* Dải phim KHÔNG bắt chuột: mọi cú bấm rơi xuống viewport thành tua.
                Lớp che cắt nằm TRÊN nó và bắt riêng. */}
            <div className="pointer-events-none">
              <ClipLane
                clips={clips}
                pxPerSecond={pxPerSecond}
                range={range}
                selection={null}
                onSelect={() => {}}
                stripUrl={strip.url}
                stripSeconds={strip.seconds}
                nativeSecondWidth={strip.nativeSecondWidth}
                envelope={envelope}
              />
            </div>

            {view.map((span) => (
              <ContextMenu key={span.id}>
                <ContextMenuTrigger
                  render={
                    <button
                      type="button"
                      data-cut-span={span.id}
                      data-state={span.id === selectedId ? "here" : "off"}
                      tabIndex={-1}
                      title={`Sẽ bỏ ${(span.end - span.start).toFixed(1)} giây`}
                      // Chặn nổi bọt: cú bấm lên lớp che là CHỌN nó, không phải
                      // tua dải phía dưới.
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => onSelect(span.id)}
                      style={{
                        left: span.start * pxPerSecond,
                        width: Math.max(4, (span.end - span.start) * pxPerSecond),
                      }}
                      className={cn(
                        "absolute inset-y-0 z-10 grid cursor-pointer place-items-center overflow-hidden rounded-lane border border-border bg-background/80 bg-[repeating-linear-gradient(45deg,color-mix(in_oklab,var(--color-foreground)_25%,transparent)_0_1px,transparent_1px_14px)] text-foreground",
                        "data-[state=here]:ring-2 data-[state=here]:ring-primary data-[state=here]:ring-inset",
                      )}
                    >
                      {(span.end - span.start) * pxPerSecond >= 56 ? (
                        <span className="flex items-center gap-1 truncate px-1 text-[10px] tabular-nums">
                          <ScissorsIcon className="size-3 shrink-0" />
                          {(span.end - span.start).toFixed(1)}s
                        </span>
                      ) : null}
                    </button>
                  }
                />
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => onDelete(span.id)}>
                    <Trash2Icon />
                    Xoá khoảng cắt
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}

            {shown ? (
              <TrimHandles
                start={shown.start * pxPerSecond}
                end={shown.end * pxPerSecond}
                onGrab={(edge) => {
                  drag.current.moved = true;
                  setTrimming({ kind: "clip", id: shown.id, edge });
                }}
              />
            ) : null}
          </div>
          </div>
        </ContextMenuTrigger>

        {/* Menu chuột phải chỗ trống — thêm đoạn cắt tại đúng mốc vừa bấm,
            KHÔNG phải ở vạch giữa. */}
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onAddAt(rmbTime.current)}>
            <PlusIcon />
            Thêm đoạn cắt tại đây
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Vạch GHIM GIỮA — đứng ngoài dải cuộn nên không bị `overflow-hidden` xén.
          Nhãn giây hiện khi đang kéo, đúng lối bàn dựng. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2"
      >
        <div className="relative h-full w-0.5 bg-foreground shadow-[0_0_0_1px_var(--color-background)]">
          {dragging ? (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 rounded-md bg-foreground px-1.5 py-0.5 text-[10px] leading-none font-medium text-background tabular-nums">
              {formatTime(time)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
