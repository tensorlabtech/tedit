# Phase 01 — Vệt quét: twin CSS

## Overview
- **Ưu tiên:** Cao (khởi động — xác lập mẫu twin + đường parity trước khi vào mảng lớn)
- **Trạng thái:** Chưa bắt đầu
- **Mô tả:** Dựng bản sinh đôi CSS của `sweepSteps` cho editor preview. Thiết bị #5.

## Key insights
- Vệt quét là overlay ĐƠN: một dải sáng chạy ngang khung theo thời gian — không đụng
  bố cục khung, không cần tách nền. Vì thế nó là chỗ rẻ nhất và an toàn nhất để lập
  mẫu "twin CSS + kiểm parity" trước khi làm engine bố cục.
- Server sinh vệt quét ở `sweepSteps` (`server/style-pack.ts` họ `*Steps`), lái bởi
  `pack.sweep`. Twin chỉ cần đọc CÙNG `pack.sweep` và tái dựng bằng CSS.

## Requirements
- Vệt quét hiện đúng số bộ dáng có `pack.sweep`, đúng tần suất/màu/độ nghiêng.
- Chạy trên đồng hồ preview (`use-preview-playback.ts`), khớp mốc với export.
- Không tạo scrollbar, không tràn ring/border của Card (CLAUDE.md dự án).

## Architecture
- Đọc `pack.sweep` (đã có trong StylePack). Suy mốc quét trong màn từ cùng luật server
  (mỗi N giây một vệt) — nếu luật nằm trong `sweepSteps`, tách phần TÍNH MỐC ra một
  hàm thuần dùng chung cho cả server và client (nguyên tắc 2 của plan).
- Component `<StyleSweep pack seconds frame>` trong `src/dev/overlays/` — cùng chỗ
  `StyleGraphics`/`Headline`. Dùng CSS `linear-gradient` + `transform: translateX` +
  `mix-blend-mode` cho ánh sáng.

## Related code files
- Đọc: `server/style-pack.ts` (`sweepSteps`, `pack.sweep`), `server/render.ts:1322`
- Tạo: `src/dev/overlays/style-sweep.tsx`
- Sửa: `src/routes/editor/preview-panel.tsx` (render `<StyleSweep>` trong `<ContentRect>`)
- Có thể tách: hàm tính mốc quét dùng chung → `server/sweep-schedule.ts` (nếu cần)

## Implementation steps
1. Đọc `sweepSteps` xác định: nguồn mốc, hình dạng dải, màu, độ nghiêng, thời lượng vệt.
2. Nếu mốc tính trong `sweepSteps`, tách ra hàm thuần `sweepMarks(pack, seconds)`.
3. Viết `<StyleSweep>` tái dựng bằng CSS từ cùng số liệu.
4. Cắm vào `preview-panel.tsx` đúng z-order (trên video, dưới/ngang hình dán — soi
   thứ tự `filters.push` ở `render.ts` để khớp).
5. So mắt trên một bộ có sweep (vd Sóng) tại vài mốc.

## Todo
- [ ] Xác định nguồn mốc + tách `sweepMarks` nếu cần
- [ ] `style-sweep.tsx`
- [ ] Cắm vào preview-panel đúng z-order
- [ ] Đối chiếu mắt
- [ ] Ghi case vào parity harness (bàn giao Phase 06)

## Success criteria
- Bộ có `sweep` hiện vệt quét ở editor preview; bộ không có thì không hiện.
- Mốc + hình dạng khớp export trong sai số parity Phase 06 đặt.

## Risk
- Mốc quét tính hai nơi lệch nhau → tách hàm thuần dùng chung (nguyên tắc 2).
- `mix-blend-mode` khác nhau giữa trình duyệt → chọn blend an toàn, kiểm ở target thật.

## Next
Bàn giao "mẫu twin + case parity" cho Phase 02 và Phase 06.
