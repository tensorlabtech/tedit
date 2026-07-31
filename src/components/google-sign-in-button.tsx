import { useState } from "react";

import { GoogleMark } from "@/components/google-mark";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { signInWithGoogle } from "@/lib/auth-client";

/**
 * Nút đăng nhập Google. Dùng ở CẢ trang giới thiệu và trang đăng nhập.
 *
 * Gom vào một chỗ vì hai trang đó có cùng cái nút: để mỗi trang tự dựng thì trạng
 * thái chờ, cách bắt lỗi và biến thể nút sẽ trôi khỏi nhau — mà nút này là cửa duy
 * nhất vào ứng dụng nên lệch nhau ở đây là lệch ở chỗ đáng tin cậy nhất.
 *
 * `variant="outline"`: dấu G bốn màu của Google cần nền sáng hoặc trung tính mới
 * đọc được, đặt lên mảng tím đậm thì phần xanh lá và xanh dương chìm hẳn — mà đây
 * là nhãn của bên khác nên không được đổi màu nó cho dễ nhìn.
 */
export function GoogleSignInButton({
  callbackURL,
  onFailure,
  size,
}: {
  /** Chỗ Google trả người dùng về sau khi xong. */
  callbackURL: string;
  onFailure: (message: string) => void;
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const [pending, setPending] = useState(false);

  const start = async () => {
    setPending(true);
    onFailure("");
    try {
      await signInWithGoogle(callbackURL);
    } catch {
      onFailure("Không gọi được máy chủ. Kiểm tra kết nối rồi thử lại.");
      setPending(false);
    }
    // Không hạ `pending` ở nhánh thành công: trình duyệt đang chuyển sang Google,
    // bật nút sáng lại chỉ mời người ta bấm thêm lần nữa.
  };

  return (
    <Button variant="outline" size={size} onClick={start} disabled={pending}>
      {pending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <GoogleMark data-icon="inline-start" />
      )}
      Đăng nhập bằng Google
    </Button>
  );
}
