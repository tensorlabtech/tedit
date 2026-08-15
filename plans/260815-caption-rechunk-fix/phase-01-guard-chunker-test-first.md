---
phase: 1
title: Guard chunker (test-first)
status: completed
priority: P1
effort: 3h
dependencies: []
---

# Phase 1: Guard chunker (test-first)

## Overview
Viết guard-script `check:caption-chunk` TRƯỚC (đỏ) khoá đúng các bất biến của
chunker mà Phase 2 phải thoả. Dự án không dùng vitest — test = script `tsx`
theo idiom `scripts/*-guard/check-*.ts` (như `check:commit-cut`, `check:llm-cache`).

## Requirements
- Functional: guard chạy **không cần mạng** (không gọi LLM thật) — bơm break giả.
- Non-functional: chạy nhanh (<2s), exit≠0 khi vi phạm, in rõ chỗ sai.

## Architecture
Chunker hiện gọi LLM bên trong `buildCaptionGroups` → không test tất định được.
Guard đòi tách **nguồn-break tiêm được** (dependency injection): `buildCaptionGroups`
nhận optional `breakProvider` (mặc định = `llmCaptionBreaks`). Guard truyền provider
giả để kiểm phần GHÉP tất định.

Bất biến guard khoá (Phase 2 làm cho xanh):
1. **Giữ từ ghép:** cho câu "…không xây dựng một phần mềm" + break LLM hợp lý →
   không cụm nào kết thúc giữa `xây|dựng`, `phần|mềm`, `chia|sẻ`.
2. **Không dangling hư từ:** không cụm nào kết bằng `tại/đã/khiến/để/là/mà/và…`
   (tập ATTACH_FORWARD) — kể cả đường width-fallback.
3. **Per-câu cô lập:** provider giả ném lỗi ở 1 câu → các câu khác VẪN chia đúng
   (không sập cả bài về width).
4. **Phân biệt no-model vs fail:** provider trả `{ok:false, reason:'no-model'}` →
   width chấp nhận, `llm_ok=0`; provider ném lỗi (fail) → cũng `llm_ok=0` nhưng
   phải LOG (guard bắt được dòng log/He cờ), KHÔNG nuốt câm.

## Related Code Files
- Create: `scripts/caption-guard/check-caption-chunk.ts`
- Modify: `package.json` (thêm `"check:caption-chunk": "TEDDIT_DATA_ROOT=$(mktemp -d) tsx scripts/caption-guard/check-caption-chunk.ts"`)
- Read (hiểu để dựng fixture): `server/caption-groups.ts`, `server/ai-caption-groups.ts`

## Implementation Steps
1. Dựng fixture words in-memory (mảng `{id,text,start_sec,end_sec,sentence_id}`)
   cho 2–3 câu tiếng Việt có từ ghép + hư từ.
2. Viết guard gọi hàm GHÉP tất định của chunker với `breakProvider` giả cho từng
   ca (1)–(4); assert bằng `assert`/throw.
3. Thêm script vào `package.json`. Chạy → PHẢI ĐỎ (chunker chưa nhận provider,
   chưa per-câu, chưa cờ) — đỏ đúng là mục tiêu Phase 1.
4. Commit guard đỏ (mốc TDD).

## Success Criteria
- [ ] `npm run check:caption-chunk` tồn tại, chạy được, KHÔNG gọi mạng.
- [ ] Guard hiện ĐỎ với lý do khớp 4 bất biến (chứng minh nó thật sự kiểm được).
- [ ] Guard không phụ thuộc DB thật của user (dùng TEDDIT_DATA_ROOT tạm hoặc thuần in-memory).

## Risk Assessment
- Rủi ro: chunker khó tách provider nếu ghép chặt LLM. Giảm: Phase 2 nhận refactor
  này như bước đầu; guard chỉ cần hàm ghép + provider, không cần toàn pipeline.
