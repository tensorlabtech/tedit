import type { FastifyInstance } from "fastify";
import { assertOwnerIs } from "../ownership";
import { db, newId } from "../db";
import { reconcileWords, tokenize } from "../reconcile-sentence-words";
import { OUT_HEIGHT, OUT_WIDTH } from "../render";
import {
  refreshCaptionsAfterWordEdit,
} from "../caption-elements";
import { contentRect, packForElement } from "../style-pack";
import { NHIP_DEN } from "../style-pack-catalog";
import { readStylePack } from "../style-pack-store";
import { layoutText, type Band } from "../text-layout";

export default async function transcriptRoutes(app: FastifyInstance) {
/**
 * Bố cục chữ cho khung xem trước.
 *
 * Màn hình KHÔNG tự tính lấy: nó không có tệp font để đo, nên bẻ dòng sẽ khác
 * bản in ra và người dùng canh trên màn xong xuất video lại lệch. Máy chủ đo
 * bằng đúng tệp font sẽ dùng để in, rồi trả số đo theo TỈ LỆ khung.
 */
app.post("/api/layout", async (request) => {
  const body = request.body as {
    content: string;
    band?: Band;
    projectId?: string;
    /**
     * Từ khoá của cụm — thứ chốt VAI CHỮ, tức chốt luôn cỡ chữ và chỗ bẻ dòng.
     *
     * Bỏ trống thì đo bằng vai phụ đề. Với bộ dáng dùng hai họ chữ thì bỏ
     * trống là khung xem trước báo một con số mà bản in ra một con số khác.
     */
    keywords?: string[];
  };
  // Bộ dáng đổi cả cỡ chữ lẫn chỗ bẻ dòng, nên khung xem trước phải hỏi bằng bộ
  // dáng của ĐÚNG dự án đang mở. Thiếu `projectId` thì rơi về bộ mặc định.
  //
  // KIỂM QUYỀN TẠI CHỖ, không trông vào cổng chung: `auth-guard` soi mã trên
  // ĐƯỜNG DẪN, mà mã ở đây nằm trong THÂN request — đường dẫn `/api/layout`
  // không khớp mẫu nào nên nó đi thẳng qua cổng. Đây là đúng cái bẫy mà ghi chú
  // ở `ownership.ts` cảnh báo: cửa cứ mở, cho tới hôm có người đi qua.
  if (body.projectId) {
    assertOwnerIs(request.viewer!, "project", body.projectId);
  }
  // Khung xem trước phải đo trong VÙNG HÌNH của chính bộ dáng ấy — không thì nó
  // báo "vừa" cho một chỗ rộng hơn chỗ thật sự có.
  const projectPack = body.projectId ? readStylePack(body.projectId) : NHIP_DEN;
  const rect = contentRect(projectPack, OUT_WIDTH, OUT_HEIGHT);
  const layout = await layoutText(
    body.content ?? "",
    body.band ?? "top",
    rect.w,
    rect.h,
    packForElement(projectPack, null, body.keywords),
  );
  return {
    lines: layout.lines,
    truncated: layout.truncated,
    needsSplit: layout.needsSplit,
    fontRatio: layout.fontSize / OUT_HEIGHT,
    topRatio: layout.topY / OUT_HEIGHT,
    lineHeightRatio: layout.lineHeight / OUT_HEIGHT,
  };
});

/**
 * Sửa một TỪ máy nghe sai.
 *
 * Chỉ đổi chữ, giữ nguyên mốc và hạ cờ "không chắc": người đã nghe lại rồi thì
 * máy không còn quyền nghi ngờ nữa.
 */
app.patch("/api/words/:wordId", async (request, reply) => {
  const { wordId } = request.params as { wordId: string };
  const body = request.body as { text?: string };
  if (!body.text?.trim()) {
    return reply.code(400).send({ error: "Chữ không được để trống" });
  }
  // Đọc chữ CŨ trước khi ghi đè: đó là thứ duy nhất cho biết chữ trên màn nào
  // còn nguyên như máy sinh ra và nên sửa theo.
  const previous = db
    .prepare("SELECT project_id, text FROM words WHERE id=?")
    .get(wordId) as { project_id: string; text: string } | undefined;
  // Không có từ này thì phải NÓI. Trả 200 cho một mã không tồn tại là nói dối:
  // màn hình đã đổi chữ theo kiểu lạc quan, máy chủ im lặng không ghi gì, và
  // lần mở sau cú sửa biến mất mà không ai báo. Xảy ra thật khi một tab cũ còn
  // giữ mã từ của bản chép lời đã bị thay.
  if (!previous) return reply.code(404).send({ error: "Không có từ này" });
  db.prepare("UPDATE words SET text=?, confidence=1 WHERE id=?").run(
    body.text.trim(),
    wordId,
  );
  {
    refreshCaptionsAfterWordEdit(
      previous.project_id,
      wordId,
      previous.text,
      body.text.trim(),
    );
  }
  const word = db.prepare("SELECT * FROM words WHERE id=?").get(wordId) as
    { sentence_id: string } | undefined;
  if (word) {
    // Dựng lại lời của câu từ các từ: hai nguồn lệch nhau thì bản chép lời hiện
    // một đằng mà bản in ra một nẻo.
    const words = db
      .prepare("SELECT text FROM words WHERE sentence_id=? ORDER BY position")
      .all(word.sentence_id) as Array<{ text: string }>;
    db.prepare("UPDATE sentences SET text=? WHERE id=?").run(
      words.map((item) => item.text).join(" "),
      word.sentence_id,
    );
  }
  return db.prepare("SELECT * FROM words WHERE id=?").get(wordId);
});

app.patch("/api/sentences/:sentenceId", async (request) => {
  const { sentenceId } = request.params as { sentenceId: string };
  const body = request.body as { removed?: boolean; text?: string };
  if (typeof body.removed === "boolean") {
    db.prepare("UPDATE sentences SET removed=? WHERE id=?").run(
      body.removed ? 1 : 0,
      sentenceId,
    );
  }
  if (typeof body.text === "string") {
    db.prepare("UPDATE sentences SET text=? WHERE id=?").run(
      body.text,
      sentenceId,
    );
  }
  return db.prepare("SELECT * FROM sentences WHERE id=?").get(sentenceId);
});

/**
 * Đặt lại CẢ DÒNG bằng văn bản mới — sửa/chèn/xoá chữ trong một đường.
 *
 * Khớp chữ mới với từ cũ (xem `reconcile-sentence-words`): từ không đổi được
 * UPDATE tại chỗ (giữ id nên NEO phụ đề còn sống), từ thừa bị xoá, từ mới được
 * chèn với mốc nội suy. Người dùng đã soi cả dòng nên hạ hết cờ "không chắc".
 *
 * Xoá-rồi-chèn hàng loạt như `commit-cut` an toàn ở bước này vì phụ đề chỉ dựng
 * SAU khi soát lời — lúc này bảng `elements` còn rỗng ở luồng thường.
 */
app.patch("/api/sentences/:sentenceId/words", async (request, reply) => {
  const { sentenceId } = request.params as { sentenceId: string };
  const body = request.body as { text?: string };
  const sentence = db
    .prepare("SELECT project_id, start_sec, end_sec FROM sentences WHERE id=?")
    .get(sentenceId) as
    | { project_id: string; start_sec: number; end_sec: number }
    | undefined;
  if (!sentence) return reply.code(404).send({ error: "Không có câu này" });

  const tokens = tokenize(body.text ?? "");
  // Dòng trống dùng đường XOÁ (đặt `removed`), không đi đường này — một câu
  // không còn từ nào là một mâu thuẫn dữ liệu, không phải một cách xoá.
  if (tokens.length === 0) {
    return reply.code(400).send({ error: "Câu không được để trống" });
  }

  const oldWords = db
    .prepare(
      "SELECT id, text, start_sec, end_sec FROM words WHERE sentence_id=? ORDER BY position",
    )
    .all(sentenceId) as Array<{
    id: string;
    text: string;
    start_sec: number;
    end_sec: number;
  }>;

  const next = reconcileWords(
    oldWords,
    tokens,
    sentence.start_sec,
    sentence.end_sec,
  );
  const keepIds = new Set(next.map((word) => word.id).filter(Boolean));

  const rewrite = db.transaction(() => {
    // Từ cũ không còn khớp thì bỏ; từ khớp giữ lại để UPDATE tại chỗ.
    for (const word of oldWords) {
      if (!keepIds.has(word.id)) {
        db.prepare("DELETE FROM words WHERE id=?").run(word.id);
      }
    }
    const update = db.prepare(
      "UPDATE words SET position=?, text=?, start_sec=?, end_sec=?, confidence=1 WHERE id=?",
    );
    const insert = db.prepare(
      "INSERT INTO words (id, project_id, sentence_id, position, text, start_sec, end_sec, confidence) VALUES (?,?,?,?,?,?,?,1)",
    );
    next.forEach((word, index) => {
      if (word.id) {
        update.run(index, word.text, word.start, word.end, word.id);
      } else {
        insert.run(
          newId("w"),
          sentence.project_id,
          sentenceId,
          index,
          word.text,
          word.start,
          word.end,
        );
      }
    });
    db.prepare("UPDATE sentences SET text=? WHERE id=?").run(
      tokens.join(" "),
      sentenceId,
    );
  });
  rewrite();

  return {
    words: db
      .prepare("SELECT * FROM words WHERE sentence_id=? ORDER BY position")
      .all(sentenceId),
  };
});

/**
 * THÊM một câu vào chỗ máy nghe bỏ sót (khe "＋ thêm lời").
 *
 * Nhận khoảng `[start, end]` của khe và văn bản người gõ; dựng câu mới với các
 * từ chia đều mốc trong khoảng ấy. Vị trí (`position`) đánh lại theo mốc để
 * mạch câu vẫn đúng thứ tự đọc sau khi chèn.
 */
app.post("/api/projects/:projectId/sentences", async (request, reply) => {
  const { projectId } = request.params as { projectId: string };
  const body = request.body as { start?: number; end?: number; text?: string };
  const tokens = tokenize(body.text ?? "");
  if (tokens.length === 0) {
    return reply.code(400).send({ error: "Câu không được để trống" });
  }
  const start = Number(body.start);
  const end = Number(body.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return reply.code(400).send({ error: "Khoảng thời gian không hợp lệ" });
  }

  const words = reconcileWords([], tokens, start, end);
  const sentenceId = newId("s");

  const write = db.transaction(() => {
    db.prepare(
      "INSERT INTO sentences (id, project_id, position, text, start_sec, end_sec, removed) VALUES (?,?,?,?,?,?,0)",
    ).run(sentenceId, projectId, 0, tokens.join(" "), start, end);
    const insert = db.prepare(
      "INSERT INTO words (id, project_id, sentence_id, position, text, start_sec, end_sec, confidence) VALUES (?,?,?,?,?,?,?,1)",
    );
    words.forEach((word, index) => {
      insert.run(
        newId("w"),
        projectId,
        sentenceId,
        index,
        word.text,
        word.start,
        word.end,
      );
    });
    // Đánh lại thứ tự MỌI câu theo mốc — câu vừa chèn nằm đúng chỗ trong mạch.
    const ordered = db
      .prepare(
        "SELECT id FROM sentences WHERE project_id=? ORDER BY start_sec",
      )
      .all(projectId) as Array<{ id: string }>;
    const setPos = db.prepare("UPDATE sentences SET position=? WHERE id=?");
    ordered.forEach((row, index) => setPos.run(index, row.id));
  });
  write();

  return {
    sentence: db.prepare("SELECT * FROM sentences WHERE id=?").get(sentenceId),
    words: db
      .prepare("SELECT * FROM words WHERE sentence_id=? ORDER BY position")
      .all(sentenceId),
  };
});
}
