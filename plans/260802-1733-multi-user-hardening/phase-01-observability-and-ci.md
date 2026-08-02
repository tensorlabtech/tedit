# Chặng 01 — Quan sát được + CI + README

**Ưu tiên:** P0 · **Trạng thái:** ⬜ chưa làm · **Phụ thuộc:** không

Bật nhật ký, thêm health check thật, chặn `bodyLimit` 4 GB, dựng CI từ bốn lệnh
đã có sẵn, và viết lại phần deploy trong README cho khớp Docker.

Không đụng một dòng logic nghiệp vụ nào.

## Bối cảnh

- Báo cáo: [`plans/reports/260802-1725-project-improvement-review.md`](../reports/260802-1725-project-improvement-review.md) mục 2, 3, 9, 11, 12, 17

## Nhận định then chốt

**Máy chủ đang câm.** `server/main.ts:91` khởi tạo `Fastify({ bodyLimit })` không
có `logger`, nên Fastify dùng logger rỗng: `docker logs tedit_app` không có gì, và
`app.log.info` ở `main.ts:1859` cũng không in ra. Đang phục vụ nhiều người mà một
lỗi 500 không để lại dấu vết nào.

**`bodyLimit` 4 GB giờ chỉ còn hại.** Upload đã có hạn mức riêng của
`@fastify/multipart` (`main.ts:93-95`). Con số ở cấp app chỉ áp cho route JSON —
tức là cho phép đệm 4 GB vào RAM cho một `POST /api/layout`. `authGuard` gắn ở
`onRequest` (`main.ts:132`) nên phải có phiên hợp lệ, không phải lỗ ẩn danh; nhưng
một client lỗi cũng đủ giết container.

**Healthcheck hiện tại không phân biệt "sống" với "sống mà vô dụng".**
`deploy/docker-compose.yml` gọi `/` — đó là `index.html` tĩnh. SQLite không mở
được, hoặc `ffmpeg` biến khỏi PATH, thì container vẫn xanh.

**Bốn lệnh kiểm đã viết sẵn nhưng không ai chạy.** `typecheck`, `lint`,
`check:ownership`, `check:style-pack` đều có trong `package.json`. Hai lệnh sau
kiểm đúng thứ đáng kiểm (luật phân quyền, bất biến bộ dáng chữ). Thiếu duy nhất
một workflow.

## Yêu cầu

1. Nhật ký ra stdout, có che `authorization` và `cookie`.
2. `GET /api/health` không cần đăng nhập, kiểm được ba thứ: SQLite, ffmpeg/ffprobe/magick, thư mục dữ liệu ghi được.
3. `bodyLimit` cấp app về mức lành mạnh; upload vẫn nhận tệp lớn như cũ.
4. Rejection lọt không được giết tiến trình im lặng.
5. CI chạy bốn lệnh mỗi lần push và mỗi PR.
6. README phần deploy khớp với `deploy/` thật.

## Kiến trúc

`/api/health` phải đi qua `authGuard`. `server/auth-guard.ts:56` đang cho
`/api/auth/` qua bằng tiền tố; thêm health theo **đúng đường dẫn tuyệt đối**, không
theo tiền tố — tiền tố `/api/health` sẽ mở luôn `/api/health-secrets` nếu về sau có
ai đặt tên như vậy.

Health trả `200` khi mọi phép kiểm đạt, `503` khi có phép kiểm hỏng, kèm chi tiết
từng mục. Không lộ đường dẫn đĩa hay phiên bản trong thân trả về.

## Tệp liên quan

**Sửa**

- `server/main.ts` — khởi tạo Fastify (`:91`), thêm route health, thêm bẫy rejection
- `server/auth-guard.ts` — cho `/api/health` qua cổng (`:52-58`)
- `deploy/docker-compose.yml` — healthcheck trỏ `/api/health`
- `README.md:210-235` — viết lại phần "Đưa lên máy chủ"
- `package.json` — thêm script `check:all` gom bốn lệnh

**Tạo**

- `.github/workflows/ci.yml`
- `server/health.ts` — các phép kiểm, tách khỏi `main.ts` để không nới thêm cho tệp 1863 dòng

## Các bước

1. **Nhật ký.** `Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info", redact: ["req.headers.authorization", "req.headers.cookie"] }, bodyLimit: 1024 * 1024 })`. Giữ `bodyLimit` 1 MB.
2. **Kiểm lại upload.** Chạy thử tải một tệp > 1 MB. `@fastify/multipart` tự xử lý luồng nên không chịu `bodyLimit` cấp app — nhưng **phải đo thật**, không suy luận. Nếu vỡ thì khai `bodyLimit` riêng trên route `POST /api/projects/:id/files`.
3. **`server/health.ts`.** Ba phép kiểm:
   - `db.prepare("SELECT 1").get()`
   - `run("ffprobe", ["-version"])`, tương tự `ffmpeg`, `magick` — chạy song song, có timeout 3s
   - ghi rồi xoá một tệp rỗng dưới `DATA_ROOT`
4. **Route.** `app.get("/api/health", ...)` trả `{ ok, checks: { db, tools, disk } }`, mã 200/503.
5. **Cổng.** Trong `authGuard`, ngay sau nhánh `AUTH_PREFIX`: `if (path === "/api/health") return;` kèm chú thích vì sao là so bằng chứ không phải tiền tố.
6. **Bẫy rejection.** `process.on("unhandledRejection", (reason) => app.log.error({ reason }, "rejection lọt"))`. Ghi log rồi sống tiếp — Node 22 mặc định giết tiến trình, mà chết im lặng lúc đang có người dùng dựng video thì tệ hơn nhiều so với một request hỏng.
7. **`check:all`** trong `package.json`: `npm run typecheck && npm run lint && npm run check:ownership && npm run check:style-pack`.
8. **CI.** `.github/workflows/ci.yml` — `ubuntu-latest`, Node 22, `npm ci`, `npm run check:all`, `npm run build`. Không cần ffmpeg vì bốn lệnh kia không gọi tới.
9. **Healthcheck compose.** Đổi sang `/api/health`, giữ `start_period: 5m`.
10. **README.** Xoá `setup-ubuntu.sh` / `update.sh`; mô tả luồng thật: `deploy/deploy.sh`, `docker compose`, `rollback.sh`. Giữ nguyên ba việc phải làm tay (bản ghi A, `.env`, đường quay về Google) vì chúng vẫn đúng.

## Todo

- [x] Bật logger có redact, hạ `bodyLimit` về **8 MB**
- [x] Đo thật: multipart 20 MB qua (`200`, đủ 20.971.520 byte), JSON 20 MB bị chặn (`413`), JSON nhỏ qua
- [x] `server/health.ts` — ba phép kiểm
- [x] `GET /api/health` + mở cổng bằng so bằng đường dẫn
- [x] Bẫy `unhandledRejection` ghi log
- [x] `check:all` trong `package.json`
- [x] `.github/workflows/ci.yml`
- [x] Healthcheck compose **và** `deploy.sh` trỏ `/api/health`
- [x] Viết lại README phần deploy
- [x] ~~Nén `docs/example.webp`~~ — **bỏ**, xem ghi chú dưới

### Lệch so với plan ban đầu

1. **`bodyLimit` 8 MB chứ không 1 MB.** 1 MB rủi ro chặn nhầm thân JSON lớn của
   bàn dựng; 8 MB vẫn cách rất xa mức đủ giết tiến trình. Đo xong mới chốt.
2. **Đĩa sắp đầy KHÔNG kéo `ok` xuống.** Bản đầu cho ngưỡng 85% trả 503; đo thật
   thì nó trả 503 ngay trên máy dev (đĩa 93%) trong khi máy chủ hoàn toàn dùng
   được. Healthcheck trả lời "có nên gửi request vào đây không" — đĩa 86% thì câu
   trả lời vẫn là có. Nay `ok` = CSDL + công cụ + **ghi được**; còn
   `diskUsedPercent`/`diskLow` là số để nhìn, cảnh báo đi đường nhật ký.
3. **`docs/example.webp` giữ nguyên.** Không tệp mã hay tài liệu nào trỏ tới nó —
   đây là ảnh tham chiếu chủ dự án giữ lại. Nén xuống còn 99 KB được, nhưng đổi
   lại là mất chi tiết của một ảnh 3810×2858 mà tôi không biết dùng để làm gì, để
   lấy về 385 KB. Không đáng.

## Xong khi

- `docker logs tedit_app` có dòng cho mỗi request.
- `curl localhost:5190/api/health` trả 200 khi chưa đăng nhập; đổi tên `ffprobe`
  đi thì trả 503 kèm tên phép kiểm hỏng.
- Upload video 200 MB vẫn chạy sau khi hạ `bodyLimit`.
- CI xanh trên một PR thử.
- Làm theo README trên máy sạch thì deploy được, không gặp lệnh không tồn tại.

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| `bodyLimit` 1 MB chặn nhầm route JSON lớn thật (bố cục chữ dài, danh sách phần tử) | Đo trước: gửi thử payload lớn nhất mà bàn dựng sinh ra. Vỡ thì nâng lên 8 MB, vẫn cách 4 GB rất xa |
| Nhật ký ghi trúng dữ liệu riêng tư (tên tệp người dùng) | `redact` cookie và authorization; giữ `level: info`, không bật `body` |
| Health check gọi ba tiến trình ngoài mỗi 30s | Timeout 3s; nếu tốn thì đổi sang nhớ đệm kết quả tool 60s |

## An ninh

- `/api/health` là **đường duy nhất** thêm vào ngoài cổng đăng nhập kể từ khi dựng
  hệ này. Thân trả về chỉ được chứa `true/false` theo từng phép kiểm — không phiên
  bản, không đường dẫn, không thông báo lỗi thô.
- So bằng đường dẫn chứ không tiền tố, để không vô tình mở thêm gì.

## Tiếp theo

Chặng 02 — [Chịu tải nhiều người](phase-02-load-resilience.md). Cần nhật ký của
chặng này để thấy hàng đợi hoạt động đúng.
