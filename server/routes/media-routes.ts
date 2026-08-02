import type { FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildEnvelope, readEnvelope } from "../audio-envelope";
import { db } from "../db";
import {
  makeFilmstrip,
  probe,
} from "../media-tools";
import {
  thumbDir,
  workDir,
} from "../paths";

export default async function mediaRoutes(app: FastifyInstance) {
/**
 * Đường bao âm lượng để vẽ dải sóng trên bàn dựng.
 *
 * Dựng lại tại chỗ nếu chưa có: dự án chép lời bằng bản cũ không có tệp này, mà
 * bắt người dùng chép lại (mất vài phút và mất lời đã sửa tay) chỉ để thấy dải
 * sóng là quá đắt.
 */
app.get("/api/projects/:id/envelope", async (request, reply) => {
  const { id } = request.params as { id: string };
  const san = await readEnvelope(id);
  if (san) return san;
  const audio = join(workDir(id), "audio.wav");
  if (!existsSync(audio)) {
    return reply.code(404).send({ error: "Chưa tách tiếng" });
  }
  return buildEnvelope(id, audio);
});

app.post("/api/projects/:id/filmstrip", async (request, reply) => {
  const { id } = request.params as { id: string };
  const base = join(workDir(id), "base.mp4");
  if (!existsSync(base)) {
    return reply.code(409).send({ error: "Chưa ghép video chính" });
  }
  const info = await probe(base);
  const strip = await makeFilmstrip(
    base,
    join(thumbDir(id), "strip.jpg"),
    info.duration,
  );
  db.prepare(
    "UPDATE projects SET strip_second_width=?, strip_seconds=?, strip_native_second_width=? WHERE id=?",
  ).run(strip.secondWidth, strip.totalSeconds, strip.nativeSecondWidth, id);
  return {
    secondWidth: strip.secondWidth,
    seconds: strip.totalSeconds,
    nativeSecondWidth: strip.nativeSecondWidth,
  };
});
}
