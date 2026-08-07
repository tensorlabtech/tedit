import { AppLogo } from "@/components/app-logo";
import { Button } from "@/components/ui/button";

/**
 * Thanh trên cùng của trang giới thiệu — dính lại khi cuộn.
 *
 * Nút "Đăng nhập" KHÔNG tự gọi đăng nhập mà cuộn về ô đăng nhập ở hero: cả trang
 * chỉ có MỘT chỗ bày nút Google thật (kèm dòng báo lỗi và câu "chỉ mở cho tài
 * khoản được cấp quyền"). Thêm một cửa thứ hai ở đây thì lỗi biết hiện ở đâu.
 *
 * Nền mờ + `backdrop-blur`: nội dung cuộn qua dưới thanh vẫn đọc thoáng.
 */
const LINKS = [
  { label: "Cách hoạt động", target: "cach-hoat-dong" },
  { label: "Tính năng", target: "tinh-nang" },
  { label: "Câu hỏi", target: "cau-hoi" },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export function LandingNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/70 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <AppLogo />

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Button
              key={link.target}
              variant="ghost"
              size="sm"
              onClick={() => scrollTo(link.target)}
            >
              {link.label}
            </Button>
          ))}
        </nav>

        <Button size="sm" onClick={() => scrollTo("sign-in")}>
          Đăng nhập
        </Button>
      </div>
    </header>
  );
}
