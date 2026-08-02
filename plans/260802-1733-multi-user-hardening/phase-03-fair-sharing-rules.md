# Chặng 03 — Luật chia sẻ công bằng

**Ưu tiên:** P0 (phần quyền kho) · **Trạng thái:** ⬜ chưa làm · **Phụ thuộc:** chặng 02

Sửa quyền sửa kho chung, và làm cho dung lượng đĩa **nhìn thấy được**.

> **Quyết định của chủ dự án (2026-08-02):** hạn ngạch đĩa và hạn mức chi phí AI
> theo người **hoãn lại** — whitelist email đã đủ ở giai đoạn này. Phần đó giữ ở
> mục 3.3 dưới dạng chưa làm, không xoá, để lúc mở rộng người dùng thì có sẵn.

## Bối cảnh

- Báo cáo: [`260802-1725-project-improvement-review.md`](../reports/260802-1725-project-improvement-review.md) mục 5, 6 và phần bổ sung sau khi biết là đa người dùng
- Mô hình quyền đã chốt: [`plan.md`](plan.md#mô-hình-quyền-đã-chốt-kho-tư-liệu--kho-nhạc)

---

## 3.1 — Quyền sửa kho chung (làm)

### Nhận định

`server/asset-library.ts:115` và `server/music-library.ts:124` đều viết:

```ts
mine: Boolean(row?.uploaded_by),
```

Cờ đó **true cho mọi tệp bất kỳ ai tải lên**, không phải tệp của người đang xem —
trong khi cả hai hàm đều đã nhận `viewerId` và dùng đúng nó cho `starred` ngay
dòng dưới. Đây là lỗi gõ nhầm, không phải quyết định thiết kế: sự tồn tại của
trường `mine` chứng minh mô hình "của ai người nấy sửa" vốn đã là ý định ban đầu.

Đường ghi hở hơn: `server/main.ts:951` → `asset-library.ts:154`
`updateAsset(file, patch)` **không nhận `viewer`**, không kiểm gì. Bất kỳ ai đã
đăng nhập đều đổi được tiêu đề / thẻ / mô tả của mọi tệp trong kho. Và
`asset-library.ts:176` dùng `INSERT OR IGNORE` với `file` tuỳ ý từ URL → tạo được
hàng ma cho tệp không tồn tại.

Kho nhạc chưa có route sửa siêu dữ liệu nên chưa hở đường ghi, nhưng cờ `mine` sai
y hệt.

**Không siết phần đọc.** Danh mục vẫn chung: ai đăng nhập cũng xem, nghe thử, chép
vào dự án của mình. `server/ownership.ts:130` đã ghi rõ lý do — chặng này không
đụng vào.

### Yêu cầu

1. Chỉ người tải tệp lên mới sửa được siêu dữ liệu của tệp đó.
2. `mine` phản ánh đúng người đang xem, ở cả hai kho.
3. Tệp thả tay vào thư mục (`uploaded_by` NULL) không ai sửa được qua API.
4. Không sửa được siêu dữ liệu của tệp không tồn tại trong kho.
5. Phần đọc **giữ nguyên**.

### Kiến trúc

Quyền đặt ở **tầng thư viện, không ở route**. `updateAsset` nhận thêm `viewerId` và
tự ném `AccessError(404)` — cùng lớp lỗi và cùng mã trạng thái mà
`server/ownership.ts` đang dùng, để "không có tệp này" và "tệp này không phải của
anh" nhìn từ ngoài giống hệt nhau. Đặt ở tầng thư viện thì route thêm về sau không
thể quên.

### Các bước

1. **Sửa `mine` ở cả hai kho** — `row?.uploaded_by === viewerId`. Một dòng mỗi tệp,
   kèm chú thích: `Boolean(...)` chỉ trả lời "có ai đó tải lên", không trả lời "có
   phải anh không".
2. **`updateAsset` nhận `viewerId`.** Đọc `uploaded_by` trước; không có hàng, hoặc
   NULL, hoặc khác `viewerId` → `throw new AccessError(404, "Không tìm thấy")`. Bỏ
   `INSERT OR IGNORE` — tệp thả tay không sửa được qua API, và đó là lựa chọn có
   chủ ý (ghi vào chú thích).
3. **Route.** `main.ts:951` truyền `request.viewer!.id`. Fastify tự đọc
   `statusCode` của `AccessError` nên không cần bắt.
4. **Màn kho.** Nút Sửa chỉ hiện khi `mine`. Đây là gợi ý giao diện, không phải
   phép kiểm — máy chủ vẫn là chỗ chốt.
5. **Kiểm dữ liệu cũ trước khi triển khai:**
   `SELECT COUNT(*) FROM library_assets WHERE uploaded_by IS NULL` và tương tự cho
   `library_tracks`. Có nhiều thì vá tay bằng CSDL, **không nới luật**.

---

## 3.2 — Đĩa nhìn thấy được (làm)

### Nhận định

Whitelist trả lời "ai được vào", không trả lời "đĩa còn bao nhiêu". Và phần lớn
dung lượng **không** đến từ người dùng bất cẩn mà từ tệp trung gian của chính hệ
thống:

Mỗi dự án giữ vĩnh viễn, ngoài tư liệu gốc:

| Tệp | Nơi | Còn dùng sau khi xuất? |
|---|---|---|
| `work/base.mp4` | `render.ts:143` | **Có** — `GET /api/projects/:id/filmstrip` đọc nó (`main.ts:1666`) |
| `work/audio.wav` | `pipeline.ts:143` | **Có** — `GET /api/projects/:id/envelope` đọc nó (`main.ts:1657`) |
| `work/cut.mp4` | `render.ts:234` | **Không** — chỉ là bước trung gian của lượt xuất |
| `work/cut-filter.txt` | `render.ts:342` | **Không** |
| `out/final.mp4`, `out/final-music.mp4` | `render.ts:441,863` | Có — là thành phẩm |

Tên tệp cố định nên không tích luỹ theo số lượt xuất — tốt. Nhưng tổng vẫn khoảng
**3–4 lần dung lượng tư liệu gốc** cho mỗi dự án, giữ mãi. 150 GB đầy nhanh hơn
cảm giác, và `teddit.db` nằm cùng volume: đĩa đầy thì SQLite hỏng ở chỗ chẳng liên
quan gì tới người vừa tải tệp lên.

**Chỉ `cut.mp4` và `cut-filter.txt` là xoá được.** `base.mp4` và `audio.wav` là phụ
thuộc sống của bàn dựng — xoá là hỏng dải ảnh và đường bao tiếng.

### Các bước

1. **Xoá `cut.mp4` + `cut-filter.txt` sau khi lượt xuất xong**, ở nhánh thành công
   của `runExport` (`server/pipeline.ts:756`). Chúng dựng lại được từ `base.mp4`.
   Không xoá ở nhánh lỗi — lúc đó chúng là bằng chứng để chẩn đoán.
2. **Health check báo đĩa.** Mở rộng `/api/health` của chặng 01: thêm phần trăm
   đĩa đã dùng dưới `DATA_ROOT` (`statfs`). Vượt 85% → `ok: false` để healthcheck
   của Docker đổi màu **trước khi** đầy thật.
3. **Số liệu cho chủ dự án.** `GET /api/settings` (`main.ts:874`) trả thêm tổng
   dung lượng đã dùng và dung lượng còn trống; màn Cài đặt hiện một dòng. Không
   phải hạn mức — chỉ là con số để biết lúc nào cần dọn.

---

## 3.3 — Hạn ngạch theo người (HOÃN)

Chủ dự án chốt hoãn: whitelist email đã đủ ở giai đoạn này.

Giữ lại thiết kế để lúc mở rộng người dùng thì lắp vào, không phải nghĩ lại:

- `server/quota.ts` — `assertDiskQuota` (413), `assertAiQuota` (429), `recordAiCall`.
- Đo dung lượng bằng `SUM` từ `media_files` join `projects` theo `owner_id`, **không**
  dùng cột cộng dồn — cột đó lệch dần mỗi lần xoá dự án, và lệch âm thì chối oan.
- Hạn mức AI đếm trong CSDL (bảng `ai_usage`, khoá `(user_id, kind, day)`), không
  trong bộ nhớ: mất khi restart thì restart trở thành cách vượt hạn mức.
- Ngày tính theo giờ Việt Nam, không theo UTC.
- Cắm vào `transcribe` và `steps/:key/retry` — hai đường duy nhất tiêu tiền
  (`server/llm.ts:49`). Ghi nhận **lúc nhận việc**, không phải lúc job xong: việc
  hỏng thì tiền cũng đã tiêu.

**Dấu hiệu nên lắp vào:** whitelist vượt ~10 người, hoặc mở cho người ngoài, hoặc
hoá đơn OpenRouter một tháng vượt mức chấp nhận được.

---

## Tệp liên quan

**Sửa**

- `server/asset-library.ts:115, 154-180`
- `server/music-library.ts:124`
- `server/main.ts:951` — truyền viewer
- `server/main.ts:874` — settings trả số liệu đĩa
- `server/health.ts` (chặng 01) — thêm phép kiểm đĩa
- `server/pipeline.ts:756` — dọn `cut.mp4`
- `src/routes/library/assets-page.tsx`, `music-page.tsx` — ẩn nút Sửa khi `!mine`
- `src/routes/library/settings-page.tsx` — dòng dung lượng

## Todo

- [ ] `mine` so bằng `viewerId` ở `asset-library.ts:115` và `music-library.ts:124`
- [ ] `updateAsset` nhận `viewerId`, kiểm chủ, bỏ `INSERT OR IGNORE`
- [ ] Route `PATCH /api/library/assets/:file` truyền viewer
- [ ] Đếm hàng `uploaded_by IS NULL` trên CSDL thật trước khi triển khai
- [ ] Màn kho ẩn nút Sửa khi `mine === false`
- [ ] Dọn `cut.mp4` + `cut-filter.txt` ở nhánh xuất thành công
- [ ] `/api/health` báo đĩa, ngưỡng 85%
- [ ] Màn Cài đặt hiện dung lượng đã dùng / còn trống
- [ ] ~~Hạn ngạch đĩa theo người~~ — hoãn
- [ ] ~~Hạn mức AI theo người~~ — hoãn

## Xong khi

- A tải tệp lên kho; B thấy tệp đó, nghe/xem thử được, chép vào dự án được, nhưng
  **không** sửa được tiêu đề (404) và không thấy nút Sửa.
- A vẫn sửa được tệp của chính A.
- Tệp thả tay vào thư mục hiện trong danh mục, `mine: false`, không ai sửa được.
- Xuất video xong thì `work/` chỉ còn `base.mp4` và `audio.wav`.
- Dải ảnh và đường bao tiếng vẫn chạy sau khi dọn (đây là phép thử quan trọng nhất
  của mục 3.2).
- `df` trong container khớp con số màn Cài đặt hiện.
- `npm run check:ownership` vẫn xanh.

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Dữ liệu cũ `uploaded_by` NULL → chủ thật mất quyền sửa tệp mình đã tải lên | Đếm trước khi triển khai; vá tay bằng CSDL, không nới luật |
| Dọn `cut.mp4` làm hỏng một đường đọc chưa phát hiện | Đã soát: chỉ `render.ts:234` ghi và `cutRanges` đọc trong cùng một lượt. Vẫn phải mở bàn dựng thử dải ảnh + đường bao sau khi xuất |
| Ngưỡng đĩa 85% báo động giả trên máy dev | Ngưỡng đặt bằng biến môi trường |

## An ninh

- Trả **404** chứ không 403 khi sửa tệp của người khác — giữ đúng lập trường ở
  `server/ownership.ts:38-48`: 403 là câu trả lời để người ngoài dò xem cái gì tồn tại.
- Số liệu đĩa ở `/api/settings` là **tổng của máy**, mà mọi người đăng nhập đều đọc
  được. Chấp nhận được với whitelist hiện tại; lúc mở rộng người dùng thì phải giới
  hạn cho chủ dự án — ghi vào mục 3.3.

## Tiếp theo

Chặng 04 — [Tách hai tệp khổng lồ](phase-04-split-monoliths.md).
