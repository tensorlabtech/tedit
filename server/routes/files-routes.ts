import type { FastifyInstance } from "fastify";
import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { db, newId } from "../db";
import { intakeMediaFile, isAcceptedMedia } from "../media-intake";
import { ensureProjectDirs, workDir } from "../paths";

export default async function filesRoutes(app: FastifyInstance) {
app.post("/api/projects/:id/files", async (request, reply) => {
  const { id } = request.params as { id: string };
  if (!db.prepare("SELECT 1 FROM projects WHERE id=?").get(id)) {
    return reply.code(404).send({ error: "Không có dự án này" });
  }
  ensureProjectDirs(id);

  const saved: unknown[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];

  /**
   * Thứ tự NGƯỜI DÙNG chọn, do màn nạp tệp gửi kèm.
   *
   * Không suy ra được ở đây: mỗi tệp đi một request riêng và chúng chạy đua nhau,
   * nên "tệp nào tới trước" là thứ tự tệp nào NHẸ NHẤT, không phải thứ tự người
   * dùng xếp. Đo thật trên một dự án 6 cảnh: người dùng chọn main-1…main-6, mốc
   * lưu ra là 5-1-2-4-3-6 và độ dài lần lượt 8,0 · 6,1 · 10,0 · 38,7 · 42,0 · 13,1
   * giây — đúng thứ tự từ nhẹ tới nặng. Mà thứ tự này là thứ tự CẢNH TRONG PHIM.
   *
   * Chỉ có màn nạp tệp biết thứ tự thật, nên nó phải nói ra. Thiếu thì rơi về lối
   * cũ `MAX+1` — tải lên bằng công cụ khác vẫn chạy, chỉ là không giữ được thứ tự.
   */
  let order: number | null = null;
  // Vai người dùng định cho tệp, do nơi thêm gửi kèm ("insert" từ bàn dựng). Chỉ
  // nhận đúng hai giá trị hợp lệ; thứ khác coi như không nói gì.
  let intendedRole: "main" | "insert" | null = null;

  for await (const part of request.parts()) {
    if (part.type !== "file") {
      if (part.fieldname === "order") {
        const value = Number((part as { value?: unknown }).value);
        if (Number.isFinite(value)) order = Math.max(0, Math.trunc(value));
      }
      if (part.fieldname === "role") {
        const value = (part as { value?: unknown }).value;
        if (value === "main" || value === "insert") intendedRole = value;
      }
      continue;
    }
    const name = basename(part.filename ?? "khong-ten");
    if (!isAcceptedMedia(name)) {
      // Phải đọc hết luồng rồi mới bỏ, không thì phần sau của multipart lệch khung.
      await part.toBuffer();
      rejected.push({ name, reason: "Không nhận định dạng này" });
      continue;
    }

    /*
     * Hứng xuống một chỗ TẠM, rồi mới giao cho `intakeMediaFile`.
     *
     * Đường này và đường tus cắt mảnh phải nhận tệp theo đúng một luật, nên chỗ
     * đo–dựng ảnh–ghi hàng nằm chung ở `media-intake.ts`. Còn ở đây chỉ còn đúng
     * việc của HTTP: hứng byte và dọn nếu hứng hỏng.
     *
     * `@fastify/multipart` ném khi tệp vượt hạn mức, và ổ đầy cũng ném — cả hai
     * đều xảy ra SAU khi một phần tệp đã nằm trên đĩa. Không dọn thì mảnh ấy ở
     * lại mãi: không hàng nào trong CSDL trỏ tới nó nên không đường nào xoá được,
     * mà nó vẫn chiếm chỗ.
     */
    const staged = join(workDir(id), `intake-${newId("u")}`);
    try {
      await pipeline(part.file, createWriteStream(staged));
      // Vượt hạn mức mà thư viện KHÔNG ném thì cờ này là dấu duy nhất. Tệp cụt
      // đi tiếp sẽ thành một ô trông như dùng được, và chỗ vỡ dời tới tận lúc
      // dựng — sau khi người dùng đã đợi vài phút chép lời.
      if (part.file.truncated) throw new Error("Tệp vượt hạn mức");
    } catch {
      await unlink(staged).catch(() => {});
      rejected.push({ name, reason: "Tệp quá lớn hoặc đứt giữa chừng" });
      continue;
    }

    const result = await intakeMediaFile({
      projectId: id,
      stagedPath: staged,
      originalName: name,
      order,
      intendedRole,
      bytes: part.file.bytesRead ?? 0,
    });
    // Cảnh báo đi kèm TỆP, không gộp vào lỗi chung: người dùng cần biết đúng tệp
    // nào có vấn đề, mà mấy chuyện này không chặn việc dựng.
    if (result.ok) saved.push({ ...result.row, warnings: result.warnings });
    else rejected.push({ name, reason: result.reason });
  }

  return { saved, rejected };
});

app.get("/api/files/:fileId/raw", async (request, reply) => {
  const { fileId } = request.params as { fileId: string };
  const file = db
    .prepare("SELECT stored_path, name FROM media_files WHERE id=?")
    .get(fileId) as { stored_path: string; name: string } | undefined;
  if (!file) return reply.code(404).send({ error: "Không có tệp này" });
  return reply.sendFile(
    file.stored_path.slice(file.stored_path.indexOf("/data/") + 6),
  );
});

app.patch("/api/files/:fileId", async (request, reply) => {
  const { fileId } = request.params as { fileId: string };
  const body = request.body as {
    role?: string;
    position?: number;
    description?: string;
  };
  const file = db
    .prepare("SELECT * FROM media_files WHERE id=?")
    .get(fileId) as { has_audio: number; role: string } | undefined;
  if (!file) return reply.code(404).send({ error: "Không có tệp này" });

  // Tệp không có tiếng thì không làm được video chính: video chính là phần CÓ
  // lời nói, và cả bản chép lời dựng từ đó.
  if (body.role === "main" && !file.has_audio) {
    return reply
      .code(400)
      .send({ error: "Tệp không có tiếng, không làm video chính được" });
  }
  if (body.role) {
    db.prepare("UPDATE media_files SET role=? WHERE id=?").run(
      body.role,
      fileId,
    );
  }
  if (typeof body.position === "number") {
    db.prepare("UPDATE media_files SET position=? WHERE id=?").run(
      body.position,
      fileId,
    );
  }
  // Mô tả tư liệu chèn. Người dùng viết thì máy KHÔNG đọc lại: chặng đọc tư liệu
  // chỉ chạm tệp nào cột này còn rỗng, nên viết vào đây là thắng luôn máy — và
  // đúng ra phải thế, máy chỉ tả được thứ nhìn thấy còn ý nghĩa thì người biết.
  //
  // Xoá trắng thì trả tệp về cho máy đọc ở lượt dựng sau. Ghi `NULL` chứ không
  // ghi chuỗi rỗng cho khớp với điều kiện `IS NULL OR =''` bên chặng đó.
  if (typeof body.description === "string") {
    const clean = body.description.trim().slice(0, 600);
    db.prepare("UPDATE media_files SET description=? WHERE id=?").run(
      clean || null,
      fileId,
    );
  }
  return db.prepare("SELECT * FROM media_files WHERE id=?").get(fileId);
});

app.delete("/api/files/:fileId", async (request) => {
  const { fileId } = request.params as { fileId: string };
  const file = db
    .prepare("SELECT stored_path FROM media_files WHERE id=?")
    .get(fileId) as { stored_path: string } | undefined;
  db.prepare("DELETE FROM media_files WHERE id=?").run(fileId);
  if (file) await unlink(file.stored_path).catch(() => {});
  return { ok: true };
});
}
