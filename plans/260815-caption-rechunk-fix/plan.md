---
title: Vá chunker cụm phụ đề + đường chia lại
description: ''
status: completed
priority: P2
branch: feat/block-pool-arch
tags: []
blockedBy: []
blocks: []
created: '2026-08-15T04:40:56.428Z'
createdBy: 'ck:plan'
source: skill
---

# Vá chunker cụm phụ đề + đường chia lại

## Overview

Cụm phụ đề ở Soát lời vỡ giữa từ ghép (`xây|dựng`, `chia|sẻ`) do bộ chunk LLM
`llmCaptionBreaks` **fail câm** (`catch{}` nuốt lỗi, cả bài chia 1 lời gọi) → tụt
heuristic width, rồi **đóng băng** vì gieo-lười chỉ chạy 1 lần (`captions_seeded=1`).

Hai vá độc lập:
- **A (robustness):** chia theo TỪNG CÂU + retry + log + tách no-model/gọi-hỏng,
  không tụt width câm.
- **B (chia lại):** cờ `captions_llm_ok` + nút "Chia lại cụm" ở Soát lời + tự-cứu
  CHỈ dự án lỗi-lúc-gieo (chưa bị sửa cụm).

TDD theo idiom dự án: guard-script `check:caption-chunk` (không dùng vitest).
Bối cảnh đầy đủ: [brainstorm-summary.md](./brainstorm-summary.md).

Ghi chú: `fix` ("Sửa chỗ nghe nhầm") đã chạy TRƯỚC Soát lời, sửa CHỮ — khác hệ
với chia CỤM, không dính lỗi này.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Guard chunker (test-first)](./phase-01-guard-chunker-test-first.md) | Completed |
| 2 | [Vá A robustness chunker](./phase-02-v-a-robustness-chunker.md) | Completed |
| 3 | [Vá B chia lại + tự cứu](./phase-03-v-b-chia-l-i-t-c-u.md) | Completed |
| 4 | [UI nút Chia lại cụm](./phase-04-ui-n-t-chia-l-i-c-m.md) | Completed |

## Dependencies

<!-- Cross-plan dependencies -->
