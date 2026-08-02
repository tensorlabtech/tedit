# Bản đồ mã nguồn

Cập nhật 02/08/2026.

Tệp này trả lời **"muốn sửa X thì mở tệp nào"**. Lý do của từng quyết định nằm ở
`README.md` và ở chú thích trong chính tệp — không chép lại ở đây, vì hai bản của
cùng một lời giải thích thì bản nào cũng có thể là bản cũ.

## Máy chủ

### Định tuyến

`server/main.ts` (346 dòng) chỉ còn phần khởi tạo: Fastify, multipart, cửa đăng
nhập, `authGuard`, static, `/api/health`, đăng ký plugin, `listen`.

Route nằm trong `server/routes/`, mỗi miền một tệp:

| Tệp | Giữ gì |
|---|---|
| `projects-routes.ts` | dự án, lời mở, lời nhắc đã bỏ qua, hiệu ứng, zoom-punch |
| `files-routes.ts` | nhận tệp vào dự án, tệp gốc, sửa/xoá tệp |
| `elements-routes.ts` | chữ trên màn, tư liệu chèn, phụ đề |
| `music-routes.ts` | nhạc trong MỘT dự án |
| `library-routes.ts` | kho tư liệu và kho nhạc DÙNG CHUNG |
| `transcript-routes.ts` | từ, câu, đo bố cục chữ |
| `segments-routes.ts` | đoạn, chỗ bị bỏ |
| `jobs-routes.ts` | chép lời, xuất video, thử lại, hỏi tiến độ |
| `media-routes.ts` | đường bao tiếng, dải ảnh |
| `settings-routes.ts` | cài đặt người dùng, dung lượng đĩa |
| `media-formats.ts` | ba regex đuôi tệp dùng chung |

**Thêm route mới thì không phải nhớ gì về phân quyền.** `authGuard`
(`server/auth-guard.ts`) chặn ở tầng `onRequest` theo TIỀN TỐ đường dẫn, nên route
mới mặc định đã bị khoá. Chỉ khi mã của thực thể nằm trong THÂN request mới phải
tự kiểm — xem `assertInProject` và ghi chú ở `server/ownership.ts`.

### Việc nặng

`server/job-queue.ts` là nguồn sự thật cho "việc nào đang chạy" — một `Map` trong
bộ nhớ, cộng nhịp tim 30 giây. Bảng `jobs` chỉ để báo cáo ra ngoài.

Điều kiện: **đúng một tiến trình Node**. Chạy nhiều bản sao thì khoá này mất tác
dụng và phải chuyển sang khoá trong CSDL.

`server/pipeline.ts` là mạch chép lời và xuất video; `server/render.ts` là mọi
lệnh ffmpeg.

### Sức khoẻ

`server/health.ts` — `/api/health` kiểm CSDL, `ffmpeg`/`ffprobe`/`magick`, và
quyền ghi thư mục dữ liệu. Đĩa sắp đầy **không** kéo `ok` xuống; nó chỉ là con số
và một dòng nhật ký.

## Bàn dựng

`src/routes/editor/use-editor.ts` vẫn là tệp lớn nhất dự án (2375 dòng). Đã tách
ra những phần có đường cắt sạch:

| Tệp | Giữ gì |
|---|---|
| `shape-project.ts` | đổi dữ liệu thô của máy chủ thành hình bàn dựng — phép biến đổi THUẦN |
| `use-trim-drag.ts` | kéo mép khối trên dải thời gian |
| `use-media-intake.ts` | nhận tệp vào dự án, lấy từ kho |
| `editor-limits.ts` | sàn độ dài của từng loại khối |
| `ignore-error.ts` | bẫy lỗi dùng chung |
| `editor-data.ts` | kiểu dữ liệu và hàm giúp việc của bàn dựng |

**Còn lại trong `use-editor.ts`** là những nhóm đan vào nhau qua trạng thái dùng
chung: hoàn tác, đoạn/cắt, từ và câu, hiệu ứng, bộ dáng, phụ đề. Tách tiếp thì
phải đổi cách sở hữu trạng thái, không còn là chuyện di chuyển mã.

## Kiểm

| Lệnh | Canh cái gì |
|---|---|
| `npm run check:ownership` | luật phân quyền, gồm cả `..` mã hoá và đường dẫn hỏng |
| `npm run check:style-pack` | năm bộ dáng khai `defaults` giống hệt nhau |
| `npm run check:all` | cả bốn, đúng thứ CI chạy |

Không có test hành vi cho route hay cho bàn dựng. Muốn chắc thì chạy trọn luồng
trên bản đã deploy — xem `.claude/skills/deploy/SKILL.md`.

## Chỗ đã biết là còn lệch

- `main.ts` cũ khai `IMAGE` **không có** `gif`, còn `asset-library.ts` **có**. Nên
  `.gif` vào được kho chung nhưng không vào thẳng dự án. Hai bản giữ riêng ở
  `routes/media-formats.ts` để cú tách route không lặng lẽ đổi hành vi; chọn bên
  nào là một việc riêng.
- `escapeDrawText` (`render.ts:96`) đổi `'` của người dùng thành `’`. Cách sạch là
  `textfile=` **kèm `expansion=none`**, nhưng chỉ nhận được sau khi so khung trên
  đường dựng thật.
