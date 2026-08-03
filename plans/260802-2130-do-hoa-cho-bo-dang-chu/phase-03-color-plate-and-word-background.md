---
phase: 3
title: "Color Plate And Word Background"
status: completed
priority: P1
effort: "1d"
dependencies: [2]
---

# Phase 3: Color Plate And Word Background

## Overview

Thêm **mảng màu** — dải màu đặc chiếm một phần khung — và khai thác hai trục đã
có mà gần như bỏ trống: `box` (2/10 pack, cả hai đen) và `highlight` (1/10 pack).
Không một tệp đồ hoạ nào trong chặng này.

## Key Insights

Mổ `focus` (`anh/mo-focus.jpg`) cho thấy một style **dễ nhận ra bậc nhất bảng**
được dựng hoàn toàn bằng khối màu và nền chữ: khối xanh đặc nửa dưới khung, phụ
đề chữ đen nền trắng, từ nhấn **đảo màu**, khung viền dày bao video thu nhỏ,
chuyển cảnh bằng mảng màu quét ngang.

`drawbox` + `drawtext`. Không PNG, không SVG, không phụ thuộc mới.

Đây là bằng chứng rằng đợt 1 **không cần đồ hoạ vẫn tách được các pack**.

## Requirements

- Functional: `StylePack` khai được một mảng màu; `box` và `highlight` nhận màu
  tuỳ ý (hiện đều đen/vàng cứng ở vài pack).
- Non-functional: mảng màu **không được che chữ**. Nó phải nằm ngoài dải mà
  `text-layout.ts` dùng, hoặc chữ phải né nó — chọn một, đừng để cả hai tự do.

## Architecture

```ts
/**
 * Mảng màu đặc. `null` là không có.
 * Vẽ SAU hình, TRƯỚC chữ — nó là nền cho chữ, không phải lớp phủ lên chữ.
 */
plate: {
  band: Band;          // dùng lại vốn từ ĐÓNG đã có: top | middle | bottom
  heightShare: number; // phần chiều cao khung, ví dụ 0.11
  tone: Tone;
} | null;
```

**Quyết định về va chạm với chữ:** `plate` chỉ được đặt ở `top` hoặc `bottom`, và
dải nó chiếm phải nằm **ngoài** vùng `SAFE`. Lý do chọn hướng này thay vì cho chữ
né: `SAFE` là hằng số sản phẩm, mọi thứ khác đã bám vào nó; cho mảng màu lấn vào
rồi bắt chữ tính lại là mở một đường cho chữ nhảy chỗ giữa hai lần dựng.

Hệ quả thực tế đã đo: footage của người dùng quay **ngang 1280×720** rồi crop
dọc, nên đáy khung là bàn tay và mic. Mảng màu đáy dày 214px che đúng vào đó
(`anh/ba-bo-thu-tren-footage-that.jpg`). Bản sửa hạ xuống 114px và **đặt chữ vào
trong mảng** — mảng màu trống là mảng màu trông như lỗi render.

Nên thêm ràng buộc: `plate` mà không có chữ nào nằm trong nó thì `check` cảnh báo.

## Related Code Files

- Modify: `server/style-pack.ts` — kiểu `plate`
- Modify: `server/style-pack-catalog.ts` — 3 pack khai `plate`, đổi màu `box`/`highlight`
- Modify: `server/render.ts` — `drawbox` cho plate, đặt đúng thứ tự lớp
- Modify: `src/dev/overlays/overlay-render.tsx` — plate bằng CSS
- Modify: `server/style-pack-check.ts` — phép kiểm mới

## Implementation Steps (tests first)

1. **Phép kiểm trước, phải ĐỎ:**
   - `plate.band` chỉ nhận `top` hoặc `bottom`
   - dải `plate` chiếm không được chồng lấn vùng `SAFE`
   - `plate` có thì phải có chữ nằm trong nó (tránh mảng màu trống)
   - **tương phản**: `box.tone` với màu chữ vẽ trên nó phải đạt ngưỡng tối thiểu;
     tính bằng độ chói tương đối, ngưỡng cụ thể chốt lúc thi công
2. **Luật loại trừ** — bài học từ ba bộ thử hỏng lần đầu: pack **không được**
   khai đồng thời `box` và `highlight.box` cùng màu. Hai thứ đó nhấn cùng một
   việc; chồng lên nhau thì triệt tiêu nhau và đọc ra như lỗi vẽ.
   Xem `anh/ba-bo-thu-tren-footage-that.jpg`.
3. Thêm kiểu `plate` vào `style-pack.ts`, mặc định `null` cho 7 pack ngoài phạm vi.
4. `render.ts`: `drawbox` cho plate. Thứ tự lớp — hình → grade → plate → glow →
   chữ. Đặt sai thứ tự thì plate phủ lên chữ.
5. `overlay-render.tsx`: plate bằng một `div` nền màu, cùng `heightShare`.
6. Chạy parity — **bước tay**, không nằm trong `check:all`:
   `python3 scripts/overlay-parity/check-overlay-parity.py`
7. Đổi `box.tone` và `highlight.tone` của 3 pack sang màu nhấn riêng của từng
   pack, chữ đảo sang màu tương phản.

## Todo List

- [x] Phép kiểm `plate` không lấn `SAFE`
- [x] Phép kiểm `plate` đặt ở mép, không đặt dải giữa
- [x] Phép kiểm tương phản `box` với chữ — đo ở CA XẤU NHẤT
- [x] Luật loại trừ `box` ⊕ `highlight.box`
- [x] `plate` vẽ đúng thứ tự lớp ở cả hai đường
- [x] `overlay-parity` chạy tay, xanh — 140/140 và 140/140
- [x] `check:layout` vẫn xanh, không lệch đường cơ sở — `plate` không kéo chữ đi
- [~] Phép kiểm "mảng màu trống" → chuyển sang chặng 4, xem lý do dưới
- [~] Đổi màu `box`/`highlight` của 3 pack → là việc DỮ LIỆU của chặng 5

## Success Criteria

- [x] `npm run check:all` xanh
- [x] Khai `plate` lấn vào `SAFE` → `check:style-pack` đỏ (thử: đáy dày 0,35 khi
      lề chỉ có 0,2 → 10 bộ trượt)
- [x] Khai `box` và `highlight.box` cùng màu → `check:style-pack` đỏ
- [x] Hai đường vẽ cho cùng một hình chữ nhật — đo trong trình duyệt: đúng 0,11
      chiều cao, sát mép dưới, phủ hết bề ngang, trùng `drawbox`

## Mâu thuẫn trong kế hoạch, và cách gỡ

Kế hoạch đòi hai điều **loại trừ nhau ở khung 1080×1920**:

> `plate` chỉ được đặt ở `top` hoặc `bottom`, và dải nó chiếm phải nằm **ngoài**
> vùng `SAFE`.

> `plate` mà không có chữ nào nằm trong nó thì `check` cảnh báo.

Chữ phụ đề dải `bottom` có mép dưới chốt ở `y = 0,8 × 1920 = 1536`
(`BAND_ANCHOR`), còn mảng màu đáy dày nhiều nhất `SAFE.bottom = 0,2` nên bắt đầu
ở `y = 1536`… thực tế các số thử trong kế hoạch (114px) đặt nó ở `y = 1806`.
Chữ phụ đề **không bao giờ** nằm trong mảng được.

Gỡ bằng cách xem lại chứng cứ chứ không bằng cách chọn một bên:
`anh/ba-bo-thu-tren-footage-that.jpg` ô thứ hai — dải cam mỏng sát đáy mang dòng
chữ **"MỖI NGÀY MỘT VIỆC"**, còn phụ đề chạy ("CHỌN / NGAY BÂY GIỜ") nằm giữa
khung với nền từng tiếng. Hai thứ chữ khác nhau.

Nên **chữ nằm trong mảng màu là dòng TIÊU ĐỀ**, thứ chặng 4 dựng và đi đường vẽ
riêng được ra ngoài `SAFE`. Hai ràng buộc không hề mâu thuẫn — chúng nói về hai
loại chữ. Phép kiểm "mảng màu trống" vì thế thuộc chặng 4: viết ở đây thì nó
không có gì để kiểm, vì `title` chưa tồn tại.

`anh/mo-focus.jpg` cho thấy hướng ngược lại (khối xanh chiếm 40% khung, mang chữ
lớn của riêng nó) — nhưng đi hướng đó là mảng màu lấn vào `SAFE` và phải bắt chữ
né, tức mở đường cho chữ nhảy chỗ giữa hai lần dựng. Kế hoạch đã cân nhắc và
loại; giữ nguyên quyết định đó.

## Ngưỡng tương phản chọn từ SỐ ĐO

Kế hoạch cảnh báo *"ngưỡng tương phản đặt bừa"*. Nên đo trước khi chốt.

Nền khối trong suốt một phần, nên màu thật của nó phụ thuộc khung hình phía sau.
Trộn nó lên **cả nền đen lẫn nền trắng** rồi lấy kết quả tệ hơn — hai đầu mà mọi
khung hình thật nằm giữa:

| Bộ | Lớp | Nền video tối | Nền video sáng |
|---|---|---|---|
| Lửa | nền chữ đen 0,8 | 6,58:1 | **3,96:1** |
| Gõ | nền chữ đen 0,75 | 14,67:1 | 7,24:1 |
| Sóng | nền tiếng đang nói vàng đặc | 12,16:1 | 12,16:1 |

Chốt **3,0:1**: mọi bộ đang chạy qua với 32% dư địa so với chỗ thấp nhất, mà một
cặp màu thật sự không đọc nổi thì trượt. Nó cũng đúng bằng mức WCAG cho chữ khổ
lớn — phụ đề luôn là chữ khổ lớn, nên lần này con số của bảng chuẩn và con số đo
được trùng nhau.

Thử ngược: đổi nền khối của "Lửa" sang `#EEEEEE` → 1,16:1 → trượt.

## Thứ tự lớp

```
hình → tự cân hình → nắn màu → tư liệu chèn → MẢNG MÀU → quầng → chữ
```

Mảng màu đặt **sau** tư liệu chèn chứ không trước: tư liệu chèn thuộc phần HÌNH,
mà mảng màu phải nổi trên hình. Vẽ trước thì một đoạn b-roll toàn màn phủ kín
mảng màu, và bộ dáng nhấp nháy mất một trục mỗi lần có tư liệu.

Chuỗi `drawbox` khai **một chỗ** (`plateFilter` trong `style-pack.ts`) và ba nơi
cùng gọi: đường xuất video, hai script dựng bảng so. Ba bản chép của cùng một
phép tính toạ độ là ba bản sẽ trôi khỏi nhau, mà bảng so trôi khỏi bản xuất thì
nó so nhầm thứ.

Bên trang xem, mảng màu nằm **trong** `OverlayTextBlock` chứ không đứng riêng ở
từng chỗ dựng khung: mảng màu và chữ là một cặp, và bốn chỗ tự ghép lấy là bốn
chỗ có thể quên một nửa.

## Việc phải làm thêm

`block-box-entry.tsx` chọn khối chữ bằng `:scope > div > div`. Từ khi có mảng
màu thì `:scope > div` cũng khớp cả thẻ mảng màu, nên phép so hộp bao sẽ đo nhầm
một hình chữ nhật đặc và báo lệch ở chỗ không lệch. Nay khối chữ mang
`data-text-block` và phép so trỏ thẳng vào nó.

## Còn treo

**Màu `box`/`highlight` của ba pack.** Kế hoạch xếp việc này vào chặng 3, nhưng
*ba pack nào* thì chặng 5 mới chốt — và chốt "dựa trên bảng so sánh, không chốt
trước trên giấy". Cơ chế đã xong: `box` và `highlight.box` vốn nhận `Tone` bất
kỳ, và nay có phép kiểm tương phản canh. Còn lại là việc DỮ LIỆU.

Mười bộ giữ `plate: null` — bảy bộ là nhóm đối chứng, ba bộ kia chờ chặng 5.
