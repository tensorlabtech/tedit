import { useLocation, useSearchParams } from "react-router-dom";

import { LandingFooter } from "./landing-footer";
import { LandingNav } from "./landing-nav";
import { Faq } from "./sections/faq";
import { FinalCta } from "./sections/final-cta";
import { Hero } from "./sections/hero";
import { KaraokeDemo } from "./sections/karaoke-demo";
import { Philosophy } from "./sections/philosophy";
import { ShowcaseTabs } from "./sections/showcase-tabs";
import { SpotlightBanner } from "./sections/spotlight-banner";
import { TimelineDemo } from "./sections/timeline-demo";
import { TranscriptDemo } from "./sections/transcript-demo";
import { TrustStrip } from "./sections/trust-strip";
import { UseCases } from "./sections/use-cases";

/**
 * Lời giải thích cho mã lỗi Google/Better Auth trả về trên đường dẫn.
 *
 * Nói ĐÚNG chuyện đã xảy ra thay vì "đăng nhập thất bại": email chưa được cấp
 * quyền là chuyện người dùng không tự sửa được, mà một câu chung chung sẽ khiến
 * họ bấm lại năm lần rồi mới nghĩ tới việc đi hỏi.
 */
const ERROR_TEXT: Record<string, string> = {
  access_denied: "Bạn đã huỷ ở bước Google hỏi quyền.",
  FORBIDDEN: "Email này chưa được cấp quyền dùng ứng dụng.",
  forbidden: "Email này chưa được cấp quyền dùng ứng dụng.",
  signup_disabled: "Email này chưa được cấp quyền dùng ứng dụng.",
  unable_to_create_user: "Email này chưa được cấp quyền dùng ứng dụng.",
};

/**
 * Trang giới thiệu — thứ người CHƯA đăng nhập thấy ở `/`.
 *
 * Trang marketing cuộn dài: nav dính trên, hero với khung sản phẩm, các khối giới
 * thiệu, khép lại bằng lời mời đăng nhập và chân trang. Giữ tông của app (design
 * system, màu Nova) để trang này và bảng điều khiển ngay sau lúc đăng nhập đọc ra
 * là cùng một sản phẩm — `/` được miễn luật một-thẻ-phủ-màn nên ở đây cho cuộn.
 */
export function LandingPage() {
  const [params] = useSearchParams();
  const location = useLocation();

  /**
   * Chỗ `RequireSession` vừa chặn họ lại, để đăng nhập xong quay về đúng đó.
   *
   * Chỉ nhận đường dẫn NỘI BỘ: giá trị này đi qua trạng thái điều hướng nên người
   * ngoài gửi được một liên kết mang `//nơi-khác.com` vào đây, và như thế trang
   * này thành bàn đạp đưa người dùng sang chỗ họ chọn.
   */
  const from = (location.state as { from?: string } | null)?.from;
  const backTo = from?.startsWith("/") && !from.startsWith("//") ? from : "/";

  // Lỗi Google trả về trên đường dẫn sau khi quay lại — hiện ở ô đăng nhập tại hero,
  // nơi người dùng đáp xuống. Lời gọi hỏng ngay tại chỗ do khối đăng nhập tự lo.
  const returned = params.get("error");
  const returnedError = returned
    ? (ERROR_TEXT[returned] ?? "Không đăng nhập được.")
    : "";

  return (
    // TỐI HẾT theo đúng chất tối tối giản của app (Nova): nền không đổi theo giao
    // diện máy, các section phân tầng bằng nâng nền tinh tế (nền trang ↔ mặt thẻ ↔
    // muted) và hoạ tiết mờ, KHÔNG lật sáng/tối gắt. Bàn dựng sau đăng nhập vẫn theo
    // giao diện máy như cũ.
    <div className="dark min-h-svh overflow-x-hidden bg-background text-foreground">
      <LandingNav />
      <main>
        <Hero backTo={backTo} returnedError={returnedError} />
        <TrustStrip />
        <KaraokeDemo />
        <TranscriptDemo />
        <TimelineDemo />
        <ShowcaseTabs />
        <SpotlightBanner />
        <UseCases />
        <Philosophy />
        <Faq />
        <FinalCta backTo={backTo} />
      </main>
      <LandingFooter />
    </div>
  );
}
