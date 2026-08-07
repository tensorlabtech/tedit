---
phase: 2
title: Hero và Cách hoạt động
status: completed
priority: P1
effort: 4h
dependencies:
  - 1
---

# Phase 2: Hero và Cách hoạt động

## Overview
Hai section mạnh nhất: Hero (điểm chạm đầu + CTA sign-in) và Cách hoạt động (kể đúng luồng
sản phẩm — thứ thuyết phục nhất). Dùng `AppWindowMock` + `use-in-view` từ phase 1.

## Requirements
- Functional: Hero giữ h1 + mô tả hiện có, `GoogleSignInButton` + dòng invite-only + báo lỗi.
- Functional: Hero visual = `AppWindowMock` mock waveform + dòng chữ chạy theo tiếng.
- Functional: Cách hoạt động = 4 nhịp đánh số (Tải bản ghi → Máy chép lời + cắt lặng + gieo chữ →
  Soát & sửa chỗ cần → Xuất video), mỗi nhịp 1 mock nhỏ, fade/slide khi vào tầm nhìn.
- Non-functional: `DevSignIn` giữ nguyên (chỉ hiện ở DEV), đặt dưới CTA hero.

## Architecture
`hero.tsx` nhận `{ backTo, message, setFailure }` từ page (không tự quản state lỗi — nguồn sự thật
ở page để hero và final-cta không lệch nhau). Badge "Bản thử nội bộ" (trung thực, giữ). `how-it-works.tsx`
dữ liệu-driven: mảng 4 nhịp `{ n, title, desc, mock }` render qua `.map`, không lặp JSX. Mỗi nhịp bọc
`use-in-view` để fade khi cuộn tới.

## Related Code Files
- Create: `src/routes/landing/sections/hero.tsx`
- Create: `src/routes/landing/sections/how-it-works.tsx`
- Modify: `src/routes/landing/landing-page.tsx` — thay Hero tạm bằng section thật, chèn how-it-works.
- Đọc tham chiếu: `src/components/google-sign-in-button.tsx`, `src/routes/landing/dev-sign-in.tsx`,
  `server/flow-steps.ts` (nguồn 7 bước để rút thành 4 nhịp cho chuẩn).

## Implementation Steps
1. Viết `hero.tsx`: layout 2 cột trên desktop (chữ + CTA trái, `AppWindowMock` phải), 1 cột trên mobile.
   Giữ nguyên chuỗi h1/mô tả/dòng invite-only từ `landing-page.tsx` cũ. Chèn `DevSignIn` dưới cùng.
2. Dựng nội dung mock hero trong `AppWindowMock`: thanh waveform (khối `bg-muted` cao thấp) + 1-2 dòng
   chữ mô phỏng "chữ chạy theo tiếng" (1 tiếng nổi bật bằng `text-primary`). Tĩnh hoặc fade nhẹ.
3. Viết `how-it-works.tsx`: mảng 4 nhịp, render số thứ tự + tiêu đề + mô tả + mock nhỏ. Bọc `use-in-view`.
   Rút 7 bước `flow-steps.ts` → 4 nhịp cho khớp sản phẩm thật.
4. Ghép vào `landing-page.tsx`, kiểm cuộn + báo lỗi sign-in vẫn chạy.
5. `npm run typecheck && npm run lint`.

## Success Criteria
- [ ] Hero hiện đúng h1/mô tả/CTA; bấm Google chạy sign-in; lỗi hiện đúng chỗ; DevSignIn chỉ ở DEV.
- [ ] Cách hoạt động hiện 4 nhịp đúng luồng sản phẩm, fade khi cuộn tới.
- [ ] Không lặp JSX cho 4 nhịp (data-driven).
- [ ] typecheck + lint pass.

## Risk Assessment
- Mock quá "thật" gây hiểu nhầm là ảnh sản phẩm — giữ mức sơ đồ/khung, không giả làm screenshot thật.
- 2 cột dễ vỡ trên màn hẹp — kiểm breakpoint, cột dồn 1 hàng dọc ở mobile.
