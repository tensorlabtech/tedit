# Phase 03 — Đổi bố cục CÓ ĐÀ + máy quay dồn

## Overview
- **Ưu tiên:** Cao (thứ làm bố cục "mượt" thay vì bật-đứng-im — chính chỗ Pulse đo là "chưa mượt")
- **Trạng thái:** Chưa bắt đầu
- **Mô tả:** Thêm chuyển động vào engine bố cục Phase 02: ô nở dần vào chỗ khi đổi màn,
  và máy quay dồn chậm suốt màn nghỉ. Thiết bị #1 phần động + #6.

## Key insights
- `layout-render.ts` đã đóng toàn bộ toán chuyển động thành hàm THUẦN: `ease`
  (`1-(1-p)³`), `glide` (nội suy từ ô màn trước), `entryOf` (điểm xuất phát = hình học
  màn trước), `pushFactor` (dồn ≤12%). Twin client tái dùng đúng công thức này — chỉ
  đổi đầu ra từ biểu thức ffmpeg sang số CSS mỗi khung.
- Đà tính theo `t` tuyệt đối trên trục phim; client có `seconds` từ `use-preview-playback`
  → thay `t` vào cùng công thức, ra khổ+tâm ô ở từng khung.
- Push chỉ ở màn NGHỈ (`scene.push`), nhân vào khổ ô — client nhân vào transform.

## Requirements
- Đổi màn: ô nở dần trong `RAMP=0.2s`, xuất phát từ ô màn trước, chậm dần — khớp
  `glide`/`ease`.
- Màn đầu nở từ `FIRST_SCENE_K=0.82`.
- Máy quay dồn: màn có `push` phóng dần tới ≤`PUSH_MAX` cuối màn.
- Chỉ chạy khi có nền trang (giống điều kiện `ramp = page !== null` ở server).

## Architecture
- Tách phần TOÁN thuần của `layout-render.ts` (`ease`, `glide`, `entryOf`, `pushFactor`,
  hằng `RAMP/K_MIN/K_MAX/FIRST_SCENE_K/PUSH_MAX`) ra `server/layout-motion.ts` — hàm
  nhận `(scene, schedule, box, t)` trả `{ w, h, cx, cy }`. Server `layout-render.ts`
  bọc lại thành biểu thức ffmpeg; client `useSceneLayout` gọi thẳng theo `seconds`.
  → Một công thức, hai đầu ra (nguyên tắc 3 của plan).
- Client dùng requestAnimationFrame sẵn có của preview → mỗi khung tính box động rồi
  đặt `<video>` bằng CSS `transform`/`width`/`height`.

## Related code files
- Đọc: `server/layout-render.ts:112-220` (RAMP, ease, glide, entryOf, pushFactor)
- Tạo: `server/layout-motion.ts` (toán thuần dùng chung)
- Sửa: `server/layout-render.ts` (gọi `layout-motion.ts` thay vì nội tuyến biểu thức);
  `src/routes/editor/use-scene-layout.ts` (nội suy động theo `seconds`)

## Implementation steps
1. Tách `layout-motion.ts`: chuyển `ease/glide/entryOf/pushFactor` sang trả SỐ tại một
   `t` cho trước (thay vì chuỗi biểu thức). Giữ hằng ở một chỗ.
2. Refactor `layout-render.ts` gọi module mới, xác nhận export ffmpeg KHÔNG đổi kết quả
   (chạy `dump-server-layout.ts` so trước/sau).
3. `useSceneLayout` gọi `layout-motion` theo `seconds` → box động.
4. Client đặt video theo box động + push; giữ điều kiện chỉ chạy khi có `page`.
5. Đối chiếu mắt: cú đổi màn Nhịp đen phải nở-vào chứ không bật-đứng.

## Todo
- [ ] Tách `layout-motion.ts` (toán thuần, trả số tại t)
- [ ] Refactor `layout-render.ts`, xác nhận ffmpeg bất biến (dump so trước/sau)
- [ ] Nội suy động trong `useSceneLayout`
- [ ] Push ở màn nghỉ
- [ ] Đối chiếu mắt
- [ ] Case parity động (bàn giao Phase 06)

## Success criteria
- Ô nở dần khi đổi màn, dồn chậm ở màn nghỉ — khớp export trong sai số Phase 06.
- Refactor KHÔNG đổi output ffmpeg (dump trùng).

## Risk
- Refactor `layout-render.ts` làm lệch export im lặng → chốt bằng dump so trước/sau
  TRƯỚC khi làm client.
- Đà CSS mỗi khung nặng máy yếu → dùng transform (GPU), tránh layout reflow.

## Next
Phase 04 thêm ô b-roll `phu` (cũng chạy trên box tĩnh+động này).
