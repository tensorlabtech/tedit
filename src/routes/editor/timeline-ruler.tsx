import { formatTime } from "./editor-data";

const TICK_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60];

/** Chọn bước chia thước sao cho hai nhãn cách nhau ít nhất 72px. */
function pickStep(pxPerSecond: number) {
  return (
    TICK_STEPS.find((step) => step * pxPerSecond >= 72) ??
    TICK_STEPS[TICK_STEPS.length - 1]
  );
}

export type Range = { from: number; to: number };

export function TimelineRuler({
  pxPerSecond,
  range,
}: {
  pxPerSecond: number;
  range: Range;
}) {
  const step = pickStep(pxPerSecond);
  const ticks: number[] = [];
  for (
    let value = Math.floor(range.from / step) * step;
    value <= range.to;
    value += step
  ) {
    if (value >= 0) ticks.push(Number(value.toFixed(3)));
  }

  return (
    <div className="relative h-5">
      {ticks.map((value) => (
        <div
          key={value}
          className="absolute top-0 flex h-full items-center gap-1"
          style={{ left: value * pxPerSecond }}
        >
          <span className="h-2 w-px bg-border" />
          <span className="text-xs text-muted-foreground tabular-nums">
            {step < 1
              ? `${formatTime(value)}.${Math.round((value % 1) * 10)}`
              : formatTime(value)}
          </span>
        </div>
      ))}
    </div>
  );
}
