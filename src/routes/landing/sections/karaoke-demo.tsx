import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { Section } from "../landing-section";
import { Eyebrow, GlowOrb } from "../landing-ui";

/**
 * Khối "chữ chạy theo tiếng" — KHÔNG phải thẻ icon như mấy section khác, mà là một
 * màn diễn LIVE chính cái nghề của sản phẩm: một câu tiếng Việt chữ lớn, từng tiếng
 * sáng lên theo nhịp (karaoke), sóng âm chạy theo bên dưới. Đây là thứ đặc trưng
 * riêng của Tedit, nên để nó tự diễn thay vì tả bằng một ô icon.
 */
const WORDS = [
  "Xin", "chào,", "đây", "là", "video", "đầu", "tiên",
  "mình", "dựng", "bằng", "Tedit.",
];

// Sóng âm cố định (không sinh ngẫu nhiên để mỗi lần vẽ ra y hệt).
const BARS = [
  30, 55, 42, 70, 48, 62, 38, 80, 52, 66, 44, 74, 50, 60, 36, 78, 46, 68, 40,
  58, 34, 72, 54, 64, 32, 76, 48, 62, 42, 70, 38, 66, 50, 58, 44, 74,
];

export function KaraokeDemo() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActive(4);
      return;
    }
    const timer = setInterval(() => {
      setActive((i) => (i + 1) % (WORDS.length + 3)); // +3 nhịp nghỉ cuối câu
    }, 420);
    return () => clearInterval(timer);
  }, []);

  // Vị trí sóng âm tương ứng tiếng đang đọc.
  const progress = Math.min(active, WORDS.length) / WORDS.length;

  return (
    <Section className="relative overflow-hidden">
      <GlowOrb className="top-1/2 left-1/2 h-[24rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 opacity-70" />

      <div className="mx-auto flex max-w-4xl flex-col items-center gap-10 text-center">
        <Eyebrow>Chữ chạy theo tiếng</Eyebrow>

        {/* Câu chữ lớn — tiếng đang đọc được tô, tiếng đã qua sáng, tiếng chưa tới mờ. */}
        <p className="font-heading flex flex-wrap justify-center gap-x-3 gap-y-2 text-3xl leading-tight font-semibold text-balance sm:text-5xl sm:leading-tight">
          {WORDS.map((word, index) => (
            <span
              key={index}
              className={cn(
                "rounded-xl px-2 transition-colors duration-200",
                index === active
                  ? "bg-primary text-primary-foreground"
                  : index < active
                    ? "text-foreground"
                    : "text-muted-foreground/40",
              )}
            >
              {word}
            </span>
          ))}
        </p>

        {/* Sóng âm — phần đã đọc mang màu chủ đạo, phần còn lại mờ. */}
        <div className="flex h-16 w-full max-w-xl items-center justify-center gap-1">
          {BARS.map((height, index) => (
            <span
              key={index}
              style={{ height: `${height}%` }}
              className={cn(
                "w-1.5 shrink-0 rounded-full transition-colors duration-300",
                index / BARS.length <= progress
                  ? "bg-primary"
                  : "bg-muted-foreground/20",
              )}
            />
          ))}
        </div>

        <p className="max-w-md text-muted-foreground text-pretty">
          Máy gieo chữ khớp nhịp từng tiếng — như karaoke. Bạn không phải căn
          giờ cho một chữ nào.
        </p>
      </div>
    </Section>
  );
}
