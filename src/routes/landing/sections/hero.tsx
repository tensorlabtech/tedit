import { ArrowDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { LandingSignIn } from "../landing-sign-in";
import { Eyebrow, GlowOrb } from "../landing-ui";
import { ProductFrame } from "../product-frame";

/**
 * Khối đầu trang — bất đối xứng như Filmora: lời chào bên trái, ảnh bàn dựng thật
 * bên phải. Không nhồi hiệu ứng (coverflow, chip bay) — sự chỉn chu đến từ chữ gọn,
 * ảnh sản phẩm lớn và khoảng thở, không phải từ đồ trang trí.
 *
 * Ô đăng nhập mang `id="sign-in"` để nút trên nav cuộn tới.
 */
export function Hero({
  backTo,
  returnedError,
}: {
  backTo: string;
  returnedError: string;
}) {
  const scrollToSteps = () => {
    document
      .getElementById("cach-hoat-dong")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden px-4 pt-14 pb-20 sm:pt-20 sm:pb-24">
      {/* Một quầng sáng chủ đạo phía sau ảnh — đủ để nền không phẳng đen, không hơn. */}
      <GlowOrb className="top-0 right-0 h-[30rem] w-[38rem] translate-x-1/4" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start gap-6 text-left">
          <Eyebrow>Trình dựng video tiếng Việt</Eyebrow>

          <h1 className="font-heading text-4xl leading-[1.12] font-semibold tracking-tight text-balance sm:text-5xl">
            Từ bản ghi thành{" "}
            <span className="text-primary">video hoàn chỉnh</span> — có chữ, có
            nhạc, có tư liệu chèn
          </h1>

          <p className="max-w-lg text-base text-pretty text-muted-foreground sm:text-lg">
            Tải bản ghi lên, máy chép lời tiếng Việt, cắt quãng lặng, gieo chữ
            theo từng tiếng và dựng sẵn một bản nháp. Bạn chỉ sửa những chỗ cần
            sửa.
          </p>

          <div id="sign-in" className="scroll-mt-24 pt-1">
            <LandingSignIn
              backTo={backTo}
              returnedError={returnedError}
              size="lg"
              align="start"
              showDev
              secondary={
                <Button variant="outline" size="lg" onClick={scrollToSteps}>
                  Xem cách hoạt động
                  <ArrowDownIcon data-icon="inline-end" />
                </Button>
              }
            />
          </div>
        </div>

        <ProductFrame
          src="/landing/studio.png"
          alt="Bàn dựng Tedit: bản chép lời, xem trước và dòng thời gian nhiều lớp"
          glow
        />
      </div>
    </section>
  );
}
