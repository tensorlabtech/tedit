---
phase: 2.5
title: "Align Word Baselines"
status: completed
priority: P1
effort: "3h"
dependencies: [2]
---

# Phase 2b: Align Word Baselines

<!-- Chặng chèn thêm — không có trong kế hoạch gốc. Bộ kiểm bố cục của chặng 2
     lôi ra lỗi này, và nó cản thẳng chặng 5. -->

## Overview

`drawtext` đặt mép trên **vệt mực** vào đúng `y`, chứ không đặt hộp dòng. Nên hai
tiếng vẽ ở cùng một `y` mà một tiếng có dấu chồng dấu (`ấ`, `Ừ`) còn tiếng kia
chỉ có chữ thấp (`an`) thì **chân chữ của chúng lệch nhau**.

Trang xem KHÔNG có lỗi này — CSS xếp theo chân chữ. Nên đây đúng là lỗi "xem một
đằng xuất một nẻo", loại lỗi cả hệ này sinh ra để chống.

## Vì sao `overlay-parity` không bắt được

Nó so **số dòng**, **cỡ chữ** và **hộp bao khối**. Cả ba đều tính từ hộp DÒNG.
Chỗ lệch nằm ở vệt mực *bên trong* hộp dòng, nên nó đi qua cả ba phép so mà không
để lại dấu vết. Bộ kiểm bố cục của chặng 2 lúc đầu cũng vậy — nó chỉ ghi hộp bao,
nên tắt phép bù đi mà nó vẫn báo xanh. Đã vá: đường cơ sở nay ghi thêm `wordTop`
và `wordBottom`.

## Đo được

Trên chính ffmpeg, cỡ chữ 120, chỉ dùng tiếng **không có nét thòng** (nên mép
dưới vệt mực chính là chân chữ):

| Font | Trước | Sau |
|---|---|---|
| Anton | 37px | 2px |
| Montserrat | 43px | 2px |
| Archivo Expanded | 44px | 6px |
| Barlow Condensed | 44px | 2px |
| Lexend | 50px | 1px |
| Be Vietnam Pro Black | 54px | 1px |
| Be Vietnam Pro ExtraBold Italic | 55px | 1px |
| Lora | 56px | 1px |
| Oswald | 60px | 2px |
| Playfair Display | 66px | 2px |
| Dancing Script | 73px | 7px |

Tức từ **31–61% cỡ chữ** xuống **0,8–6%**. Phần dư là chênh lệch giữa cách
ImageMagick và freetype rasterise, không phải sai mô hình.

Chứng cứ: `anh/chan-chu-truoc-sau.png` · `anh/chan-chu-troi-theo-dau.png`

## Cách bù

`magick label:` dựng một hộp dòng cao **cố định** cho mọi tiếng của một font ở
một cỡ; vệt mực nằm trong hộp ấy ở độ cao khác nhau. Đo ở cỡ 100 (Playfair):

| Tiếng | Vệt mực bắt đầu ở | Vệt mực cao | Mép dưới |
|---|---|---|---|
| `an` | +56 | 54 | **110** |
| `ấn` | +2 | 108 | **110** |
| `khó` | +26 | 84 | **110** |
| `ĐỪNG` | +14 | 96 | **110** |

Mép dưới bằng nhau ở mọi tiếng — đó chính là chân chữ. Nên phép bù là:

```
y_vẽ = y_hàng + khoảng-trống-phía-trên-vệt-mực
```

Cộng nó vào thì mọi tiếng đặt chân lên cùng một đường, đúng chỗ hộp dòng chỉ
định — cũng chính là chỗ CSS đặt chân chữ. Phép bù này **kéo hai đường vẽ về một
mối**, không phải thêm một luật riêng cho máy chủ.

Đo ở cỡ gốc rồi nhân tỉ lệ và nhớ theo tiếng, đúng nếp `baseWidth`.

## Related Code Files

- Modify: `server/media-tools.ts` — `measureInkTop()`
- Modify: `server/text-layout.ts` — `inkTopOffset()`, có nhớ
- Modify: `server/word-layout.ts` — cộng vào `y` của từng tiếng trong `placeWords`
- Modify: `scripts/layout-guard/check-layout.ts` — đường cơ sở ghi thêm
  `wordTop`/`wordBottom`

## Todo List

- [x] `measureInkTop` đọc `%O` của ảnh đã `-trim`
- [x] `inkTopOffset` nhớ theo `(font, tiếng)`, đo ở cỡ 100 rồi nhân tỉ lệ
- [x] `placeWords` cộng vào `y`
- [x] Đường cơ sở của bộ kiểm bố cục nhìn thấy được chỗ đứng dọc từng tiếng
- [x] Xác nhận bộ kiểm BẮT ĐƯỢC: tắt phép bù → 194/200 tổ hợp báo lệch

## Success Criteria

- [x] Trôi chân chữ xuống dưới 10px ở cỡ 120 với **cả mười một** font
- [x] `npm run check:all` xanh
- [x] `overlay-parity` 140/140 · `block-box-parity` 140/140
- [x] Dựng khung thật, nhìn thấy được: `anh/chan-chu-truoc-sau.png`

## Hệ quả phải biết

**Khối chữ tụt xuống một chút.** Tiếng không có dấu cao trước đây bị vẽ CAO hơn
chỗ của nó; nay chúng về đúng chỗ, nên hàng toàn tiếng thấp tụt xuống tới ~0,5
lần cỡ chữ. Đây là sửa đúng chứ không phải hồi quy: chỗ mới là chỗ hộp dòng chỉ
định, và là chỗ trang xem vẫn luôn vẽ.

**Vệt mực có thể chìa xuống dưới hộp bao khoảng 10% cỡ chữ.** Hộp bao là hộp
DÒNG, còn chân chữ nằm thấp hơn mép dưới hộp dòng một chút ở phần lớn font. Dải
an toàn dưới rộng 20% chiều cao khung (216px) nên nó thừa sức chứa, nhưng bộ kiểm
bố cục canh hộp bao chứ không canh vệt mực — nếu về sau bóp `SAFE.bottom` thì đây
là chỗ phải nhớ.

**Mỗi tiếng thêm một lượt gọi ImageMagick** (có nhớ). `check:layout` chạy từ 6,9
lên 10,8 giây; `check:all` 14,5 → 18 giây.
