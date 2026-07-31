import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/lib/auth-client";
import { DashboardShell } from "@/routes/dashboard/dashboard-shell";
import { LandingPage } from "@/routes/landing/landing-page";

/**
 * `/` là hai màn khác nhau tuỳ người xem: chưa đăng nhập thì là trang giới thiệu,
 * đăng nhập rồi thì là bảng điều khiển.
 *
 * Phân nhánh ở đây chứ không đẩy người chưa đăng nhập sang một màn đăng nhập
 * riêng: `/` phải là chỗ giới thiệu được ứng dụng cho người mới, mà chuyển hướng
 * thẳng sang màn hỏi tài khoản thì họ chưa biết đây là cái gì đã bị hỏi. Cửa đăng
 * nhập nằm ngay trong trang giới thiệu, nên không còn màn riêng nào nữa.
 *
 * Không bọc trong `RequireSession` — chính nó quyết định, và nhánh "chưa đăng nhập"
 * là một màn hợp lệ chứ không phải một lần bị chặn.
 */
export function HomeRoute() {
  const { data: session, isPending } = useSession();

  /**
   * Chờ xong lượt hỏi phiên đầu tiên mới quyết định.
   *
   * Thiếu nhánh này thì người đã đăng nhập thấy trang giới thiệu nháy lên một cái
   * rồi mới thành bảng điều khiển — ở MỌI lần tải trang.
   */
  if (isPending) {
    return (
      <div className="grid h-svh place-items-center bg-background p-2">
        <Card>
          <CardContent>
            <Spinner />
          </CardContent>
        </Card>
      </div>
    );
  }

  return session ? <DashboardShell /> : <LandingPage />;
}
