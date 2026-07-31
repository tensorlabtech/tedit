import { LogOutIcon, MessageCircleIcon } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { AppLogo } from "@/components/app-logo";
import { ThemeToggleIcon } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { signOut, useSession } from "@/lib/auth-client";

import { MENU } from "./dashboard-menu";

/** Trang cá nhân để người dùng liên hệ khi cần. */
const CONTACT_URL = "https://www.facebook.com/lehuythaidotcom/";

/**
 * Đệm lề của thanh bên, khớp `--card-spacing` của `Card` (20px).
 *
 * Ghi thành hằng số vì ba khu — đầu, thân, chân — phải cùng một giá trị, mà rải
 * `p-5` ra ba chỗ thì sửa một chỗ quên hai chỗ. Không đọc thẳng `--card-spacing`
 * được: biến đó khai ngay trên thẻ `Card` nên bên ngoài thẻ nó không tồn tại.
 *
 * Thu về dạng icon thì hạ xuống 8px: bề ngang chỉ còn 48px, giữ 20px hai bên là
 * chừa 8px cho một cái nút rộng 32px.
 */
const PAD = "p-5 group-data-[collapsible=icon]:p-2";

function initials(name: string | undefined) {
  if (!name) return "?";
  // Hai chữ đầu của hai từ đầu — "Lê Huy Thái" ra "LH". Lấy cả ba chữ thì ở cỡ
  // 32px là ba nét dính vào nhau thành một vệt.
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function DashboardSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const user = session?.user;

  return (
    // `floating` là dạng THẺ: nó đệm 8px quanh thanh bên rồi bo góc và kẻ viền
    // phần bên trong, nên thanh bên nổi lên thành một khối cạnh thẻ nội dung thay
    // vì dán vào mép màn hình.
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader className={PAD}>
        {/* Chỉ dấu nhận diện, KHÔNG kèm tên ứng dụng: thanh bên đã là chỗ của
            người đã vào trong rồi, nhắc lại tên sản phẩm ở đây chỉ ăn chỗ. Tên
            vẫn còn ở trang giới thiệu và màn đăng nhập. */}
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center">
          <AppLogo showName={false} />
          <ThemeToggleIcon />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Thẻ người dùng KHÔNG nằm trong vùng cuộn của `SidebarContent`… thực ra
            nó nằm trong `SidebarGroup` đầu tiên, mà nhóm này không cuộn riêng —
            `ring` của `Card` vẽ ra NGOÀI hộp nên nếu rơi vào đúng mép vùng cuộn
            thì bị cắt một cạnh. Đệm 20px hai bên đủ để viền không chạm mép.

            Cần hiện ra vì mấy ai chỉ có một tài khoản Google, mà vào bằng tài
            khoản khác thì danh sách dự án trống trơn và trông y như mất dữ liệu. */}
        <SidebarGroup className={`${PAD} pt-0 group-data-[collapsible=icon]:hidden`}>
          {/* `bg-muted` chứ không để nền thẻ mặc định.
              `--card` và `--sidebar` là CÙNG một giá trị (`oklch(1 0 0)` ở nền
              sáng), nên thẻ này là trắng đè trắng và chỉ còn vòng viền
              `--border` (`0.955`) gánh việc tách lớp — đo trong trình duyệt thì
              viền vẫn còn đủ, nó chỉ nhạt tới mức không đọc ra.

              Quy tắc của dự án là "lệch một bậc màu rồi còn lại dùng viền", mà ở
              đây bậc màu đã chạm trần trắng nên không đi sáng hơn được nữa — bậc
              duy nhất còn lại là đi xuống. Viền vẫn giữ nguyên `--border`, KHÔNG
              tự chế viền đậm hơn tại chỗ gọi. */}
          <Card size="sm" className="bg-muted">
            {/* `gap-2` chứ `gap-3`: mỗi 4px khe hở ở đây là 8px bớt đi của chữ,
                mà ảnh đại diện và nút đăng xuất đã chiếm 64px cố định. */}
            <CardContent className="flex items-center gap-2">
              <Avatar>
                {/* Ảnh Google trả về. Người dùng chưa đặt ảnh thì `AvatarImage`
                    không tải được và `AvatarFallback` hiện thay — không phải tự
                    kiểm rồi chọn, component lo việc đó. */}
                <AvatarImage src={user?.image ?? undefined} alt="" />
                <AvatarFallback>{initials(user?.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                {/* `truncate` vì địa chỉ thư dài hơn thanh bên là chuyện thường,
                    mà tràn ra thì nó đội cả bố cục sang phải. */}
                <p className="truncate font-medium">
                  {user?.name ?? "Chưa rõ tên"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Đăng xuất"
                onClick={() => signOut().then(() => navigate("/"))}
              >
                <LogOutIcon />
              </Button>
            </CardContent>
          </Card>
        </SidebarGroup>

        <SidebarGroup className={`${PAD} pt-0`}>
          <SidebarGroupContent>
            <SidebarMenu>
              {MENU.map((item) => (
                <SidebarMenuItem key={item.to}>
                  {/* `data-active:font-medium`: mặc định của design system là
                      `font-normal`, nên mục đang mở trông y hệt mục đang bị trỏ
                      chuột vào — không còn tín hiệu nào nói "bạn đang ở đây".
                      Đè tại chỗ gọi chứ không sửa `sidebar.tsx`: cái
                      `font-normal` kia không kèm chú thích nên chưa rõ là chủ ý,
                      mà đây là nơi duy nhất trong ứng dụng dùng menu này. */}
                  <SidebarMenuButton
                    isActive={location.pathname === item.to}
                    tooltip={item.label}
                    className="data-active:font-medium"
                    render={<Link to={item.to} />}
                  >
                    <item.icon />
                    {item.label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Nút liên hệ đặt GIỮA đáy, không kéo hết bề ngang như mục menu: nó không
          phải một chỗ để đi tới trong ứng dụng mà là một đường ra ngoài, nên nó
          không nên trông giống bốn mục phía trên.

          Ra ngoài trang nên là `<a>` chứ không phải `Link` của router.
          `rel="noreferrer"`: `target="_blank"` không có nó thì trang mở ra với
          được vào `window.opener` của trang này. */}
      <SidebarFooter className={`${PAD} items-center`}>
        {/* Dùng `SidebarMenuButton` chứ không `Button`, dù đây không phải mục menu.
            Lý do là ngữ nghĩa: `Button` bọc một `<a>` thì Base UI đòi
            `nativeButton={false}`, mà cờ đó gắn `role="button"` lên thẻ — trình đọc
            màn hình đọc ra "nút" và người dùng không được báo là sắp rời trang.
            `SidebarMenuButton` dựng qua `useRender` nên `<a>` vẫn là liên kết thật,
            và nó có sẵn `tooltip` cho lúc thu gọn còn trơ một icon.

            `justify-center`: nút vẫn rộng hết bề ngang như mục menu, nhưng icon và
            chữ dồn vào GIỮA thay vì bám mép trái. Nhờ vậy nó vẫn là một vùng bấm
            rộng rãi mà không đọc ra như mục thứ năm của danh mục. */}
        <SidebarMenuButton
          tooltip="Liên hệ"
          className="justify-center"
          render={<a href={CONTACT_URL} target="_blank" rel="noreferrer" />}
        >
          <MessageCircleIcon />
          Liên hệ
        </SidebarMenuButton>
      </SidebarFooter>

      {/* Dải mỏng ở mép phải để thu/mở thanh bên. Có nó thì bỏ được cái nút trong
          vùng nội dung mà vẫn đóng/mở được — dải này thuộc về thanh bên, không
          chiếm chỗ trong thẻ nội dung. */}
      <SidebarRail />
    </Sidebar>
  );
}
