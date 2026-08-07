import { createReadStream, existsSync } from "node:fs";
import { join } from "node:path";

import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { fromNodeHeaders } from "better-auth/node";
import Fastify from "fastify";

import { auth } from "./auth";
import { authGuard } from "./auth-guard";
import { PROJECT_ROOT, PUBLIC_URL } from "./env";

import { db } from "./db";
import { collectHealth } from "./health";
import projectsRoutes from "./routes/projects-routes";
import settingsRoutes from "./routes/settings-routes";
import filesRoutes from "./routes/files-routes";
import uploadRoutes from "./routes/upload-routes";
import elementsRoutes from "./routes/elements-routes";
import musicRoutes from "./routes/music-routes";
import libraryRoutes from "./routes/library-routes";
import transcriptRoutes from "./routes/transcript-routes";
import segmentsRoutes from "./routes/segments-routes";
import jobsRoutes from "./routes/jobs-routes";
import mediaRoutes from "./routes/media-routes";
import sceneScheduleRoutes from "./routes/scene-schedule-routes";
import adminRoutes from "./routes/admin-routes";
import {
  queueStats,
  reapOrphans,
} from "./job-queue";
import {
  DATA_ROOT,
} from "./paths";

/**
 * `bodyLimit` là hạn mức cho THÂN REQUEST THƯỜNG, không phải cho tệp tải lên.
 *
 * Tệp đi đường `@fastify/multipart` với hạn mức riêng khai ngay dưới đây, nên con
 * số này chỉ còn áp cho các route nhận JSON. Trước đây nó là 4 GB — tức là cho
 * phép đệm 4 GB vào bộ nhớ cho một lời gọi `/api/layout`, và máy chủ chết vì hết
 * bộ nhớ chứ không vì ai tấn công.
 *
 * 8 MB đủ rộng cho thân JSON lớn nhất mà bàn dựng sinh ra (danh sách phần tử của
 * một dự án dài), và cách xa mức đủ để giết tiến trình.
 */
const JSON_BODY_LIMIT = 8 * 1024 * 1024;

const app = Fastify({
  bodyLimit: JSON_BODY_LIMIT,
  /**
   * Không có nhật ký thì `docker logs` rỗng và một lỗi 500 lúc chạy thật không
   * để lại dấu vết nào — đang phục vụ nhiều người thì đó là bay không đèn.
   *
   * `redact` che hai tiêu đề mang phiên đăng nhập: nhật ký là thứ được chép đi
   * chép lại và dán vào chỗ khác lúc nhờ người xem giúp, mà một cookie phiên lọt
   * ra ngoài thì tương đương mất mật khẩu.
   */
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    redact: ["req.headers.authorization", "req.headers.cookie"],
  },
});

/**
 * Rejection lọt thì GHI LẠI rồi sống tiếp, không để Node giết tiến trình.
 *
 * Node 22 mặc định thoát khi có promise bị từ chối mà không ai bắt. Đường chính
 * đã an toàn — `startJob` có `.catch` — nhưng một chỗ nào đó sót thì cả máy chủ
 * chết giữa lúc người khác đang dựng video, để đổi lấy đúng một request hỏng.
 * Đánh đổi đó không đáng, và giờ đã có nhật ký để biết mà đi sửa gốc.
 */
process.on("unhandledRejection", (reason) => {
  app.log.error({ reason }, "Có promise bị từ chối mà không ai bắt");
});

await app.register(multipart, {
  limits: { fileSize: 4 * 1024 * 1024 * 1024, files: 20 },
});
/**
 * Cửa đăng nhập. Better Auth tự lo mọi đường dưới `/api/auth/`.
 *
 * Dựng một `Request` chuẩn web từ request của Fastify vì Better Auth nhận đúng
 * kiểu đó. Gốc lấy từ `PUBLIC_URL` chứ KHÔNG từ tiêu đề `Host`: sau lớp chuyển
 * tiếp (Vite lúc phát triển, Caddy lúc chạy thật) thì `Host` là thứ khách gửi
 * lên và sửa được, mà gốc này quyết định đường Google trả người dùng về — để nó
 * cho khách đặt là mở đường chuyển hướng người dùng sang chỗ khác.
 */
app.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  async handler(request, reply) {
    const url = new URL(request.url, PUBLIC_URL);
    const response = await auth.handler(
      new Request(url, {
        method: request.method,
        headers: fromNodeHeaders(request.raw.headers),
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      }),
    );
    reply.status(response.status);
    // `headers.forEach` chứ không `Object.fromEntries`: một lượt đăng nhập đặt
    // NHIỀU `set-cookie`, mà gộp vào object thì chỉ còn cái cuối.
    response.headers.forEach((value, key) => reply.header(key, value));
    return reply.send(response.body ? await response.text() : null);
  },
});

/**
 * Khoá toàn bộ `/api/` và `/files/`.
 *
 * Gắn TRƯỚC `fastifyStatic`: móc thêm vào sau chỉ áp cho route của chính thực thể
 * này, không lan sang plugin đã đăng ký xong — mà `/files/` chính là chỗ hở to
 * nhất, nên gắn sai thứ tự là khoá tất cả trừ đúng cái cần khoá.
 *
 * Dùng `onRequest` chứ không `preHandler` để chặn TRƯỚC lúc đọc thân request:
 * người chưa đăng nhập gửi tệp 4GB thì bị chối ngay ở tiêu đề, không phải chờ
 * nhận hết tệp rồi mới nói không.
 */
app.addHook("onRequest", authGuard);

await app.register(fastifyStatic, { root: DATA_ROOT, prefix: "/files/" });

/**
 * Máy chủ còn LÀM VIỆC ĐƯỢC không — dành cho healthcheck của Docker.
 *
 * Không đòi đăng nhập, vì thứ đi hỏi là Docker chứ không phải người dùng; đường
 * này được `auth-guard.ts` cho qua bằng phép so BẰNG, không phải tiền tố.
 *
 * Thân trả về chỉ có `true/false` theo từng phép kiểm và một con số phần trăm.
 * Không phiên bản, không đường dẫn, không thông báo lỗi thô: đây là đường duy
 * nhất ngoài cổng đăng nhập, nên nó không được kể gì về bên trong.
 */
app.get("/api/health", async (request, reply) => {
  const report = await collectHealth();
  // Đĩa sắp đầy KHÔNG làm healthcheck đỏ — nó chỉ là lời nhắc đi dọn. Nói ra qua
  // nhật ký để còn kịp thấy, vì `teddit.db` nằm cùng ổ với video và lúc SQLite
  // hết chỗ ghi thì lỗi hiện ra ở một chỗ chẳng liên quan gì tới nguyên nhân.
  if (report.diskLow) {
    request.log.warn(
      { diskUsedPercent: report.diskUsedPercent },
      "Đĩa sắp đầy — nên dọn",
    );
  }
  return reply.code(report.ok ? 200 : 503).send(report);
});

await app.register(projectsRoutes);
await app.register(settingsRoutes);
await app.register(filesRoutes);
await app.register(uploadRoutes);
await app.register(elementsRoutes);
await app.register(musicRoutes);
await app.register(libraryRoutes);
await app.register(transcriptRoutes);
await app.register(segmentsRoutes);
await app.register(jobsRoutes);
await app.register(mediaRoutes);
await app.register(sceneScheduleRoutes);
await app.register(adminRoutes);








// Máy chủ vừa khởi động thì KHÔNG có việc nào đang chạy — việc sống trong tiến
// trình này, tiến trình chết là việc chết. Hàng còn ghi `running` là xác, dọn
// ngay để lần bấm sau không bị chốt chặn lại.
{
  const cleaned = db
    .prepare("UPDATE jobs SET status='error', message=? WHERE status='running'")
    .run("Bị ngắt giữa chừng — bấm lại giúp mình");
  // Chặng cũng phải dọn theo, không thì màn chờ mở ra thấy một con quay của
  // việc đã chết cùng tiến trình trước và quay mãi mãi.
  //
  // Dọn cả chặng CÒN CHỜ, không chỉ chặng ĐANG CHẠY. Chặng chờ mới là chỗ chết
  // người: nó không có con quay lẫn nút Thử lại nên trông y hệt một chặng sắp tới,
  // trong khi không còn lượt nào đánh thức nó nữa — `settled` mãi không đạt và cổng
  // vào bàn dựng khoá vĩnh viễn, không một đường nào mở ra. Đo thật: một dự án treo
  // ở 10/11 với `music` nằm chờ. Và vì `tsx watch` dựng lại máy chủ mỗi lần lưu tệp,
  // lúc phát triển thì đây là chuyện thường xuyên chứ không phải hiếm.
  //
  // Quét cả bảng là đúng: vừa vào tiến trình mới thì không việc nào còn sống, nên
  // mọi hàng `waiting` đều là xác của lượt trước.
  /*
   * CHỪA những dự án đang đứng ở CỔNG CHỜ NGƯỜI.
   *
   * Quét này đúng với chặng máy: tiến trình mới lên thì không việc nào còn
   * sống. Nhưng cổng `awaiting-user` không chờ máy — nó chờ NGƯỜI DÙNG, và
   * người dùng vẫn còn đó sau khi máy chủ khởi động lại.
   *
   * Không chừa thì mọi chặng SAU cổng (đang `waiting`) bị đánh hỏng, `blocked`
   * bật lên, và bàn dựng khoá vĩnh viễn. Đo thật trên một dự án đang chạy: qua
   * cổng `review-cut` xong thì `commit-cut` trở đi hỏng sạch.
   *
   * Mà `tsx watch` dựng lại máy chủ mỗi lần lưu một tệp, nên lúc phát triển
   * chuyện này xảy ra vài chục lần một buổi.
   */
  const atGate = db
    .prepare(
      "SELECT DISTINCT project_id FROM steps WHERE status='awaiting-user'",
    )
    .all() as Array<{ project_id: string }>;
  const spare = atGate.map((row) => row.project_id);
  db.prepare(
    `UPDATE steps SET status='failed', error=?, updated_at=?
     WHERE status IN ('running','waiting')
       AND project_id NOT IN (${spare.map(() => "?").join(",") || "''"})`,
  ).run("Bị ngắt giữa chừng", Date.now(), ...spare);
  if (cleaned.changes > 0) {
    app.log.info(`dọn ${cleaned.changes} việc dở dang từ lần chạy trước`);
  }
}


// Bỏ qua / lấy lại một lời nhắc ở hàng soát.
//
// Ghi xuống máy chủ chứ không giữ trong bộ nhớ màn hình: hàng soát dựng lại từ
// dữ liệu mỗi lần mở dự án, nên nhớ trong bộ nhớ thì tải lại là hỏi lại.







/** Trả tệp gốc để khung xem trước dùng — không lộ đường dẫn đĩa ra ngoài. */



/** Thêm một bài nhạc nền. Nhiều bài cùng lúc được — mỗi bài một khối trên dải. */

/**
 * KHO TƯ LIỆU DÙNG CHUNG — ảnh và video chèn cho mọi dự án.
 *
 * Khác tư liệu của MỘT dự án (`media_files` với role='insert'): thứ ở đây chưa
 * thuộc dự án nào, và đặt vào dự án là CHÉP một bản sang thư mục của dự án đó.
 * Chép chứ không trỏ chung: xoá dự án là xoá cả thư mục của nó, mà trỏ chung thì
 * cú xoá ấy rút mất tệp khỏi kho và mọi dự án khác dùng nó cùng gãy.
 */























/** Bỏ một quãng theo giây — vẫn là ĐOẠN, chỉ là tách sẵn hai đầu. */

/** Những quãng sẽ KHÔNG vào video: đoạn đã bỏ, và hở do gọt mép đoạn. */

/** Bật/tắt nhấn zoom ở các chỗ nối đoạn. */






/**
 * Dựng lại dải ảnh cho dự án đã có.
 *
 * Cần vì dải ảnh chỉ dựng một lần ở bước chép lời: dự án tạo trước khi dải ảnh
 * biết cách dựng bản 2× thì mãi mãi giữ bản mờ, mà bắt người dùng chép lời lại
 * (mất vài phút và mất luôn lời đã sửa tay) chỉ để có ảnh nét là quá đắt.
 */







/**
 * Trả bản build của trang — CHỈ khi `dist/` có thật.
 *
 * Lúc chạy thật đây là cách duy nhất trang tới được người dùng: không có Vite
 * nào trên máy chủ, nên thiếu khối này thì tên miền trả về rỗng. Và vì trang và
 * API cùng một gốc, cookie phiên đi kèm mọi request mà không cần CORS.
 *
 * Lúc phát triển thì `dist/` thường là bản cũ. Không sao: trình duyệt đứng ở
 * Vite (5173), còn Fastify (5190) chỉ nhận request đã qua chuyển tiếp — nên bản
 * cũ ở đây không ai nhìn thấy. Vẫn kiểm `existsSync` để máy chưa build lần nào
 * cũng khởi động được.
 *
 * `decorateReply: false`: `@fastify/static` chỉ được gắn `reply.sendFile` MỘT
 * lần cho cả thực thể, mà lần gắn ở `/files/` phía trên đã dùng chỗ đó.
 */
const WEB_ROOT = join(PROJECT_ROOT, "dist");
const hasWebBuild = existsSync(join(WEB_ROOT, "index.html"));

if (hasWebBuild) {
  await app.register(fastifyStatic, {
    root: WEB_ROOT,
    prefix: "/",
    decorateReply: false,
    // Tắt wildcard để đường dẫn không khớp tệp nào rơi xuống `setNotFoundHandler`
    // bên dưới, thay vì `@fastify/static` tự trả 404 và chặn mất bước đó.
    wildcard: false,
  });

  /**
   * Mọi đường dẫn lạ đều trả `index.html` để React Router tự xử.
   *
   * Cần vì đường dẫn nằm bên trong trang: mở thẳng `/editor/prj_abc` hay bấm tải
   * lại ở đó thì máy chủ được hỏi trước React, mà máy chủ không có tệp nào tên
   * vậy — không có nhánh này thì tải lại trang giữa lúc đang dựng là ra 404.
   *
   * `/api/` và `/files/` KHÔNG rơi vào đây: chúng phải trả 404 thật. Trả HTML cho
   * một lời gọi API là biến "không có dữ liệu này" thành một lỗi phân tích JSON ở
   * phía trình duyệt, và chỗ báo lỗi khi đó chỉ vào đúng dòng vô can.
   */
  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split("?")[0];
    if (path.startsWith("/api/") || path.startsWith("/files/")) {
      return reply.code(404).send({ error: "Không tìm thấy" });
    }
    return reply
      .type("text/html")
      .send(createReadStream(join(WEB_ROOT, "index.html")));
  });
}

const port = Number(process.env.PORT ?? 5190);
/**
 * Mặc định chỉ nghe trên máy nội bộ.
 *
 * Trên máy phát triển và trên máy chủ chạy thẳng, Caddy đứng trước và nói chuyện
 * với cổng này; mở ra `0.0.0.0` là phơi thẳng cổng chưa có HTTPS ra internet, mà
 * cookie phiên đi qua đường không mã hoá thì ai chặn được đường truyền cũng đọc
 * được nó.
 *
 * Trong container thì ngược lại: Caddy nằm ở container KHÁC, nên nghe
 * `127.0.0.1` là không ai với tới được — kể cả Caddy. Ở đó đặt `HOST=0.0.0.0`,
 * và cổng vẫn kín vì compose không publish nó ra host, chỉ mạng Docker nội bộ
 * thấy.
 */
/**
 * Dọn việc còn treo `running` từ lượt chạy TRƯỚC.
 *
 * Gọi ở đây, khi hàng đợi còn rỗng, nên mọi hàng `running` trong bảng chắc chắn
 * thuộc về một tiến trình đã chết. Không dọn thì người dùng mở bàn dựng ra và
 * ngồi nhìn con quay của một việc đã chết từ lúc container khởi động lại.
 */
const reaped = reapOrphans();
if (reaped > 0) {
  app.log.warn({ count: reaped }, "Dọn việc treo từ lượt chạy trước");
}

await app.listen({ port, host: process.env.HOST ?? "127.0.0.1" });
app.log.info(queueStats(), "Hàng đợi việc nặng");
app.log.info(
  `API chạy ở http://127.0.0.1:${port}` +
    (hasWebBuild ? " (kèm bản build của trang)" : " (chưa có dist/, chỉ API)"),
);
export { app };
