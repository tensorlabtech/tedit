import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";

import { db } from "./db";
import { PUBLIC_URL, USE_SECURE_COOKIES, optionalEnv, requireEnv } from "./env";

/**
 * Danh sách email được vào, khai trong `.env`:
 *
 *   TEDDIT_ALLOWED_EMAILS=toi@gmail.com,ban@gmail.com
 *
 * RỖNG NGHĨA LÀ KHOÁ SẠCH, không phải mở sạch. Mỗi lượt dựng đều tiêu tiền thật
 * (mô hình ngôn ngữ, nhận dạng giọng nói), nên cái giá của việc nhầm hướng mặc
 * định là người lạ tiêu ví mình. Quên đặt biến thì không ai vào được — chuyện đó
 * lộ ra trong ba giây; còn mở sạch thì có thể không ai phát hiện ra hàng tuần.
 */
function allowedEmails(): Set<string> {
  const raw = optionalEnv("TEDDIT_ALLOWED_EMAILS") ?? "";
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails().has(email.trim().toLowerCase());
}

/**
 * Đọc danh sách ở MỖI lần kiểm, không đọc một lần rồi nhớ.
 *
 * Đọc một lần thì gỡ một email khỏi `.env` phải khởi động lại máy chủ mới có tác
 * dụng, mà tới lúc cần gỡ ai đó thì thường là đang gấp. Một `Set` vài phần tử
 * dựng lại mỗi request là chi phí không đo được.
 */
export function allowedCount(): number {
  return allowedEmails().size;
}

/**
 * Cửa đăng nhập bằng email+mật khẩu — CHỈ để máy chạy thử, không bao giờ có ở bản
 * thật.
 *
 * Vì sao phải có: Google CHỐI đăng nhập từ trình duyệt bị điều khiển tự động
 * ("This browser or app may not be secure"). Nên mọi lượt kiểm bằng máy — hôm nay
 * là agent, mai là CI — đều không qua nổi cửa Google, và không có đường này thì cứ
 * mỗi lần kiểm giao diện lại phải nhờ một người ngồi bấm.
 *
 * KHÔNG chọc cửa hậu vào `authGuard`. Guard đó không chỉ hỏi "đã đăng nhập chưa",
 * nó còn kiểm quyền sở hữu tệp và dự án — chọc lối tắt vào đấy thì mọi lượt kiểm
 * sau này chạy trên một nhánh khác hẳn nhánh chạy thật, và test xanh không còn
 * chứng minh được gì về phần đang giữ dữ liệu người dùng. Đi đường này thì phiên
 * sinh ra là phiên THẬT: cookie thật, hàng session thật, `isAllowed` vẫn chạy,
 * kiểm sở hữu vẫn chạy.
 *
 * Hai chốt, thiếu MỘT là cửa này đóng. Đo thật: lượt đăng ký nhận
 * `400 EMAIL_PASSWORD_SIGN_UP_DISABLED` — tức better-auth vẫn giữ đường dẫn nhưng
 * chối mọi lượt, chứ không phải trả 404. Đóng vẫn là đóng, nhưng đừng trông vào
 * việc "đường dẫn không tồn tại" như một lớp che.
 */
const DEV_LOGIN =
  process.env.NODE_ENV !== "production" &&
  optionalEnv("TEDDIT_DEV_LOGIN") === "1";

if (DEV_LOGIN) {
  // Nói to. Một cửa đăng nhập phụ mà bật im lặng là thứ dễ quên nhất trên đời.
  console.warn(
    "[auth] TEDDIT_DEV_LOGIN=1 — đang mở đăng nhập email+mật khẩu cho máy chạy thử",
  );
}

export const auth = betterAuth({
  // Dùng CHUNG một kết nối với phần còn lại của máy chủ: cùng tệp, cùng chế độ
  // WAL, cùng `foreign_keys`. Mở kết nối thứ hai tới cùng tệp SQLite là tự tạo
  // ra hai bên tranh ghi mà không được gì.
  database: db,

  secret: requireEnv(
    "BETTER_AUTH_SECRET",
    "khoá ký cookie phiên, sinh bằng: openssl rand -base64 32",
  ),
  baseURL: PUBLIC_URL,
  basePath: "/api/auth",

  // Trình duyệt đứng ở gốc này; mọi gốc khác gửi request tới đây đều bị chối.
  trustedOrigins: [PUBLIC_URL],

  // Tài khoản dev vẫn phải nằm trong `TEDDIT_ALLOWED_EMAILS`: móc `user.create.before`
  // ở dưới chặn lúc tạo, không có ngoại lệ nào cho cửa này. Nghĩa là lượt kiểm bằng
  // máy đi qua luôn cả danh sách cho phép.
  emailAndPassword: { enabled: DEV_LOGIN },

  socialProviders: {
    google: {
      clientId: requireEnv(
        "GOOGLE_CLIENT_ID",
        "lấy ở Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application)",
      ),
      clientSecret: requireEnv(
        "GOOGLE_CLIENT_SECRET",
        "cùng chỗ với GOOGLE_CLIENT_ID",
      ),
    },
  },

  session: {
    // Ba mươi ngày: đây là bàn dựng video, phiên hết hạn giữa lúc đang sửa là mất
    // việc đang làm dở.
    expiresIn: 60 * 60 * 24 * 30,
    // Gia hạn khi phiên đã dùng quá một ngày, để người dùng thường xuyên không
    // bao giờ bị đá ra.
    updateAge: 60 * 60 * 24,
  },

  advanced: {
    // `localhost` không có HTTPS nên cờ `secure` làm trình duyệt bỏ luôn cookie —
    // đăng nhập xong vẫn hiện ra chưa đăng nhập, và không có lỗi nào để dò.
    useSecureCookies: USE_SECURE_COOKIES,
  },

  databaseHooks: {
    user: {
      create: {
        /**
         * Chặn người ngoài NGAY TẠI LÚC tạo tài khoản.
         *
         * Google đã xác thực xong mới tới đây, nên chỗ này chỉ còn việc hỏi
         * "email này có trong danh sách không". Chặn ở đây thì CSDL không mọc ra
         * hàng người dùng rác mỗi lần có ai bấm thử.
         *
         * Đây KHÔNG phải chốt duy nhất: `resolveViewer` trong `auth-guard.ts`
         * kiểm lại ở mỗi request. Móc này chỉ chạy lúc tạo, nên nếu chỉ có nó
         * thì gỡ một email khỏi danh sách sẽ không đuổi được tài khoản đã tạo.
         */
        before: async (user) => {
          if (!isAllowed(user.email)) {
            throw new APIError("FORBIDDEN", {
              message: "Email này chưa được cấp quyền dùng ứng dụng.",
            });
          }
          return { data: user };
        },
      },
    },
  },
});
