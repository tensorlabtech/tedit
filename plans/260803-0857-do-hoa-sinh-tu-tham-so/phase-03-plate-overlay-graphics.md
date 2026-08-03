---
phase: 3
title: "Plate Overlay Graphics"
status: completed
priority: P1
effort: "1d"
dependencies: [2]
---

# Phase 3: Plate Overlay Graphics

## Overview

Loại hình thứ nhất: **dán một lần cả video**, phủ đúng khung, `overlay 0:0`.
Khung viền, lưới, sọc, film gate, dấu góc. Không co giãn theo chữ, không phụ
thuộc cụm — nên nó là loại rẻ nhất và cũng là loại đọc ra ở **mọi** khung hình.

## Key Insights

Đây là loại trực tiếp chữa cái bệnh mà đợt 1 để lại: trục cặp font chỉ hiện 6,7%
thời lượng vì nó gắn với cụm chữ. `plate` không gắn với gì cả — nó ở đó suốt.

**Đồ hoạ không sống được bằng hằng số.** Đo trong phiên brainstorm: cùng
`alpha 0.22`, trên cảnh cửa sổ đêm gần như biến mất, trên tường trắng rõ mồn một.
`auto-grade.ts` **đã đo độ sáng trung bình khung hình** cho việc tự cân sáng —
con số đó có sẵn, chưa ai dùng cho việc này.

Nên `plate` khai độ đục theo **hai mức** (nền tối / nền sáng) và chọn theo số đã
đo, chứ không khai một hằng. Đây là điều khác hẳn mọi trục của đợt 1.

## Architecture

```ts
graphics: {
  /** Khoá trong `assets/graphics/manifest.json`. */
  id: string;
  tone: Tone;
  /**
   * Độ đục theo ĐỘ SÁNG khung hình, không phải một hằng.
   * `auto-grade.ts` đã đo `độ sáng trung bình`; hai mức này nội suy theo nó.
   */
  opacity: { onDark: number; onLight: number };
}[] | null;
```

Chuỗi lọc:

```
[graphic]alphaextract[m]; color=c=<tone>[c]; [c][m]alphamerge[g];
[hình][g]overlay=0:0
```

Vẽ **sau** hình và mảng màu, **trước** chữ — cùng lý lẽ với mảng màu: nó là nền
cho chữ, không phải lớp phủ lên chữ.

## Related Code Files

- Modify: `server/style-pack.ts` — kiểu `graphics`
- Modify: `server/render.ts` — chuỗi `alphamerge` + `overlay`
- Modify: `src/dev/overlays/overlay-render.tsx` — `mask-image` + `background-color`
  (tương đương `alphamerge` ở phía CSS)
- Modify: `server/style-pack-check.ts` — phép kiểm mới

## Implementation Steps (tests first)

1. **Phép kiểm trước, phải ĐỎ:**
   - mọi `graphics[].id` có trong manifest
   - **không hai pack nào trùng chữ ký đồ hoạ** — ngược với `defaults` (chỗ đó
     canh *giống*), chỗ này canh *khác*
   - luật loại trừ theo `excludes` của manifest
   - `opacity.onDark` phải **cao hơn** `onLight`: nền tối thì hình phải đậm hơn
     mới thấy. Khai ngược là dấu hiệu chép nhầm hai con số
2. Kiểu `graphics`, `null` cho mười bộ.
3. `render.ts`: chuỗi lọc, đọc độ sáng đã đo từ `auto-grade.ts`.
4. `overlay-render.tsx`: `mask-image: url(...)` cộng `background-color` — cùng
   một hình, cùng một màu, hai cách viết.
5. Chạy parity — **bước tay**.

## Todo List

- [x] Phép kiểm id có trong manifest, và loại phải là `plate`
- [x] Phép kiểm không trùng chữ ký đồ hoạ
- [x] Phép kiểm luật loại trừ, đọc từ manifest
- [x] Phép kiểm `onDark > onLight`, và độ đục trong (0, 1]
- [x] Phép kiểm màu dạng `#RRGGBB`
- [x] Chuỗi `alphamerge` ở đường in
- [x] `mask-image` ở trang xem
- [x] `overlay-parity` xanh — 140/140 và 140/140

## Success Criteria

- [x] `npm run check:all` xanh
- [x] Hai pack khai cùng một hình cùng một màu → `check:style-pack` đỏ (thử: bật
      cho cả mười bộ → 9 bộ trượt)
- [x] Cùng một hình tô hai màu ở hai pack → ra hai ảnh đúng hai màu
- [x] Dựng trên footage thật: `anh/hinh-dan-tren-footage-that.png`

## Nạp PNG bằng `movie=`, KHÔNG thêm `-i`

Cách hiển nhiên là thêm `-i <png>` vào danh sách đầu vào của ffmpeg. Nó sai ở
đây: `burnElements` đánh chỉ số luồng theo **số tư liệu chèn** (`[1:v]`, `[2:v]`…
rồi lớp chữ ở `[n+1:v]`). Thêm một đầu vào là mọi chỉ số phía sau trôi một bậc,
và lỗi chỉ lộ ra ở video CÓ b-roll — tức là không lộ ra ở bất kỳ lượt thử nhanh
nào.

`movie=` nạp tệp ngay trong đồ thị lọc nên danh sách đầu vào không đổi một chỗ.
Đã kiểm: hình giữ nguyên suốt video, không chỉ ở khung đầu.

## Độ đục là HAI con số, và đó là điểm khác hẳn mọi trục trước

Brainstorm đo được: cùng `alpha 0.22`, trên cảnh cửa sổ đêm gần như biến mất,
trên tường trắng rõ mồn một. Một hằng số không sống được qua hai loại cảnh.

`auto-grade.ts` đã đo `yAvg` (độ sáng trung bình, thang 0–255) cho việc tự cân
sáng — con số ấy nay đi tiếp xuống `burnElements` và nội suy tuyến tính giữa
`onDark` và `onLight`. `pipeline.ts` đo **một lần**, dùng cho hai việc.

Chưa đo được (người dùng tắt tự cân hình) thì lấy **điểm giữa** — một con số xác
định, không phải một nhánh lặng lẽ chọn hộ.

## `color` chứ không `Tone`

`Tone` mang sẵn một trục độ đục, mà `opacity` cũng là độ đục. Hai trục cho cùng
một thứ thì lúc hình quá mờ không ai biết phải chỉnh cái nào, và chỉnh nhầm cái
thì con số kia lặng lẽ triệt tiêu. Nên `graphics[].color` chỉ là `#RRGGBB`.

## Một chỗ hai đường vẽ KHÔNG khớp, và nó cố ý

Trang xem không có `yAvg` — đo độ sáng một video đang chạy ở trình duyệt là việc
nặng và kết quả đổi theo từng khung. Nên trang xem lấy **điểm giữa** hai mức.

Chênh lệch cao nhất là nửa khoảng cách giữa `onDark` và `onLight`. Ghi ra đây vì
nó là một khoản nợ có ý thức, không phải một chỗ ai đó quên. `overlay-parity` vẫn
xanh vì nó so bẻ dòng và hộp bao, không so độ đục.

## Thứ tự lớp viết bằng SỐ, không bằng thứ tự thẻ

```
hình → khung → HÌNH DÁN → mảng màu → tiêu đề → chữ
```

Bên CSS, hình dán mang `zIndex: 1`, chữ và tiêu đề mang `zIndex: 2`. Viết số ra
thay vì trông vào thứ tự thẻ trong cây DOM: bàn dựng và trang thử xếp thẻ khác
nhau, mà thứ tự LỚP thì phải giống nhau ở cả hai. Lượt đầu tôi đặt hình dán sau
`ContentRect` và nó nằm **trên** chữ — ngược hẳn đường in.

## Lần thứ tư cùng một bài học

Hai script dựng bảng lại thiếu bước vẽ mới, lại bày ra một dáng không tồn tại.
Nay cả hai dựng chuỗi nền theo đúng thứ tự lớp của `render.ts`, và hình dán tách
khỏi chuỗi nối tiếp vì mỗi hình cần một luồng riêng rồi `overlay` vào.
