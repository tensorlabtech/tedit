## Dự án Tedit nhé, tên thư mục tôi viết sai là Teddit đấy

## Về quy tắc UI

### Sử dụng design system

Dự án này thiết kế với giao diện đồng bộ vả nhất quán, chấp nhận sự đơn điệu nếu cần để bảo về quan điểm này

- Sử dụng tối đa design system component tử Shadcn (đã được custom), kiểm tra tại /_dev/design-system
- Hạn chế tối thiểu inline class hay inline style truyền vào các component
- Khi có update gì, mà người yêu cầu có ý đồ update tất cả mọi chỗ thì cần update vào file design system
- Không sử dụng HTML chay nếu có design system đó, ví dụ không dùng thẻ select html mà dùng design system

### Layout page

- Trừ trang chủ / và /dev/\* ra, tất cả các page đều dạng bento phủ kín màn bằng các card có gap-2
- Mọi thứ đều nằm trong một Card hoặc một thẻ có style trông cân bằng với Card
- Không dùng scrollbar trừ trường hợp thực sự cần thiết
- Hãy thật chú ý active border, ring, ... cẩn thận bị parrent cắt mất

### Các quy tắc khác

- Mọi thứ click được đều phải có cursor pointer => nếu được update ở design system
- Những thứ click được nhưng chỉ có icon không có text thì cần có tooltip

### Phân cấp nền từ lớp thứ 2 trong Card

- Viền chỉ để gợi mép, luôn là border-border không tự chế viền đậm hơn tại nơi gọi.

### Border XUYÊN CARD (gom nhóm bằng kẻ ngang)

- Kẻ ngăn nhóm / kẻ dưới tiêu đề trong một Card phải **chạm HAI MÉP thẻ**, KHÔNG thụt vào. Thụt lề đọc ra như gạch chân lạc chỗ chứ không như ranh giới.
- Cách làm: `-mx-(--card-spacing) border-t border-border` rồi trả lại `px-(--card-spacing)` cho chữ (âm lề đúng bằng đệm thẻ). Xem mẫu `src/dev/skin/grouping-panel.tsx` và trang `/_dev/skin`.
- Khi lồng Card trong Card (vd cột phải có tab): thẻ NGOÀI để `CardContent` `px-0`, thẻ TRONG tự lo đệm ngang — nhờ vậy kẻ của thẻ trong chạm mép thẻ ngoài. Đừng lột px của thẻ trong.

## Kho mẫu bộ dáng (style reference)

- Video gốc của Captions cho từng bộ dáng nằm ở `examples/caption-styles/*.mp4` (vd `prism-pro.mp4`, `chalk.mp4` = Phấn, `pulse.mp4` = Nhịp đen). Khi dựng/chỉnh một theme, trích khung từ file tương ứng để bám đúng bản gốc thay vì đoán.

## Kiến trúc BLOCK-POOL khi RENDER (NGUYÊN TẮC BẮT BUỘC — tôi hay quên)

- **Phong cách (preset / style pack) CHỈ dùng ở bước SEED lúc TẠO** (AI sinh cụm chữ, chọn khung, đặt hiệu ứng). SAU BƯỚC TẠO thì mọi thứ BÌNH ĐẲNG.
- **Render (composition Remotion + ffmpeg) ĐỌC LOOK TỪ BLOCK đóng dấu trên từng element**: `frame_block` cho khung (nền/`page`/viền/thẻ), `caption_block` cho cụm chữ (font/màu/...). **KHÔNG đọc lại `pack` / preset của dự án tại render.**
- Hệ quả: **một khung dùng ở video NÀO cũng render Y HỆT.** Khung Nhịp-đen luôn có nền caro (`page.grid=luoi-ba`); khung Prism luôn nền tối + người-mờ; trộn preset trong một video vẫn đúng từng khung.
- **CẤM render-time đọc `payload.pack.<look>`** cho phần NHÌN. Cần một giá trị cấp-VIDEO (vd defocus toàn-khung — vì cảnh toàn-khung là `scene==null`, không có block) thì **RESOLVE lúc dựng payload thành field riêng của payload** (`payload.punchDefocus`…), KHÔNG đọc `pack` trong component render.
- `page` (trong frame_block) CHỈ gồm: `tone` (màu nền + độ đục) và `grid` (lưới phủ như `luoi-ba`, hoặc `null`). Nó là nền LỘ RA khi bố cục chừa chỗ trống; `toan-khung` phủ kín thì không thấy nền.

## Quy tắc code

- Dùng full Tiếng Anh nhé (tên hàm, biến, đường dẫn, ... tất cả mọi thứ), chỉ có cái text hiện lên UI là tiếng Việt thôi

## Nếu tôi bảo làm hết đừng hỏi thì hãy tự động đi tiếp nhé

## Quy tắc báo cáo

- Nếu sửa UI thì bắt buộc phải check xem đã đúng Expect chưa có lỗi gì không, chụp ảnh tự kiểm tra nếu cần
- Nếu về UX cần tự hỏi như vậy có phù hợp cho user không? Có ảnh hưởng chức năng khác không? Có cách nào thông minh hơn không
