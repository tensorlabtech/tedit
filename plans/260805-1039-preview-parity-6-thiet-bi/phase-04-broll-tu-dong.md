# Phase 04 — B-roll tự động theo pack (ô `phu`)

## Overview
- **Ưu tiên:** Trung bình-cao (hoàn tất lớp bố cục; phân biệt với insert thủ công đã có)
- **Trạng thái:** Chưa bắt đầu
- **Mô tả:** Preview vẽ ô tư liệu `phu` của các bố cục hai-ô (`hai-o`, `vuong-ngang`,
  `ngang-vuong`) — b-roll TỰ ĐỘNG theo lịch, khác insert thủ công. Thiết bị #2.

## Key insights
- Có HAI hệ b-roll: (1) insert thủ công (`insert.shape`, editor đã dựng); (2) b-roll
  tự động theo pack — ô `phu` lấy từ `media_files role='insert'`, xoay vòng theo màn.
  Phase này làm hệ (2), không đụng hệ (1).
- Ô `phu` chốt tỉ lệ bằng `settleAspect` theo tỉ lệ TỪNG tệp tư liệu (không theo video
  chính) — client phải biết `insertAspects` (Phase 02 đã trả trong endpoint).
- Mỗi màn có ô phu dùng tệp nào: trường `scene.insert` (chỉ số) — server đã tính, nằm
  trong `ScheduledScene` endpoint trả về. Client chỉ tra, không tự chọn.

## Requirements
- Bố cục hai-ô: vẽ cả ô chính (Phase 02/03) và ô phu, đúng z-order, đúng tỉ lệ
  `settleAspect`, đúng tệp theo `scene.insert`.
- Dự án chưa có tư liệu → ô phu biến mất, bố cục rơi về loại một-ô (giống server bỏ
  qua slot `phu` khi `!from`).
- Ô phu cũng nở-vào khi đổi màn (dùng chung motion Phase 03).

## Architecture
- Endpoint Phase 02 trả thêm `insertPaths`/`insertAspects` + `scene.insert`. Client
  cần URL xem được của tệp tư liệu → thêm đường serve (như media hiện có).
- `useSceneLayout` mở rộng: với slot `role='phu'`, gọi `settleAspect` (client) rồi
  `slotPixels` theo `insertAspects[which]`. Tra tệp theo `scene.insert`.
- `<StylePage>` render thêm `<video>`/`<img>` cho ô phu, z-order theo `slot.z`.

## Related code files
- Đọc: `server/layout-render.ts:308-418` (nhóm slot phu, settleAspect, loop tệp),
  `server/pipeline.ts:1099-1152` (insertPaths, insertAspects)
- Sửa: `src/routes/editor/use-scene-layout.ts` (nhánh slot phu);
  `src/dev/overlays/style-page.tsx` (render ô phu);
  `server/routes/scene-schedule-route.ts` (trả URL tư liệu xem được);
  `src/lib/api.ts` nếu cần đường media

## Implementation steps
1. Bổ sung endpoint trả URL tư liệu (xem được ở client) + `insertAspects` + `scene.insert`.
2. `useSceneLayout`: xử slot `phu` — `settleAspect` + `slotPixels` theo tỉ lệ tệp.
3. `<StylePage>` render ô phu đúng z-order + bo góc + motion Phase 03.
4. Ca chưa có tư liệu: ẩn ô phu, không vẽ ô đen (khớp server `!from`).
5. Đối chiếu mắt bản có ≥2 tệp tư liệu trên bố cục hai-ô.

## Todo
- [ ] Endpoint trả URL tư liệu + aspect + `scene.insert`
- [ ] `settleAspect`+`slotPixels` cho ô phu ở client
- [ ] Render ô phu trong `<StylePage>` (z-order, bo góc, motion)
- [ ] Ca chưa có tư liệu → ẩn ô phu
- [ ] Đối chiếu mắt
- [ ] Case parity ô phu (bàn giao Phase 06)

## Success criteria
- Bố cục hai-ô ở editor hiện đúng ô người + ô tư liệu, đúng tỉ lệ/tệp/chỗ như export.
- Dự án chưa có tư liệu → bố cục hai-ô tự thành một-ô (không ô đen).

## Risk
- Nhầm hai hệ b-roll → ghi rõ trong code đây là b-roll TỰ ĐỘNG, tách khỏi insert thủ công.
- Tỉ lệ ô phu dùng nhầm tỉ lệ video chính → bám `insertAspects[which]` như server.

## Next
Còn Phase 05 (tách nền người) độc lập; Phase 06 chốt parity toàn bộ.
