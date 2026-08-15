---
phase: 2
title: Vá A robustness chunker
status: completed
priority: P1
effort: 5h
dependencies:
  - 1
---

# Phase 2: Vá A — chunker không fail câm (làm guard Phase 1 xanh)

## Overview
Refactor `llmCaptionBreaks` + `buildCaptionGroups`: chia theo TỪNG CÂU, retry lỗi
tạm, log lỗi, tách "no-model" vs "gọi-hỏng", trả cờ `llm_ok`. Nhận `breakProvider`
tiêm được để guard Phase 1 chạy tất định.

## Requirements
- Functional:
  - Chia theo câu: gom words theo `sentence_id`; **chỉ câu vượt maxWords/maxChars
    mới gọi LLM** (câu ngắn = 1 cụm, khỏi gọi) → giảm mạnh số call.
  - Gọi song song có **cap concurrency** (đề xuất 4–5) giữ wall-clock thấp.
  - Retry lỗi tạm (timeout / "No endpoints" / rate-limit) 1–2 lần.
  - `catch` phải **LOG** (projectId + câu + message), không nuốt câm.
  - Trả kết quả giàu: mỗi câu `{ breaks, ok, reason }`; tổng hợp `llm_ok` =
    (không câu nào fail-gọi). `no-model` KHÔNG tính là fail (width hợp lệ).
- Non-functional: một câu lỗi CHỈ hỏng câu đó (width cục bộ), không sập cả bài.

## Architecture
`ai-caption-groups.ts`:
- Tách `llmBreaksForSentence(projectId, words, pack)` trả `{breaks:Set|null, ok, reason}`.
  - `!hasModel()` → `{null, ok:true, reason:'no-model'}` (đừng coi là fail).
  - gọi hỏng sau retry → `{null, ok:false, reason:'call-failed'}` + `console.warn`.
- `llmCaptionBreaks(...)` thành orchestrator: nhóm câu, lọc câu-cần-gọi, chạy
  song song (cap), trả `{ breaksByWordIndex:Set, llmOk:boolean }`.

`caption-groups.ts`:
- `buildCaptionGroups(projectId, band, pack, breakProvider?)` — provider mặc định
  = orchestrator trên. Vòng ghép dùng `breaksByWordIndex` như cũ; **giữ nguyên**
  luật biên-cứng (gap>0.35 / newSentence / crossesCut) + `mergeShort`.
- Trả kèm `llmOk` để nơi gọi (createCaptionElements) ghi cờ `captions_llm_ok`
  (Phase 3). Chữ ký đổi → cập nhật mọi nơi gọi (`caption-elements.ts`,
  `segment-seed.ts`).

## Related Code Files
- Modify: `server/ai-caption-groups.ts` (per-câu, retry, log, reason)
- Modify: `server/caption-groups.ts` (nhận provider, trả llmOk)
- Modify: `server/caption-elements.ts`, `server/segment-seed.ts` (nhận llmOk từ buildCaptionGroups)

## Implementation Steps
1. Viết `llmBreaksForSentence` với retry + log + reason.
2. Viết orchestrator per-câu song song (cap concurrency), chỉ câu vượt hạn.
3. Cho `buildCaptionGroups` nhận `breakProvider` + trả `{groups, llmOk}`.
4. Cập nhật các nơi gọi tiêu thụ shape mới (chưa ghi cờ DB — để Phase 3).
5. Chạy `npm run check:caption-chunk` → PHẢI XANH cả 4 bất biến.
6. `npm run typecheck` + `npm run lint` sạch.

## Success Criteria
- [ ] Guard Phase 1 XANH (4 bất biến).
- [ ] Câu ngắn không gọi LLM (đo: số call = số câu vượt hạn).
- [ ] Một câu ném lỗi → câu khác vẫn chia đúng (bất biến 3).
- [ ] `catch` có `console.warn` (bất biến 4) — không nuốt câm.
- [ ] typecheck + lint sạch.

## Risk Assessment
- Nhiều call song song → rate-limit. Giảm: cap 4–5, retry backoff.
- Đổi chữ ký `buildCaptionGroups` lan nhiều nơi. Giảm: giữ tham số cũ, chỉ THÊM
  optional `breakProvider` + trả thêm field; nơi cũ đọc `.groups`.
