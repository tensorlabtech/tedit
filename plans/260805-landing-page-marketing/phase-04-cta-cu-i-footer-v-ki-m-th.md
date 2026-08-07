---
phase: 4
title: CTA cuối Footer và kiểm thử
status: completed
priority: P2
effort: 2h
dependencies:
  - 2
  - 3
---

# Phase 4: CTA cuối — Footer — kiểm thử

## Overview
Đóng trang: CTA cuối lặp lời mời đăng nhập, footer, rồi rà toàn trang (build, cuộn, responsive,
animation, tự kiểm UI). Phụ thuộc phase 2 + 3 vì cần toàn bộ section đã có mặt để rà tổng thể.

## Requirements
- Functional: CTA cuối = tiêu đề mời + `GoogleSignInButton` + dòng invite-only trung thực (dùng lại
  state lỗi từ page, không quản riêng).
- Functional: Footer = `AppLogo` + liên kết fake (Giới thiệu · Điều khoản · Liên hệ, trỏ `#`) + bản quyền.
- Non-functional: animation fade/slide chạy êm, không giật; không scroll ngang; responsive mobile→desktop.

## Architecture
`final-cta.tsx` nhận `{ backTo, message, setFailure }` như hero — cùng nguồn state lỗi. `landing-footer.tsx`
tĩnh, tông trầm, liên kết fake đánh dấu rõ (chưa nối trang thật). `landing-page.tsx` khép lại: đủ 8 khối
(nav → hero → how-it-works → features → philosophy → demo → final-cta → footer).

## Related Code Files
- Create: `src/routes/landing/sections/final-cta.tsx`
- Create: `src/routes/landing/landing-footer.tsx`
- Modify: `src/routes/landing/landing-page.tsx` — chèn 2 khối cuối, rà thứ tự tổng thể.

## Implementation Steps
1. `final-cta.tsx`: khối căn giữa, tiêu đề "Sẵn sàng thử?" + `GoogleSignInButton` + dòng invite-only.
2. `landing-footer.tsx`: logo + 3 liên kết fake (`href="#"`) + dòng bản quyền. Nút/link đều `cursor-pointer`.
3. Ghép vào `landing-page.tsx`, xác nhận đủ 8 khối đúng thứ tự.
4. Chạy `npm run dev:all`, mở `/` (chưa đăng nhập): cuộn full, kiểm animation, thử co màn (mobile→desktop),
   xác nhận không scroll ngang. Chụp ảnh tự kiểm theo quy tắc báo cáo UI trong CLAUDE.md.
5. `npm run typecheck && npm run lint`. Cân nhắc chạy `npm run check:all` nếu đụng vùng có guard.

## Success Criteria
- [ ] Trang `/` đủ 8 khối, cuộn mượt, animation không giật, không scroll ngang.
- [ ] Responsive đẹp ở cả mobile và desktop.
- [ ] CTA cuối + hero dùng chung nguồn state lỗi sign-in, hành vi nhất quán.
- [ ] Ảnh tự kiểm khớp expect; typecheck + lint pass.

## Risk Assessment
- Liên kết footer fake `#` có thể nhảy trang — dùng `href="#"` + chặn mặc định hoặc `button` giả link.
- Animation trên thiết bị yếu có thể giật — giữ transform/opacity đơn giản, tránh animate layout.
