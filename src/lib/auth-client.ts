import { createAuthClient } from "better-auth/react";

/**
 * Cửa đăng nhập phía trình duyệt.
 *
 * Không truyền `baseURL`: để trống thì thư viện gọi tương đối trên chính gốc của
 * trang, đúng thứ ta cần. Ghi cứng một gốc vào đây là tự tạo ra chỗ thứ hai phải
 * sửa mỗi lần đổi tên miền — mà quên sửa thì cookie đặt sang gốc khác và đăng
 * nhập lặng lẽ không có tác dụng.
 */
export const authClient = createAuthClient();

export const { useSession, signOut } = authClient;

/**
 * Bắt đầu một lượt đăng nhập bằng Google.
 *
 * `callbackURL` là chỗ Google trả người dùng về SAU KHI xong. Để mặc định thì nó
 * về trang gốc, nên người đang mở dở một dự án bị đá về danh sách — chuyền đường
 * dẫn hiện tại vào đây thì họ quay lại đúng chỗ vừa đứng.
 */
export function signInWithGoogle(callbackURL = window.location.pathname) {
  return authClient.signIn.social({
    provider: "google",
    callbackURL,
    /**
     * Email ngoài danh sách cho phép bị chối ở máy chủ SAU KHI Google xác thực
     * xong. Không đặt chỗ về khi lỗi thì người dùng rơi vào trang lỗi mặc định
     * của thư viện — một trang trắng tiếng Anh không nói được chuyện gì đã xảy
     * ra. Đưa họ về `/` thì trang giới thiệu đọc `?error=` và giải thích.
     */
    errorCallbackURL: "/",
  });
}
