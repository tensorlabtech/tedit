# Đặc tả tương tác — màn Nhập liệu (`/upload`)

Màn này chỉ có một việc: **xếp xong mạch cảnh rồi bấm chạy**. Tài liệu chốt cách
thao tác và nêu bằng chứng cho từng lựa chọn, theo đúng bộ luật của
`editor-interaction-spec.md`.

---

## 1. Xương sống: mạch cảnh

Ở bàn dựng, xương sống là **bản chép lời** (§1 đặc tả Editor). Ở đây chưa có lời —
nên xương sống là **thứ tự các cảnh**, và đó là thứ duy nhất người dùng đang quyết
định. Hệ quả bố cục: mạch cảnh chiếm phần lớn màn, không nép ở đáy như một phụ lục.

Ô xếp trái sang phải rồi xuống dòng — đọc theo đúng lối đọc chữ, nên "cảnh nào
trước" không phải hỏi. Ô cắt theo khung **9:16** vì đó đúng là khung sẽ xuất ra:
nhìn ô là biết ngay video quay ngang sẽ mất hai bên.

**Tư liệu chèn nằm dưới và thấp hơn.** Nó không bắt buộc, mà chỗ đặt từng miếng
lại chọn ở bàn dựng theo câu chữ. Cho nó một cột ngang hàng với mạch chính là hứa
hẹn ở đây có việc phải làm, trong khi không có. Ô **không đánh số** vì chúng không
có thứ tự, và **giữ nguyên tỉ lệ gốc** — cả hàng cùng một chiều cao, bề rộng mỗi ô
một khác. Cắt tất cả về một khuôn là bịa ra một khung hình không có thật: tư liệu
chèn dán đè lên một góc màn chứ không bị đưa về 9:16.

---

## 2. Bản đồ cử chỉ

Ba việc của một ô nằm ở **ba vùng không chồng nhau** — đây là §5 của đặc tả
Editor áp cho ô tư liệu: cùng một vùng pixel hai việc thì máy phải đoán ý, và
nhích tay 5px lúc bấm là cú bấm không nổ.

| Việc | Cử chỉ | Vùng |
|---|---|---|
| Nhận ra cảnh này là cảnh nào | **Rê chuột ngang qua ô** — tua qua video | thân ô ảnh |
| Xem kỹ một cảnh | **Bấm ô** → khung Xem trước nhảy tới đúng cảnh đó | thân ô ảnh |
| Xem cả mạch chạy liền một hơi | Nút phát trong khung Xem trước — hết cảnh tự sang cảnh sau | khung xem |
| Nhảy tới một cảnh khi đang xem | Bấm khúc của nó trên dải tiến độ, hoặc hai nút ◀ ▶ | dải tiến độ |
| Đổi thứ tự | **Kéo dòng tên** dưới ô — hàng xóm tự xô ra nhường chỗ | dòng tên, cả bề ngang ô |
| Đổi thứ tự (bàn phím) | tiêu điểm vào tay nắm → `Space` nhấc, mũi tên dời, `Space` thả | tay nắm |
| Đổi thứ tự (không nhớ phím) | ⋮ → "Đưa lên trước / xuống sau" | bảng |
| Đổi vai chính ↔ chèn | ⋮ → "Chuyển sang…" | bảng |
| Gỡ, huỷ tải, thử lại | ⋮ | bảng |
| Thêm tệp | thả vào thẻ, nút ở đầu thẻ, hoặc ô `+` cuối dải | cả thẻ |

**Kéo thả dùng `dnd-kit`, không tự viết.** Bản tự viết chỉ vẽ một vạch chèn rồi
nhảy phắt sang thứ tự mới — đúng chức năng nhưng đọc ra như một bảng biểu, không
ra một mạch phim. Thư viện lo phần chuyển động (ô đang cầm bám tay, các ô khác
trượt sang nhường chỗ) và cả lối đi bằng bàn phím. Ngưỡng nhấc là **5px**: thấp
hơn thì cú BẤM để xem cảnh nào cũng hụt.

Kéo tệp từ ngoài vào vẫn là kéo-thả của trình duyệt (`dragenter`/`drop`), khác hệ
sự kiện với `dnd-kit` (con trỏ) — hai thứ không giẫm chân nhau.

**Chữ trên khung hình là CHỮ, không phải huy hiệu.** Số thứ tự và thời lượng chỉ
là ghi chú trên ảnh: chữ trắng kèm bóng đổ, đọc được trên nền sáng mà không chiếm
chỗ. Huy hiệu có nền và có mép nên mắt đọc ra "một nút gì đó" — bốn cái huy hiệu
trên một ô 100px thì không còn nhìn ra hình.

**Không chặn tệp trùng.** Một cảnh xuất hiện hai lần trong mạch là chuyện bình
thường (mở đầu bằng đúng khung sẽ nhắc lại ở cuối). Bản trước chặn theo tên + cỡ,
tức là không còn cách nào làm việc đó.

**Ba việc khác nhau, ba lối khác nhau — không cái nào thay được cái nào.**

| Câu hỏi | Trả lời bằng |
|---|---|
| Cảnh này là cảnh nào? | rê chuột qua ô (nửa giây, không phải bấm gì) |
| Cảnh này quay ra sao? | bấm ô → khung Xem trước |
| **Thứ tự này có xuôi không?** | **phát cả mạch trong khung Xem trước** |

Câu thứ ba mới là quyết định của màn này, và nó từng KHÔNG có ai trả lời: bản
trước bỏ khung xem thường trực với lý do "khung 9:16 trong ô ngang thì quá nửa là
nền trống". Lý do đó chết ngay khi bảng số liệu ở cột phải bị gỡ — cột trống sẵn
rồi, khung xem không lấy chỗ của ai cả.

Ảnh đầu cảnh một mình thì không đủ cho câu thứ nhất: quay bằng điện thoại thì mấy
giây đầu hay là cảnh đang giơ máy lên, và bốn cảnh liền nhau ra bốn ảnh gần như y hệt.

**Dải tiến độ chia theo cảnh**, mỗi khúc rộng đúng theo thời lượng của nó. Đây là
chỗ duy nhất thấy được cảnh nào dài cảnh nào ngắn mà không phải in ra con số nào —
và bấm vào khúc nào là nhảy tới cảnh đó. Viền ô trên dải cũng chạy theo, nên nhìn
mạch là biết khung bên phải đang ở đâu.

---

## 3. Cột phải: chỉ bày thứ ĐỔI ĐƯỢC MỘT QUYẾT ĐỊNH

Áp phép thử §45 của đặc tả Editor cho bảng số liệu từng nằm ở đây:

| bày ra | đổi quyết định nào | giữ? |
|---|---|---|
| `Khung hình 9:16 dọc` | không — người dùng không đổi được | ✗ |
| `Số cảnh` | không — dải cảnh đã đếm ở đầu thẻ bên trái | ✗ |
| `Tư liệu chèn: 0` | không — thẻ tư liệu đã nói | ✗ |
| `4 tệp · 8,5 MB` | không — không ai bỏ bớt video vì nặng 8MB | ✗ |
| Thời lượng "video sẽ ra" | không — **và còn nói dối**: chưa cắt gì thì đó là tổng độ dài tệp gốc, không phải độ dài thành phẩm. Đặt to giữa cột còn làm người đọc tưởng đây là khung xem bản đã ghép | ✗ |

Năm dòng còn **không dòng nào**. Cột này giờ chỉ có hàng soát, trạng thái việc
đang chạy, và chỗ trống dành cho phong cách / lời dặn sau này — nên nó tên là
**Thiết lập**.

**Và nó chỉ tồn tại khi có chuyện để nói.** Không cảnh báo, không việc đang chạy,
không lý do chặn → thẻ biến mất hẳn, khung Xem trước lấy trọn cột. Một thẻ trống
mang tên "Thiết lập" là lời hứa suông: người đọc đi tìm cái để chỉnh và không thấy
gì. Câu mặc định *"Chép lời xong sẽ mở bàn dựng…"* cũng bỏ — nó tả một việc sẽ tự
xảy ra, không đổi quyết định nào, mà lại là cái cớ duy nhất để cả thẻ đứng đó.

**Nút chạy nằm ở ĐẦU TRANG, không ở chân cột.** Đầu trang giữ đúng hai nút — đường
ra (`Trở về`) và đường đi tiếp (`Bắt đầu chép lời`). Đặt ở chân một cột số liệu
thì nó đọc ra như phần kết của một bảng thống kê chứ không ra hành động chính của
cả màn. Nhãn nút nói việc đang làm; còn *vì sao chưa bấm được* thì cột Thiết lập
nói — hai câu khác nhau, không lặp.

**Mỗi lời nhắc có một CÂU TRẢ LỜI tại chỗ** (§18): "1 cảnh quay ngang, sẽ cắt hai
bên" đi kèm nút **Xem** mở thẳng cảnh đó; "1 tệp tải hỏng" đi kèm **Thử lại**.
Đọc xong mà không có đường làm gì thì lời nhắc chỉ là tiếng ồn.

**Đổi mạch sau khi chép xong thì phải nói ra.** Thêm hoặc bớt một cảnh khi bản
chép lời đã có nghĩa là phần đó KHÔNG có lời, mà màn hình vẫn báo "đã chép xong"
và mời mở bàn dựng — sang tới nơi mới thấy một quãng video không có chữ nào. Chốt
lại bộ cảnh tại đúng lúc việc chép lời xong, so với bộ cảnh hiện tại; lệch thì
hiện một dòng kèm nút **Chép lại**.

**Khoảng trống dưới hàng soát** là chỗ của phần chọn phong cách và lời dặn sau
này. Khi thêm: phong cách phải là **mấy ô vẽ được** như bảng "Dáng khung" (§44),
không phải một thư viện mẫu dài (§10 — danh sách từ chối).

---

## 4. Tải lên: tiến độ không được đè lên thứ khác

Thanh tiến độ nằm **trong ô ảnh**, trên nền đã làm mờ, kèm số phần trăm ở giữa.
Bản trước để nó `absolute` ở mép dưới hàng nên nó đè lên chữ và lên hàng kế bên.

Hai tầng, đúng như hướng dẫn nghề cho việc tải nhiều tệp: **từng tệp** trên ô của
nó, **cả đợt** ở cột Thiết lập — nơi cũng nói vì sao nút đầu trang chưa bấm được.

Tiến độ chung tính theo **byte**, không phải trung bình phần trăm từng tệp: một
ảnh 200KB xong ngay lập tức sẽ đẩy con số lên nửa đường trong khi video 800MB mới
đi được vài phần trăm — thanh chạy vọt rồi đứng im hàng phút, đúng kiểu làm người
ta tưởng máy treo.

**Chép lời bày ra bốn bước** (`Ghép video chính → Dựng dải ảnh → Tách tiếng →
Nghe và chép lời`) chứ không chỉ một thanh: một thanh trơn không trả lời được
"còn bao lâu", còn bốn bước thì đọc ra ngay là mới đi được một phần tư hay sắp
xong. Bước đang chạy suy từ **con số tiến độ** máy chủ báo về, không so chuỗi
thông báo — đổi một chữ ở máy chủ thì danh sách vẫn đúng.

---

## 5. Hướng khung hình: đọc cỡ khi XEM, không đọc cỡ của luồng

`ffprobe` trả về luồng `1280×720` kèm `rotation: -90` cho mọi video quay dọc bằng
điện thoại. Đọc thẳng số của luồng thì màn hình gọi video dọc là "khung ngang" —
người dùng đọc được đúng câu ngược với thứ họ vừa quay.

- Máy chủ đổi chỗ bề rộng/cao khi góc xoay là bội của 90 → trả **cỡ khi xem**.
- Trình duyệt đo lại tại máy ngay lúc dựng ảnh xem trước (`videoWidth`/
  `videoHeight` đã áp metadata xoay) → nhãn đúng từ giây đầu, không đợi tải xong.
- Cảnh báo *"Video quay -90° bằng metadata"* **bỏ đi** với góc quay chuẩn: mọi
  video dọc đều dính, tải năm tệp là năm dòng cảnh báo về một chuyện chẳng có gì
  để người dùng làm. Chỉ còn báo với góc xoay lẻ.

Video **thật sự** quay ngang thì có dấu ✂ trên ô và một dòng ở cột Thiết lập kèm
nút **Xem** mở thẳng cảnh đó.

**Khung xem lớn bày ĐÚNG tỉ lệ gốc, không cắt.** Bản trước cắt sẵn về 9:16 rồi
thêm một nút đổi qua lại *Cả khung gốc / Phần sẽ giữ* — hai cách nhìn cùng một
tệp thì mỗi lần mở lại phải nhớ mình đang nhìn cái nào, và cái tên nào cũng phải
đọc hai lần mới hiểu. Việc "sẽ bị cắt hai bên" đã có ô 9:16 ngoài dải nói bằng
hình, và một câu trong khung xem nói bằng chữ.

**Tư liệu chèn cũng giữ nguyên tỉ lệ**, và ô đủ to để nhìn ra nội dung: cả hàng
cùng một CHIỀU CAO, bề rộng mỗi ô một khác. Cắt tất cả về ô vuông là bịa ra một
khung hình không có thật — tư liệu chèn dán đè lên một góc màn chứ không chiếm cả
khung, nên nó không bị đưa về 9:16 và cũng không có cảnh báo cắt.

---

## 6. Danh sách từ chối

| Từ chối | Vì sao |
|---|---|
| Hộp thoại xem cảnh | Đã có khung Xem trước thường trực; hai bề mặt xem cùng một thứ là hai chỗ phải nhớ |
| Xem trước quay vòng về cảnh 1 | Hết mạch phải DỪNG, không thì không biết đã hết hay mình xem lộn lần hai |
| Cho cả ô kéo được | Thân ô đã là chỗ bấm-để-xem; hai việc một vùng pixel là máy phải đoán ý |
| Bảng số liệu về dự án | Không con số nào trong đó đổi được một quyết định — và con số độ dài còn nói dối |
| Chặn tệp trùng tên | Một cảnh dùng hai lần là chuyện bình thường; chặn là bịt luôn lối làm |
| Hai cách nhìn một tệp (`Cả khung gốc` / `Phần sẽ giữ`) | Mở lại phải nhớ mình đang nhìn cái nào; ô 9:16 ngoài dải đã nói việc cắt bằng hình |
| Thanh cuộn trong hai dải | Mép mờ dần đã nói "còn nữa"; thêm một vạch xám nữa là nói hai lần, mà lại ăn chỗ của ảnh |
| Đếm cảnh và tổng thời lượng ở đầu thẻ | Dải tự đếm được bằng mắt; độ dài thật thì phải cắt xong ở bàn dựng mới biết |
| Thư viện phong cách dài | Chọn nhiều không phải là dễ dùng (§10 đặc tả Editor) |
| Màn xử lý riêng sau khi bấm chạy | Trạng thái ở lại đúng chỗ vừa bấm |
| Vào thẳng bàn dựng rồi chép lời nền | Bàn dựng rỗng lúc chờ thì người dùng không hiểu phải đợi gì |

---

## 7. Ca kiểm

- Thả 5 video dọc quay bằng điện thoại → **không** ô nào mang nhãn "khung ngang".
- Thả một video quay ngang thật → ô có dấu ✂, cột Thiết lập có một dòng kèm nút
  **Xem**, bấm vào mở đúng cảnh đó.
- Rê chuột ngang qua một ô → hình đổi theo tay, có vạch báo đang đứng ở đâu.
- Kéo dòng tên ô thứ ba lên đầu → các ô khác **trượt sang nhường chỗ**, thả xong
  số đánh lại 1‑2‑3 và thứ tự đẩy lên máy chủ.
- Tiêu điểm vào tay nắm → `Space` `→` `Space` cũng đổi được chỗ.
- Thả cùng một tệp hai lần → có hai ô, không bị từ chối.
- Bấm thân ô → khung lớn mở, `←` `→` đi được cảnh trước sau.
- Tải một tệp hỏng → ô đỏ, cột Thiết lập có **Thử lại**, bấm là tải lại đúng tệp
  đó; mở khung xem thì đọc được lý do, không phải một khung đen câm.
- Thả một ảnh ngang và một ảnh dọc vào tư liệu chèn → hai ô cùng chiều cao, bề
  rộng khác nhau, và thẻ không phình ra theo tấm cao nhất.
- Màn cao 720px: không thẻ nào đè lên nút, không ô nào bị gọt viền.
- Chép lời xong rồi thêm một cảnh → hiện dòng "Mạch đổi sau khi chép lời" kèm nút
  **Chép lại**; bấm vào là bốn bước chạy lại, xong thì dòng đó biến mất.
- Ảnh chèn **không** có huy hiệu thời lượng (ffprobe trả 0,04 giây cho tệp ảnh).
- Ô tư liệu chèn vừa đủ chỗ → dòng tên **không** bị làm mờ (mép chỉ mờ khi thật
  sự còn nội dung ở dưới).
- Máy để chế độ tối → cả trang tối theo, không riêng trang design system.

---

## 8. Mã dự án nằm trên ĐƯỜNG DẪN

`/upload` không mang mã dự án: tải lại trang giữa chừng là mất sạch mạch vừa xếp, trong khi
các tệp vẫn nằm nguyên trên đĩa. Dự án đó thành một mục "Chưa chép lời" mà không ai còn
đường quay lại — và đó chính là nguồn của loạt dự án rác trong danh sách.

Nay đường dẫn là `/upload/:projectId?`: thả tệp đầu tiên xong, mã dự án nhảy lên thanh địa
chỉ (`replace`, không thêm mục lịch sử — người dùng chưa "đi" đâu cả). Mở lại đường dẫn đó
thì màn tự dựng lại từ máy chủ: mạch cảnh, tư liệu chèn, và cả tiến độ chép lời đang chạy dở.

**MỘT route với đoạn cuối không bắt buộc, không phải hai route riêng.** Hai route là hai chỗ
khác nhau trong bảng nên React Router dựng lại màn từ đầu đúng lúc dự án vừa sinh ra mã —
mạch vừa xếp bị xoá sạch ngay giữa lần tải tệp đầu tiên.

Ô khôi phục không còn `File` trong bộ nhớ trình duyệt, nên nó phát bằng đường của máy chủ
(`remoteUrl`). Thiếu đường ấy thì các ô mở lại thành ảnh tĩnh không xem được.

## 9. Tệp hỏng: `ffprobe` KHÔNG ném lỗi cho mọi tệp hỏng

Ném vào nó 200KB byte ngẫu nhiên đặt đuôi `.mp4` thì nó vẫn đoán ra một luồng 352×288 dài 0
giây và trả về bình thường. Tệp đó đi tiếp thì thành một ô trông như dùng được, và chỗ vỡ
dời tới tận lúc dựng — sau khi người dùng đã đợi vài phút chép lời.

Nên sau khi đo phải hỏi thêm: không có khung hình, hoặc là video mà không dài nổi một khung,
thì trả lại kèm lý do đọc được.

## 10. Ô tải hỏng KHÔNG chiếm một số cảnh

Ô hỏng bị máy chủ trả lại nên nó không có mặt trong thành phẩm. Đánh số cho nó thì mọi cảnh
sau nó bị gọi sai tên cho tới hết dải, và khung Xem trước báo "Cảnh 1/4" cho một mạch chỉ có
ba cảnh — khúc thứ tư của thanh mạch không bao giờ chạy tới.

## 11. Dấu ✂ chỉ có nghĩa với CẢNH CHÍNH

Cảnh chính cắt về khung 9:16 nên video ngang mất hai bên thật. Tư liệu chèn dán đè lên một
góc màn và giữ nguyên tỉ lệ — gắn ✂ lên nó là doạ người dùng bằng một chuyện không xảy ra.

## 12. Ô đo mình theo VÙNG CUỘN, không theo chiều cao màn

Đo bằng `vh` thì ở màn 720px một hàng ô cao 225px nằm trong vùng cuộn 222px — dòng tên bị xén
ngang giữa chữ ngay lần đầu mở, dù chỉ có đúng một hàng và chẳng có gì để cuộn tới.

Vùng cuộn khai `container-type: size`, ô rộng theo `100cqh`. Lưu ý cú pháp: `9/16` trong lớp
tuỳ ý của Tailwind bị đọc thành modifier — phải viết `0.5625`.

## 13. Máy chép lời BỊA khi không có ai nói — chặn bằng chính sóng âm

Thả một video chỉ có nhạc vào: whisper trả về đúng một câu, thường là *"Cảm ơn các bạn đã
theo dõi."*, trải suốt 26 giây, độ chắc từng chữ 0,99, các từ dồn cả về hai đầu (một từ dài
**25,6 giây**). Không có gì trong bản chép lời nói rằng nó bịa — người dùng mở bàn dựng ra và
tưởng máy nghe nhầm.

Cách duy nhất biết chắc là đối chiếu với đường bao âm lượng đã đo sẵn (§51 của đặc tả
Editor). Đo hai video thật, phân tách rất rộng:

```
                      video chỉ có nhạc     video có lời thật
  tỉ lệ ô có tiếng          0,00            min 0,56 · trung vị 0,78
  từ dài nhất              25,62 giây             0,78 giây
```

Nên ngưỡng đặt rất bảo thủ (`hallucination-filter.ts`): bỏ câu khi khoảng của nó **dưới 15%
số ô có tiếng**, hoặc khi có một tiếng dài quá 3 giây / mô hình tự nghi trên 60% *và* sóng âm
cũng thưa tiếng. Kiểm ngược trên video có lời: **không câu nào bị lọc nhầm** (27/27 giữ
nguyên, chép lại lần nữa vẫn 27 và neo lại đủ 58 phần tử).

Không đo được sóng âm thì KHÔNG đoán — giữ nguyên mọi câu. Câu bịa còn sửa được bằng tay,
câu thật bị xoá thì không.

**Kết quả rỗng phải nói thẳng.** Việc chép lời kết thúc với *"Không nghe được lời nào — video
này không có tiếng nói"*, và cột Thiết lập hiện dòng nhắc đó kèm nút **Thêm video** — câu trả
lời đúng là đổi tư liệu, chứ chép lại cùng một tệp câm thì vẫn ra ngần ấy.

Kèm theo một chỗ dọn: phần tử neo vào từ mà lần chép sau không còn từ nào để neo lại thì bị
phép nối ở khâu xuất loại IM LẶNG, trong khi bàn dựng vẫn bày nó ra. Xoá xác đó — nhưng chỉ
SAU khi đã neo lại xong, vì ngay sau khi xoá bảng từ thì mọi phần tử đều đang mồ côi.
