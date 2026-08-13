import { useEffect, useRef, useState } from "react";

/**
 * THANH LẤY PHẦN clip b-roll — hai tay nắm (đầu/cuối) trên chiều dài clip nguồn.
 *
 * B-roll ở app này LẶP để đầy khoảng (theo từ), nên "lấy phần nào của clip" là
 * trục RIÊNG với span trên timeline — vì vậy đặt ở bảng sửa, không phải kéo mép
 * trên dải. Kéo tay nắm đổi LOCAL cho mượt; CHỐT (gọi `onTrim`) lúc THẢ tay để
 * khỏi bơm payload mỗi pixel.
 */
export function InsertTrimBar({
  duration,
  in: inSec,
  out: outSec,
  onTrim,
}: {
  /** Độ dài clip nguồn (giây). */
  duration: number;
  /** Giây bắt đầu/kết thúc trong clip; `null` = mép clip. */
  in: number | null;
  out: number | null;
  /** Chốt lúc thả tay. `null` cho một đầu = trả đầu đó về mép clip. */
  onTrim: (inSec: number | null, outSec: number | null) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Vị trí ĐANG kéo (giây) — đồng bộ từ props khi không kéo.
  const [range, setRange] = useState<{ from: number; to: number }>({
    from: inSec ?? 0,
    to: outSec ?? duration,
  });
  const dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current)
      setRange({ from: inSec ?? 0, to: outSec ?? duration });
  }, [inSec, outSec, duration]);

  const MIN_SPAN = 0.3; // giữ ít nhất 0,3s
  const pct = (s: number) => `${(s / duration) * 100}%`;
  const fmt = (s: number) => `${s.toFixed(1)}s`;

  const startDrag = (which: "from" | "to") => (event: React.PointerEvent) => {
    event.preventDefault();
    dragging.current = true;
    const move = (ev: PointerEvent) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const sec = frac * duration;
      setRange((r) =>
        which === "from"
          ? { ...r, from: Math.min(sec, r.to - MIN_SPAN) }
          : { ...r, to: Math.max(sec, r.from + MIN_SPAN) },
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      dragging.current = false;
      setRange((r) => {
        // Chốt: sát mép clip thì trả `null` (bỏ cắt đầu đó).
        const nextIn = r.from <= 0.05 ? null : Number(r.from.toFixed(2));
        const nextOut =
          r.to >= duration - 0.05 ? null : Number(r.to.toFixed(2));
        onTrim(nextIn, nextOut);
        return r;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const trimmed = range.from > 0.05 || range.to < duration - 0.05;

  return (
    <div className="grid gap-1.5">
      <div
        ref={trackRef}
        className="relative h-10 rounded-md bg-secondary select-none"
      >
        {/* Vùng ĐÃ CHỌN (sáng) trên nền cả clip (tối). */}
        <div
          className="absolute inset-y-0 rounded-md bg-primary/25 inset-ring-1 inset-ring-primary/60"
          style={{ left: pct(range.from), right: `${100 - (range.to / duration) * 100}%` }}
        />
        {/* Tay nắm đầu + cuối. */}
        {(["from", "to"] as const).map((which) => (
          <button
            key={which}
            type="button"
            aria-label={which === "from" ? "Đầu đoạn" : "Cuối đoạn"}
            onPointerDown={startDrag(which)}
            className="absolute top-0 z-10 h-full w-3 -translate-x-1/2 cursor-ew-resize rounded bg-primary"
            style={{ left: pct(which === "from" ? range.from : range.to) }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>{fmt(range.from)}</span>
        <span>
          {trimmed ? `lấy ${fmt(range.to - range.from)}` : `cả clip ${fmt(duration)}`}
        </span>
        <span>{fmt(range.to)}</span>
      </div>
    </div>
  );
}
