---
phase: 2
title: "Graphics Asset Pipeline"
status: completed
priority: P1
effort: "1d"
dependencies: []
---

# Phase 2: Graphics Asset Pipeline

## Overview

Đường ống ba tầng: **SVG (nguồn, trong git) → PNG (bản dựng) → tô màu lúc chạy**.
Chưa vẽ gì lên video ở chặng này — chặng 3 và 4 mới dùng. Đây là hạ tầng, và nó
tách ra riêng vì làm sai ở đây thì hai chặng sau đều phải làm lại.

## Key Insights

**Đã kiểm thật trên máy này, không phải đọc tài liệu:**

| Điều | Kết quả |
|---|---|
| `rsvg-convert` | có, 2.62.2 |
| `magick` render SVG | **hỏng** — cùng một tệp, ra ảnh trắng trơn, mất cả hình |
| `alphaextract` + `alphamerge` | chạy, tô đúng màu |

Hai điều đầu quyết định kiến trúc: **đổi SVG→PNG chỉ được xảy ra lúc build.** Nếu
để lúc chạy thì máy chủ phải có `rsvg-convert`, mà nếu nó thiếu và rơi về `magick`
thì hình sai **một cách âm thầm** — tệ hơn hẳn hỏng hẳn.

Điều thứ ba quyết định mô hình dữ liệu: **màu tách khỏi hình.** Một tệp `khung.svg`
dùng cho cả mười pack, mỗi pack khai một mã màu. Không có nó thì thêm một pack là
thêm một bộ tệp, và catalog thôi là bảng số.

## Architecture

```
assets/graphics/
├── src/            # SVG nguồn — nét vẽ bằng currentColor, KHÔNG khai màu
├── build/          # PNG sinh ra — theo git hay không, xem "Quyết định" dưới
└── manifest.json   # loại, vùng co, chỗ neo, luật loại trừ
```

```jsonc
{
  "khung-mong": {
    "kind": "plate",          // plate | wrap | spot
    "file": "khung-mong.png",
    // Loại trừ: pack đã có `box` thì không được thêm `wrap` cùng màu —
    // hai lớp cùng nhấn một việc thì triệt tiêu nhau.
    "excludes": ["box"]
  }
}
```

**Quyết định cần chốt lúc thi công: PNG có vào git không.**
- *Vào git* — máy chủ không cần `rsvg-convert`, `npm run build` không thêm bước,
  nhưng nhị phân sinh ra nằm trong lịch sử.
- *Không vào git* — sạch hơn, nhưng CI và máy chủ phải có `librsvg`.

Nghiêng về **vào git**: cùng lý lẽ với `assets/fonts/` đã theo repo, và ràng buộc
số 3 của đợt này là *máy chủ không thêm phụ thuộc nào*.

## Related Code Files

- Create: `assets/graphics/src/*.svg` · `assets/graphics/manifest.json`
- Create: `scripts/graphics/build-graphics.mjs` — `rsvg-convert`, kiểm đầu ra
- Create: `scripts/graphics/check-graphics.ts` — nối vào `check:all`
- Modify: `server/style-pack.ts` — đọc manifest? **KHÔNG** — xem ghi chú dưới
- Modify: `package.json` — `graphics:build`, `check:graphics`

> `style-pack.ts` **không được** đọc manifest: nó bị import từ trang xem nên
> không đụng `node:*` được. Manifest đọc ở tầng máy chủ và ở bước build; trang
> xem nhận đường dẫn PNG như một chuỗi.

## Implementation Steps (tests first)

1. **Phép kiểm trước, phải ĐỎ:**
   - mọi khoá trong manifest có tệp `.svg` tương ứng trong `src/`
   - mọi `.svg` trong `src/` có mục trong manifest (hai chiều — tệp mồ côi là
     tệp không ai biết có dùng hay không)
   - PNG đã dựng tồn tại và **có kênh alpha** — thiếu alpha thì `alphamerge` ra
     một khối màu đặc, và nó trông như một lỗi vẽ chứ không như một hình
2. **Phép kiểm chống render sai:** dựng một SVG mẫu, khẳng định PNG ra có đúng
   số điểm ảnh đục trong dải mong đợi. Đây là thứ bắt được ca `magick` rơi về bộ
   MSVG nội bộ — ca đã xảy ra thật.
3. `build-graphics.mjs`: quét `src/`, gọi `rsvg-convert`, ghi `build/`. **Dừng
   ngay** nếu không có `rsvg-convert` — không rơi về `magick`.
4. Vẽ 3–4 SVG đầu tiên bằng script sinh, không vẽ tay: khung mảnh, khung dày,
   lưới, film gate.
5. Nối `check:graphics` vào `check:all`.

## Todo List

- [x] Phép kiểm manifest ↔ src hai chiều
- [x] Phép kiểm PNG có kênh trong suốt
- [x] Phép kiểm chống render sai — **phần điểm ảnh đục phải trong dải**
- [x] Phép kiểm loại hình nằm trong vốn từ ĐÓNG
- [x] `render-svg-to-png.mjs`, dừng hẳn khi thiếu `rsvg-convert`
- [x] 4 SVG đầu tiên, **sinh từ tham số** chứ không vẽ tay
- [x] `check:graphics` trong `check:all`

## Success Criteria

- [x] `npm run check:all` xanh — thêm 24 phép kiểm
- [x] Xoá một PNG đã dựng → `check:all` đỏ
- [x] Thêm một SVG mà quên khai manifest → `check:all` đỏ
- [x] Dựng bằng `magick` thay vì `rsvg-convert` → `check:all` đỏ

## Cạm bẫy `magick`: đo lại thì nó KHÁC brainstorm ghi

Brainstorm ghi *"`magick` ra ảnh trắng trơn, mất hẳn thân mũi tên"*. Thử lại trên
chính bốn hình của đợt này: `magick` ra ảnh **đục 100%** — vẫn có kênh trong suốt,
vẫn đúng khổ 1080×1920, nên nó **qua sạch** ba phép kiểm hình thức đầu tiên.

Kết quả cuối giống nhau (hình hỏng), nhưng cách hỏng khác, và điều đó đổi luôn
phép kiểm: chỉ chặn sàn thì ca này lọt. Nên dải là **hai đầu** — 0,05% tới 60%.
Bốn hình thật đo được 0,34%–6,6%, nên cả hai đầu đều còn xa mức thật.

Bài học: cạm bẫy chép từ báo cáo sang phải **thử lại**, không phải chép cả con số.

## Ba quyết định

**PNG đi theo git.** Cùng lý lẽ với `assets/fonts/`, và nó giữ được ràng buộc số
3 của đợt này — *máy chủ không thêm phụ thuộc nào*. Cả kho nặng **80 KB**; hình
một màu nén rất tốt.

**Thư mục ra tên `png/` chứ không tên `build/`.** Những tệp này PHẢI được commit.
Một thư mục tên `build` là thứ mà bất kỳ luật `.gitignore` chung nào cũng có thể
nuốt mất về sau, và lúc đó lỗi lộ ra ở máy chủ dưới dạng "không tìm thấy hình"
chứ không lộ ra lúc sửa.

**SVG sinh từ tham số, nhưng vẫn sửa tay được.** `make-shapes.mjs` là chỗ bắt đầu,
không phải cái cổng duy nhất: thả một SVG vào `src/` cũng được, `check:graphics`
chỉ đòi nó có mục trong manifest. Sinh vì một cái khung là bốn con số — sửa độ dày
viền là sửa một số rồi chạy lại, không phải mở phần mềm vẽ.

## Bốn hình đầu tiên

| Tên | Đục | Dùng cho |
|---|---|---|
| `khung-mong` | 1,66% | viền mảnh sát mép — dấu "có chủ ý" nhẹ nhất |
| `khung-day` | 6,57% | viền dày, đọc ra ngay ở ảnh thu nhỏ |
| `luoi-ba` | 0,87% | lưới một phần ba — dấu bố cục của máy ảnh |
| `dau-goc` | 0,35% | bốn dấu góc kiểu khung ngắm, không bao giờ chạm chữ |

Chưa bộ dáng nào dùng — chặng 3 mới nối chúng vào.
