import { cn } from "@/lib/utils";

/**
 * Những mảnh trình bày dùng lại khắp landing — nhãn nhỏ trên tiêu đề, cụm tiêu đề
 * section, và quầng sáng nền. Gom một chỗ để mọi section cùng một nhịp chữ và một
 * kiểu điểm nhấn, không mỗi nơi tự chế.
 */

/** Nhãn nhỏ chữ hoa giãn cách, màu chủ đạo — đứng trên mỗi tiêu đề section. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
      <span className="h-px w-6 bg-primary/50" aria-hidden />
      {children}
    </span>
  );
}

/** Cụm tiêu đề section: nhãn nhỏ + tiêu đề + phụ đề, mặc định căn giữa. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="font-heading max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Quầng sáng mờ đặt sau nội dung cho có chiều sâu — dùng ở hero và dải kêu gọi.
 * `pointer-events-none` + `-z-10` để nó chỉ là nền, không chắn thao tác.
 */
export function GlowOrb({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute -z-10 rounded-full bg-primary/20 blur-[120px]",
        className,
      )}
    />
  );
}

/**
 * Nền lưới mờ dần ra mép — tạo cảm giác "màn hình sản phẩm" mà không cần ảnh thật.
 */
export function GridBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:32px_32px] opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]",
        className,
      )}
    />
  );
}

/**
 * Hạt nhiễu (grain) phủ lên các dải gradient — làm màu bớt "nhựa", có chất phim.
 * Dùng nhiễu SVG nhúng thẳng nên không cần tệp ảnh ngoài.
 */
const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function Grain({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      style={{ backgroundImage: GRAIN_SVG }}
      className={cn(
        "pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay",
        className,
      )}
    />
  );
}

/**
 * Lớp gradient rực dùng cho dải kêu gọi/nhấn — tím sang hồng sang cam, như các
 * trang mẫu. Tách ra để dùng lại và chỉnh một chỗ.
 */
export function VibrantWash({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,var(--color-primary),oklch(0.6_0.22_350)_55%,oklch(0.62_0.2_30))]",
        className,
      )}
    />
  );
}
