---
phase: 10
title: "Opening Hook"
status: pending
priority: P2
effort: "1d"
dependencies: [5]
---

# Phase 10: Opening Hook

## Overview

Một dòng **"3 giây đầu"** trong hàng "Cần bạn xem": hiện đúng câu mở đầu của người
dùng, nghe thử được, và mở ra ba đường xử lý — mỗi đường xem thử được trước khi
nhận.

## Key Insights

**Đừng gọi nó là "hook".** Người dùng Việt không biết từ đó. Gọi bằng thứ đo được:
**3 giây đầu**.

**Thứ có tác dụng nhất không phải AI viết hộ câu mở, mà là bắt họ NGHE LẠI 3 giây
đầu của chính mình.** Gần như không ai từng làm việc đó một cách có ý thức. Chỉ
riêng việc bày câu đó ra kèm một nút nghe đã làm được phần lớn công việc — phần AI
viết hộ là tầng sau.

**Không đẻ màn mới.** Hàng "Cần bạn xem" (§9) đã là chỗ dành riêng cho "máy gợi ý,
người quyết". `onPreview(at, until)` đã có sẵn ở `right-panel.tsx` — nghe thử
không cần dựng gì mới.

**Không neo chữ vào giây.** Quyết định đáng nhớ #1 của dự án: phần tử gắn vào
**khoảng từ**, không gắn vào giây. Cả ba đường bên dưới đều tôn trọng điều đó —
không đường nào tạo ra chữ đứng trước lời nói đầu tiên.

**Không chấm điểm.** Hook tốt hay không thì máy không đo được. Một con số bịa ở màn
này sẽ làm hỏng lòng tin vào mọi con số khác đang bày ra — đúng phép thử §45: nó
đổi được quyết định nào?

## Requirements

**Functional**
- Một dòng trong hàng soát, hiện lời của 3 giây đầu
- Nút **Nghe thử** chạy đúng 3 giây đầu
- Ba đường xử lý, mỗi đường xem thử được trước khi nhận
- Bỏ qua được, và bỏ qua thì không hiện lại

**Non-functional**
- Không tạo loại `element` mới
- Không đụng thứ tự đoạn (`segments.position`)

## Architecture

```
Cần bạn xem
┌────────────────────────────────────────────┐
│ 🎬  3 giây đầu              [Nghe thử]     │
│     "Ừm... chào mọi người, hôm nay..."      │
└────────────────────────────────────────────┘
        │ mở ra
        ├── Bỏ phần rào đón   → cắt đoạn (cơ chế có sẵn)
        ├── Phóng to câu đầu  → đổi dáng N từ đầu
        └── Tự viết câu mở    → gợi ý từ llm.ts
```

| Đường | Máy làm gì | Đụng gì |
|---|---|---|
| **Bỏ phần rào đón** | bật cờ `removed` trên đoạn đầu | `segments` — cơ chế cắt có sẵn |
| **Phóng to câu đầu** | N từ đầu đổi `band` → `middle`, cỡ lớn | `elements` — vẫn neo vào khoảng từ |
| **Tự viết câu mở** | ô nhập + 3 gợi ý từ nội dung video | `elements` — một khối chữ neo vào N từ đầu |

Đường thứ tư — **đảo câu chốt lên đầu** — cố ý **không** làm: `render.ts` ghép đoạn
theo `position` tuyến tính, đảo thứ tự là việc lớn hẳn. Để vòng sau.

## Related Code Files

- Modify: `src/routes/editor/review-queue.tsx` — loại lời nhắc mới
- Create: `src/routes/editor/opening-hook-pane.tsx` — ba đường xử lý
- Modify: `server/ai-keywords.ts` hoặc tệp mới cạnh nó — gợi ý câu mở
- Read: `server/llm.ts` — hạ tầng gọi mô hình
- Read: `src/routes/editor/right-panel.tsx` — `onPreview(at, until)`
- Read: `docs/editor-interaction-spec.md` §9, §18

## Implementation Steps

1. **Dòng trong hàng soát** — lấy lời của 3 giây đầu từ bảng `words`. Thêm loại
   lời nhắc mới với biểu tượng và sắc màu riêng theo lối đang có ở `review-queue.tsx`
2. **Nút Nghe thử** — `onPreview(0, 3)`. Đây là phần rẻ nhất và có giá trị nhất,
   làm trước và có thể dừng ở đây
3. **Đường 1 · Bỏ phần rào đón** — tìm mốc lời thật bắt đầu (dùng `audio-envelope`
   như `segment-seed.ts` đang làm), đề nghị bỏ đoạn trước đó. Xem thử rồi mới nhận
4. **Đường 2 · Phóng to câu đầu** — N từ đầu đổi sang dáng hook. Vẫn là `element`
   loại `text` neo vào khoảng từ, chỉ khác giá trị trục
5. **Đường 3 · Tự viết** — ô nhập, kèm 3 gợi ý sinh từ bản chép lời. Người dùng sửa
   được gợi ý trước khi nhận
6. **Bỏ qua** — theo cơ chế `boQua` đã có trong `useReviewIssues`
7. **Kiểm ba đường** — mỗi đường xem thử được, và nhận rồi hoàn tác được

## Todo List

- [ ] Loại lời nhắc "3 giây đầu" trong hàng soát
- [ ] Nút Nghe thử
- [ ] Đường 1 — bỏ phần rào đón
- [ ] Đường 2 — phóng to câu đầu
- [ ] Đường 3 — tự viết + gợi ý
- [ ] Bỏ qua được
- [ ] Kiểm không đụng thứ tự đoạn

## Success Criteria

- [ ] Dòng hiện đúng lời của 3 giây đầu
- [ ] Nghe thử chạy đúng 3 giây rồi dừng
- [ ] Cả ba đường xem thử được **trước** khi nhận
- [ ] Không tạo loại `element` mới, không đụng `segments.position`
- [ ] Bỏ qua thì không hiện lại
- [ ] Không có con số chấm điểm nào trên màn

## Risk Assessment

| Rủi ro | Mức | Cách xử |
|---|---|---|
| Gợi ý AI viết ra câu sáo rỗng | vừa | Gợi ý luôn sửa được, và hai đường kia không cần AI. Ba đường không cùng phụ thuộc một thứ |
| Dòng nhắc hiện với mọi video kể cả video mở đầu tốt | vừa | Chỉ hiện khi 3 giây đầu **có dấu hiệu rào đón** (lời lấp, quãng lặng dài trước lời thật). Không có thì đừng nhắc |
| Đường 2 làm chữ tràn khung ở dáng lớn | vừa | Đi qua đúng bộ máy đo hiện có, `MAX_BLOCK_SHARE` vẫn chặn |
| Người dùng tưởng máy chấm điểm video của họ | thấp | Không có số nào. Chỉ có lời của chính họ và một nút nghe |

## Next Steps

Kết thúc plan. Đường "đảo câu chốt lên đầu" để lại cho vòng sau, cần đụng
`render.ts` ở chỗ ghép đoạn.
