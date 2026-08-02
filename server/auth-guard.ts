import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";

import { auth, isAllowed } from "./auth";
import {
  assertOwnsFilePath,
  assertOwnsUrlTarget,
  type Viewer,
} from "./ownership";

declare module "fastify" {
  interface FastifyRequest {
    /** Người đang gọi. Có mặt ở mọi route qua được `authGuard`. */
    viewer?: Viewer;
  }
}

/**
 * Đọc phiên rồi đối chiếu lại danh sách cho phép.
 *
 * Kiểm danh sách Ở ĐÂY, không chỉ ở lúc tạo tài khoản: móc `user.create.before`
 * trong `auth.ts` chỉ chạy một lần trong đời một tài khoản, nên nếu chỉ dựa vào
 * nó thì gỡ một email khỏi `.env` sẽ chẳng đuổi được ai — phiên cũ vẫn còn hạn
 * ba mươi ngày và vẫn vào được mọi thứ.
 */
export async function resolveViewer(
  request: FastifyRequest,
): Promise<Viewer | null> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.raw.headers),
  });
  const user = session?.user;
  if (!user?.email) return null;
  if (!isAllowed(user.email)) return null;
  return { id: user.id, email: user.email };
}

/** Đường dẫn Better Auth tự lo — chính chúng là chỗ để đăng nhập, không thể đòi đăng nhập trước. */
const AUTH_PREFIX = "/api/auth/";

/**
 * Đường duy nhất khác được đi qua cổng: healthcheck của Docker.
 *
 * So BẰNG chứ không theo tiền tố. Tiền tố `/api/health` sẽ mở luôn
 * `/api/health-detail` hay `/api/health/db` nếu về sau có ai đặt tên như vậy —
 * và cửa mở thêm mà không ai định mở là đúng thứ cả tệp này sinh ra để tránh.
 */
const HEALTH_PATH = "/api/health";

/**
 * Cổng chung: mọi thứ dưới `/api/` và `/files/` đều phải có phiên.
 *
 * Chặn theo TIỀN TỐ chứ không liệt kê từng route: liệt kê thì mỗi route mới thêm
 * vào là một lần có thể quên, mà quên ở đây nghĩa là một cửa mở im lặng. Cách này
 * thì route mới mặc định đã bị khoá.
 */
export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  const path = request.url.split("?")[0];
  if (path.startsWith(AUTH_PREFIX)) return;
  if (path === HEALTH_PATH) return;
  if (!path.startsWith("/api/") && !path.startsWith("/files/")) return;

  const viewer = await resolveViewer(request);
  if (!viewer) {
    return reply.code(401).send({ error: "Chưa đăng nhập" });
  }
  request.viewer = viewer;

  if (path.startsWith("/files/")) {
    assertOwnsFilePath(viewer, path);
    return;
  }
  assertOwnsUrlTarget(viewer, path);
}
