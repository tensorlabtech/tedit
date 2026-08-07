import type { FastifyInstance } from "fastify";

import { db } from "../db";
import { optionalEnv } from "../env";

/**
 * Trang quản trị: xem người dùng đang dùng dự án ra sao. CHẶT HƠN cả `isAllowed` —
 * chỉ vài email admin vào được, không phải mọi tài khoản trong danh sách cho phép.
 *
 * Khai trong `.env`: `TEDDIT_ADMIN_EMAILS=a@x.com,b@y.com`. Rỗng thì lùi về đúng
 * một email chủ dự án để lúc chưa cấu hình vẫn có người vào được (khác `isAllowed`:
 * ở đó rỗng = khoá sạch, vì đó là cửa tiêu tiền; còn đây chỉ là màn CHỈ-ĐỌC).
 */
function adminEmails(): Set<string> {
  const raw = optionalEnv("TEDDIT_ADMIN_EMAILS") ?? "lethai2597@gmail.com";
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().has(email.trim().toLowerCase());
}

type Overview = {
  users: number;
  projects: number;
  media: number;
  mediaBytes: number;
  videoSeconds: number;
  jobs: number;
  exports: number;
};

/** Một lượt XUẤT video xong = job `kind='export'` trạng thái `done`. */
const EXPORT_DONE = "j.kind = 'export' AND j.status = 'done'";

export default async function adminRoutes(app: FastifyInstance) {
  /**
   * MỘT lượt gọi trả cả bảng: tổng quan, chia theo trạng thái, từng người dùng,
   * và các dự án gần đây. Màn admin nhỏ nên gộp một chuyến đi cho gọn.
   */
  app.get("/api/admin/summary", async (request, reply) => {
    if (!isAdmin(request.viewer?.email)) {
      return reply.code(403).send({ error: "Không có quyền quản trị" });
    }

    const overview = db
      .prepare(
        `SELECT
           (SELECT count(*) FROM user)                                    AS users,
           (SELECT count(*) FROM projects)                                AS projects,
           (SELECT count(*) FROM media_files)                             AS media,
           (SELECT coalesce(sum(size), 0) FROM media_files)               AS mediaBytes,
           (SELECT coalesce(sum(video_seconds), 0) FROM projects)         AS videoSeconds,
           (SELECT count(*) FROM jobs)                                    AS jobs,
           (SELECT count(*) FROM jobs j WHERE ${EXPORT_DONE})             AS exports`,
      )
      .get() as Overview;

    const byStatus = db
      .prepare(
        `SELECT status, count(*) AS count
         FROM projects GROUP BY status ORDER BY count DESC`,
      )
      .all() as Array<{ status: string; count: number }>;

    // Từng người dùng: dự án, tổng giây video, media + dung lượng, lần cuối tạo dự án.
    const users = db
      .prepare(
        `SELECT
           u.id, u.email, u.name, u.createdAt AS createdAt,
           (SELECT count(*) FROM projects p WHERE p.owner_id = u.id)                       AS projects,
           (SELECT coalesce(sum(p.video_seconds), 0) FROM projects p WHERE p.owner_id = u.id) AS videoSeconds,
           (SELECT max(p.created_at) FROM projects p WHERE p.owner_id = u.id)              AS lastProjectAt,
           (SELECT count(m.id) FROM media_files m JOIN projects p ON m.project_id = p.id
              WHERE p.owner_id = u.id)                                                     AS media,
           (SELECT coalesce(sum(m.size), 0) FROM media_files m JOIN projects p ON m.project_id = p.id
              WHERE p.owner_id = u.id)                                                     AS mediaBytes,
           (SELECT count(*) FROM jobs j JOIN projects p ON j.project_id = p.id
              WHERE p.owner_id = u.id AND ${EXPORT_DONE})                                  AS exports,
           (SELECT max(j.updated_at) FROM jobs j JOIN projects p ON j.project_id = p.id
              WHERE p.owner_id = u.id AND ${EXPORT_DONE})                                  AS lastExportAt
         FROM user u
         ORDER BY exports DESC, projects DESC, u.createdAt ASC`,
      )
      .all() as Array<{
      id: string;
      email: string;
      name: string | null;
      createdAt: number | string | null;
      projects: number;
      videoSeconds: number;
      lastProjectAt: number | null;
      media: number;
      mediaBytes: number;
      exports: number;
      lastExportAt: number | null;
    }>;

    // Dự án cũ chưa gắn chủ (trước khi có `owner_id`) — nói ra để con số khớp.
    const orphanProjects = (
      db
        .prepare("SELECT count(*) AS n FROM projects WHERE owner_id IS NULL")
        .get() as { n: number }
    ).n;

    const recent = db
      .prepare(
        `SELECT p.id, p.title, p.status, p.created_at AS createdAt,
                p.video_seconds AS videoSeconds, u.email AS ownerEmail
         FROM projects p
         LEFT JOIN user u ON p.owner_id = u.id
         ORDER BY p.created_at DESC
         LIMIT 24`,
      )
      .all() as Array<{
      id: string;
      title: string;
      status: string;
      createdAt: number;
      videoSeconds: number | null;
      ownerEmail: string | null;
    }>;

    // Ai đã XUẤT video, dự án nào, lúc nào — mới nhất trước.
    const recentExports = db
      .prepare(
        `SELECT j.id, j.project_id AS projectId, p.title, u.email AS ownerEmail,
                j.updated_at AS at
         FROM jobs j
         JOIN projects p ON j.project_id = p.id
         LEFT JOIN user u ON p.owner_id = u.id
         WHERE ${EXPORT_DONE}
         ORDER BY j.updated_at DESC
         LIMIT 24`,
      )
      .all() as Array<{
      id: string;
      projectId: string;
      title: string;
      ownerEmail: string | null;
      at: number;
    }>;

    return { overview, byStatus, users, orphanProjects, recent, recentExports };
  });
}
