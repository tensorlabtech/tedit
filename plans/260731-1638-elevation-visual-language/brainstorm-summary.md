# Ngôn ngữ thị giác: tách tầng bằng ánh sáng

Ngày 31/07/2026 · phiên brainstorm · chưa thực thi

## Vấn đề

Giao diện đọc ra "nhạt": cả màn là một mảng trắng, không thấy được đây là lưới
bento nhiều khối.

Đo trên `src/index.css` và `src/routes/`:

| Thứ đo | Hiện tại |
|---|---|
| Chênh nền trang ↔ mặt thẻ (sáng) | 2,5% (`0.975` → `1.0`) |
| Chênh mặt thẻ ↔ viền (sáng) | 4,5% (`1.0` → `0.955`) |
| `--muted` / `--secondary` / `--accent` (tối) | `0.245` / `0.255` / `0.262` — chênh 1–1,7% |
| `--muted` / `--secondary` / `--accent` (sáng) | `0.958` / `0.95` / `0.95` — hai cái sau trùng khít |
| Số chỗ tách khối bằng **nền** | 79 |
| Số chỗ tách khối bằng **viền** tự vẽ | 123 |
| Số chỗ Card lồng Card | **0** |

## Chẩn đoán

Card lồng Card **không phải** vấn đề — không file nào lồng quá một tầng.

Vấn đề thật: **ba token nói cùng một nấc sáng, rồi hết nấc.** Không còn nấc nào
để diễn tả "đang trỏ vào" hay "đang chọn", nên mọi thứ phải với sang viền — đó là
nguồn của 123 chỗ viền tự chế.

Đối chiếu ảnh tham khảo (VisionX): nó dùng **ít màu hơn** Tedit (1 accent + 2 lane,
so với 4 hue lane + primary + success + destructive) mà vẫn đậm đà hơn, vì nó tách
tầng bằng **độ sáng**, không bằng viền.

## Bộ quy luật

### A. Ánh sáng thay cho đường kẻ

1. **Nổi lên thì sáng lên.** Bốn nấc đều nhau, không bóng đổ.
2. **Viền chỉ dùng khi hai thứ cùng độ sáng đứng cạnh nhau.**
3. **Ô nhập là một mảng, không phải một cái khung.** Đang gõ thì sáng thêm nấc.
4. **Gom nhóm bằng kẻ ngang chạy hết bề ngang thẻ**, âm lề đúng bằng đệm thẻ.
   **Tiêu đề thẻ cũng có kẻ dưới** — trừ thẻ chỉ có tiêu đề mà không có thân.
   **Mảng nền chỉ cấp cho thứ bấm được, không cấp cho một nhóm.**
   *(Chốt khác khuyến nghị ban đầu của tôi — tôi đề xuất khoảng hở và để kẻ ngang
   cho riêng mép vùng cuộn.)*
5. **Càng nhỏ càng ít bo.** `--radius` xuống `0.5rem`: thẻ 11px · ô nhập và nút
   6px · khối trên dải 3px. Đệm thẻ 20px → 16px.
6. **Nhãn nằm bên trái ô, cùng một hàng.** Nhãn nằm trên ô tốn hai dòng cho mỗi
   trường — phần lớn cảm giác "thưa" đến từ đó, không từ đệm.

### B. Màu là dấu hiệu, không phải lớp sơn

6. **Màu chủ đạo chỉ xuất hiện ở chỗ đang xảy ra.** Cả màn không quá bốn vệt.
7. **Dải thời gian là nơi duy nhất được đậm màu** — `chroma 0.12`, nền mang sắc
   với chữ cùng sắc nhưng sáng hơn. Không dùng nền đặc chữ trắng.
8. **Đang chọn thì đổi màu chữ, không đổi nền.**
9. **Nút: trần khi đứng thành thanh icon, nền nấc 2 khi có chữ, đặc màu chủ đạo
   cho đúng một việc chính. Không nút viền.** Nút cùng nền nấc 2 vẫn không lẫn
   với ô nhập, vì nút ôm sát chữ và căn giữa còn ô nhập kéo dài và căn trái.
   Bỏ `variant="outline"` — lý do là viền không còn chỗ trong hệ thống (luật 2),
   không phải vì nhầm với ô nhập.
9c. **Đang gõ = lên nấc, không mọc vòng sáng.** Vòng sáng lúc focus là cùng một
    thứ với viền, chỉ dày hơn và có màu — nó vẽ lại đúng cái khung đang bị bỏ.
    Ô đang gõ lên nấc 4, cao hơn hover một nấc.
9d. **Mục đang chọn: nấc 2 + chữ màu chủ đạo**, không dùng nấc 4. Nấc 4 là trạng
    thái ngắn (đang nhấn, đang mở); gán cho mục đứng yên suốt buổi thì màn hình
    lúc nào cũng có một mảng sáng không tắt.
9e. **Lời nhắn: nền mang sắc, không vệt mép, không viền.** Vệt màu mép trái là
    một cái viền chỉ có một cạnh, mà nền đã mang sắc rồi thì nó nói lại đúng điều
    nền vừa nói. Lời nhắn không có sắc riêng thì rơi về nấc 2.

### C. Chữ phân tầng bằng độ sáng

10. **Nhãn mờ, giá trị rõ.** Cùng cỡ, cùng không đậm, chỉ khác độ sáng.
11. **Số liệu phải đứng yên** — timecode dùng chữ số đều bề ngang.
12. **Icon một sức nét, không tô đặc.**

### D. Nội dung mới là thứ đẹp

13. **Trang trí duy nhất được phép là dữ liệu** — ảnh cảnh, sóng âm, khung hình.
14. **Nội dung là vật sáng, giao diện là bóng tối quanh nó.**

### E. Kỷ luật của thang

15. **Mỗi nấc sáng nói một điều; không hai nấc nói cùng một chuyện.**
16. **Thang sáng chỉ áp cho giao diện.** Nội dung của người dùng không nằm trong
    thang — nó là vật đặt lên bàn, không phải một tầng của cái bàn.

## Thang 5 nấc

| Nấc | Nghĩa | Tối | Sáng |
|---|---|---|---|
| 0 | nền trang | `0.115` | `0.925` |
| 1 | mặt thẻ | `0.195` | `0.99` |
| 2 | chỗ nhận thao tác | `0.245` | `0.955` |
| 3 | đang trỏ vào | `0.275` | `0.93` |
| 4 | đang nhấn / đang gõ | `0.305` | `0.905` |

Trong thẻ: cách đều 5% (tối) / ~3% (sáng). **Nền trang cách xa hơn phần còn lại**
— 8% ở bản tối. Để nó cách đúng một bước như các nấc bên trong thì mắt không tách
được "đây là một khối" với "đây là một ô bấm được"; ảnh tham khảo cũng để nền app
gần như đen rồi mới cho panel nổi lên.

Hệ quả: **chỗ nào lệch khỏi mặt thẻ là chỗ bấm được** — một lời hứa với người
dùng, nên không được cấp nền cho thứ không bấm được.

## Gán token

Giữ nguyên tên shadcn, chỉ đổi giá trị:

- `--muted`, `--secondary`, `--input` → nấc 2
- `--accent` → nấc 3 (đúng vai trò gốc: hover của menu/select)
- **thêm mới** `--accent-active` → nấc 4 (hiện chưa có token nào cho trạng thái này)
- `--border` → tối `8%`, sáng `0.90`
- Bản tối giữ xám trung tính hoàn toàn; bản sáng thêm `chroma 0.004 hue 310`

## Đổi token là chưa đủ — `card.tsx` phải sửa theo

`Card` gắn cứng `ring-1 ring-border`, nên không token nào bỏ được viền quanh thẻ.
Mà mặt thẻ đã cách nền trang 8% độ sáng thì viền ở đó không còn việc gì để làm —
đúng luật 2.

Đây là chỗ chứng minh rằng "chỉ đổi giá trị token, 60 component không phải sửa"
là **sai**. Danh sách component phải sửa, tính tới giờ:

- `card.tsx` — bỏ `ring-1 ring-border`
- `input.tsx`, `textarea.tsx`, `select.tsx` — viền → nền nấc 2
- `button.tsx` — bỏ `variant="outline"`; nút phụ thành trần
- `card.tsx` — thêm `CardSeparator` (kẻ full-bleed tự tính âm lề)

Bàn thử tạm tắt viền bằng CSS trong phạm vi trang (`[data-slot="card"]`); chốt
xong thì sửa thẳng vào component và xoá luật tạm đó.

## Quyết định đã chốt

- Nền **tối** làm mặc định; bản sáng vẫn làm tử tế.
- Mặt thẻ **rời khỏi trắng tinh** (`0.99`) để nền sáng đủ nấc.
- Thẻ vẫn ở tầng ngoài cùng của lưới bento; **bên trong thẻ không đẻ thẻ con**.
- **Font tiêu đề để nguyên Be Vietnam Pro trong vòng này.** Đổi font cùng lúc với
  đổi thang nền thì không biết cái nào tạo ra hiệu quả. Tách thành vòng riêng, và
  phải render `ĐƯỜNG TỐI ƯU HOÁ` cỡ lớn nhìn dấu tận mắt trước khi chọn — grotesk
  hình học thường đặt dấu tiếng Việt xấu.
- Màn `/upload` để im, sẽ đổi theo tầng dưới.

## Việc kèm theo

`CardSeparator` vào design system — kẻ full-bleed tự tính âm lề theo
`--card-spacing`. Đây là chỗ dễ viết sai nhất (`-mx-5 border-t` gõ tay mỗi nơi
một kiểu) và là một nguồn của 123 chỗ viền tự chế.

## Bước tiếp: trang mock

`/_dev/skin`, token khai trong phạm vi trang — `src/index.css` không đụng tới.

Nửa trên, bày nguyên liệu:
- 5 nấc có nhãn nghĩa, đổi sáng/tối tại chỗ
- Ô nhập dạng mảng đặt cạnh bản viền hiện tại
- Ba cách gom nhóm cạnh nhau: khoảng hở · kẻ ngang · thẻ con (đối chứng)
- Nhãn mờ / giá trị rõ
- Tab đổi màu chữ vs tab viên nền
- Nút phụ icon trần vs nút có nền
- Lane chroma `0.05` hiện tại đặt cạnh bản `~0.18`

Nửa dưới: màn editor giả, dữ liệu tĩnh, để nhìn cả bộ luật hoạt động cùng lúc.

Chọn editor vì nó va vào nhiều luật nhất — nhất là luật 14 (nội dung là vật sáng)
và luật 7 (chỉ dải được đậm màu).

## Chỗ chưa bằng ảnh tham khảo

**Bốn sắc trên dải là chỗ thua rõ nhất.** Ảnh tham khảo dùng hai sắc cùng họ
(indigo + tím); Tedit dùng bốn sắc rải khắp vòng tròn — tím 310, lam 195, lá 145,
đỏ 25. Nhìn cả dải cùng lúc thì nó ra cầu vồng, và tệ hơn: **lá và đỏ là ngôn ngữ
"đúng/sai", không phải ngôn ngữ phân loại.** Một khối đỏ trên dải đọc ra như lỗi.

Đề xuất gom về một họ lạnh, để dành lá và đỏ cho báo trạng thái:

| Lớp | Sắc hiện tại | Đề xuất |
|---|---|---|
| Chữ trên màn | 310 | 310 |
| Tư liệu chèn | 195 | 270 |
| Nhạc nền | 145 | 230 |
| Chỗ nối | 25 | 190 |

Chưa áp — đây là vốn màu đã khai trong `src/index.css` kèm lý do, cần người
quyết chứ không tự đổi.

## Câu còn treo

- Nấc 4 dùng nền, nhưng luật 8 nói "đang chọn thì đổi màu chữ". Ranh giới: nấc 4
  cho **mục trong danh sách/menu**; tab và điều hướng dùng màu chữ. Cần nhìn mock
  rồi chốt.
- Sau khi thang nấc đứng, 123 chỗ viền tự vẽ phải rà lại — chỗ nào thành thừa.
