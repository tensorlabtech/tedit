---
phase: 3
title: Tính năng Triết lý Xem thử
status: completed
priority: P2
effort: 3h
dependencies:
  - 1
---

# Phase 3: Tính năng — Triết lý — Xem thử

## Overview
Ba section thân bài: lưới Tính năng, khối nhấn Triết lý, và khung mock lớn Xem thử.
Không phụ thuộc phase 2 (chỉ cần thành phần dùng chung ở phase 1) — có thể làm song song với phase 2.

## Requirements
- Functional: Tính năng = lưới `Card` (6 mục): chép lời chuẩn dấu · chữ chạy theo tiếng · cắt quãng lặng ·
  tư liệu chèn (b-roll) · nhạc nền · bộ dáng chữ. Mỗi card: icon lucide + tiêu đề + 1 dòng.
- Functional: Triết lý = khối nhấn "Máy làm nháp, bạn tinh chỉnh" — không thay người, chỉ bỏ phần nhàm.
- Functional: Xem thử = 1 `AppWindowMock` lớn (placeholder có nhãn "Bản xem thử"), fade khi vào tầm nhìn.
- Non-functional: KHÔNG bịa số liệu/testimonial ở bất kỳ section nào.

## Architecture
`features.tsx` data-driven: mảng `{ icon, title, desc }` render qua `.map` vào `Card` — không lặp JSX,
không tự chế viền (dùng `Card` mặc định). `philosophy.tsx` là 1 khối text căn giữa, có thể kèm mock phụ.
`demo.tsx` chỉ là `AppWindowMock` cỡ lớn bọc `use-in-view`. Tất cả canh `max-w` cho dễ đọc, `bg-background`.

## Related Code Files
- Create: `src/routes/landing/sections/features.tsx`
- Create: `src/routes/landing/sections/philosophy.tsx`
- Create: `src/routes/landing/sections/demo.tsx`
- Modify: `src/routes/landing/landing-page.tsx` — chèn 3 section đúng thứ tự.
- Đọc tham chiếu: `src/components/ui/card.tsx`, icon từ `lucide-react`.

## Implementation Steps
1. `features.tsx`: định nghĩa mảng 6 tính năng (icon lucide phù hợp: `Captions`, `Scissors`, `Film`,
   `Music`, `Type`, `SpellCheck`...), render lưới responsive (`grid` 1/2/3 cột theo breakpoint).
2. `philosophy.tsx`: khối căn giữa, tiêu đề lớn + 1 đoạn, tông trầm. Có thể kèm mock phụ minh hoạ.
3. `demo.tsx`: `AppWindowMock` cỡ lớn, nhãn "Bản xem thử", nội dung mock tối giản. Bọc `use-in-view`.
4. Chèn 3 section vào `landing-page.tsx` theo thứ tự (features → philosophy → demo).
5. `npm run typecheck && npm run lint`.

## Success Criteria
- [ ] Lưới tính năng 6 mục, responsive, mỗi mục có icon + tiêu đề + mô tả; không lặp JSX.
- [ ] Triết lý và Xem thử hiện đúng, fade khi cuộn tới.
- [ ] Không có số liệu/nhận xét bịa ở bất kỳ đâu.
- [ ] typecheck + lint pass.

## Risk Assessment
- Lưới card dễ lệch chiều cao nếu mô tả dài ngắn khác nhau — dùng `items-stretch`, mô tả gọn 1 dòng.
- Cám dỗ thêm "social proof" cho đầy trang — chủ động bỏ, giữ trung thực invite-only.
