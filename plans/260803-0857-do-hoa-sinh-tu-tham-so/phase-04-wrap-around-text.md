---
phase: 4
title: "Wrap Around Text"
status: completed
priority: P2
effort: "1d"
dependencies: [2]
---

# Phase 4: Wrap Around Text

## Overview

Loại hình thứ hai: **bám theo chữ**. Vòng khoanh, gạch chân, ngoặc hai bên. Khác
`plate` ở chỗ nó phải **co giãn theo bề rộng cụm chữ**, nên nó cần số đo từ
`textWidth()`.

Đây là loại nối đồ hoạ với chữ, và cũng là loại dễ hỏng nhất — hai trong ba lỗi
thiết kế của phiên brainstorm đều thuộc loại này.

## Key Insights

**Co giãn kiểu 3 lát (3-slice), không kéo giãn cả hình.** Kéo cả hình thì hai đầu
vòng khoanh dẹt ra theo bề rộng chữ, và cụm dài trông khác hẳn cụm ngắn dù cùng
một bộ dáng. Ba lát: hai đầu giữ nguyên, khúc giữa lặp hoặc kéo.

**Lỗi đã đo được, không phải đoán:** vòng khoanh vàng vẽ đè lên nền chữ vàng →
triệt tiêu nhau, đọc ra như lỗi vẽ. Xem `../260802-2130-do-hoa-cho-bo-dang-chu/anh/ba-bo-thu-tren-footage-that.jpg`.
Đây chính là ca mà `excludes` trong manifest sinh ra để chặn.

**Bề rộng phải lấy từ đúng vai chữ.** Đợt 1 đã dựng `ShownPack` để không ai đo
nhầm font; `wrap` phải đi qua đúng cửa đó.

## Architecture

```ts
wrap: {
  id: string;              // khoá manifest, kind: "wrap"
  tone: Tone;
  /** Bọc CỤM nào: chỉ cụm có từ khoá, hay mọi cụm. */
  scope: "keyword" | "all";
  /** Đệm quanh chữ, theo cỡ chữ. */
  padShare: number;
} | null;
```

## Related Code Files

- Modify: `server/style-pack.ts` — kiểu `wrap`
- Modify: `server/render.ts` — 3 lát, số đo từ `textWidth`
- Modify: `src/dev/overlays/overlay-render.tsx` — `border-image` 3 lát ở CSS
- Modify: `server/style-pack-check.ts` — phép kiểm mới

## Implementation Steps (tests first)

1. **Phép kiểm trước, phải ĐỎ:**
   - `wrap` và `box` không được cùng màu (luật loại trừ, ca đã hỏng thật)
   - `wrap` và `highlight.box` cũng vậy
   - bề rộng hình bọc **đổi theo bề rộng cụm** — cùng dạng với phép kiểm "bề rộng
     đổi theo vai chữ" của đợt 1, và cùng lý do
   - hình bọc không được kéo cụm ra ngoài `SAFE`: đệm phải nằm trong chỗ đã có
2. Kiểu `wrap`, `null` cho mười bộ.
3. `render.ts`: ba `overlay`, toạ độ suy từ hộp bao cụm mà `placeWords` trả về.
4. `overlay-render.tsx`: `border-image-slice` — đúng cơ chế 3 lát của CSS.
5. Chạy parity — **bước tay**. Đây là loại dễ lệch nhất giữa hai đường vẽ.

## Todo List

- [x] Phép kiểm loại trừ `wrap` ⊕ `box` ⊕ `plate`, đọc từ manifest
- [x] Phép kiểm hai đầu cộng lại nhỏ hơn khổ danh nghĩa
- [x] Phép kiểm bản chép `cap` ở trang xem khớp manifest
- [x] Phép kiểm đệm trong dải, màu dạng `#RRGGBB`, đục tối > đục sáng
- [x] Ba lát ở đường in
- [x] `-webkit-mask-box-image` ở trang xem
- [x] `overlay-parity` xanh — 140/140 và 140/140

## Success Criteria

- [x] `npm run check:all` xanh
- [x] Khai `wrap` cùng màu `box` → `check:style-pack` đỏ
- [x] Cụm một tiếng và cụm nhiều tiếng: **hai đầu giống hệt nhau**, chỉ khúc giữa
      dài ra — chứng cứ `anh/vong-khoanh-ba-lat.png`
- [x] `check:layout` không đổi — hình bám chữ không đẩy chữ đi

## Ba lát: hai đầu co theo CHIỀU CAO, không theo bề rộng

Chỗ dễ nhầm nhất. Hai đầu phải giữ nguyên TỈ LỆ của chính chúng, nên chúng co
theo chiều cao khối chữ. Co theo bề rộng khối là quay lại đúng phép kéo giãn mà
ba lát sinh ra để tránh.

Chiều dọc thì kéo tự do: hình bám chữ cao bằng một khối chữ, mà khối chữ cao theo
số hàng — không có "hai đầu" nào ở trục dọc để mà giữ.

## Hai lỗi tìm được bằng cách DỰNG RA VÀ NHÌN

### 1. Vòng khoanh bao quanh khoảng trống

Bản đầu cho hình khoanh vào **cùng lúc với tiếng đầu**. Nó được cắt theo bề rộng
CẢ cụm, mà chữ chạy vào từng tiếng — nên ba khung đầu là một vòng khoanh to bao
quanh đúng một chữ. Đúng lỗi "mảng màu trống" phiên brainstorm đã đo một lần.

Sửa lần một: **đợi tiếng cuối hiện xong**. Kết quả: nó **không bao giờ vào** —
phụ đề khớp lời nói nên tiếng cuối bắt đầu gần đúng lúc cụm tắt. Dựng thử: 0/5
cụm vẽ ra được gì.

Chốt: vào khi cụm đã hiện **quá nửa**, và không muộn hơn 0,3 giây trước khi tắt.
Nó cũng đúng nhịp — người ta khoanh lại khi đã nghe đủ để biết mình khoanh cái gì.

### 2. Gạch chân CẮT NGANG giữa chữ

Gạch chân dùng chung đường đặt với vòng khoanh, nên nó bị kéo cao bằng cả khối ba
hàng và nằm vắt qua giữa chữ. Nhìn bảng so là thấy ngay.

Sửa: thêm trục `fit` vào manifest.

| `fit` | Đặt thế nào | Hình |
|---|---|---|
| `around` | bao quanh khối, cao bằng khối | vòng khoanh |
| `under` | dưới chân khối, cao theo **CỠ CHỮ** | gạch chân |

Hai cách đặt khác hẳn nhau, và dùng chung một cách là lỗi nhìn thấy ngay.

## Bản chép ở trang xem, và phép kiểm giữ nó

`overlay-render.tsx` chạy ở trình duyệt nên không đọc được manifest bằng
`node:fs`. Nó chép `cap` của từng hình. Bản chép nào cũng trôi được — trừ khi có
một phép kiểm giữ, nên `check:style-pack` đọc cả hai bên và so.

## Trần của trục này

`wrap` gắn với CỤM, nên nó chịu đúng cái trần mà trục cặp font chịu: `scope`
`keyword` chỉ hiện ở ~7% số cụm trên dữ liệu thật. `scope: "all"` mới là lựa chọn
thấy được ở mọi cụm — và đó là lựa chọn bộ "Sóng" dùng.
