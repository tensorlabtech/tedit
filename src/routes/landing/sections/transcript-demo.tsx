import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { Section } from "../landing-section";
import { Eyebrow } from "../landing-ui";
import { Reveal } from "../reveal";

/**
 * Màn diễn "máy chép lời": bản chép hiện dần từng tiếng như đang được gõ ra, những
 * chỗ máy nghe chưa chắc thì gạch chân + tô tím để người soát. KHÔNG phải thẻ icon —
 * đây là chính cái nghề của sản phẩm tự diễn ra trước mắt.
 */
type Token = { text: string; uncertain?: boolean };

const TRANSCRIPT: Token[] = [
  { text: "Xin" }, { text: "chào" }, { text: "mọi" }, { text: "người," },
  { text: "mình" }, { text: "là" }, { text: "một" },
  { text: "frontend", uncertain: true }, { text: "developer." },
  { text: "Video" }, { text: "này" }, { text: "mình" }, { text: "nói" },
  { text: "về" }, { text: "chuyện" }, { text: "tìm" },
  { text: "việc", uncertain: true }, { text: "cuối" }, { text: "năm." },
  { text: "Bình" }, { text: "thường" }, { text: "thì" }, { text: "mình" },
  { text: "hay" }, { text: "dành" }, { text: "ra" }, { text: "vài" },
  { text: "tuần" }, { text: "để" }, { text: "làm" },
  { text: "content", uncertain: true }, { text: "cho" }, { text: "kênh." },
];

export function TranscriptDemo() {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(TRANSCRIPT.length);
      return;
    }
    const timer = setInterval(() => {
      setShown((n) => (n >= TRANSCRIPT.length ? 0 : n + 1));
    }, 130);
    return () => clearInterval(timer);
  }, []);

  const uncertainShown = TRANSCRIPT.slice(0, shown).filter(
    (t) => t.uncertain,
  ).length;

  return (
    <Section className="bg-muted/20">
      <Reveal className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div className="flex flex-col items-start gap-5">
          <Eyebrow>Máy chép lời</Eyebrow>
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Chép xong cả bài — bạn chỉ soát chỗ ngờ
          </h2>
          <p className="max-w-md text-muted-foreground text-pretty sm:text-lg">
            Máy chép lời tiếng Việt đầy đủ dấu trong lúc bạn ngồi chờ. Chỗ nào nghe
            chưa chắc, nó{" "}
            <span className="text-primary underline decoration-primary/50 underline-offset-4">
              tô sẵn
            </span>{" "}
            để bạn nghe lại và sửa — không phải dò cả bài.
          </p>
        </div>

        {/* Khung bản chép — chữ hiện dần, chỗ ngờ gạch chân tím. */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-3 text-sm">
            <span className="font-medium">Bản chép lời</span>
            <span className="text-muted-foreground tabular-nums">
              Nghe chưa chắc: {uncertainShown}
            </span>
          </div>
          <p className="flex min-h-64 flex-wrap content-start gap-x-1.5 gap-y-1.5 p-5 text-lg leading-relaxed">
            {TRANSCRIPT.map((token, index) => (
              <span
                key={index}
                className={cn(
                  "transition-opacity duration-200",
                  index < shown ? "opacity-100" : "opacity-0",
                  token.uncertain &&
                    index < shown &&
                    "rounded bg-primary/15 px-0.5 text-primary underline decoration-primary/60 underline-offset-4",
                )}
              >
                {token.text}
              </span>
            ))}
            {/* Con trỏ nhấp nháy ở đầu bút. */}
            {shown < TRANSCRIPT.length ? (
              <span className="inline-block h-6 w-0.5 animate-pulse bg-primary align-middle" />
            ) : null}
          </p>
        </div>
      </Reveal>
    </Section>
  );
}
