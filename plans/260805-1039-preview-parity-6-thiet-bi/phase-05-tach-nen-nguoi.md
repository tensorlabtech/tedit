# Phase 05 — Tách nền người: chữ sau người + viền người

## Overview
- **Ưu tiên:** Trung bình (khó nhất — phụ thuộc mask người; ít bộ dùng nên có thể hoãn)
- **Trạng thái:** Chưa bắt đầu
- **Mô tả:** Preview vẽ chữ chạy SAU người và viền quanh người. Thiết bị #3, #4. Cả hai
  cần ảnh người đã tách nền (`work/subject.mp4`) mà export dựng, preview chưa có.

## Key insights
- #3 chữ sau người (`chu-sau-nguoi`): chữ to lặp nhiều tầng, người NÓI đè lên trên →
  cần lớp người có alpha để phủ lên chữ. Server: `render.ts:1171` + `subjectCutChain`.
- #4 viền người (`vien-nguoi`): đường viền quanh mép người → cần chính mask ấy.
  Server: `subjectEdgeSteps`.
- **Nút thắt chung:** client cần MASK NGƯỜI theo thời gian. `subject.mp4` là video mask
  server dựng lúc export — nặng, chưa có sẵn ở preview. Đây là lý do hoãn được nếu
  lợi/công không đáng (hai thiết bị này chỉ vài bộ dùng).

## Requirements
- Bộ có `behindText` + đã tách nền: preview hiện chữ sau người, người đè lên, mờ dần
  đúng `behind.seconds`.
- Bộ có `subjectEdge`: preview hiện viền quanh người.
- Chưa tách nền (chưa có mask): ẩn cả hai — KHÔNG vẽ chữ nổi trên mặt người (đọc ra lỗi).

## Architecture — ba lối, chọn theo R2
- **Lối A (đúng nhất, đắt):** server dựng sẵn `subject-preview.webm` (mask alpha nhẹ)
  khi upload, client phủ như một lớp video có alpha. Đúng như export, tốn dựng nền.
- **Lối B (rẻ, gần đúng):** tách nền THỜI GIAN THỰC ở client bằng một mask model nhẹ
  (vd MediaPipe Selfie Segmentation) chạy trên `<video>` → alpha mỗi khung. Không cần
  server dựng, nhưng mask khác server → parity chỉ ở mức "đúng ý", không khớp pixel.
- **Lối C (hoãn):** chưa dựng preview cho #3/#4; editor hiện nhãn "xem ở bản xuất" cho
  hai thiết bị này. Trung thực, rẻ, giữ nguyên cho tới khi có nhu cầu thật.
- **Quyết định:** hỏi người dùng chọn A/B/C — đây là đánh đổi công-vs-độ-đúng thật,
  không suy được từ code. Mặc định đề xuất **C trước, B sau** nếu cần preview động.

## Requirements dữ liệu
- Cần biết dự án ĐÃ tách nền chưa (cột/`work/subject.mp4` tồn tại) → endpoint Phase 02
  trả thêm cờ `hasSubject`.

## Related code files
- Đọc: `server/render.ts:1171-1210` (chữ sau người), `subjectEdgeSteps`,
  `subjectCutChain`, đường dựng `subject.mp4`
- Tạo (Lối B): `src/routes/editor/use-subject-mask.ts` (segmentation client);
  `src/dev/overlays/style-behind-text.tsx`, `src/dev/overlays/style-subject-edge.tsx`
- Sửa: endpoint trả `hasSubject`; `preview-panel.tsx` cắm hai lớp

## Implementation steps
1. **Chốt lối A/B/C với người dùng** (R2 — đánh đổi thật).
2. Endpoint trả `hasSubject`; ẩn cả hai khi chưa có.
3. Theo lối đã chốt: dựng nguồn mask (A: server; B: client segmentation; C: dừng, chỉ
   nhãn).
4. `<StyleBehindText>` + `<StyleSubjectEdge>` tái dựng bằng CSS/canvas từ mask.
5. Đối chiếu mắt trên bộ dùng behindText.

## Todo
- [ ] Chốt lối A/B/C (hỏi người dùng)
- [ ] Endpoint trả `hasSubject`; ẩn khi chưa tách nền
- [ ] Nguồn mask theo lối đã chốt
- [ ] `style-behind-text.tsx` + `style-subject-edge.tsx`
- [ ] Đối chiếu mắt
- [ ] Case parity / hoặc ghi rõ "gần đúng" nếu lối B (Phase 06)

## Success criteria
- Bộ có thiết bị + đã tách nền: preview hiện đúng ý (khớp pixel nếu lối A).
- Chưa tách nền: ẩn sạch, không vẽ đè mặt người.

## Risk
- **R2** mask client (lối B) khác server → parity chỉ "đúng ý"; ghi rõ giới hạn.
- Segmentation client nặng máy yếu → giới hạn tần suất, hạ độ phân giải mask.

## Next
Bàn giao case cho Phase 06 (hoặc đánh dấu "gần đúng" nếu lối B/C).
