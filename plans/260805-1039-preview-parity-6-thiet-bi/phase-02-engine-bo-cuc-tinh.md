# Phase 02 — Engine bố cục TĨNH (nền trang + video-vào-ô)

## Overview
- **Ưu tiên:** Cao nhất (mảng lõi, đúng hướng Pulse/Nhịp đen bạn đang theo đuổi)
- **Trạng thái:** Chưa bắt đầu
- **Mô tả:** Cho editor preview vẽ được nền trang + video thu vào ô theo lịch màn, ở
  trạng thái TĨNH (chưa animation). Thiết bị #1 phần tĩnh.

## Key insights
- Đây là lớp "định hình khung": pack có `page` (Nhịp đen, và mọi bộ có nền trang) bẻ
  video phủ-kín thành ô trên nền trang. Editor hiện luôn hiện video phủ kín → sai hẳn
  khung hình cho các bộ này.
- `slotPixels`, `layoutAt`, `findLayout`, `settleAspect` đã PURE + export → client
  import thẳng (preview-panel đã import module server sẵn). Không port.
- `scheduleScenes` phụ thuộc mốc DB → **server phải trả lịch**, client không tự xếp.

## Requirements
- Preview đứng ở giây t: nếu pack có `page`, vẽ nền trang (màu + lưới) rồi đặt video
  vào ô của bố cục đang chạy tại t, tỉ lệ bám nguồn — đúng `slotPixels`.
- Pack không có `page` (bộ phủ kín) → giữ nguyên hành vi cũ (video object-cover).
- Không drift với export: lịch từ server, hình học từ hàm chung.

## Architecture
- **Server: endpoint lịch.** `GET /api/projects/:id/scene-schedule` trả
  `{ schedule: ScheduledScene[], sourceAspect, insertAspects, page }` — tính bằng
  CHÍNH đường `pipeline.ts:1118` (tách phần dựng `wish` + gọi `scheduleScenes` ra một
  hàm dùng chung để export và endpoint gọi cùng một chỗ). Một nguồn sự thật cho lịch.
- **Client: geometry twin.** Hook `useSceneLayout(schedule, seconds)` → tìm scene tại
  t (`layoutAt`), lấy slots, gọi `slotPixels` ở khổ preview → trả box mỗi ô + rect nền.
- **Client: render.** Component `<StylePage>` (nền trang: màu + lưới PNG qua `<img>`
  hoặc CSS) + đặt `<video>` theo box ô (CSS `position/width/height` + `object-cover`
  cho phép crop giữa như `cropExpr`), bo góc theo mask `o-bo-goc`.

## Related code files
- Đọc: `server/layout-kinds.ts` (`slotPixels`, `findLayout`), `server/layout-schedule.ts`
  (`scheduleScenes`, `layoutAt`), `server/layout-render.ts` (thứ tự lớp, nền trang),
  `server/pipeline.ts:1082-1152` (dựng wish + marks)
- Tạo: `server/routes/scene-schedule-route.ts` (hoặc thêm vào routes có sẵn);
  `src/dev/overlays/style-page.tsx`; `src/routes/editor/use-scene-layout.ts`
- Sửa: `server/pipeline.ts` (tách hàm `buildSceneSchedule(projectId)` dùng chung);
  `src/routes/editor/preview-panel.tsx` (bọc video bằng `<StylePage>`+box khi có page);
  `src/lib/api.ts` (client gọi endpoint)

## Implementation steps
1. **Xác nhận R3:** preview chạy trên dự án thật hay `editor-data.ts` seed? Nếu seed,
   thêm đường lấy lịch cho dự án thật trước.
2. Tách `buildSceneSchedule(projectId)` từ `pipeline.ts` — trả lịch + inputs, export
   dùng chung với endpoint.
3. Viết endpoint + hàm `api.sceneSchedule(projectId)`.
4. `useSceneLayout` — map t → boxes bằng `slotPixels` (khổ preview).
5. `<StylePage>` vẽ nền trang; đặt video vào box; bo góc; bộ không `page` bỏ qua.
6. Cắm vào preview-panel: có `page` → dựng qua StylePage; không → nhánh cũ.
7. Đối chiếu mắt một bản Nhịp đen tại vài mốc bố cục khác nhau.

## Todo
- [ ] Xác nhận nguồn dữ liệu preview (R3)
- [ ] Tách `buildSceneSchedule` + endpoint + `api.sceneSchedule`
- [ ] `useSceneLayout`
- [ ] `<StylePage>` + đặt video theo box + bo góc
- [ ] Nhánh preview-panel theo `pack.page`
- [ ] Đối chiếu mắt Nhịp đen
- [ ] Case parity (bàn giao Phase 06)

## Success criteria
- Bộ Nhịp đen ở editor: nền trang + video trong ô, đổi ô theo màn — TĨNH nhưng đúng
  khổ/chỗ như export tại mọi mốc.
- Bộ phủ kín không đổi hành vi.

## Security
- Endpoint chỉ đọc, cần chặn theo chủ sở hữu dự án như route hiện có.

## Next
Phase 03 thêm chuyển động (glide/ease + push); Phase 04 thêm ô b-roll `phu`.
