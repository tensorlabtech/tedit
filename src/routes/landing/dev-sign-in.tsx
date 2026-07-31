import { useState } from "react";
import { WrenchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

/**
 * Nút đăng nhập bằng TÀI KHOẢN CHUNG lúc phát triển — không bao giờ có ở bản thật.
 *
 * Vì sao cần, dù đã có nút Google: Google CHỐI đăng nhập từ trình duyệt bị điều
 * khiển tự động, nên máy (agent kiểm giao diện, CI) chỉ vào được bằng email+mật
 * khẩu. Nếu người thì đăng nhập bằng Google còn máy thì bằng cửa kia, hai bên
 * thành HAI tài khoản khác nhau — mà dự án gắn `owner_id` nên bên này báo lỗi ở
 * một dự án thì bên kia mở ra thấy danh sách trống. Bấm nút này thì cả hai cùng
 * đứng trên một tài khoản, thấy đúng một bộ dữ liệu.
 *
 * Chốt ở BA lớp:
 * · `import.meta.env.DEV` — bản dựng thật xoá hẳn khối này lúc gói, không phải ẩn
 *   đi bằng CSS. Đây là chốt chắc nhất vì nó không phụ thuộc cấu hình lúc chạy.
 * · `TEDDIT_DEV_LOGIN=1` ở máy chủ — thiếu thì lượt gọi bị chối, nút báo ra.
 * · `TEDDIT_ALLOWED_EMAILS` — email dưới đây vẫn phải nằm trong danh sách.
 */

/**
 * Tài khoản chung. Ghi thẳng vào đây là CÓ CHỦ Ý.
 *
 * Nó chỉ tồn tại trên máy nào tự bấm tạo, với cờ dev bật, và email này phải được
 * khai trong `.env` của chính máy đó. Trên bản thật thì cả khối mã này không có
 * mặt. Đổi thành biến môi trường chỉ thêm một bước cài đặt cho mỗi người mới, mà
 * không giấu được gì đang cần giấu.
 */
const DEV_EMAIL = "dev@teddit.local";
const DEV_PASSWORD = "dev-only-password-2026";

export function DevSignIn({ callbackURL }: { callbackURL: string }) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");

  if (!import.meta.env.DEV) return null;

  const start = async () => {
    setPending(true);
    setFailure("");

    // Thử đăng nhập TRƯỚC, tạo tài khoản sau. Máy mới tinh thì lượt đăng nhập hỏng
    // và lượt tạo lo nốt — nên bản sao chép về không phải làm bước cài đặt nào,
    // chỉ bấm một cái. Máy đã có tài khoản thì lượt tạo không bao giờ chạy tới.
    const signIn = () =>
      authClient.signIn.email({ email: DEV_EMAIL, password: DEV_PASSWORD });

    const first = await signIn();
    if (!first.error) {
      window.location.href = callbackURL;
      return;
    }

    const created = await authClient.signUp.email({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
      name: "Dev",
    });
    if (created.error) {
      // Nói ĐÚNG câu máy chủ trả về. Hai lý do hay gặp nhất đều tự sửa được, mà
      // mỗi cái sửa một chỗ khác nhau: thiếu `TEDDIT_DEV_LOGIN=1`, hoặc email này
      // chưa có trong `TEDDIT_ALLOWED_EMAILS`.
      setFailure(created.error.message ?? "Không đăng nhập được bằng cửa dev.");
      setPending(false);
      return;
    }

    const second = await signIn();
    if (second.error) {
      setFailure(second.error.message ?? "Không đăng nhập được bằng cửa dev.");
      setPending(false);
      return;
    }
    window.location.href = callbackURL;
  };

  return (
    <div className="grid gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void start()}
        disabled={pending}
      >
        {pending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <WrenchIcon data-icon="inline-start" />
        )}
        Vào bằng tài khoản dev chung
      </Button>
      <p className="text-xs text-muted-foreground">
        {failure ||
          `Chỉ có lúc chạy máy phát triển. Người và máy dùng chung ${DEV_EMAIL} để cùng thấy một bộ dữ liệu.`}
      </p>
    </div>
  );
}
