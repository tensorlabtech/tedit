import { FileStore } from "@tus/file-store";
import { MemoryLocker, Server, type Upload } from "@tus/server";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { mkdirSync } from "node:fs";

import { db, newId } from "../db";
import { intakeMediaFile, isAcceptedMedia } from "../media-intake";
import { uploadsDir } from "../paths";

/**
 * Tải lên CẮT MẢNH, nối lại được sau khi đứt (giao thức tus).
 *
 * Vì sao không còn dùng một request multipart cho cả tệp:
 *
 * 1. Cloudflare đứng trước máy chủ và **chối mọi thân request quá 100 MB** — đo
 *    thật ngày 03/08/2026: 100 MB qua, 105 MB trả 413 sau khi nuốt ~2 MB. Một
 *    video quay bằng điện thoại thường nặng gấp mấy lần thế, nên đường cũ chỉ
 *    chạy được với tệp nhỏ. Mảnh vài chục MB thì không bao giờ chạm trần đó.
 * 2. Đứt giữa chừng là MẤT TRẮNG. Một tệp 800 MB rơi mạng ở phút thứ mười hai
 *    phải tải lại từ số không — mà đây là 4G và wifi quán, không phải phòng máy.
 *    Chuyện này xảy ra bất kể có Cloudflare hay không.
 *
 * Đường multipart cũ ở `files-routes.ts` GIỮ NGUYÊN, không bỏ: công cụ ngoài và
 * kịch bản thử vẫn gọi nó, và với tệp nhỏ nó vẫn là đường ngắn nhất. Cả hai đi
 * chung `intakeMediaFile` nên luật nhận tệp chỉ có một bản.
 */

/**
 * Mảnh sống được bao lâu nếu người dùng bỏ ngang.
 *
 * Đủ dài để tải tiếp vào hôm sau — bỏ dở tối nay, mở lại sáng mai vẫn còn. Đủ
 * ngắn để một lượt bỏ ngang không nằm lại trên đĩa hàng tuần; VPS này dùng chung
 * với bảy dự án khác, chỗ trống không phải của riêng ai.
 */
const CHUNK_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** Dọn mảnh quá hạn mỗi giờ. */
const SWEEP_EVERY_MS = 60 * 60 * 1000;

/** `/api/projects/<mã>/uploads` và mọi thứ dưới nó. */
const UPLOAD_PATH = /^\/api\/projects\/([^/]+)\/uploads(?:\/|$)/;

/**
 * Mã dự án đọc từ ĐƯỜNG DẪN, không đọc từ metadata người dùng gửi.
 *
 * `authGuard` chỉ kiểm được thứ nằm trên đường dẫn (`ownership.ts` →
 * `URL_OWNER_RULES`). Tin vào một mã dự án nằm trong metadata là tự mở đường ghi
 * tệp vào dự án của người khác — cổng đã kiểm dự án A rồi, mà thân request lại
 * nói hãy ghi vào B.
 */
/**
 * Lấy phần ĐƯỜNG DẪN, dù đưa vào là URL đầy đủ hay đường dẫn trần.
 *
 * `req.url` mà tus đưa vào các móc là URL ĐẦY ĐỦ (`http://máy/api/...`), khác
 * `request.raw.url` của Node vốn chỉ có đường dẫn. Neo regex vào đầu chuỗi mà
 * quên điều đó thì mọi phép so đều trượt và mọi lượt tạo đều trả 404 — đúng lỗi
 * `check:upload` đã bắt được.
 */
function pathOf(url: string): string {
  try {
    return new URL(url, "http://localhost").pathname;
  } catch {
    return url.split("?")[0];
  }
}

function projectFromUrl(url: string): string | null {
  const match = UPLOAD_PATH.exec(pathOf(url));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/** Tiền tố để dựng đường tải lên, giữ nguyên dạng TƯƠNG ĐỐI. */
function uploadPrefix(url: string): string {
  const path = pathOf(url);
  const at = path.indexOf("/uploads");
  return at < 0 ? path : path.slice(0, at + "/uploads".length);
}

const store = new FileStore({
  directory: uploadsDir(),
  expirationPeriodInMilliseconds: CHUNK_LIFETIME_MS,
});

const tus = new Server({
  // Chỉ dùng để dựng URL; định tuyến do Fastify lo, xem cuối tệp.
  path: "/api/projects/:id/uploads",
  datastore: store,
  /**
   * Khoá trong BỘ NHỚ — đủ, vì Tedit chạy đúng một tiến trình Node.
   *
   * Cùng điều kiện mà `job-queue.ts` đã dựa vào (`deploy/docker-compose.yml`:
   * một service, không replica). Chạy nhiều bản thì hai tiến trình cùng ghi một
   * mảnh mà không ai biết — lúc đó phải đổi sang khoá dùng chung, đọc lại chỗ
   * này trước khi làm điều đó.
   */
  locker: new MemoryLocker(),
  /**
   * Trần cho MỘT lượt tải, không phải cho một mảnh.
   *
   * Trùng với `MAX_FILE_SIZE` phía màn nạp tệp. Hai chỗ vì hai việc khác nhau:
   * bên kia để nói sớm cho người dùng, bên này để một client tự viết cũng không
   * lách qua được.
   */
  maxSize: 2 * 1024 * 1024 * 1024,
  /**
   * Đường tải lên nằm DƯỚI `/api/projects/<mã>/` để luật phân quyền theo đường
   * dẫn tự phủ lên nó.
   *
   * Mặc định của tus là `/api/uploads/<mã mảnh>` — một đường không khớp mẫu nào
   * trong `URL_OWNER_RULES`, nên nó chỉ còn được kiểm "đã đăng nhập chưa" và ai
   * trong danh sách cho phép cũng ghi đè được lượt tải của người khác. Giữ mã dự
   * án trên đường dẫn thì cổng chung kiểm hộ, không phải viết thêm phép kiểm nào
   * ở đây — và route thêm về sau vẫn mặc định bị khoá.
   *
   * Trả đường TƯƠNG ĐỐI: sau Caddy rồi Cloudflare thì máy chủ không tự đoán được
   * gốc công khai, mà đoán sai một lần là client đi hỏi nhầm máy.
   */
  relativeLocation: true,
  generateUrl: (req, { id }) => `${uploadPrefix(req.url)}/${id}`,
  getFileIdFromRequest: (_req, lastPath) =>
    lastPath === "uploads" ? undefined : lastPath,
  namingFunction: () => newId("u"),

  /**
   * Chối SỚM, trước khi nhận byte nào.
   *
   * Tên tệp và dự án đều biết được ngay từ lượt tạo, nên một tệp `.txt` hay một
   * mã dự án đã bị xoá không có lý do gì phải tải xong vài trăm MB rồi mới nghe
   * "không nhận định dạng này".
   */
  onUploadCreate: async (req, upload) => {
    const projectId = projectFromUrl(req.url);
    if (!projectId) throw { status_code: 404, body: "Không có dự án này" };
    if (!db.prepare("SELECT 1 FROM projects WHERE id=?").get(projectId)) {
      throw { status_code: 404, body: "Không có dự án này" };
    }
    const name = upload.metadata?.filename ?? "";
    if (!isAcceptedMedia(name)) {
      throw { status_code: 415, body: "Không nhận định dạng này" };
    }
    // Ghim dự án vào chính lượt tải: tệp phải rơi đúng chỗ nó được tạo ra, chứ
    // không phải chỗ mà request CUỐI CÙNG tình cờ trỏ tới.
    return { metadata: { ...upload.metadata, projectId } };
  },

  /**
   * Mảnh cuối đã tới: ghép xong rồi thì nhận tệp vào dự án như mọi đường khác.
   *
   * Trả về đúng hình dạng `{ saved, rejected }` mà màn nạp tệp vẫn đọc từ đường
   * multipart. Nhờ vậy đổi cách VẬN CHUYỂN không kéo theo đổi cách đọc kết quả —
   * `use-upload.ts` không phải biết là bên dưới đã đổi giao thức.
   *
   * Chuẩn tus chỉ cho trả 204 không thân; hầu hết client đều nhận thân, và
   * `tus-js-client` đọc được qua `onSuccess`. Đánh đổi có ý thức: một lượt gọi
   * thêm chỉ để hỏi "tệp vừa rồi đo ra sao" là một nhịp chờ nữa trước khi ô video
   * hiện xong.
   */
  onUploadFinish: async (req, upload: Upload) => {
    const projectId =
      (upload.metadata?.projectId as string | undefined) ??
      projectFromUrl(req.url);
    const name = upload.metadata?.filename ?? "khong-ten";
    const staged = upload.storage?.path;

    if (!projectId || !staged) {
      return {
        status_code: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saved: [],
          rejected: [{ name, reason: "Lượt tải mất dấu, thử lại giúp mình" }],
        }),
      };
    }

    const rawOrder = Number(upload.metadata?.order);
    const order = Number.isFinite(rawOrder)
      ? Math.max(0, Math.trunc(rawOrder))
      : null;

    // Vai người dùng định cho tệp ("insert" từ bàn dựng). Chỉ nhận hai giá trị
    // hợp lệ; thứ khác coi như không nói gì, để máy tự đoán.
    const rawRole = upload.metadata?.role;
    const intendedRole =
      rawRole === "main" || rawRole === "insert" ? rawRole : null;

    const result = await intakeMediaFile({
      projectId,
      stagedPath: staged,
      originalName: name,
      order,
      intendedRole,
      bytes: upload.size ?? upload.offset,
    });

    /*
     * Dọn dấu vết của lượt tải trong kho tus.
     *
     * `intakeMediaFile` đã DỜI tệp đi (hoặc xoá nó khi chối), nên `store.remove`
     * ném `ENOENT` ngay ở bước xoá tệp dữ liệu và KHÔNG chạy tới bước xoá tệp mô
     * tả `.json`. Bắt lỗi rồi bỏ qua là để lại một mẩu rác cho mỗi lượt tải —
     * nhỏ, nhưng nhỏ và vĩnh viễn thì vẫn đầy dần. `check:upload` canh đúng chỗ
     * này.
     *
     * Nên gọi cả hai: `remove` lo trường hợp tệp dữ liệu vì lý do nào đó còn
     * sống, `configstore.delete` lo tệp mô tả mà `remove` không với tới.
     */
    await store.remove(upload.id).catch(() => {});
    await store.configstore.delete(upload.id).catch(() => {});

    return {
      status_code: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        result.ok
          ? {
              saved: [{ ...result.row, warnings: result.warnings }],
              rejected: [],
            }
          : { saved: [], rejected: [{ name, reason: result.reason }] },
      ),
    };
  },
});

export default async function uploadRoutes(app: FastifyInstance) {
  mkdirSync(uploadsDir(), { recursive: true });

  /**
   * Fastify KHÔNG được đụng vào thân của mảnh.
   *
   * Không khai kiểu này thì Fastify trả 415 trước khi tus nhìn thấy request —
   * nó không biết `application/offset+octet-stream` là gì. Trả luồng thô để tus
   * tự đọc; đệm vào bộ nhớ ở đây là dựng lại đúng cái vấn đề vừa đi sửa.
   */
  app.addContentTypeParser(
    "application/offset+octet-stream",
    (_request, _payload, done) => done(null),
  );

  /**
   * Giao thẳng cho tus, không qua đường trả lời của Fastify.
   *
   * `hijack()` TRƯỚC khi gọi: sau lời gọi này Fastify thôi tự gửi gì lên socket,
   * còn `tus.handle` thì ghi thẳng vào `reply.raw`. Thiếu nó là hai bên cùng ghi
   * một socket và client nhận về một câu trả lời cụt.
   *
   * `authGuard` vẫn chạy trước: nó gắn ở `onRequest`, tức trước cả bước đọc thân
   * request — nên người chưa đăng nhập, hay người đăng nhập rồi mà trỏ vào dự án
   * của người khác, đều bị chối ở đây mà không tốn một byte nào.
   */
  const handOff = async (request: FastifyRequest, reply: FastifyReply) => {
    reply.hijack();
    await tus.handle(request.raw, reply.raw);
  };

  app.route({
    method: ["POST", "OPTIONS"],
    url: "/api/projects/:projectId/uploads",
    handler: handOff,
  });
  app.route({
    method: ["HEAD", "PATCH", "DELETE", "GET"],
    url: "/api/projects/:projectId/uploads/:uploadId",
    handler: handOff,
  });

  /**
   * Dọn mảnh của những lượt tải bị bỏ ngang.
   *
   * `unref()` để nhịp này không giữ tiến trình sống: máy chủ đang tắt mà còn một
   * hẹn giờ chưa tới là Docker phải chờ hết thời gian ân hạn rồi giết cứng, và
   * lượt dựng nào đang chạy sẽ chết giữa chừng thay vì được đóng lại tử tế.
   */
  const sweep = setInterval(() => {
    store
      .deleteExpired()
      .then((count) => {
        if (count > 0) app.log.info({ count }, "Đã dọn mảnh tải lên quá hạn");
      })
      .catch((error) => app.log.warn({ error }, "Dọn mảnh tải lên hỏng"));
  }, SWEEP_EVERY_MS);
  sweep.unref();
}
