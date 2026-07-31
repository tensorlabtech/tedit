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

## Quy tắc code

- Dùng full Tiếng Anh nhé (tên hàm, biến, đường dẫn, ... tất cả mọi thứ), chỉ có cái text hiện lên UI là tiếng Việt thôi

## Nếu tôi bảo làm hết đừng hỏi thì hãy tự động đi tiếp nhé
