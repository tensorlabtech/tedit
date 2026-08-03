---
phase: 2
title: "Font Pair In Style Pack"
status: completed
priority: P1
effort: "1.5d"
dependencies: [1]
---

# Phase 2: Font Pair In Style Pack

<!-- Updated: Validation Session 1 - thêm scripts/layout-guard, sửa chữ ký resolvePackFont, parity là bước tay -->

## Overview

Cho mỗi bộ dáng cầm **hai họ chữ** thay vì một: một vai cho *lời* (phụ đề chạy
theo tiếng nói), một vai cho *cảm xúc* (cụm cần đọng lại). Đây là trục mà mọi
style ngoài kia dùng để phân biệt nhau, và Tedit chưa có.

## Key Insights

`Prime` luân phiên hai vai chữ trong cùng một video: sans trắng cho câu tường
thuật, script cyan cho `pushing` · `harder.` · `self-compassion`. Chúng **thay
phiên**, không chồng nhau. Xem `anh/46-style-phan-1.jpg`.

**Bẫy lớn nhất:** `textWidth()` đo bề rộng bằng ImageMagick với **đúng tệp font
sẽ in**. Cụm vẽ bằng font vai *cảm xúc* mà đo bằng font vai *lời* thì chữ tràn
khung — đúng loại lỗi cả hệ `SAFE`/`MAX_BLOCK_SHARE` sinh ra để chặn, và nó lọt
qua vì phép đo sai chứ không phải luật sai.

## Requirements

- Functional: `StylePack` khai hai `FontSpec`; đường in và trang xem cùng chọn
  đúng vai; phép đo dùng đúng tệp font của vai đó.
- Non-functional: 7 pack không thuộc phạm vi đợt này phải **không đổi một pixel**
  — chúng khai `accent` trùng `voice`.

## Architecture

```ts
type FontSpec = {
  file: string;      // đường dẫn tương đối tới .ttf
  cssStack: string;  // phải khớp @font-face trong style-pack-fonts.css
  cssWeight: number;
  italic: boolean;
};

// thay cho `font: {...}` hiện tại
fonts: {
  voice: FontSpec;   // phụ đề chạy theo lời
  accent: FontSpec;  // cụm cảm xúc
};
```

**Luật chọn vai — dùng dữ liệu đã có, không thêm cột nào:** cụm **có từ khoá**
(`ai-keywords.ts` đã đánh dấu) vẽ bằng `accent`; còn lại vẽ bằng `voice`.

Vì sao không thêm trục "cụm nào là cảm xúc": mô hình đã có đúng khái niệm đó rồi.
Thêm trục thứ hai là có hai nguồn sự thật cho cùng một câu hỏi.

`intensity.keywordShare` đang giới hạn *"nhiều nhất bao nhiêu phần trăm số cụm
được có từ nhấn"* — nó trở thành luôn cần gạt mật độ đổi vai chữ. Không cần con
số mới.

## Related Code Files

- Modify: `server/style-pack.ts` — tách `FontSpec`, đổi `font` → `fonts`
- Modify: `server/style-pack-catalog.ts` — 10 pack khai `voice`/`accent`
- Modify: `server/text-layout.ts` — `textWidth()` (`text-layout.ts:445`, **async**)
  nhận tệp font của vai đang đo
- Modify: `server/word-layout.ts` — `placeWords()` (`word-layout.ts:324`, **async**)
  truyền vai xuống phép đo
- Create: `scripts/layout-guard/` — bộ kiểm bố cục quy mô nhỏ (xem bước 4)

> `server/paths.ts` **không cần sửa**: `resolvePackFont` (`paths.ts:46`) là
> `export const resolvePackFont = (relativePath: string) => …` — nó nhận đường
> dẫn, không nhận pack. Chỉ cần truyền `pack.fonts[role].file` vào.
- Modify: `server/render.ts` — chọn `fontfile` theo vai ở chỗ dựng `drawtext`
- Modify: `src/dev/overlays/overlay-render.tsx` — chọn `fontFamily` theo vai
- Modify: `server/style-pack-check.ts` — phép kiểm mới
- Modify: `server/dev-render-frame.ts` — nhận vai qua tham số dòng lệnh

## Implementation Steps (tests first)

1. **Viết phép kiểm trước, chạy phải ĐỎ.** Trong `style-pack-check.ts` thêm:
   - mọi pack khai đủ `fonts.voice` và `fonts.accent`
   - hai tệp `.ttf` tồn tại trên đĩa
   - mỗi `cssStack` có `@font-face` tương ứng trong `src/style-pack-fonts.css`
     (đọc tệp CSS, so tên họ — lệch một chữ là trình duyệt lặng lẽ rơi về
     `sans-serif`)
2. **Khoá hành vi hiện tại.** Thêm phép kiểm: với pack **không** thuộc 3 pack của
   đợt này, `fonts.accent` phải trùng `fonts.voice`. Bảo đảm 7 pack còn lại không
   đổi dáng.
3. **Phép kiểm chống sai phép đo** — quan trọng nhất chặng này: dựng một cụm chữ
   giả có từ khoá, cho `voice` và `accent` là hai họ rộng hẹp khác hẳn nhau, rồi
   xác nhận bề rộng trả về **đổi theo vai**. Trước khi sửa `text-layout.ts` thì
   phép kiểm này phải đỏ.
4. **Dựng bộ kiểm bố cục quy mô nhỏ** (`scripts/layout-guard/`) — thứ repo này
   **chưa có**. `style-pack.ts:16` nhắc "bộ kiểm 1920 tổ hợp", nhưng
   `docs/editor-interaction-spec.md:541` ghi rõ nó thuộc **dự án trước**.

   Quét ~200 tổ hợp: `{độ dài câu} × {số tiếng mỗi cụm} × {dải} × {căn} × {10 pack}`.
   Với mỗi tổ hợp, gọi đúng đường bố cục thật (`placeWords`) rồi khẳng định:
   khối chữ nằm trong `SAFE`, không quá `MAX_LINES`, cỡ không dưới `MIN_SCALE`.

   **Chạy trước khi sửa gì** để có đường cơ sở. Con số ~200 là để nó chạy được
   trong `check:all`; đủ dày để bắt hồi quy, không dày tới mức không ai chạy.

   Đây là lưới an toàn cho chặng 4 — chặng đó nới `SAFE` cho chữ trang trí, và
   không có bộ kiểm này thì không biết phụ đề có bị kéo theo hay không.
5. Tách `FontSpec` trong `style-pack.ts`, đổi `font` → `fonts`. TypeScript sẽ chỉ
   ra mọi nơi phải sửa — đi theo lỗi biên dịch.
6. `textWidth()` và `placeWords()` nhận tệp font thay vì suy từ pack. Cả hai đều
   **async** — giữ nguyên, đừng biến thành đồng bộ.
7. `render.ts`: ở vòng dựng `drawtext` cho từng tiếng, chọn `fontfile` theo việc
   cụm có từ khoá hay không. Nguồn dữ liệu là cột `elements.keywords`
   (`db.ts:419`), do `ai-keywords.ts:86` ghi vào. Lưu ý dòng vẽ **hai lần** cho
   `highlight` — cả hai lần phải dùng cùng một vai.
8. `overlay-render.tsx`: cùng luật, đọc cùng `StylePack`.
9. **Chạy parity — bước TAY, không nằm trong `check:all`:**
   ```bash
   python3 scripts/overlay-parity/check-overlay-parity.py
   python3 scripts/overlay-parity/check-block-box-parity.py
   ```
   Nó dựng trang rồi so ảnh nên nặng, cố ý để ngoài `check:all`. Nhưng **bắt buộc
   chạy trước khi coi chặng này xong** — đây là thứ duy nhất bắt được "xem một
   đằng xuất một nẻo".

## Todo List

- [x] Phép kiểm khai đủ 2 font + tệp tồn tại + khớp `@font-face` (khớp cả **độ
      đậm và thể nghiêng**, không chỉ tên họ — lệch hai thứ đó thì trình duyệt tự
      tổng hợp một thể giả trông na ná)
- [x] Phép kiểm 7 pack ngoài phạm vi giữ `accent === voice` — làm thành **danh
      sách duyệt** `TWO_FACE_PACKS`, nay rỗng; chặng 5 thêm tên vào đó
- [x] Phép kiểm bề rộng đổi theo vai
- [x] `scripts/layout-guard/` chạy được, có đường cơ sở trước khi sửa
- [x] `check:layout` nằm trong `check:all` (cả `check:fonts` nữa; `check:all` nay
      chạy 14,5 giây)
- [x] `FontSpec` tách xong, `fonts.voice`/`fonts.accent`
- [x] Đường in chọn đúng vai (đọc `elements.keywords`)
- [x] Trang xem chọn đúng vai
- [x] `overlay-parity` chạy tay, xanh — 140/140 và 140/140

## Success Criteria

- [x] `npm run check:all` xanh
- [x] Đổi `fonts.accent` của một pack sang họ rộng hơn hẳn → chữ vẫn nằm trong
      khung. Thử thật: cho "Sương" (Barlow Condensed hẹp) vai cảm xúc Playfair
      Display → 220 tổ hợp, 0 trượt bất biến cứng
- [x] Cụm có từ khoá hiện bằng font khác — dựng bằng ĐÚNG đường in
      (`dev-render-frame.ts`), chứng cứ `anh/vai-chu-hai-ben.png`
- [~] 7 pack ngoài phạm vi xuất ra khung hình **giống hệt** — xem mục dưới

## Cách giữ cho vai chữ không lệch: một KIỂU, không phải một tham số

`ShownPack = Omit<StylePack,"fonts"> & { font: FontSpec }` — bộ dáng **đã chốt
vai**. Không đo được, không vẽ được, cho tới khi có kiểu này.

Chọn cách này thay vì luồn thêm tham số `role` xuống từng hàm: `pack` và `role`
đi cạnh nhau qua mười lăm chỗ gọi là mười lăm cơ hội để chúng rời nhau, mà rời
nhau đúng ở cụm dùng vai thứ hai thì mọi phép kiểm vẫn xanh còn chữ thì tràn
khung. Gộp lại thì không còn cơ hội nào, và `tsc` liệt kê thẳng mọi chỗ phải
quyết định.

`fonts` bị **bỏ khỏi** `ShownPack` chứ không giữ lại: để cả hai thì một chỗ đo
bằng `font` còn chỗ khác đọc `fonts.voice`.

## Việc phải làm thêm, ngoài kế hoạch

### 1. Chia cụm phải đo bằng CẢ HAI vai (`caption-groups.ts`)

Kế hoạch không nêu chỗ này. Chia cụm chạy lúc **sinh chữ**, còn `ai-keywords.ts`
đánh dấu từ khoá **sau đó** — nên cụm vừa chốt "vừa một dòng" theo vai `voice`
hoàn toàn có thể về sau được vẽ bằng vai `accent`. Vai đó rộng hơn thì chữ tràn
khung, và không lệnh nào sai: chỉ là phép đo đã hỏi nhầm font.

Nay `fitGroup` lấy hợp các cờ qua `shownPacks(pack)`. Bộ chưa dùng vai thứ hai
chỉ đo một lần, y như trước.

### 2. Hai lỗi TRÀN KHUNG có sẵn, do bộ kiểm bố cục lôi ra

Bộ kiểm dựng xong chạy lần đầu: **132/200 tổ hợp trượt bất biến cứng**. Đối
chiếu `git diff HEAD -- server/word-layout.ts` xác nhận tôi chỉ đổi **kiểu**,
không đổi một dòng logic nào — lỗi có sẵn, ở cả 10 pack.

Mọi trượt đều rơi vào đúng hai kiểu nhấn:

| Kiểu nhấn | Chuyện gì |
|---|---|
| `keyword-large` | Dồn toàn bộ phần dẫn vào MỘT hàng ở cỡ cố định `min(heroScale × 0,4 ; 0,075)` — không hỏi bề rộng lấy một câu. Cụm 13 tiếng chưa đánh dấu từ khoá nào thì hàng dẫn dài **gấp đôi khung** (đo được: tiếng đặt ở `x = 2076` trên khung rộng 1080) |
| `mixed-size` | Ước bằng VẾT MỰC còn `rowWidth` cộng BƯỚC TIẾN, và quên khoảng đệm của nền khối |

Sửa **một chỗ, không sửa bốn công thức ước**: thêm chốt chặn cuối trong
`placeWords` — hàng nào vẫn rộng hơn chỗ nó có thì thu cả hàng theo tỉ lệ. Bảo
đảm nằm ở nơi con số cuối cùng được quyết định, nên không phép ước nào bất đồng
với nó được. Sửa từng nhánh là sửa bốn công thức rồi chờ nhánh thứ năm.

Còn hai lỗi làm tròn, mỗi lỗi vài pixel nhưng cùng một tính chất — một bảo đảm
mà "gần như luôn đúng" thì không phải bảo đảm:

- **Con trỏ `x` làm tròn rồi cộng dồn** → sai số nửa pixel mỗi tiếng chồng lên
  nhau, hàng tám tiếng lệch tới bốn pixel. Nay chạy bằng số thực, chỉ làm tròn
  lúc phát ra. Trang xem cũng đặt chữ bằng số thực nên điều này còn kéo hai
  đường vẽ lại gần nhau hơn.
- **Phép KẸP "không bao giờ tràn" dùng `Math.round`** → nó làm tròn LÊN, tức tự
  cho phép nửa pixel vượt ra đúng cái mép nó sinh ra để giữ. Nay `Math.floor`.

Sau ba lượt sửa: **200 tổ hợp, 0 trượt.**

### 3. Phép so hai đường vẽ nay chạy được vai cảm xúc

`parity-cases.ts` thêm 4 ca có từ khoá; hai nửa (máy chủ và trang xem) cùng gọi
`fontRoleFor`. Hai trang trình duyệt nay nạp **cả hai** họ chữ của mỗi bộ —
thiếu bước đó thì các ca vai cảm xúc đo bằng font thay thế và phép so báo lệch ở
chỗ sản phẩm không sai gì.

## Bảy pack ngoài phạm vi: đo thật, không phải "không đổi một pixel"

Dựng lại toàn bộ bố cục ở `HEAD` (git worktree) rồi so với bản nay, 560 tổ hợp
(10 pack × 14 ca × 4 kiểu nhấn):

| Kiểu nhấn | Tổ hợp | Giống hệt | Lệch lớn nhất |
|---|---|---|---|
| `even` | 140 | 68 | **2px** |
| `taper` | 140 | 82 | **2px** |
| `keyword-large` | 140 | 46 | 1183px |
| `mixed-size` | 140 | 77 | 195px |

**Không pack nào khai `defaults.emphasis` là `keyword-large` hay `mixed-size`** —
cả mười đều `even` hoặc `taper`. Nên với bố cục mà mọi bộ dáng thật sự xuất ra,
lệch tối đa là **2 pixel trên khung rộng 1080**, đến từ hai lượt sửa làm tròn ở
trên.

Còn lệch lớn nằm trọn trong hai kiểu nhấn mà người dùng phải tự chọn cho từng
cụm, và **chỉ ở những tổ hợp trước đây vẽ chữ ra ngoài khung** — 96/96 tổ hợp
lệch quá 8px đều có cỡ chữ đổi, tức là hàng vốn rộng hơn chỗ nó có.

Nên câu "không đổi một pixel" không giữ nguyên văn được. Thứ giữ được, và là
thứ điều khoản ấy muốn: **nhóm đối chứng không đổi DÁNG**; chỗ đổi là chỗ trước
đây hỏng.

## Rủi ro đã đóng

| Rủi ro trong kế hoạch | Kết quả |
|---|---|
| Đo bằng font sai → chữ tràn khung | Đóng bằng KIỂU (`ShownPack`), không bằng kỷ luật |
| Trang xem và bản in chọn vai khác nhau | `fontRoleFor` khai một lần, cả hai bên import; parity kiểm cả hai vai |
| `cssStack` lệch tên họ | Phép kiểm đọc thẳng `style-pack-fonts.css`, so cả độ đậm và thể nghiêng |
| Đổi `font` → `fonts` chạm nhiều tệp | 23 lỗi biên dịch, đi hết theo `tsc` |

## Còn treo — hai việc

### A. Chân chữ TRÔI trong cùng một hàng (lỗi có sẵn, chưa sửa)

`drawtext` neo theo **mép trên vệt mực**, nên tiếng có dấu chồng dấu bị đẩy
xuống so với tiếng không có. Đo trên chính ffmpeg, cỡ chữ 120, tiếng không có
nét thòng:

| Font | Chân chữ trôi |
|---|---|
| Anton | 37px |
| Montserrat · Archivo · Barlow | 43–44px |
| Lexend | 50px |
| Be Vietnam Pro (bộ gốc) | 54–55px |
| Lora | 56px |
| Oswald | 60px |
| **Playfair Display** | **66px** |
| **Dancing Script** | **73px** |

Tức 31–61% cỡ chữ. Chứng cứ: `anh/chan-chu-troi-theo-dau.png`,
`anh/vai-02-cam-xuc.png` (tiếng "rất" tụt hẳn xuống).

Ba điều đáng nói:

1. **Có sẵn ở cả 8 font đang chạy**, không phải do đợt này. `reveal-expr.ts`
   không bù gì theo chiều dọc.
2. **Trang xem KHÔNG có lỗi này** — CSS xếp theo chân chữ. Nên đây đúng là lỗi
   "xem một đằng xuất một nẻo", mà `overlay-parity` không bắt được vì nó so số
   dòng, cỡ chữ và hộp bao — không so chân chữ từng tiếng.
3. Nó **nặng hơn hẳn ở hai họ mới**, tức nó cản trực tiếp chặng 5.

Sửa nó là đổi bố cục của **cả mười pack**, nên nó không thuộc chặng này.

### B. Ô mẫu màn chọn cố ý bày vai PHỤ ĐỀ

`style-preview-tile.tsx` có đánh dấu một tiếng từ khoá để bày trục màu nhấn. Áp
thẳng luật chọn vai vào đó thì ô mẫu hiện **toàn bộ** câu bằng họ chữ cảm xúc —
mà họ đó chọn cho cụm ngắn cỡ lớn. Nên ô mẫu dùng `withFontRole(pack, "voice")`.
Hệ quả: người dùng **không thấy vai chữ thứ hai ở màn chọn**. Chặng 5 quyết
định bày nó ra sao, khi đã có pixel thật để nhìn.
