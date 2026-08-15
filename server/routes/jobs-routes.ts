import type { FastifyInstance } from "fastify";
import { db } from "../db";
import {
  cancelJob,
  enqueue,
  queuePosition,
} from "../job-queue";
import {
  retryAiStep,
  resumeAfterCutReview,
  resumeAfterTextReview,
  runExport,
  runMaster,
  runTranscribe,
  setJob,
} from "../pipeline";

export default async function jobsRoutes(app: FastifyInstance) {
/*
 * ── HAI CỔNG CHỜ NGƯỜI ──
 *
 * Mạch dựng không còn đi thẳng một hơi. Nó dừng hai lần: sau khi đề xuất chỗ
 * cắt, và sau khi sửa chỗ nghe nhầm. Người dùng bấm tiếp thì pha sau chạy.
 *
 * Dừng ở đúng hai chỗ ấy vì chúng là hai thứ người không chuyên khó chịu nhất
 * khi máy làm sai — cắt hụt/cắt thừa, và sai chính tả — mà cả hai lại nằm
 * THƯỢNG NGUỒN: sửa chúng sau khi đã dựng chữ là phải dựng lại từ đầu.
 *
 * Qua hàng đợi như mọi việc nặng khác: `commit-cut` phải cắt lại tệp và chép lời một
 * lượt nữa, không nhẹ hơn lượt dựng đầu là bao.
 */
app.post("/api/projects/:id/review-cut/done", async (request, reply) => {
  const { id } = request.params as { id: string };
  const outcome = enqueue(id, "transcribe", () => resumeAfterCutReview(id));
  if (outcome === "duplicate") {
    return reply.code(409).send({ error: "Đang chạy rồi" });
  }
  return reply.send({ ok: true, queued: outcome === "queued" });
});

app.post("/api/projects/:id/review-text/done", async (request, reply) => {
  const { id } = request.params as { id: string };
  const outcome = enqueue(id, "transcribe", () => resumeAfterTextReview(id));
  if (outcome === "duplicate") {
    return reply.code(409).send({ error: "Đang chạy rồi" });
  }
  return reply.send({ ok: true, queued: outcome === "queued" });
});

app.post("/api/projects/:id/transcribe", async (request, reply) => {
  const { id } = request.params as { id: string };
  const outcome = enqueue(id, "transcribe", async () => {
    await runTranscribe(id);
    /*
     * Bản CHẤT LƯỢNG (`base.mp4`) xếp hàng NGAY SAU, chạy nền.
     *
     * Bàn dựng mở được rồi — có bản xem trước, dải ảnh, bản chép lời. Thứ duy
     * nhất còn thiếu chỉ dùng lúc XUẤT VIDEO, mà người dùng còn phải đọc và sửa
     * lời mất vài phút trước khi tới đó.
     *
     * Xếp hàng từ TRONG việc đang chạy: lúc này ngăn việc vẫn còn bận nên nó rơi
     * vào hàng chờ, và chỉ khởi động khi lượt chép lời nhả chỗ. Đó đúng là điều
     * mong muốn — máy hai lõi không nên nhận hai việc nặng một lúc.
     *
     * Xếp ở đây chứ không trong `pipeline.ts`: `job-queue.ts` đã nhập `setJob` từ
     * tệp đó, nhập ngược lại là một vòng tròn.
     */
    enqueue(id, "master", () => runMaster(id));
  });
  if (outcome === "duplicate") {
    return reply.code(409).send({ error: "Đang chép lời rồi" });
  }
  // `queued` KHÔNG phải lỗi: việc đã nhận, chỉ là máy đang bận. Trả 409 ở đây
  // thì người dùng đọc ra "hỏng rồi, bấm lại đi" và bấm lại thật.
  return reply.code(202).send({ status: outcome === "queued" ? "queued" : "running" });
});

/**
 * Chạy lại từ một chặng.
 *
 * Dùng chung ngăn việc `transcribe`: chạy lại một chặng giữa lúc cả mạch đang chạy
 * thì hai bên ghi lên cùng một bảng chặng và kết quả đọc ra lộn xộn.
 */
app.post("/api/projects/:id/steps/:key/retry", async (request, reply) => {
  const { id, key } = request.params as { id: string; key: string };
  const outcome = enqueue(id, "transcribe", async () => {
      // Chặng đầu (`prepare`, `transcribe`, `captions`) không chạy lẻ được — chúng
      // đẻ ra dữ liệu mà mọi chặng sau dựa vào. Nhưng nút Thử lại VẪN hiện ở đó, và
      // trước đây bấm vào chỉ nhận 400 rồi chẳng gì xảy ra: một cái nút chết ở đúng
      // chỗ người dùng đang bị chặn. Dựng lại cả mạch là đường duy nhất còn lại, và
      // lúc ấy không mất gì của người dùng — bàn dựng vẫn đang khoá vì chặng bắt
      // buộc đang hỏng.
      if (await retryAiStep(id, key)) {
        // ĐÓNG việc lại. `startJob` chỉ mở nó ra; chặng `transcribe` bình thường tự
        // gọi `setJob(..., "done")` ở cuối, còn phép chạy lẻ này thì không — và việc
        // treo ở "running" chặn mọi lượt `startJob` sau đó bằng 409, kể cả nút Thử
        // lại lần hai và cả lượt xuất video. Đo thật: chặng chạy xong từ lâu mà việc
        // vẫn "running · Đang xếp hàng".
        setJob(id, "transcribe", "done", 100, "Xong");
        return;
      }
      await runTranscribe(id);
  });
  if (outcome === "duplicate") {
    return reply.code(409).send({ error: "Đang có việc chạy rồi" });
  }
  return reply.code(202).send({ status: outcome === "queued" ? "queued" : "running" });
});

app.post("/api/projects/:id/export", async (request, reply) => {
  const { id } = request.params as { id: string };
  const outcome = enqueue(id, "export", (signal) => runExport(id, signal));
  if (outcome === "duplicate") {
    return reply.code(409).send({ error: "Đang xuất video rồi" });
  }
  return reply.code(202).send({ status: outcome === "queued" ? "queued" : "running" });
});

/** HUỶ lượt xuất đang chạy/chờ — bấm Huỷ ở modal xuất. */
app.post("/api/projects/:id/export/cancel", async (request, reply) => {
  const { id } = request.params as { id: string };
  const stopped = cancelJob(id, "export");
  return reply.code(stopped ? 202 : 200).send({ cancelled: stopped });
});

app.get("/api/projects/:id/jobs/:kind", async (request, reply) => {
  const { id, kind } = request.params as { id: string; kind: string };
  const job = db
    .prepare("SELECT * FROM jobs WHERE project_id=? AND kind=?")
    .get(id, kind) as Record<string, unknown> | undefined;
  /*
   * CHƯA CHẠY không phải LỖI — trả `null` với mã 200.
   *
   * Dự án mới nào cũng chưa có việc nào, mà trang hỏi việc này đều đặn để biết
   * tiến độ. Trả 404 thì mỗi dự án mới đẻ ra một dòng đỏ "Failed to load
   * resource" trong console, lặp mỗi lượt hỏi — và một dòng đỏ thường trực thì
   * khi có lỗi THẬT không ai còn nhìn nữa.
   *
   * Đo trên một dự án vừa tạo: đây đúng là nguồn duy nhất của dòng đỏ ấy.
   */
  if (!job) return reply.send(null);
  // Đứng thứ mấy — CHỈ một con số, không kèm mã dự án hay ai đứng trước. Đây là
  // route mọi người dùng đều gọi được cho dự án của mình.
  return { ...job, queuePosition: queuePosition(id, kind) };
});
}
