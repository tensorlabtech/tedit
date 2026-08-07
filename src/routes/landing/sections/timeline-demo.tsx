import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { Section } from "../landing-section";
import { SectionHeading } from "../landing-ui";
import { Reveal } from "../reveal";

/**
 * Màn diễn "dòng thời gian nhiều lớp": một playhead quét từ trái sang, các khối trên
 * từng lớp (chữ · cảnh · tư liệu chèn · nhạc) sáng lên khi playhead đi qua — như video
 * đang được dựng dần. Dùng đúng bảng màu lớp của app (chữ tím, tư liệu lam, nhạc lục).
 */
type Clip = { start: number; width: number; label?: string; className: string };

const LANES: { name: string; clips: Clip[] }[] = [
  {
    name: "Chữ",
    clips: [
      { start: 2, width: 20, label: "Xin chào", className: "bg-lane-word text-lane-word-foreground" },
      { start: 24, width: 26, label: "mọi người", className: "bg-lane-word text-lane-word-foreground" },
      { start: 52, width: 18, label: "hôm nay", className: "bg-lane-word text-lane-word-foreground" },
      { start: 72, width: 24, label: "mình kể", className: "bg-lane-word text-lane-word-foreground" },
    ],
  },
  {
    name: "Cảnh",
    clips: [
      { start: 2, width: 46, className: "bg-primary/70" },
      { start: 50, width: 46, className: "bg-primary/50" },
    ],
  },
  {
    name: "Tư liệu",
    clips: [
      { start: 30, width: 22, label: "b-roll", className: "bg-lane-insert text-lane-insert-foreground" },
      { start: 66, width: 18, label: "hình", className: "bg-lane-insert text-lane-insert-foreground" },
    ],
  },
  {
    name: "Nhạc",
    clips: [
      { start: 2, width: 94, label: "nhạc nền", className: "bg-lane-music text-lane-music-foreground" },
    ],
  },
];

export function TimelineDemo() {
  const [head, setHead] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setHead(100);
      return;
    }
    const timer = setInterval(() => {
      setHead((h) => (h >= 100 ? 0 : h + 1));
    }, 55);
    return () => clearInterval(timer);
  }, []);

  return (
    <Section>
      <SectionHeading
        eyebrow="Dòng thời gian"
        title="Nhiều lớp, gọn trong một dòng thời gian"
        subtitle="Chữ, cảnh, tư liệu chèn và nhạc nền — máy xếp sẵn thành từng lớp, khớp đúng lời."
        className="mb-16"
      />

      <Reveal>
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-6">
          {/* Vạch thời gian */}
          <div className="mb-3 flex justify-between px-1 text-xs text-muted-foreground tabular-nums">
            {["0:00", "0:01", "0:02", "0:03", "0:04"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>

          <div className="relative flex flex-col gap-2.5">
            {/* Playhead quét ngang qua các lớp */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-foreground"
              style={{ left: `calc(3rem + (100% - 3rem) * ${head / 100})` }}
            >
              <span className="absolute -top-1 -left-[3px] size-2 rounded-full bg-foreground" />
            </div>

            {LANES.map((lane) => (
              <div key={lane.name} className="flex items-center gap-3">
                <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                  {lane.name}
                </span>
                <div className="relative h-9 flex-1 rounded-lg bg-muted/40">
                  {lane.clips.map((clip, index) => {
                    const passed = head >= clip.start;
                    return (
                      <div
                        key={index}
                        style={{ left: `${clip.start}%`, width: `${clip.width}%` }}
                        className={cn(
                          "absolute inset-y-1 flex items-center overflow-hidden rounded-md px-2 text-xs font-medium whitespace-nowrap transition-all duration-300",
                          clip.className,
                          passed ? "opacity-100" : "opacity-25",
                        )}
                      >
                        {clip.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
