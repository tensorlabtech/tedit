import type { FastifyInstance } from "fastify";
import { assertOwnerIs } from "../ownership";
import { db } from "../db";
import { OUT_HEIGHT, OUT_WIDTH } from "../render";
import {
  refreshCaptionsAfterWordEdit,
} from "../caption-elements";
import { contentRect, packForElement } from "../style-pack";
import { BASE_PACK } from "../style-pack-catalog";
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
  // dáng của ĐÚNG dự án đang mở. Thiếu `projectId` thì rơi về bộ gốc.
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
  const projectPack = body.projectId ? readStylePack(body.projectId) : BASE_PACK;
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
}
