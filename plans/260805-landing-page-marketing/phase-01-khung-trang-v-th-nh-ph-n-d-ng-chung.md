---
phase: 1
title: Khung trang và thành phần dùng chung
status: completed
priority: P1
effort: 3h
dependencies: []
---

# Phase 1: Khung trang và thành phần dùng chung

## Overview
Đặt nền cho landing cuộn dài: đổi container từ 1-card sang trang cuộn, dựng nav sticky,
và 2 thành phần tái dùng mọi section sẽ cần — khung "cửa sổ app" mock và hook animation vào tầm nhìn.

## Requirements
- Functional: trang `/` (chưa đăng nhập) cuộn dọc được, nền `bg-background`, nav dính trên khi cuộn.
- Functional: `AppWindowMock` — khung cửa sổ app tái dùng, dựng bằng design system, dễ thay ảnh thật sau.
- Functional: `use-in-view` — hook IntersectionObserver bật class fade/slide khi phần tử vào tầm nhìn.
- Non-functional: không kéo thư viện animation ngoài; giữ tông Nova; hạn chế inline class.

## Architecture
`landing-page.tsx` đổi vai: từ nơi vẽ toàn bộ 1 card → nơi compose các section + giữ state lỗi
sign-in (ERROR_TEXT, backTo, error param — giữ nguyên logic hiện có) rồi truyền xuống hero + final-cta.
Container ngoài bỏ `h-svh overflow-hidden`, cho cuộn tự nhiên. Nav là component riêng, `sticky top-0`,
nền `bg-background/80 backdrop-blur` khi cuộn. `AppWindowMock` nhận `children` để mỗi section nhét nội
dung mock riêng vào khung chung (thanh tiêu đề giả + viền `border-border`). `use-in-view` trả `ref` +
`inView` để section tự gắn.

## Related Code Files
- Modify: `src/routes/landing/landing-page.tsx` — rút gọn thành shell compose + giữ state sign-in.
- Create: `src/routes/landing/landing-nav.tsx` — nav sticky (logo + theme toggle + nút Đăng nhập).
- Create: `src/routes/landing/app-window-mock.tsx` — khung cửa sổ app tái dùng.
- Create: `src/hooks/use-in-view.ts` — hook IntersectionObserver.
- Đọc tham chiếu: `src/components/app-logo.tsx`, `src/components/theme-toggle.tsx`, `src/components/ui/button.tsx`.

## Implementation Steps
1. Viết `use-in-view.ts`: nhận `{ once?: boolean; rootMargin?: string }`, trả `[ref, inView]`.
   Mặc định `once: true` (không tái kích hoạt khi cuộn qua lại).
2. Viết `app-window-mock.tsx`: khung bo góc `rounded-lg border border-border`, thanh tiêu đề giả
   (3 chấm + nhãn tuỳ chọn), vùng nội dung nhận `children`. Không tự chế viền đậm hơn `border-border`.
3. Viết `landing-nav.tsx`: `sticky top-0 z-10`, `AppLogo` trái, `ThemeToggleIcon` + Button "Đăng nhập"
   phải (cuộn mượt tới hero/CTA hoặc gọi sign-in — chốt ở phase 2). Nút icon-only phải có tooltip.
4. Sửa `landing-page.tsx`: bỏ `h-svh overflow-hidden`, giữ ERROR_TEXT/backTo/message, dựng khung
   `<div className="bg-background text-foreground"><LandingNav/>{sections}</div>`; tạm chèn Hero cũ
   để trang vẫn chạy. Truyền `{ backTo, message, setFailure }` xuống section (định hình prop cho phase 2).
5. `npm run typecheck && npm run lint` — sửa hết lỗi.

## Success Criteria
- [ ] `/` (chưa đăng nhập) cuộn được, nav dính trên, không vỡ layout.
- [ ] `AppWindowMock` và `use-in-view` build sạch, dùng thử được trong 1 section.
- [ ] `landing-page.tsx` vẫn giữ nguyên hành vi sign-in + báo lỗi hiện có.
- [ ] typecheck + lint pass.

## Risk Assessment
- Bỏ `overflow-hidden` có thể lộ scroll ngang nếu section tràn — canh `max-w`/`overflow-x-hidden` ở container.
- Đổi cấu trúc file có thể làm rớt logic backTo (chống open-redirect) — giữ nguyên khối kiểm `startsWith("/")`.
