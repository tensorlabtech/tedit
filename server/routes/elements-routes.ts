import type { FastifyInstance } from "fastify";
import { assertInProject } from "../ownership";
import { db, newId } from "../db";
import {
  applyTextBackToWords,
  createCaptionElements,
} from "../caption-elements";
import { KEY_COLORS } from "../style-pack";
import { STYLE_PACKS } from "../style-pack-catalog";
import { readStylePack } from "../style-pack-store";
import { type Band } from "../text-layout";

/** Khối chữ ngắn hơn mức này thì đọc không kịp — cũng là sàn lúc kéo hai đầu. */
const MIN_TEXT_LENGTH = 0.4;

export default async function elementsRoutes(app: FastifyInstance) {
app.post("/api/projects/:id/elements", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as {
    // `layout` = ô NGƯỜI (segment bố cục không cần tư liệu). `insert` = b-roll (có
    // tư liệu). Cùng bảng, phân biệt bằng `media_file_id`.
    kind?: "text" | "insert" | "layout";
    fromWordId?: string;
    toWordId?: string;
    content?: string;
    band?: string;
    mediaFileId?: string;
    /** Mã bố cục cho segment (b-roll hoặc ô người). */
    insertLayout?: string | null;
    /** Neo theo giờ — chữ tự do dùng cặp này thay cho cặp mã từ */
    start?: number;
    end?: number;
  };
  // HAI kiểu neo, phải có đúng một kiểu.
  //
  // Neo theo TỪ: chữ chép lời và tư liệu chèn — chúng thuộc về mấy tiếng cụ thể,
  // bỏ câu phía trước thì vẫn dính đúng chỗ.
  // Neo theo GIỜ: chữ tự do (tiêu đề, con số) — nó thuộc về một khoảnh khắc,
  // không chép tiếng nào, nên bắt nó chọn một câu là bịa ra quan hệ không có.
  const byWord = Boolean(body.fromWordId && body.toWordId);
  const byTime = typeof body.start === "number" && typeof body.end === "number";
  if (!body.kind || (!byWord && !byTime)) {
    return reply.code(400).send({ error: "Thiếu loại hoặc khoảng" });
  }
  if (byTime && (body.end as number) <= (body.start as number)) {
    return reply.code(400).send({ error: "Khoảng rỗng" });
  }
  // Ba mã này tới từ thân request nên cổng chặn không thấy: phải tự đối chiếu
  // chúng có thuộc đúng dự án đang sửa hay không.
  assertInProject(id, "file", body.mediaFileId);
  assertInProject(id, "word", body.fromWordId);
  assertInProject(id, "word", body.toWordId);
  const elementId = newId("e");
  db.prepare(
    `INSERT INTO elements (id, project_id, kind, from_word_id, to_word_id, start_sec, end_sec, content, position_band, media_file_id, insert_layout, align, emphasis, reveal, shape)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,'center','taper','none','full')`,
  ).run(
    elementId,
    id,
    body.kind,
    byWord ? body.fromWordId : null,
    byWord ? body.toWordId : null,
    byWord ? null : body.start,
    byWord ? null : body.end,
    body.content ?? null,
    body.band ?? "top",
    body.mediaFileId ?? null,
    body.insertLayout ?? null,
  );
  return db.prepare("SELECT * FROM elements WHERE id=?").get(elementId);
});

/**
 * Áp một KIỂU cho toàn bộ chữ chạy theo lời của dự án.
 *
 * Đo trên một dự án thật: 82% cụm giữ dáng mặc định, 88% giữ chỗ đặt, 90% giữ
 * căn ngang. Nghĩa là người dùng gần như không đổi từng cụm — họ muốn đổi PHONG
 * CÁCH của cả video. Mà bảng sửa chỉ sửa được một cụm, nên việc đó là 51 cú bấm
 * y hệt nhau.
 *
 * Chỉ áp cho chữ neo theo TỪ. Chữ tự do là tiêu đề, con số, nhãn — người dùng
 * đặt tay từng cái với ý riêng, gộp nó vào một cú "áp cho tất cả" là xoá mất
 * đúng những chỗ đã bỏ công nhất.
 */
app.patch("/api/projects/:id/elements/style", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = (request.body ?? {}) as {
    band?: string;
    align?: string;
    emphasis?: string;
    /** Phong cách chữ cho CẢ VIDEO: đặt mặc định dự án + xoá đè từng cụm. */
    fontStyle?: string | null;
  };
  const sets: string[] = [];
  const values: string[] = [];
  if (body.band) {
    sets.push("position_band=?");
    values.push(body.band);
  }
  if (body.align) {
    sets.push("align=?");
    values.push(body.align);
  }
  if (body.emphasis) {
    sets.push("emphasis=?");
    values.push(body.emphasis);
  }
  let changed = 0;
  if (sets.length > 0) {
    changed = db
      .prepare(
        `UPDATE elements SET ${sets.join(", ")}
         WHERE project_id=? AND kind='text' AND start_sec IS NULL`,
      )
      .run(...values, id).changes;
  }
  // PHONG CÁCH CHỮ cả video: KHÁC các trục trên — không ghi vào từng cụm mà đặt
  // MẶC ĐỊNH dự án rồi XOÁ đè của mọi cụm, để tất cả cùng theo một bộ. `null` là
  // bỏ đè (theo font của bộ chính). Tên lạ gạt về `null`.
  if (body.fontStyle !== undefined) {
    const next = STYLE_PACKS.some((p) => p.id === body.fontStyle)
      ? body.fontStyle
      : null;
    db.prepare("UPDATE projects SET font_style=? WHERE id=?").run(next, id);
    db.prepare(
      "UPDATE elements SET font_style=NULL WHERE project_id=? AND kind='text'",
    ).run(id);
  }
  if (sets.length === 0 && body.fontStyle === undefined) {
    return reply.code(400).send({ error: "Không có kiểu nào để áp" });
  }
  return { changed };
});

app.patch("/api/elements/:elementId", async (request, reply) => {
  const { elementId } = request.params as { elementId: string };
  const body = request.body as {
    content?: string;
    band?: string;
    align?: string;
    emphasis?: string;
    reveal?: string;
    shape?: string;
    /** Bố cục hiện b-roll (element kind='insert'). `null` = để máy tự chọn. */
    insertLayout?: string | null;
    /** Look Ô đóng dấu (JSON `FrameBlock`) khi nhặt khung từ pool; `null` = xoá. */
    frameBlock?: string | null;
    /** Mã preset của khung đã nhặt — để picker tô đúng khi trộn. */
    framePreset?: string | null;
    /** Look CHỮ đóng dấu (JSON `CaptionBlock`) khi nhặt phong cách chữ từ pool; `null` = xoá. */
    captionBlock?: string | null;
    /** Mã preset của phong cách chữ đã nhặt — để picker tô đúng khi trộn. */
    captionPreset?: string | null;
    /** Đổi tệp media của b-roll (element kind='insert'). */
    mediaFileId?: string;
    /** LẤY PHẦN clip b-roll: giây in/out TRONG clip nguồn. `null` = cả clip. */
    mediaIn?: number | null;
    mediaOut?: number | null;
    keywords?: string[];
    /** `null` = bỏ đè, quay về theo bộ dáng của dự án */
    letterCase?: string | null;
    keyColor?: string | null;
    /** Phong cách chữ riêng cụm này. `null` = theo mặc định dự án. */
    fontStyle?: string | null;
    sentenceId?: string;
    fromWordId?: string;
    toWordId?: string;
    /** Kéo hai đầu khối chữ tự do trên dải */
    start?: number;
    end?: number;
  };
  const current = db
    .prepare("SELECT * FROM elements WHERE id=?")
    .get(elementId) as
    | {
        project_id: string;
        kind: string;
        content: string | null;
        from_word_id: string;
        to_word_id: string;
      }
    | undefined;
  if (!current) return reply.code(404).send({ error: "Không có phần tử này" });

  // Ba mã neo tới từ thân request. Dự án suy ra từ chính phần tử đang sửa — cổng
  // chặn đã xác nhận phần tử đó thuộc người gọi, nên đây chỉ còn việc buộc mấy
  // mã neo phải cùng dự án với nó.
  assertInProject(current.project_id, "sentence", body.sentenceId);
  assertInProject(current.project_id, "word", body.fromWordId);
  assertInProject(current.project_id, "word", body.toWordId);

  // Kéo hai đầu khối chữ tự do. Chặn hai mép chạm nhau ở MÁY CHỦ chứ không chỉ
  // ở màn hình — màn hình có thể là bản cũ, còn đây là cửa duy nhất.
  if (typeof body.start === "number" || typeof body.end === "number") {
    const marks = db
      .prepare("SELECT start_sec, end_sec FROM elements WHERE id=?")
      .get(elementId) as { start_sec: number | null; end_sec: number | null };
    const first = body.start ?? marks.start_sec ?? 0;
    const last = body.end ?? marks.end_sec ?? 0;
    if (last - first >= MIN_TEXT_LENGTH) {
      db.prepare("UPDATE elements SET start_sec=?, end_sec=? WHERE id=?").run(
        Math.max(0, first),
        last,
        elementId,
      );
    }
  }

  if (typeof body.content === "string") {
    db.prepare("UPDATE elements SET content=? WHERE id=?").run(
      body.content,
      elementId,
    );
    // Sửa chữ ở đây thì sửa luôn LỜI CHÉP bên dưới, khi còn ghép được một-một.
    //
    // Đây là điều làm cho "sửa chữ chỉ có một chỗ" thành đúng: người dùng sửa
    // một lỗi nghe nhầm trên chữ, mà bản chép lời vẫn giữ lỗi cũ thì lần sinh
    // chữ sau hoặc hàng soát lại nói ngược. Chỉ ghép khi SỐ TIẾNG khớp — họ rút
    // gọn hay viết lại hẳn thì không còn tiếng nào ứng với tiếng nào.
    if (current.kind === "text") {
      applyTextBackToWords(
        current.project_id,
        current.from_word_id,
        current.to_word_id,
        body.content,
      );
    }
  }
  if (typeof body.band === "string") {
    db.prepare("UPDATE elements SET position_band=? WHERE id=?").run(
      body.band,
      elementId,
    );
  }
  // Bố cục b-roll: nhận cả `null` (về tự động) nên không gộp vào vòng chỉ-chuỗi dưới.
  if (body.insertLayout !== undefined) {
    db.prepare("UPDATE elements SET insert_layout=? WHERE id=?").run(
      body.insertLayout,
      elementId,
    );
  }
  // Look Ô đóng dấu: nhặt khung từ pool thì ghi luôn nền/viền của khung vào cảnh.
  // Nhận cả `null` (xoá đè → migration/generate stamp lại theo preset dự án).
  if (body.frameBlock !== undefined) {
    // Ghi kèm mã PRESET của khung đã nhặt → picker tô đúng dù đã trộn look khác
    // preset dự án. `null` khi xoá đè (stamp lại theo preset dự án sau).
    db.prepare("UPDATE elements SET frame_block=?, frame_preset=? WHERE id=?").run(
      body.frameBlock,
      body.framePreset ?? null,
      elementId,
    );
  }
  // Look CHỮ đóng dấu: nhặt phong cách chữ từ pool thì ghi look chữ vào cụm.
  // Nhận cả `null` (xoá đè → generate/migration stamp lại theo preset dự án).
  if (body.captionBlock !== undefined) {
    db.prepare(
      "UPDATE elements SET caption_block=?, caption_preset=? WHERE id=?",
    ).run(body.captionBlock, body.captionPreset ?? null, elementId);
  }
  // Đổi tệp b-roll: tệp phải thuộc CHÍNH dự án của phần tử — cổng chặn đã xác nhận
  // phần tử thuộc người gọi, nên chỉ còn buộc tệp cùng dự án với nó.
  if (typeof body.mediaFileId === "string") {
    const owns = db
      .prepare("SELECT 1 FROM media_files WHERE id=? AND project_id=?")
      .get(body.mediaFileId, current.project_id);
    if (!owns) return reply.code(400).send({ error: "Tệp không thuộc dự án" });
    db.prepare("UPDATE elements SET media_file_id=? WHERE id=?").run(
      body.mediaFileId,
      elementId,
    );
  }
  // LẤY PHẦN clip b-roll: giây in/out trong clip nguồn (`null` = cả clip). Nhận
  // riêng vì cần cả giá trị `null` (bỏ cắt → phát cả clip lại).
  if (body.mediaIn !== undefined || body.mediaOut !== undefined) {
    const marks = db
      .prepare("SELECT media_in_sec, media_out_sec FROM elements WHERE id=?")
      .get(elementId) as {
      media_in_sec: number | null;
      media_out_sec: number | null;
    };
    db.prepare(
      "UPDATE elements SET media_in_sec=?, media_out_sec=? WHERE id=?",
    ).run(
      body.mediaIn !== undefined ? body.mediaIn : marks.media_in_sec,
      body.mediaOut !== undefined ? body.mediaOut : marks.media_out_sec,
      elementId,
    );
  }
  for (const [key, value] of [
    ["align", body.align],
    ["emphasis", body.emphasis],
    ["reveal", body.reveal],
    ["shape", body.shape],
  ] as const) {
    if (typeof value === "string") {
      db.prepare(`UPDATE elements SET ${key}=? WHERE id=?`).run(
        value,
        elementId,
      );
    }
  }
  if (Array.isArray(body.keywords)) {
    db.prepare("UPDATE elements SET keywords=? WHERE id=?").run(
      body.keywords.join("|"),
      elementId,
    );
  }
  // Hai cột ĐÈ ở cấp cụm. `null` là BỎ ĐÈ, quay về theo bộ dáng của dự án —
  // nên phải phân biệt `null` với "không gửi trường này", và đó là lý do chỗ
  // này kiểm `!== undefined` chứ không kiểm giá trị có thật hay không.
  //
  // Giá trị lạ bị gạt chứ không ghi: cột này đi thẳng vào lệnh vẽ, một chuỗi
  // rác ở đây thành một màu ffmpeg không đọc được và cả lượt xuất video hỏng.
  if (body.letterCase !== undefined) {
    const next =
      body.letterCase === "upper" || body.letterCase === "as-typed"
        ? body.letterCase
        : null;
    db.prepare("UPDATE elements SET letter_case=? WHERE id=?").run(
      next,
      elementId,
    );
  }
  if (body.keyColor !== undefined) {
    const next = KEY_COLORS.some((item) => item.value === body.keyColor)
      ? body.keyColor
      : null;
    db.prepare("UPDATE elements SET key_color=? WHERE id=?").run(
      next,
      elementId,
    );
  }
  // Phong cách chữ riêng cụm. `null` = bỏ đè; tên lạ cũng gạt về `null` để không
  // có chuỗi rác đi vào lệnh vẽ.
  if (body.fontStyle !== undefined) {
    const next = STYLE_PACKS.some((item) => item.id === body.fontStyle)
      ? body.fontStyle
      : null;
    db.prepare("UPDATE elements SET font_style=? WHERE id=?").run(
      next,
      elementId,
    );
  }
  // Kéo mép: neo lại vào TỪ khác. Mép b-roll bám ranh giới từ chứ không bám
  // giây — cùng lý do với mọi thứ khác trên bàn dựng (đặc tả §1): cắt bỏ một
  // câu phía trước thì nó vẫn dính đúng chỗ mà không phải tính lại mốc.
  for (const [cot, giaTri] of [
    ["from_word_id", body.fromWordId],
    ["to_word_id", body.toWordId],
  ] as const) {
    if (typeof giaTri !== "string") continue;
    const exists = db.prepare("SELECT 1 FROM words WHERE id=?").get(giaTri);
    if (exists) {
      db.prepare(`UPDATE elements SET ${cot}=? WHERE id=?`).run(
        giaTri,
        elementId,
      );
    }
  }
  // Dời sang câu khác: neo lại vào khoảng từ của câu đó, giữ nguyên mọi kiểu.
  if (body.sentenceId) {
    const words = db
      .prepare("SELECT id FROM words WHERE sentence_id=? ORDER BY position")
      .all(body.sentenceId) as Array<{ id: string }>;
    if (words.length > 0) {
      db.prepare(
        "UPDATE elements SET from_word_id=?, to_word_id=? WHERE id=?",
      ).run(words[0].id, words[words.length - 1].id, elementId);
    }
  }
  return db.prepare("SELECT * FROM elements WHERE id=?").get(elementId);
});

app.delete("/api/elements/:elementId", async (request) => {
  const { elementId } = request.params as { elementId: string };
  db.prepare("DELETE FROM elements WHERE id=?").run(elementId);
  return { ok: true };
});

/**
 * Lấp chữ cho một câu đang trống.
 *
 * Không còn nút "tạo chữ" toàn dự án: chữ đã tự có từ lúc chép lời. Cửa này chỉ
 * dùng khi người dùng xoá hết chữ của một câu rồi muốn lấy lại — hỏi ngay tại
 * câu đó, không phải một cái nút toàn cục làm cả video mọc chữ.
 */
app.post("/api/projects/:id/captions", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = (request.body ?? {}) as { sentenceId?: string };
  // Mã câu tới từ thân request — cổng chặn không thấy nó.
  assertInProject(id, "sentence", body.sentenceId);
  const sentence = body.sentenceId
    ? (db
        .prepare("SELECT start_sec, end_sec FROM sentences WHERE id=?")
        .get(body.sentenceId) as
        { start_sec: number; end_sec: number } | undefined)
    : undefined;
  if (body.sentenceId && !sentence) {
    return reply.code(404).send({ error: "Không có câu này" });
  }
  const band = ((
    db.prepare("SELECT subtitle_band FROM projects WHERE id=?").get(id) as
      { subtitle_band: string | null } | undefined
  )?.subtitle_band ?? "bottom") as Band;
  const created = await createCaptionElements(
    id,
    band,
    readStylePack(id),
    sentence ? { start: sentence.start_sec, end: sentence.end_sec } : undefined,
  );
  return { created };
});
}
