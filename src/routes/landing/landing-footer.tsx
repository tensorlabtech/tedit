import { AppLogo } from "@/components/app-logo";

/**
 * Chân trang nhiều cột. Các liên kết còn là chỗ giữ (`href="#"` + chặn nhảy trang)
 * — trang thật chưa dựng, nối sau. Tông trầm, tách khỏi thân bằng một viền gợi mép.
 */
const COLUMNS = [
  {
    title: "Sản phẩm",
    links: ["Tính năng", "Cách hoạt động", "Câu hỏi"],
  },
  {
    title: "Công ty",
    links: ["Giới thiệu", "Liên hệ", "Tuyển dụng"],
  },
  {
    title: "Pháp lý",
    links: ["Điều khoản", "Quyền riêng tư"],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <AppLogo />
          <p className="max-w-xs text-sm text-muted-foreground text-pretty">
            Từ bản ghi thành video có chữ, có nhạc, có tư liệu chèn. Máy làm nháp,
            bạn tinh chỉnh.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title} className="flex flex-col gap-3">
            <span className="text-sm font-semibold">{column.title}</span>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link}>
                  <a
                    href="#"
                    // Trang thật chưa dựng — chặn cú nhảy về đầu trang mà `href="#"`
                    // gây ra, tới khi có route thật thì trỏ href đúng chỗ.
                    onClick={(event) => event.preventDefault()}
                    className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 text-xs text-muted-foreground">
          <span>Bản thử nội bộ · 2026</span>
        </div>
      </div>
    </footer>
  );
}
