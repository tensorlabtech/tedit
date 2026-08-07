import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { GridBackdrop } from "./landing-ui";

/**
 * Khung "màn hình sản phẩm" — chỗ giữ cho ảnh/clip bàn dựng chưa có.
 *
 * Không vẽ giao diện giả (rối và thiếu chỉn chu) và cũng không để một ô trống trơn
 * (nhìn dở dang). Thay vào đó là một khung cửa sổ đóng khung tử tế: thanh trên có
 * ba chấm và một thanh địa chỉ giả, trong lòng là nền lưới mờ dần cùng một quầng
 * sáng chủ đạo, giữa đặt một dấu gợi ý. Đọc ra ngay là "màn hình sản phẩm sẽ nằm
 * đây". Khi có ảnh/clip thật thì thay cả phần lòng bằng `<img>`/`<video>`.
 */
export function ProductFrame({
  label,
  icon: Icon = ImageIcon,
  aspect = "aspect-video",
  glow = false,
  src,
  alt = "",
  className,
}: {
  label?: string;
  icon?: typeof ImageIcon;
  /** Lớp tỉ lệ Tailwind cho phần lòng, mặc định 16:9. */
  aspect?: string;
  /** Bật quầng sáng phía sau — dùng cho khung lớn ở hero. */
  glow?: boolean;
  /** Ảnh chụp sản phẩm thật; có thì hiện ảnh, chưa có thì hiện khung gợi ý. */
  src?: string;
  alt?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {glow ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-10 top-10 bottom-0 -z-10 rounded-full bg-primary/25 blur-[100px]"
        />
      ) : null}

      {/* Hai lớp khung: mảng ngoài mỏng tạo gờ kính, khung trong là cửa sổ. */}
      <div className="rounded-2xl border border-border bg-gradient-to-b from-muted/50 to-card p-2 shadow-2xl ring-1 ring-inset ring-white/5">
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          {/* Thanh tiêu đề cửa sổ: ba chấm + thanh địa chỉ giả. */}
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2.5">
            <span className="flex gap-1.5" aria-hidden>
              <span className="size-2.5 rounded-full bg-muted-foreground/25" />
              <span className="size-2.5 rounded-full bg-muted-foreground/25" />
              <span className="size-2.5 rounded-full bg-muted-foreground/25" />
            </span>
            <span
              className="mx-auto h-5 w-1/2 max-w-56 rounded-full bg-muted-foreground/10"
              aria-hidden
            />
          </div>

          {/* Lòng khung: ảnh thật nếu có, không thì nền lưới mờ + dấu gợi ý. */}
          <div className={cn("relative flex items-center justify-center overflow-hidden", aspect)}>
            {src ? (
              <img
                src={src}
                alt={alt}
                loading="lazy"
                className="absolute inset-0 size-full object-cover object-top"
              />
            ) : (
              <>
                <GridBackdrop />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-primary)/12,transparent_60%)]"
                />
                <div className="relative flex flex-col items-center gap-2.5 text-muted-foreground">
                  <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-card/80 backdrop-blur">
                    <Icon className="size-5 opacity-70" />
                  </span>
                  {label ? (
                    <span className="text-xs font-medium opacity-80">{label}</span>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
