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

**Nguồn tư liệu chọn ngay trên tiêu đề thẻ ấy**, không đẩy sang trang Cài đặt. Ba
nấc: *chỉ tư liệu của dự án* — *thêm tư liệu đã đánh dấu ★* — *cả kho tư liệu*. Nó
nói về đúng cái kho nằm ngay dưới nó, và mỗi video một khác: video này toàn cảnh
quay sẵn thì mở cả kho, video sau chỉ dùng mấy tệp vừa nạp. Trang Cài đặt chỉ quyết
giá trị **mặc định lúc tạo dự án**; đổi ở đó không đụng tới dự án đã tạo, để một
lượt chạy lại không tự nhiên mọc thêm tư liệu lạ.

Mặc định là *thêm tư liệu đã đánh dấu*, không phải *chỉ tư liệu của dự án*: kho mà
máy không với tới được thì nó chỉ là một thư mục để nhìn. Mặc định này không bất
ngờ — nó chỉ đụng thứ người dùng đã chủ động gắn sao, chưa gắn cái nào thì hành xử
y như trước khi có kho.

Ba ràng buộc cứng, code giữ chứ không nhờ mô hình nhớ:

| Ràng buộc | Vì sao |
|---|---|
| Chỉ lấy tư liệu **có mô tả** | Chặng ghép khớp mô tả với lời để chọn chỗ. Không mô tả thì nó đoán mù. |
| Chặn trần **60 ứng viên**, ưu tiên tệp có sao rồi tới tệp mới nhất | Kho vài trăm tệp đổ hết vào lời nhắc là vừa đắt vừa loãng. |
| Tệp lấy từ kho mang **nhãn "từ kho"** trên khối ở dải và trên ô trong bảng chèn | Mở bàn dựng thấy một clip mình chưa từng thêm mà không có gì đánh dấu thì đọc ra như máy bịa ra tệp. |

**Hai đường vào kho, cả hai luôn hiện**: nút *Từ kho* mở hộp chọn nhiều tệp một
lượt, nút *Thêm tư liệu* lấy tệp từ máy. "Từ kho" không nấp trong menu thả xuống
của nút kia — kho là thứ người dùng phải BIẾT là có, mà một mục trong menu thì chỉ
ai đi mở ra mới thấy. Hộp chọn cho chọn **nhiều cái một lượt** (khác hộp ở bàn dựng,
mỗi lần một cái): ở đây người ta đang gom nguyên liệu cho cả video, đi lại mười vòng
cho mười tệp thì không ai làm.

Ô **"+ Thêm"** cuối dải mở **menu hai đường** thay vì lẳng lặng bật hộp chọn tệp: ở
tiêu đề thẻ hai đường là hai cái nút đứng cạnh nhau, nhưng ở cuối dải chỉ có chỗ cho
một ô — mà một ô "thêm" chỉ làm được một trong hai việc thì ai kéo tới cuối dải sẽ
tưởng ở đây không lấy được từ kho. Ô "Thêm" của **mạch chính** vẫn bật thẳng hộp chọn
tệp: kho chỉ chứa tư liệu chèn, không có đường thứ hai để mà chọn.

**MỘT hộp chọn tư liệu cho cả màn nạp lẫn bàn dựng** (`components/media-picker-dialog`),
chia **hai tab**:

| Tab | Chứa gì | Nút chính |
|---|---|---|
| **Của dự án** | tư liệu chèn đã có trong dự án, kèm ô "Lấy tệp" từ máy | bàn dựng: *Chèn vào 0:12* — màn nạp: không có (chỉ để xem lại) |
| **Kho tư liệu** | kho dùng chung, chọn nhiều cái một lượt | bàn dựng: *Lấy về dự án* — màn nạp: *Thêm vào dự án* |

Trước là ba hộp rời: "Chèn tư liệu" ở bàn dựng chỉ thấy tệp dự án, một dải mở-ra-tại-chỗ
để lấy từ kho, và một hộp kho riêng ở màn nạp. Cùng trả lời một câu hỏi — *"cái nào là
cảnh tôi cần"* — mà bày ba kiểu, và người dùng phải nhớ mở cửa nào mới thấy tệp mình
đang tìm. Đổi tab giờ chỉ đổi thứ nằm trong lưới; khung ngoài đứng yên.

Ô mang **tên trong dải mờ đè lên đáy ảnh**. Ô từng không in tên, lý do "tên tệp do
máy ảnh đặt thì không phân biệt được gì" — nhưng đo trên kho thật thì lý do ấy không
đứng: ba trong bảy clip là *hai bàn tay trên bàn phím*, ảnh nào cũng như ảnh nào, và
cách duy nhất phân biệt là đọc "Gõ bàn phím cận cảnh" với "Ngồi bàn làm việc gõ phím".
Cột xem trước chỉ trả lời được cho MỘT ô mỗi lần bấm — nó để xác nhận, không để quét
cả lưới.

Vùng hai cột có **chiều cao sàn** bằng đúng trần của vùng cuộn. Thiếu nó thì lọc ra ít
ô là hộp co lại, lọc ra rỗng thì co thêm lần nữa — đổi bộ lọc mà hộp nhảy hai nhịp
ngay dưới con trỏ.

Lọc mà **giấu mất ô đang chọn** thì ô rỗng nói ra: *"N tư liệu đã chọn vẫn còn, chỉ
đang bị lọc giấu"*. Không thì lưới trống trơn mà nút *Thêm* vẫn sáng, đọc ra như lỗi.

**Hai cột, không phải trên–dưới**: tư liệu ở đây là video DỌC, xếp khung xem trước xuống
dưới lưới thì nó ăn hết chiều cao bảng còn bảng thì dài quá màn. Cột phải **rộng cố định**
— khung xem là 9:16, cho nó co theo bảng thì mỗi lần đổi bề rộng cửa sổ là chiều cao cả
bảng nhảy theo. Ô trong lưới **không in tên**: tên đầy đủ chỉ có một chỗ, ở cột xem trước,
nơi có chỗ đọc hết cả dòng.

Trên hàng đầu: tab, ô tìm theo tên/mô tả, và bộ lọc **Tất cả · ★ · Ảnh · Video** (dấu sao
chỉ hiện ở tab kho — tệp của dự án không đánh dấu được).

Lấy tệp từ kho xong thì hộp **ở lại**, tự sang tab *Của dự án* và **chọn sẵn** tệp vừa
lấy: việc tiếp theo (chèn vào vạch) làm ở tab ấy, đóng hộp đi là bắt người dùng mở lại và
tự tìm lại tệp mình vừa lấy.

**Ảnh-hay-video do máy chủ chốt** (`kind`, suy từ đuôi đường dẫn thật trên đĩa). Giao diện
từng tự đoán bằng đuôi của `name` — mà `name` là chữ người dùng đặt, và tệp lấy từ kho
mang luôn tiêu đề nên có thể chẳng còn đuôi nào; khi ấy một clip bị vẽ như tấm ảnh và
khung xem trước dựng thẻ `<img>` cho tệp video rồi ra ô hỏng.

Tệp kho đã có trong dự án mang nhãn **"đã có"** — nhắc chứ **không chặn**: một cảnh
dùng hai lần trong cùng video là chuyện bình thường, mở đầu bằng khung sẽ nhắc lại ở
cuối chẳng hạn.

Chỉ tệp **được chọn** mới chép về dự án — duyệt xong hết luật rồi mới chép. Chép
trước rồi mới duyệt cũng chạy, nhưng đề xuất nào bị luật gạt sẽ để lại một tệp thừa
nằm trong dự án mà không khối nào trỏ tới.

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

## 14. Ô "Video nói về gì" — tên riêng là chỗ máy nghe sai mà không gì chữa được sau đó

Một ô văn bản trong thẻ **Thiết lập**, ghi vào `projects.profile`. Hiện ngay khi có một cảnh
chính tải xong — không đợi tới lúc có lời nhắc nào, vì điền sau khi đã chép lời thì muộn mất
một lượt.

Nó vào hai chỗ:

- **Mồi từ vựng cho máy nghe** (`asr-bias.ts`): đứng TRƯỚC danh sách từ rời, vì đây là văn xuôi
  thật nên whisper bám được cả văn phong.
- **Chặng sửa lời** của mạch tự động: lời tự khai được tin hơn mọi suy đoán, nhất là tên riêng.

Đo trên đúng một đoạn tiếng 9 giây, chỉ khác mỗi ô này:

```
  ô rỗng:      "Mình lập một công ty phần mềm tên là Tensolab, …"
  có lời dặn:  "Mình lập một công ty phần mềm tên là TensorLab, …"
```

Chép lại cả video 38 giây với lời dặn thật cũng ra `TensorLab` và `network` đúng mặt chữ. Đây
là loại lỗi KHÔNG có cách nào chữa từ dữ liệu: không ngữ cảnh nào cho máy đoán ra tên một công
ty chưa ai từng nghe.

**Ghi lúc RỜI Ô, không ghi từng phím** — người ta gõ liền một câu dài, mỗi phím một lượt gọi
máy chủ là vô ích.

**Tắt soát chính tả.** Tên riêng chính là mục đích của ô này, mà bộ soát gạch đỏ đúng những từ
ấy: ô nào gõ đúng ý nhất lại trông sai nhất.

### Sửa lời dặn sau khi đã chép lời thì phải mời chép lại

Bản chép cũ vẫn còn nguyên chỗ nghe sai. Không nói ra thì người dùng gõ đúng tên công ty vào
rồi mở bàn dựng, và thấy y nguyên cái tên viết sai — công gõ thành công cốc.

Mốc so sánh nằm ở MÁY CHỦ (`projects.profile_at_transcribe`, đóng ngay sau khi máy nghe trả
lời), không phải một `ref` trong màn hình: giữ trong bộ nhớ thì tải lại trang là lời nhắc biến
mất đúng lúc nó còn đúng. Cột rỗng nghĩa là "không biết" — dự án chép từ trước khi có cột này
thì không nhắc, vì nhắc sai còn tệ hơn không nhắc.

Dòng nhắc dùng lại đúng nút **Chép lại** của trường hợp đổi mạch, và nhường chỗ cho nó khi cả
hai cùng đúng — hai dòng cùng một nút chỉ làm người đọc phải chọn giữa hai thứ giống nhau.

## 15. Tiêu đề màn này là tên THẬT của dự án

Từng viết cứng chữ *"Dự án mới"*. Đặt tên ở bàn dựng rồi quay lại màn nạp tệp thì nó vẫn gọi dự
án là "Dự án mới" — người dùng không có cách nào biết mình đang mở đúng dự án nào. Màn này chỉ
ĐỌC tên; đặt tên vẫn là việc của bàn dựng, nơi có sẵn hộp sửa tên.

## 16. Bố cục: hai cột — NỘI DUNG và XEM TRƯỚC

```
┌─────────────────────────────┐  ┌──────────────────┐
│ Dự án   tên · lời dặn · cài │  │ Trở về    [Chạy] │
├─────────────────────────────┤  ├──────────────────┤
│ Mạch chính  ▸ cuộn ngang    │  │   Xem trước      │
├─────────────────────────────┤  │                  │
│ Tư liệu chèn ▸ cuộn ngang   │  │   ◀ ▶ Cảnh 1/6   │
└─────────────────────────────┘  └──────────────────┘
         2fr                           1fr
```

**KHÔNG có đầu trang riêng.** Nó từng chiếm một hàng full-width cao 88px cho đúng hai cái nút và
một cái tên — mà cái tên nay đã có ô riêng trong khối Dự án (§17), nên nó chỉ còn là bản trùng. Hai
nút xuống card hành động ở đầu cột phải: chỗ đó ngay trên khung xem, đúng nơi người ta soát lần cuối
trước khi bấm chạy, và câu *"vì sao nút chưa bấm được"* đi theo được sang đó — trước nó nằm trong
khối Dự án, cách cái nút cả một chiều ngang màn.

Card đó dùng `size="sm"` (đệm 16px), và tiêu đề "Tiếp theo" nằm CÙNG HÀNG với hai nút —
`CardHeader` tự thành lưới hai cột khi có `CardAction`, nên thêm tiêu đề mà card vẫn **72px**.

### Mọi thứ ĐỔI CHIỀU CAO đều ở card "Tiếp theo", không ở card Dự án

Card Dự án nằm ở hàng `auto` đầu cột nội dung, nên cao thêm một dòng là hai dải ô bị bóp đúng chừng
ấy. Từng có hàng soát, thanh tiến độ và bốn bước chép lời ở đó: thả tệp vào là cả layout xô lệch một
nhịp giữa lúc đang làm.

Chúng đã sang card "Tiếp theo" — cạnh chính cái nút chúng đang nói về. Bốn bước chép lời thì **bỏ
hẳn**: `/pipeline` có card "Các bước" đầy đủ, mà bấm chạy là màn hình sang đó ngay.

Đo khi thêm một cảnh vào dự án đã chép lời: Dự án 224 · mạch chính 288 · kho chèn 192 — **không thẻ
nào đổi**; chỉ khung xem co 481→445px, và nó có sàn `14rem` chặn đáy.

Đo ở màn 1160px sau khi bỏ đầu trang:

```
              trước      sau
Mạch chính     436   →   484     ô 181×342 → 208×390
Tư liệu chèn   380   →   420     ô 149×286 → 172×326
Xem trước     1056   →  1064     video 872 → 880px
```

Cột nội dung xếp ba khối dọc theo đúng thứ tự làm việc: **khai báo dự án → mạch chính → kho
chèn**. `grid-rows-[minmax(17rem,auto)_minmax(15rem,1.6fr)_minmax(12rem,1fr)]`.

### Vì sao không phải ba cột

Bản trước cho kho chèn một cột ngang hàng với mạch chính. Nó đi ngược §1 — kho chèn không có việc
gì phải làm ở màn này — và đo được cái giá: kho chèn chiếm **21%** diện tích màn, còn ô mạch chính
phình lên **227px**, to hơn hẳn mức cần để nhận ra một cảnh, chỉ để thẻ khỏi trống. Cùng lúc đó
lời dặn — thứ đổi được nhiều nhất, `Tensolab` → `TensorLab` — chỉ được **11%** ở góc dưới phải.

Đã thử cả bản hai cột với kho chèn và lời dặn cạnh nhau ở hàng dưới: mạch chính rơi xuống 229px và
ô tư liệu còn **32×56px**, một ô không nhận ra nội dung gì.

### Dải ô cuộn NGANG, không xuống dòng

Đây là điểm gỡ được cả nút thắt. Xuống dòng thì bề rộng ô phải chia cho số cảnh, nên thêm một cảnh
là MỌI ô nhỏ đi, và số hàng còn đổi theo chiều cao khối — một bài toán hai chiều mà container query
không giải được, phải đo bằng `ResizeObserver` (đã từng có `use-justified-tiles.ts`, nay bỏ). Cuộn
ngang thì chiều cao là thứ cố định và bề rộng suy ra từ 9:16: `w-[calc((100cqh-3.25rem)*0.5625)]`.
Thêm cảnh chỉ làm dải dài thêm, đúng như một mạch phim vốn dài ra.

Chỉ trừ `1.25rem` — chiều cao ĐO ĐƯỢC của dòng tên: `mt-1` (4px) cộng một dòng `text-xs` (16px).

Ba con số của thời dải còn cuộn DỌC phải bỏ hết, và chúng đọc ra thành **một khoảng trống 30px dưới
mỗi thẻ**:

| Bỏ | Vì |
|---|---|
| `2.75rem` cho dòng tên | dòng tên chỉ cao 20px, không phải 44px |
| `0.5rem` chừa vệt mờ đáy | vệt mờ giờ ở mép ngang, không ở đáy |
| `pb-2` trên hàng ô | cùng lý do |

Sửa xong, ô cảnh từ 153×291 lên **171×323** và khoảng trống dưới thẻ còn 3px.

**Vệt mờ dùng `scroll-fade-r`, không `-x` và không `-b`.** `-b` mờ mép dưới, sai hướng hẳn. `-x` mờ
CẢ HAI mép ngang vô điều kiện, nên ô đầu dải bị làm nhạt trong khi bên trái nó chẳng còn gì — trông
như lỗi vẽ. `scroll-fade-r` là utility mới trong `index.css`, chỉ mờ mép phải, đúng phía "còn nữa"
của một dải xếp từ trái sang; cuộn vào giữa dải thì mép trái cụt thật, nhưng đó là phần đã xem qua.

### Mọi hàng đều cần SÀN, kể cả hàng `auto`

`auto` co được tới min-content, nên khi tổng vượt chỗ thì khối Dự án bị nén còn **40px** — đúng cái
đầu thẻ, không còn ô nhập nào. Sàn 17rem là chiều cao ĐO ĐƯỢC của nội dung nó: đầu thẻ 40 + thân
183 (hàng tên và ngưỡng 67, ô mô tả 91) + đệm 48 = 271.

Ba sàn cộng lại là 704px, mà cửa sổ cao 577px chỉ cho cột này 473px — nên cột nội dung có
`overflow-y-auto` làm **lối thoát**. Ở màn thật (≥900px) không bao giờ chạm tới: đo ở 1100px, khối
Dự án 283 · mạch chính 429 · kho chèn 268, ô cảnh 153×291, khung xem 462×834. Ở màn thấp thì thà
cuộn một đoạn còn hơn để ô cao 0 — đo đúng thế khi sàn còn 9rem: dải ô trống trơn, không một tấm
ảnh nào.

## 17. Tên dự án: một ô trong khối Dự án, ĐIỀN SẴN theo ngày

Máy nghe đọc cái tên: `asr-bias` đẩy nó vào đoạn mồi thành câu *"Video tên là …"*, nên đặt tên
"Sinh nhật 30" là đã mồi hai từ mà máy hay nghe chệch. Vậy nó phải sửa được TRƯỚC khi chép lời,
tức là ở màn này.

Ô nhập nằm trong khối Dự án (§24), và **điền sẵn** `suggestedTitle()` = *"Dự án 30/7"*: ai không
muốn nghĩ tên thì bỏ qua ô này, mà danh sách dự án vẫn phân biệt được nhau — trước đây mọi dự án
đều mang đúng chữ "Dự án mới" và cái tên không nhận dạng nổi ô nào.

Tên do MÁY đặt vẫn phải tính là chưa đặt tên. `asr-bias` khớp `/^Dự án( mới| \d{1,2}\/\d{1,2})?$/`
và bỏ nó khỏi đoạn mồi: *"Video tên là Dự án 30/7"* không giúp máy nghe đúng chữ nào, lại đẩy hai
con số vô nghĩa vào mồi. Nghiệm hai dự án cạnh nhau:

```
tên máy đặt   → "Đây là một video tiếng Việt, người nói tự quay và kể chuyện của mình."
tên người đặt → "… Video tên là "Sinh nhật 30". Có nhắc tới: TensorLab."
```

Bàn dựng vẫn dùng hộp thoại của `ProjectTitle` — ở đó không có khối nào để đặt ô.

Đầu trang từng viết cứng chữ *"Dự án mới"*: đặt tên ở bàn dựng rồi quay lại màn nạp tệp thì nó
vẫn gọi dự án là "Dự án mới", người dùng không có cách nào biết mình đang mở đúng dự án nào.

## 18. Dự án trên máy chủ KHÔNG CÒN: dựng lại tại chỗ, đừng đá người dùng đi đâu

Xảy ra thật: một tab để mở sẵn ở `/upload/:id`, dự án bị xoá ở nơi khác, rồi người dùng thả sáu
tệp vào. Mã cũ vẫn nằm trong tay màn hình nên mọi lượt tải rơi vào hư không, và dưới mỗi ô video
là một dòng đỏ:

```
{"error":"Không có dự án này"}
```

Hai lỗi trong một ảnh.

**Chuỗi JSON thô.** `uploadFiles` dùng XHR nên nó ném nguyên `responseText`, trong khi `request`
đã bóc `{"error":…}` từ lâu. Giờ cả hai đi qua `ApiError` — mang theo cả **mã trạng thái**, vì
bên gọi cần phân biệt "dự án không còn" (404, hỏng vĩnh viễn) với "máy chủ đang lỗi" (5xx, thử
lại là được), mà so chuỗi tiếng Việt thì câu chữ ở máy chủ đổi lúc nào không ai biết.

**Gặp 404 thì dựng lại dự án ngay tại chỗ** rồi gửi tiếp — MỘT lần, không lặp: dựng lại mà vẫn
404 nghĩa là lỗi ở chỗ khác, thử mãi chỉ làm ô video treo. Không đá người dùng về trang chủ: tệp
họ vừa thả vẫn còn trong tay, dựng lại mã rồi tải tiếp là xong.

Kèm một bước dễ quên: **mọi tệp đã tải lên dự án cũ cũng chết theo nó.** Bỏ qua thì màn hình bày
sáu ô "đã xong" cho một dự án chỉ có một tệp — đo được ngay lần dựng lại đầu tiên: khung xem đếm
*"Cảnh 1/2"* trong khi máy chủ giữ đúng một cảnh, và bản xuất sẽ thiếu. Còn `File` gốc trong tay
thì tải lại (người dùng không mất gì); không còn thì nói thẳng là mất, đừng để một ô xanh nói
dối.

Mở `/upload/:id` của một dự án đã mất thì dọn mã khỏi đường dẫn và mời làm mạch mới — khác hẳn
"máy chủ không trả lời", vì tải lại trang bao nhiêu lần cũng không dựng lại được nó.

## 19. Nội dung tư liệu chèn: người viết thì máy không đọc

Chặng `describe` (thứ 2/11, chạy TRƯỚC `transcribe`) gửi 3 khung của mỗi tư liệu lên mô hình để
lấy một câu mô tả, lưu vào `media_files.description`. Chặng `place` khớp câu đó với lời để chọn
chỗ đặt.

Cơ chế "người thắng máy" đã sẵn từ đầu, chỉ chưa có ô nhập nào:

```sql
WHERE project_id=? AND role='insert' AND (description IS NULL OR description='')
```

Nên viết vào cột đó là máy tự bỏ qua tệp ấy, và xoá trắng là trả nó về cho máy — `PATCH` ghi
`NULL` chứ không ghi chuỗi rỗng, cho khớp đúng điều kiện trên.

Lý do đáng cho người viết, không phải để tiết kiệm lượt gọi: **máy tả được thứ NHÌN THẤY, không
biết Ý NGHĨA.** Đo trên một tư liệu thật, máy đọc ra *"tài liệu có chữ ký và con dấu đỏ"*; nếu đó
là giấy đăng ký kinh doanh của công ty đang kể trong video thì `place` không có cách nào tự biết,
và nó đặt sai chỗ.

### Ô mô tả nằm trong KHUNG XEM, dùng chung một hàng với thanh mạch

Mô tả nói về đúng tấm hình đang hiện ngay trên nó. Ô này từng ở khối Dự án, và ở đó người dùng phải
NHỚ mình đang mô tả tư liệu nào — trong khi tấm hình thì nằm ở thẻ khác.

Thanh mạch cảnh và ô mô tả **thay nhau đứng trong một khối `h-10`**: xem cảnh chính thì đó là thanh
mạch, xem tư liệu chèn thì đó là ô nhập. Hai thứ khác hẳn nhau về chiều cao (thanh 6px, ô nhập
40px), nên để chúng tự định chiều cao thì mỗi lần bấm sang tư liệu là cả khung hình nhảy một nấc.
`h-10` là chiều cao đo được của `Input`; ở `h-9` thì ô nhập tràn 4px và đè lên hàng nút. Đo sau khi
sửa: khung video **872px ở cả hai trạng thái**.

Khối này giữ chỗ cả khi chưa chọn gì.

**Ô tư liệu chưa có mô tả mang một dấu "?"** ở góc trên, để chỉ đường tới đây — không có nó thì "ô
nào đã mô tả, ô nào chưa" là chuyện vô hình, người dùng phải bấm từng ô ra xem. Dấu là
`pointer-events-none` nên cú bấm rơi xuống nút phủ kín ô: bấm vào "?" cũng là mở khung xem. Câu
`title` của nút đó là chỗ duy nhất nói dấu ấy nghĩa là gì — *"…— chưa có mô tả, bấm để thêm"*.

`key={file.id}` trên ô: nó không có kiểm soát, nên đổi tư liệu mà không dựng lại ô thì nó giữ chữ
của tư liệu trước — và người dùng lưu mô tả của cái này sang cái khác.

**Bấm một ô tư liệu là con trỏ vào luôn ô mô tả.** Bấm ô tư liệu gần như luôn để LÀM một việc: thêm
hoặc sửa mô tả. Không tự vào thì mỗi lần lại phải rê chuột xuống dưới khung hình bấm thêm một lần
nữa, cho cùng một ý định. Bấm ô cảnh CHÍNH thì không cướp tiêu điểm — ở đó không có ô nào để gõ.

Hai chi tiết của cú tự-vào-ô này, mỗi cái chữa một lỗi:

- `focus({ preventScroll: true })` — khung xem nằm trong một cột có `overflow` riêng, để trình duyệt
  tự cuộn tới ô là nó xê dịch cả cột. Đo sau khi thêm: cột cuộn 0px.
- **Không bôi đen** chữ đang có. Mô tả máy đọc thường đúng gần hết và người dùng chỉ sửa một hai
  từ — bôi đen thì phím đầu tiên gõ vào xoá sạch nó. Con trỏ đặt ở cuối (đo: 179/179).

## 21. Vài chỗ nói lại điều đã rõ

**Khung Xem trước rỗng** từng bày cả "Chưa có gì để xem" (giữa thẻ) và "Chưa chọn cảnh nào" (hàng
nút, ngay dưới) — hai câu cùng nghĩa xếp trên nhau đọc ra như màn hình đang lặp.

**Thẻ Thiết lập khi chưa có tệp nào** chỉ còn đúng một câu "Cần ít nhất một cảnh chính tải xong",
mà thẻ Mạch chính đã nói y điều đó bằng cả một khối kèm nút. Không dựng thẻ.

**Nhãn hàng nút** rút từ "Tư liệu chèn · b-roll-1.mp4" xuống "Tư liệu · b-roll-1": chỗ đó còn
khoảng 130px sau ba cái nút và nút "Về mạch", nên nhãn dài bị cắt thành "Tư liệu chèn · …" — mất
đúng phần nói nó là tệp nào.

## 22. Tên đặt trước khi thả tệp phải theo vào dự án

`ensureProject` tạo dự án với tên cứng `"Dự án mới"`. Gõ tên rồi mới thả tệp — chuyện thường, nhất
là từ khi máy nghe đọc cái tên làm mồi từ vựng (§17) — thì tên vừa gõ mất lặng lẽ, trong khi đầu
trang vẫn bày nó ra. Giờ nó lấy tên đang hiện, qua một `ref` vì `ensureProject` chạy trong một
lời hứa đã đóng băng giá trị của lượt dựng cũ.

## 23. Khúc thanh mạch cần tooltip; các nút icon thì đã có

`Button` tự dựng tooltip từ `aria-label` khi nút chỉ có icon (`button.tsx:74`), nên nút đổi tên và
ba nút điều khiển có sẵn. Còn thiếu là từng khúc trên thanh mạch cảnh: một `<button>` thuần cao
6px, không nhãn nào — rê vào là cách DUY NHẤT biết nó là cảnh nào trước khi bấm. Nay hiện
"Cảnh 3 · main-3 · 0:42". Không bọc bằng `Button` vì khúc phải giãn theo thời lượng và không mang
dáng nút nào.

## 24. Khối "Dự án": hai cột — khai báo bên trái, mô tả bên phải

```
┌──────────────────────────┬──────────────────────────┐
│ Tên dự án   [__________] │ Video nói về gì          │
│ Tự rút chỗ lặng  0,8s    │ ┌──────────────────────┐ │
│ ──────●──────────        │ │                      │ │
│ ⬤ Tự thêm phụ đề         │ │  (cao trọn cột)      │ │
│ ⬤ Tự chọn nhạc nền       │ └──────────────────────┘ │
└──────────────────────────┴──────────────────────────┘
```

Bên trái toàn thứ MỘT DÒNG, bên phải là chỗ gõ nhiều dòng. Xếp dọc hết thì khối này cao gấp đôi và
ăn thẳng vào hai dải ô bên dưới — đo được: dải tư liệu tụt còn 56px, ô cao 0.

Khoảng cách giữa đầu thẻ và thân thẻ là **8px** cho mọi Card trong dự án: `card.tsx` tách
`--card-gap` (8px) khỏi `--card-spacing` (20px). Trước đây cả hai dùng chung một biến nên khoảng
cách giữa hai tầng bằng đúng đệm lề, đọc ra như một khoảng hở.

**Hai công tắc "tự thêm phụ đề" và "tự chọn nhạc nền" đã bỏ khỏi giao diện** cho khối này đỡ dài.
Cột `want_captions`/`want_music` và phần đọc chúng ở `pipeline.ts` vẫn còn — mặc định bật, nên hành
vi y như trước, và thêm lại một ô bật tắt sau này chỉ là việc của giao diện.

**Thanh kéo, không phải danh sách chọn**, cho ngưỡng rút lặng: đây là một con số liên tục, và cái
người ta muốn biết khi kéo là "nhiều hơn hay ít hơn", không phải "0,8 hay 1,2". Số cụ thể vẫn in
ngay cạnh nhãn. Ghi lúc THẢ TAY (`onValueCommitted`), không ghi từng nhịp kéo — một lượt kéo là
hàng chục lần gọi máy chủ; con số hiện lên thì đổi theo tay ngay (`setMinSilenceDraft`).

`value` phải là MẢNG một phần tử, không phải một số trơn: `Slider` suy số tay kéo từ chính `value`,
và với một số nó rơi về `[min, max]` — dựng ra hai tay kéo, không tay nào nhận phím mũi tên.

**Hai công tắc đều nối thật.** `want_captions` tắt thì chặng `captions` chỉ dựng đoạn mà không sinh
phần tử chữ nào (đoạn vẫn phải dựng — đoạn là chỗ cắt, không phải chữ — nên bàn dựng vẫn cắt được
như thường). `want_music` tắt thì chặng `music` trả về "người dùng tắt nhạc nền" và không chọn bài
nào. Nghiệm qua DB: bấm hai công tắc → `0|0`, bấm lại → `1|1`.

**Ngưỡng rút lặng là thật, không phải chỗ dành sẵn.** `auto-trim-silence.ts` từng ghim
`MIN_SILENCE = 0.8` trong mã; nay nó đọc `projects.min_silence`. Người kể chuyện chậm cần ngưỡng
cao hơn, video hướng dẫn nhanh thì hạ xuống cắt được nhiều hơn. **"Không rút" (0) là một lựa chọn
thật** — ai muốn tự cắt từng chỗ ở bàn dựng thì chọn nó — nên `0` không được coi là rỗng rồi rơi về
mặc định; chỉ `null` mới là chưa đặt. Máy chủ kẹp trong khoảng 0–3 giây: trên 3 giây thì gần như
không quãng nghỉ nào bị rút và cài đặt thành vô tác dụng.

Lời mời trong ô mô tả gánh luôn phần hướng dẫn (*"Tên riêng máy hay nghe sai — cứ viết vào: …"*):
một dòng `FieldDescription` riêng bên dưới tốn 20px, mà ở cửa sổ 577px cột này đã phải cuộn.

Khối này KHÔNG ẩn khi chưa có tệp. Nó từng ẩn vì lúc đó chỉ chứa một câu trạng thái trùng với thứ
thẻ Mạch chính đã nói; giờ tên và ngưỡng luôn có nghĩa, kể cả trước khi thả tệp đầu tiên, và ẩn nó
là làm cột nội dung nhảy một nấc ngay lần thả đầu.

## 25. Mốc "mạch đã chép" cũng phải nằm ở máy chủ

`transcriptStale` từng dựa vào một `ref` trong màn hình, đặt lúc nhịp hỏi tiến độ thấy việc chép lời
xong. Hệ quả: mở lại một dự án đã chép lời rồi thêm cảnh thì **không có lời nhắc nào** — `ref` là
`null` nên phép so không bao giờ chạy, mà nút vẫn mời "Mở bàn dựng" và sang tới nơi là một quãng
video không chữ.

Nay máy chủ đóng mốc `projects.main_files_at_transcribe` (id cảnh chính nối bằng dấu phẩy) ngay sau
khi máy nghe trả lời, cùng khuôn với `profile_at_transcribe` (§14). Cùng một bài học, lần thứ ba:
**thứ gì phải sống qua lần tải trang thì không giữ trong bộ nhớ màn hình.**

Chìa khoá phía client phải dùng ID MÁY CHỦ, không phải id tạm của màn hình (`f1`, `f2`…): so hai
chuỗi khác hệ id thì lần nào cũng "khác nhau" và lời nhắc kêu oan mãi.

## 26. Vài chỗ nhỏ soát ra cùng lượt

**Nhãn nút phát nói đúng thứ nó sẽ phát.** Đang xem một tư liệu chèn thì nó chỉ phát ĐÚNG miếng đó —
`onEnded` không nhảy sang cảnh sau vì tư liệu không nằm trong mạch. Gọi là "Phát cả mạch" ở đó là
hứa một việc nút không làm; nay là "Phát tư liệu này".

**Khúc thanh mạch đang xem có nền đậm hơn** (`bg-primary/30`), không chỉ dựa vào phần đã chạy: chưa
bấm phát thì mọi khúc đều rỗng và sáu khúc giống nhau hoàn toàn, trong khi nhãn bên dưới nói
"Cảnh 1/6" — người đọc không có cách nào biết khúc nào là cảnh 1.

**Lời dặn gõ trước khi thả tệp cũng phải theo vào dự án.** Ô đó hiện ngay từ đầu và người ta hay gõ
lúc đang chờ tệp tải, mà lúc ấy chưa có dự án nào để ghi vào — `ensureProject` gửi kèm nó ngay sau
khi tạo, y như đã làm với tên dự án (§22).

## 27. Màn chờ: danh sách chặng và lời trấn an

**Câu bên phải chặng đang chạy KHÔNG lấy từ `jobs.message`.** Đó là lời của job
`transcribe` và nó đóng băng ở *"Đang nghe và chép lời"* — các chặng AI sau không cập nhật nó, nên
bước "Tìm chỗ nên bỏ" cũng khoe câu đó và người đọc tưởng máy đang làm việc khác. Tên chặng đã nói
nó làm gì; thứ người đang chờ chưa biết là **nó chạy bao lâu rồi**, nên chỗ đó hiện `đang chạy 12s`
tính từ `steps.updated_at` (trang tự hỏi lại mỗi 1,5s nên số nhích theo, không cần bộ đếm riêng).

**Tên chặng một dòng, kết quả một dòng nhỏ bên dưới.** Chặng CHỜ không có dòng phụ — chữ "chờ" chỉ
nói lại đúng thứ dấu tròn mờ bên cạnh đã nói. Không có dấu gạch đầu dòng: kết quả vốn đã là chuỗi
ngăn bằng "·" (*"sửa 8 chỗ · 3 lượt"*), thêm một dấu nữa ở đầu là ba dấu giống nhau trên một dòng.

`ItemMedia` phải có `h-5` khớp chiều cao một dòng tiêu đề, không thì nó tự cao theo nội dung và dấu
tròn 6px trôi lên phía trên baseline.

### Thử lại chạy TỚI HẾT mạch, không chỉ một chặng

Nút "Thử lại" từng gọi `startTranscribe` — dựng lại từ chặng đầu, mất vài phút nghe và chép lời chỉ
để làm lại một chặng phụ. Vì đắt thế nên nút chỉ hiện ở chặng CHẶN ĐƯỜNG, còn chặng bỏ qua thì không
có đường nào thử lại dù nó hỏng vì lý do tạm.

Nay có `POST /api/projects/:id/steps/:key/retry`, và nút hiện ở **mọi** chặng hỏng. Ba cái bẫy, mỗi
cái đã sai một lần:

1. **Phải chạy tới HẾT mạch.** Mạch bị ngắt giữa chừng thì chặng hỏng kèm mọi chặng sau nó đều dở —
   chặng sau nằm ở "chờ" và không ai đánh thức. Đo thật: thử lại "Chọn hiệu ứng" xong thì "Chọn nhạc
   nền" vẫn chờ mãi. Chặng phía sau đã XONG thì bỏ qua — chạy lại nó là ghi đè kết quả người dùng có
   thể đã xem và chỉnh ở bàn dựng. Riêng chặng được BẤM thì chạy lại dù trạng thái gì.
2. **Phải ĐÓNG việc lại.** `startJob` chỉ mở nó ra; `runTranscribe` bình thường tự gọi
   `setJob(..., "done")` ở cuối, phép chạy lẻ thì không — và một việc treo ở `running` chặn mọi lượt
   `startJob` sau đó bằng 409, kể cả nút Thử lại lần hai và cả lượt xuất video.
3. **Chỉ nhận chặng AI.** `prepare`/`transcribe`/`captions` sinh dữ liệu mà mọi chặng sau dựa vào,
   chạy lẻ chúng là để lại một bàn nửa cũ nửa mới.

### Lời trấn an là một Alert CÓ MÀU trong cột phải

`Alert` chỉ có `default` (thẻ trắng viền xám) và `destructive`. `default` trông y như một Card, nên
một câu quan trọng đặt trong đó vẫn đọc ra như chú thích chân trang. Thêm hai biến thể có màu vào
design system: `info` (tím `primary`) và `success` (token `--success` mới, xanh). KHÔNG nhuộm
`default` — nhiều chỗ đang dùng nó đúng như khối trung tính.

Token `--success` chỉ dùng cho lời nhắn, không cho nút hay nền lớn: dự án đã có `primary` tím làm màu
hành động, thêm màu hành động thứ hai là hai thứ tranh chỗ nhấn.

Ba câu ứng ba tình huống, và câu đáng nói nhất là lúc đang chạy: *"Cứ làm việc khác đi — đóng trang
cũng được, việc vẫn chạy tiếp. Tí quay lại là thấy kết quả."* Việc chạy vài phút mà người dùng không
biết mình có phải ngồi canh không.

Alert nằm TRONG cột phải, ngay dưới danh sách chặng. Phải bọc cột phải thành một ô của lưới — lưới
chỉ có hai cột nên con thứ ba xuống hàng mới và rơi về phía trái, xa hẳn danh sách nó đang nói về.
