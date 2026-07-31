# Tên gọi và phạm vi ở bàn dựng

Ngày 31/07/2026 · đã thực thi

## Câu hỏi khởi đầu

"Dáng chữ không phải một thuộc tính của chữ mà đổi global dự án luôn à?"

## Sự thật trong mã

`emphasis` là cột trên **`elements`** — thuộc tính của từng cụm. Mọi mục trong
bảng sửa đều vậy. Chỉ nút ở đầu thẻ xem trước mới là toàn dự án.

Nhưng có **ba** tầng, mà tên chỉ nói được một:

| Tầng | Cột | Đổi ảnh hưởng |
|---|---|---|
| Phong cách | `projects.style_pack` | cả video |
| Trục riêng của cụm | `emphasis` `align` `position` `keywords` | một cụm; phong cách không đụng |
| Trục ĐÈ phong cách | `letter_case` `key_color` | một cụm; `NULL` = theo phong cách |

## Hai lỗi tên

1. Nút toàn dự án tên **"Đổi dáng chữ"** — hẹp hơn thứ nó làm rất nhiều. Bộ dáng
   gồm 13 nhóm trục: `font` `letterCase` `color` `edge` **`grade`** (nắn màu
   HÌNH) `intensity` `highlight` `emoji` **`grouping`** (chia cụm) `glow` `box`
   `density` `motion` **`rhythm`** (nhịp cắt). Tên ấy do chính lượt sửa trước
   đặt, thay cho "Đổi" — làm hẹp nghĩa trong lúc định làm rõ.
2. Mục trong bảng tên **"Dáng"** — gần như trùng chữ với nút trên mà phạm vi
   ngược nhau.

Thêm một tầng rối: đuôi **"cụm này"** ở hai nhãn không phải để phân biệt với
toàn dự án mà để nói "cái này đè lên phong cách". Người đọc suy ngược: cái nào
có đuôi mới là của cụm.

## Đã đổi

| Chỗ | Cũ | Mới |
|---|---|---|
| Nút thẻ xem trước | Đổi dáng chữ | **Phong cách video** |
| Mục trong bảng | Dáng | **Cách xếp chữ** |
| Đầu bảng sửa | Chữ trên màn | **Chỉ cụm này** |
| Trục đè | Kiểu chữ **cụm này** | **Kiểu chữ** |
| Trục đè | Màu từ khoá **cụm này** | **Màu từ khoá** |
| Đường lùi | Theo dáng | **Theo phong cách** |

Phạm vi nói MỘT LẦN ở đầu bảng, thay vì rắc "cụm này" vào từng nhãn.

## Kết hợp nhiều dáng chữ trong một video — KHÔNG mở

`font` nằm trong phong cách, phong cách là một cột trên `projects`. Chỉ hai trục
đè được cho riêng cụm, cả hai không phải font. Một video = một font.

Ba lý do giữ nguyên:

1. **Phá một bất biến đang được canh bằng script.** Đổi phong cách an toàn nhờ
   mọi bộ khai `defaults` giống hệt nhau (`npm run check:style-pack`). Thêm cột
   đè font thì mỗi lần đổi phải hỏi "giữ hay đè" cho từng cụm.
2. **Đo chữ gắn với đúng tệp font sẽ in** — `text-layout.ts` đo bằng ImageMagick
   với chính tệp `.ttf` ffmpeg dùng. Nhiều font = nhiều đường đo song song.
3. **Ca dùng thật đã có công cụ.** "Cho câu này nổi hơn" làm được bằng
   `emphasis` + `letter_case` + `key_color` — ba trục còn chưa dùng hết.

Nếu sau này vẫn cần: ca hợp lý duy nhất là **câu mở đầu** (`opening-hook-pane`
hiện dùng chung phong cách) — một ngoại lệ có tên, không phải trục tự do.
