---
phase: 9
title: "Broll Variety And Rhythm"
status: done
priority: P3
effort: "1.5d"
dependencies: [5]
---

# Phase 9: Broll Variety And Rhythm

## Overview

Thêm kiểu hiện cho tư liệu chèn, đưa **nhịp** thành con số của bộ dáng, và cho
`ai-effects` / `ai-broll-place` đọc thiên lệch từ bộ dáng.

## Key Insights

**Thêm kiểu vào kho KHÔNG tự làm video đa dạng.** Kho 12 kiểu mà AI luôn chọn 2
cái thì vẫn giống nhau như trước. Thứ tạo khác biệt là **luật chọn + nhịp** — đó
là phần bộ dáng gánh, và là lý do phase này không dừng ở việc thêm enum.

**Phong cách "nhanh" khác "êm" chủ yếu ở NHỊP, không ở danh sách kiểu.** Bao nhiêu
phần trăm chỗ nối được đánh dấu? B-roll mấy giây một lần, giữ bao lâu? Đó là con
số, không phải enum. Một bộ dáng chỉ nhặt `flash` + `zoom-in` mà vẫn đặt 3 giây
một cái thì không "nhanh" — nó chỉ chói.

**Con số thật đang có:** 5 kiểu chuyển cảnh (`none` `zoom-in` `zoom-out` `flash`
`dip`) và 4 dáng b-roll × 3 kiểu hiện. Ba kiểu hiện hiện nay (`none` `fade`
`fade-up`) đều là biến thể của mờ dần — thiếu hẳn nhóm chuyển động thật.

**Loại B: không tự đặt lại.** Đổi bộ dáng thì b-roll và chuyển cảnh đã đặt **giữ
nguyên**. Chỉ hiện một dòng trong hàng soát để người dùng tự bấm — vì đó là những
vật nằm trên dải, họ nhìn thấy và có thể đã sắp lại.

## Requirements

**Functional**
- Thêm kiểu hiện ngoài nhóm mờ dần: trượt vào, cắt cứng, giữ rồi bật
- Bộ dáng khai `effectBias` (kho ưu tiên) và `rhythm` (mật độ)
- `ai-effects` và `ai-broll-place` đọc thiên lệch
- Đổi bộ dáng → một dòng mời đặt lại trong hàng soát, **không** tự làm

**Non-functional**
- Kiểu mới phải có ở **cả hai** đường vẽ và khớp nhau
- Người dùng vẫn chọn được kiểu ngoài kho ưu tiên

## Architecture

```
style_pack ─┬─ effectBias  { junction: [...], insertReveal: [...] }
            └─ rhythm      { junctionShare, brollEverySec, brollHoldSec }
                                    │
                    ┌───────────────┴───────────────┐
              ai-effects.ts                  ai-broll-place.ts
```

Thiên lệch, không phải hàng rào: AI **ưu tiên** trong kho đó; bảng sửa vẫn bày đủ
mọi kiểu cho người dùng.

## Related Code Files

- Modify: `src/dev/overlays/overlay-model.ts` — `RevealId` thêm giá trị
- Modify: `server/render.ts:478-508` — nhánh dựng hiệu ứng cho tư liệu chèn
- Modify: `src/dev/overlays/overlay-render.tsx` — kiểu mới ở trang xem
- Modify: `server/ai-effects.ts` — đọc `effectBias` + `rhythm`
- Modify: `server/ai-broll-place.ts` — đọc `rhythm`
- Modify: `server/style-pack.ts` — hai trường mới
- Modify: `src/routes/editor/inspector-panel.tsx:207-222` — bày kiểu mới
- Modify: `src/routes/editor/review-queue.tsx` — dòng mời đặt lại

## Implementation Steps

1. **Thêm kiểu hiện** — trượt vào (từ một mép), cắt cứng (không chuyển tiếp), giữ
   rồi bật. Làm ở cả `render.ts` lẫn trang xem, kiểm khớp ở `/_dev/overlays`
2. **Bày kiểu mới trong bảng sửa** — chú ý ghi chú ở đầu `inspector-panel.tsx`:
   trục về **thời gian** thì để chữ nói, đừng thêm icon; và dải chọn không được
   xuống dòng, nếu quá 5 lựa chọn thì đổi sang cách bày khác
3. **Bộ dáng khai `effectBias` và `rhythm`** — mỗi bộ một tổ hợp, khớp cảm giác
   của dáng chữ nó đi kèm
4. **`ai-effects` đọc thiên lệch** — ưu tiên kho, và `junctionShare` quyết định
   bao nhiêu phần trăm chỗ nối được đánh dấu
5. **`ai-broll-place` đọc nhịp** — `brollEverySec` và `brollHoldSec`
6. **Dòng mời trong hàng soát** — *"bộ dáng mới thiên về nhịp nhanh — đặt lại hiệu
   ứng?"*. Theo §18: mỗi lời nhắc phải có một **câu trả lời**, không phải một nút
   giấu. Bấm là đặt lại, bỏ qua là dòng biến mất
7. **Kiểm cảm giác** — cùng một video, hai bộ dáng "nhanh" và "êm": số hiệu ứng và
   khoảng cách giữa chúng phải khác nhau rõ

## Todo List

- [x] Ba kiểu hiện mới, hai đường vẽ
- [x] Bày kiểu mới trong bảng sửa
- [x] `effectBias` + `rhythm` trong bộ dáng
- [x] `ai-effects` đọc thiên lệch
- [x] `ai-broll-place` đọc nhịp
- [x] Dòng mời đặt lại trong hàng soát
- [x] So hai bộ dáng trên cùng một video

## Success Criteria

- [x] Hai bộ dáng khác nhau → số hiệu ứng và khoảng cách giữa chúng khác nhau rõ
- [x] Đổi bộ dáng **không** tự đổi b-roll và chuyển cảnh đã đặt
- [x] Dòng mời đặt lại bấm được và làm đúng thứ nó hứa
- [x] Kiểu mới khớp giữa trang xem và bản xuất
- [x] Người dùng vẫn chọn được kiểu ngoài kho ưu tiên

## Risk Assessment

| Rủi ro | Mức | Cách xử |
|---|---|---|
| Thêm kiểu mà AI vẫn chọn hai cái cũ | **cao** | Chính là điều phase này cảnh báo. Kiểm bằng cách đếm phân bố kiểu trên vài video |
| Dải chọn xuống dòng khi quá 5 lựa chọn | vừa | Ghi chú ở `inspector-panel.tsx` đã kể: xuống dòng là mất lợi thế "thấy hết cùng lúc". Đổi cách bày |
| Nhịp nhanh làm video chói | vừa | Đặt trần cho `junctionShare`. Soi bằng mắt trên video thật |
| Dòng mời hiện mãi không dứt | thấp | Bỏ qua thì mất hẳn cho lần đổi đó |

## Next Steps

Độc lập. Không chặn phase nào.
