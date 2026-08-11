# Hướng 3 — Một máy vẽ (Remotion): đồng bộ preview = export

**Ngày:** 2026-08-11 · **Trạng thái:** P0 (spike) + P1 (de-risk) ĐÃ XONG, có bằng chứng.

## Vấn đề

Preview (React/CSS) và export (ffmpeg filtergraph) là HAI máy vẽ → phải dịch tay,
sai số chỉ lộ khi xuất ("phải xuất mới biết"). CapCut/mọi NLE dùng MỘT engine cho
cả preview lẫn export. Remotion mang nguyên lý đó cho web: export = headless Chrome
chụp lại CHÍNH component React của preview → khớp từng pixel do bản chất.

## Đã chứng minh (P0 + P1)

- **P0a** — Remotion render mp4 1080×1920 trên máy này (headless Chrome OK). 4s ≈
  37s lạnh / vài giây nóng → 60s ≈ 1-2 phút. `src/remotion/spike-composition.tsx`.
- **P0b** — tái dùng component overlay THẬT (`Headline`) + font thật + Tailwind +
  import `server/style-pack` qua bundler Remotion. `spike-reuse-composition.tsx`.
  - **Ma sát duy nhất:** `import.meta.glob` (đặc thù Vite) crash cả module dưới
    webpack. Đã vá guard try/catch (`overlay-render.tsx`) — Vite vẫn băm URL (verify
    14→16 PNG vào dist), Remotion nhận bản đồ rỗng.
- **P1** — 3 hệ khó tái hiện bằng CSS/PNG, KHÔNG cần WebGL. `spike-hardfx-composition.tsx`.
  - ② viền giấy xé: `o-rach.png` làm `mask-image` + lớp vàng phóng 3% → **đẹp**.
  - ① grain-vào-alpha: `mask-image` luminance + `caption-grain.png` → chất phấn.
  - ③ glow: `drop-shadow(0 0 radiusPx)` khớp tham số glow bộ dáng.

**Kết luận:** hết ẩn số nghiên cứu. Còn lại là kỹ thuật.

## Kiến trúc

```
GIỮ ffmpeg (tiền xử lý, KHÔNG phải compositing):
  • buildMaster → base.mp4 + cắt đoạn (cutRanges)   [render.ts:323, 390]
  • sinh subject mask (MediaPipe Python)             [subject-mask.ts]
  • [chốt sau] mux nhạc cuối (mixMusic) — nghiêng GIỮ ffmpeg cho chắc

CHUYỂN sang Remotion (toàn bộ ~700 dòng burnElements):
  <VideoComposition/> ── tái dùng component preview (src/dev/overlays/*)
      ├─ <Player> trong trình duyệt = preview
      └─ @remotion/renderer chụp     = export
```

## Việc cốt lõi còn lại

1. **Lớp tải asset trung lập bundler** — đổi `import.meta.glob` → bản đồ dùng chung
   (staticFile-based) để cả Vite lẫn Remotion đọc graphic/mask giống nhau. Đây là
   nút chặn tái dùng ScenePage/graphics/doodle/wrap (những cái đụng glob).
2. **`<VideoComposition/>` đầy đủ** — drive theo `useCurrentFrame`/`interpolate`,
   dữ liệu từ `buildSceneSchedule` (đã có). Ghép mọi tầng theo thứ tự render.ts.
3. **Audio** — `<Audio>` per-track + audio gốc từ `<Video>`; hoặc giữ `mixMusic`
   ffmpeg (không có ducking nên cả hai đều dễ).
4. **Harness so khớp** — render cùng project 2 cách, diff frame, tinh chỉnh.
5. **Đổi mặc định** sang Remotion, ffmpeg sau cờ fallback.

## Phase

| Phase | Việc | Trạng thái |
|---|---|---|
| P0 | Spike render loop + reuse | ✅ XONG |
| P1 | De-risk 3 hệ khó | ✅ XONG |
| P2a | Cầu dữ liệu `buildRemotionPayload` + cells khớp geometry từ schedule THẬT | ✅ XONG (commit 52b0b93) |
| P2b | Phụ đề qua `OverlayTextBlock` (cùng component preview) | ✅ XONG (commit 87eff29) |
| P2c-1 | Hạt giấy (paper-grain) trên nền | ✅ XONG (8b4a97d) |
| P2c-2 | Doodle vàng quanh b-roll + asset public (staticFile) | ✅ XONG (d120234) |
| P2c-3 | Junction/sweep, behindText, plate/graphics/wrap, grid (Nhịp đen) | ⬜ |
| Ghi chú | Grade: Phấn `grade:null` → không cần; chênh màu A/B là color-range encode (P4) | — |
| P3 | Audio + nhạc | ⬜ |
| P4 | Harness so khớp ffmpeg, tinh chỉnh fidelity | ⬜ |
| P5 | Đổi mặc định + ffmpeg fallback sau cờ | ⬜ |

## Rủi ro / cần quyết

- **Tốc độ (ĐO THẬT)**: 63s video @1080×1920 = **~2.5 phút** render đơn luồng (1900 frame,
  ~13 frame/s). Với `--concurrency` nhiều lõi sẽ nhanh hơn. Chấp nhận được cho hàng đợi nền.
- **Tốc độ** so ffmpeg: ffmpeg thô nhanh hơn; cân concurrency/đám mây nếu cần.
- **Hạ tầng**: headless Chrome trên máy chủ (Remotion tự tải Chromium).
- **Audio ducking**: hiện KHÔNG có → không phải lo ngay.
- **Grain intensity**: P1 grain hơi nhẹ — tinh chỉnh ở P4 khi so cạnh ffmpeg.

## Dấu chân spike (biệt lập)

- Deps: `remotion`, `@remotion/cli`, `@remotion/tailwind-v4`.
- File: `src/remotion/*`, `remotion.config.ts`, `public/spike/`, `out/` (artifact).
- Sửa production: `overlay-render.tsx` guard glob (GIỮ — cải thiện thật).

## Câu hỏi mở

- Có tách audio ra ffmpeg hẳn (đơn giản, chắc) hay đưa hết vào Remotion (thuần một
  engine nhưng phải lo mix)? → quyết ở P3.
