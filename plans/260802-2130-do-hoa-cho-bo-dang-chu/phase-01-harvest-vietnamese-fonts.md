---
phase: 1
title: "Harvest Vietnamese Fonts"
status: completed
priority: P1
effort: "2h"
dependencies: []
---

# Phase 1: Harvest Vietnamese Fonts

<!-- Updated: Validation Session 1 - dùng lại scripts/font-audit thay vì viết mới -->

## Overview

Kho font hiện có **9 tệp, cả 9 đều sans đậm**. Vai chữ thứ hai (cảm xúc) không
tồn tại được nếu không có serif và script. Chặng này thêm font — **bằng công cụ
đã có sẵn**, không viết mới.

## Key Insights

`scripts/font-audit/` đã có đủ ba mảnh, và làm đúng cách:

| Tệp | Việc |
|---|---|
| `check-glyph-coverage.py` | đọc bảng `cmap` bằng `fontTools`, dựng bảng chữ Việt từ nguyên âm × 6 thanh |
| `fetch-fonts.mjs` | tải từ `google/fonts`, **kéo theo tệp giấy phép**, đông cứng font biến thiên |
| `font-candidates.json` | danh sách ứng viên kèm `cssStack`, `cssWeight`, `italic`, `license`, `feel` |

Nó **đọc `cmap` chứ không nhìn ảnh** — đúng cách, vì ô vuông rỗng ở ảnh thu nhỏ
trông y hệt một chữ đậm.

### Cạm bẫy đã có lời giải sẵn: font biến thiên

`fetch-fonts.mjs:8` — *"Font biến thiên (`Montserrat[wght].ttf`) không dùng thẳng
được: freetype vẽ thể mặc định, tức là Regular, nên chữ in ra mảnh dính. Phải
đông cứng thành một thể tĩnh bằng `fonttools varLib.instancer` trước khi ffmpeg
đụng tới."*

Bốn ứng viên thử trong phiên brainstorm — `PlayfairDisplay[wght]`, `Lora[wght]`,
`DancingScript[wght]`, `Bitter[wght]` — **đều là font biến thiên**. Tải thẳng
bằng `curl` như lúc thử là ffmpeg sẽ vẽ thể Regular. Phải đi qua `fetch-fonts.mjs`.

### Kết quả đo thật (phiên brainstorm)

8 font thử, **2 trượt**: `Caveat` mất `Ở Ự ượ`, `Bebas Neue` mất gần hết.
Đạt: Playfair Display · Lora · Bitter · Dancing Script · Pacifico · Patrick Hand.
Chứng cứ: `anh/kiem-dau-viet-truot.png` · `anh/kiem-dau-viet-dat.png`.

## Requirements

- Functional: thêm ≥1 serif và ≥1 script/handwriting đủ dấu Việt, qua đúng đường
  ống đã có.
- Non-functional: `check-glyph-coverage.py` phải nằm trong `check:all` — hiện nó
  chạy tay, nên không ai biết khi một font mới thiếu glyph.

## Architecture

Không tệp mới. Chỉ thêm mục vào `font-candidates.json` và nối script vào npm.

```
scripts/font-audit/font-candidates.json   ← thêm ứng viên
scripts/font-audit/fetch-fonts.mjs        ← chạy để tải + đông cứng + lấy license
scripts/font-audit/check-glyph-coverage.py ← nối vào check:all
```

`check:all` sẽ cần `python3` + `fontTools`. Đây là ràng buộc mới cho CI — nêu rõ
trong `README.md` cạnh chỗ đã nêu `ffmpeg`/`ffprobe`/`magick`.

## Related Code Files

- Modify: `scripts/font-audit/font-candidates.json` — thêm ứng viên serif + script
- Modify: `package.json` — `check:fonts`, nối vào `check:all`
- Modify: `src/style-pack-fonts.css` — `@font-face` cho font mới
- Modify: `README.md` — ghi phụ thuộc `python3` + `fontTools`
- Create: `assets/fonts/<serif>.ttf` · `<script>.ttf` + `LICENSE-*.txt` (do
  `fetch-fonts.mjs` sinh ra, không viết tay)

## Implementation Steps (tests first)

1. **Chạy `check-glyph-coverage.py` trên 9 font hiện có → phải ĐẠT hết.** Khoá
   hành vi hiện tại trước khi thêm gì. Trượt ở đây là lỗi có sẵn, xử lý trước.
2. **Xác nhận nó bắt được font hỏng.** Tải `Caveat[wght].ttf` vào `assets/fonts/`
   tạm, chạy lại → phải ĐỎ và chỉ ra ký tự thiếu. Xoá sau khi xác nhận. Không bắt
   được thì phép kiểm vô dụng và mọi thứ sau đó vô nghĩa.
3. Thêm `"check:fonts": "python3 scripts/font-audit/check-glyph-coverage.py"` vào
   `package.json`, nối vào `check:all`.
4. Thêm mục vào `font-candidates.json` cho ứng viên đã kiểm đạt: tối thiểu một
   serif (Playfair Display / Lora / Bitter) và một script (Dancing Script /
   Pacifico / Patrick Hand). Khai đủ `remote`, `license`, `cssStack`,
   `cssWeight`, `italic`, `feel` theo đúng dạng các mục đang có.
5. Chạy `node scripts/font-audit/fetch-fonts.mjs` — nó tải, **đông cứng thể
   biến thiên**, và kéo tệp giấy phép về.
6. Chạy `npm run check:fonts` → phải xanh với font mới.
7. Khai `@font-face` trong `src/style-pack-fonts.css`, tên họ khớp **chính xác**
   `cssStack` trong `font-candidates.json`.
8. Ghi phụ thuộc `python3` + `fontTools` vào `README.md`.

## Todo List

- [x] 8 font hiện có đều đạt (kho có **8** tệp `.ttf`, không phải 9 — 9 là số
      tính cả font tham chiếu Arial của macOS, thứ cố ý không vào danh sách)
- [x] Caveat bị bắt trượt (rồi xoá) — thiếu **80** chữ cái, không phải 3
- [x] `check:fonts` nằm trong `check:all`
- [x] Ứng viên thêm vào `font-candidates.json`
- [x] `fetch-fonts.mjs` chạy xong, có `.ttf` + `LICENSE-*.txt`
- [x] `@font-face` khai xong, tên họ khớp
- [x] `README.md` ghi phụ thuộc mới

## Success Criteria

- [x] `npm run check:all` xanh — 92 đạt, 0 trượt
- [x] Thả một font thiếu dấu vào `assets/fonts/` → `check:all` đỏ
- [x] Font mới **không** phải thể biến thiên — nay `check:fonts` tự canh bảng
      `fvar`, không phải kiểm tay
- [x] Font mới hiện đúng dáng, không mảnh dính — chứng cứ
      `anh/font-moi-chang-01.png`, in bằng chính đường ffmpeg

## Việc đã làm khác kế hoạch

**Phép kiểm quét THƯ MỤC thay vì quét danh sách ứng viên.** Bản cũ chỉ kiểm font
có tên trong `font-candidates.json`, nên thả một tệp lạ vào `assets/fonts/` là nó
không thấy — mà đó đúng là tiêu chí nghiệm thu của chặng này. Nay nó quét
`assets/fonts/*.ttf`, và ứng viên đã khai mà thiếu tệp cũng tính là trượt.

**Thêm phép chặn font biến thiên chưa đông cứng.** `fetch-fonts.mjs:8` cảnh báo
điều này nhưng không có gì canh: tải tay bằng `curl` là lọt. Đây là ca duy nhất
mà mọi phép kiểm khác đều xanh còn bản xuất thì sai dáng, nên nó xứng đáng một
phép kiểm chứ không phải một dòng ghi chú.

**Thu ba font chứ không phải hai.** Chặng 5 cần ba pack, mỗi pack một vai cảm
xúc riêng; hai font thì hai pack phải dùng chung một họ và mất một trục phân
biệt. Playfair Display (serif tương phản mạnh) · Lora Bold Italic (serif ấm) ·
Dancing Script (script duy nhất đủ dấu Việt).

**Dancing Script nét mảnh hơn hẳn ba họ kia ở cùng cỡ chữ** (xem ảnh chứng cứ).
Không phải lỗi đông cứng — 700 đã là thể đậm nhất của họ. Hệ quả: nó chỉ dùng
được ở vai `accent` với cụm ngắn cỡ lớn, không dùng cho câu tường thuật. Đã ghi
vào `feel` của mục ứng viên.

## Risk Assessment

| Rủi ro | Giảm thiểu |
|---|---|
| **Tải thẳng font biến thiên → chữ mảnh dính** | Bắt buộc đi qua `fetch-fonts.mjs`; tiêu chí nghiệm thu kiểm bảng `fvar` |
| `check:all` cần `python3` + `fontTools` trong CI | Ghi vào `README.md`; nếu CI không có Python thì đây là lý do để cân lại, nêu sớm |
| Script/handwriting đủ dấu Việt hiếm | Đã có 3 ứng viên kiểm đạt |
| Font mới làm nặng bundle | `style-pack-fonts.css:17` — trình duyệt chỉ tải khi có thứ dùng tới họ đó |

## Security Considerations

`fetch-fonts.mjs` gọi mạng và ghi tệp — chạy tay, không vào `check:all`, không
chạy trên máy chủ. `check-glyph-coverage.py` chỉ đọc tệp cục bộ.

## Next Steps

Chặng 2 cần ít nhất hai họ font đã nằm trong `assets/fonts/`, đã đông cứng, đã
khai `@font-face`.
