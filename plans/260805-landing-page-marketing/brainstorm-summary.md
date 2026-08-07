# Landing Page — Brainstorm Summary

Ngày: 2026-08-05. Trạng thái: đã chốt thiết kế, chờ lên kế hoạch.

## Vấn đề

Landing hiện tại (`src/routes/landing/landing-page.tsx`) là 1 Card phủ full màn, nội dung
tự nhận là "bản nháp chiếm chỗ". Cần dựng thành trang thật, chỉn chu, giới thiệu được
sản phẩm cho người mới.

Sản phẩm Tedit: biến **bản ghi → video có chữ chạy theo tiếng, có nhạc, có tư liệu chèn**.
Máy chép lời tiếng Việt, cắt quãng lặng, gieo chữ, dựng sẵn bản nháp → người chỉ sửa chỗ
cần. Luồng: Tải cảnh → Đề bài → Máy chuẩn bị → Cắt đoạn lỗi → Soát lời → Máy dựng nốt → Bàn dựng.

## Yêu cầu đã chốt (từ user)

- Trang **thật**, kết cấu **marketing cuộn dài**; phần chưa có thì **fake tạm** — chỉ áp cho
  ảnh/mock giao diện, KHÔNG áp cho số liệu/nhận xét.
- Phong cách **đồng bộ Nova** (design system, tông trầm) — vẫn đọc ra "cùng một sản phẩm" với app.
- Demo: **mock** dựng bằng design system / khung placeholder.
- CTA cho người lạ chưa có quyền: **chỉ nút đăng nhập + dòng giải thích** (không ô email).
- Animation: **tối giản** (fade/slide nhẹ khi section vào tầm nhìn).

## Ràng buộc

- `/` được CLAUDE.md **miễn trừ** khỏi luật bento/không-scrollbar → cuộn dài hợp lệ.
- Cửa vẫn **invite-only** ("Hiện chỉ mở cho tài khoản được cấp quyền") → CTA chính là gated sign-in.
- Dùng tối đa design system, hạn chế inline class/style. Code full tiếng Anh, UI tiếng Việt.
- File >200 dòng phải tách module (kebab-case).

## Blueprint (section theo thứ tự cuộn)

1. **Nav** (sticky, mỏng): `AppLogo` + `ThemeToggleIcon` + nút "Đăng nhập". Nền mờ khi cuộn.
2. **Hero**: badge "Bản thử nội bộ" → h1 hiện có → mô tả "máy làm nháp, bạn chỉ sửa chỗ cần" →
   `GoogleSignInButton` + dòng invite-only. Visual: khung "cửa sổ app" mock (waveform + chữ chạy).
3. **Cách hoạt động** (section mạnh nhất): 7 bước rút thành 4 nhịp —
   Tải bản ghi → Máy chép lời + cắt lặng + gieo chữ → Bạn soát & sửa → Xuất video. Mỗi nhịp 1 mock.
4. **Tính năng**: lưới `Card` — chép lời chuẩn dấu · chữ chạy theo tiếng · cắt quãng lặng ·
   tư liệu chèn · nhạc nền · bộ dáng chữ. Mỗi card: icon lucide + tiêu đề + 1 dòng.
5. **Triết lý**: khối nhấn "Máy làm nháp, bạn tinh chỉnh" — không thay người, chỉ bỏ phần nhàm.
6. **Xem thử**: 1 khung mock lớn (fake app window / placeholder có nhãn).
7. **CTA cuối**: lặp lời mời đăng nhập + dòng invite-only trung thực.
8. **Footer**: logo + liên kết fake (Giới thiệu · Điều khoản · Liên hệ) + bản quyền.

## Cấu trúc file (tách module)

```
src/routes/landing/
├── landing-page.tsx          # compose section + giữ state lỗi sign-in
├── landing-nav.tsx
├── sections/hero.tsx
├── sections/how-it-works.tsx
├── sections/features.tsx
├── sections/philosophy.tsx
├── sections/demo.tsx
├── sections/final-cta.tsx
├── landing-footer.tsx
└── app-window-mock.tsx       # khung cửa sổ app tái dùng cho mọi mock
```

Tái dùng: `AppLogo`, `GoogleSignInButton`, `ThemeToggleIcon`, `DevSignIn`, `Card`, `Badge`, `Button`.
Logic lỗi sign-in (ERROR_TEXT, backTo, error param) giữ ở `landing-page.tsx`, truyền xuống hero + final-cta.

## Cảnh báo (brutal honesty)

1. **KHÔNG bịa social proof** (số "đã dựng X video", testimonial giả) — invite-only beta, bịa sẽ
   mất uy tín và không trung thực. "Fake tạm" chỉ cho ảnh/mock giao diện.
2. Cuộn dài phá luật "không scrollbar" & 1-card của app — chấp nhận vì `/` được miễn trừ; giữ tông Nova.
3. CTA chính vẫn là cửa khoá — người lạ bấm sẽ bị chặn; dòng giải thích phải rõ ràng, trung thực.

## Điểm cần lưu khi triển khai

- Đổi container từ `h-svh overflow-hidden` (1 card) sang trang cuộn được — giữ `bg-background`,
  mỗi section canh chiều rộng nội dung (max-w) cho dễ đọc.
- `app-window-mock` là điểm tái dùng chính; dựng bằng design system, dễ thay ảnh thật sau.
- Animation: 1 hook nhỏ `use-in-view` (IntersectionObserver) + class fade/slide — không kéo thư viện nặng.
- `DevSignIn` giữ nguyên (chỉ hiện ở DEV), đặt dưới hero hoặc final-cta.

## Câu hỏi còn mở

- Chưa có: nội dung chữ chính thức cho từng section (dùng bản nháp tiếng Việt trong lúc dựng).
- Liên kết footer (Giới thiệu/Điều khoản/Liên hệ) trỏ đâu — hiện fake `#`, nối trang thật sau.
