import type { FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { buildEnvelope, readEnvelope } from "../audio-envelope";
import { db } from "../db";
import {
  makeFilmstrip,
  probe,
} from "../media-tools";
import {
  DATA_ROOT,
  thumbDir,
  workDir,
} from "../paths";

export default async function mediaRoutes(app: FastifyInstance) {
/**
 * Video cho khung XEM TRƯỚC của bàn dựng.
 *
 * Đi qua route chứ không trỏ thẳng `/files/.../preview.mp4` vì phải RƠI VỀ
 * `base.mp4`: dự án chép lời bằng bản cũ không có `preview.mp4`, mà bắt người
 * dùng chép lại — mất mười ba phút và mất cả lời đã sửa tay — chỉ để xem được
 * video thì quá đắt. Trỏ thẳng vào tệp thì những dự án ấy nhận 404 và khung xem
 * trống trơn.
 *
 * Cả hai đường đều nằm dưới `/api/projects/<mã>/` nên luật phân quyền theo đường
 * dẫn ở `ownership.ts` tự canh, không phải kiểm thêm ở đây.
 */
app.get("/api/projects/:id/preview", async (request, reply) => {
  const { id } = request.params as { id: string };
  const preview = join(workDir(id), "preview.mp4");
  const base = join(workDir(id), "base.mp4");
  const pick = existsSync(preview) ? preview : base;
  if (!existsSync(pick)) {
    return reply.code(404).send({ error: "Chưa ghép video chính" });
  }
  // `sendFile` giải đường dẫn theo gốc đã khai cho `@fastify/static` (`DATA_ROOT`)
  // và tự lo `Range` — thứ mà khung xem trước cần để tua mà không tải cả tệp.
  return reply.sendFile(relative(DATA_ROOT, pick));
});

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
  // Dựng từ bản xem trước khi có: cùng mạch cùng độ dài, mà dải ảnh thu về cao
  // 44px nên 540×960 vẫn thừa nét — xem lý do đầy đủ ở `pipeline.ts`.
  const preview = join(workDir(id), "preview.mp4");
  const strip = await makeFilmstrip(
    existsSync(preview) ? preview : base,
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
