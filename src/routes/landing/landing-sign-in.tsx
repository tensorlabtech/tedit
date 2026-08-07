import { useState } from "react";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { DevSignIn } from "./dev-sign-in";

/**
 * Khối đăng nhập của trang giới thiệu: nút Google + dòng trạng thái + (tuỳ chọn)
 * nút phụ và cửa dev. Dùng ở CẢ hero và lời mời cuối trang.
 *
 * Gom vào một component vì hai chỗ đó là CÙNG một cửa vào: để mỗi chỗ tự dựng thì
 * cách bắt lỗi, câu "chỉ mở cho tài khoản được cấp quyền" và biến thể nút sẽ trôi
 * khỏi nhau — mà đây là thứ đáng tin cậy nhất trên trang.
 *
 * Lỗi tới từ hai đường, gộp về một chỗ hiện: `returnedError` là lỗi Google trả về
 * trên đường dẫn sau khi quay lại (chỉ hero truyền, vì đó là nơi người dùng đáp
 * xuống); `failure` là lời gọi ngay tại chỗ không đi được (mạng, máy chủ chết).
 */
export function LandingSignIn({
  backTo,
  returnedError = "",
  size,
  showDev = false,
  secondary,
  align = "center",
}: {
  backTo: string;
  returnedError?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  showDev?: boolean;
  /** Nút phụ đứng cạnh nút Google (ví dụ "Xem cách hoạt động"). */
  secondary?: React.ReactNode;
  align?: "center" | "start";
}) {
  const [failure, setFailure] = useState("");
  const message = failure || returnedError;

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" ? "items-center" : "items-start",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <GoogleSignInButton
          callbackURL={backTo}
          onFailure={setFailure}
          size={size}
        />
        {secondary}
      </div>
      {/* Chuỗi rỗng nghĩa là chưa có lỗi — giữ ô trống thì không có cú nhảy bố cục
          lúc lỗi hiện ra. */}
      {message ? (
        <p className="text-sm text-destructive">{message}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Hiện chỉ mở cho tài khoản được cấp quyền.
        </p>
      )}
      {/* Cửa dev đứng DƯỚI cửa thật và nhạt hơn hẳn: nó không phải một lựa chọn
          ngang hàng, chỉ là lối vào cho máy và cho lúc dựng. Bản dựng thật xoá hẳn
          khối này (xem `import.meta.env.DEV` bên trong). */}
      {showDev ? <DevSignIn callbackURL={backTo} /> : null}
    </div>
  );
}
