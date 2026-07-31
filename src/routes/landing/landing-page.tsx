import { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import { AppLogo } from "@/components/app-logo";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { ThemeToggleIcon } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { DevSignIn } from "./dev-sign-in";

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
 * MỘT thẻ phủ kín màn: nền thẻ tách khỏi nền trang đúng một bậc màu như mọi màn
 * khác, nên trang này và bảng điều khiển ngay sau lúc đăng nhập đọc ra là cùng
 * một sản phẩm. Một thẻ chứ không chia ô — trang giới thiệu cần chỗ thở ở giữa,
 * không cần chia mảng.
 *
 * Nội dung còn là bản nháp — chữ ở đây để chiếm chỗ và thấy được nhịp bố cục,
 * chưa phải lời quảng bá thật.
 */
export function LandingPage() {
  const [failure, setFailure] = useState("");
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

  // Lỗi tới từ hai đường: quay về từ Google (trên đường dẫn), hoặc lời gọi ngay
  // tại đây không đi được (mạng, máy chủ chết). Cả hai hiện cùng một chỗ.
  const returned = params.get("error");
  const message =
    failure ||
    (returned ? (ERROR_TEXT[returned] ?? "Không đăng nhập được.") : "");

  return (
    <div className="h-svh overflow-hidden bg-background p-2 text-foreground">
      <Card className="h-full min-h-0">
        <CardHeader>
          {/* Chỉ dấu nhận diện, không kèm tên ứng dụng: dòng tiêu đề ngay bên
              dưới đã nói ứng dụng làm gì, mà nói rõ hơn một cái tên. */}
          <CardTitle>
            <AppLogo showName={false} />
          </CardTitle>
          <CardAction>
            <ThemeToggleIcon />
          </CardAction>
        </CardHeader>

        {/* `justify-center` để khối chữ đứng giữa chiều cao còn lại thay vì dính
            mép trên — thẻ này chiếm hết màn hình. */}
        <CardContent className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 text-center">
          <Badge variant="secondary">Bản thử nội bộ</Badge>

          {/* `text-balance` để dòng trên dòng dưới dài gần nhau, không bị một chữ
              rơi xuống dòng cuối. `max-w-*` vì dòng chữ dài quá 60-70 ký tự thì
              mắt khó bắt lại đầu dòng tiếp theo. */}
          <h1 className="font-heading max-w-3xl text-4xl leading-tight font-semibold text-balance sm:text-5xl">
            Từ bản ghi thành video có chữ, có nhạc, có tư liệu chèn
          </h1>
          <p className="max-w-xl text-base text-pretty text-muted-foreground">
            Tải bản ghi lên, máy chép lời tiếng Việt, cắt quãng lặng, gieo chữ
            theo từng tiếng và dựng sẵn một bản nháp. Bạn chỉ sửa những chỗ cần
            sửa.
          </p>

          <div className="flex flex-col items-center gap-2">
            <GoogleSignInButton callbackURL={backTo} onFailure={setFailure} />
            {/* Chuỗi rỗng nghĩa là chưa có lỗi — giữ ô trống thì không có cú nhảy
                bố cục lúc lỗi hiện ra. */}
            {message ? (
              <p className="text-sm text-destructive">{message}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Hiện chỉ mở cho tài khoản được cấp quyền.
              </p>
            )}
            {/* Cửa dev đứng DƯỚI cửa thật và nhạt hơn hẳn: nó không phải một lựa
                chọn ngang hàng, chỉ là lối vào cho máy và cho lúc dựng. Bản dựng
                thật xoá hẳn khối này (xem `import.meta.env.DEV` bên trong). */}
            <DevSignIn callbackURL={backTo} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
