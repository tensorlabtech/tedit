# Chặng 02 — Chịu tải nhiều người

**Ưu tiên:** P0 · **Trạng thái:** ⬜ chưa làm · **Phụ thuộc:** chặng 01

Hàng đợi việc nặng toàn máy, nhịp tim cho job đang chạy, dọn job mồ côi lúc khởi
động, và trần tài nguyên cho container.

## Bối cảnh

- Báo cáo: [`260802-1725-project-improvement-review.md`](../reports/260802-1725-project-improvement-review.md) mục 1, 4
- `deploy/docker-compose.yml` — comment đầu tệp: VPS dùng chung với `vas-printing-edge-1`

## Nhận định then chốt

**`startJob` chỉ khoá theo dự án.** `server/main.ts:1714-1734` kiểm bảng `jobs`
theo `(project_id, kind)`. Năm người bấm Xuất video trên năm dự án khác nhau =
năm ffmpeg cùng lúc, cộng năm lượt faster-whisper trên CPU. Trên VPS dùng chung,
đó là cách nhanh nhất để cả hai stack cùng chết.

**Mốc 3 phút đẻ ra job trùng.** `main.ts:1712` — `JOB_STALE_MS = 3 * 60_000`;
`main.ts:1724` cho phép khởi động lại nếu `updated_at` cũ hơn thế. Nhưng giữa
`server/pipeline.ts:605` (tiến độ 60) và `pipeline.ts:749` (tiến độ 85) là toàn bộ
pass drawtext + chèn tư liệu, **không có lần `setJob` nào** — `server/render.ts`
không có callback tiến độ nào (grep `onProgress` → rỗng). Trên CPU, pass đó vượt 3
phút là chuyện thường.

**Hai lỗi này khuếch đại nhau.** Máy càng tải nặng thì pass càng lâu, càng dễ vượt
mốc, càng đẻ thêm job, lại càng tải nặng. Phải sửa cùng một lượt, không tách ra
được.

Hậu quả cụ thể: hai tiến trình ffmpeg cùng ghi `work/` và `out/` của một dự án →
tệp thành phẩm hỏng, người dùng tải về bản dựng dở.

**Khởi động lại thì job treo.** Container restart giữa lúc đang xuất video để lại
hàng `running` trong bảng `jobs`. Hiện chỉ có mốc 3 phút gỡ nó ra — cùng chính cái
mốc đang gây lỗi trên.

## Yêu cầu

1. Toàn máy chỉ chạy tối đa `N` việc nặng cùng lúc (`N` từ biến môi trường, mặc định 2). Việc thứ `N+1` **xếp hàng**, không bị chối.
2. Người dùng nhìn thấy mình đang xếp hàng, thứ mấy.
3. Một dự án vẫn chỉ một việc mỗi loại — giữ nguyên hành vi 409 hiện có.
4. Job đang chạy thật không bao giờ bị coi là chết.
5. Job mồ côi sau khi khởi động lại được đánh hỏng ngay, không chờ hết mốc.
6. Container có trần CPU và RAM.

## Kiến trúc

**Khoá trong tiến trình là nguồn sự thật, bảng `jobs` là chỗ báo cáo.** Tedit chạy
**một** tiến trình Node (`docker-compose.yml` chỉ có service `app`), nên một
`Map<string, Promise>` trong bộ nhớ biết chính xác việc nào đang chạy — chính xác
hơn mọi phép suy từ `updated_at`. Mốc thời gian chỉ còn dùng cho job mồ côi của
lượt chạy **trước**, và việc đó xử lý gọn một lần lúc khởi động.

```
server/job-queue.ts
  ├── running: Map<`${projectId}:${kind}`, Promise>   nguồn sự thật
  ├── waiting: Array<QueuedJob>                        xếp hàng FIFO
  ├── MAX_CONCURRENT = Number(env.TEDDIT_MAX_JOBS ?? 2)
  ├── enqueue(projectId, kind, run) → "started" | "queued" | "duplicate"
  ├── heartbeat(projectId, kind)    → chạm updated_at
  └── reapOrphans()                 gọi MỘT lần lúc khởi động
```

Nhịp tim: một `setInterval` 30s do chính hàng đợi giữ cho mỗi job đang chạy, gọi
`setJob` với **nguyên trạng thái và tiến độ hiện tại** — chỉ chạm `updated_at`.
Không đụng `render.ts`, không phải parse `-progress` của ffmpeg. Đây là đường rẻ
nhất và nó đủ: cái ta cần chứng minh là "tiến trình còn sống", không phải "còn
bao nhiêu phần trăm".

## Tệp liên quan

**Tạo**

- `server/job-queue.ts` — hàng đợi, nhịp tim, dọn mồ côi

**Sửa**

- `server/main.ts:1712-1734` — `startJob` gọi vào hàng đợi; bỏ `JOB_STALE_MS` khỏi đường chính
- `server/main.ts:1736-1790` — ba route `transcribe`, `retry`, `export` phân biệt được `queued` với `duplicate`
- `server/main.ts:1785` — `GET /api/projects/:id/jobs/:kind` trả thêm vị trí trong hàng đợi
- `server/pipeline.ts:41-80` — `setJob` nhận trạng thái `queued`
- `src/routes/editor/use-editor.ts:2308,2796` — hai vòng hỏi tiến độ hiển thị trạng thái xếp hàng
- `src/lib/api.ts` — kiểu `ApiJob` thêm `queuePosition`
- `deploy/docker-compose.yml` — `cpus`, `mem_limit`, `TEDDIT_MAX_JOBS`
- `.env.example` — khai `TEDDIT_MAX_JOBS`

## Các bước

1. **`server/job-queue.ts`.** Viết hàng đợi theo sơ đồ trên. `enqueue` trả ba
   trạng thái phân biệt được: đã chạy / đã xếp hàng / trùng (dự án này đã có việc
   cùng loại).
2. **Dọn mồ côi.** `reapOrphans()` chạy một lần lúc nạp module: mọi hàng `jobs` có
   `status='running'` đều thuộc lượt chạy trước (vì `running` map vừa rỗng) →
   đánh `error` kèm thông báo "Máy chủ khởi động lại giữa chừng". Gọi luôn
   `failRunningStep` cho khớp với đường lỗi đang có ở `main.ts:1731`.
3. **Nhịp tim.** Bọc `run` trước khi chạy: mở `setInterval` 30s chạm `updated_at`,
   đóng ở `finally`. Đọc trạng thái/tiến độ hiện tại từ bảng rồi ghi lại y nguyên
   — không tự bịa tiến độ.
4. **Nối `startJob`.** Giữ nguyên tên và chữ ký để ba route không phải viết lại
   nhiều; đổi kiểu trả về từ `boolean` sang ba trạng thái.
5. **Route.** `duplicate` → 409 như cũ (giữ nguyên câu tiếng Việt đang có).
   `queued` → 202 kèm `{ status: "queued" }`.
6. **Màn hình.** Hai vòng `setInterval` ở `use-editor.ts` đang chỉ đọc
   `job.status`; thêm nhánh `queued` hiện "Đang xếp hàng — thứ N". Nút giữ nguyên
   trạng thái khoá, vì với người dùng thì xếp hàng và đang chạy đều là "chờ".
7. **Trần tài nguyên.** VPS hiện tại: **Contabo VPS 10 — 4 core, 8 GB RAM, 150 GB
   SSD**, dùng chung với stack `vas-printing`.

   ```yaml
   cpus: "2.5"        # chừa 1,5 core cho stack kia và cho host
   mem_limit: 5g      # chừa 3 GB
   environment:
     TEDDIT_MAX_JOBS: 1
     TEDDIT_ASR_THREADS: 2
   ```

   **`TEDDIT_MAX_JOBS: 1` chứ không phải 2** trên máy này. Với ngân sách 2,5 core,
   hai việc nặng song song thì cả hai cùng bò, và RAM nhân đôi (faster-whisper
   `int8` chiếm ~1,5–2 GB mỗi lượt). Một việc xong trong 10 phút hơn hai việc cùng
   xong trong 25 phút. Đây là biến môi trường nên đổi máy xịn hơn chỉ là đổi một
   con số.

8. **Chặn ffmpeg và whisper giành hết core.** Trần cgroup ở bước 7 giới hạn tổng
   lượng CPU, nhưng **không** giới hạn số luồng — và số luồng thừa thì sinh ra
   thrash chứ không sinh ra tốc độ.

   `server/asr/transcribe.py:113` — `so_luong = os.cpu_count() or 4`.
   `os.cpu_count()` trả về số core của **host** (4), không đọc hạn mức cgroup. Đặt
   `cpus: "2.5"` xong thì whisper vẫn mở 4 luồng tranh nhau 2,5 core → cgroup bóp
   lại và tốc độ tệ hơn cả lúc chưa giới hạn.

   Sửa: đọc `TEDDIT_ASR_THREADS` trước, rơi về `os.cpu_count()` khi chưa đặt.
   Tương tự, thêm `-threads` cho ffmpeg ở `server/media-tools.ts:261` (`ffmpeg()`)
   lấy từ cùng biến.

9. **Đo thật.** Bấm xuất video trên 3 dự án cùng lúc; xác nhận đúng **1** tiến
   trình ffmpeg chạy (`docker exec tedit_app ps ax | grep ffmpeg`), 2 job còn lại ở
   `queued`, và `docker stats` cho thấy container không vượt 2,5 core / 5 GB.

## Todo

- [x] `server/job-queue.ts` — hàng đợi + nhịp tim + dọn mồ côi
- [x] `reapOrphans()` gọi lúc khởi động
- [x] `startJob` trả ba trạng thái, bỏ hẳn `JOB_STALE_MS`
- [x] Ba route phân biệt `queued` với `duplicate`
- [x] `GET .../jobs/:kind` trả vị trí hàng đợi
- [x] **Bốn** chỗ hỏi tiến độ nhận `queued` (bàn dựng ×2, màn nạp tệp, màn dựng)
- [x] `cpus: 2.5` / `mem_limit: 5g` / `TEDDIT_MAX_JOBS: 1` trong compose + `.env.example`
- [x] `TEDDIT_WORKER_THREADS` trong `transcribe.py` **và** `-threads` cho ffmpeg
- [x] Đo hàng đợi bằng việc giả (xem dưới)
- [ ] **Còn lại:** đo 3 lượt xuất thật trên máy chủ sau khi deploy

### Đo được

Việc giả trên CSDL tạm, `TEDDIT_MAX_JOBS=1`:

```
ba dự án cùng xin  : started, queued, queued
thứ tự hàng chờ    : p2=1 p3=2
p2 lúc chờ         : queued · Đang xếp hàng
p1 xin lần hai     : duplicate
thứ tự thật sự chạy: p1 → p2 → p3
việc hỏng          : error · hỏng có chủ ý
dọn mồ côi         : 3 việc → error · Máy chủ khởi động lại giữa chừng
```

Phép đo này chắc hơn ba lượt xuất thật ở phần **logic hàng đợi** (chạy được cả
nhánh hỏng và nhánh mồ côi, vốn khó dựng bằng tay), nhưng nó KHÔNG đo ffmpeg
thật. Trần `cpus`/`mem_limit` và `-threads` vẫn phải xác nhận bằng `docker stats`
sau khi deploy.

### Lệch so với plan

**Thêm: hàng đợi tự đóng việc mà phép chạy quên đóng.** Phép đo lộ ra hàng bảng
kẹt `running` khi phép chạy trả về mà không tự gọi `setJob(..., "done")` — đúng
cái bẫy mà chú thích ở route Thử lại kể là đã gặp thật. Nay `launch` kiểm sau khi
phép chạy resolve: còn `running` thì đóng hộ. Một chỗ sửa, bỏ được cả một lớp lỗi
"con quay quay mãi".

**Đổi tên: `TEDDIT_ASR_THREADS` → `TEDDIT_WORKER_THREADS`.** Cùng con số ấy cũng
dùng cho `-threads` của ffmpeg, mà tên có chữ `ASR` thì đọc ra như chỉ dành cho
máy nghe.

## Xong khi

- 3 lượt xuất đồng thời → đúng 1 ffmpeg, 2 xếp hàng, không tệp nào hỏng.
- Một lượt xuất dài 10 phút không bao giờ bị khởi động lần hai.
- `docker compose restart` giữa lúc xuất → job thành `error` ngay, màn dựng báo
  hỏng thay vì quay mãi.
- `docker stats` cho thấy container không vượt trần đã đặt.

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Hàng đợi trong bộ nhớ mất khi restart | Chấp nhận: job xếp hàng chưa tiêu tài nguyên nào, và `reapOrphans` đã lo phần job đang chạy. Ghi rõ trong chú thích để sau này không ai tưởng nó bền |
| Nhịp tim che mất job **thật sự** treo (ffmpeg đứng im nhưng tiến trình còn sống) | Ngoài phạm vi chặng này. Ghi vào câu hỏi treo; muốn bắt thì phải đo tiến độ thật của ffmpeg |
| `mem_limit` quá chặt → OOM-kill giữa lúc xuất | Đặt rộng tay lần đầu, theo `docker stats` một tuần rồi siết. Có nhật ký từ chặng 01 nên OOM-kill nhìn ra được |
| Sau này chạy nhiều tiến trình/replica thì khoá bộ nhớ sai | Chú thích rõ điều kiện "một tiến trình" ngay đầu `job-queue.ts`, cùng cách viết như các chú thích hiện có |

## An ninh

Không mở thêm đường nào. Một điểm cần giữ: vị trí hàng đợi trả về **chỉ được là
một con số** — không kèm mã dự án hay email của người đứng trước, vì `GET .../jobs/:kind`
là route mọi người dùng đều gọi được cho dự án của mình.

## Tiếp theo

Chặng 03 — [Luật chia sẻ công bằng](phase-03-fair-sharing-rules.md).
