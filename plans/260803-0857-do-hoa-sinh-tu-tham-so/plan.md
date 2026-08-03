---
title: "Đồ hoạ sinh từ tham số — đợt 2"
description: "Đưa video vào khung, dán hình sinh từ SVG, khoanh chữ — ba trục đồ hoạ mà không cần một người vẽ nào"
status: completed
priority: P2
branch: "main"
tags: [style, graphics, svg, render]
blockedBy: []
blocks: [260802-1733-multi-user-hardening]
created: "2026-08-03T01:57:00.000Z"
createdBy: "claude"
source: session
---

# Đồ hoạ sinh từ tham số — đợt 2

Tiếp [`260802-2130-do-hoa-cho-bo-dang-chu`](../260802-2130-do-hoa-cho-bo-dang-chu/plan.md) ·
nguồn phân tích: [`brainstorm-report.md`](../260802-2130-do-hoa-cho-bo-dang-chu/brainstorm-report.md)

## Vì sao có đợt này

Đợt 1 giao bốn trục **chữ**: cặp font, mảng màu, nền chữ, tiêu đề. Xem video xuất
thật thì kết luận rõ ràng và không dễ chịu:

> **Chữ có trần thấp.** Đổi font, đổi màu, đổi mật độ — tất cả đều xảy ra trong
> cùng một hình chữ nhật chữ ở nửa dưới khung.

Đo được trên dự án thật: bộ chỉ dùng cặp font (**Nắng**) khác bộ gốc ở **6,7%**
số khung hình — đúng bằng tỉ lệ cụm có từ khoá. Hai bộ dùng đồ hoạ (**Giấy** nền
chữ, **Nhịp** mảng màu) khác ở **mọi** khung hình.

`focus` tách được nhờ khối màu chiếm 40% khung. `lens` tách được nhờ **đưa video
vào trong một cái khung**. Không cái nào tách được nhờ font.

## Ba nền móng đã kiểm THẬT, không phải giả định

| Điều | Kết quả |
|---|---|
| `rsvg-convert` có trên máy | ✓ 2.62.2 |
| `magick` render SVG **sai** | ✓ đúng như brainstorm cảnh báo — ra ảnh trắng trơn, mất cả hình |
| Tô màu tách khỏi hình bằng ffmpeg | ✓ `[png]alphaextract[m];color=c=…[c];[c][m]alphamerge` |

Hệ quả của hai điều đầu: **SVG → PNG chỉ được xảy ra lúc build**, không bao giờ
lúc chạy. Một phụ thuộc render âm thầm sai còn tệ hơn một phụ thuộc thiếu hẳn.

Hệ quả của điều thứ ba: **một hình dùng cho mọi pack**, mỗi pack chỉ khai một mã
màu. Đây là thứ giữ được mô hình *"catalog là bảng số"* thay vì biến thêm-một-pack
thành thuê-người-vẽ.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Frame Inset](./phase-01-frame-inset.md) | Done |
| 2 | [Graphics Asset Pipeline](./phase-02-graphics-asset-pipeline.md) | Done |
| 3 | [Plate Overlay Graphics](./phase-03-plate-overlay-graphics.md) | Done |
| 4 | [Wrap Around Text](./phase-04-wrap-around-text.md) | Done |
| 5 | [Build And Verify](./phase-05-build-and-verify.md) | Done |

Chặng 1 **không cần asset nào** — nó là hình học thuần, và là trục đổi nhiều nhất
trên mỗi dòng mã. Cố ý xếp trước để nếu đợt này phải dừng giữa chừng thì thứ đã
giao vẫn là thứ đáng giá nhất.

Chặng 2 dựng đường ống; 3 và 4 là hai loại hình dùng nó. Chặng 3 ‖ 4 độc lập nhau.

## Bốn ràng buộc không được phá

1. **Hai đường vẽ vẫn phải khớp.** Mỗi trục đồ hoạ thêm vào là thêm một chỗ cho
   trang xem và bản in lệch nhau. `overlay-parity` phải xanh sau mỗi chặng.
2. **Chữ vẫn không bao giờ tràn khung.** Đưa video vào khung là thu vùng chữ lại
   — `SAFE` phải tính theo khung MỚI, không theo khung gốc. `check:layout` là thứ
   canh điều đó, và nó sẽ đỏ nếu làm sai.
3. **Máy chủ không thêm phụ thuộc nào.** `rsvg-convert` chỉ cần lúc phát triển;
   PNG đi theo git hay sinh lúc build, còn tô màu là việc của ffmpeg.
4. **Bảy pack đối chứng vẫn không đổi dáng.** Cùng luật với đợt 1.

## Cạm bẫy đã đo được, mang từ brainstorm sang

- **Đồ hoạ không sống được bằng hằng số.** `alpha 0.22` trên cảnh cửa sổ đêm gần
  như biến mất, trên tường trắng rõ mồn một. `auto-grade.ts` **đã đo độ sáng
  khung hình** — chưa ai dùng số đó cho việc này.
- **Ba lỗi thiết kế đầu tiên đều cùng một dạng**: đồ hoạ và chữ tranh nhau cùng
  một việc. Đó là lý do cần **luật loại trừ** trong manifest, không phải chỉ cần
  toạ độ đúng.
- **Đồ hoạ dở hại hơn phụ đề dở.** Phụ đề xấu vẫn đọc được; đồ hoạ xấu làm cả
  video trông rẻ tiền và nó choán khung suốt thời lượng.
- **Phải xem ở 1080×1920.** Bản thu nhỏ giấu lỗi VÀ bịa ra lỗi — đợt 1 dính cả
  hai chiều.

## Nghiệm thu

Xuất **video thật** bằng mỗi pack mới, xem hết. Tiêu chí: một bộ dùng đồ hoạ phải
khác bộ gốc ở **mọi khung hình**, không phải ở 6,7% khung hình — đó là con số
đợt 1 đạt được, và là lý do đợt này tồn tại.

## Kết quả — 2026-08-03

Cả năm chặng xong. `npm run check:all` xanh, `npm run build` xanh, hai phép so
hai đường vẽ: **140/140** và **140/140**.

| Phép kiểm | Trước đợt 2 | Sau |
|---|---|---|
| `check:style-pack` | 169 | **220** |
| `check:graphics` | **không tồn tại** | 36 |
| `check:layout` | 260 tổ hợp | 260 tổ hợp, nay đo theo VÙNG HÌNH |

### Con số nghiệm thu

So từng cặp *có trục mới* ↔ *không có*, giữ nguyên mọi thứ khác, lấy mẫu mỗi 0,5
giây trong 18 giây:

| Trục | Khung khác bộ gốc |
|---|---|
| **`frame`** (đưa video vào khung) | **100%** |
| **`graphics`** (hình dán) | **100%** |
| *cặp font (đợt 1)* | *6,7%* |

**Tám** trên mười bộ có ít nhất một trục vẽ SUỐT VIDEO (`frame` · `graphics` ·
`plate` · `title`). Hai bộ còn lại:

- **Mộc** — cố ý, nó là bộ mặc định và là mốc so
- **Sóng** — chỉ có `wrap`, tức trục gắn với CỤM. Đo trên footage này nó phủ
  36/36 khung vì phụ đề gần như liên tục, nhưng đó là con số **phụ thuộc dữ
  liệu**: video có quãng lặng dài thì nó có quãng trống

`scripts/style-packs/verify-final.ts` in ra bảng này từ chính catalog — bản đếm
bằng tay của tôi đã sai một lần (báo 9/10).

### Bốn trục mới

| Trục | Gắn với | Hiện bao nhiêu |
|---|---|---|
| `frame` | cả video | 100% |
| `graphics` (`plate`) | cả video | 100% |
| `wrap` `scope: "all"` | từng cụm chữ | mọi cụm |
| `wrap` `scope: "keyword"` | cụm có từ khoá | ~7% |

### Lỗi NẶNG NHẤT của cả hai đợt, tìm được ở lượt kiểm cuối

**Mọi video Tedit xuất ra đều ở H.264 High 4:4:4 Predictive — trình duyệt không
giải mã được.**

`render.ts` chưa bao giờ khai `-pix_fmt`, nên định dạng đầu ra là thứ chuỗi lọc
**tình cờ đàm phán được**. Đo trên chính repo này:

| Bộ dáng | Định dạng ra | Hậu quả |
|---|---|---|
| phần lớn | `yuv444p` · High 4:4:4 Predictive | Chrome · Safari · Firefox **không phát được** |
| bộ có hình bám chữ | `gbrp` | trình phát đọc RGB phẳng như YUV → **cả video ám tím** |

Có sẵn từ trước (`git show HEAD:server/render.ts` không có `pix_fmt`), nhưng nhánh
`gbrp` do chuỗi `wrap` của đợt này ép `format=rgba` mới lộ ra.

Cả hai **không có triệu chứng ở máy phát triển**: `ffprobe` báo tệp hợp lệ, thời
lượng đúng, QuickTime mở được. Chỉ người xem bằng trình duyệt mới thấy — mà đó là
người dùng cuối.

Sửa: thêm bước chuẩn hoá `scale=out_range=tv,format=yuv420p` vào cuối đồ thị lọc,
cộng `-pix_fmt yuv420p` ở đầu ra. Sáu bộ thử nay đều ra **`High / yuv420p / tv`**.
`check:style-pack` quét mã nguồn canh cả hai — dựng một video để kiểm mất vài
phút, mà đây là ràng buộc về một dòng trong chuỗi lọc.

### Ba bài học lặp lại đủ để thành luật

1. **Bảng so thiếu một bước vẽ là nó bày ra một dáng không tồn tại.** Mắc **bốn
   lần** trong hai đợt, mỗi lần một trục khác. Nay mọi bước vẽ đều là hàm dùng
   chung, và ba nơi vẽ cùng gọi.
2. **Trên nền tối, chỉ màu SÁNG hoặc màu NO mới đọc ra được.** Mắc hai lần trong
   cùng một đợt (Lặng rồi Gõ). Một cái khung tối trên video tối không phải "kín
   tiếng" — nó là không có.
3. **Con số nói "có đổi", con mắt nói "đổi có ra một ý đồ không".** Khung tối của
   Lặng đo ra 100% khung hình khác, RMSE 8,8% — và gần như vô hình.

### Việc còn treo

| Việc | Vì sao |
|---|---|
| **Chưa ai ngoài tôi chấm** | Đợt 1 tôi tự chấm 8/10 rồi hoá ra thổi phồng. Bảng đã dựng sẵn |
| Trang xem không đo được độ sáng khung hình | Nên nó lấy điểm giữa hai mức đục; khoản nợ có ý thức |
| Loại `spot` khai trong manifest nhưng chưa có đường vẽ | Chưa bộ nào cần |
| Chưa commit | 100+ tệp đang treo |

## Ngoài phạm vi, cố ý

- `roughjs`, `lucide-static`, nét vẽ tay → đợt 3
- Tách nền người (`chalk`, `ignite`) → việc riêng, đắt hơn cả đợt 2 cộng đợt 3
- Texture, collage, sticker → không làm
- Chia màn nhiều ô (`align`, `byline`) → cần overlay nhiều luồng video, để sau
