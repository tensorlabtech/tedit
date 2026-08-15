---
phase: 4
title: UI nút Chia lại cụm
status: completed
priority: P2
effort: 3h
dependencies:
  - 3
---

# Phase 4: UI — nút "Chia lại cụm" ở Soát lời

## Overview
Thêm nút "Chia lại cụm" ở bước Soát lời gọi `POST /rechunk`, có xác nhận khi có
cụm đã tinh chỉnh (tránh mất từ-nhấn/kiểu). Chỉ đặt ở Soát lời (đã chốt).

## Requirements
- Functional:
  - Nút ở header bảng Soát lời (transcript-panel), dùng design system (không HTML chay).
  - Bấm → nếu **có cụm đã sửa** → mở xác nhận (nêu rõ: **từ-nhấn được GIỮ** qua
    re-map per-từ, chỉ **chỗ-đặt/căn per-cụm** đặt lại) → gọi `/rechunk?force`;
    nếu không có → gọi thẳng, refresh danh sách cụm.
  - Trạng thái đang-chia (spinner/disable), báo kết quả ("đã chia lại N cụm").
- Non-functional: theo quy tắc UI dự án — cursor pointer, tooltip nếu chỉ icon,
  không tự chế viền.

## Architecture
- `src/lib/api.ts`: thêm `rechunkCaptions(projectId, {force})`.
- `src/routes/editor/transcript-panel.tsx`: nút ở header (chỉ khi `proofread`),
  đọc cờ "có cụm đã sửa" từ `editor` (hoặc field project trả kèm) để quyết định
  hỏi xác nhận.
- Xác nhận: dùng dialog design-system sẵn có (kiểm `/_dev/design-system`).
- Sau rechunk: invalidate/refetch project để bảng + preview cập nhật.

## Related Code Files
- Modify: `src/lib/api.ts` (client method)
- Modify: `src/routes/editor/transcript-panel.tsx` (nút + xác nhận)
- Modify: `src/routes/flow/soat-loi-step.tsx` (truyền cờ/handler nếu cần)
- Read: `src/dev` design-system (dialog/button variant)

## Implementation Steps
1. Client `rechunkCaptions` trong api.ts.
2. Nút trong header transcript-panel (proofread-only) + tooltip.
3. Luồng xác nhận khi có cụm đã sửa; luồng thẳng khi chưa.
4. Refresh sau rechunk; trạng thái loading + toast kết quả.
5. typecheck + lint.
6. **Verify bằng browser** (agent-browser session CÔ LẬP, viewport 1512, set SAU
   khi navigate): bấm nút trên dự án cụm-vỡ → cụm chia lại đúng, không vỡ từ ghép;
   dự án đã-sửa → hiện xác nhận. Chụp ảnh tự kiểm (không có test component).

## Success Criteria
- [ ] Nút hiện ở Soát lời, dùng design-system, có tooltip/cursor.
- [ ] Dự án chưa-sửa: bấm → chia lại ngay, cụm đẹp (verify browser + ảnh).
- [ ] Dự án đã-sửa: bấm → xác nhận trước khi mất nhãn.
- [ ] typecheck + lint sạch; không lỗi console.

## Risk Assessment
- Không có test component → dựa browser thủ công. Giảm: guard server (Phase 1–3)
  đã khoá logic; UI chỉ là nút gọi endpoint đã kiểm.
- Refetch không cập nhật preview. Giảm: invalidate đúng query key project.
