# Font Audit — kết quả

**Ngày đo:** 2026-07-31 · **Phase:** 1 · **Trạng thái:** xong

## Kết luận một dòng

**8/8 font ứng viên dùng được** — không font nào bị loại vì thiếu dấu. Kế hoạch 5
bộ dáng không bị bó hẹp: trục font gánh được đúng phần việc của nó.

## Danh sách font dùng được

Mọi tệp nằm trong `assets/fonts/`, tải bằng `node scripts/font-audit/fetch-fonts.mjs`.

| Tệp | Giấy phép | Nghiêng | `lineHeight` tối thiểu (thường / HOA / trộn) | Cảm giác |
|---|---|---|---|---|
| `BeVietnamPro-ExtraBoldItalic.ttf` | SIL OFL 1.1 | ✓ | 1,271 / 1,481 / 1,481 | Nghiêng, thân tròn, thiết kế cho tiếng Việt |
| `BeVietnamPro-Black.ttf` | SIL OFL 1.1 | — | 1,289 / 1,499 / 1,499 | Đứng, nét dày đặc |
| `Anton-Regular.ttf` | SIL OFL 1.1 | — | 1,526 / 1,409 / 1,531 | Hẹp và cao, nét rất dày — dáng tít báo |
| `Archivo-ExpandedBlack.ttf` | SIL OFL 1.1 | — | 1,133 / 1,259 / 1,268 | Rộng bản, nét dày đều |
| `BarlowCondensed-BoldItalic.ttf` | SIL OFL 1.1 | ✓ | 1,124 / 1,310 / 1,310 | Hẹp và nghiêng, nét mảnh hơn |
| `Montserrat-BoldItalic.ttf` | SIL OFL 1.1 | ✓ | 1,124 / 1,274 / 1,274 | Hình học, chữ cái tròn và rộng |
| `Oswald-Bold.ttf` | SIL OFL 1.1 | — | 1,233 / 1,465 / 1,465 | Hẹp, đứng, nét vuông vắn |
| `Lexend-Bold.ttf` | SIL OFL 1.1 | — | 1,220 / 1,327 / 1,333 | Rộng rãi, dễ đọc |

Giấy phép đi kèm từng họ: `assets/fonts/LICENSE-<họ>.txt`. Không tệp nào là font
hệ thống, không tệp nào cần cài đặt trên máy chủ.

Số liệu máy đọc được: `reports/font-audit/line-height-minimums.json`.

## Ba câu hỏi của phase, đã trả lời

### 1 · Có vẽ đủ mọi ký tự không?

**Có, cả 8.** Kiểm bằng bảng `cmap` chứ không bằng mắt — 146 chữ cái tiếng Việt
dựng sẵn, cả hoa lẫn thường (`scripts/font-audit/check-glyph-coverage.py`). Ô
vuông rỗng ở ảnh 1080×1920 thu nhỏ trông y hệt một chữ đậm; bảng `cmap` trả lời
dứt khoát.

**Một ứng viên đã bị loại ở bước này:** `ArchivoBlack-Regular.ttf` thiếu **92**
chữ cái (`ả ạ ằ ắ ẵ ẳ ặ ầ ấ ẫ ẩ ậ …`). Thay bằng bản đông cứng từ font biến
thiên của họ `Archivo` (`wght=900 wdth=115`) — bản đó đủ 146/146. Ghi lại vì đây
là cái bẫy: hai họ cùng tên "Archivo", một họ dùng được một họ không.

### 2 · Hai đường vẽ có ra cùng một hình không?

**Có.** Ảnh so cạnh nhau: `reports/font-audit/compare-<id>.png` (trái ffmpeg,
phải CSS).

Đo bằng số trên câu mẫu ở cỡ 100px:

| Font | ImageMagick | canvas | lệch |
|---|---:|---:|---:|
| Be Vietnam Pro ExtraBold Italic | 1798,0 | 1783,6 | −0,8% |
| Be Vietnam Pro Black | 1812,0 | 1805,3 | −0,4% |
| Anton | 1444,0 | 1424,1 | −1,4% |
| Archivo Expanded Black | 2078,0 | 2056,1 | −1,1% |
| Barlow Condensed Bold Italic | 1234,0 | 1229,5 | −0,4% |
| Montserrat Bold Italic | 1910,0 | 1884,8 | −1,3% |
| Oswald Bold | 1477,0 | 1465,4 | −0,8% |
| Lexend Bold | 1861,0 | 1843,8 | −0,9% |
| **Arial Bold Italic (bản đang chạy)** | 1724,0 | 1710,9 | **−0,8%** |

Mức lệch của mọi ứng viên nằm trong dải **0,4–1,4%**, tức **cùng bậc với 0,8% mà
bản đang chạy vẫn chấp nhận**. Không font nào làm hai đường vẽ xa nhau thêm.

### 3 · Ở `lineHeight = 1.0` với chữ HOA, dấu có đè dòng trên không?

**Có — với mọi font, kể cả Arial.** Xem hai hàng đầu của từng ảnh: hàng dấu chồng
dấu chữ HOA lặp lại liền nhau là phép thử.

`lineHeight` tối thiểu để **không đè một điểm ảnh nào** đo bằng metric font: đỉnh
cao nhất trừ đáy thấp nhất trên tập chữ cái thật sự in ra, chia cho `unitsPerEm`
(`scripts/font-audit/measure-line-height.py`). Đo bằng phép tính vì `drawtext`
xếp dòng đúng bằng `y += fontSize × LINE_HEIGHT`, nên điều kiện không đè là một
bất đẳng thức, không phải một cảm nhận.

**Con số quan trọng nhất của phase này: `LINE_HEIGHT` hiện hành là `1.0`, còn
Arial cần `1.137`.** Nghĩa là sản phẩm **đang** chạy dưới ngưỡng không-đè 12%, và
đó là **cố ý** — ghi chú ở `text-layout.ts:118` nói rõ "các dòng gần CHẠM nhau để
cả khối đọc ra một mảng đặc". Chữ thường mang dấu ít khi rơi đúng trên một chữ có
dấu dưới, nên trong chữ thật hầu như không thấy.

Suy ra hai luật cho phase 4:

- **Bộ dáng chữ thường** giữ được `lineHeight` chặt (1,0–1,1) như hiện nay.
- **Bộ dáng chữ HOA** thì không: chữ HOA đội dấu cao hơn và mọi dòng đều có dấu,
  nên phải lấy sát con số đo được. Trần `1.4` mà phase 2 đặt cho pack là **vừa
  đủ**: font chữ hoa dùng được nhiều `lineHeight` nhất là Anton (1,409 → kẹp về
  1,4), các font còn lại đều dưới trần.

## Việc đã làm ngoài phép đo

**`OVERLAY_FONT` không còn trỏ vào `/System/Library/Fonts/`.** Mặc định mới là
`assets/fonts/BeVietnamPro-ExtraBoldItalic.ttf`.

Vì sao chốt ngay ở đây thay vì để tới phase 4: "giữ Arial" **không phải một lựa
chọn còn sống**. Arial không phát hành kèm phần mềm được, và trên máy chủ Linux
tệp đó không tồn tại — nên phương án "giữ Arial" thật ra là "máy chủ không xuất
được video". Câu hỏi mở của phase 4 vì vậy chỉ còn một đáp án.

Be Vietnam Pro ExtraBold Italic là bản thay gần nhất: cùng dáng đậm-nghiêng, cùng
kiểu chữ hình học, thiết kế riêng cho tiếng Việt.

**Hệ quả phải nói rõ:** dự án dựng trước hôm nay mà xuất lại sẽ ra khác — chữ
rộng hơn Arial khoảng 4% ở cùng cỡ, nên chỗ bẻ dòng có thể dịch. Muốn giữ y
nguyên thì đặt `TEDDIT_FONT` trỏ về tệp cũ; đường đè đó vẫn còn.

**Hai đường vẽ đã được kéo về cùng một font:**

- `server/paths.ts` — `OVERLAY_FONT` và `OVERLAY_FONT_UPRIGHT`
- `src/index.css` — nạp thêm `@fontsource/be-vietnam-pro/800-italic.css`
- `src/dev/overlays/overlay-model.ts` — `OVERLAY_FONT_STACK`
- `src/dev/overlays/overlay-render.tsx` — **bỏ `fontWeight: 600/800` theo từ
  khoá**. Máy chủ chỉ có một tệp font nên nó không có cách nào làm tiếng này đậm
  hơn tiếng kia; với Arial thì trình duyệt gộp cả 600 lẫn 800 về Bold nên khác
  biệt đó chưa từng lộ. Với font thật có đủ hai độ đậm thì nó lộ ngay thành "xem
  một đằng xuất một nẻo". Từ khoá sẽ phân biệt bằng **màu** — đúng trục 3 của
  phase 3.

## Công cụ để lại

```
scripts/font-audit/
├── font-candidates.json      danh sách dùng CHUNG cho cả hai đường vẽ
├── sample-text.txt           chữ mẫu dùng CHUNG
├── fetch-fonts.mjs           tải + đông cứng font biến thiên + kéo giấy phép
├── check-glyph-coverage.py   phủ 146 chữ cái, đọc bảng cmap
├── measure-line-height.py    lineHeight tối thiểu theo metric
├── render-ffmpeg.mjs         in bảng mẫu qua drawtext
├── audit.html                in bảng mẫu qua CSS
└── render-css.py             chụp bảng CSS bằng Chromium
```

Chạy lại toàn bộ:

```bash
node   scripts/font-audit/fetch-fonts.mjs
python3 scripts/font-audit/check-glyph-coverage.py
python3 scripts/font-audit/measure-line-height.py
node   scripts/font-audit/render-ffmpeg.mjs
python3 scripts/font-audit/render-css.py
```

## Đầu vào cho phase sau

**Phase 3 (`letterCase`):** dùng cột "HOA" của bảng trên. Bật chữ hoa **phải**
kéo `lineHeight` lên theo font, không giữ nguyên 1,0.

**Phase 4 (thiết kế bộ dáng):** 8 font, đủ để mỗi bộ một font. Ba nhóm cảm giác
tách bạch — *nghiêng tròn* (Be Vietnam Pro Italic, Montserrat Italic), *hẹp cao*
(Anton, Oswald, Barlow Condensed), *rộng đặc* (Archivo Expanded Black, Be Vietnam
Pro Black), *êm* (Lexend). Ảnh so cạnh nhau đã có sẵn để chọn.

## Câu chưa dứt

Không có.
