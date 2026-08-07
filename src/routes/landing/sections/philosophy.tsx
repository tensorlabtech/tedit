import { Reveal } from "../reveal";
import { Grain, GridBackdrop, VibrantWash } from "../landing-ui";

/**
 * Khối nhấn triết lý — vì sao Tedit làm khác.
 *
 * Đây là CÚ TƯƠNG PHẢN của trang: giữa một loạt section nền tối, một dải gradient
 * rực tràn cạnh-cạnh (tím → hồng → cam) phủ hạt nhiễu, chữ trắng lớn. Nhịp sáng
 * đột ngột này là thứ các trang mẫu dùng để trang đỡ phẳng. Chỉ có chữ, không số
 * liệu hay lời khen (chưa có thật).
 */
export function Philosophy() {
  return (
    <section className="px-4 py-6">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] px-6 py-16 sm:px-16 sm:py-24">
          <VibrantWash />
          <GridBackdrop className="opacity-20 mix-blend-overlay" />
          <Grain className="opacity-20" />

          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 text-center text-white">
            <p className="font-heading text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
              Máy làm nháp, bạn tinh chỉnh.
            </p>
            <p className="max-w-xl text-base text-pretty text-white/85 sm:text-lg">
              Máy không thay bạn quyết định video nói gì. Nó chỉ bỏ giúp phần nhàm
              và tốn giờ — chép lời, cắt lặng, gieo chữ — để bạn dồn sức vào chỗ cần
              con mắt người: câu chữ, nhịp kể, cảm xúc.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
