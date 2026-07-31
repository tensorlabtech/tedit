---
phase: 1
title: "Font Audit"
status: done
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: Font Audit

## Overview

In một bảng chữ mẫu tiếng Việt qua các tệp font ứng viên, ở cả chữ hoa lẫn chữ
thường, qua **cả hai đường vẽ** (ffmpeg và CSS), rồi nhìn ảnh mà chốt font nào
dùng được.

Không viết một dòng code sản phẩm nào ở phase này. Đây là một phép đo.

## Vì sao làm đầu tiên

Đây là thứ duy nhất có thể giết cả kế hoạch. Nếu chỉ có 1–2 font dùng được thì
5 bộ dáng vẫn làm được, nhưng phải phân biệt nhau bằng **hoa/thường + màu +
nhịp** thay vì bằng font — và điều đó phải biết **trước** khi thiết kế bộ dáng ở
phase 4, không phải sau.

## Requirements

**Functional**
- Ra được danh sách tệp `.ttf` dùng được, kèm đường dẫn tuyệt đối
- Ra được con số `lineHeight` tối thiểu cho từng font ở dạng chữ HOA
- **Font đóng gói vào repo**, không trỏ vào font hệ thống
- Ảnh kết quả lưu lại được để đối chiếu về sau

**Non-functional**
- Chạy được bằng `magick` và `ffmpeg` đã có sẵn trong PATH, không cài thêm gì
- Render ra kết quả **giống nhau trên mọi máy**, không phụ thuộc hệ điều hành

## Key Insights

**Chỉ nhận `.ttf` / `.otf`.** ffmpeg vẽ chữ bằng `fontfile='...'` (`render.ts:769`)
và không đọc được `.woff2`. Google Fonts hay chỉ cho tải `.woff2` — đó chính là
lý do `paths.ts:41` ghi Be Vietnam Pro không dùng được.

**Cái phải kiểm là dấu chồng dấu.** Tiếng Việt có `ế` `ữ` `ặ` `Ắ` — nhiều font
phương Tây không vẽ, ffmpeg in ra ô vuông rỗng hoặc rụng dấu. Font caption viral
phổ biến nhất (Bebas Neue) nằm trong nhóm này.

**Font phải đi theo repo, không lấy của hệ thống.** `OVERLAY_FONT` hiện trỏ vào
`/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf` — chỉ có trên macOS.
Máy chủ Linux không có tệp đó, và 5 bộ dáng sẽ nhân vấn đề này lên 5 lần. Nên mọi
font vào danh sách đều phải: (1) có giấy phép cho phép phát hành kèm phần mềm,
(2) nằm trong repo, (3) trỏ tới bằng đường dẫn tương đối so với gốc dự án.
`TEDDIT_FONT` trong `.env.example` vẫn giữ để đè khi cần.

**Chữ HOA đội dấu cao hơn chữ thường.** Ở `LINE_HEIGHT = 1.0`, dấu của dòng dưới
chạm hoặc đè chân chữ dòng trên. ffmpeg **không cắt** — nó vẽ tràn, nên không mất
chữ. Nhưng CSS **có** cắt khi tràn container, nên rủi ro thật là **xem một đằng
xuất một nẻo**, đúng thứ `/_dev/overlays` sinh ra để bắt.

## Architecture

```
scripts/font-audit/
├── sample-text.txt      chữ mẫu dùng chung cho cả hai đường
├── render-ffmpeg.sh     drawtext qua từng font → PNG
└── audit.html           cùng chữ mẫu, cùng font, vẽ bằng CSS
                         → mở trong trình duyệt, chụp lại
```

Hai đường phải dùng **chung một tệp chữ mẫu** và **chung một danh sách font**.
Khác nhau ở đâu là chỗ đó lệch.

## Related Code Files

- Create: `scripts/font-audit/` (cả thư mục — công cụ đo, không phải mã sản phẩm)
- Create: `assets/fonts/` — font đóng gói theo repo
- Modify: `server/paths.ts:43` — `OVERLAY_FONT` trỏ vào `assets/fonts/`, không
  trỏ vào `/System/Library/Fonts/`
- Read: `.env.example:60` — `TEDDIT_FONT` giữ nguyên làm đường đè
- Read: `server/render.ts:769` (cách gọi `drawtext`)
- Read: `src/dev/overlays/overlay-render.tsx` (cách CSS vẽ, `WebkitTextStroke`)

## Implementation Steps

1. **Soạn chữ mẫu** — một tệp, ba phần:
   - hàng dấu chồng dấu chữ hoa: `Ế Ữ Ặ Ắ Ổ Ỗ Ự Ỡ`
   - hàng dấu chồng dấu chữ thường: `ế ữ ặ ắ ổ ỗ ự ỡ`
   - một câu thật, đủ dài để xuống 2–3 dòng, có cả hoa lẫn thường
2. **Gom font ứng viên** — 6–8 tệp `.ttf`, **giấy phép cho phép phát hành kèm**
   (SIL OFL, Apache 2.0…). Font hệ thống macOS chỉ dùng để so sánh, **không** vào
   danh sách cuối. Chép vào `assets/fonts/` trong repo.
3. **In qua ffmpeg** — mỗi font một PNG 1080×1920, dùng đúng bộ tham số hiện
   hành: `borderw` theo `EDGE_SHARE = 0.022`, `bordercolor = black@0.7`.
4. **In qua CSS** — cùng chữ mẫu, cùng font, `WebkitTextStroke` theo đúng công
   thức ở `overlay-render.tsx:267`.
5. **Đặt cạnh nhau mà soi** — với từng font trả lời ba câu:
   - có vẽ đủ mọi ký tự không (hay có ô vuông / rụng dấu)?
   - hai đường vẽ có ra cùng một hình không?
   - ở `lineHeight = 1.0` với chữ HOA, dấu có đè dòng trên không?
6. **Đo `lineHeight` tối thiểu** — với font nào chữ hoa bị đè, tăng dần
   `lineHeight` tới lúc hết đè. Ghi con số đó lại.
7. **Chốt danh sách** — viết kết quả vào `plans/.../reports/font-audit.md`:
   font nào dùng được, đường dẫn, `lineHeight` tối thiểu cho hoa và cho thường.

## Todo List

- [x] Soạn tệp chữ mẫu
- [x] Gom 6–8 tệp `.ttf` ứng viên, kiểm giấy phép, chép vào `assets/fonts/`
- [x] `OVERLAY_FONT` trỏ vào `assets/fonts/`, bỏ đường dẫn font hệ thống
- [x] Script in qua ffmpeg
- [x] Trang in qua CSS
- [x] Soi từng font, trả lời ba câu
- [x] Đo `lineHeight` tối thiểu cho dạng chữ hoa
- [x] Viết `reports/font-audit.md`

## Success Criteria

- [x] Có danh sách font dùng được, **mọi tệp nằm trong `assets/fonts/`**
- [x] Mỗi font dùng được đều vẽ đủ `Ế Ữ Ặ Ắ` ở **cả hai** đường vẽ
- [x] Có con số `lineHeight` tối thiểu cho dạng chữ HOA của từng font
- [x] Mọi font đều có giấy phép cho phép phát hành kèm, ghi rõ trong báo cáo
- [x] Không còn chỗ nào trỏ vào `/System/Library/Fonts/`
- [x] Ảnh kết quả lưu lại được để đối chiếu ở phase 4

## Risk Assessment

| Rủi ro | Mức | Cách xử |
|---|---|---|
| Chỉ 1–2 font dùng được | **cao** | Kế hoạch vẫn chạy: bộ dáng phân biệt bằng hoa/thường + màu + nhịp. Nhưng phải biết ngay bây giờ để phase 4 thiết kế đúng |
| Font đủ dấu nhưng dấu xấu ở cỡ nhỏ | vừa | Loại ở bước soi. Chữ dẫn ở kiểu `taper` chỉ bằng 0,45 cỡ chữ ý — cỡ nhỏ nhất phải kiểm là chỗ đó |
| Hai đường vẽ ra khác nhau | vừa | Là phát hiện có giá trị, không phải lỗi của phase này. Ghi lại, xử ở phase 2 |
| Giấy phép font | **cao** | Đã chốt: font phải đóng gói vào repo, nên giấy phép là điều kiện vào danh sách, không phải chuyện kiểm sau. Font hệ thống macOS **không** phát hành kèm được |
| Đổi `OVERLAY_FONT` làm lệch bản render cũ | vừa | Nếu font gốc đổi khỏi Arial thì mọi dự án cũ xuất lại sẽ khác. Hoặc giữ Arial cho bộ dáng gốc, hoặc chấp nhận và nói rõ. Chốt ở phase 4 |

## Next Steps

Kết quả phase này là đầu vào bắt buộc của **phase 4** (thiết kế bộ dáng) và ảnh
hưởng tới trục `letterCase` ở **phase 3**.
