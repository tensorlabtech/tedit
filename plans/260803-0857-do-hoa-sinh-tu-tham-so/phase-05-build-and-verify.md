---
phase: 5
title: "Build And Verify"
status: completed
priority: P1
effort: "4h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Build And Verify

## Overview

Dựng các bộ dáng dùng trục mới, rồi nghiệm thu bằng **video thật**, không bằng
khung tĩnh. Đợt 1 kết thúc bằng khung tĩnh và con số nghiệm thu thổi phồng — lần
này tiêu chí là con số đo được trên video.

## Key Insights

**Con số phải vượt: 6,7%.** Đó là tỉ lệ khung hình mà bộ "Nắng" của đợt 1 khác bộ
gốc. Một bộ dùng `frame` hoặc `plate` phải đạt **100%** — hai trục ấy không gắn
với cụm chữ nên chúng ở đó suốt.

**Sinh rồi lọc, không thiết kế.** `generate-style-candidates.sh` trong thư mục kế
hoạch đợt 1 đã chứng minh: sinh 7 ứng viên hoàn chỉnh mất **4 giây**, suy ra 200
ứng viên khoảng 2 phút. Người chỉ làm đúng việc máy không làm được: chấm đẹp xấu.

## Requirements

- Sửa **hai bộ đã có** dùng trục đồ hoạ mới, và **không đụng** bảy bộ đối chứng
  cộng ba bộ vừa dựng ở đợt 1 — nhóm đối chứng của đợt này gồm cả chúng.
- Mỗi bộ mới phải khác mọi bộ khác ở ít nhất hai trục nhìn thấy được, tính cả
  hai trục mới.

## Implementation Steps

1. Sinh dải ứng viên bằng script, không chốt trên giấy.
2. Dựng bảng so trên footage thật, xem ở **1080×1920**.
3. Chốt, rồi **xuất video thật** bằng mỗi bộ mới.
4. **Đo tỉ lệ khung hình khác bộ gốc** — không ước bằng mắt. Lấy khung mỗi 0,5
   giây, so từng cặp, đếm.
5. Lặp nhiều nhất 3 vòng, rồi chốt và ghi lại điều còn chưa ưng.

## Todo List

- [x] Hai bộ mới, mỗi bộ một trục của đợt này
- [x] Bảng so 1080×1920 trên footage thật
- [x] Xuất video thật bằng mỗi bộ mới
- [x] **Đo** tỉ lệ khung khác — con số ở dưới
- [x] `npm run check:all` xanh
- [x] `overlay-parity` xanh — 140/140 và 140/140

## Success Criteria

- [x] Bộ dùng `frame` hoặc `graphics` khác ở **100%** số khung hình — vượt ngưỡng
      95% đặt ra, và gấp 15 lần con số 6,7% của đợt 1
- [x] Bảy pack đối chứng + ba pack đợt 1: chỉ **Lặng** lệch đường cơ sở (nó thu
      vùng hình), Thép **0 hàng** — hình dán không đụng bố cục chữ
- [x] Không ô nào có lỗi "hai thứ tranh nhau"
- [~] Người chưa xem quá trình chấm — **vẫn chưa làm**, xem mục cuối

## Con số — đo, không ước

So từng cặp `có trục mới` ↔ `không có trục mới`, giữ nguyên mọi thứ khác. Lấy mẫu
mỗi 0,5 giây trong 18 giây (36 khung), so bằng RMSE, ngưỡng 0,5% (dưới đó là
nhiễu nén).

| Bộ | Trục mới | Khung khác | Lệch trung bình |
|---|---|---|---|
| **Lặng** | đưa video vào khung | **36/36 = 100%** | 8,80% |
| **Thép** | dấu góc + viền mảnh | **36/36 = 100%** | 5,52% |

Đối chiếu đợt 1: trục cặp font khác ở **6,7%** số khung — đúng bằng tỉ lệ cụm có
từ khoá, vì nó gắn với cụm chữ. Hai trục của đợt này không gắn với gì cả.

## Chỗ con số và con mắt nói hai điều khác nhau

Bản đầu của Lặng dùng nền `#14161A` ở lề 4%. **Đo ra 100% khung hình khác nhau,
RMSE 8,8%** — đạt mọi tiêu chí bằng số. Nhìn thì nó gần như vô hình: nền tối gần
trùng màu footage tối, và cái khung đọc ra như "video hơi nhỏ đi" chứ không như
một ý đồ.

Dựng ba biến thể rồi chọn bằng mắt (`anh/khung-ba-bien-the.png`):

| | Đọc ra |
|---|---|
| nền tối 4% | gần như vô hình |
| **nền giấy 5%** | **tức thì — mép khung sáng trên video tối** |
| nền xanh đêm 7,5% | thấy, nhưng kín tiếng |

Chốt nền giấy. *"Tiết chế"* không có nghĩa là vô hình — nó nghĩa là không ồn, mà
một dải giấy thì không ồn.

Bài học: con số nói *"có đổi"*, con mắt nói *"đổi có ra một ý đồ không"*. Cần cả
hai, và **con mắt mới là thứ nghiệm thu**.

## Hai bộ mới

| Bộ | Theme | Chữ ký |
|---|---|---|
| **Lặng** | `gon` | Video nằm trong khung **giấy** 5%. Không một nét vẽ nào — chỉ lùi hình lại một bước |
| **Thép** | `manh` | **Dấu góc kiểu khung ngắm** + viền mảnh vàng. Cả hai bám mép nên không bao giờ chạm phụ đề |

Chọn hai hình bám MÉP cho Thép là có chủ ý: nó là bộ chữ HOA khổ lớn, mà một cái
lưới cắt ngang giữa khung thì tranh chỗ với chữ ngay.

## Phủ nốt các bộ còn lại

Sau khi có con số 100%, phủ trục mới cho bốn bộ chưa dùng. **Mộc giữ nguyên** —
nó là bộ mặc định và là mốc so; một mốc so mà cũng có đồ hoạ thì không còn là mốc.

| Bộ | Trục | Chữ ký |
|---|---|---|
| **Sương** | `graphics` | Lưới một phần ba, trắng, đục **thấp nhất mọi bộ** (0,3/0,14) — nó là hình duy nhất cắt ngang giữa khung nên có thể đi qua mặt người |
| **Lửa** | `graphics` | Viền DÀY đỏ. Viền dày ăn vào chỗ của chữ nên chỉ hợp bộ đã chia cụm ngắn — bộ này `maxWords: 3` |
| **Gõ** | `frame` | Khung xám ấm, lề dưới dày gấp ba lề trên — dáng "một trang giấy" |
| **Sóng** | `wrap` | Gạch chân xanh, `scope: "all"`. Xanh chứ không vàng: bộ này đã có vệt sáng vàng chạy theo lời, thêm một lớp vàng nữa là hai thứ nhấn cùng một việc |

### Gõ mắc lại đúng lỗi của Lặng

Bản đầu để nền `#0A0A0B`. Trên footage tối nó **vô hình** — y hệt lần đầu của
Lặng, mà tôi vừa sửa xong ở chính đợt này. Đổi sang xám ấm `#5A554C`.

Bài học lặp lại đủ để thành một luật: **trên nền tối, chỉ màu SÁNG hoặc màu NO
mới đọc ra được mép khung.** Một cái khung tối trên video tối không phải là "kín
tiếng" — nó là không có.

## Còn treo

**Chưa ai ngoài tôi chấm.** Kế hoạch đòi *"người chưa xem quá trình gọi tên được
≥ 6 bộ"*. Đợt 1 tôi tự chấm 8/10 rồi hoá ra thổi phồng, nên lần này tôi **không
tự chấm nữa**. Hai bảng đã dựng sẵn, việc còn lại là hỏi một người.

**Chặng 4 (vòng khoanh bám chữ) chưa làm.** Nó là P2, và nó thuộc loại gắn với
CỤM — cùng họ với trục cặp font, tức cùng cái trần 6,7% ấy. Sau khi có con số
100% của hai trục này thì thứ tự ưu tiên nên xem lại: một trục nữa ở mức 6,7% có
đáng bằng một trục ở mức 100% không.
