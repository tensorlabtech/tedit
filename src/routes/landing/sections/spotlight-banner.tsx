import { Eyebrow } from "../landing-ui";
import { Reveal } from "../reveal";

/**
 * Dải ảnh lớn có chữ đè — kiểu section ảnh full-bleed của Filmora ("Dolby Vision").
 * Một khung cinematic để trang đỡ toàn thẻ, thêm nhịp. Ảnh mock (người Việt quay
 * trước máy) — thay bằng ảnh thật khi có.
 */
export function SpotlightBanner() {
  return (
    <section className="px-4 py-20 sm:py-28">
      <Reveal>
        <div className="relative mx-auto flex min-h-[24rem] max-w-6xl items-center overflow-hidden rounded-3xl border border-border sm:min-h-[30rem]">
          <img
            src="/landing/mock/vlogger.jpg"
            alt="Một người đang tự quay video nói trước máy"
            loading="lazy"
            className="absolute inset-0 size-full object-cover object-center"
          />
          {/* Màn tối phủ từ trái để chữ nổi; ảnh vẫn lộ ở phải. */}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/10" />

          <div className="relative flex max-w-lg flex-col items-start gap-5 p-8 sm:p-14">
            <Eyebrow>Nói là xong</Eyebrow>
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Bạn chỉ cần nói trước máy — phần còn lại để Tedit lo
            </h2>
            <p className="text-pretty text-muted-foreground sm:text-lg">
              Quay một mạch như đang trò chuyện. Máy chép lời, cắt quãng lặng và
              gieo chữ; bạn chỉ nghe lại và chỉnh chỗ cần.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
