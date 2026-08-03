---
phase: 4
title: "Project Title Line"
status: completed
priority: P1
effort: "1d"
dependencies: [2, 3]
---

# Phase 4: Project Title Line

<!-- Updated: Validation Session 1 - title_line → headline, bộ kiểm 1920 → scripts/layout-guard, parity là bước tay -->

## Overview

Một dòng chữ lớn đại diện cho cả video — thứ **12/12 style khảo sát đầu tiên đều
có** mà Tedit chưa từng có. Kèm theo là quyết định kiến trúc lớn nhất của đợt:
**loại neo thứ hai**, không neo vào tiếng nói.

## Key Insights

Mọi chữ trong Tedit là `elements`, neo bằng `from_word_id`/`to_word_id`
(`db.ts:184`). Quyết định đó đúng cho phụ đề — bỏ một câu phía trước thì mọi thứ
phía sau vẫn dính đúng chỗ.

Nhưng tiêu đề **không thuộc tiếng nào**. Nó phải sống sót khi người dùng cắt mất
câu đầu. Neo nó vào một từ là hẹn giờ cho một lỗi.

**Tiền lệ đã có và đã đúng:** bộ dáng chữ nằm trong **một cột trên `projects`**
(`db.ts:437`), và chính vì vậy mà đổi bộ dáng chỉ đổi phần vẽ — nội dung và bố
cục người dùng chỉnh tay không bị đụng, nên không cần dialog xác nhận, không cần
luật giữ/đè.

Tiêu đề đi đúng đường đó. Watermark, thanh tiến trình, chữ CTA cuối video sau này
cũng vậy.

## Requirements

- Functional: mỗi dự án có một dòng tiêu đề, người sửa được, AI đề xuất được.
- Non-functional: **đường vẽ riêng**. Chữ tiêu đề được miễn `SAFE` (tràn mép là
  dáng), nhưng phụ đề **không được** đi qua đường đó.

## Architecture

### Dữ liệu

```
projects.headline TEXT          -- vá cột dần, theo đúng nếp db.ts:437
```

Một cột, không phải bảng. Một dự án một tiêu đề.

### Bộ dáng

```ts
title: {
  font: "voice" | "accent";  // dùng lại FontSpec của chặng 2, không khai họ mới
  sizeShare: number;         // phần bề rộng khung
  band: Band;
  tone: Tone;
  bleed: boolean;            // cho tràn mép hay không
} | null;
```

### Hai đường vẽ tách bạch — ràng buộc cứng của đợt này

```
CHỮ PHẢI ĐỌC ĐƯỢC (phụ đề)          CHỮ CHỈ ĐỂ NHÌN (tiêu đề)
  text-layout.ts                       đường riêng
  SAFE · MAX_BLOCK_SHARE                không qua SAFE
  MAX_LINES · MIN_SCALE                 một dòng, cỡ cố định theo sizeShare
  scripts/layout-guard/                 không vào bộ kiểm đó
```

> `scripts/layout-guard/` do **chặng 2** dựng. Repo này chưa từng có bộ kiểm bố
> cục — "bộ kiểm 1920 tổ hợp" mà `style-pack.ts:16` nhắc tới thuộc **dự án
> trước** (`docs/editor-interaction-spec.md:541`).

`style-pack.ts:14` viết rõ bốn hằng số kia là *"ràng buộc của sản phẩm chứ không
phải vẻ ngoài"*. Cho tiêu đề đi chung đường rồi nới `SAFE` là mất bảo đảm "chữ
không bao giờ tràn khung" **một lần cho tất cả**. Nên tiêu đề có hàm dựng riêng,
không gọi `layoutText()`.

### Nội dung

Tái dùng `ai-opening.ts` — nó đã sinh 3 câu mở đầu từ transcript. Thêm một chế độ
sinh câu **ngắn hơn** (3–6 tiếng, kiểu lời hứa, không phải câu để nói). Không
thêm chặng mới vào `STEP_PLAN`; đây là một nút bấm ở bàn dựng, không phải một
chặng của mạch dựng.

## Related Code Files

- Modify: `server/db.ts` — cột `headline`
- Modify: `server/style-pack.ts` — kiểu `title`
- Modify: `server/style-pack-catalog.ts` — 3 pack khai `title`
- Modify: `server/render.ts` — đường vẽ tiêu đề, tách khỏi đường phụ đề
- Modify: `server/ai-opening.ts` — chế độ sinh câu ngắn
- Modify: `server/routes/projects-routes.ts` — đọc/ghi `headline`
- Modify: `src/routes/editor/inspector-text-pane.tsx` (hoặc pane phù hợp) — ô nhập + nút đề xuất
- Modify: `src/dev/overlays/overlay-render.tsx` — vẽ tiêu đề ở trang xem
- Modify: `server/style-pack-check.ts` — phép kiểm mới

## Implementation Steps (tests first)

1. **Phép kiểm trước, phải ĐỎ:**
   - **Đổi bộ dáng không đụng `projects.headline`** — cùng dạng với phép kiểm
     "đổi bộ dáng không đụng `elements`" đã có. Đây là bất biến chính.
   - Tiêu đề rỗng thì không vẽ gì, và không được làm hỏng lớp chữ phụ đề.
   - Tiêu đề dài bất thường (60+ ký tự) không được làm vỡ bố cục — hoặc cắt,
     hoặc thu cỡ, chọn một và kiểm đúng cái đã chọn.
2. **Phép kiểm chống lẫn đường vẽ** — quan trọng nhất chặng này: xác nhận hàm
   dựng tiêu đề **không gọi** `layoutText()`/`placeWords()`, và ngược lại đường
   phụ đề không đọc `pack.title`. Kiểm bằng cách nào tuỳ lúc thi công (tách
   module riêng rồi kiểm import là cách rẻ nhất).
3. **Khoá bảo đảm cũ:** chạy `check:layout` (bộ kiểm bố cục dựng ở chặng 2)
   **sau khi** thêm tiêu đề — kết quả phải y hệt đường cơ sở. Tiêu đề không được
   len vào đó. Đây là lý do chặng 2 phải dựng bộ kiểm ấy trước.
4. Vá cột `headline` vào `projects` theo bảng ở `db.ts:437`.
5. Kiểu `title` trong `style-pack.ts`, `null` cho 7 pack ngoài phạm vi.
6. Hàm dựng tiêu đề trong `render.ts` — một `drawtext`, cỡ suy từ `sizeShare`,
   `x` cho phép âm khi `bleed: true`.
7. `overlay-render.tsx` vẽ tiêu đề, cùng nguồn số.
8. Route đọc/ghi `headline`, đi qua `auth-guard` như mọi route khác — không
   thêm ngoại lệ đường dẫn.
9. UI: ô nhập trong bàn dựng + nút gọi `ai-opening` chế độ ngắn. Theo quy tắc UI
   của dự án: dùng component design system, không HTML chay.
10. Chạy parity — **bước tay**: `python3 scripts/overlay-parity/check-overlay-parity.py`

## Todo List

- [x] Phép kiểm "đổi pack không đụng `headline`" — làm bằng KIẾN TRÚC: `headline`
      là một cột trên `projects`, cùng bảng với `style_pack`, và không có mã nào
      chép giữa hai cột. Phép kiểm lúc chạy ở đây chỉ khẳng định lại điều lược đồ
      đã bảo đảm
- [x] Phép kiểm tiêu đề rỗng / quá dài — bốn dạng rỗng, và HAI phép chặn tách
      riêng: trần ký tự và trần bề rộng
- [x] Phép kiểm hai đường vẽ không lẫn nhau
- [x] `check:layout` cho kết quả **y hệt** đường cơ sở, kể cả khi bật `title`
- [x] Cột `headline` vá xong
- [x] Đường vẽ tiêu đề riêng, cho tràn mép
- [x] UI nhập + nút AI đề xuất
- [x] `overlay-parity` chạy tay, xanh — 140/140 và 140/140

## Success Criteria

- [x] `npm run check:all` xanh — 164 đạt, 0 trượt
- [x] Đổi bộ dáng của một dự án → `headline` giữ nguyên
- [x] Cắt mất câu đầu của video → tiêu đề vẫn hiện đúng chỗ (nó không neo vào
      tiếng nào, nên không có gì để mất)
- [x] `check:layout` không đổi kết quả so với trước chặng này — **200 tổ hợp, 0
      lệch**, cả khi một bộ dáng bật `title`
- [x] Tiêu đề tràn mép đúng ý đồ, phụ đề vẫn trong khung — chứng cứ
      `anh/tieu-de-tren-mang-mau.png`

## Hai đường vẽ tách bằng KIỂU và bằng PHÉP QUÉT

```
CHỮ PHẢI ĐỌC ĐƯỢC (phụ đề)          CHỮ CHỈ ĐỂ NHÌN (tiêu đề)
  text-layout.ts · word-layout.ts     server/headline.ts
  SAFE · MAX_BLOCK_SHARE               không qua SAFE
  MAX_LINES · MIN_SCALE                một dòng, cỡ theo sizeShare
  scripts/layout-guard/                không vào bộ kiểm đó
```

Phép kiểm quét MÃ NGUỒN, cùng cách nó canh `pack.defaults`:

- `server/headline.ts` không được chứa `layoutText(`, `placeWords(`, `fitLines(`
- `text-layout.ts` và `word-layout.ts` không được chứa `title`

Đo thật: bật `title` cho một bộ dáng rồi chạy `check:layout` → **200 tổ hợp, 0
lệch khỏi đường cơ sở**. Tiêu đề không len được vào đường phụ đề.

### Một phép kiểm suýt trừng phạt đúng thứ đáng giữ

Phép quét bản đầu đếm cả GHI CHÚ, nên chính đoạn giải thích *"tệp này KHÔNG gọi
`layoutText`"* làm nó trượt — và cách sửa dễ nhất lúc đó là xoá lời giải thích
đi. Nay quét sau khi bóc ghi chú.

Phép quét `pack.defaults` **có sẵn từ trước cũng dính đúng lỗi ấy**: nhắc tới
`pack.defaults` trong một ghi chú là bị tính là vi phạm. Đã vá luôn.

## Tiêu đề dài: THU CỠ, và vì sao có tới hai phép chặn

Chốt **thu cỡ**, không cắt: tiêu đề chỉ có 3–6 tiếng, mất một tiếng là mất một
phần sáu ý, còn nhỏ đi 15% thì không ai nhận ra.

Nhưng có HAI phép chặn, vì chúng giữ hai thứ khác nhau:

| Phép chặn | Giữ điều gì | Không thay được nhau vì |
|---|---|---|
| `HEADLINE_MAX_CHARS = 80` | số KÝ TỰ, cắt ở biên giới tiếng | hàng rào chống lạm dụng, không phải hành vi bố cục |
| Thu cỡ theo `headlineRoom` | bề rộng PIXEL | một câu 20 ký tự toàn chữ HOA ở `sizeShare` lớn vẫn tràn |

Phép kiểm soi **riêng từng cái**: câu 69 ký tự (dưới trần) phải giữ nguyên từng
chữ và chỉ bị thu cỡ; câu vượt trần phải cắt đúng ở dấu cách.

Đo được: câu 69 ký tự ở `sizeShare` 0,085 thu từ 92px xuống **30px** — nhỏ tới
mức gần như không đọc được. Đó là hệ quả thật của việc chọn thu thay vì cắt, và
người dùng thấy nó ngay ở khung xem trước nên họ gõ ngắn lại. Ghi ra đây để lần
sau ai đó thấy con số 30px thì biết nó là ý đồ, không phải lỗi.

## Tiêu đề chính là chữ nằm trong MẢNG MÀU

Đây là chỗ chặng 3 và chặng 4 ăn khớp, và là cách gỡ mâu thuẫn mà chặng 3 để
lại: mảng màu sống ngoài `SAFE`, phụ đề sống trong `SAFE`, nên **chữ nằm trong
mảng chỉ có thể là tiêu đề**.

`headlineTopShare` vì thế đặt tiêu đề vào GIỮA mảng màu khi hai bên khai cùng
một dải. Và phép kiểm "mảng màu trống" — thứ chặng 3 chưa viết được vì `title`
chưa tồn tại — nay đòi: bộ nào khai `plate` cũng phải khai `title` **cùng dải**.

## Việc phải làm thêm

**`trimHeadline` phải nằm ở `style-pack.ts`, không nằm ở `headline.ts`.** Trang
xem cần gọt cùng một cách, mà `headline.ts` import `text-layout` → `media-tools`
→ `node:child_process`. TypeScript bắt được ngay khi trang xem import vào. Đây
đúng là ràng buộc mà đầu tệp `style-pack.ts` ghi: nó là tệp DUY NHẤT cả hai bên
import được.

**`/_dev/overlays` nay có ô nhập tiêu đề.** Không truyền `headline` vào đó thì
nửa trang xem của phép so không có gì để so, và trục tiêu đề chỉ được canh ở
đường in — đúng nửa mà lỗi "xem một đằng xuất một nẻo" không bao giờ lộ ra.

**`burnElements` nhận tiêu đề qua THAM SỐ, không tự đọc CSDL.** `render.ts` là
tầng ffmpeg; một tầng vẽ mà biết đường tới bảng `projects` thì lần sau nó biết
thêm một bảng nữa. `pipeline.ts` đọc, cùng lúc với bộ dáng và cùng lý do: bản
đang dựng dở không đổi tiêu đề ở nửa sau video.

**Ô nhập nằm ở nhánh "Chưa chọn gì" của khung sửa.** Mọi nhánh khác của khung ấy
sửa MỘT phần tử đang chọn; tiêu đề thuộc về cả dự án. Bộ dáng không khai `title`
thì ô tự ẩn — bày ô nhập cho thứ sẽ không được vẽ là mời người dùng gõ vào chỗ
không ai đọc.

## Bảo mật

Chữ tiêu đề đi qua **một tệp** (`textFileFor`), không qua tham số `text` của
`drawtext` — cùng đường thoát ký tự với phụ đề. Đây là chữ người dùng gõ, và
`drawtext` đọc `:` `'` `%` `\` như cú pháp của chính nó.

Route đọc/ghi nằm trong `PATCH /api/projects/:id` đã có, tức đã ở sau
`auth-guard` theo dạng đường dẫn — không thêm route mới, không thêm ngoại lệ.

## Còn treo

**Chưa xem được nửa trang xem bằng mắt tự động.** `/_dev/overlays` nằm sau đăng
nhập nên playwright không vào được; đã đối chiếu bằng SỐ thay thế: đường in đặt
tiêu đề ở 0,9187 chiều cao, trang xem ở 0,9160 — chênh đúng bằng phần bù vệt mực
0,0024 mà chỉ ffmpeg cần. Cả hai gọi chung `headlineTopShare`.
