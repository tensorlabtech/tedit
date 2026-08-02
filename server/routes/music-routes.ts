import { AUDIO } from "./media-formats";
import type { FastifyInstance } from "fastify";
import { createWriteStream, existsSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { newId } from "../db";
import {
  probe,
} from "../media-tools";
import {
  ensureProjectDirs,
  mediaDir,
} from "../paths";
import {
  addMusic,
  deleteMusic,
  mainDuration,
  restoreMusic,
  updateMusic,
} from "../music-tracks";
import {
  AUDIO as AUDIO_LIB,
  LIBRARY,
} from "../music-library";

export default async function musicRoutes(app: FastifyInstance) {
app.post("/api/projects/:id/music", async (request, reply) => {
  const { id } = request.params as { id: string };
  ensureProjectDirs(id);
  for await (const part of request.parts()) {
    if (part.type !== "file") continue;
    const name = basename(part.filename ?? "nhac");
    if (!AUDIO.test(name)) {
      await part.toBuffer();
      return reply.code(400).send({ error: "Không nhận định dạng nhạc này" });
    }
    // Tên tệp mang mã bài: nhiều bài mà cùng ghi đè `music.mp3` thì bài thứ hai
    // xoá mất tiếng của bài thứ nhất.
    const target = join(mediaDir(id), `music-${newId("m")}${extname(name)}`);
    await pipeline(part.file, createWriteStream(target));
    // Độ dài BÀI HÁT, đo từ chính tệp vừa nhận. Bản trước chỉ truyền độ dài
    // video vào nên mọi bài đều dài bằng phim, đúng vì nó luôn phủ cả video —
    // giờ đặt tại vạch thì phải biết bài thật sự dài bao nhiêu.
    const at = Number((request.query as { at?: string }).at ?? 0);
    const length = (await probe(target).catch(() => null))?.duration ?? 0;
    const track = addMusic(
      id,
      name,
      target,
      mainDuration(id),
      length,
      Number.isFinite(at) ? at : 0,
    );
    return track ?? reply.code(500).send({ error: "Không lưu được bài nhạc" });
  }
  return reply.code(400).send({ error: "Không có tệp nào" });
});

/**
 * Đặt một bài TỪ KHO vào dự án, tại vạch.
 *
 * Không cho client tự truyền đường dẫn: nó sẽ thành một cửa trỏ vào bất kỳ tệp
 * nào trên máy chủ. Chỉ nhận TÊN TỆP, rồi tự ghép với thư mục kho.
 */
app.post("/api/projects/:id/music/from-library", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = (request.body ?? {}) as { file?: string; at?: number };
  const file = basename(body.file ?? "");
  if (!file || !AUDIO_LIB.test(file)) {
    return reply.code(400).send({ error: "Thiếu tên bài" });
  }
  const source = join(LIBRARY, file);
  if (!existsSync(source)) {
    return reply.code(404).send({ error: "Kho không có bài này" });
  }
  const length = (await probe(source).catch(() => null))?.duration ?? 0;
  const at = Number(body.at ?? 0);
  const track = addMusic(
    id,
    file,
    source,
    mainDuration(id),
    length,
    Number.isFinite(at) ? Math.max(0, at) : 0,
  );
  return track ?? reply.code(409).send({ error: "Chỗ này đã có nhạc" });
});

app.patch("/api/music/:trackId", async (request, reply) => {
  const { trackId } = request.params as { trackId: string };
  const body = request.body as {
    volume?: number;
    start?: number;
    end?: number;
  };
  const track = updateMusic(trackId, body);
  return track ?? reply.code(404).send({ error: "Không có bài nhạc này" });
});

app.delete("/api/music/:trackId", async (request, reply) => {
  const { trackId } = request.params as { trackId: string };
  const track = deleteMusic(trackId);
  return track ?? reply.code(404).send({ error: "Không có bài nhạc này" });
});

/**
 * Đặt lại một bài vừa gỡ.
 *
 * Chỉ nhận tệp NẰM TRONG thư mục của chính dự án đó — nếu không thì đây là một
 * cửa cho người ngoài trỏ vào bất kỳ tệp nào trên máy chủ.
 */
app.post("/api/projects/:id/music/restore", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as {
    id: string;
    position: number;
    name: string;
    storedPath: string;
    start: number;
    end: number;
    volume: number;
  };
  if (!resolve(body.storedPath).startsWith(resolve(mediaDir(id)))) {
    return reply.code(400).send({ error: "Tệp không thuộc dự án này" });
  }
  const track = restoreMusic(id, {
    id: body.id,
    position: body.position,
    name: body.name,
    stored_path: body.storedPath,
    start_sec: body.start,
    end_sec: body.end,
    volume: body.volume,
  });
  return track ?? reply.code(500).send({ error: "Không đặt lại được" });
});
}
