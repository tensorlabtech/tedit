# Audit sau khi làm — đi hết lượt, soi edge case

**Ngày:** 2026-07-31 · **Phạm vi:** toàn bộ 10 phase vừa làm

Không phải đọc lại mã cho có. Mỗi mục dưới đây đều **dựng lại ca đó rồi nhìn**,
hoặc đo bằng một phép chạy thật.

## Bảy lỗi tìm được, đã sửa hết

### 1 · Hộp chọn "Hiện ra" in ra mã máy thay vì tên — **nặng nhất**

`SelectValue` của Base UI in ra chính GIÁ TRỊ khi Root không có bảng tra nhãn.
Đo thật bằng cách đọc nội dung thẻ: **`'fade-up'`**, không phải "Mờ + lên".

Nguy hiểm ở chỗ danh sách thả xuống vẫn đúng nhãn, nên lỗi chỉ lộ ra ở trạng
thái **đóng** — tức là ở trạng thái người dùng nhìn thấy gần như suốt. Do chính
tôi gây ra ở phase 9 khi đổi từ dải nút sang hộp chọn.

Sửa: truyền `items` cho `Select`. Đo lại: `'Mờ + lên'`.

### 2 · `/api/layout` đọc dự án theo mã trong THÂN request — lỗ phân quyền

Cổng `auth-guard` soi mã trên **đường dẫn**; `/api/layout` không có mã trên đường
dẫn nên nó đi thẳng qua cổng. Từ khi tôi cho nó nhận `projectId` trong thân
request (phase 5), bất kỳ người đã đăng nhập nào cũng gửi được mã dự án của
người khác.

Rò rỉ nhỏ — chỉ suy ra được dự án kia đang dùng bộ dáng nào qua số đo trả về —
nhưng nó **là** một lượt đọc chéo dự án không ai kiểm. Đúng cái bẫy ghi chú ở
`ownership.ts` cảnh báo: *"cửa cứ mở, cho tới hôm có người đi qua"*.

Sửa: `assertOwnerIs(request.viewer!, "project", body.projectId)` ngay trong
handler, kèm ghi chú vì sao không trông vào cổng chung được.

### 3 · Khung xem lớn của Dialog đổi dáng TRỐNG TRƠN

Vạch hay dừng ở chỗ chưa có chữ — quãng lặng, đầu video, giữa hai cụm — và lúc
đó ô lớn nhất của Dialog là một mảng đen. Nó đọc ra như **hỏng**, không đọc ra
như "chỗ này không có chữ".

Đã dựng lại đúng ca đó và chụp: xác nhận trống.

Sửa hai lớp: khung xem lấy cụm tại vạch, **thiếu thì lấy cụm đầu của dự án**
(vẫn là chữ thật của người dùng); vẫn không có thì rơi về chữ ví dụ, kèm một
dòng nói rõ *"Vạch đang ở chỗ chưa có chữ, nên khung bên trái chạy chữ ví dụ"* —
không nói thì người dùng tưởng đó là chữ của mình và không hiểu vì sao nó lạ.

### 4 · Câu tự viết ở "3 giây đầu" không hiện ra cho tới khi tải lại trang

`opening-hook-pane` gọi thẳng `api.createElement` nhưng không cập nhật state của
bàn dựng. Người dùng bấm "Dùng câu này", Dialog đóng, và **không có gì xuất
hiện** — họ tưởng hỏng và bấm lại, mỗi lần bấm đẻ thêm một phần tử.

Sửa: chuyển việc thêm phần tử về `useEditor` (`addOpeningText`), nơi mọi lần
thêm phần tử khác đều cập nhật `data` ngay sau khi máy chủ nhận.

### 5 · Chỗ TÁCH CỤM và GIEO ĐOẠN vẫn dùng bộ dáng gốc cứng

`buildCaptionGroups` có tham số `pack` với **mặc định là bộ gốc**, nên ba nơi
quên truyền vẫn chạy im lặng: `splitVerbatimCaptions`, `seedSegmentsByCaption`,
và hai chỗ gọi trong `main.ts`.

Hậu quả thật: dự án dùng "Nét thưa" (trần cỡ 0,16 · bước dòng 1,25 · khoảng
tiếng 0,2) sẽ **tách cụm và chia đoạn theo mật độ của bộ gốc**, trong khi chữ in
ra theo mật độ của bộ mình chọn.

Sửa: bỏ giá trị mặc định, `pack` thành **bắt buộc** ở cả `buildCaptionGroups`
lẫn `createCaptionElements`. Cùng lý lẽ với ghi chú sẵn có ở `fitGroup`:
*"`avail` BẮT BUỘC truyền, không có mặc định… nơi nào quên truyền là tính ra ít
dòng hơn thật"*. Trình biên dịch nay bắt được, và nó đã bắt ra đúng 5 chỗ.

### 6 · Ngưỡng "3 giây đầu" quá dễ nổ

Điều kiện cũ: lời thật bắt đầu sau **0,35 giây**. Gần như video nào cũng có vài
phần mười giây hít vào trước khi nói — tức là dòng nhắc hiện với **mọi** video,
đúng thứ chính plan cảnh báo (*"Dòng nhắc hiện với mọi video kể cả video mở đầu
tốt"*). Một lời nhắc hiện với mọi video là một lời nhắc không ai đọc nữa.

Sửa: **1,2 giây** (`DEAD_LEAD_IN`), dùng chung cho cả hàng soát lẫn nút "Bỏ phần
rào đón" — đề nghị người dùng bấm một nút để cắt 0,4 giây là đề nghị họ đổi công
lấy một thứ không ai nhận ra.

### 7 · Bấm "Đặt lại hiệu ứng" xong không thấy gì

Chặng chạy nền ở máy chủ, còn bàn dựng thì **không hỏi lại tiến trình** như màn
chờ. Người dùng bấm, không thấy gì đổi, bấm tiếp — mỗi lần bấm là một lượt gọi
mô hình, tức tiền thật.

Sửa: thêm toast *"Đang đặt lại hiệu ứng — xong thì mở lại dự án để thấy, mất
chừng nửa phút."*

## Ba chỗ chỉnh cho liền mạch

**Nhãn "Không lời" in trên cả 55 bài** → bỏ khỏi dòng mô tả. Kho hiện 55/55 bài
không lời, nên nhãn đó thêm một chữ vào 55 dòng mà không phân biệt được bài nào
với bài nào, và còn thành một thẻ lọc khớp đúng cả kho. `Có lời` thì giữ — nó là
ngoại lệ đáng biết, vì lời hát đè lên tiếng người nói.

**Ô mẫu chọn dáng: thử `taper` rồi trả về `even`.** `taper` là mặc định thật của
sản phẩm nên nghe có vẻ đúng hơn, nhưng ở ô rộng 80px thì hàng dẫn 0,45× thành
một vệt xám không đọc được. Lúc đó bố cục **không phải** thứ đang chọn ở màn ấy —
cả năm bộ khai `defaults` giống hệt nhau.

> **Đã bị vòng hai lật lại.** Từ khi `defaults` khác nhau giữa các bộ, bố cục
> thành thứ dễ nhận ra nhất trong tất cả, nên ô mẫu quay về vẽ **bố cục thật của
> từng bộ**. Lưới cũng đổi sang 4 cột × 2 hàng nên mỗi ô rộng hơn, và hàng dẫn
> đọc được.

**13MB ảnh trong `reports/` → 1,3MB.** Ảnh thô của từng font và từng bộ dáng là
thứ script dựng lại được bằng một lệnh; chỉ giữ ảnh **so cạnh nhau** — thứ người
đọc thật sự nhìn — và nén lại. Vẫn soi được dấu chồng dấu.

## Đã soi và thấy ổn

| Ca | Kết quả |
|---|---|
| Dự án cũ, `style_pack` rỗng | rơi về bộ gốc — có phép kiểm riêng |
| Tên bộ dáng rác trong CSDL | rơi về bộ gốc, không sập |
| Chưa có lời (đang chép) | ô mẫu chạy chữ ví dụ, đổi sang lời thật khi có |
| Đổi bộ dáng giữa chừng lúc đang xuất | pack đọc MỘT LẦN đầu chặng — video không đổi dáng ở nửa sau |
| Thiên lệch nhạc lọc ra rỗng | rơi về cả kho, không thành "không có nhạc" |
| Bài nhạc chưa gán nhãn | luôn lọt qua bộ lọc, không biến mất khỏi kho |
| Thiếu khoá mô hình ở "3 giây đầu" | trả mảng rỗng, hai đường kia vẫn chạy |
| Cụm chưa đánh dấu từ khoá nào | màu nhấn KHÔNG tô bừa (đã sửa ở phase 3) |
| `cursor: pointer` trên ô mẫu | `index.css` phủ thẻ `button` trần — đúng luật |
| Nút chỉ có hình, không có chữ | ô mẫu đều có `Tooltip` + `aria-label` |
| Hộp chọn 5 lựa chọn không xuống dòng | đã đổi sang `Select`, một hàng |

## Còn lại — chưa xem tận mắt được

1. **Ba màn thật** (`/pipeline`, thẻ khung xem có `CardHeader` mới, hàng soát)
   chưa mở trên dự án thật: chúng nằm sau cổng Google, mà Google chối đăng nhập
   từ trình duyệt bị điều khiển tự động. Đã soi thẻ chọn dáng và Dialog đổi dáng
   bằng `scripts/ui-preview/` với dữ liệu giả.

   **Chỗ đáng nhìn nhất khi anh mở lên:** thẻ khung xem giờ có thêm một hàng
   tiêu đề, mà thẻ đó có sàn `min-h-80`. Cần liếc ở màn hẹp xem khung video có
   bị ép xuống quá không.

2. **`scripts/ui-preview/` và `scripts/overlay-parity/` không nằm trong
   `typecheck`** — `tsconfig.app.json` chỉ nhận `src`, `tsconfig.server.json`
   chỉ nhận `server`. Hai công cụ này hỏng dần mà không có gì báo.

3. **Trục "có lời" chưa có ca dương tính** — cả 55 bài đều không lời, nên phép
   dò mới chứng minh được một chiều.

4. **Lỗ phân quyền loại "mã nằm trong thân request" không có phép kiểm tự
   động.** `check:ownership` kiểm `assertOwnsUrlTarget`, mà lỗi ở đây là **quên
   gọi** phép kiểm chứ không phải phép kiểm sai. Route nào nhận mã trong thân
   request về sau đều có nguy cơ y hệt.

---

# Vòng hai — mở phong phú (31-07-2026, sau audit)

Bốn hướng người dùng chọn, làm hết.

## 1 · Bộ dáng đổi được cả BỐ CỤC

Trước: cả 5 bộ khai `defaults` giống hệt nhau, nên đổi bộ dáng xong nhìn vào
khung "Đang sửa" **không thấy gì đổi** — năm bộ đọc ra như một bộ có năm bảng màu.

Nay mỗi bộ có bố cục riêng. Nới ra được mà **không mất gì**, vì `defaults` chỉ áp
ở đúng một thời điểm — lúc **sinh chữ** — mà màn chờ cho chọn bộ dáng **trước
khi** chặng `captions` chạy, tức lúc chưa có cụm nào để giữ hay đè.

- Dự án mới → sinh chữ theo bố cục của bộ đã chọn.
- Đổi bộ dáng ở bàn dựng → `defaults` **không** áp lại, chỉ phần vẽ đổi.

**Phép kiểm đổi theo bất biến.** Bỏ phép "defaults giống hệt nhau" (nó khoá luôn
bố cục), thay bằng phép **quét mã nguồn**: chỉ những tệp trong danh sách duyệt
được đọc `pack.defaults`, và danh sách đó phân biệt rõ *đọc để GHI vào elements*
(chỉ `caption-elements.ts`) với *đọc để VẼ* (ô mẫu chọn dáng). Phép mới đã bắt
được đúng một chỗ ngay khi tôi thêm — chính là ô mẫu.

Ô mẫu ở màn chờ nay vẽ **bố cục thật của từng bộ**, không còn ép tất cả về một
bố cục chung.

## 2 · Tám bộ dáng, dùng hết font đã kiểm

Thêm **Nét đặc** (Be Vietnam Pro Black · đỏ · căn phải · chữ dồn sát nhất),
**Nghiêng tròn** (Montserrat · xanh dương · viền mảnh nhất · bậc thang),
**Dựng đứng** (Oswald · tím · trần cỡ cao nhất · lề trái).

28 cặp, thấp nhất khác nhau **5 trục**. Lưới ô mẫu đổi từ một hàng 5 ô sang
**4 cột × 2 hàng** — tám ô một hàng ở cột phải màn chờ chỉ còn 52px mỗi ô.

## 3 · Hai trục ĐÈ được cho từng cụm

`elements.letter_case` và `elements.key_color`, mặc định `NULL = theo bộ dáng`.

Tôi đã nói quá khi cảnh báo hướng này "phá nền móng". Cột **đè** thì không:
việc đổi bộ dáng không bao giờ ghi vào chúng, nên cụm chưa đè đổi theo dáng mới
còn cụm đã đặt tay giữ nguyên. Đó là §20 (*"người dùng đã tự chọn thì đó là lựa
chọn của họ"*), và nó làm lời hứa **mạnh lên**.

Cái thật sự phá nền móng là chép giá trị bộ dáng vào từng cụm lúc sinh — lúc đó
mọi cụm thành "đã đặt tay" và đổi bộ dáng mất tác dụng. Không làm thế.

`packForElement(pack, element)` trả về bộ dáng **hiệu lực** của một cụm, nên mọi
thứ phía sau (đo, vẽ, biểu thức ffmpeg) không phải đổi một chữ ký hàm nào.

Màu nhấn là **tập đóng 6 màu**, không phải bộ chọn tự do: tự do thì chọn được
màu trùng nền mà không có gì cản. Sáu chứ không bảy — cộng nút "Theo dáng" thì
bảy ô xuống dòng và ô cuối đứng lẻ.

## 4 · Bộ dáng vào khung "Đang sửa"

Dòng `Bộ dáng cả dự án: <tên>` + nút Đổi, mở cùng Dialog với thẻ khung xem.
Trước đây cửa duy nhất nằm ở **cột khác**, nên người vừa chọn "Chữ hoa vàng"
xong mở khung này ra không thấy dấu vết nào của việc mình vừa làm.

## Phát hiện mới từ ảnh so sánh

Ba bộ dùng `even` (**Đứng yên · Nét đặc · Dựng đứng**) **cắt cụt** cụm 15 tiếng
trong ảnh `sosanh-cum-dai.png` — chỉ hiện tới "…rất khó nhưng".

Đây là biểu hiện nặng hơn của câu hỏi đã ghi từ vòng một: **chỗ tách cụm không
mô phỏng đúng bố cục sẽ vẽ.** `buildCaptionGroups` quyết định tách bằng
`layoutText` (mô hình của `even`), trong khi:

- 4/8 bộ mặc định `taper` → tách theo một mô hình, vẽ theo mô hình khác;
- 4/8 bộ mặc định `even` → tách gần đúng, nhưng `layoutText` và `fitLines` vẫn
  là hai hàm khác nhau (chừa lề 0% với 2%, bước dò cỡ 2px với 0,005).

Trong mạch thật thì cụm dài đã được tách trước khi tới đây, nên ảnh trên là cụm
nhân tạo. Nhưng nó cho thấy chỗ hụt vẫn còn nguyên, và **giờ nó đắt hơn** vì bố
cục đã khác nhau giữa các bộ.

Cách chữa: cho `fitGroup` của `caption-groups.ts` chọn đường đo theo
`pack.defaults.emphasis` thay vì luôn dùng `layoutText`. Chưa làm — đó là một
việc riêng, cần bằng chứng riêng.

---

# Vòng ba — hai trục PHỤ ĐỀ (31-07-2026)

Câu hỏi *"user muốn phụ đề từng chữ thì sao"* lộ ra một chỗ cứng mà cả plan bỏ
sót: **bố cục thì đổi được, còn CHIA CỤM thì không.**

Ba trục bố cục (`align` 5 × `emphasis` 4 × `band` 3) vốn chọn được cho từng cụm.
Nhưng "một lúc hiện mấy tiếng" thì nằm ở năm hằng số chôn trong
`caption-groups.ts` — `MAX_WORDS` `MAX_CHARS` `MAX_SPAN`, ngưỡng nghỉ 0,35 giây,
không vắt qua câu. Không knob nào. Đúng cùng loại với chỗ hụt mà plan sinh ra để
chữa: *"công cụ đã đủ, mặc định mới là thứ quyết định dáng"*.

## Trục `grouping` — một lúc hiện mấy tiếng

```
grouping { maxWords, maxChars, maxSpan, minHold }
```

`maxWords: 1` cho ra **phụ đề từng chữ**, và **không cần đổi lược đồ**: chữ vốn
neo vào KHOẢNG TỪ, mà khoảng một từ (`from_word_id === to_word_id`) là hợp lệ.
Đã lần lại đường vẽ với cụm một tiếng — `packRows` ra 1 hàng, `taper` không sinh
hàng dẫn, `keyword-large` lấy chính tiếng đó làm hero. Chạy được.

`minHold` là con số **phải có** mà bản nháp đầu không nghĩ tới: một tiếng dài
0,12 giây là chữ hiện 3–4 khung hình rồi tắt — mắt đọc ra là nhấp nháy chứ không
ra phụ đề. Cụm ngắn hơn sàn thì gộp thêm tiếng kế tiếp.

## Trục `highlight` — tô sáng tiếng đang được nói

`highlight: Tone | null`. Kiểu karaoke: cả cụm đứng yên, tiếng đang nói sáng lên
rồi trả về.

Hai đường vẽ làm **khác cách nhau nhưng ra cùng một hình**, và đó là chỗ đáng ghi:

- **CSS** đổi thẳng `color` theo thời gian.
- **ffmpeg** không đổi được `fontcolor` theo thời gian — chỉ `alpha`, `x`, `y`
  mới nhận biểu thức có `t`. Nên máy chủ vẽ **đè một bản thứ hai** bằng màu sáng,
  với `alpha = between(t, mốc tiếng này, mốc tiếng sau)`.

Màu riêng chứ không dùng lại `color.key`: từ khoá là thứ NGƯỜI đánh dấu và đứng
yên suốt cụm, còn tô sáng thì chạy theo lời. Dùng chung một màu là hai nghĩa
khác hẳn nhau đọc ra giống hệt nhau.

Chỉ chạy khi chữ CÒN KHỚP lời (`wordStarts` có thật). Người dùng viết lại thì tắt
lặng lẽ — tô theo nhịp đều lúc đó là tô bừa.

## Hai bộ dáng mới

**Từng chữ** — Anton HOA, `maxWords: 1`. Ba con số phải đi kèm nhau:
`minHold 0,22` (chống nhấp nháy) · `enterSeconds 0,1` (hiệu ứng hiện phải NGẮN
HƠN thời gian tiếng đó sống — giữ 0,3 giây thì tiếng tắt trước cả lúc nó hiện
xong) · `emphasis: even` (một tiếng thì bốn kiểu nhấn tụt về một).

**Sáng theo lời** — Montserrat, vệt sáng vàng, `reveal: none`. Chữ nền hạ xuống
0,72 độ đục để vệt sáng ăn đứt: chênh lệch mới là thứ nhìn ra. `reveal: none` là
bắt buộc chứ không phải chọn — cụm đã đứng yên thì chuyển động duy nhất nên là
vệt sáng, thêm hiệu ứng hiện từng tiếng nữa là hai thứ chạy cùng lúc.

**10 bộ dáng · 45 cặp · cặp gần nhau nhất khác 5 trục.** Lưới ô mẫu về lại 5 cột
× 2 hàng — đúng khổ 84px mà bản năm-bộ đã đo là đọc được.

## Ảnh so sánh từng nói dối hai lần, đã sửa cả hai

Script dựng ảnh là một bộ vẽ RÚT GỌN, nên nó bỏ qua đúng những thứ vừa thêm:

1. **Bộ "Sáng theo lời" ra ảnh y hệt bộ không tô sáng** — script không vẽ lớp đè,
   và nó lấy khung ở giây 3 khi vệt sáng đã chạy qua hết. Sửa: vẽ lớp đè, và lấy
   khung ở giây 0,5 với bộ có tô sáng.
2. **Bộ "Từng chữ" in nguyên cả câu** — chia cụm xảy ra ở `buildCaptionGroups`,
   tức TRƯỚC `placeWords`, nên script không thấy. Sửa: áp `maxWords` ngay trong
   script.

Một tấm ảnh chứng minh sai còn tệ hơn không có tấm nào — nó làm người đọc tin vào
một thứ không có thật.

## Ba giá phải trả, nói trước

1. **Số phần tử tăng ~5 lần với bộ "Từng chữ".** Video 3 phút ≈ 500 từ → 500
   `elements`. Dải thời gian vẽ 500 khối, hàng soát gọi `/api/layout` 500 lần,
   `ai-keywords` gửi 500 dòng cho mô hình. **Chưa đo trên dự án thật** — đây là
   chỗ đáng thử trước khi để người dùng chọn bộ đó.
2. **Trục "nhấn" mất nghĩa ở bộ từng-chữ.** Đã khai `even` và ghi lý do, nhưng
   bảng sửa vẫn bày đủ bốn kiểu cho cụm một tiếng — chọn `taper` ở đó không đổi
   gì. Chưa chặn.
3. **`ai-keywords` chưa biết về bộ từng-chữ.** Nó chọn "nhiều nhất 2 từ khoá mỗi
   cụm, tối đa 40% số cụm" — với cụm một tiếng thì luật đó nghĩa khác hẳn.

---

# Vòng bốn — "phong cách" chứ không phải "dáng chữ" (31-07-2026)

Người dùng hỏi: *"tại sao ở màn pipeline lại là chọn dáng chữ? Style phải bao hàm
nhịp cắt, nhịp hiện, animation chứ."*

**Câu hỏi đúng, và mô hình đã đúng sẵn — sai ở tầng bày ra.** Bộ dáng lúc đó đã
cầm cả:

| | nhịp cắt | tư liệu | kiểu chuyển | nhạc |
|---|---|---|---|---|
| Chữ hoa vàng | 80% chỗ nối | 7 giây/lần | flash · zoom-in | mạnh |
| Nét thưa | 25% | 18 giây/lần | dip | êm |
| Từng chữ | 75% | 8 giây/lần | flash | mạnh |

Nhưng thẻ ở màn chờ đề **"Dáng chữ"**, ô mẫu là chữ trắng trên nền đen, tên giấu
trong tooltip. Người dùng đọc ra một bảng chọn font — đúng thứ nó không phải.

## Đã sửa

**Đổi tên:** "Dáng chữ" → **"Phong cách video"** (thẻ màn chờ · Dialog · khung
"Đang sửa"). Tên nội bộ `StylePack` giữ nguyên, nó vốn đã đủ rộng.

**`describeStyleFeel(pack)`** — một dòng nói phần ô mẫu KHÔNG vẽ được:
*"nhịp nhanh · tư liệu 7 giây/lần · nhạc mạnh"*. Ba con số đổi được quyết định.
Kiểu chuyển cảnh không vào đây — `flash` với `dip` là chữ của người làm phim.
Rê chuột vào ô nào thì dòng nói về ô đó, nên nó vừa giải thích vừa là cách xem
trước.

**Ô mẫu thành khung hình THẬT.** Nền là ảnh thu nhỏ của chính cảnh người dùng vừa
quay (có từ chặng chuẩn bị, tức trước cả lời chép), phủ một lớp tối nhẹ vì bản
xuất có quầng tối sau chữ. Tỉ lệ 3:4 thay ô vuông — ô vuông đọc ra như một nút,
3:4 đọc ra như một khung hình. Không lấy hẳn 9:16 vì mười ô dọc cao gần gấp đôi
danh sách chặng.

**Tên xuống dưới ô, luôn hiện.** Tên là thứ người dùng nhớ và gọi lại về sau
("dùng Nét thưa như video trước"); giấu sau một lần rê chuột thì họ chỉ nhớ được
"cái ô thứ ba". Tooltip để dành cho phần ô không vẽ ra được.

**Nói rõ hai thời điểm cho hai kết quả khác nhau** — chỗ trước đây im lặng hoàn toàn:

- **Chọn ở màn chờ** → phong cách lái cả nhạc, hiệu ứng, mật độ tư liệu. Đây là
  lúc DUY NHẤT lựa chọn còn lái được máy.
- **Đổi ở bàn dựng** → chỉ vẽ lại chữ. Nhạc và hiệu ứng đã đặt xong thì giữ
  nguyên (cố ý: chúng là vật nằm trên dải, người dùng nhìn thấy và có thể đã sắp
  lại). Muốn đặt lại thì có lời mời riêng ở "Cần bạn xem".

Đó cũng là câu trả lời cho *"tại sao ở màn pipeline"*: **vì sau đó thì không lái
được nữa.**

## Ô mẫu từng nói dối hai lần nữa, đã sửa

Cùng loại lỗi với ảnh so sánh ở vòng ba — ô mẫu là bộ vẽ rút gọn nên nó bỏ qua
đúng hai trục vừa thêm:

1. **"Từng chữ" hiện nguyên cả câu** — chia cụm xảy ra ở `buildCaptionGroups`,
   trước bộ vẽ. Sửa: ô mẫu cắt theo `pack.grouping.maxWords`.
2. **"Sáng theo lời" không có vệt sáng** — tô sáng cần mốc từng tiếng, mà ô mẫu
   không truyền `wordStarts`; và trạng thái tĩnh đặt ở `seconds = 99` nên vệt
   sáng đã chạy qua hết. Sửa: rải đều mốc, và bộ có tô sáng thì đứng ở GIỮA cụm.

Ba lần trong hai vòng, cùng một gốc: **mỗi lần thêm một trục, mọi bộ vẽ RÚT GỌN
đều thành nơi nói dối.** Hiện có ba bộ như thế — ô mẫu chọn phong cách, script
dựng ảnh so sánh, và ô mẫu trục "Dáng" trong bảng sửa. Đáng gom về một chỗ, hoặc
ít nhất phải có phép kiểm bắt được chúng lệch khỏi bộ vẽ thật.

---

# Vòng năm — luồng người dùng (31-07-2026)

Sau khi nghiên cứu captions.ai và bàn lại luồng. **Phần "đổi phong cách sau khi
đã dựng" được hoãn có chủ ý** — nó nhạy cảm, và cờ "người dùng đã đụng tay" sinh
ra chỉ để phục vụ nó nên cũng hoãn theo.

## 1 · Chọn phong cách chuyển về màn NẠP TỆP

Màn chờ là chỗ sai, và nó sai vì **thứ tự chặng**:

```
prepare → describe → transcribe → fix → captions → …
                                        ↑ đọc phong cách
```

`captions` là chặng thứ **5/11** và chạy ngay sau khi chép lời xong. Video hai
phút thì người dùng có chưa tới hai phút để quyết — **màn chờ là một cuộc đua với
chính cái máy**, và thua thì bố cục chữ đã sinh theo bộ gốc. Màn đó lại đang hứa
*"đóng trang cũng được"*, nên nó vừa giục vừa bảo đừng vội.

Nay: **một dòng ở thẻ "Dự án" + Dialog**, không nhúng mười ô vào thẻ đó — thẻ ấy
có luật *"chiều cao BẤT BIẾN"* vì nó nằm ở hàng `auto` đầu cột, cao thêm một nhịp
là hai dải ô bên dưới bị bóp đúng chừng ấy.

Đặt **ngay trên thanh "Tự rút chỗ lặng"**, và đó là chủ ý: chọn phong cách sẽ đẩy
thanh đó sang con số của nó. Người dùng thấy nguyên nhân ngay cạnh kết quả, và
kéo lại được. Ghi đè ở máy chủ thì họ mất một lựa chọn mà không biết vì sao.

Màn chờ **giữ** thẻ chọn làm cơ hội thứ hai — lúc đó mới có lời thật cho ô mẫu.

**Nhớ lựa chọn lần trước** (`localStorage`): người làm kênh dùng một phong cách
cho mọi video. Dự án mở lại thì lấy phong cách CỦA NÓ, không lấy lựa chọn lần
trước.

**Dialog nói đúng thời điểm nó đang đứng.** Cùng một component, hai câu:

- ở màn nạp tệp — *"Máy sẽ chọn nhạc, hiệu ứng, mật độ tư liệu và nhịp cắt theo
  phong cách này."*
- ở bàn dựng — *"Đổi ở đây chỉ vẽ lại chữ. Nhạc và hiệu ứng đã đặt xong thì giữ
  nguyên."*

## 2 · Phong cách nay cầm cả ĐỘ MẠNH, không chỉ KIỂU

Chỗ hụt tìm ra khi tra mã: bốn con số vẫn là hằng dùng chung cho **mọi** phong cách.

| | trước | nay |
|---|---|---|
| mức đẩy cú zoom | 0,08 cho mọi bộ | 0,05 (Sương) → 0,12 (Thép · Gõ) |
| mức sáng cú nháy | 0,7 cho mọi bộ | 0,45 → 0,9 |
| tỉ lệ cụm được nhấn | 40% cho mọi bộ | 15% (Gõ) → 50% (Thép · Lửa) |
| ngưỡng rút lặng | cài đặt riêng | 0,5s (Thép) → 1,2s (Sương) |

Nên trước đây hai phong cách chọn *kiểu* chuyển cảnh khác nhau mà xem video thật
vẫn hao hao — **đó chính là câu "sao vẫn thiếu thiếu"**.

## 3 · Nền khối sau chữ + ô sáng chạy theo lời

`box` bỏ trạng thái `null` vĩnh viễn. Nền vẽ theo **từng tiếng** vì mỗi tiếng là
một lệnh `drawtext` — cũng đúng là dáng đang thịnh (mỗi tiếng một ô, không phải
một tấm bảng sau cả câu). Góc vuông: `drawtext` chỉ cho góc vuông, mà góc vuông
vốn đã là dáng bản tin.

`highlight` mở từ một màu thành `{ tone, box }`. **Sóng** dùng chữ tối trên ô
vàng — ô sáng chạy dọc câu là thứ mắt bám được ở khổ điện thoại, còn đổi mỗi màu
chữ thì trên nền video nhiều chi tiết gần như không thấy.

## 4 · Đặt lại tên và nhóm theo Ý ĐỒ

captions.ai nhóm 7 chủ đề × 4 style, và tên của họ (**Elevate · Linen · Grit**)
không mô tả kỹ thuật. Tên tôi đặt — *Nét thưa · Chữ hoa vàng · Nghiêng tròn* —
mô tả font, nên nó **dạy người dùng rằng đây là bảng chọn font**.

| Nhóm | Phong cách |
|---|---|
| **Mạnh** — cắt dày, chữ to, nhạc đẩy | Thép · Lửa · Nhịp · Gõ |
| **Kể chuyện** — nhịp tự nhiên, chữ dễ đọc | Mộc · Nắng · Sóng |
| **Gọn** — ít hiệu ứng, chữ tiết chế | Sương · Lặng · Giấy |

`id` giữ nguyên, chỉ đổi `label`: đổi `id` thì mọi dự án đang lưu `style_pack` cũ
sẽ lặng lẽ rơi về bộ gốc.

Phần cơ học để `describeStyleFeel` nói — *"một tiếng một · nhịp nhanh · tư liệu 8
giây/lần · nhạc mạnh"*. Tên để nhận ra và gọi lại, dòng mô tả để biết nó làm gì.

## 5 · `scripts/` vào typecheck — nợ vừa cắn tôi

Đổi `highlight` thành một đối tượng làm script dựng ảnh so sánh **chết**, mà
không lệnh kiểm nào báo: `tsconfig.server.json` chỉ nhận `server/`,
`tsconfig.app.json` chỉ nhận `src/`.

Nay `scripts/**/*.ts` vào cấu hình máy chủ và `scripts/**/*.tsx` vào cấu hình web.
Đây là một trong bốn "câu chưa dứt" của vòng một, và nó đã kịp gây hại trước khi
được sửa.

## Còn nợ

- **Đổi phong cách sau khi đã dựng ra video LAI** — chữ theo bộ mới, nhịp và nhạc
  theo bộ cũ. Đã hoãn có chủ ý; hiện Dialog nói thẳng điều đó thay vì giấu.
- **Lớp màu trên hình** — khác biệt lớn nhất còn thiếu so với captions.ai. Chỗ
  khó không ở render mà ở việc khớp hai đường vẽ.
- **Emoji tự động · title card · b-roll mosaic · template người dùng tự lưu.**
- **Chưa đo bộ "Gõ" trên dự án thật** — 500 `elements` cho video 3 phút.

---

# Vòng sáu — test trên VIDEO THẬT, so với captions.ai (31-07-2026)

Mọi ảnh trước đây đều dựng trên nền xám phẳng. Nền xám chỉ so được font với màu;
câu *"cái này có dùng được không"* thì phải hỏi trên khung hình thật.

Công cụ mới: `scripts/style-packs/render-real-frames.ts` — CHỈ ĐỌC một dự án
thật, in khung hình qua **đúng đường vẽ của bản xuất** (cùng `placeWords`, cùng
biểu thức `alpha`/`position`, cùng lớp quầng), ghi ra thư mục tạm chứ không đụng
`out/final.mp4`. Nền là video thật, chữ là lời thật, mốc là nhịp nói thật.

Ảnh: `reports/style-packs/khung-that-10-phong-cach.png`.

## Chính bộ đo nói dối hai lần trước khi nói thật

Đáng ghi, vì suýt nữa tôi báo nhầm hai lỗi sản phẩm không tồn tại:

1. **Lấy khung ở `min(cuối cụm, đầu + 1,2s)`** — tức giữa lúc chữ còn đang chạy
   vào. Mấy tiếng cuối mờ một nửa, ảnh đọc ra như chữ bị lỗi vẽ.
2. **Đọc bố cục từ CỤM đang lưu** thay vì từ phong cách. Cụm trong dự án đó sinh
   ra hồi mọi phong cách còn chung một bố cục, nên mười ảnh ra y hệt nhau — đúng
   thứ đang cần so thì lại không so được.

Cộng với ba lần ở vòng ba và bốn: **năm lần, cùng một gốc.** Mỗi bộ vẽ rút gọn là
một nơi nói dối, và mỗi trục mới lại làm chúng lệch thêm.

## Hai lỗi THẬT mà test bắt được

**1 · Nền khối gần như vô hình trên footage tối.** Đen 0,55 chồng lên một nền vốn
đã tối thì không đọc ra là có nền — trục dáng mạnh nhất của "Lửa" biến mất đúng ở
loại video hay gặp nhất (quay trong phòng thiếu sáng). Nâng lên **0,8**, ảnh sau
khi sửa thì nền hiện rõ.

**2 · Nhóm "Mạnh" ra chữ NHỎ, ba dòng.** Cụm 5 tiếng ở trần 3 dòng cho ba dòng
nhỏ, trong khi cái nhóm đó đang bán là chữ to đập vào mắt. Trần dòng là hằng
không đụng được, nên đường duy nhất là **bớt tiếng mỗi cụm** — đúng knob
`grouping` vừa mở ra ở vòng ba.

| | trước | sau |
|---|---|---|
| Thép · Lửa | 5 tiếng → 3 dòng nhỏ | 3 tiếng → **1 dòng to** |
| Nhịp | 5 tiếng | 4 tiếng |

Sau khi sửa, "TUỔI LÀ LỚN" của Thép chiếm gần trọn bề ngang khung — đọc ra ngang
với ảnh tham khảo của captions.ai.

## So với captions.ai: chữ NGANG, hình CHƯA

**Ngang được — phần chữ.** Nét vẽ, viền, quầng, dấu chồng dấu tiếng Việt, chữ to
một dòng, nền khối, ô sáng chạy theo lời, chia cụm từng chữ. Đặt cạnh ảnh tham
khảo thì không thua.

**Chưa ngang — phần hình. Và khoảng cách nằm gọn ở một chỗ:**

> **Tedit không đụng gì vào HÌNH cả.**

Khung hình thật của người dùng tối om, và toàn bộ gánh nặng "làm video trông có
nghề" đổ lên chữ. Ảnh tham khảo của captions.ai thì footage đã được nắn màu rõ
ràng — sáng hơn, tương phản hơn, ấm hơn. Elevate của họ còn có *"rainbow glare và
light-flare overlays"*.

Ba thứ còn thiếu, xếp theo mức lộ ra:

1. **Lớp màu trên hình** — khác biệt lớn nhất, và nó lộ ngay ở khung đầu tiên.
2. Emoji tự động · title card · đồ hoạ trang trí.
3. Bố cục b-roll đa dạng (mosaic, split dọc, stacked panels).

## Câu trả lời một dòng

**Đã so được về CHỮ, chưa so được về HÌNH** — vì phần hình ta còn chưa bắt đầu.

---

# Vòng bảy — NẮN MÀU trên hình

Khoảng cách số 1 ở trên đã làm. `grade` thành trục thứ mười lăm của bộ dáng:
bốn số (sáng · tương phản · bão hoà · ấm/lạnh), chín bộ nắn, bộ "Mộc" để `null`
làm mốc so.

## Chỗ khó không nằm ở ffmpeg

Chuỗi ffmpeg viết mất mười phút. Chỗ khó là khớp nó với TRANG XEM.

CSS `filter` không dùng được: `brightness()` `contrast()` `saturate()` đều có,
nhưng **không hàm nào nhân RIÊNG từng kênh** — mà ấm/lạnh chính là nhân riêng
từng kênh (đỏ lên, lam xuống). Ép bằng `sepia()` thì trang xem và bản xuất ra
hai màu khác nhau, đúng lỗi cả hệ này chống.

Nên trang xem dựng bộ lọc SVG, khớp từng nguyên thuỷ:

| ffmpeg | trang xem |
|---|---|
| `colorchannelmixer=rr:gg:bb` | `feColorMatrix` đường chéo |
| `eq=contrast=C` | `feComponentTransfer` tuyến tính, dốc `C`, chặn `(1−C)/2` |
| `eq=saturation=S` | `feColorMatrix type="saturate"` |

Ba phép này KHÔNG giao hoán, nên thứ tự cũng là một phần của phép khớp.

`scripts/overlay-parity/` không bắt được chỗ này — nó chỉ so CHỮ, không biết gì
về màu. Nên thêm phép đo riêng: `scripts/style-packs/measure-grade-parity.py`
cho ffmpeg và Chromium cùng nắn một dải màu chuẩn rồi so từng điểm ảnh.

**Kết quả: 9/9 bộ khớp, lệch lớn nhất 4,07/255** (ngưỡng 6). Dải màu chuẩn chứ
không phải khung hình thật — khung hình thật dồn ở vùng tối nên nó GIẤU chỗ lệch
ở vùng sáng và màu bão hoà, đúng chỗ hai công thức xa nhau nhất.

Còn một chỗ lệch đã biết và không khép được: phép bão hoà của SVG dùng hệ số
sáng Rec.709, `eq` của ffmpeg làm trong YUV Rec.601. Chỉ lộ ở màu rất bão hoà,
và nó là phần lớn của con số 4,07 kia.

## Vòng đầu nắn màu ra một bảng số SAI — khung hình thật bắt được

In mười khung của dự án thật rồi đo, hai chỗ hỏng lộ ra mà nhìn bảng số thì
không thấy:

**1. Tương phản đang BÓP CHẾT footage tối.** `eq=contrast` xoay quanh mức xám
giữa (0,5), mà video quay bằng điện thoại trong nhà nằm quanh 0,14. Ở đó mọi mức
trên ~1,05 đều kéo ảnh xuống:

| bộ | tương phản | độ sáng trung bình |
|---|---|---|
| Mộc (không nắn) | — | 37,8 |
| Lửa | 1,20 | **27,9** |
| Gõ | 1,18 | **29,3** |

Hai bộ "mạnh nhất" hoá ra là hai bộ ĐỤC nhất. Trần hạ xuống 1,12, và phần "chất"
chuyển sang `warmth` + `saturation` — hai trục nhân theo tỉ lệ nên không phụ
thuộc video sáng hay tối.

**2. Biên độ ấm/lạnh nhỏ đến mức vô hình.** Hệ số 10% ở vòng đầu cho hiệu số
đỏ−lam trải từ 2,15 đến 8,31 — cả mười bộ đều ấm, không bộ nào lạnh, và mắt
không tách được. Nâng lên 25%:

| | vòng đầu | sau khi sửa |
|---|---|---|
| lạnh nhất | +2,15 (Nhịp) | **−3,30** (Nhịp) |
| ấm nhất | +8,31 (Sóng) | **+14,11** (Nắng) |
| khoảng trải | 6,2 | **17,4** |

Giờ có bộ lạnh THẬT (qua mốc 0) chứ không phải "ấm ít hơn".

**3. "Thép" đang ấm.** Thép thì phải lạnh — tôi điền ngược hướng ở vòng đầu.
Nay `warmth: −0.35`, bộ lạnh nhì trong mười bộ.

Ảnh: `reports/style-packs/khung-that-10-phong-cach.png`.

## Tư liệu chèn nắn màu ĐÚNG như dải chính

Chỗ này suýt sót. Nắn màu đứng đầu chuỗi lọc, mà b-roll dán lên SAU đó — nghĩa
là mỗi lần chèn tư liệu là một lần màu nhảy: nền ấm, tư liệu lạnh. Người xem đọc
ra ngay là "dán vào". Nay luồng chèn mang đúng chuỗi nắn màu, cả hai đường vẽ.

Nắn màu đứng TRƯỚC chữ chứ không sau: nắn sau thì màu nhấn vàng của bộ dáng ra
một màu vàng khác, và cả bảng màu đã cân công phu thành vô nghĩa.

## `filter: url()` trên thẻ `<video>` — đo trước khi tin

Bộ lọc SVG dán lên `<img>` thì chắc chắn chạy; dán lên `<video>` thì WebKit vốn
có tiếng là hỏng. Mà cả khung xem ở bàn dựng lẫn khung xem ở màn chờ đều là
`<video>`, nên nếu hỏng thì hỏng đúng hai chỗ người dùng nhìn nhiều nhất.

Đo bằng cách cho Chromium và WebKit cùng nắn một video dải màu chuẩn rồi so:

| trình duyệt | R | G | B |
|---|---|---|---|
| Chromium | 119,3 | 103,3 | 87,9 |
| WebKit | 119,3 | 103,2 | 87,6 |

Lệch dưới 0,4/255. Rủi ro không có thật.

Khung xem ở MÀN CHỜ cũng nắn màu luôn, không chỉ bàn dựng: nó đứng ngay cạnh
chỗ chọn phong cách, nên chọn xong là thấy hình đổi — mà nắn màu đúng là trục
người dùng khó hình dung nhất qua mỗi cái tên bộ.

## Bộ kiểm nay canh cả trục màu

`npm run check:style-pack`: 82 → **92 phép**. Mười phép mới đóng đúng hai chỗ
vừa hỏng — trần tương phản 1,12, và luật "khoảng trải ấm/lạnh ≥ 0,6" để không ai
vô tình kéo mười bộ về lại một màu.

## Đã chạy

| phép | kết quả |
|---|---|
| `npm run typecheck` | đạt |
| `npm run lint` | 0 lỗi |
| `npm run build` | đạt |
| `npm run check:ownership` | 24/24 |
| `npm run check:style-pack` | **92/92** |
| `check-overlay-parity.py` | 100/100 cụm |
| `measure-grade-parity.py` | **9/9 bộ, lệch ≤ 4,07/255** |

## Còn lại so với captions.ai

Khoảng cách số 1 (lớp màu trên hình) đã đóng. Còn:

2. Emoji tự động · title card · đồ hoạ trang trí.
3. Bố cục b-roll đa dạng (mosaic, split dọc, stacked panels).
4. Mẫu người dùng tự lưu.

Và một thứ user đã chủ động hoãn: đổi phong cách sau khi đã dựng.


---

# Vòng tám — EMOJI, và đi hết luồng bằng trình duyệt

## Emoji: ảnh, không phải chữ

`drawtext` từ chối font emoji màu của Apple thẳng thừng — *"Monocromatic (1bpp)
fonts are not supported"*. Nên emoji đi đường ẢNH DÁN, và điều đó hoá ra tốt hơn
đường vẽ chữ: hai đường vẽ dùng CHUNG đúng một tệp PNG, chứ không phải hai bộ vẽ
chữ cùng cố ra một kết quả. Đó là mức khớp mạnh nhất có thể có.

- Vốn từ ĐÓNG 36 hình (`server/emoji-vocab.ts`), cùng khuôn với `music-tags.ts`.
- Ảnh từ kho Noto, giấy phép OFL — cùng loại với font đang mang theo. 552 KB.
- `pack.emoji` là trục thứ 15 của bộ dáng; ba bộ nhóm "Gọn" để `null` — khoảng
  thở là thứ chúng bán, một hình nảy lên giữa khung phá đúng nó.
- `elements.emoji` là cột GIÁ TRỊ, không phải cột đè: đổi sang bộ không dùng
  emoji thì khâu vẽ im lặng bỏ qua, đổi về là hiện lại, không phải chạy lại AI.
- Emoji NỔI ngoài khối chữ, không chen vào bố cục — nên nó không đụng
  `MAX_LINES`, `MAX_BLOCK_SHARE` hay phép đo bề rộng.

## Đi hết luồng bằng trình duyệt thật

`TEDDIT_DEV_LOGIN=1` mở được cửa đăng nhập bằng email — nên lần này chạy được
luồng THẬT chứ không phải component với dữ liệu giả: nạp video lên, chờ 12 chặng,
mở bàn dựng, xuất video. Máy chủ thử dùng thư mục dữ liệu riêng.

Bảy chỗ hỏng lộ ra, và không chỗ nào bắt được bằng phép kiểm đang có:

| chỗ hỏng | đo được | đã sửa |
|---|---|---|
| Đệm DỌC nền khối thiếu trong chiều cao hàng | khối chữ xuất ra lệch **86 px** | còn 1,8 px |
| Nền khối không nằm trong phép đo BỀ RỘNG | chữ tràn hẳn mép trái | 6 chỗ đo, cả hai đường |
| Thanh chống hộp dòng của trình duyệt | thêm **40 px** | `line-height: 0` ở tầng hàng |
| Đệm NGANG lệch giữa hai đường vẽ | 1,4× so với 1× | `boxborderw` bốn giá trị |
| Viền báo đang chọn bị ảnh nền che | ô chọn và không chọn giống hệt | tách thành lớp phủ |
| Thẻ chọn phong cách bóp nát danh sách chặng | còn nửa dòng tiêu đề | thẻ tự cuộn + sàn chiều cao |
| Nhãn dưới ô mẫu không bấm được | — | cho bấm, thêm con trỏ tay |

## Bộ kiểm cũ báo khớp 100% suốt thời gian có lỗi 86 điểm ảnh

`check-overlay-parity.py` chỉ so SỐ DÒNG và CỠ CHỮ — hai thứ tính được bằng hàm
thuần, nên nó không bao giờ chạm tới CSS. Mà lỗi thì nằm đúng ở CSS.

Nên thêm `scripts/overlay-parity/check-block-box-parity.py`: dựng THẬT
`OverlayTextBlock` trong trình duyệt rồi đo hộp bao bằng `getBoundingClientRect`,
so với `box` mà `placeWords` trả về. Đây là lý do `placeWords` nay trả
`{ words, box }` thay vì một mảng.

## Chính bộ đo mới nói dối hai lần trước khi nói thật

1. Báo **61/100 khung lệch**, có khung lệch tới 0,118 chiều cao. Nguyên nhân: nó
   dựng React TRƯỚC khi font tải xong, mà `fitGroup` đo bề rộng ngay lúc dựng và
   kết quả nằm luôn trong cây React — font về sau đó thì không có gì bắt React
   tính lại. Đã dựng ground truth bằng ffmpeg để nghiệm trước khi tin con số.
2. Sau khi nạp font trước: còn 34, rồi 8 sau khi sửa thanh chống. Tám khung cuối
   đúng bằng những cụm mà `check-overlay-parity.py` đã ghi nhận là lệch một nấc
   cỡ chữ 5% — sai số có sẵn, không phải lỗi mới. Ngưỡng đặt ở mức đó, kèm lý do.

## Đã chạy

| phép | kết quả |
|---|---|
| luồng người dùng, 14 bước chụp ảnh | đạt, xuất video chạy |
| `npm run check:style-pack` | **102/102** (thêm 10 phép cho emoji) |
| `check-overlay-parity.py` | 100/100 cụm |
| `check-block-box-parity.py` *(mới)* | 100/100 khung |
| `measure-grade-parity.py` | 9/9 · ≤ 4,07/255 |
| WebKit ⇄ Chromium, `filter: url()` trên `<video>` | lệch < 0,4/255 |
| typecheck · lint · build · ownership | sạch |

Ảnh: `reports/flow-test/`.

## Câu hỏi chưa dứt

- Emoji KHÔNG nắn màu — cố ý, cùng lý lẽ với chữ. Nếu thấy nó đọc ra như dán vào
  thì đảo lại được bằng một dòng.
- Tám khung lệch một nấc cỡ chữ: sửa được bằng cách cho hai bên dò cỡ theo bước
  nhỏ hơn, nhưng đó là đổi một sai số 1,5% lấy phép dò chậm gấp năm.


---

# Vòng chín — soi HẾT ảnh, không soi vài cái

Vòng tám chụp 14 ảnh nhưng tôi chỉ soi kỹ bốn, rồi báo cáo như thể đã soi hết.
Soi nốt mười ba ảnh còn lại ra thêm **ba chỗ hỏng thật** — và một ảnh trắng trơn
hoá ra là lỗi của chính bộ kiểm.

| chỗ hỏng | thấy ở ảnh | đã sửa |
|---|---|---|
| Hộp đổi phong cách ở BÀN DỰNG bày 10 ô nền đen trơn | 12, 13 | lấy khung hình cảnh chính từ chính dữ liệu bàn dựng |
| Khung "Xem trước" ở màn nạp tệp KHÔNG nắn màu theo bộ vừa chọn | 07 | nắn cả video lẫn ảnh tĩnh |
| Danh sách chặng bị xén GIỮA CHỮ ở màn chờ | 08 | chia 1,5fr cho hàng chặng → 9/12 dòng, phần còn lại mờ dần |

Chỗ thứ nhất đáng nói nhất: **cùng một component, hai nơi gọi, một nơi quên
truyền `poster`.** Ở màn nạp tệp thì có khung hình thật, ở bàn dựng thì nền đen —
tức là mất đúng thứ phân biệt "chọn phong cách" với "chọn font", ở đúng nơi người
dùng đổi phong cách nhiều nhất.

## Bộ đo nói dối, lần thứ ba và thứ tư

- **Ảnh danh sách dự án ra TRẮNG TRƠN.** Chụp lại thì trang vẽ đúng: bộ kiểm chụp
  giữa lúc `window.location.href` tải lại trang sau đăng nhập. `wait_for_selector`
  khớp trên bản TRƯỚC khi reload, rồi DOM bị xoá sạch. Nay chờ thêm một mốc chắc
  chắn của trang sau.
- **Khung xem lớn ở màn chờ trông như không nắn màu.** Đo bằng DOM thì hiệu số
  đỏ−lam nhảy 3,72 → 12,17 — nó CÓ nắn, mắt tôi nhìn ảnh nén không ra. Suýt báo
  nhầm lần thứ hai trong cùng một lượt.

Bài học lặp lại đủ nhiều để ghi thành luật: **ảnh chụp là để tìm chỗ đáng ngờ,
không phải để kết luận.** Mọi thứ nghi ngờ phải đo lại bằng số trước khi viết vào
báo cáo.

## Hai chỗ CẦN NGƯỜI QUYẾT, không tự đổi

1. **Bộ "Lửa": ba tiếng thành ba dòng chữ rất to**, che gần hết mặt. Nền khối
   chiếm chỗ thật nên khối cao lên — đúng thuật toán và vẫn trong trần 30% chiều
   cao. Hạ `grouping.maxWords` của Lửa xuống 2, hoặc mỏng `box.padShare` lại, đều
   sửa được; cả hai đều là chọn lựa thẩm mỹ.
2. **Dải thời gian trống nửa trái khi vạch ở 0:00.** Dải luôn canh vạch vào giữa,
   nên lần mở đầu tiên trông như hỏng. Sửa được bằng cách kẹp `offset`, nhưng nó
   đụng phép quy đổi toạ độ mà kéo–thả và bám mốc đang dùng.

## Đã chạy lại sau khi sửa

typecheck · lint · build · ownership sạch · style-pack **102/102** ·
overlay-parity 100/100 · block-box 100/100 · grade-parity 9/9 · luồng 14/14 bước.

Ảnh: `reports/flow-test/` (17 tệp).
