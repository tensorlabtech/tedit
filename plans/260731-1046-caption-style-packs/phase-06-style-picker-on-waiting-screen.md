---
phase: 6
title: "Style Picker On Waiting Screen"
status: done
priority: P1
effort: "1d"
dependencies: [5]
---

# Phase 6: Style Picker On Waiting Screen

## Overview

Card chọn bộ dáng ở cột phải màn chờ `/pipeline/:projectId`, dưới lời trấn an.
Năm ô mẫu có chữ **chạy thật**, và ô mẫu tự đổi sang chính câu đầu tiên của người
dùng khi chặng chép lời xong.

## Key Insights

**Màn chờ là chỗ duy nhất người dùng rảnh mà vẫn đang tập trung vào dự án này.**
Họ ngồi không 2–5 phút và ta đang khuyên họ đi làm việc khác. Vào bàn dựng rồi thì
họ bận sửa chữ, không ai đi đổi dáng nữa.

**Ở đây đổi qua đổi lại là miễn phí.** Chặng `captions` chạy **sau** `transcribe`,
nên lúc người dùng đang chọn thì chữ chưa sinh ra. Không có cụm nào để mà giữ hay
đè. Đây là lý do phase này đứng trước phase 7.

**Ô mẫu phải dùng chữ THẬT của họ.** Lúc mới vào thì chưa có lời, chạy chữ ví dụ.
Chặng `transcribe` xong (chặng 2/6) là có lời — ô mẫu lặng lẽ đổi sang câu đầu
tiên họ vừa nói. Đó là thứ đối thủ không làm được vì họ không có thời gian chờ để
tận dụng.

**Không được đọc ra như "còn một bước nữa".** Màn này đang hứa *"cứ làm việc khác
đi"*. Card mới phải đọc ra như **có thứ hay ho để ngắm**, không phải một việc phải
làm. Câu dưới ô nói thẳng: *"không chọn cũng được — máy đang dùng …"*.

## Requirements

**Functional**
- 5 ô mẫu, chữ chạy thật (không phải ảnh tĩnh)
- Ô mẫu đổi sang chữ của người dùng khi có lời
- Chọn là ghi ngay vào `projects.style_pack`
- Đổi bao nhiêu lần cũng được

**Non-functional**
- Không làm xô layout khi chặng chạy xong và trang tự hỏi lại
- Ô mẫu không được ăn CPU tới mức làm chậm việc đang chạy nền

## Architecture

```
/pipeline/:projectId  cột phải
┌─ Tiếp theo / trấn an ─┐   ← đã có
├─ Các bước ────────────┤   ← đã có
├─ Chọn dáng chữ ───────┤   ← MỚI
│  ┌──┐┌──┐┌──┐         │
│  │Aa││Aa││Aa│  …      │
│  └──┘└──┘└──┘         │
│  Không chọn cũng được │
└───────────────────────┘
```

Ô mẫu tái dùng đường vẽ của trang xem (`overlay-render.tsx`) — cùng một bộ máy với
`/_dev/overlays`, nên thấy sao thì xuất ra vậy.

Nguồn chữ cho ô mẫu:
1. chưa có lời → chữ ví dụ ngắn
2. có lời → cụm đầu tiên từ `buildCaptionGroups`

## Related Code Files

- Create: `src/routes/pipeline/style-picker-card.tsx`
- Create: `src/routes/pipeline/style-preview-tile.tsx`
- Modify: `src/routes/pipeline/pipeline-page.tsx` — thêm card vào cột phải
  (route khai ở `src/main.tsx:107`)
- Modify: `src/lib/api.ts` — `PATCH` bộ dáng, đọc cụm đầu
- Read: `src/dev/overlays/overlay-render.tsx` — đường vẽ dùng lại
- Read: `docs/upload-interaction-spec.md` §27 — luật của màn chờ

## Implementation Steps

1. **Ô mẫu một bộ dáng** — khung 9:16 thu nhỏ, vẽ một cụm chữ bằng đường vẽ của
   trang xem, chạy vòng lặp hiệu ứng
2. **Card năm ô** — lưới, ô đang chọn có viền nhấn. Chú ý §17 và §43: viền tiêu
   điểm phải vẽ **vào trong**, không thì bị vùng cuộn gọt mất
3. **Nguồn chữ** — chữ ví dụ trước, đổi sang cụm đầu của người dùng khi có
4. **Ghi khi chọn** — `PATCH` ngay, không cần nút xác nhận. Đây là thao tác rẻ và
   đảo ngược được
5. **Câu dưới ô** — *"Không chọn cũng được — máy đang dùng …"*, dùng `Alert`
   biến thể `info` đã có trong design system
6. **Kiểm layout** — §16 của upload spec: mọi thứ đổi chiều cao phải nằm ở card
   của nó. Trang tự hỏi lại mỗi 1,5s; card không được nhảy mỗi lần hỏi
7. **Kiểm chi phí** — 6 vòng lặp hiệu ứng chạy cùng lúc trong khi ffmpeg đang chạy
   nền. Chậm thì chỉ chạy hiệu ứng ở ô đang trỏ vào, các ô kia đứng yên

## Todo List

- [x] Component ô mẫu một bộ dáng
- [x] Card năm ô, viền vẽ vào trong
- [x] Chữ ví dụ → chữ thật khi có lời
- [x] `PATCH` khi chọn
- [x] Câu "không chọn cũng được"
- [x] Kiểm không xô layout khi trang hỏi lại
- [x] Kiểm chi phí khi 5 ô cùng chạy

## Success Criteria

- [x] Chọn một ô rồi để pipeline chạy hết → video ra đúng dáng đã chọn
- [x] Không chọn gì → ra dáng mặc định, không có lời nhắc nào chặn đường
- [x] Ô mẫu đổi sang chữ của người dùng sau khi chép lời xong
- [x] Card không làm xô layout ở màn 1160px lẫn 720px
- [x] Đổi qua lại nhiều lần vẫn ra đúng bộ dáng chọn cuối

## Risk Assessment

| Rủi ro | Mức | Cách xử |
|---|---|---|
| Card đọc ra như một bước bắt buộc | **cao** | Câu "không chọn cũng được" + không có nút xác nhận. Đây là hỏng về cảm giác, không hỏng về code — chỉ phát hiện được bằng cách nhìn |
| Năm vòng lặp làm chậm việc chạy nền | vừa | Chỉ chạy hiệu ứng ở ô đang trỏ vào |
| Chọn xong mà chặng `captions` đã chạy rồi | vừa | Ghi cả `defaults` lúc đó, hoặc khoá ô sau khi chặng `captions` xong và chuyển sang lời mời đổi ở bàn dựng |
| Viền ô đang chọn bị gọt | thấp | §43 đã chữa ở tầng component |

## Next Steps

Phase 7 cho đổi trong bàn dựng — an toàn nhờ `defaults` giống nhau ở cả 5 bộ.
