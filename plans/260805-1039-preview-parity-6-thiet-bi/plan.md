# Preview parity — 6 thiết bị server burn mà editor chưa dựng

## Vấn đề

Editor preview trung thực ở lớp "dán đè lên khung" (chữ, tiêu đề, khung, hình dán,
chuyển cảnh, màu) nhưng **mù ở lớp "định hình khung"**. Sáu thiết bị server `render.ts`
burn ra mà client không có renderer:

| # | Thiết bị | Server burn | Nhóm gốc |
|---|---|---|---|
| 1 | Bố cục cảnh (nền trang + video-vào-ô + lịch màn) | `layoutPlan` | A — engine bố cục |
| 2 | B-roll tự động theo pack (ô `phu`) | `layoutPlan` slot phu | A |
| 6 | Máy quay dồn (`scenePush`) | `pushFactor` | A |
| 3 | Chữ sau người (`chu-sau-nguoi`) | `render.ts` behind | B — tách nền người |
| 4 | Viền người (`vien-nguoi`) | `subjectEdgeSteps` | B |
| 5 | Vệt quét (`vet-quet`) | `sweepSteps` | C — overlay đơn |

## Nguyên tắc kiến trúc (xuyên suốt mọi phase)

1. **Một nguồn sự thật cho LỊCH.** `scheduleScenes` phụ thuộc mốc trong DB → server
   tính MỘT lần, trả về `ScheduledScene[]`. Client KHÔNG tự xếp lịch (tránh drift).
2. **Hình học là hàm thuần chia sẻ.** Client import thẳng `slotPixels`/`settleAspect`
   (đã pure + export) gọi ở khổ preview — cùng hàm với export nên không lệch.
3. **Twin CSS, không phải chuỗi ffmpeg.** `layout-render.ts` sinh filter ffmpeg; client
   cần bản sinh đôi dựng bằng CSS transform/clip — cùng số liệu, khác đầu ra.
4. **Parity có phép kiểm.** Mọi twin phải qua `scripts/overlay-parity/` (mở rộng
   `dump-server-layout.ts`) — cùng lối đã dùng cho chữ và khung.

## Các phase

| Phase | Nội dung | Thiết bị | Trạng thái |
|---|---|---|---|
| [01](phase-01-vet-quet-twin.md) | Vệt quét — twin CSS overlay đơn | #5 | ✅ xong |
| [02](phase-02-engine-bo-cuc-tinh.md) | Engine bố cục TĨNH — schedule endpoint + nền trang + video-vào-ô | #1 | ✅ xong |
| [03](phase-03-doi-bo-cuc-co-da-va-push.md) | Đổi bố cục có đà (glide/ease) + máy quay dồn | #1, #6 | ✅ xong |
| [04](phase-04-broll-tu-dong.md) | B-roll tự động theo pack (ô `phu` + insert media) | #2 | ✅ xong |
| [05](phase-05-tach-nen-nguoi.md) | Tách nền người — **lối C**: nhãn "hiện ở bản xuất" | #3, #4 | ✅ xong (lối C) |
| [06](phase-06-parity-va-test.md) | Harness parity `check:scene-preview` (thuần số, không cần trình duyệt) | tất cả | ✅ xong |

## Đã làm (260805)

**Server:** `layout-heroes.ts` (tách chung), `scene-schedule.ts` (`buildSceneSchedule`),
`routes/scene-schedule-routes.ts` (`GET /api/projects/:id/scene-schedule`), export
`entryOf`/`RAMP`/`PUSH_MAX` từ `layout-render.ts` (chỉ thêm `export`, ffmpeg bất biến).

**Client:** `dev/overlays/style-sweep.tsx` (vệt quét), `dev/overlays/scene-page.tsx`
(nền trang), `editor/scene-layout-geometry.ts` (`sceneCells` — ô chính+phụ, đà+push+
settleAspect), `editor/use-scene-layout.ts` (hook), `api.sceneSchedule`. `preview-panel.tsx`
cắm cả sáu lớp.

**Kiểm:** `check:scene-preview` (6 đạt), typecheck/lint/build/check:layout/slots/style-pack/
graphics đều EXIT 0.

**Còn lại (thủ công):** xem mắt trên dự án THẬT trong editor (bản dựng này chỉ verify
tới mức compile+build+parity-số, chưa chạy live với `base.mp4`). Và nếu sau cần preview
động cho chữ-sau-người/viền-người thì nâng Phase 05 lên lối B (segmentation client).

## Thứ tự đề xuất (wow ÷ công)

`01` (khởi động, rẻ) → `02`+`03`+`04` (mảng lớn nhất, đúng hướng Pulse) → `05`
(khó nhất, cần mask) → `06` (chốt parity). Phase 01, 02, 05 độc lập nhau — chạy
song song được nếu chia người.

## Ràng buộc

- Không HTML chay, dùng design system (CLAUDE.md dự án).
- Tên hàm/biến/đường dẫn full English; chỉ text UI tiếng Việt.
- File < 200 dòng — tách module khi cần.
- Không tham chiếu số phase trong comment code (rule review-audit).

## Rủi ro chính

- **R1 — hai đường geometry drift.** Giảm bằng nguyên tắc 1+2: lịch từ server, hình
  học từ hàm chung. Phase 06 kiểm số.
- **R2 — tách nền người ở client đắt.** Phase 05 tách riêng, có thể hoãn nếu #3/#4
  quá tốn so với lợi (chúng là thiết bị nổi ít bộ dùng).
- **R3 — editor-data.ts hiện là seed mock.** Cần xác nhận preview chạy trên dự án
  thật hay seed trước khi nối schedule endpoint (Phase 02 mở đầu).
