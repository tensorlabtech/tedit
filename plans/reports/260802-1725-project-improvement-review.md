# Review dự án Tedit — những chỗ cải thiện được

Ngày: 2026-08-02. Phạm vi: toàn bộ codebase (server + src + deploy + docs).
Cách làm: đọc mã trực tiếp, mọi phát hiện đều có `file:line`.

## Kết luận ngắn

Chất lượng mã cao hơn mặt bằng rõ rệt: phân quyền gom về **một** cổng
(`auth-guard.ts` + `ownership.ts`), migration idempotent + có transaction, `foreign_keys=ON`,
WAL, ffmpeg gọi bằng `execFile` với mảng đối số (không có shell injection), comment giải
thích **lý do** chứ không mô tả lại mã. Hai script bất biến `check:ownership` /
`check:style-pack` là ý tưởng tốt.

Chỗ yếu **không nằm ở mã**, mà ở **vận hành**: không nhật ký, không CI, không hạn mức
tài nguyên, không chống chạy trùng job. Đó là nhóm đáng sửa trước.

---

## P0 — sửa trước

### 1. Job xuất video chạy trùng sau 3 phút

`server/main.ts:1712,1724` — `JOB_STALE_MS = 3 * 60_000`; job `running` mà `updated_at`
cũ hơn 3 phút thì lượt gọi sau **khởi động job thứ hai**.

`server/pipeline.ts:605` đặt tiến độ 60 → `server/pipeline.ts:749` đặt 85. Giữa hai mốc là
toàn bộ pass drawtext + chèn tư liệu, **không có lần `setJob` nào**. `server/render.ts`
không có callback tiến độ (grep `onProgress` → rỗng). Trên máy chủ chạy CPU (README tự
nhận là chậm hơn Mac đáng kể), pass này vượt 3 phút là bình thường.

Hậu quả: hai tiến trình ffmpeg cùng ghi `work/` và `out/` của một dự án → tệp hỏng, và
người dùng tải về bản dựng dở.

Sửa: nhịp tim — `setJob` mỗi 20–30s trong lúc ffmpeg chạy (parse `-progress pipe:1`), hoặc
khoá theo tiến trình (`Map<projectId, Promise>`) đứng trước phép kiểm staleness.

### 2. `bodyLimit` 4 GB áp cho mọi route

`server/main.ts:91` — `Fastify({ bodyLimit: 4 * 1024 * 1024 * 1024 })`. Upload đã có hạn
mức riêng ở `main.ts:93-95` (`@fastify/multipart`), nên con số 4 GB ở đây chỉ còn tác dụng
cho **route JSON**. Một `POST /api/layout` body 4 GB được Fastify đệm vào RAM → container
chết.

`authGuard` gắn ở `onRequest` (`main.ts:132`) nên phải có phiên hợp lệ mới gửi được — không
phải lỗ ẩn danh. Nhưng một tab client lỗi cũng đủ giết máy chủ.

Sửa: để `bodyLimit` mặc định (1 MB) ở cấp app; nếu route upload cần thì khai riêng trên
route đó.

### 3. Không có nhật ký

`server/main.ts:91` không bật `logger`. Chạy thật trong Docker → `docker logs tedit_app`
rỗng; `app.log.info` ở `main.ts:1859` im lặng vì logger là no-op. Có lỗi 500 ở production
thì không còn gì để đọc.

Sửa: `Fastify({ logger: { level: "info" } })`, thêm `redact` cho `authorization` và
`cookie`.

### 4. Không có giới hạn tài nguyên trên máy chủ **dùng chung**

`deploy/docker-compose.yml` — comment đầu tệp nói rõ edge Caddy (`vas-printing-edge-1`)
dùng chung host. Service `app` không có `deploy.resources.limits` / `mem_limit` / `cpus`.

faster-whisper trên CPU + ffmpeg xuất video sẽ ăn hết core và RAM. Stack kia trên cùng
host 502 mà không ai hiểu vì sao.

Sửa: `cpus: "2.0"`, `mem_limit: 4g` (hoặc mức phù hợp với VPS), và `nice`/`cpulimit` cho
tiến trình ffmpeg nếu cần nhường.

### 5. Không có hạn mức chi phí AI

Không có dependency rate-limit nào (`grep rate-limit package.json` → 0). Biện pháp duy
nhất là allowlist email trong `.env`. README tự nói "mỗi lượt dựng đều tiêu tiền thật".

`POST /api/projects/:id/transcribe` và `/steps/:key/retry` gọi thẳng OpenRouter
(`server/llm.ts:49`) không đếm gì. Một vòng retry ở client = hoá đơn.

Sửa: `@fastify/rate-limit` cho nhóm route tốn tiền + bảng đếm lượt/chi phí theo user theo
ngày, chặn khi vượt ngưỡng.

### 6. Không có hạn ngạch đĩa

`main.ts:93-95` cho 20 tệp × 4 GB mỗi request, không giới hạn tổng theo user hay theo máy.
`teddit.db` nằm cùng volume `tedit_data` với video (`docker-compose.yml`). Đĩa đầy = SQLite
không ghi được = hỏng ở chỗ chẳng liên quan.

Sửa: cộng dồn dung lượng theo `owner_id` trước khi nhận tệp; chối sớm kèm số liệu.

---

## P1 — đáng làm

### 7. Hai tệp khổng lồ

- `server/main.ts` 1863 dòng, ~55 route.
- `src/routes/editor/use-editor.ts` 3164 dòng.

Vi phạm chính quy tắc 200 dòng trong CLAUDE.md, và quan trọng hơn: đây là hai tệp khó sửa
an toàn nhất trong dự án.

Sửa: `main.ts` tách thành plugin Fastify theo miền (`routes/projects.ts`, `files.ts`,
`library.ts`, `music.ts`, `segments.ts`, `elements.ts`, `jobs.ts`) — `authGuard` vẫn ở
`main.ts` nên không đụng tới mô hình phân quyền. `use-editor.ts` tách theo trục
(transcript / timeline / inspector / jobs / music), mỗi trục một hook.

### 8. Bundle 1,74 MB một mảnh, không code-splitting

`dist/assets/index-*.js` = 1.743.750 byte; `grep -c "React.lazy\|lazy("` trong `src` → 0.

`src/main.tsx:8-11` import **tĩnh** `DesignSystemPage`, `SkinLabPage`, `StylePage` — trang
dev với 60 component shadcn đi kèm bản production tới người dùng thật.

Sửa: `React.lazy` cho `/_dev/*` (dễ nhất, chặn ngay phần lớn), rồi tới `EditorPage`. Hoặc
loại hẳn `/_dev` khỏi build production bằng cờ env.

### 9. Không có test tự động, không có CI

- `package.json` không có script `test`, không có vitest/playwright trong devDeps.
- `qa/` là ảnh chụp màn hình bằng tay.
- `scripts/` là script chạy tay.
- Không có `.github/`.

Đây là món **rẻ nhất** trong cả danh sách: một workflow chạy
`typecheck` + `lint` + `check:ownership` + `check:style-pack` mỗi lần push. Hai script sau
đã viết sẵn và kiểm đúng thứ đáng kiểm — chỉ thiếu người chạy chúng.

### 10. Tên định danh tiếng Việt rải rác

Vi phạm quy tắc "Dùng full Tiếng Anh" trong `CLAUDE.md` của dự án:

| Vị trí | Tên |
|---|---|
| `server/render.ts:307` | `dai` |
| `server/main.ts:890` | `trung` |
| `server/auto-audio.ts:69` | `tomTat`, `nhan` |
| `server/auto-grade.ts:124` | `dai` |
| `server/pipeline.ts:600,632,712` | `duLieuChuyenCanh`, `tongDaCat`, `cheoTai`, `canh`, `tuCan`, `canHinh`, `doHinh` |
| `server/asset-library.ts:204`, `server/music-library.ts:182` | `thu` |
| `server/style-pack-catalog.ts:114` | `GOC` |
| `src/components/media-picker-dialog.tsx:193` | `chinh` |
| `scripts/` | `kiem-chuyen-canh.ts`, `kiem-junction.ts`, `thu-boi-canh.ts`, `thu-can-hinh.ts`, `thu-can-tieng.ts`, `thu-cuoi-cung.ts` |

`GOC` đáng chú ý nhất — nó được export và dùng ở nhiều nơi.

### 11. README lệch thực tế ở phần deploy

`README.md:216-222` hướng dẫn `deploy/setup-ubuntu.sh` và `deploy/update.sh`.
`deploy/` thực tế chỉ có `Dockerfile`, `docker-compose.yml`, `deploy.sh`, `rollback.sh`.
Ai deploy theo README sẽ chạy lệnh không tồn tại.

### 12. Thiếu `/api/health`

Healthcheck ở `docker-compose.yml` gọi `/` — chỉ chứng minh Fastify còn sống, không chứng
minh SQLite mở được hay `ffmpeg`/`ffprobe`/`magick` có trong PATH. Container "sống nhưng vô
dụng" vẫn xanh.

Sửa: route `/api/health` kiểm ba thứ đó. Lưu ý `authGuard` (`auth-guard.ts:56`) chặn mọi
`/api/` — phải cho route này qua như `/api/auth/`.

### 13. `docs/` không theo cấu trúc đã khai

`docs/` chỉ có `editor-interaction-spec.md`, `upload-interaction-spec.md`, và
`example.webp` **485 KB**. Thiếu `codebase-summary.md`, `system-architecture.md`,
`deployment-guide.md`. Ảnh 485 KB nên nén hoặc đưa ra ngoài repo.

---

## P2 — phòng thủ chiều sâu / nhỏ

### 14. Kiểm `..` trên đường dẫn **chưa giải mã**

`server/ownership.ts:139` — `if (path.includes("..")) throw`. `path` là
`request.url.split("?")[0]`, tức còn nguyên percent-encoding. `%2e%2e%2f` không chứa `..`
nên lọt qua phép kiểm này.

`@fastify/static` gần như chắc chắn chặn sau khi giải mã (thư viện `send` có
`UP_PATH_REGEXP`), nên **chưa chứng minh được đây là lỗ**. Nhưng phép kiểm hiện tại đang
dựa vào hành vi của thư viện thay vì tự đứng vững.

Sửa: `decodeURIComponent` (trong try/catch) rồi mới kiểm `..`.

### 15. `decodeURIComponent` không bọc try

`server/ownership.ts:84` và `:150` — `%` lạc trong URL ném `URIError` → 500 thay vì 400.

### 16. Tệp dở dang còn lại khi upload vượt hạn mức

`server/main.ts:668` — `await pipeline(part.file, createWriteStream(target))` không nằm
trong try. `@fastify/multipart` vượt `fileSize` sẽ ném, và tệp đã ghi một phần nằm lại
trong `media/` không ai dọn. Cũng không kiểm `part.file.truncated`.

### 17. Không có `process.on("unhandledRejection")`

`startJob` (`main.ts:1727`) có `.catch` nên đường chính an toàn. Nhưng Node 22 mặc định
giết tiến trình khi có rejection lọt, và dự án có nhiều `void`/fire-and-forget. Một handler
ghi log rồi tiếp tục (hoặc thoát sạch) rẻ hơn nhiều so với việc container chết im lặng —
mà hiện tại chết im lặng thật vì chưa có nhật ký (mục 3).

### 18. Không sao lưu trước migration phá huỷ

`server/db.ts:534-543` — `DROP TABLE elements` rồi `RENAME`. Có transaction nên an toàn về
mặt CSDL, nhưng nếu logic dựng cột sai thì dữ liệu cũ đã đi. Chép `teddit.db` sang
`teddit.db.bak-<timestamp>` trước khối rebuild là 3 dòng, và đây là dữ liệu **không tái
tạo lại được** (compose tự ghi chú điều đó).

### 19. `escapeDrawText` đổi nội dung người dùng

`server/render.ts:99` — `.replace(/'/g, "’")`. Caption có `don't` sẽ in ra `don’t`. Với
tiếng Việt hiếm gặp, nhưng đây là im lặng sửa nội dung người dùng.

Sửa gọn hơn: dùng `textfile=` của drawtext thay cho `text=` — nội dung đi qua tệp thì
không còn bài toán escape nào cả, và bỏ được cả ba phép `replace` còn lại.

---

## Đề xuất thứ tự

1. Nhật ký (mục 3) — mọi thứ sau đó dễ chẩn đoán hơn.
2. CI chạy 4 lệnh có sẵn (mục 9) — rẻ nhất, giữ cho mọi thay đổi sau không lùi.
3. Nhịp tim job (mục 1) + `bodyLimit` (mục 2) + giới hạn tài nguyên compose (mục 4).
4. Hạn mức chi phí + đĩa (mục 5, 6).
5. Tách `main.ts` và `use-editor.ts` (mục 7) — làm sau CI để có lưới an toàn.
6. Code-splitting (mục 8), README (mục 11), tên tiếng Việt (mục 10).

## Câu hỏi còn treo

- Máy chủ hiện đang chạy nhiều người dùng cùng lúc, hay chỉ một mình? Trả lời khác nhau
  thì mức ưu tiên của mục 1/4/5/6 đổi hẳn.
- `deploy/setup-ubuntu.sh` bị bỏ hẳn hay chỉ tạm chuyển sang Docker? Quyết định này chọn
  giữa "sửa README" và "khôi phục script".
