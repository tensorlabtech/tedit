## Dự án Tedit nhé, tên thư mục tôi viết sai là Teddit đấy

## Về quy tắc UI

### Sử dụng design system

Dự án này thiết kế với giao diện đồng bộ vả nhất quán, chấp nhận sự đơn điệu nếu cần để bảo về quan điểm này

- Sử dụng tối đa design system component tử Shadcn (đã được custom), kiểm tra tại /\_dev/design-system#button
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

## Quy tắc code

- Dùng full Tiếng Anh nhé (tên hàm, biến, đường dẫn, ... tất cả mọi thứ), chỉ có cái text hiện lên UI là tiếng Việt thôi

## Nếu tôi bảo làm hết đừng hỏi thì hãy tự động đi tiếp nhé

## Quy tắc báo cáo

- Nếu sửa UI thì bắt buộc phải check xem đã đúng Expect chưa có lỗi gì không, chụp ảnh tự kiểm tra nếu cần
- Nếu về UX cần tự hỏi như vậy có phù hợp cho user không? Có ảnh hưởng chức năng khác không? Có cách nào thông minh hơn không
