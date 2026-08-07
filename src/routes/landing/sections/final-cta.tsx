import { LandingSignIn } from "../landing-sign-in";
import { Section } from "../landing-section";
import { GlowOrb } from "../landing-ui";
import { Reveal } from "../reveal";

/**
 * Lời mời cuối trang — nhắc lại cửa vào cho người đã cuộn hết. Dùng lại đúng khối
 * đăng nhập ở hero (không truyền `returnedError` vì lỗi redirect chỉ hiện một lần,
 * ngay chỗ người dùng đáp xuống ở đầu trang).
 */
export function FinalCta({ backTo }: { backTo: string }) {
  return (
    <Section className="relative overflow-hidden">
      <GlowOrb className="bottom-[-8rem] left-1/2 h-[24rem] w-[38rem] -translate-x-1/2" />
      <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
        <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl">
          Sẵn sàng dựng video đầu tiên?
        </h2>
        <p className="max-w-md text-base text-muted-foreground text-pretty sm:text-lg">
          Đăng nhập và tải bản ghi lên — máy lo phần nháp, bạn giữ phần hồn.
        </p>
        <div className="pt-2">
          <LandingSignIn backTo={backTo} size="lg" />
        </div>
      </Reveal>
    </Section>
  );
}
