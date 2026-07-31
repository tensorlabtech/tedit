import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Gốc dự án — `server/` nằm ngay dưới nó. */
export const PROJECT_ROOT = join(here, "..");

/**
 * Nạp `.env` theo đường dẫn TUYỆT ĐỐI, không theo thư mục đang đứng.
 *
 * `process.loadEnvFile(".env")` giải theo CWD. Chạy bằng systemd, bằng Docker,
 * hay đơn giản là gọi `tsx server/main.ts` từ thư mục cha — CWD khác đi là không
 * đọc được tệp nào, mà hàm đó KHÔNG báo lỗi khi tệp không tồn tại. Kết quả là
 * máy chủ khởi động bình thường rồi mới chết ở lời gọi đầu tiên cần khoá, với
 * một thông báo chẳng liên quan gì tới nguyên nhân.
 *
 * Nạp một lần ở cấp module: mọi tệp `import "./env"` đều thấy biến, không phụ
 * thuộc tệp nào được import trước.
 */
const ENV_PATH = join(PROJECT_ROOT, ".env");
if (existsSync(ENV_PATH)) {
  try {
    process.loadEnvFile(ENV_PATH);
  } catch (error) {
    // Tệp hỏng thì nói ra ngay chứ không nuốt: thiếu khoá vì cú pháp sai là lỗi
    // khó đoán nhất trong nhóm này.
    console.warn(`[env] Không đọc được ${ENV_PATH}:`, error);
  }
}

/**
 * Biến môi trường BẮT BUỘC. Thiếu thì dừng ngay lúc khởi động, kèm cách sửa.
 *
 * Dừng sớm chứ không chạy tiếp với giá trị rỗng: một khoá phiên rỗng vẫn ký được
 * cookie, và cookie ký bằng khoá rỗng thì ai cũng làm giả được — máy chủ trông
 * như đang chạy tốt trong khi cửa đã mở sẵn.
 */
export function requireEnv(name: string, hint: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} trong .env — ${hint}`);
  }
  return value;
}

/** Biến môi trường không bắt buộc; rỗng coi như chưa đặt. */
export function optionalEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/**
 * Địa chỉ NGƯỜI DÙNG thấy trên thanh địa chỉ, không phải địa chỉ Fastify lắng nghe.
 *
 * Google đối chiếu đường dẫn quay về theo đúng gốc này, và cookie phiên cũng đặt
 * theo nó. Lúc phát triển trình duyệt đứng ở Vite (`5173`) rồi Vite chuyển tiếp
 * sang Fastify (`5190`), nên gốc phải là `5173` — lấy `5190` thì Google trả người
 * dùng về một cổng không có trang nào.
 */
export const PUBLIC_URL = (
  optionalEnv("BETTER_AUTH_URL") ?? "http://localhost:5173"
).replace(/\/$/, "");

/** Trang chạy qua HTTPS thì cookie phải có cờ `secure`; localhost thì không thể. */
export const USE_SECURE_COOKIES = PUBLIC_URL.startsWith("https://");
