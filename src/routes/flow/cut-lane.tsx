import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PlusIcon, ScissorsIcon, Trash2Icon } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { ClipLane } from "../editor/timeline-clip-lane";
import type { AudioEnvelope } from "../editor/timeline-audio-lane";
import { TimelineRuler } from "../editor/timeline-ruler";
import { TrimHandles } from "../editor/timeline-trim-handle";
import type { CutClip } from "./use-cut-edit";

/**
 * DẢI CẮT — dải phim của bàn dựng, các khoảng cắt là LỚP CHE đè lên.
 *
 * ══ DẢI KHÔNG VỠ THEO SỐ LẦN CẮT ══
 *
 * Đời trước vẽ dải thành một hàng lát nối nhau, mỗi lát giữ hoặc bỏ. Sai ở nền:
 * cắt thêm một chỗ là dải mọc thêm hai lằn chia, nên càng sửa thì phim càng
 * trông như bị băm nhỏ — mà người dùng có bỏ clip nào đi đâu.
 *
 * Ở đây dải là ĐÚNG những clip đã nạp, nối đuôi nhau, đứng yên suốt bước. Chỗ
 * sắp bị bỏ chỉ là một lớp CHE đè lên trên, lối CapCut: nhìn xuyên qua vẫn thấy
 * khung hình bên dưới, nên đọc ra "chỗ này sẽ mất" mà không mất luôn hình để
 * biết mình đang bỏ cái gì.
 *
 * Bên dưới vẫn là bảng `segments`: một khoảng cắt là một đoạn có `removed`.
 * Không thêm bảng, không thêm cơ chế — chỉ đổi cách nhìn.
 *
 * ══ MẢNH DẢI LẤY THẲNG CỦA BÀN DỰNG ══
 *
 * `ClipLane` (ảnh phim + sóng), `TimelineRuler`, `TrimHandles`, `TimelineSideRail`
 * và cả thang phóng đều dùng nguyên. Ban đầu tôi tự dựng thước, tự dựng sóng, tự
 * đặt nấc phóng — ra một cái dải trông GẦN GIỐNG mà lệch từng chỗ nhỏ: khác bước
 * chia, khác cỡ vùng bắt mép, khác nấc phóng. Người dùng đi từ bước này sang bàn
 * dựng sẽ thấy hai dải "hơi khác nhau" mà không nói được khác chỗ nào, và mỗi
 * lần chỉnh hình là hai chỗ phải sửa.
 *
 * Chỉ LỚP CHE là mới, vì đó đúng là thứ bàn dựng không có.
 */

/** Khoảng ngắn hơn thì `removeRange` bỏ qua (`server/segments.ts:286`). */
const MIN_SPAN = 0.08;

/**
 * Đệm của lớp trong (`p-2`), tính bằng pixel — PHẢI trừ khi đổi toạ độ ra giây.
 *
 * Mọi thứ trên dải nằm trong một lớp có đệm 8px, nên một mốc giây `t` vẽ ra ở
 * `hộp.left + offset + 8 + t·thang`. Quên số 8 ấy thì phép đổi ngược lệch đúng
 * `8 / thang` giây.
 *
 * Ở thang mặc định của bàn dựng (200px/giây) lệch 0,04 giây — không ai thấy.
 * Ở mức vừa khít một video hai phút (9,9px/giây) lệch 0,81 giây: bấm giữa một
 * chỗ trống 1,4 giây thì vạch rơi sang tận khoảng cắt kế bên. Đo thật: bấm ở
 * 9,43 giây, vạch dừng ở 10,23.
 *
 * Lỗi kiểu này càng thu nhỏ càng nặng, nên nó nấp kỹ ở mọi mức phóng thường ngày.
 */
const LANE_PAD = 8;

/**
 * Hẹp hơn ngần này thì lớp che KHÔNG ghi chữ.
 *
 * Chụp ở mức vừa khít: mười hai lớp che rộng 20–50px, mỗi cái cố nhét "✂ 2.4s"
 * vào, và chữ bị xén ngang thân — cả dải đọc ra thành một hàng rác. Con số ấy
 * đã có ở hàng soát bên trái rồi; trên dải thì việc của lớp che là chỉ chỗ, và
 * một mảng gạch làm việc đó tốt hơn một dòng chữ cụt.
 */
const LABEL_MIN_WIDTH = 56;

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
  onResize,
  onAdd,
  onDelete,
  onMeasure,
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
  onResize: (id: string, start: number, end: number) => void;
  onAdd: (at: number) => void;
  onDelete: (id: string) => void;
  /** Bề ngang thật của khung — nơi gọi cần nó để mở màn ở mức vừa khít. */
  onMeasure?: (width: number) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [trimming, setTrimming] = useState<"start" | "end" | null>(null);
  /** Mép đang kéo — vẽ theo cái này để lớp che bám tay ngay, không đợi máy chủ. */
  const [drag, setDrag] = useState<Span | null>(null);
  const dragRef = useRef<Span | null>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const tell = () => {
      setBoxWidth(box.clientWidth);
      onMeasure?.(box.clientWidth);
    };
    const watch = new ResizeObserver(tell);
    watch.observe(box);
    tell();
    return () => watch.disconnect();
  }, [onMeasure]);

  const laneWidth = total * pxPerSecond;
  /*
   * Ghim vạch vào giữa khung như bàn dựng, nhưng CHẶN ở hai đầu.
   *
   * Bàn dựng không chặn vì nó luôn phóng lớn. Ở đây bước SOÁT hay xem cả bản một
   * lượt, và lúc dải hẹp hơn khung thì công thức ghim-giữa đẩy nó lệch hẳn sang
   * phải, để lại một mảng trống bên trái mà không ai đoán ra vì sao.
   */
  const offset =
    laneWidth <= boxWidth
      ? 0
      : clamp(boxWidth / 2 - time * pxPerSecond, boxWidth - laneWidth, 0);

  const atOf = (clientX: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || pxPerSecond === 0) return 0;
    return clamp(
      (clientX - box.left - offset - LANE_PAD) / pxPerSecond,
      0,
      total,
    );
  };

  const selected = spans.find((span) => span.id === selectedId) ?? null;

  /*
   * Kéo mép nghe ở CỬA SỔ, không ở chính tay nắm.
   *
   * Cùng lối `useTrimDrag` của bàn dựng: tay nắm chỉ rộng 14px, mà kéo nhanh thì
   * con trỏ ra khỏi nó giữa chừng — nghe ở tay nắm là cú kéo đứt ngang và mép
   * đứng lại ở chỗ ngẫu nhiên.
   */
  useEffect(() => {
    if (!trimming || !selected) return;
    const shape = (at: number): Span =>
      trimming === "start"
        ? { ...selected, start: clamp(at, 0, selected.end - MIN_SPAN) }
        : { ...selected, end: clamp(at, selected.start + MIN_SPAN, total) };
    const move = (event: PointerEvent) => {
      const next = shape(atOf(event.clientX));
      dragRef.current = next;
      setDrag(next);
    };
    const up = () => {
      const next = dragRef.current;
      setTrimming(null);
      setDrag(null);
      dragRef.current = null;
      if (next) onResize(next.id, next.start, next.end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [trimming, selected, total, offset, pxPerSecond, onResize]);

  const view = spans.map((span) => (drag?.id === span.id ? drag : span));
  const shown = view.find((span) => span.id === selectedId) ?? null;
  const range = {
    from: Math.max(0, -offset / (pxPerSecond || 1)),
    to: (-offset + boxWidth) / (pxPerSecond || 1),
  };

  return (
    <div
      ref={boxRef}
      data-cut-lane
      /*
       * `min-w-0` KHÔNG được thiếu.
       *
       * Đây là một ô flex, mà ô flex mặc định `min-width:auto` — nó phình ra
       * bằng NỘI DUNG, tức bằng cả dải. Đo thật: khung rộng 23582px thay vì
       * ~1100px. Ba hậu quả, không cái nào tự báo: cả trang tràn ngang; `boxWidth`
       * đọc ra 23582 nên phép ghim vạch vào giữa không bao giờ chạy; và mọi cú
       * bấm quá giây thứ năm rơi ra ngoài màn hình.
       */
      className="relative min-w-0 flex-1 overflow-hidden"
      onPointerDown={(event) => {
        // Bấm trúng một lớp che thì nó đã chặn nổi bọt — tới đây tức là bấm ra
        // chỗ trống, và chỗ trống nghĩa là "đưa tôi tới đây".
        onSelect(null);
        onSeek(atOf(event.clientX));
      }}
    >
      <div
        className="relative grid gap-1.5 p-2"
        style={{
          width: Math.max(laneWidth, boxWidth),
          transform: `translateX(${offset}px)`,
        }}
      >
        <TimelineRuler pxPerSecond={pxPerSecond} range={range} />

        <div className="relative">
          {/*
            DẢI PHIM KHÔNG BẮT CHUỘT.

            `ClipLane` chặn nổi bọt ở mỗi khối để bàn dựng CHỌN được clip. Ở bước
            này clip không chọn được — nó là thứ đã nạp xong từ bước 1 — nên phép
            chặn ấy biến cả dải phim thành vùng chết: bấm vào phim thì vạch đứng
            im, và nút cộng thêm khoảng vào giây 0 thay vì chỗ vừa bấm. Đo được
            đúng vậy: bấm ở giây 13,3 mà số khoảng không đổi, vì giây 0 đã có sẵn
            một khoảng cắt lặng đầu bản.

            Cho cả lớp phim thôi bắt chuột thì mọi cú bấm rơi xuống dải và thành
            "đưa tôi tới đây" — còn lớp che thì nằm TRÊN nó và vẫn bấm được.
          */}
          <div className="pointer-events-none">
          <ClipLane
            clips={clips}
            pxPerSecond={pxPerSecond}
            range={range}
            // Bước này không chọn clip — clip là thứ đã nạp xong ở bước 1, ở đây
            // chỉ có khoảng cắt là chọn được.
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
              {/* Base UI dùng `render`, không dùng `asChild`. `display:contents`
                  để lớp bọc không sinh ra một hộp nào trên dải. */}
              <ContextMenuTrigger render={<div className="contents" />}>
                <button
                  type="button"
                  data-cut-span={span.id}
                  data-state={span.id === selectedId ? "here" : "off"}
                  tabIndex={-1}
                  title={`Sẽ bỏ ${(span.end - span.start).toFixed(1)} giây`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onSelect(span.id)}
                  style={{
                    left: span.start * pxPerSecond,
                    width: Math.max(4, (span.end - span.start) * pxPerSecond),
                  }}
                  className="rounded-lane absolute inset-y-0 z-10 grid cursor-pointer place-items-center overflow-hidden border border-border bg-background/80 bg-[repeating-linear-gradient(45deg,color-mix(in_oklab,var(--color-foreground)_25%,transparent)_0_1px,transparent_1px_14px)] text-foreground data-[state=here]:ring-2 data-[state=here]:ring-primary data-[state=here]:ring-inset"
                >
                  {(span.end - span.start) * pxPerSecond >= LABEL_MIN_WIDTH ? (
                    <span className="flex items-center gap-1 truncate px-1 text-[10px] tabular-nums">
                      <ScissorsIcon className="size-3 shrink-0" />
                      {(span.end - span.start).toFixed(1)}s
                    </span>
                  ) : null}
                </button>
              </ContextMenuTrigger>
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
              onGrab={setTrimming}
            />
          ) : null}
        </div>

        {/*
          VẠCH có nút cộng ở đầu.
          Thêm một khoảng là việc gắn với MỘT MỐC, nên nút mọc ra từ chính cái mốc
          ấy. Để nút vào hàng công cụ thì bấm xong người dùng còn phải tự tìm xem
          nó vừa thêm ở đâu.
        */}
        <span
          aria-hidden
          style={{ left: time * pxPerSecond }}
          className="bg-primary pointer-events-none absolute inset-y-0 z-30 w-0.5 -translate-x-1/2"
        />
        <button
          type="button"
          aria-label="Thêm khoảng cắt tại đây"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onAdd(time)}
          style={{ left: time * pxPerSecond }}
          className="bg-primary text-primary-foreground absolute top-0 z-40 grid size-4 -translate-x-1/2 cursor-pointer place-items-center rounded-full"
        >
          <PlusIcon className="size-3" />
        </button>
      </div>
    </div>
  );
}
