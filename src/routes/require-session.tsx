import { Navigate, useLocation } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/lib/auth-client";

/**
 * Chưa đăng nhập thì không vào được màn nào.
 *
 * Bọc ở NGOÀI bảng đường dẫn, không kiểm trong từng màn: kiểm trong màn thì mỗi
 * màn mới là một lần có thể quên, mà quên ở đây không gãy gì cả — màn vẫn dựng ra
 * rồi mới gọi API và nhận 401, nên người dùng thấy một trang hỏng thay vì trang
 * đăng nhập.
 *
 * Đây là lớp cho NGƯỜI DÙNG THẤY, không phải lớp bảo mật. Chốt thật nằm ở
 * `server/auth-guard.ts`: mã trong trình duyệt thì ai cũng sửa được.
 */
export function RequireSession({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const location = useLocation();

  /**
   * Lượt hỏi phiên đầu tiên phải chờ xong mới quyết định.
   *
   * Bỏ nhánh này thì `session` là `undefined` trong khoảnh khắc đầu và người đã
   * đăng nhập bị đẩy sang trang đăng nhập rồi mới bật lại — một cú nháy ở MỌI lần
   * tải trang, và nó xoá luôn đường dẫn họ vừa mở.
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

  if (!session) {
    // Về `/`, không về một màn đăng nhập riêng. Từng có `/login` và nó chỉ là bản
    // sao nghèo hơn của trang giới thiệu: cùng một nút Google, cùng một câu về
    // danh sách cho phép, chỉ khác vài dòng chữ — hai chỗ phải sửa cho mỗi lần đổi
    // cách đăng nhập, mà quên một chỗ thì hai cửa nói hai điều khác nhau.
    //
    // Nhớ chỗ đang đứng để đăng nhập xong quay lại đúng đó. `replace` để nút Lùi
    // không đưa họ về màn vừa bị chặn — bấm Lùi lại bị chặn lại là một cái bẫy.
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return children;
}
