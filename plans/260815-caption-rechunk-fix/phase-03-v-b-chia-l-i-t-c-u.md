---
phase: 3
title: Vá B chia lại + tự cứu
status: completed
priority: P1
effort: 5h
dependencies:
  - 2
---

# Phase 3: Vá B — cờ nguồn-gốc + endpoint chia lại + tự cứu

## Overview
Ghi cờ `captions_llm_ok`, thêm endpoint chia-lại thay cụm (giữ chữ/mốc), và tự-cứu
CHỈ dự án lỗi-lúc-gieo (chưa bị sửa cụm).

## Requirements
- Functional:
  - Cột `captions_llm_ok` (0/1) trên `projects`, đặt lúc gieo theo `llmOk` Phase 2.
  - `POST /api/projects/:id/rechunk`: xoá text elements + `createCaptionElements`
    lại; giữ chữ/mốc (chunk lại từ bảng từ, chữ không đổi). Trả số cụm mới.
  - **Tự-cứu** ở `GET /api/projects/:id`: nếu `captions_llm_ok=0` + `hasModel()`
    + **chưa có cụm bị người sửa** + máy rảnh (transcribe không chạy) → rechunk 1 lần.
  - Phát hiện "cụm đã sửa" (BẢO THỦ — chốt validate): element `kind='text'` có
    `content` ≠ chuỗi ghép từ các `words` nó phủ (tận dụng `refreshCaptionsAfterWordEdit`),
    **HOẶC** `emphasis`/`align`/`position_band` ≠ recipe/defaults của pack. Bất kỳ
    dấu tay nào (sửa chữ hoặc đổi nhấn/đặt/kiểu) đều CHẶN tự-cứu.
- Non-functional: rechunk idempotent; tự-cứu chạy ĐÚNG MỘT LẦN (sau đó llm_ok=1).

## Architecture
- `db.ts`: thêm dòng `["projects", "captions_llm_ok", "INTEGER DEFAULT 0"]` vào bảng
  migration cột (mẫu ở `db.ts:429`). Mặc định 0 để dự án CŨ tính là "chưa chắc
  LLM" → đủ điều kiện tự-cứu (nhưng còn chặn bởi "chưa bị sửa cụm").
- `caption-elements.ts`: sau `createCaptionElements`, nơi gọi ghi
  `captions_llm_ok = llmOk ? 1 : 0`.
- Hàm dùng chung `rechunkCaptions(projectId, pack, {remapEmphasis})`:
  - **Thu nhấn theo TỪNG TỪ trước khi xoá:** đọc `emphasis`/từ-khoá của cụm cũ, quy
    về tập word-id được nhấn.
  - DELETE elements text → createCaptionElements → **gán lại nhấn**: cụm mới nào
    chứa word-id đã-nhấn thì bật nhấn lại (re-map). Chỉ `chỗ-đặt`/căn per-cụm reset.
  - Tự-cứu: chỉ chạy khi KHÔNG có cụm đã-sửa (nên re-map hầu như rỗng, an toàn).
  - Cập nhật cờ `captions_llm_ok=1` sau khi chia lại thành công.
- `projects-routes.ts` GET: chèn nhánh tự-cứu ngay cạnh khối gieo-lười hiện có
  (dùng chung guard `idle`).

## Related Code Files
- Modify: `server/db.ts` (cột + migration)
- Modify: `server/caption-elements.ts` (ghi cờ; hàm `rechunkCaptions`; helper "đã sửa")
- Modify: `server/routes/projects-routes.ts` (GET tự-cứu) + `elements-routes.ts` hoặc mới (POST rechunk)
- Modify: `scripts/caption-guard/check-caption-chunk.ts` (thêm ca: rechunk giữ chữ/mốc, **re-map nhấn theo từ**, tự-cứu gated)

## Implementation Steps
1. Thêm cột + migration; verify `db.ts` chạy không lỗi.
2. Viết helper "cụm đã bị sửa?" (content-mismatch / style-khác-recipe).
3. Viết `rechunkCaptions` (delete + recreate, preserve chữ/mốc).
4. Endpoint `POST /rechunk` (mode: `force` khi người dùng xác nhận mất nhãn).
5. Nhánh tự-cứu ở GET (điều kiện đủ 4 vế).
6. Mở rộng guard: rechunk giữ nguyên chữ+mốc; tự-cứu KHÔNG chạy khi có cụm đã sửa.
7. typecheck + lint + `check:caption-chunk` xanh.

## Success Criteria
- [ ] Migration thêm cột chạy sạch trên DB hiện có.
- [ ] `POST /rechunk` đổi ranh cụm, chữ+mốc y nguyên; **từ-nhấn re-map đúng** (guard chứng minh).
- [ ] Tự-cứu chạy cho dự án llm_ok=0 chưa-sửa; KHÔNG chạy khi đã-sửa (guard).
- [ ] Tự-cứu chạy đúng 1 lần (llm_ok→1 sau đó).
- [ ] typecheck + lint sạch.

## Risk Assessment
- Tự-cứu vô tình xoá tinh chỉnh. Giảm: chặn cứng bằng "chưa bị sửa cụm" + chỉ
  llm_ok=0. Dự án đã-sửa → chỉ đổi qua nút thủ công có xác nhận (Phase 4).
- Rechunk khi transcribe đang chạy → chữ neo vào từ sắp xoá. Giảm: guard `idle`.
