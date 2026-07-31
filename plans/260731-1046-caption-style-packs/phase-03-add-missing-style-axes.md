---
phase: 3
title: "Add Missing Style Axes"
status: done
priority: P1
effort: "1.5d"
dependencies: [2]
---

# Phase 3: Add Missing Style Axes

## Overview

Thêm ba trục chưa từng tồn tại trong mô hình: `reveal` cho chữ, chữ HOA, và màu
nhấn thật. Ba cái độc lập nhau, làm song song được.

Đây là phase khiến các bộ dáng ở phase 4 thật sự khác nhau. Không có nó thì 5 pack
chỉ khác nhau ở font.

> **Trục `box` (nền khối) đã hoãn sang vòng sau.** ffmpeg `drawtext` chỉ cho nền
> **góc vuông**; bo tròn phải vẽ lớp riêng như đang làm với quầng tối, và việc đó
> ngốn bằng cả ba trục kia cộng lại. Ba trục còn lại đã đủ để 5 bộ dáng khác nhau
> rõ. Trường `box` vẫn khai trong kiểu `StylePack` (phase 2) với giá trị `null`.

## Key Insights

**Chữ đang LUÔN chạy từng tiếng, không tắt được.** `reveal` (Cắt thẳng / Mờ dần /
Mờ + lên) chỉ áp cho tư liệu chèn — `render.ts:478` và bảng sửa gọi
`setInsertStyle` (`inspector-panel.tsx:211`). Chữ thì đi thẳng qua `alphaExpr` +
`positionExpr` (`render.ts:773`) không qua cổng nào.

Ghi chú ở `reveal-expr.ts` viết: *"Hiện theo TỪNG TIẾNG […] Đây là khác biệt lớn
nhất giữa 'có làm đồ hoạ' và 'có gắn phụ đề'."* Câu đó đúng — nhưng nó đang được
áp như chân lý cho mọi người, trong khi nó là một **lựa chọn phong cách**. Đây
chính là lý do lớn nhất khiến mọi video giống nhau.

**Trục từ khoá hiện gần như vô hình.** `COLOR.main = #FFFFFF alpha 0.92` và
`COLOR.soft = #FFFFFF alpha 1.00` — chênh 0,08 alpha, cùng một màu trắng. Trên nền
video mắt không phân biệt được. Nghĩa là ở kiểu `even` và `taper`, người dùng đánh
dấu từ khoá xong **không thấy gì đổi**; trục đó chỉ có tác dụng thật ở
`keyword-large`, nơi chữ to hẳn lên. Thêm `color.key` là sửa luôn chỗ này.

**Chữ HOA không đổi dữ liệu.** Chỉ đổi lúc vẽ. Đừng đụng `elements.content` —
người dùng mở bảng sửa phải thấy đúng thứ họ đã gõ, không phải bản viết hoa.

## Architecture

Ba trục, hai chỗ phải sửa mỗi trục (máy chủ + trang xem):

| Trục | Máy chủ | Trang xem |
|---|---|---|
| `reveal` cho chữ | bỏ qua `alphaExpr`/`positionExpr` khi `none` | bỏ qua `use-reveal-loop` |
| `letterCase` | `.toUpperCase()` ngay trước `drawtext` | `text-transform: uppercase` |
| `color.key` | thay `COLOR.soft` ở nhánh từ khoá | như trên |

**Đừng nhầm `elements.layout` là một trục.** Cột đó (`db.ts:373`,
`TEXT DEFAULT 'flush'`) là **di sản đã chết** — `text-layout.ts:337` ghi rõ CSDL
còn giữ `mot-tieng-khong-lo`, `flush`, `lech-tam` từ mô hình cũ, và
`overlay-legacy.ts` đang gánh việc quy đổi. Nó đã bị thay bằng `align` +
`emphasis`. Không đọc, không ghi, không hồi sinh.

## Related Code Files

- Modify: `server/style-pack.ts` — ba trục thành giá trị thật
- Modify: `server/render.ts:773` — cổng `reveal` cho chữ · `letterCase`
- Modify: `server/word-layout.ts` — `color.key` ở các nhánh dùng `COLOR.soft`:
  **:208** (`even`) và **:226** (`taper`) là nhánh **từ khoá thật sự**; **:143**
  (`keyword-large` hero) và **:184** (`mixed-size` big) là "chữ được nhấn to",
  cân nhắc riêng — chúng to sẵn rồi nên có cần đổi màu nữa hay không là một lựa
  chọn, không phải mặc nhiên
- Modify: `server/reveal-expr.ts` — nhận `reveal` từ pack
- Modify: `src/dev/overlays/overlay-render.tsx` — cả ba trục
- Modify: `src/dev/overlays/use-reveal-loop.ts` — cổng tắt hiệu ứng
- Modify: `src/dev/overlays/overlay-model.ts` — khai trục mới cho trang tra cứu

## Implementation Steps

### Trục 1 · `reveal` cho chữ (rẻ nhất, làm trước)

1. Thêm cổng ở `render.ts`: `reveal === "none"` thì `alpha` là hằng theo
   `color.alpha`, `x`/`y` là số cố định — không gọi `alphaExpr`/`positionExpr`
2. Cổng tương ứng ở `use-reveal-loop.ts`
3. Kiểm ở `/_dev/overlays`: bật/tắt phải ra hai kết quả, và hai đường vẽ khớp nhau

### Trục 2 · `letterCase`

4. `letterCase === "upper"` thì viết hoa **ngay trước** `drawtext`, sau khi đã đo
   bề rộng — hoặc đo lại bằng chuỗi đã hoa. **Phải đo bằng chuỗi sẽ in ra**: chữ
   hoa rộng hơn chữ thường, đo bằng chuỗi thường là chữ tràn khung
5. Trang xem dùng `text-transform: uppercase`
6. Nâng `lineHeight` theo con số đo được ở phase 1 cho pack dùng chữ hoa

### Trục 3 · `color.key`

7. Thêm `key` vào bộ ba màu của pack
8. Thay `COLOR.soft` bằng `color.key` ở hai nhánh **từ khoá thật sự**:
   `word-layout.ts:208` (`even`) và `:226` (`taper`). Đây là hai chỗ trục từ khoá
   đang không nhìn ra được
9. Cân nhắc riêng `:143` (`keyword-large`) và `:184` (`mixed-size`): chữ ở đó đã
   to hẳn nên tự nổi rồi — đổi màu nữa có thể thành thừa. Thử cả hai cách rồi soi
10. Giữ `COLOR.soft` cho những chỗ nó **không** mang nghĩa từ khoá

## Todo List

- [x] Cổng `reveal` cho chữ ở máy chủ
- [x] Cổng `reveal` ở trang xem
- [x] `letterCase` — đo bề rộng bằng chuỗi ĐÃ hoa
- [x] `letterCase` ở trang xem
- [x] `color.key` thay `COLOR.soft` ở `:208` và `:226`
- [x] Thử `color.key` ở `:143`/`:184`, soi rồi quyết
- [x] `/_dev/overlays` khớp ở mọi tổ hợp mới

## Success Criteria

- [x] Tắt `reveal` thì cả cụm chữ đứng yên, không có tiếng nào trượt vào
- [x] Chữ hoa không tràn khung, không đè dòng trên
- [x] Đánh dấu từ khoá ở kiểu `even` **nhìn thấy được** — đây là phép thử của trục 3
- [x] `elements.content` không đổi khi bật chữ hoa
- [x] `/_dev/overlays` không báo lệch ở tổ hợp nào

## Risk Assessment

| Rủi ro | Mức | Cách xử |
|---|---|---|
| Chữ hoa đo bằng chuỗi thường → tràn khung | **cao** | Phá bảo đảm lớn nhất của sản phẩm. Đo bằng đúng chuỗi sẽ in. Kiểm bằng cụm dài nhất tìm được |
| Vô tình hồi sinh `elements.layout` | vừa | Cột di sản. Sửa `caption-elements.ts` mà tiện tay ghi vào nó là làm sống lại một mô hình đã bỏ. Không đọc, không ghi |
| Tắt `reveal` làm hỏng mốc `enable` | vừa | `enableRange(text.start, text.end)` không liên quan tới hiệu ứng hiện — giữ nguyên |
| Trang xem và máy chủ lệch ở trục mới | vừa | Mỗi trục làm xong chạy `/_dev/overlays` ngay, đừng dồn |

## Next Steps

Phase 4 dùng ba trục này để làm 5 bộ dáng khác nhau rõ rệt.
