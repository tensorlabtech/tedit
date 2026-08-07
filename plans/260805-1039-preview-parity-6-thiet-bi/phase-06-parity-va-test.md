# Phase 06 — Mở rộng harness parity + test toàn 6

## Overview
- **Ưu tiên:** Cao (thứ BẢO ĐẢM sáu twin không lệch export — không có nó thì mọi phase
  trên chỉ "trông đúng")
- **Trạng thái:** Chưa bắt đầu
- **Mô tả:** Mở rộng `scripts/overlay-parity/` để kiểm số sáu thiết bị mới, đóng vòng.

## Key insights
- Dự án đã có nếp parity: `dump-server-layout.ts` xuất hình học server, `parity-page.html`
  dựng client headless, `check-overlay-parity.py` so số. Sáu twin đi theo đúng nếp này,
  không đẻ cơ chế mới.
- Parity là cái khiến "hai đường vẽ khớp" thành luật có phép kiểm, không phải lời hứa —
  đúng triết lý `layout-render.ts`/`overlay-parity` hiện có.

## Requirements
- Mỗi thiết bị dựng được (01–04, và 05 nếu lối A) có ca parity: server dump vs client
  render, sai số dưới ngưỡng đặt.
- Thiết bị "gần đúng" (05 lối B/C) ghi rõ là NGOÀI parity pixel, có lý do.
- Chạy được trong `check:layout` (hoặc script tương đương) để CI bắt lệch.

## Architecture
- Mở rộng `dump-server-layout.ts` xuất: box ô mỗi màn tại mốc lấy mẫu, box ô phu, hệ số
  đà/push tại t, dải vệt quét. Cùng khuôn dump đang có.
- `parity-page.html` (hoặc trang mới) dựng `<StylePage>`/`<StyleSweep>` với cùng input,
  đọc DOM ra box thật.
- `check-overlay-parity.py` thêm case cho từng thiết bị, ngưỡng theo loại (tĩnh chặt,
  động lỏng hơn).

## Related code files
- Đọc: `scripts/overlay-parity/dump-server-layout.ts`, `parity-page.html`,
  `check-overlay-parity.py`, `parity-cases.ts`
- Sửa: cả bốn file trên (thêm ca cho 6 thiết bị)
- Tạo: ca mẫu trong `parity-cases.ts` cho bố cục/sweep/motion/push/ô phu

## Implementation steps
1. Thu case từ Phase 01–05 (mỗi phase bàn giao một ca).
2. Mở rộng `dump-server-layout.ts` xuất số cho từng thiết bị.
3. Dựng client headless đọc box thật từ `<StylePage>`/twin.
4. Thêm assert + ngưỡng vào `check-overlay-parity.py`.
5. Nối vào lệnh kiểm chung; xác nhận CI đỏ khi cố tình lệch một hằng.

## Todo
- [ ] Gom ca từ 01–05
- [ ] Mở rộng `dump-server-layout.ts`
- [ ] Client headless đọc box
- [ ] Assert + ngưỡng trong checker
- [ ] Nối `check:layout`, thử lệch-thì-đỏ
- [ ] Ghi thiết bị "gần đúng" (05 lối B/C) ra ngoài parity pixel, kèm lý do

## Success criteria
- Sáu thiết bị (trừ ca "gần đúng" ghi rõ) qua parity dưới ngưỡng.
- Cố tình đổi một hằng geometry → checker đỏ.

## Risk
- Đà (motion) khó khớp pixel tuyệt đối → ngưỡng động lỏng hơn tĩnh, kiểm ở vài mốc t
  cố định thay vì mọi khung.

## Next
Đóng plan. Cập nhật `docs/` nếu editor preview đổi hành vi đáng kể (docs-manager).
