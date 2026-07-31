# Extract Style Constants — kết quả

**Ngày:** 2026-07-31 · **Phase:** 2 · **Trạng thái:** xong

## Kết luận một dòng

Mọi hằng số dáng chữ đã vào `server/style-pack.ts`, cả hai đường vẽ đọc chung một
khai báo, và **bản render lệch 0 điểm ảnh trên 10/10 tổ hợp**.

## Bằng chứng "không đổi hành vi"

Dựng lại nguyên trạng TRƯỚC phiên làm việc từ chỉ mục git rồi in cùng một bộ chữ
qua cả hai bản mã, ép cả hai dùng **cùng một tệp font** bằng `TEDDIT_FONT` — nên
phép so chỉ đo tác động của việc gom hằng số, không đo tác động của việc đổi font
ở phase 1.

| # | căn | nhấn | dải | lệch |
|---|---|---|---|---|
| 1 | center | even | top | 0 điểm ảnh |
| 2 | left | taper | bottom | 0 điểm ảnh |
| 3 | right | keyword-large | middle | 0 điểm ảnh |
| 4 | stair | mixed-size | top | 0 điểm ảnh |
| 5 | stagger | even | bottom | 0 điểm ảnh |
| 6 | center | keyword-large | middle | 0 điểm ảnh |
| 7 | center | even | top (cụm 2 tiếng) | 0 điểm ảnh |
| 8 | left | mixed-size | bottom | 0 điểm ảnh |
| 9 | stair | taper | middle | 0 điểm ảnh |
| 10 | center | even | top (CHỮ HOA) | 0 điểm ảnh |

## Kiến trúc đã dựng

```
server/style-pack.ts        ← kiểu StylePack + pack `goc` + findStylePack
        │                     (KHÔNG đụng node:* — hai bên cùng import được)
        ├─→ server/text-layout.ts    lineHeight · wordGap · maxScale · font
        ├─→ server/word-layout.ts    color · leadRatio · mixedSmallRatio
        ├─→ server/render.ts         font · edge · glow
        ├─→ server/reveal-expr.ts    motion (6 con số)
        └─→ src/dev/overlays/        trang xem đọc CÙNG pack
```

Bộ dáng truyền bằng **tham số**, không bằng biến toàn cục — phase 5 sẽ có nhiều
pack cùng tồn tại và mỗi dự án dùng một cái.

**Ba trục `Band` · `AlignId` · `EmphasisId` chuyển sang `style-pack.ts`**,
`text-layout.ts` re-export lại. Bắt buộc: `text-layout.ts` nhập `node:child_process`
qua `media-tools`, nên trang xem không import nó được. `style-pack.ts` là tệp duy
nhất cả hai bên cùng với tới.

## Bốn hằng vẫn ở ngoài pack

| Hằng | Ở đâu | Vì sao khoá |
|---|---|---|
| `SAFE` | `text-layout.ts` | bảo đảm "chữ không bao giờ tràn khung" |
| `MAX_BLOCK_SHARE` | `text-layout.ts` | bảo đảm "chữ không che mặt người nói" |
| `MAX_LINES` | `text-layout.ts` | quá 3 dòng thì không đọc kịp |
| `MIN_SCALE` | cả hai bên | sàn 0,09 là ngưỡng ĐỌC ĐƯỢC |

`MIN_LINE_HEIGHT = 1` thay chỗ `LINE_HEIGHT` cũ: sàn ở ngoài pack, còn giá trị
thật thì pack đặt trong [1.0, 1.4].

## Công cụ mới: bắt lệch hai đường vẽ không cần đăng nhập

`/_dev/overlays` làm đúng việc này nhưng bằng mắt và sau một lượt đăng nhập
Google — không chạy được trong lượt kiểm tự động. Thêm:

```
scripts/overlay-parity/
├── parity-cases.ts            bộ chữ mẫu dùng CHUNG cho cả hai nửa
├── dump-server-layout.ts      nửa máy chủ: gọi thẳng fitLines
├── parity-page.html           nửa trang xem: import THẲNG overlay-model.ts qua Vite
└── check-overlay-parity.py    so và báo
```

Hai nửa đều là **mã thật**, không có bản chép nào để trôi khỏi bản gốc.

```bash
npm run dev            # cần Vite đang chạy
python3 scripts/overlay-parity/check-overlay-parity.py [cổng]
```

Kết quả hiện tại: **10/10 cụm khớp số dòng**, 9/10 khớp cỡ chữ trong 3%.

## Bốn chỗ lệch đã phát hiện và xử

### 1 · Trang xem chặn cỡ ở 0,24 còn máy chủ chặn ở 0,15 — ĐÃ SỬA

Kiểu `mixed-size` ở `overlay-render.tsx` có `Math.min(0.24, …)` viết cứng, trong
khi `word-layout.ts` chặn ở `MAX_SCALE = 0.15`. Cụm NGẮN là cụm duy nhất chạm
trần, nên lệch này chỉ lộ ở cụm ngắn — và ở đó khung xem to hơn hẳn bản xuất.
Nay cả hai đọc `pack.density.maxScale`.

### 2 · Trang xem chừa 3% còn máy chủ chừa 2% — ĐÃ SỬA

Lý do ghi cho con số 3%: *"phép ước theo số ký tự có lúc hụt so với font thật"*.
Lý do đó đã hết từ khi trang xem dùng chung tệp font với bản in ra — nó ĐO bằng
font thật chứ không ước theo số ký tự nữa. Nay cả hai chừa 2%.

### 3 · Trang xem đổi độ đậm theo từ khoá còn máy chủ thì không — ĐÃ SỬA ở phase 1

`fontWeight: word.bold ? 800 : 600`. Máy chủ chỉ có MỘT tệp font để vẽ nên nó
không có cách nào làm tiếng này đậm hơn tiếng kia. Với Arial trình duyệt gộp cả
600 lẫn 800 về Bold nên khác biệt này chưa từng lộ; với font thật thì lộ ngay.
Nay dùng `pack.font.cssWeight`; từ khoá phân biệt bằng **màu** (phase 3).

### 4 · `motion.lineBox = 1.15` trong khi trang xem xếp dòng ở 1,0 — CÒN, cố ý giữ

`reveal-expr.ts` quy quãng trượt dọc ra pixel bằng `fontSize × 1.15 × largeShift`,
còn CSS `translateY(24%)` tính theo chiều cao hộp dòng thật, tức `× 1.0`. Hai bên
lệch 15% quãng trượt — **chỉ thấy được trong lúc chữ đang hiện**, không thấy ở
khung tĩnh.

Giữ nguyên vì phase này có một tiêu chí cứng là bản render không đổi. Nay con số
nằm trong `motion.lineBox` kèm ghi chú, nên sửa nó là một việc riêng có bằng
chứng riêng, không phải một dòng lẫn trong một đợt refactor.

## Chỗ lệch chưa xử: đo chữ HOA có dấu chồng

Hai đường ĐO khác nhau về bản chất — `magick label:` ở máy chủ, `measureText` ở
trình duyệt. Đo trên tệp font Be Vietnam Pro ExtraBold Italic:

| tiếng | magick | canvas | lệch |
|---|---:|---:|---:|
| `ẾCH` | 221,0 | 217,5 | −1,6% |
| `ỮA` | 161,0 | 142,6 | **−11,4%** |
| `ẶNG` | 241,0 | 232,8 | −3,4% |
| `ẮT` | 163,0 | 145,7 | **−10,6%** |
| `ỔN` | 163,0 | 160,8 | −1,3% |
| `ỖI` | 117,0 | 115,5 | −1,3% |

Chữ thường lệch dưới 2%; vài tiếng chữ HOA lệch tới 11%. Hướng lệch là **trang
xem đo HỤT** → nó chọn cỡ to hơn máy chủ, nên video xuất ra nhỏ hơn khung xem một
chút. Chiều này vô hại (chiều ngược lại mới là chữ tràn khung).

Trên cả cụm thì lệch chỉ còn 4% và **số dòng vẫn khớp** ở cả 10 cụm — nên nó chưa
đổi được bố cục. Nhưng đây là đầu vào bắt buộc cho **phase 4**: bộ dáng chữ HOA
phải soi bằng ảnh thật chứ đừng tin bảng số.

## Đã kiểm

- [x] Render trước/sau lệch 0 điểm ảnh trên 10 tổ hợp
- [x] Hai đường vẽ khớp số dòng ở 10/10 cụm
- [x] `SAFE`, `MAX_LINES`, `MIN_SCALE`, `MAX_BLOCK_SHARE` vẫn là hằng ngoài pack
- [x] `npm run typecheck` sạch
- [x] `npm run lint` 0 lỗi
- [x] `npm run build` sạch, có đủ bộ ký tự tiếng Việt của font 800 nghiêng

## Câu chưa dứt

1. **`motion.lineBox`** — sửa 1,15 → đọc theo `density.lineHeight` là đúng, nhưng
   nó đổi bản render (chỉ trong lúc chữ hiện). Làm ở vòng riêng hay gộp vào phase 3?
2. **Phép đo chữ HOA lệch 11%** — sửa được bằng cách cho trang xem lấy BƯỚC TIẾN
   thay vì vết mực, nhưng phải đo lại cả bộ trước khi đổi.
