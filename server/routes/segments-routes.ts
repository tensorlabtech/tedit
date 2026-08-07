import type { FastifyInstance } from "fastify";
import { db } from "../db";
import {
  listSegments,
  mergeIntoPrevious,
  cutExactly,
  removeRange,
  sealGaps,
  skippedSpans,
  renameSegment,
  setSegmentRemoved,
  splitAt,
  trimSegment,
} from "../segments";

export default async function segmentsRoutes(app: FastifyInstance) {
app.get("/api/projects/:id/segments", async (request) => {
  const { id } = request.params as { id: string };
  return listSegments(id);
});

app.post("/api/projects/:id/segments/split", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as { at: number };
  if (!splitAt(id, body.at)) {
    return reply.code(400).send({ error: "Chỗ này không tách được đoạn" });
  }
  return listSegments(id);
});

app.post("/api/segments/:segmentId/merge", async (request, reply) => {
  const { segmentId } = request.params as { segmentId: string };
  const row = db
    .prepare("SELECT project_id FROM segments WHERE id=?")
    .get(segmentId) as { project_id: string } | undefined;
  if (!row) return reply.code(404).send({ error: "Không có đoạn này" });
  if (!mergeIntoPrevious(segmentId)) {
    return reply.code(400).send({ error: "Không gộp được — đây là đoạn đầu" });
  }
  return listSegments(row.project_id);
});

app.patch("/api/segments/:segmentId", async (request, reply) => {
  const { segmentId } = request.params as { segmentId: string };
  const body = request.body as {
    removed?: boolean;
    label?: string;
    edge?: "start" | "end";
    at?: number;
  };
  // Cùng lý do với `PATCH /api/words/:id`: mã không tồn tại thì trả 404, đừng
  // báo thành công rồi không ghi gì.
  const exists = db
    .prepare("SELECT id FROM segments WHERE id=?")
    .get(segmentId) as { id: string } | undefined;
  if (!exists) return reply.code(404).send({ error: "Không có đoạn này" });
  if (typeof body.removed === "boolean")
    setSegmentRemoved(segmentId, body.removed);
  if (typeof body.label === "string") renameSegment(segmentId, body.label);
  if (body.edge && typeof body.at === "number")
    trimSegment(segmentId, body.edge, body.at);
  return db.prepare("SELECT * FROM segments WHERE id=?").get(segmentId);
});

app.post("/api/projects/:id/segments/remove-range", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as { start?: number; end?: number; exact?: boolean };
  if (typeof body.start !== "number" || typeof body.end !== "number") {
    return reply.code(400).send({ error: "Thiếu mốc đầu hoặc mốc cuối" });
  }
  // `exact` là thao tác TAY: bỏ đúng khoảng đã vẽ. Không có nó thì dùng luật
  // 60% vốn hợp với đề xuất của máy — xem `cutExactly`.
  return body.exact
    ? cutExactly(id, body.start, body.end)
    : removeRange(id, body.start, body.end);
});

// Hàn lỗ hổng giữa các đoạn — CHỈ màn Cắt lỗi gọi (nơi mọi lỗ là rác). Trả về
// danh sách đã liền mạch để client vẽ lại ngay.
app.post("/api/projects/:id/segments/seal-gaps", async (request) => {
  const { id } = request.params as { id: string };
  sealGaps(id);
  return listSegments(id);
});

app.get("/api/projects/:id/skipped", async (request) => {
  const { id } = request.params as { id: string };
  const total = (
    db
      .prepare(
        "SELECT COALESCE(SUM(duration),0) AS total FROM media_files WHERE project_id=? AND role='main'",
      )
      .get(id) as { total: number }
  ).total;
  return skippedSpans(id, total);
});
}
