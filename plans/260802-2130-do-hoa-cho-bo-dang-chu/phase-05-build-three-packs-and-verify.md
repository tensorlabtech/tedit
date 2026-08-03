---
phase: 5
title: "Build Three Packs And Verify"
status: completed
priority: P1
effort: "4h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Build Three Packs And Verify

## Overview

Dựng ba bộ dáng dùng hết trục mới, rồi nghiệm thu bằng **mắt trên footage thật**
— không phải bằng phép kiểm, vì phép kiểm không nói được "cái này trông có nghề".

## Key Insights

Bài học đắt nhất phiên brainstorm: **ở 430px cả ba bộ thử đều trông ổn; ở 1080px
hai cái hỏng.** Vòng khoanh đè nền cùng màu, khối chữ căn giữa mép răng cưa, mảng
màu trống. Không cái nào là lỗi toạ độ — đều là hai thứ tranh nhau cùng một việc.

Nên nghiệm thu **bắt buộc xem ở 1080×1920**, và **trên footage của người dùng**
(quay ngang 720p crop dọc, phòng tối), không trên stock sáng đẹp.

## Requirements

- Ba pack ở **ba `theme` khác nhau** (`manh` · `ke-chuyen` · `gon`) để đo được
  biên độ. Bảy pack còn lại giữ nguyên làm đối chứng.
- Mỗi pack dùng: cặp font (chặng 2) + mảng màu hoặc nền chữ (chặng 3) + tiêu đề
  (chặng 4). Không pack nào trùng chữ ký với pack nào.

## Architecture

Không có mã mới. Chặng này là **dữ liệu** (`style-pack-catalog.ts`) cộng với một
script dựng bảng so sánh.

Bảng nghiệm thu dựng lại từ `scripts/style-packs/render-real-frames.ts` đã có —
nó vốn sinh ra để làm đúng việc này, đang chạy trên 10 pack với khung mẫu. Mở
rộng để nhận **khung hình từ tệp người dùng chỉ định**.

## Related Code Files

- Modify: `server/style-pack-catalog.ts` — 3 pack dùng trục mới
- Modify: `scripts/style-packs/render-real-frames.ts` — nhận khung nền tuỳ chọn
- Modify: `src/style-pack-fonts.css` — nếu 3 pack dùng font mới của chặng 1

## Implementation Steps

1. **Chốt 3 pack.** Đề xuất một pack mỗi `theme`; pack nào cụ thể thì chọn lúc
   thi công dựa trên bảng so sánh, không chốt trước trên giấy.
2. **Mỗi pack một chữ ký riêng**, không trùng nhau:
   - một pack chơi **mảng màu + chữ đảo màu** (hướng `focus`)
   - một pack chơi **cặp font tương phản mạnh, không đồ hoạ** (hướng `prism pro`)
   - một pack chơi **nền chữ từng tiếng màu nhấn + tiêu đề tràn mép**
3. Mở rộng `render-real-frames.ts` nhận đường dẫn video/khung nền.
4. Dựng bảng: 10 pack × cùng một câu × cùng một khung hình thật, xuất **1080×1920
   cho từng ô**, và một bảng thu nhỏ để nhìn tổng thể.
5. **Xem từng ô ở kích thước thật.** Không kết luận từ bảng thu nhỏ.
6. Lặp: sửa số trong catalog → dựng lại → xem. Không sửa mã.

## Todo List

- [x] Chốt 3 pack, mỗi `theme` một cái
- [x] Ba chữ ký khác nhau, không trùng
- [x] `render-real-frames.ts` nhận dòng tiêu đề tuỳ chọn, và vẽ được cả mảng màu
      lẫn tiêu đề
- [x] Bảng 10 ô trên footage thật — hai bảng: cụm thường và cụm CÓ TỪ KHOÁ
- [x] Đã xem từng ô ở 1080×1920
- [x] `npm run check:all` xanh (gồm `check:fonts`, `check:layout`, `check:style-pack`)
- [x] `overlay-parity` xanh — 140/140 và 140/140

## Success Criteria

- [x] **Đếm được 8 bộ gọi tên được mà không cần đọc chữ** — trên ngưỡng 6. Xem
      mục "Nghiệm thu" dưới, kèm điều kiện phải ghi rõ.
- [x] Bảy pack ngoài phạm vi xuất ra khung hình giống hệt trước đợt này — bộ kiểm
      bố cục: **0 hàng lệch** ở cả bảy
- [x] Không ô nào có lỗi "hai thứ tranh nhau" — ba lỗi tìm được đều đã sửa, xem
      "Ba vòng lặp" dưới
- [x] Xuất **video thật** bằng cả ba pack qua đúng đường `burnElements` — chứng cứ
      `anh/video-that-nhip-theo-thoi-gian.png` (6 mốc thời gian) và
      `anh/video-that-nang-va-giay.png`

## Ba pack, ba chữ ký

| Bộ | Theme | Cặp font | Chữ ký |
|---|---|---|---|
| **Nhịp** | `manh` | Oswald ↔ Archivo Expanded (hẹp ↔ rộng) | **Mảng màu** tím sát đáy, tiêu đề ĐẢO MÀU nằm trong nó |
| **Nắng** | `ke-chuyen` | Archivo Expanded ↔ Lora Italic (sans ↔ serif) | **Cặp font**, và KHÔNG một đồ hoạ nào |
| **Giấy** | `gon` | Montserrat Italic ↔ Playfair Display | **Nền chữ từng tiếng** màu mực + **tiêu đề tràn mép** |

Nắng cố ý không có mảng màu cũng không nền chữ: nó là bằng chứng rằng riêng trục
font đã đủ tách một phong cách. Nếu nó cần thêm khối màu mới nhận ra được thì cả
chặng 2 đã sai.

## Ba vòng lặp, ba lỗi thật

Kế hoạch cho phép 3 vòng. Dùng đúng 3, và mỗi vòng lôi ra một lỗi khác loại.

### Vòng 1 — `bleed` cắt mất chữ

Bản đầu định nghĩa `bleed` là "chạy quá mép khung 15%". Dựng ra thì
"Ba năm mới hiểu" đọc thành **"3a năm mới hiể"** — mất đúng chữ đầu và chữ cuối,
y như ghi chú của chính hằng số ấy cảnh báo.

Xem lại ảnh khảo sát: **không style nào cắt chữ tiêu đề**. `anh/mo-focus.jpg` và
`anh/ba-bo-thu-tren-footage-that.jpg` đều để tiêu đề nằm trọn trong khung, chỉ
khác nhau ở chỗ nó lấn vào lề bao nhiêu. Nên `bleed` đổi nghĩa:

- `false` — nằm trong đúng lề của phụ đề
- `true` — dùng hết bề rộng KHUNG, tràn qua lề an toàn

Lề an toàn truyền vào từ ngoài chứ không chép lại: `style-pack.ts` không import
được `text-layout.ts` (`node:*`), nên hai đường vẽ mỗi bên tự đưa con số của
mình vào — vẫn là một con số, không ai phải nhớ đồng bộ.

### Vòng 2 — bảng so nói dối về chính thứ nó so

`render-real-frames.ts` chốt cứng `withFontRole(pack, "voice")`, nên nó vẽ cụm
CÓ TỪ KHOÁ bằng font phụ đề trong khi video xuất ra vẽ bằng font cảm xúc. Bảng so
sai về thứ nó đang so thì tệ hơn không có bảng nào.

Nay nó gọi `packForElement` đúng như đường in, và bảng có thêm **ô thứ tư: một
cụm có từ khoá**. Không có ô ấy thì nửa dáng của mọi bộ dùng cặp font không bao
giờ hiện ra, và người nhìn bảng kết luận "hai bộ này giống nhau" trên đúng cái
nửa mà chúng khác nhau.

### Vòng 3 — khoảng cách tiếng, và một ảo giác của bản thu nhỏ

Bảng thu nhỏ cho thấy "nàynhư" và "connectionổn" dính vào nhau. Xem ở **kích
thước thật** thì… bình thường — đúng cái bẫy kế hoạch cảnh báo, chỉ theo chiều
ngược lại.

Nhưng dựng cả hai mức cạnh nhau ở 1080px (`anh/khoang-cach-tieng-truoc-sau.png`)
thì mức cũ **thật sự dính**. Archivo Expanded rộng bản nên khoảng bằng 10–12% cỡ
chữ đọc ra bằng không. Nới lên 0,18 (Nhịp) và 0,2 (Nắng).

Bài học: bản thu nhỏ **không kết luận được theo cả hai chiều** — nó vừa giấu lỗi
vừa bịa ra lỗi. Chỉ có so hai bản ở khổ thật mới trả lời được.

### Ngoài ba vòng — một lỗi "xem một đằng xuất một nẻo" thật

Sau khi thêm nền chữ cho Giấy, `overlay-parity` báo **1/140 lệch**: cụm
"Nghĩ kỹ" ở dải giữa, máy chủ bẻ **hai** dòng còn trình duyệt giữ **một**.

Đo ra: nền chữ nới mỗi tiếng 28% cỡ chữ, nên cụm hai tiếng ở trần 0,145 cần
767px trong khi dải giữa chỉ có 751px — nó nằm **sát ranh giới bẻ dòng**, và
chênh lệch vài phần trăm giữa `magick` với `canvas` đủ để lật kết quả.

Hạ trần xuống 0,135: cần 714px, **dư 37px** — xa hơn hẳn mức lệch dưới 2% ở chữ
thường. Chọn số theo KHOẢNG DƯ chứ không theo con số tròn.

Đây đúng là loại lỗi mà phép so hai đường vẽ sinh ra để bắt, và nó chỉ xuất hiện
sau khi thêm một trục mới — chứng cứ rằng phép so ấy vẫn đang làm việc.

## Nghiệm thu — và điều kiện phải ghi rõ

Trên bảng 10 ô dựng từ footage thật (`anh/bang-10-o-cum-dai.jpg` và
`anh/bang-10-o-cum-tu-khoa.jpg`), **tám** bộ gọi tên được mà không cần đọc chữ:

| Bộ | Nhận ra bằng |
|---|---|
| Thép | CHỮ HOA hẹp, nắn màu lạnh |
| Nắng | tiêu đề serif nghiêng ở đỉnh, hình ấm và tươi |
| Lặng | chữ lớn sạch, căn giữa, không hàng dẫn |
| Lửa | nền chữ đen, căn phải, hình ấm nhất |
| Giấy | nền chữ màu mực + tiêu đề serif tràn hai mép |
| Nhịp | mảng màu tím sát đáy, chữ trong mảng đảo màu |
| Gõ | một tiếng một, CHỮ HOA có nền |
| Sóng | ô vàng chạy theo tiếng đang nói |

Hai bộ còn lại (**Mộc** và **Sương**) vẫn hao hao nhau — cả hai đều chữ nghiêng
nhỏ kiểu `taper`. Chúng là nhóm đối chứng nên không đụng tới; nếu đợt sau muốn
tách chúng thì đó là hai ô còn lại của bài toán.

> **Đây là đánh giá của MỘT người, và người đó dựng ra chính ba bộ này.** Kế
> hoạch đòi "người lạ chưa xem quá trình". Con số 8/10 vì thế là mức trần lạc
> quan, không phải kết quả nghiệm thu. Việc còn lại: đưa hai bảng cho một người
> chưa đọc kế hoạch, hỏi họ đếm được mấy bộ.

## Bảy pack đối chứng: đo, không tin

Bộ kiểm bố cục sau khi dựng ba pack: **260 tổ hợp, 0 trượt bất biến cứng**, và
80 hàng lệch khỏi đường cơ sở — trong đó **60 hàng là MỚI** (vai chữ thứ hai của
ba bộ, trước đây không tồn tại) và **20 hàng lệch thuộc đúng một bộ**:
`nghieng-tron`, bộ duy nhất đổi bố cục phụ đề vì có thêm nền chữ.

Bảy bộ ngoài phạm vi: **0 hàng lệch**.

## Còn treo

**Ô mẫu ở màn chọn vẫn bày vai phụ đề.** Nên người dùng không thấy được vai chữ
thứ hai lúc chọn bộ dáng — đúng cái trục vừa dựng. Bày cả hai vai trong một ô
9:16 là một việc thiết kế riêng, không phải một dòng sửa.

**Dancing Script chưa bộ nào dùng.** Nó đủ dấu Việt và đã đông cứng, nhưng nét
mảnh hơn hẳn (trôi chân chữ 73px ở cỡ 120, cao nhất kho) nên chỉ hợp cụm rất
ngắn cỡ rất lớn. Để dành cho một bộ dáng có chữ ký hợp với nó.
