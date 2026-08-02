import type { FastifyInstance } from "fastify";
import { diskUsage } from "../health";
import { readSettings, writeSettings } from "../settings";

export default async function settingsRoutes(app: FastifyInstance) {
/**
 * CÀI ĐẶT của người đang đăng nhập.
 *
 * Là MẶC ĐỊNH cho dự án tạo về sau, không áp ngược lên dự án đã dựng: đổi một nút
 * ở đây mà bản dựng hôm qua tự đổi theo thì người dùng mất công sửa cả buổi.
 */
app.get("/api/settings", async (request) => readSettings(request.viewer!.id));

/**
 * Đĩa còn bao nhiêu — con số để BIẾT LÚC NÀO PHẢI DỌN, không phải hạn mức.
 *
 * Danh sách cho phép trả lời "ai được vào", không trả lời "đĩa còn chỗ không".
 * Mà phần lớn dung lượng không đến từ người dùng bất cẩn: mỗi dự án giữ mãi
 * khoảng ba tới bốn lần dung lượng tư liệu gốc, và `teddit.db` nằm cùng ổ với
 * chúng — ổ đầy nghĩa là CSDL hết chỗ ghi.
 *
 * Route RIÊNG chứ không nhét vào `/api/settings`: hình dạng của settings còn
 * dùng cho `PATCH`, mà mấy con số này thì đọc xong không sửa được.
 */
app.get("/api/storage", async () => (await diskUsage()) ?? { unavailable: true });

app.patch("/api/settings", async (request) =>
  writeSettings(request.viewer!.id, (request.body ?? {}) as never),
);
}
