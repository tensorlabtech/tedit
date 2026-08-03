---
phase: 1
title: "Frame Inset"
status: completed
priority: P1
effort: "1d"
dependencies: []
---

# Phase 1: Frame Inset

## Overview

Đưa video vào **trong một cái khung**: thu nhỏ hình lại, chừa lề, phần lề là nền
màu. Đây là thứ `lens` dùng để tách mình ra khỏi 45 style còn lại, và nó **không
cần một tệp đồ hoạ nào** — chỉ là hình học.

Xếp trước cả đường ống assets vì tỉ lệ đổi-được-nhiều trên mỗi dòng mã của nó cao
nhất trong cả đợt, và vì nó không phụ thuộc gì.

## Key Insights

Đổi khung hình là trục **duy nhất** đọc ra được ở mọi khung hình mà không cần chữ
cũng không cần asset. Bộ dùng nó khác bộ gốc 100% thời lượng, so với 6,7% của trục
cặp font.

**Chỗ khó thật nằm ở `SAFE`.** Thu hình lại mà vẫn tính chữ theo khung 1080×1920
thì chữ chạy ra ngoài vùng hình — hoặc tệ hơn, vẫn nằm trong `SAFE` cũ nên mọi
phép kiểm đều xanh trong khi mắt thấy sai.

**Lời giải đã có sẵn trong chữ ký hàm.** `placeWords(…, videoWidth, videoHeight, pack)`
và `layoutText(…, videoWidth, videoHeight, pack)` đều **nhận bề rộng và chiều cao
qua tham số**, không đọc hằng toàn cục. Nên chỉ cần truyền kích thước của VÙNG
HÌNH thay vì của khung, rồi cộng gốc toạ độ lúc vẽ. Lõi bố cục không đổi một dòng.

## Architecture

```ts
/**
 * Khung bao quanh hình. `null` là hình phủ kín khung, đúng như hiện nay.
 */
frame: {
  /** Lề mỗi phía, theo phần BỀ RỘNG khung — cùng trục với mọi số đo khác. */
  inset: { top: number; right: number; bottom: number; left: number };
  /** Màu phần lề. */
  background: Tone;
} | null;
```

Một hàm thuần trong `style-pack.ts`, hai đường vẽ cùng gọi:

```ts
/** Vùng HÌNH thật sự, tính bằng pixel. Mọi thứ khác đo theo nó, không theo khung. */
export function contentRect(pack, frameWidth, frameHeight): {x, y, w, h}
```

Thứ tự lớp: **nền → hình đã thu → mảng màu → tiêu đề → chữ**.

## Related Code Files

- Modify: `server/style-pack.ts` — kiểu `frame`, hàm `contentRect`
- Modify: `server/render.ts` — `scale`+`pad` cho luồng hình, dời gốc toạ độ chữ
- Modify: `server/word-layout.ts` · `server/text-layout.ts` — **không đổi logic**,
  chỉ nhận kích thước vùng hình
- Modify: `server/caption-groups.ts` — chia cụm đo theo vùng hình
- Modify: `src/dev/overlays/overlay-frame.tsx` — khung và nền ở trang xem
- Modify: `scripts/layout-guard/check-layout.ts` — quét theo vùng hình
- Modify: `server/style-pack-check.ts` — phép kiểm mới

## Implementation Steps (tests first)

1. **Phép kiểm trước, phải ĐỎ:**
   - `inset` mỗi phía trong `[0, 0.25]`; tổng ngang và tổng dọc dưới 0,4 — hơn
     nữa thì vùng hình nhỏ tới mức mặt người không còn đọc được
   - `contentRect` trả về vùng nằm trọn trong khung, `w`/`h` là số CHẴN (ffmpeg
     đòi vậy với luồng yuv420 — `chan()` ở `media-tools.ts` đã có sẵn hàm này)
   - bộ không khai `frame` thì `contentRect` trả đúng cả khung — bảy pack đối
     chứng đi qua nhánh y hệt trước
2. **Nới bộ kiểm bố cục theo vùng hình.** Nó đang khẳng định chữ nằm trong `SAFE`
   của khung 1080×1920. Đổi sang `SAFE` của **vùng hình**, rồi chạy → bảy pack
   không lệch một hàng, vì `contentRect` của chúng vẫn là cả khung.
3. Thêm kiểu `frame`, `null` cho mười bộ.
4. `contentRect` trong `style-pack.ts` — thuần, không `node:*`.
5. `render.ts`: luồng hình đi qua `scale` về `w×h` rồi `pad` vào đúng chỗ trên
   nền màu. Chữ, mảng màu, tiêu đề dời theo gốc toạ độ vùng hình.
6. `overlay-frame.tsx`: thẻ bọc lấy `inset` làm `padding`, nền lấy `background`.
7. Chạy parity — **bước tay**:
   `python3 scripts/overlay-parity/check-overlay-parity.py`

## Todo List

- [x] Phép kiểm dải `inset`
- [x] Phép kiểm `contentRect` chẵn và nằm trong khung, kể cả khi lề ra số lẻ
- [x] `check:layout` đo theo vùng hình, bảy pack **0 hàng lệch**
- [x] `contentRect` khai một chỗ, hai đường cùng gọi
- [x] Đường in: `scale`+`crop`+`pad`, chữ dời theo gốc
- [x] Trang xem: `ContentRect` thành `@container` mới
- [x] `overlay-parity` xanh — 140/140 và 140/140

## Success Criteria

- [x] `npm run check:all` xanh — **181** phép kiểm (từ 169)
- [x] Khai `inset` quá dải → `check:style-pack` đỏ
- [x] Bật `frame` cho cả mười bộ → 260 tổ hợp, **0 trượt bất biến cứng**; chữ vẫn
      trong vùng hình
- [x] Bảy pack ngoài phạm vi: **0 hàng lệch** khỏi đường cơ sở
- [x] Xuất video thật: `anh/khung-video-that-theo-thoi-gian.png` — viền ổn định
      suốt, hình không méo

## Cách giải: đổi HỆ TOẠ ĐỘ, không đụng `SAFE`

`SAFE` · `MAX_BLOCK_SHARE` · `MAX_LINES` · `MIN_SCALE` không đổi một chữ. Thay
vào đó `layoutText` và `placeWords` nhận **kích thước vùng hình** thay vì kích
thước khung — hai hàm ấy vốn đã nhận qua tham số, không đọc hằng toàn cục.

Bên trang xem cùng một lời giải, viết bằng CSS: `ContentRect` trở thành
`@container` mới, nên mọi số đo `cqw` bên trong tự quy về vùng hình. Không thành
phần chữ nào phải sửa.

### Lề dọc đo theo BỀ RỘNG, và đó là chỗ dễ sai nhất

`contentRect` đo cả bốn lề theo bề rộng khung. Nghe ngược, nhưng đo lề dọc theo
chiều cao thì trên khung 9:16 cạnh trên dày gấp **1,78 lần** cạnh bên, và mắt đọc
ra ngay là lệch.

Bên CSS chỗ này là một cái bẫy thật: `left: 3%` là 3% bề rộng — đúng; `top: 3%`
là 3% CHIỀU CAO — sai. Nên `ContentRect` dùng `cqw` cho cả bốn phía.

## Việc phải làm thêm, ngoài kế hoạch

**`frameFilter` và `plateFilter` phải là hàm dùng chung.** Lượt thử đầu tôi chỉ
sửa chỗ ĐẶT CHỮ trong hai script dựng bảng, không sửa chỗ VẼ HÌNH — nên bảng so
dựng ra một dáng **không tồn tại**: chữ đã lùi vào trong nhưng khung thì không có.
Nay ba nơi (đường xuất, hai script bảng) cùng gọi một hàm.

Đây là lần thứ ba trong hai đợt cùng một bài học: bảng so lệch khỏi bản xuất thì
nó tệ hơn không có bảng nào.

**Thứ tự lớp chốt lại:**

```
hình → tự cân → nắn màu → chỗ nối → tư liệu chèn → KHUNG → mảng màu → tiêu đề → chữ
```

Khung đặt **sau** tư liệu chèn: b-roll thuộc phần HÌNH nên phải bị thu vào khung
cùng với hình. Đặt trước thì b-roll vẽ ở toạ độ khung ngoài rồi bị thu hai lần.
