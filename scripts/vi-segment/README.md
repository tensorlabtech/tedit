# Tách từ tiếng Việt cho chunker phụ đề

Diệt tận gốc cảnh cụm phụ đề vỡ **giữa một từ nhiều tiếng** ("phần|mềm",
"chia|sẻ", "bản|thân") — thay vì hardcode vài chục cặp (vượt kịch bản khác là
toang), hỏi bộ **tách từ** [underthesea](https://github.com/undertheseanlp/underthesea):
từ nào nhiều tiếng thì các tiếng KHÔNG-cuối bị "cấm ngắt sau". Phủ cả ngôn ngữ.

## Cài (một lần / máy)

```sh
sh scripts/vi-segment/install.sh
```

Tạo `scripts/vi-segment/vienv/` (đã gitignore) + cài underthesea. Server tự tìm
`scripts/vi-segment/vienv/bin/python3`; muốn python khác thì đặt env
`VI_SEGMENT_PYTHON`.

## Cách chạy

- `segment.py`: nhận JSON `{sentences: [[tiếng, ...], ...]}` (stdin) → trả
  `{noBreak: [[chỉ-số-cấm-ngắt-sau, ...], ...]}`. Căn theo tiếng đã bỏ dấu câu,
  khớp cả dãy; lệch thì bỏ glue an toàn.
- `server/vi-word-segment.ts`: gọi python một lần / bản chép (nhớ theo chữ), map
  về `word.id`. Chunker (`caption-groups.ts`) cấm ngắt sau các tiếng đó.

## Không cài thì sao

`noBreakAfterWords` trả tập RỖNG + log `[vi-segment] tách từ hỏng` → chunker chạy
y như trước (dựa trần 7-từ + font). Mất lớp bảo hiểm giữ-từ, KHÔNG sai.
