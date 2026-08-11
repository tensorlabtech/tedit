# Roadmap nghiêm túc — Remotion thành máy vẽ DUY NHẤT, bỏ ffmpeg compositing

**Quyết định:** chuyển hẳn export sang Remotion; **xoá tầng dựng hình ffmpeg**
(`burnElements` + `layout-render` + drawtext caption + các *Steps* look). ffmpeg
GIỮ phần tiền xử lý: `buildMaster` (base.mp4), `cutRanges` (cắt), sinh subject mask
(MediaPipe), và mux audio cuối.

**Nguyên tắc:** parity TRƯỚC, xoá SAU. Không gỡ ffmpeg compositing tới khi Remotion
khớp cả HAI style (Phấn + Nhịp-đen) trên fair A/B.

## Đã xong (7 commit)
Payload thật + cells geometry + phụ đề (OverlayTextBlock) + paper-grain + doodle.
Fair A/B (export cùng data) khớp lõi Phấn: t=21/30/45.

## Phase A — Hoàn tất mọi tầng compositing trong Remotion
Mục tiêu: Remotion vẽ ĐỦ mọi thứ `burnElements` vẽ, CẢ HAI style.
- A1. **behindText** mở màn (ghép mask người — chữ hở quanh người). Phấn.
- A2. **Junction** chuyển cảnh (zoom-in/cross-fade/…): đọc bảng `effects` → payload
  → transform video theo `pulse(t)`. Cả hai style.
- A3. **Grid nền** (Nhịp-đen `luoi-ba`) + **plate/graphics/wrap** (reuse component
  overlay có sẵn; asset qua `staticFile`).
- A4. **Nhịp-đen end-to-end**: chạy 1 project Nhịp-đen qua Remotion, fair A/B.

## Phase B — Audio
- Giữ `mixMusic` ffmpeg (đơn giản, không ducking) HOẶC `<Audio>` Remotion + audio
  gốc `<Video>`. Chốt: **mux ffmpeg** cho chắc — Remotion xuất hình câm, ffmpeg ghép
  tiếng (đúng như export tách bước tiếng hiện tại).

## Phase C — Fidelity parity (fair A/B tới khi khớp)
- C1. **Band caption**: Remotion ngồi thấp/giữa hơn export → nắn về đúng dải.
- C2. **Nghiêng ô**: khớp góc/pha với export.
- C3. **Màu**: color-range (tv/full) khi encode.
- C4. Harness diff-frame tự động (SSIM) trên vài project mỗi style.

## Phase D — Tích hợp production
- D1. `buildRemotionPayload` + `@remotion/renderer` (bundle 1 lần, render nhiều).
- D2. Cắm vào hàng đợi `jobs` (thay nhánh burn của `runExport`).
- D3. **Cờ engine** (`ffmpeg` | `remotion`) để chạy song song + rollback.
- D4. Đo tốc độ/bộ nhớ thật; concurrency.

## Phase E — Cutover + XOÁ cũ (chỉ khi C xanh cả hai style)
- E1. Đổi mặc định sang Remotion.
- E2. Sau thời gian tin cậy → **xoá** `burnElements`, phần compositing của
  `layout-render.ts`, drawtext caption trong `render.ts`, các `*Steps` look
  (graphics/doodle/sweep/plate/wrap/subjectEdge) — chúng đã sống trong React.
- E3. Dọn: guard `import.meta.glob` thành lớp asset chuẩn; gỡ code chết; cập nhật docs.

## Thứ tự chạy
A1 → A2 → A3 → A4 → B → C → D → E. Mỗi bước: render + fair A/B tự soi + commit.
Xoá (E) là CUỐI, sau khi cả hai style khớp.

## Rủi ro
- Tốc độ Remotion (~2.5'/63s đơn luồng) → concurrency ở D4.
- Mask compositing (behindText, subject) trên Chromium — kỹ thuật canvas/mask-image.
- Nhịp-đen chưa chạy thử — có thể lộ tầng mới (grid, sweep, grade).
