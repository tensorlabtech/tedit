/**
 * Tải lên cắt mảnh có thật sự chạy không — chạy đường tus qua HTTP thật.
 *
 * Ba điều được khẳng định, và cả ba đều là thứ `tsc` không nói hộ được:
 *
 * 1. Một tệp chia làm nhiều mảnh thì ghép lại ra ĐÚNG tệp ban đầu, và hàng trong
 *    `media_files` mang đúng thời lượng, khung hình, cỡ tệp.
 * 2. ĐỨT GIỮA CHỪNG rồi hỏi lại thì máy chủ nói đúng mốc đã nhận, và gửi tiếp từ
 *    đó là xong — không phải làm lại từ đầu. Đây là cả lý do tồn tại của cú đổi
 *    giao thức này, nên nó phải có phép kiểm riêng.
 * 3. Tệp không nhận được thì bị chối NGAY LÚC TẠO, trước khi tốn một byte nào.
 *
 * KHÔNG gắn `authGuard` trong này: phép kiểm quyền đã có `check:ownership` lo, và
 * luật ở đó phủ `/api/projects/<mã>/...` theo tiền tố nên đường tải lên nằm sẵn
 * trong vùng nó canh. Ở đây chỉ hỏi đúng một câu: giao thức có chạy không.
 */

import Fastify from "fastify";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// PHẢI đặt trước khi nạp bất cứ thứ gì chạm CSDL: `paths.ts` đọc biến này lúc
// nạp module, nên đặt sau là đã trỏ vào thư mục dữ liệu thật.
const DATA_ROOT = mkdtempSync(join(tmpdir(), "tedit-upload-"));
process.env.TEDDIT_DATA_ROOT = DATA_ROOT;

const { db } = await import("../../server/db");
const { default: uploadRoutes } = await import(
  "../../server/routes/upload-routes"
);
const { default: filesRoutes } = await import(
  "../../server/routes/files-routes"
);
const { default: multipart } = await import("@fastify/multipart");

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`  đạt   ${label}`);
  } else {
    failed += 1;
    console.log(`  TRƯỢT ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** `Upload-Metadata` là các cặp `khoá <giá trị base64>` ngăn bằng dấu phẩy. */
const encodeMetadata = (pairs: Record<string, string>) =>
  Object.entries(pairs)
    .map(([key, value]) => `${key} ${Buffer.from(value).toString("base64")}`)
    .join(",");

const app = Fastify({ logger: false });
await app.register(multipart, {
  limits: { fileSize: 4 * 1024 * 1024 * 1024, files: 20 },
});
await app.register(uploadRoutes);
await app.register(filesRoutes);
await app.listen({ port: 0, host: "127.0.0.1" });
const base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;

const PROJECT = "prj_thu_tai_len";
db.prepare(
  "INSERT INTO projects (id, title, created_at) VALUES (?,?,?)",
).run(PROJECT, "Thử tải lên", Date.now());

// Video thật, đủ để ffprobe đọc ra thời lượng và khung hình — tệp giả bằng byte
// ngẫu nhiên sẽ bị `intakeMediaFile` chối đúng như thiết kế, nên không thử được
// đường thành công bằng nó.
const sample = join(DATA_ROOT, "mau.mp4");
await run("ffmpeg", [
  "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15:duration=3",
  "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
  "-y", sample,
]);
const bytes = readFileSync(sample);
const total = bytes.length;

const createUpload = async (filename: string, size: number, order?: string) =>
  fetch(`${base}/api/projects/${PROJECT}/uploads`, {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(size),
      "Upload-Metadata": encodeMetadata({
        filename,
        ...(order === undefined ? {} : { order }),
      }),
    },
  });

const sendChunk = (url: string, offset: number, body: Buffer) =>
  fetch(`${base}${url}`, {
    method: "PATCH",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Offset": String(offset),
      "Content-Type": "application/offset+octet-stream",
    },
    body: new Uint8Array(body),
  });

console.log("\nGhép mảnh");

{
  const created = await createUpload("canh-mot.mp4", total, "3");
  const location = created.headers.get("location") ?? "";
  check("lượt tạo trả 201 kèm đường tải lên", created.status === 201 && !!location,
    `status=${created.status} location=${location}`);

  // Ba mảnh: đầu, giữa, cuối. Cắt lẻ để bắt được lỗi tính mốc, thứ mà chia chẵn
  // sẽ giấu đi.
  const cuts = [0, Math.floor(total / 3), Math.floor((total * 2) / 3), total];
  let last: Response | undefined;
  for (let i = 0; i < cuts.length - 1; i += 1) {
    last = await sendChunk(location, cuts[i], bytes.subarray(cuts[i], cuts[i + 1]));
  }

  check("mảnh cuối trả 200 kèm thân JSON", last?.status === 200, `status=${last?.status}`);
  const body = JSON.parse((await last!.text()) || "{}") as {
    saved?: Array<Record<string, unknown>>;
    rejected?: Array<{ reason: string }>;
  };
  const row = body.saved?.[0];
  check("máy chủ báo đã nhận một tệp", !!row, JSON.stringify(body).slice(0, 160));
  check("tên tệp giữ nguyên", row?.name === "canh-mot.mp4", String(row?.name));
  check("cỡ tệp khớp bản gốc", row?.size === total, `${row?.size} ≠ ${total}`);
  check("đo được thời lượng", Number(row?.duration) > 2.5, String(row?.duration));
  check("đo được khung hình", row?.width === 320 && row?.height === 240,
    `${row?.width}×${row?.height}`);
  check("nghe ra tiếng", row?.has_audio === 1, String(row?.has_audio));
  check("giữ đúng thứ tự cảnh người dùng xếp", row?.position === 3, String(row?.position));

  // Byte trên đĩa phải khớp bản gốc, không chỉ khớp con số trong CSDL: ghép sai
  // mốc vẫn ra đúng TỔNG SỐ byte mà nội dung thì hỏng.
  const stored = String(row?.stored_path ?? "");
  check("tệp ghép ra trùng khít bản gốc",
    !!stored && Buffer.compare(readFileSync(stored), bytes) === 0);
  check("có dựng ảnh thu nhỏ", !!row?.thumb_path && statSync(String(row.thumb_path)).size > 0);

  // Nhận xong thì kho mảnh phải SẠCH. Tệp đã được dời đi, nhưng tệp mô tả `.json`
  // của tus thì không tự biến mất — không dọn là mỗi lượt tải để lại một mẩu rác
  // vĩnh viễn, nhỏ nhưng cộng dồn mãi.
  check(
    "dọn sạch mảnh sau khi nhận",
    readdirSync(join(DATA_ROOT, "uploads")).length === 0,
    readdirSync(join(DATA_ROOT, "uploads")).join(", "),
  );
}

console.log("\nĐứt giữa chừng rồi tải tiếp");

{
  const created = await createUpload("canh-hai.mp4", total);
  const location = created.headers.get("location") ?? "";

  // Gửi được một phần rồi thôi — đúng cảnh rớt mạng.
  const half = Math.floor(total / 2);
  await sendChunk(location, 0, bytes.subarray(0, half));

  const head = await fetch(`${base}${location}`, {
    method: "HEAD",
    headers: { "Tus-Resumable": "1.0.0" },
  });
  const offset = Number(head.headers.get("upload-offset"));
  check("hỏi lại thì máy chủ nói đúng mốc đã nhận", offset === half,
    `${offset} ≠ ${half}`);

  // Gửi NỐT phần thiếu, không gửi lại từ đầu.
  const rest = await sendChunk(location, offset, bytes.subarray(offset));
  const body = JSON.parse((await rest.text()) || "{}") as {
    saved?: Array<Record<string, unknown>>;
  };
  const row = body.saved?.[0];
  check("tải tiếp từ mốc là xong tệp", !!row, `status=${rest.status}`);
  check("tệp nối tiếp cũng trùng khít bản gốc",
    !!row?.stored_path &&
      Buffer.compare(readFileSync(String(row.stored_path)), bytes) === 0);
}

console.log("\nĐường multipart cũ vẫn nguyên");

{
  /*
   * `POST /api/projects/:id/files` không bị bỏ — công cụ ngoài và kịch bản thử
   * vẫn gọi nó. Nó vừa bị thay ruột để đi chung `intakeMediaFile`, mà một cú
   * refactor "không đổi hành vi" thì chỉ là lời hứa cho tới khi có ai đo lại.
   */
  const form = new FormData();
  form.append("order", "7");
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: "video/mp4" }),
    "canh-cu.mp4",
  );
  const sent = await fetch(`${base}/api/projects/${PROJECT}/files`, {
    method: "POST",
    body: form,
  });
  const body = (await sent.json()) as {
    saved?: Array<Record<string, unknown>>;
    rejected?: Array<{ reason: string }>;
  };
  const row = body.saved?.[0];
  check("multipart vẫn nhận được tệp", !!row, JSON.stringify(body).slice(0, 160));
  check("multipart đo đúng khung hình", row?.width === 320 && row?.height === 240,
    `${row?.width}×${row?.height}`);
  check("multipart giữ đúng thứ tự", row?.position === 7, String(row?.position));
  check("multipart ghép ra tệp trùng khít",
    !!row?.stored_path &&
      Buffer.compare(readFileSync(String(row.stored_path)), bytes) === 0);

  const bad = new FormData();
  bad.append("file", new Blob([new Uint8Array([1, 2, 3])]), "ghi-chu.txt");
  const refused = await fetch(`${base}/api/projects/${PROJECT}/files`, {
    method: "POST",
    body: bad,
  });
  const refusedBody = (await refused.json()) as {
    saved?: unknown[];
    rejected?: Array<{ reason: string }>;
  };
  check("multipart chối tệp sai định dạng",
    refusedBody.saved?.length === 0 && refusedBody.rejected?.length === 1,
    JSON.stringify(refusedBody).slice(0, 120));

  // Chỗ tạm phải sạch: đường này hứng byte xuống `work/` trước khi giao cho
  // `intakeMediaFile`, nên nó cũng có đường để lại rác.
  check("multipart không để lại tệp tạm",
    readdirSync(join(DATA_ROOT, "projects", PROJECT, "work")).length === 0,
    readdirSync(join(DATA_ROOT, "projects", PROJECT, "work")).join(", "));
}

console.log("\nChối sớm");

{
  const created = await createUpload("ghi-chu.txt", 12);
  check("tệp sai định dạng bị chối ngay lúc tạo", created.status === 415,
    `status=${created.status}`);

  const orphan = await createUpload("canh-ba.mp4", total);
  check("dự án có thật thì vẫn tạo được", orphan.status === 201, `status=${orphan.status}`);

  const gone = await fetch(`${base}/api/projects/prj_khong_co/uploads`, {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(total),
      "Upload-Metadata": encodeMetadata({ filename: "canh-bon.mp4" }),
    },
  });
  check("dự án không tồn tại thì chối", gone.status === 404, `status=${gone.status}`);
}

await app.close();
console.log(`\n${passed} đạt, ${failed} trượt\n`);
process.exit(failed > 0 ? 1 : 0);
