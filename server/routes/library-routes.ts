import type { FastifyInstance } from "fastify";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import { pipeline } from "node:stream/promises";
import {
  probe,
} from "../media-tools";
import {
  ASSETS,
  fingerprint,
  findDuplicate,
  kindOf,
  listAssets,
  rememberAsset,
  safeAssetName,
  setAssetStar,
  updateAsset,
} from "../asset-library";
import {
  AUDIO as AUDIO_LIB,
  LIBRARY,
  listLibrary,
  rememberUpload,
  safeName,
  setStar,
} from "../music-library";

export default async function libraryRoutes(app: FastifyInstance) {
app.get("/api/library/assets", async (request) =>
  listAssets(request.viewer!.id),
);

app.post("/api/library/assets", async (request) => {
  await mkdir(ASSETS, { recursive: true });
  let title = "";
  let tags: string[] = [];
  let description = "";
  const saved: unknown[] = [];
  const duplicates: Array<{ name: string; sameAs: string }> = [];

  for await (const part of request.parts()) {
    if (part.type !== "file") {
      const value = String((part as { value?: unknown }).value ?? "");
      if (part.fieldname === "title") title = value.trim().slice(0, 160);
      if (part.fieldname === "description")
        description = value.trim().slice(0, 600);
      if (part.fieldname === "tags") {
        tags = value
          .split(",")
          .map((tag) => tag.trim().slice(0, 30))
          .filter(Boolean)
          .slice(0, 12);
      }
      continue;
    }
    const name = basename(part.filename ?? "tu-lieu");
    if (!kindOf(name)) {
      await part.toBuffer();
      duplicates.push({ name, sameAs: "" });
      continue;
    }
    const file = safeAssetName(name);
    const target = join(ASSETS, file);
    await pipeline(part.file, createWriteStream(target));

    // CHỐNG TRÙNG theo nội dung, không theo tên. Cùng một tấm ảnh tải lại lần hai
    // thì tên khác mà vân tay y hệt — giữ cả hai là kho phình ra, và chặng ghép
    // tư liệu sẽ đặt hai bản của cùng một hình vào hai chỗ khác nhau.
    const hash = fingerprint(target);
    const daCo = findDuplicate(hash);
    if (daCo) {
      await unlink(target).catch(() => {});
      duplicates.push({ name, sameAs: daCo });
      continue;
    }

    const info = await probe(target).catch(() => null);
    const seconds = kindOf(file) === "video" ? (info?.duration ?? 0) : 0;
    rememberAsset({
      file,
      title: title || file.replace(/\.[^.]+$/, ""),
      tags,
      description,
      seconds,
      hash,
      uploadedBy: request.viewer!.id,
    });
    saved.push(file);
  }

  // Trả về CẢ danh sách mới lẫn danh sách bị bỏ vì trùng: người dùng thả mười tệp
  // mà chỉ thấy bảy cái hiện ra thì phải biết ba cái kia đi đâu.
  return {
    assets: listAssets(request.viewer!.id),
    added: saved.length,
    duplicates: duplicates,
  };
});

app.patch("/api/library/assets/:file", async (request) => {
  const { file } = request.params as { file: string };
  const body = (request.body ?? {}) as {
    title?: string;
    tags?: string[];
    description?: string;
  };
  updateAsset(request.viewer!.id, decodeURIComponent(file), body);
  return { ok: true };
});

app.put("/api/library/assets/:file/star", async (request) => {
  const { file } = request.params as { file: string };
  const body = (request.body ?? {}) as { on?: boolean };
  setAssetStar(request.viewer!.id, decodeURIComponent(file), body.on !== false);
  return { ok: true };
});

/**
 * KHO NHẠC DÙNG CHUNG — danh mục để nghe thử và chọn.
 *
 * Khác `POST /api/projects/:id/music`: đường kia nhận một bài rồi đặt THẲNG vào
 * một dự án. Còn kho thì nằm ngoài mọi dự án, ai cũng thấy như nhau.
 */
app.get("/api/library/music", async (request) =>
  listLibrary(request.viewer!.id),
);

app.post("/api/library/music", async (request, reply) => {
  let title = "";
  let tags: string[] = [];
  let saved: { file: string; seconds: number } | null = null;

  for await (const part of request.parts()) {
    if (part.type !== "file") {
      const value = String((part as { value?: unknown }).value ?? "");
      if (part.fieldname === "title") title = value.trim().slice(0, 120);
      if (part.fieldname === "tags") {
        tags = value
          .split(",")
          .map((tag) => tag.trim().slice(0, 30))
          .filter(Boolean)
          .slice(0, 12);
      }
      continue;
    }
    const name = basename(part.filename ?? "nhac.mp3");
    if (!AUDIO_LIB.test(name)) {
      // Đọc hết luồng rồi mới chối, không thì phần sau của multipart lệch khung.
      await part.toBuffer();
      return reply.code(400).send({ error: "Không nhận định dạng nhạc này" });
    }
    const file = safeName(name);
    const target = join(LIBRARY, file);
    await pipeline(part.file, createWriteStream(target));
    const length = (await probe(target).catch(() => null))?.duration ?? 0;
    // Tệp không đọc được thời lượng thì không phải nhạc — vứt ngay, đừng để kho
    // mọc ra một bài câm mà tới lúc xuất video mới vỡ.
    if (!(length > 1)) {
      await unlink(target).catch(() => {});
      return reply.code(400).send({ error: "Tệp hỏng, không đọc được nhạc" });
    }
    saved = { file, seconds: length };
  }

  if (!saved) return reply.code(400).send({ error: "Không có tệp nào" });
  rememberUpload(
    saved.file,
    title || saved.file.replace(/\.[^.]+$/, ""),
    tags,
    saved.seconds,
    request.viewer!.id,
  );
  return listLibrary(request.viewer!.id).find(
    (track) => track.file === saved!.file,
  );
});

app.put("/api/library/music/:file/star", async (request) => {
  const { file } = request.params as { file: string };
  const body = (request.body ?? {}) as { on?: boolean };
  setStar(request.viewer!.id, decodeURIComponent(file), body.on !== false);
  return { ok: true };
});
}
