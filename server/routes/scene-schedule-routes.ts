import type { FastifyInstance } from "fastify";

import { assertOwnerIs } from "../ownership";
import { buildSceneSchedule } from "../scene-schedule";

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
}
