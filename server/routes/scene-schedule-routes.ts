import type { FastifyInstance } from "fastify";

import { assertOwnerIs } from "../ownership";
import { buildSceneSchedule } from "../scene-schedule";
import { buildRemotionPayload } from "../remotion-payload";

/**
 * LỊCH MÀN cho khung xem trước — server xếp MỘT lần, màn hình vẽ theo.
 *
 * Lịch THƯA: chỉ gồm segment đã đặt (b-roll + ô người), đọc từ bảng `elements`.
 * Thêm/sửa/xoá segment đi qua CRUD `elements` (kind='insert'|'layout') như mọi
 * phần tử khác — không còn route "đặt override" riêng. Vắng segment = toàn-khung.
 */
export default async function sceneScheduleRoutes(app: FastifyInstance) {
  app.get("/api/projects/:id/scene-schedule", async (request) => {
    const { id } = request.params as { id: string };
    assertOwnerIs(request.viewer!, "project", id);
    return buildSceneSchedule(id);
  });

  // Payload cho Remotion <Player> — MỘT nguồn với export (`buildRemotionPayload`),
  // nên preview = export. Copy media vào `public/` để trình duyệt đọc bằng URL.
  app.get("/api/projects/:id/remotion-payload", async (request) => {
    const { id } = request.params as { id: string };
    assertOwnerIs(request.viewer!, "project", id);
    // Khung xem: proxy tua-tức-thì + hạ khổ (mượt khi kéo dải). Export dùng full-res.
    return buildRemotionPayload(id, undefined, { scrubProxy: true });
  });
}
