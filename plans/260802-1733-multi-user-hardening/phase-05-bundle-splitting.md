# Chặng 05 — Chia nhỏ bundle

**Ưu tiên:** P1 · **Trạng thái:** ⬜ chưa làm · **Phụ thuộc:** chặng 04

Bundle production đang là **một mảnh 1,74 MB** và có kèm cả trang dev.

## Bối cảnh

- Báo cáo mục 8 · `dist/assets/index-D5SqShL_.js` = 1.743.750 byte

## Nhận định then chốt

**Không có code-splitting nào.** `grep -c "React.lazy\|lazy("` trong `src` → **0**.

**Trang dev đi kèm bản production.** `src/main.tsx:8-11` import tĩnh
`DesignSystemPage`, `SkinLabPage`, `StylePage`. Trang design system trình bày đủ
60 component shadcn cùng mọi biến thể (`src/dev/design-system/sections/` — hơn
2000 dòng JSX) và mọi người dùng thật đều tải nó về dù không bao giờ mở.

**Font đã đúng rồi, đừng đụng.** 1,2 MB `.ttf` trong `dist/assets/` trông như chỗ
để cắt, nhưng `src/style-pack-fonts.css:17` giải thích rõ: trình duyệt chỉ tải tệp
khi có thứ thật sự dùng tới họ chữ đó, nên năm bộ dáng không thành năm lượt tải.
Và chúng phải là **đúng tệp** ffmpeg sẽ in ra — đó là nền của lời hứa "thấy sao
xuất vậy". Không đổi sang woff2, không bỏ bớt.

## Yêu cầu

1. Trang dev không nằm trong bundle mà người dùng thật tải.
2. Bundle vào trang đầu (danh sách dự án) nhỏ hơn rõ rệt.
3. `/_dev/*` vẫn dùng được ở máy phát triển, đúng như cũ.
4. Không đổi hành vi nhìn thấy được ở các trang thật.

## Kiến trúc

Hai tầng, làm theo thứ tự:

**Tầng 1 — cắt trang dev.** `React.lazy` cho `DesignSystemPage`, `SkinLabPage`,
`StylePage`. Rẻ nhất, an toàn nhất, và chặn phần lớn khối lượng thừa. Giữ route để
`/_dev/design-system` vẫn mở được — `CLAUDE.md` bảo đọc trang đó trước khi dựng
màn mới, nên **không** được xoá.

**Tầng 2 — cắt theo route thật.** `EditorPage` là màn nặng nhất (dải thời gian,
`dnd-kit`, `recharts`, xem trước). Người vào xem danh sách dự án không cần nó.
`lazy` cho `EditorPage`, `UploadPage`, `PipelinePage`, và ba trang kho.

Bọc `<Routes>` trong `<Suspense>` với một `fallback` **im lặng** — nền trống đúng
kích thước, không spinner. Màn nháy một con quay rồi hiện nội dung thì tệ hơn là
chờ thêm 100ms mà không nháy gì.

## Tệp liên quan

**Sửa**

- `src/main.tsx:8-11, 37-...` — `lazy` + `Suspense`
- `vite.config.ts` — `build.rollupOptions.output.manualChunks` nếu cần gom `recharts`/`dnd-kit`

## Các bước

1. Đo trước: `npm run build`, ghi lại kích thước từng tệp trong `dist/assets/`.
2. `lazy` ba trang dev. Build lại, đo. Đây là phần lãi lớn nhất trên mỗi dòng mã sửa.
3. `Suspense` bọc `<Routes>`, fallback là một khối trống — không spinner.
4. `lazy` `EditorPage`, `UploadPage`, `PipelinePage`, `AssetsPage`, `MusicPage`, `SettingsPage`.
5. Build, đo lại, so với con số ở bước 1. Ghi cả hai vào commit message.
6. Bấm thử từng route trên bản build: không route nào trắng màn, không route nào
   nháy.
7. Chỉ khi bước 5 cho thấy còn một chunk chung quá lớn thì mới đụng `manualChunks`.
   Chia tay thủ công sớm quá thường làm tệ hơn.

## Todo

- [ ] Đo kích thước bundle trước khi sửa
- [ ] `lazy` ba trang `/_dev/*`
- [ ] `Suspense` + fallback im lặng
- [ ] `lazy` các route thật
- [ ] Đo lại, ghi số vào commit
- [ ] Bấm thử mọi route trên bản build

## Xong khi

- Chunk vào trang đầu nhỏ hơn đáng kể so với 1,74 MB (mục tiêu: dưới một nửa).
- `/_dev/design-system` vẫn mở được và vẫn đủ 60 component.
- Không route nào trắng màn hay nháy lúc chuyển.

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| `Suspense` fallback nháy ở máy nhanh | Fallback là khối trống, không spinner. Chunk trên mạng LAN về gần như tức thì |
| Lỗi tải chunk khi vừa deploy bản mới lúc người dùng đang mở tab cũ | Ngoài phạm vi. Ghi vào câu hỏi treo — cách xử lý chuẩn là bắt lỗi lazy rồi `location.reload()` |
| `manualChunks` chia tay làm chậm hơn | Chỉ đụng tới nếu số đo ở bước 5 đòi hỏi |

## Tiếp theo

Chặng 06 — [Dọn vặt & nhất quán](phase-06-consistency-cleanup.md).
