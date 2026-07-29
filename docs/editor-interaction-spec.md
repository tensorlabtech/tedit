# Đặc tả tương tác — màn Editor

Tài liệu này chốt **mô hình thao tác** của màn Editor: mỗi việc đúng một cử chỉ, và
mỗi lựa chọn đều nêu bằng chứng vì sao chọn thế.

Nguyên tắc bao trùm: **người đi sau thắng bằng cái mình BỎ, không phải cái mình gom.**
Gom hết thứ hay của bảy công cụ lại thì ra một CapCut nhiều bước hơn. Mỗi mục "lấy"
dưới đây đều đi kèm một mục "bỏ" tương ứng.

---

## 1. Xương sống: bản chép lời

Người không chuyên nghĩ theo **nghĩa** ("bỏ đoạn lan man này"), không nghĩ theo **giây**
("cắt từ 0:14.3 đến 0:19.8"). Nên đơn vị chính của màn là **câu nói**, không phải khối
trên trục thời gian.

Đây cũng là kết luận của chính Captions: bấm vào một từ trên dải của họ hiện bảng có
nút **Delete word**, và **không có** thao tác kéo-mép-để-bỏ-nội-dung. Kéo mép ở đó chỉ
để gọt đầu-đuôi footage.

**Hệ quả bắt buộc:** phần tử gắn vào **từ**, không gắn vào giây. Cắt bỏ một câu phía
trước thì mọi thứ phía sau vẫn dính đúng chỗ, không phải tính lại.

---

## 2. Bản đồ cử chỉ

Mỗi hàng là một việc. Không việc nào dùng chung vùng pixel với việc khác.

| Việc | Cử chỉ | Mục tiêu | Nguồn |
|---|---|---|---|
| Nhảy tới một câu | Bấm câu trong bản chép lời | cả dòng | ta |
| Tua tinh | Kéo **bất kỳ đâu** trên dải | cả bề mặt | Captions |
| Tua tinh (chuột) | **Lăn chuột** trên dải | không cần nhắm | ta — Captions thiếu |
| Nhảy tới một điểm | Bấm điểm đó trên dải | cả bề mặt | Captions |
| Tách đoạn tại điểm | Nút ✂ tại vạch giữa — **chỉ hiện sau khi chọn một đoạn** | nút nổi, không chiếm hàng | Captions |
| Bỏ một khoảng | Nút bỏ ở chính dòng chữ đó | hiện khi rê vào dòng | ta |
| Xem b-roll nằm ở đâu | Lớp tư liệu trên dải — KHÔNG có trong bản chép lời | cả khối | ta |
| Đặt một tiêu đề / con số | "Thêm chữ" → khối rỗng ở vạch, gõ ngay; KHÔNG có trong bản chép lời | cả khối | ta |
| Đổi khoảng tiêu đề | Kéo hai đầu khối trên lớp chữ tự do | ≥14px | ta |
| Bỏ nhiều dòng một lượt | Bấm dòng đầu, **Shift-bấm** dòng cuối → "Bỏ cả dải" | cả dòng | ta |
| Bỏ một đoạn video | Bấm đoạn trên dải → nút "Bỏ đoạn" ngay trên khối | cả khối | ta |
| Sửa chữ hiện trên màn | Bấm dòng đó trong bản chép lời — gõ ngay tại chỗ | cả dòng | Captions |
| Chọn một khối | Bấm khối | cả khối | Captions |
| Gọt mép khối | Kéo tay nắm — **chỉ hiện sau khi chọn** | ≥14px, đặt ngoài thân khối | Captions |
| Sửa một phần tử | Bấm nó → bảng dán mép phải | cả mục | Captions |
| Bỏ chọn | Bấm chỗ trống trên dải, hoặc `Esc` | cả bề mặt | ta |
| Đặt khoảng nhạc | Kéo hai đầu khối nhạc | ≥14px, như mọi tay nắm | ta |
| Đặt khoảng tư liệu | Kéo hai đầu khối tư liệu — bám ranh giới từ | ≥14px | ta |
| Phát / dừng | `Space` — kể cả khi vừa bấm một nút | phím | ta |
| Nhích vạch | `←` `→` một khung; `Shift` + phím: một giây | phím | ta |
| Phóng dải | `Cmd/Ctrl` `+` `−` `0`, hoặc chụm hai ngón | phím / bàn di | ta |

**Gọt mép thì phần sau có dồn lên không — tuỳ gọt cái gì:**

| Gọt cái gì | Xử lý | Vì sao |
|---|---|---|
| **Video chính** (a-roll) | **Dồn lên (ripple)** | Lời nói liên tục. Để trống là chèn một khoảng im lặng vào giữa câu |
| **Tư liệu chèn** (b-roll) | **Không dồn** | Nó đè lên video chính; cho chạy ngắn lại thì chỉ nó ngắn, video chính không xê dịch |

Mô hình gắn-vào-từ khiến ripple an toàn: khi dồn lên, mọi thứ phía sau tự dính đúng chỗ
vì chúng bám vào **từ**, không bám vào **giây**. Ở editor đặt theo giây, ripple là thao
tác đáng sợ — ta không có nỗi sợ đó.

**Vì sao không có hàng nào "kéo thả tự do":** xem §5.

---

## 3. Thang phóng: dải DÀI HƠN màn hình, không vừa màn hình

Đây là quyết định gốc, mọi thứ ở §4 và §5 là hệ quả của nó.

Muốn bấm trúng **từng từ** thì một từ phải đủ rộng. Một từ tiếng Việt nói ra chừng
0,35 giây. Tính trên video 1 phút 08 với bề ngang dải 1648px:

| Cách | Một giây rộng | Một từ (0,35s) rộng |
|---|---|---|
| Vừa màn hình | 24px | **8px** — không đọc, không bấm trúng |
| Thang cố định 200px/giây | 200px | 70px — đọc và bấm thoải mái |

Video 2 phút 22 mà ép vừa màn hình thì còn **11px/giây**, một từ rộng **4px**.

Nên chuỗi nhân quả là:

**Bấm được vào từng từ → dải dài gấp nhiều lần màn hình → bắt buộc cuộn → vạch cố định
giữa là cách điều hướng tự nhiên của một dải cuộn.**

Hai mô hình là hai gói trọn: vừa-màn-hình đi với vạch di động, dải-dài đi với vạch cố
định. Không trộn nửa nọ nửa kia.

**Thang chốt:** desktop mặc định **200px/giây**; di động tối thiểu **150px/giây** (ngón
tay cần vùng chạm ~44px, chia cho 0,35 giây ≈ 126px/giây, làm tròn lên).

**Bước phóng:** cả thang chỉ rộng 10 lần (60→600). Nút và phím đi bước **1,25** — mười
nấc, canh được; bước 1,4 chia ra chưa tới bảy nấc nên bấm một cái là nhảy qua mức mình
cần. Con lăn và chụm hai ngón đi theo **độ lớn cú lăn** (`exp(-Δy × 0,0035)`, chặn ở
1,5 lần mỗi sự kiện): một cử chỉ chụm bắn ra hàng chục sự kiện, nhân một hệ số cố định
cho từng cái là mới nhích ngón đã phóng gấp mấy lần.

---

## 3.1. Chỗ nối: chỉ tồn tại ở nơi hình ĐỨT

"Chỗ nối" là điểm hai khoảng giữ lại dính vào nhau sau khi bỏ một quãng. Không bỏ gì thì
không có chỗ nối nào — và bật kiểu đánh dấu nào cũng không thấy gì, đúng như phải thế.

| Kiểu | Làm gì | Bao lâu |
|---|---|---|
| Cắt thẳng | không đánh dấu | — |
| Zoom vào | phóng 1,00 → **1,08** → 1,00, đỉnh đúng tại mối nối | ±0,5 giây |
| Zoom ra | bắt đầu ở 1,08 ngay tại mối nối rồi mở về 1,00 | 0,5 giây sau |
| Nháy sáng | độ sáng +0,7 rồi tắt | ±0,12 giây |
| Chìm đen | độ sáng −1 rồi sáng lại | ±0,18 giây |

Chỉ áp lên **hình gốc**, đặt đầu chuỗi lọc — chữ và tư liệu chèn vẽ sau nên không bị
phóng hay nháy theo.

**Chỗ nối đếm theo khoảng GIỮ LẠI, và các khoảng nối đuôi nhau phải được dán liền
trước.** `keptFromSegments` trả một khoảng mỗi ĐOẠN, nên tách đoạn bằng ✂ mà không bỏ gì
vẫn sinh thêm khoảng: video 9 đoạn liền mạch từng bị nhấn zoom 8 lần ở những chỗ hình
chạy liên tục. Tệ hơn, khung xem tính chỗ nối từ các quãng ĐÃ BỎ nên nó báo 0 — hai bên
nói ngược nhau và người dùng không có cách nào biết. Xem `mergeAdjacent` ở `pipeline.ts`.

---

## 3.2. Dải vẽ theo VIDEO SẼ XUẤT RA

Bỏ một quãng thì quãng đó **biến mất khỏi dải** và mọi thứ phía sau dồn lên. Con số thời
lượng là độ dài bản xuất ra, không phải bản gốc.

Trước đây dải vẽ theo mốc bản gốc và để lại một mảng xám ở chỗ đã bỏ — nên bàn dựng nói
hai điều khác nhau về cùng một video: lúc phát thì vạch **nhảy cóc** qua chỗ đó, mà dải
thì vẫn vẽ nó ra. Cái nhìn thấy không phải cái tải về.

**Chỉ lúc VẼ mới quy đổi.** Mọi thứ trong dữ liệu vẫn tính theo mốc gốc — từ, chữ, tư
liệu, nhạc, dải ảnh phim. Đổi cả kho sang mốc xuất ra thì mỗi lần bỏ một quãng là phải
tính lại toàn bộ. Hai hàm `toOutput`/`toSource` ở `use-editor.ts` là toàn bộ chỗ nối.

Một chỗ khỏi phải sửa: **dải ảnh phim**. Mỗi ô đã lấy khung theo giây gốc của chính đoạn
nó thuộc về, nên đoạn dời sang chỗ mới vẫn lấy đúng hình — chỉ cộng bù một hằng số.

**Chỗ xem lại và trả lại** là bản chép lời (dòng gạch ngang, gom thành một vạch) và khung
"Sẽ không vào video". Dải chỉ trưng thứ sẽ lên phim.

---

## 3.3. Một khối = video + chữ ở trên

Chữ vẽ **đè lên dải phim**, không phải một dải song song. Hai dải riêng thì mắt phải tự
ghép chúng lại ở mọi lượt nhìn, mà ghép sai là chuyện thường.

**MỘT đoạn, MỘT chữ** — đo được trên dự án thật: 0 chữ nào phủ quá một đoạn, 0 đoạn nào
chứa quá một chữ. 62 đoạn = 51 đoạn có chữ + 11 khoảng lặng.

Giữ được luật đó nhờ **gộp đoạn cho vừa chữ, không chẻ chữ cho vừa đoạn**. Chữ máy sinh
luôn ≤5 tiếng nên tự khớp một cụm; nhưng chữ người dùng viết tay có thể phủ mười mấy
tiếng, và mốc cắt của các cụm bên dưới rơi vào giữa nó. Lúc dựng đoạn, mốc nào rơi vào
GIỮA một chữ thì bỏ mốc đó đi (`gopChoVuaChu`).

Vì sao không chẻ chữ: "Nhưng năm nay thì khác" chỉ năm chữ mà phủ mười bốn tiếng nói —
chẻ ra nghĩa là thay lời người ta viết bằng lời máy chép. Còn gộp đoạn thì không mất gì,
vì đoạn chỉ là chỗ cắt: hai đoạn dính nhau gộp lại vẫn ra đúng ngần ấy video.

Từng có hai bản trước bản này, cùng một lỗi: đẻ ra ngoại lệ để né một chuyện không xảy
ra. Bản một chia chữ làm hai loại ("ứng 1-1 thì vẽ trong khối, còn lại cho ra dải riêng")
— thừa, vì đo ra không có hai chữ nào chồng thời gian nhau. Bản hai chấp nhận "một chữ
nằm trên bốn đoạn" — thừa, vì chỉ cần đừng đặt mốc cắt vào giữa chữ.

Vùng bấm tách đôi theo chiều dọc, và đó là chỗ tiện: **bấm vào vạch chữ chọn CHỮ, bấm
vào phần phim bên dưới chọn ĐOẠN.**

Vạch chữ **trùng khít** mép khối phim: khối lùi vào 1px mỗi bên để hai khối cạnh nhau
không dính, nên vạch chữ phải lùi đúng bấy nhiêu. Lệch một pixel thì hai đường bo góc
cùng bán kính nằm cạnh nhau và mắt đọc ra một cái viền đôi.

Tư liệu chèn và nhạc giữ dải riêng vì chúng trải qua nhiều đoạn và CÓ thể chồng nhau.
Vẽ tương đối là đủ. Nhạc xuống **dưới cùng**: nó trải suốt video và không có hình, đặt
xen giữa các lớp có hình là chen ngang mạch đọc.

---

## 4. Vạch giữa cố định

Vạch đứng yên ở **đúng giữa** vùng dải; dải trôi bên dưới.

Đo trên Captions (25/07/2026, viewport 1680×1050): vạch cố định tại x=840 = đúng tâm
canvas; thước trôi (số 0 từ x=68 sang số 1 ở x=28) trong khi vạch không nhúc nhích.
Nút ✂ nằm đúng x=840, và **chỉ hiện khi đang chọn một đoạn** — lúc bình thường
chỗ đó trống. Ta theo đúng vậy: nút luôn hiện thì nó ăn trọn một hàng suốt cả buổi
dựng chỉ để chờ vài lần bấm, mà tách đoạn cũng không phải việc làm giữa chừng —
người dùng chọn đoạn trước, rồi mới nghĩ đến chuyện chẻ nó. Hiện đúng lúc đó thì
nút vừa không tốn chỗ, vừa nói rõ mình sắp chẻ CÁI NÀO.

Lợi ích thật không phải là "vạch đứng yên" mà là:

1. **Chạy dải và tua gộp làm một cử chỉ**, mục tiêu là toàn bộ bề mặt — không thể trượt.
2. **Điểm cắt luôn ở cùng một toạ độ màn hình** → thành phản xạ, không phải nhắm.
3. **Vạch không bao giờ kéo được**, nên tua và gọt-mép không bao giờ tranh nhau.

**Vẫn giữ bấm-để-nhảy.** Captions có cả hai; bỏ đi là tự làm chậm mình trên desktop.

**Thêm lăn chuột để chạy dải.** Trên bản Captions, lăn dọc / lăn ngang / Ctrl+lăn đều
không phản ứng (đã đo). Đó là app mobile bê lên web. Con lăn không cần nhắm gì cả nên
nó là cách tua chính xác nhất trên desktop.

---

## 5. Vì sao kéo thả hay lệch, và cách chặn

Trên timeline cổ điển, cùng một vùng pixel phục vụ nhiều việc nên máy phải **đoán ý**:

| Kéo ở đâu | Máy phải đoán giữa |
|---|---|
| Thân khối | tua? di chuyển khối? quét chọn? |
| Sát mép khối (~6px) | gọt mép? di chuyển khối? |
| Thanh thước | tua? chạy dải? |

Lệch 6px ra kết quả khác hẳn. Đó là nguồn gốc của "kéo thả rất dễ lệch" — không phải
tay người dùng run.

**Bốn ràng buộc để chặn, đo được:**

1. Tay nắm **chỉ tồn tại sau khi chọn khối**. Chưa chọn thì không có gì kéo được ngoài
   chạy dải.
2. Tay nắm **rộng ≥14px** (Captions: 14px; timeline cổ điển: ~6px).
3. Tay nắm đặt **ngoài thân khối**, không chồng vùng bấm của chính khối đó.
4. Vạch giữa **không kéo được**.

**Chỗ Captions vẫn còn dở, ta không chép:** khi vạch giữa đứng đúng mép khối, tay nắm
cách vạch **1.5px** — nhìn thì đè lên nhau. Không sai chức năng (vạch không kéo được)
nhưng gây hoang mang. Ta làm mờ vạch giữa khi đang chọn một khối.

**Vùng bắt ≠ phần nhìn thấy.** Vùng bắt giữ nguyên 14px và vẫn nằm ngoài thân khối;
phần vẽ ra chỉ là **vạch 3px áp sát mép**. Khối đang chọn đã có viền riêng, thêm hai
thanh đặc 14px nữa thì mắt đọc thành ba vật thể chứ không phải một khối có hai mép kéo
được. To hơn không làm dễ trúng hơn — vùng bắt mới quyết định điều đó.

**Mép tư liệu chèn BÁM RANH GIỚI TỪ.** Nó neo vào khoảng **từ** chứ không vào giây, nên
kéo mép nghĩa là "phủ thêm/bớt một tiếng": buông tay ở đâu thì mép cũng nhảy về đầu hay
cuối một tiếng. Đây không phải hạn chế mà là lý do tư liệu không bao giờ trôi khi cắt bỏ
một câu phía trước — cùng tính chất với mọi thứ khác neo vào từ (§1).

---

## 6. Hai cách "cắt" — hai việc khác nhau, không phải hai lối làm một việc

| Việc | Cách | Vì sao phải là cách đó |
|---|---|---|
| Bỏ **nội dung** (câu thừa, đoạn lan man) | Gạch ngang câu | Có chữ để mà chỉ vào |
| Bỏ **khoảng lặng / tiếng ồn** (hít thở, "ừm", đầu-đuôi) | ✂ tại vạch, hoặc gọt mép | Chỗ đó **không có từ nào** |

Cái thứ hai bản chép lời không với tới được vì nó nằm giữa các từ. Nên bắt buộc phải có.

**MỘT cơ chế, ba cửa theo cỡ miếng cắn.** `removeRange` = `splitAt(đầu)` + `splitAt(cuối)`
+ đánh dấu bỏ đoạn giữa — tức là mọi cửa đều đổ về ĐOẠN, kể cả nút bỏ ở dòng chữ:

| Cửa | Cỡ miếng | Dùng khi |
|---|---|---|
| Nút bỏ ở dòng chữ | một cụm | bỏ một ý thừa |
| Nút bỏ ở dòng **lặng** | một quãng không ai nói | bỏ chỗ hít thở, ngập ngừng |
| Shift-chọn nhiều dòng → "Bỏ cả dải" | tuỳ ý | bỏ nửa câu, hai câu, cả đoạn lan man |
| Chọn đoạn trên dải → "Bỏ đoạn" | một đoạn | ranh giới mà lời không diễn đạt được |

**ĐOẠN chia theo CỤM CHỮ và KHOẢNG LẶNG** (`segment-seed.ts`), không theo "10 giây một
khối" như trước. Ba cái được:

· Dải phim và bảng Lời chia y hệt nhau — một cấu trúc, nhìn ở hai chỗ.
· Bỏ một cụm chỉ còn là bật cờ trên đúng một đoạn — đo thật: bỏ một khoảng lặng xong số
  đoạn vẫn là 71, tức là KHÔNG phải tách gì cả.
· Khoảng lặng thành một vật nhìn thấy và bấm được.

Hệ quả về nhãn: một video một phút có bảy chục đoạn, nên "Đoạn 47" vô nghĩa. Nhãn giờ là
**chính lời nằm trong đoạn** (hoặc "lặng 2,8 giây"), và chỉ hiện khi rê vào hay đang chọn
— bảy chục nhãn cùng lúc thì dải phim thành một hàng chữ, không còn nhìn ra hình.

**Dòng đã bỏ VẪN NẰM NGUYÊN CHỖ, chỉ gạch ngang.** Từng gom những dòng bỏ liền nhau thành
một vạch `đã bỏ 3 dòng · hiện`, lý lẽ là bảng Lời phải đọc ra đúng video thành phẩm. Nhưng
bảng này không chỉ để đọc thành phẩm — nó là chỗ người ta CẮT, mà cắt là vòng lặp cắt → xem
→ trả lại. Giấu thứ vừa cắt thì bước "trả lại" phải mở một cái vạch ra trước đã, và cái vạch
ấy không nói mình đang giấu câu nào. Gạch ngang nói đủ hai điều cùng lúc: câu này còn đó, và
nó không vào video.

**Đã gỡ nút "Bỏ cả câu".** Nó nổi lên cùng lúc với nút bỏ của từng dòng — hai nút cùng
nghĩa khác tầm, cách nhau vài chục pixel, bấm nhầm là bay cả câu. Chọn dải thay thế nó và
còn mạnh hơn: cắn được đúng miếng mình muốn chứ không bó vào ranh giới câu.

**Bỏ là "ignore", không phải "delete".** Dòng gạch ngang, đoạn vẫn nằm nguyên trong CSDL,
trả lại được bất cứ lúc nào. Đây là chỗ Descript đã đi qua và chốt (họ có cả hai, cộng
đồng họ khuyên "never delete, always ignore"), và Premiere cũng hiện chỗ đã xoá thành
gạch ngang xám trong transcript. Lý do thật: vòng lặp khi cắt lời là **cắt → xem → trả
lại**, mà hoàn tác là một chồng tuyến tính — lùi 20 bước để lấy lại một câu thì mất luôn
mọi thứ làm sau đó. Và chữ/tư liệu neo trong quãng đó là công người dùng đã bỏ ra.

**Không được có cách thứ ba.** Không kéo-mép-để-bỏ-nội-dung. Người dùng phải luôn biết
ngay dùng cái nào mà không phải cân nhắc.

---

## 7. Chữ trên màn

**MỘT khái niệm, và MỘT mặt phẳng để sửa.**

Trước đây có "phụ đề" (công tắc cho cả dự án, tự sinh lúc xuất, không lưu, không sửa
được từng cụm) và "chữ trên màn" (người dùng đặt tay). Tệ hơn nữa: cùng một câu chữ hiện
ở **năm** nơi — danh sách câu, chip cụm lồng dưới câu, dải từ, dải chữ, ô nội dung ở
khung sửa — mà sửa mỗi nơi ra một kết quả khác. Không ai đoán được phải sửa ở đâu.

Nay:

1. **Chép lời xong là có chữ**, gieo đúng một lần cho mỗi dự án (`captions_seeded`).
   Không có bước "bật" nào — chữ chạy theo lời là thứ gần như ai cũng muốn.
2. **Bảng Lời liệt kê CỤM, không liệt kê câu.** Một dòng = một cụm = đúng cái hiện lên
   khung hình ở giây đó = một khối trên dải. Câu chỉ còn là cách **nhóm** các dòng, vì
   bỏ nội dung thì bỏ theo câu ("bỏ đoạn lan man này") còn sửa chữ thì theo cụm.
3. **Bấm một lần vào dòng** là chọn + nhảy vạch tới đó + mở ô sửa. Không bắt bấm đúp:
   sửa chữ là việc chính của bảng này, mà bấm đúp không có dấu hiệu nào cho biết làm được.
4. **Cắt video ngay tại dòng.** Khoảng của cụm CHÍNH LÀ khoảng cắt, nên bỏ một câu thừa
   là bấm đúng chỗ mình đang đọc, không phải sang dải tìm mốc. "Bỏ cả câu" cũng là cắt
   khoảng, chỉ khác bề rộng — một cơ chế, không phải hai.
5. **Trạng thái "đã bỏ" của dòng suy từ các quãng không vào video**, không từ một cờ
   riêng: cắt bằng đường nào thì dòng cũng hiện như nhau, vì với người dùng đó là một
   chuyện.
6. **"Thêm chữ riêng"** giờ mới có nghĩa: một khối chữ KHÔNG phải lời nói — tiêu đề, con
   số nhấn. Đây cũng là cách Captions tách "Text" khỏi "Captions" trên dải của họ.

**Sửa ở một chỗ, hai lớp cùng đổi.** Nội dung chữ và bảng từ giữ khớp nhau bằng hai luật
đối xứng, không cần thêm cờ trạng thái nào:

| Sửa ở đâu | Điều kiện | Kết quả |
|---|---|---|
| Sửa một **từ** | chữ còn đúng bằng lời cũ của khoảng đó | chữ đổi theo |
| Sửa một **cụm chữ** | số tiếng khớp với khoảng từ nó neo | lời chép đổi theo |

Cả hai đều so bằng dữ liệu đang có, không đoán: chiều thứ nhất so với lời **cũ** (biết
được vì sửa ngay lúc đó), chiều thứ hai so **số tiếng**. Người dùng rút gọn hay viết lại
hẳn thì số tiếng khác đi, và lời chép giữ đúng thứ người ta đã NÓI.

**Nhịp hiện từng tiếng theo cùng một luật.** Chữ còn khớp lời thì dùng mốc nói thật; đã
viết lại thì **rải đều số tiếng trong đúng khoảng của cụm**. Nhịp cố định 0,07 giây một
tiếng là sai: cụm 2 giây chạy hết trong nửa giây rồi đứng im, mà nói nhanh nói chậm gì
cũng thế. Khoảng là bất biến, chữ bên trong là tự do — đây là hợp đồng chung của cả
ngành (Opus Clip tự chia lại mốc khi thêm từ; Captions dựng lại video sau mỗi lần sửa
chính tả).

**Vị trí chọn theo DẢI, không kéo thả tự do.** Đây là ràng buộc bất di dịch, không phải
lựa chọn phong cách.

Cả một phiên đo trước đã đổi lấy bảo đảm **"chữ không bao giờ tràn khung"** — kiểm 1920
tổ hợp ở 1080×1920 thật, chuẩn là 0 lỗi. Cho kéo tự do là ném đi đúng bảo đảm đó, và
người không chuyên sẽ không biết mình vừa làm hỏng cho tới lúc xuất video.

Người dùng chọn **ý định** (trên / giữa trên / giữa dưới / dưới); máy lo **số đo**.

Lấy từ Captions: điều khiển ở mức **từng từ** — chọn từ nào được nhấn mạnh, chỗ nào
xuống dòng. Bảng "Word" của họ có Breaks (None / Auto / Line Break / Page Break) và
Focus (Supersize / Emphasize / Underline). Đây là mức chi tiết đúng: đủ để người dùng
làm chủ nhịp chữ mà không cần đụng vào toạ độ.

---

## 8. Bảng sửa

**Dán mép phải, không chặn.** Đã kiểm trên Captions: kéo dải trong lúc bảng đang mở vẫn
chạy bình thường.

Sửa video là vòng lặp **sửa → xem lại ngay**. Modal cắt đôi vòng lặp đó. Không dùng modal.

Bảng **hiện khi có thứ được chọn**, không chiếm chỗ thường trực.

---

## 9. Thứ chỉ mình có: danh sách "Cần bạn xem"

Không công cụ nào trong bảy cái đã khảo nói cho người dùng biết **chỗ nào** cần xem lại.
Hệ quả, nguyên văn một người dùng OpusClip: *"đến lúc sửa xong mấy chỗ trông sai, tôi
mất bằng hoặc hơn thời gian tự làm"*. Họ biết 30–50% kết quả cần sửa nhưng không biết ở
đâu, nên phải soi hết.

Máy đo được thì máy chỉ ra: chữ tràn khung, từ nghe không chắc, phóng rơi sai chỗ.

**Khoảng lặng: KHÔNG báo giữa video.** Người nói bình thường nghỉ 1–2 giây giữa các ý;
báo ở ngưỡng đó thì một video 2 phút đẻ ra hai chục dòng, và danh sách chết vì tiếng ồn.
Thay vào đó:

- **Đầu và cuối video** — tự cắt phần chưa nói / đã nói xong, không hỏi. Gần như luôn thừa.
- **Giữa video** — chỉ báo khi lặng **≥4 giây**, mức đó thường là sự cố (quên lời, bị
  ngắt) chứ không phải nhịp nghỉ.

**Điều kiện sống còn: bỏ qua thì phải DÍNH.** Không thì danh sách thành tiếng ồn và
người dùng học cách phớt lờ nó — lúc đó nó tệ hơn là không có.

---

## 10. Danh sách từ chối

Mỗi dòng đều là thứ ít nhất một đối thủ có. Từ chối có chủ đích.

| Từ chối | Vì sao |
|---|---|
| Kéo thả tự do vị trí chữ | Phá bảo đảm "không tràn khung" |
| Timeline nhiều lớp (track) | Người không chuyên không có mô hình "lớp" trong đầu |
| Keyframe | Cùng lý do |
| Cách cắt thứ ba | Hai cách đã đủ phủ; ba cách là bắt người dùng phân vân |
| Nút "AI làm hết" ở luồng chính | Đã chốt: hỗ trợ làm thủ công trước, AI vào sau |
| Kéo vạch giữa | Đúng thứ sinh ra tranh chấp cử chỉ |
| Thư viện template dài | Chọn nhiều không phải là dễ dùng |

---

## 11. Ca kiểm

Đạt hết mới coi là xong.

**Tua và cắt**
- T1 · Bấm một điểm bất kỳ trên dải → nhảy đúng tới đó, vạch giữa **không** đổi vị trí màn hình
- T2 · Kéo ở thước / khoảng trống / thân khối → đều chạy dải, không cái nào di chuyển khối
- T3 · Lăn chuột trên dải → chạy dải; Ctrl+lăn → phóng to
- T4 · Kéo dải trong lúc đang phát → tự dừng phát
- T5 · Bấm ✂ → cắt đúng tại vạch giữa, sai số 0 khung hình

**Tay nắm**
- H1 · Chưa chọn khối → không có tay nắm nào trên dải
- H2 · Chọn khối → tay nắm hiện, đo được **≥14px**
- H3 · Tay nắm **không đè** lên vùng bấm của thân khối
- H4 · Kéo tay nắm → khối co giãn, dải **không** trôi
- H5 · Vạch giữa trùng mép khối → vạch mờ đi, tay nắm vẫn kéo được bình thường

**Chữ**
- C1 · Mọi tổ hợp nội dung × vị trí → **0 lỗi tràn khung** (quét tự động ở 1080×1920)
- C2 · Đổi vị trí bằng dải → chữ nhảy đúng dải, không tràn
- C3 · Nhấn mạnh một từ → chỉ từ đó đổi, nhịp các từ khác giữ nguyên

**Bản chép lời**
- N1 · Gạch ngang một câu → câu biến khỏi video, phần tử của các câu sau **vẫn đúng chỗ**
- N2 · Sửa chữ chép sai → không xê dịch mốc thời gian
- N3 · Câu bị bỏ chứa phần tử → báo rõ, không xoá ngầm

**Bảng sửa**
- P1 · Bảng mở → kéo dải vẫn chạy
- P2 · Không chọn gì → bảng không chiếm chỗ
- P3 · Esc → đóng bảng, bỏ chọn

---

## 12. Bốn lớp, bốn màu

Dải xếp bốn tầng: **chữ trên màn → tư liệu chèn → nhạc nền → đoạn video**. Cùng một sắc
xám thì phải đọc nhãn mới biết đang nhìn tầng nào, mà lúc dựng mắt chỉ lướt.

**Không còn dải TỪ.** Nó bày lại đúng những chữ đã có ở dải chữ ngay bên dưới và ở bảng
Lời — ba nơi cho cùng một câu chữ. Từ khi mọi việc với chữ dồn về bảng Lời, dải từ chỉ
còn để nhìn mật độ nói, mà cái giá là một tầng nữa phải quét mắt qua.

| Tầng | Dấu hiệu | Vì sao thế |
|---|---|---|
| Chữ trên màn | nền vàng (`--lane-text`) | lớp người dùng làm chủ; lời nói sinh ra chữ ở đây, sửa thì sửa ở bảng Lời |
| Tư liệu chèn | nền xanh lam + **ảnh thu nhỏ của chính tệp** | câu hỏi lúc dựng luôn là "chỗ này đang đè ảnh nào" |
| Nhạc nền | nền xanh lá + tên bài + **số phần trăm** | lớp duy nhất không có gì để nhìn, nên mức âm lượng phải đọc được ngay trên khối |
| Đoạn video | dải ảnh phim | đã có hình thì không cần tô màu |

Màu khai ở `--lane-*` trong `src/index.css`, không đặt tại chỗ gọi. Độ bão hoà giữ thấp:
dải là nơi làm việc hàng giờ, không phải bảng thống kê.

**Dải ảnh vẽ theo Ô, không phải một hình nền kéo giãn.** Ảnh luôn vẽ ở thang gốc của nó
(máy chủ trả về `strip_native_second_width`), mỗi ô rộng 44px lấy khung hình ở đúng giây
của mép trái ô. Phóng to thì các ô lấy trùng khung của nhau, thu nhỏ thì chúng nhảy cách
quãng — đúng cách một dải phim thật cư xử. Kéo giãn cả hình nền theo mức phóng thì giữ
tỉ lệ nghĩa là bề cao co theo bề ngang: zoom ra là ảnh còn một sợi chỉ giữa dải cao 44px.

**Ô từ hẹp dưới 24px thì bỏ chữ, giữ ô.** Chữ xén giữa nét, hàng trăm ô cạnh nhau thành
một vệt lem trông như hỏng font. Nhịp của lời vẫn đọc được qua chính các ô.

---

## 13. Nhạc nền là một LỚP, không phải một cài đặt

Trước đây nhạc là hai cột trên bảng dự án (một đường dẫn, một mức âm lượng) và một thanh
trượt trong thanh công cụ. Hệ quả: nó phủ nguyên video, "nhạc bắt đầu từ đâu" là câu hỏi
không trả lời được, và chỉ có được đúng một bài.

Giờ mỗi bài là một hàng ở bảng `music_tracks` với mốc riêng, và một khối trên dải như mọi
lớp khác — chọn khối, kéo hai đầu, chỉnh âm lượng ở khung bên phải.

**Mốc ghi theo thời gian NGUỒN**, đúng trục với lời, đoạn và tư liệu. Lúc xuất mới quy
sang dải đã cắt bằng `keptBefore`: bỏ một phút ở giữa thì bài nhạc đặt sau đó cũng lùi
lên đúng một phút. Cách còn lại — ghi theo thời gian của bản xuất ra — thì không vẽ lên
dải này được, vì dải này nói bằng thời gian nguồn.

**Nhạc chạy LIÊN TỤC trong bản xuất ra**, không bị cắt vụn theo các chỗ đã bỏ: một khoảng
đã bỏ nằm giữa bài chỉ làm bài ngắn lại, chứ không sinh ra một nhát cắt nghe như lỗi. Hai
đầu bài luôn có vuốt lên/xuống 0,75 giây vì cùng lý do.

**Khung xem trước phát nhạc thật**, đặt kim theo đúng phép tính của máy chủ. Không có nó
thì chỉnh âm lượng là chỉnh mù — phải xuất cả video mới biết 18% nghe ra sao cạnh giọng
nói.

**Gỡ một bài KHÔNG xoá tệp.** Tệp nhạc là thứ người dùng phải đi tìm và tải lên; xoá đi
thì "hoàn tác" chỉ còn là lời hứa suông. Vài trăm KB nằm lại rẻ hơn nhiều.

---

## 14. Những gì trình duyệt tự làm — và chặn ở đâu

Bàn dựng dùng đúng những cử chỉ trình duyệt đã đặt trước cho việc khác. Mỗi cái đều làm
mất chỗ đang làm mà không báo trước. Gom hết vào `use-editor-guards.ts` để còn biết đã
chặn những gì.

| Việc mặc định | Xảy ra khi | Chặn bằng |
|---|---|---|
| Lùi/tiến trang | vuốt hai ngón sang ngang | `overscroll-behavior: none` + `preventDefault` ở `wheel` |
| Phóng cả trang | chụm hai ngón, `Ctrl`+lăn, `Cmd` `+`/`−`/`0` | bắt và đổi thành phóng **dải**; Safari còn cần `gesturestart/change/end` |
| Bấm lại nút vừa bấm | gõ `Space` khi nút còn giữ focus | nghe `keydown`+`keyup` ở pha **chụp**, `preventDefault` + `stopPropagation` |
| Cuộn trang | `Space`, `←`, `→` | đổi thành phát/dừng và nhích vạch |
| Bôi đen chữ | kéo dải, chuột đi ra ngoài dải | `select-none` trên dải + cờ `html[data-dragging]` cho cả trang |
| Mở tệp vừa thả | thả tệp trượt ra ngoài vùng nhận | `preventDefault` ở `dragover`/`drop` toàn cửa sổ |
| Hộp "lưu trang này" | `Cmd/Ctrl+S` | chặn, và nói rằng mọi thay đổi đã ghi ngay |
| Bảng chuột phải | chuột phải trên dải | `preventDefault` trên dải |
| Tự cuộn kiểu la bàn | bấm nút giữa (Windows/Linux) | `preventDefault` ở `pointerdown` |
| Cuộn ngầm để lộ ô đang focus | bấm một khối ngoài tầm nhìn | `tabIndex={-1}` + kéo `scrollLeft` về 0 |
| Cuộn trang / nảy mép / kéo-để-tải-lại | ở mọi vùng cuộn | `overscroll-behavior: contain` |

**Không chặn, có chủ ý:** `Cmd+F`, `Cmd+P`, phím `Tab`, và **mọi phím khi con trỏ đang ở
ô gõ chữ hay khi có bảng nổi đang mở** — giành quyền của trình duyệt ở những chỗ đó thì
lấy mất nhiều hơn trả lại.

**Một chỗ không chặn được:** Chrome trên Windows vẫn lùi trang bằng cử chỉ chuột cảm ứng
dù đã khai `overscroll-behavior` — nền web chưa có API nào tắt hẳn. `preventDefault` ở
`wheel` gánh phần lớn, nhưng đây là giới hạn của nền tảng, không phải chỗ ta làm thiếu.

---

## Nguồn

- Đo trực tiếp Captions trên tài khoản thật, 25/07/2026, viewport 1680×1050 — dải là một
  `<canvas>` 1648×218 không có phần tử con; vạch giữa x=840; tay nắm 14px tại x 841–855;
  con lăn không phản ứng; phóng to chỉ bằng nút − / +
- Khảo 7 công cụ (đợt trước) — trích dẫn người dùng OpusClip
- 133 review CapCut: **không một lời phàn nàn nào về timeline** → giả thuyết "timeline
  làm người mới sợ" không có bằng chứng đỡ, nên giữ vỏ quen mắt
- Quét 1920 tổ hợp chữ ở 1080×1920 (dự án trước) → bảo đảm không tràn khung

## Tình trạng thực thi

Toàn bộ §1–§14 đã dựng và chạy được đầu-cuối (xem README). Ba chỗ khác đặc tả:

- **Gọt mép ghi thành "đoạn cắt theo giây"** thay vì đổi biên của khối. Cùng kết
  quả trên video mà không phải nhân bản trạng thái khối ở hai nơi.
- **✂ cắt nửa giây mỗi bên vạch** thay vì tách khối làm đôi — đủ để xoá một tiếng
  hít thở mà không phải kéo chọn vùng.
- **Sửa lời chép sai chỉ đổi chữ của CÂU**, không đụng bảng từ; khi đã sửa tay
  thì hiện lời đó và bỏ gạch chấm "máy nghe không chắc".

## Câu chưa chốt

1. Ở mức phóng to nào thì một từ đủ rộng để bấm trúng trên di động?
*(Hai câu về ripple và khoảng lặng đã chốt — xem §2 và §9.)*

## 15. Chữ trên màn có HAI cái neo

Vẫn là MỘT khái niệm — cùng kiểu dáng, cùng khung sửa, cùng cách in ra video. Chỉ khác
nhau ở chỗ nó **ghim vào đâu**, và đó là một khác biệt có thật chứ không phải hai cái
tên cho cùng một vật:

| | Neo theo TỪ | Neo theo GIỜ |
|---|---|---|
| Là gì | chữ chép lời (cụm ≤5 tiếng) | tiêu đề, con số, nhãn |
| Ghim vào | `from_word_id` / `to_word_id` | `start_sec` / `end_sec` |
| Vì sao | bỏ câu phía trước thì nó vẫn dính đúng mấy tiếng nó đang chép | nó không chép tiếng nào; nó thuộc về một khoảnh khắc |
| Bản chép lời | một dòng | không có mặt |
| Trên dải | vẽ đè lên phim | lớp riêng trên cùng |
| Đổi khoảng | theo cụm lời, không kéo được | kéo hai đầu |

**Mọi đường đọc phải nhận CẢ HAI kiểu neo.** Ba chỗ đã suýt nuốt im lặng chữ tự do vì
chúng tra ngược ra hai đầu từ rồi bỏ qua khi tra không thấy: phép nối lúc xuất video
(`INNER JOIN words` → đổi sang `LEFT JOIN`), bộ lọc của khung xem, và lệnh dựng lại khi
hoàn tác cú xoá. Luật chung: **dùng `element.start/end`, đừng tra `wordsById`** — cặp mốc
đó đã đúng cho cả hai kiểu.

Cơ chế neo-theo-giờ **đã có sẵn** trước khi có chữ tự do: dải nhạc chạy đúng như vậy
(`music_tracks.start_sec/end_sec`, dồn theo quãng đã bỏ bằng `keptBefore` lúc xuất).
Chữ tự do dùng lại đúng đường đó, không đẻ ra cơ chế thứ hai.

**Bản cũ sai ở đâu.** "Thêm chữ" từng bắt chữ tự do đi qua đường của chữ chép lời: tìm
câu ở vạch → ôm cả câu → mồi nội dung bằng chính lời câu đó → kéo vạch về đầu câu. Bốn
bước ấy chỉ để trả lời một câu hỏi mà chữ tự do không hề đặt ra ("nó thuộc câu nào?"),
và kết quả là nút đó chỉ nhân đôi câu đang đứng.

## 16. Chữ không được đè chữ

Đo trên một video thật: khối 3 dòng ở **Sát đáy** chiếm 35%→80% chiều cao khung, và
**34 trên 46** phụ đề là 3 dòng — đó là mức bình thường, không phải ca hiếm. Nếu cho
dải **Sát trên** cũng 45% như mọi dải thì nó chạy tới 57%, chồng 22% khung, hai lớp chữ
trộn vào nhau không đọc được.

Ba lớp chặn, theo thứ tự sớm nhất trước:

1. **Cỡ chữ nhỏ lại** (xem §19). Ba dòng ở cỡ lớn nhất chỉ còn 28,7% chiều cao khung,
   nên Trên (12→40,7%) và Dưới (55,3→80%) hụt nhau hơn 14% — hai chỗ mặc định **không
   bao giờ** đè. Không cần trần riêng cho dải trên nữa; hình học tự lo.
2. **Cảnh báo ngay dưới nút "Chỗ đặt"** khi hai khối trùng giờ VÀ hai dải chạm nhau.
   Phép thử dải suy từ hình học (`bandsOverlap`), không chép tay thành bảng — bản chép
   tay đã sai một lần, ghi rằng Sát trên không đụng ai: đúng với Sát đáy (34% hụt dưới
   35%) nhưng sai với Trên mặt, dải đó bắt đầu ngay ở 30%.
   Cảnh báo phải đứng cạnh cái nút gây ra nó — báo ở một danh sách cách nửa màn hình thì
   người ta đổi dải, thấy không sao, đi tiếp, mười phút sau mới biết.
3. **Một dòng ở "Cần bạn xem"** để bắt lại lúc soát cuối, khi đã không còn nhớ mình dời
   cái nào xuống đâu.

Cặp dải chạm nhau, tính ở mức xấu nhất (khối chiếm hết trần của dải mình):

| | Trên | Giữa | Dưới |
|---|---|---|---|
| **Trên** 12–42% | — | chạm | **an toàn** |
| **Giữa** 35–65% | chạm | — | chạm |
| **Dưới** 50–80% | **an toàn** | chạm | — |

Cặp mặc định (tiêu đề Trên, phụ đề Dưới) an toàn. Chỉ "Giữa" mới chạm ai — thêm một lý
do nữa để hạn chế dùng nó.

Gốc rễ đã sửa: `blockRoom` từng cho **mỗi** dải 45%, trong khi vùng an toàn chỉ có 70%.
Hai khối × 45% = 90% > 70% — bài toán vô nghiệm ngay từ hằng số, và không ai kiểm.

## 17. Viền báo trạng thái phải vẽ VÀO TRONG

Đã dính đúng một lỗi ở bốn chỗ khác nhau, nên viết thành luật.

`ring-*` của Tailwind là `box-shadow`, mà `box-shadow` vẽ **ngoài** hộp viền. Bất kỳ tổ
tiên nào cắt phần tràn — vùng cuộn, thẻ `overflow-hidden`, khung nhìn của dải — cũng gọt
mất đúng một hai pixel đó, và khối đang chọn trông như hở một cạnh. Lỗi này chỉ lộ khi
phần tử nằm SÁT mép, nên nó sống rất lâu và mỗi lần lại tưởng là một lỗi mới.

| Cách vẽ | Nằm đâu | Bị mẹ cắt? | Bị con đè? |
|---|---|---|---|
| `border-*` | trong hộp viền (`box-sizing: border-box`) | không | không |
| `inset-ring-*` | trong hộp viền (`box-shadow: inset`) | không | **có** |
| `ring-*`, `outline-*` | ngoài hộp viền | **có** | không |

Cột cuối là cái bẫy thứ hai: `box-shadow: inset` vẽ **dưới** nội dung. Trên một ô có ảnh
phủ kín thì viền trong biến mất sạch — đúng như viền ngoài, chỉ khác lý do. Ô ảnh phải
dùng một **lớp phủ tuyệt đối** (`absolute inset-0` + `border`): nó nằm sau ảnh trong thứ
tự vẽ nên hiện lên trên, mà vẫn gọn trong hộp nên không ai cắt được.

Trên ảnh nhiều chi tiết thì một đường 2px vẫn lẫn vào cảnh, nên kèm thêm **dấu tích** ở
góc — nó trả lời thẳng câu người dùng đang hỏi ("cái nào đang chọn") mà không phụ thuộc
vào việc phân biệt một sợi viền với đường nét trong ảnh.

**Luật:** báo trạng thái (đang chọn, đang rê chuột) thì dùng **nền** trước; cần một
đường viền thì dùng **`inset-ring-*`**. `ring-*` chỉ còn dùng cho vòng tiêu điểm bàn
phím, nơi vẽ ra ngoài là đúng ý.

Chỗ tô nền được thì tô nền, đừng vẽ viền: hàng chữ trong bản chép lời chạy sát mép vùng
cuộn nên nền là cách duy nhất không bị gọt. Chỗ **bắt buộc** còn viền là khối nằm trên
ảnh thật (dải phim, ô tư liệu) — tô nền lên một khung hình thì không nhìn ra.

## 18. Mỗi lời nhắc phải có một CÂU TRẢ LỜI, không phải một nút giấu

"Nghe không chắc" từng là vòng lặp không có lối ra. Máy nghe SAI thì sửa ở bản chép lời,
cờ `confidence` hạ theo và mọi thứ khớp. Nhưng máy nghe ĐÚNG thì không có đường nào nói
với nó điều đó: nút duy nhất là "Bỏ qua", mà nó chỉ ghi vào `dismissed_issues` — dòng
nhắc biến mất, còn gạch chấm dưới chữ nằm lại vĩnh viễn. Hàng soát bảo "xong rồi" trong
khi bản chép lời vẫn bảo "chỗ này đáng ngờ".

Luật rút ra: **lời nhắc suy từ một sự thật nào đó trong dữ liệu thì câu trả lời phải ghi
vào chính sự thật đó**, không ghi vào một bảng "đã giấu" bên cạnh. Hai nguồn cho một câu
hỏi là hai nguồn sẽ lệch nhau.

| Loại nhắc | Suy từ | Câu trả lời ghi vào |
|---|---|---|
| Nghe không chắc | `words.confidence` | `words.confidence = 1` ("Chữ này đúng") |
| Chữ dài quá / lặng quá / chữ đè chữ | đo lại mỗi lần mở | `dismissed_issues` — không có ô nào khác để ghi |

Nên loại "nghe không chắc" **không có nút bỏ qua**: nó có "Chữ này đúng", và nút đó hạ
hẳn cờ chứ không giấu dòng nhắc. Bày cả hai là bày hai nút gần giống nhau mà kết quả
khác hẳn.

## 19. Cỡ chữ: đặc như một viên gạch, không to như một tấm biển

Bản đầu lấy cỡ chữ 24% bề rộng khung và bước dòng 1,28 — khối ba dòng cao **45%** chiều
cao khung. Bốn dải liên tiếp thì hai dải giữa phủ đúng mặt người nói. Kết quả là chữ vừa
to vừa rời rạc, và che mất thứ cả video đang nói về.

Đo lại trên ảnh tham khảo (`examples/`): khối hai dòng của họ cao **19–21%** khung, nét
chữ cao ~6,5%, bước dòng ~7% — tức các dòng **gần chạm nhau**. Cái làm nên dáng không
phải cỡ chữ lớn, mà là **mật độ**: chữ vừa phải, dòng sát dòng, tiếng sát tiếng, cả khối
đọc ra một mảng đặc.

| Hằng số | Cũ | Mới |
|---|---|---|
| Cỡ chữ / bề rộng khung (TRẦN) | 0,24 | **0,15** |
| Cỡ chữ / bề rộng khung (SÀN) | 0,09 | 0,09 — không đổi |
| Bước dòng / cỡ chữ | 1,28 (in) · 1,15 (xem) | **1,0** cả hai |
| Khoảng giữa hai tiếng / cỡ chữ | 0,24 | **0,12** |
| Trần chiều cao khối | 0,45 mỗi dải | **0,30** |
| Số chỗ đặt | 4 | **3** (Trên · Giữa · Dưới) |

Khối ba dòng: **45% → 24,7%** chiều cao khung.

**Bước dòng KHÔNG được xuống dưới 1.** Tiếng Việt có dấu chồng dấu (`Ắ`, `Ữ`, `ệ`); dưới
1 là dấu vượt ra ngoài hộp dòng và bị cắt cụt. Ảnh tham khảo tiếng Anh xuống được ~0,78
nên rất dễ bắt chước nhầm — lỗi này không lộ ra nếu chỉ thử bằng chữ mẫu tiếng Anh.

Hai chỗ từng ghi hai con số khác nhau cho cùng một bước dòng (1,28 bên đo, 1,15 bên vẽ).
Giờ cả hai lấy `LINE_HEIGHT`, và trang xem lấy từ `overlay-model.ts` với ghi chú phải
khớp máy chủ.

**Hạ TRẦN, giữ SÀN.** Chỉ những cụm ngắn nhỏ đi — chúng là những cụm đang chạm trần. Cụm
dài vốn đã bị bề rộng ép xuống dưới trần từ trước nên không đổi gì. Đo: cụm ngắn 9,6% →
8,4% chiều cao khung; cụm dài giữ nguyên 6,2%.

**Khoảng giữa hai tiếng phải là MỘT con số ở MỘT chỗ.** Từng có ba mô hình khác nhau cho
cùng một khoảng: trang xem bẻ dòng bằng bề rộng dấu cách của font, máy chủ bẻ dòng bằng
bề rộng dấu cách đo được, còn lúc VẼ thì dùng `WORD_GAP`. Ba cái trùng nhau lúc
`WORD_GAP` xấp xỉ bề rộng dấu cách nên sống rất lâu; hạ `WORD_GAP` xuống 0,12 là chúng
tách ra ngay — khung xem chia 2 dòng, bản in ra chia 3 dòng. Giờ `WORD_GAP` nằm cạnh
`LINE_HEIGHT` trong `text-layout.ts` và cả ba đường đều lấy từ đó.

Bảng dev ở `/_dev/overlays` in cả hai kết quả cạnh nhau và gắn cờ **"← LỆCH với khung
xem"** — nó chính là thứ bắt được lỗi này. Đừng bỏ nó đi.

## 20. Dáng khối chữ — học từ video tham khảo

Đo bảy khung của `examples/19113c09-…webm` (1080×1920):

| | Video tham khảo | Mình (trước) | Mình (sau) |
|---|---|---|---|
| Mép trái khối chữ | **11%** ở cả bảy khung | 5% | **11%** |
| Bề rộng khối | 74–79% | 89% (dải trên) | **78%** |
| Khối 2–3 dòng cao | **12%** khung | 22,2% | **12,8%** |
| Cỡ dòng dẫn / dòng ý | 4,0% / 6,5% — chênh **1,6 lần** | bằng nhau | chênh 1,82 lần (`SMALL = 0,55`) |

**Cái làm nên dáng "xếp gạch" là CHÊNH CỠ, không phải bước dòng.** Bước dòng của họ đo ra
5,9% trong khi nét dòng to cao 6,5% — nhìn thì tưởng các dòng cài răng lược nhờ bước dòng
dưới 1. Nhưng bước dòng ấy do dòng TRÊN (nhỏ hơn) quyết định: so với cỡ chữ của chính nó
thì tỉ lệ là **1,06**, vẫn trên sàn. Dòng dưới to hơn nên nét của nó trào lên quá bước
dòng — đó là toàn bộ mẹo.

Nghĩa là **không cần phá sàn 1,0** (thứ sẽ cắt cụt dấu chồng dấu tiếng Việt). Chỉ cần
dòng dẫn nhỏ, dòng ý to.

**Mặc định đổi: `Đều nhau` → `Dẫn nhỏ · ý to`.** Đây là thay đổi có sức nặng nhất trong cả
mục này, mà không đụng một hằng số nào: khối 22,2% → 12,8% chiều cao khung, đúng bằng
mức đo được ở video tham khảo. Bài học chung: **công cụ đã đủ, mặc định mới là thứ quyết
định dáng của cả sản phẩm** — vì mọi chữ đều sinh ra từ một chỗ, và không ai đi đổi tay
năm chục lần.

Dự án đang có được chuyển theo một lần, nhưng **chỉ những chữ máy tự sinh và chưa ai
chỉnh**: nội dung còn đúng bằng lời nó neo vào, và trục nhấn vẫn đúng giá trị máy đặt.
Người dùng đã tự chọn `Đều nhau` cho một chữ thì đó là lựa chọn của họ.

**Không bê nguyên "2–4 chữ mỗi cụm".** Nhịp của họ là 2–4 *từ tiếng Anh*; luật mình là
≤5 *tiếng*. Hai đơn vị khác nhau — "sinh nhật" là 2 tiếng nhưng 1 ý, siết xuống 4 là chẻ
ngang một từ ghép. Thứ đáng bắt chước là **số DÒNG** (2, hiếm khi 3), và chênh cỡ tự lo
được điều đó: dòng dẫn nhỏ chứa được nhiều tiếng hơn.

## 21. Ghép nhiều video: mỗi mảnh phải ra ĐÚNG độ dài của nó

`buildBase` đệm khung cuối bằng `tpad=stop_mode=clone:stop_duration=30` để hình không
bao giờ ngắn hơn tiếng (video nhịp thay đổi của iPhone hay bị vậy — đo thật: hình 4,80s /
tiếng 6,08s), rồi để `-shortest` cắt hộ ở cuối.

**Chỉ đúng khi có MỘT video chính.** Với nhiều video, `tpad` nhồi 30 giây khung đứng vào
đuôi MỖI mảnh, và `-shortest` chỉ cắt được đuôi mảnh cuối. Đo trên một dự án ba video:
ba tệp cộng lại 110,9s mà `base.mp4` ra **170,9s** — dôi đúng 2 × 30s ở hai chỗ nối.

Hậu quả dây chuyền, và không chỗ nào báo lỗi:
- video thứ hai bắt đầu muộn 30 giây so với chỗ bàn dựng tính ra từ độ dài các tệp;
- bản chép lời chạy trên `base.mp4` nên mang mốc của dòng thời gian 170s, lệch hẳn khỏi
  dòng thời gian 110,9s mà dải đang vẽ;
- 30 giây khung đứng giữa hai video là 30 giây im lặng, nên chỗ đó không có chữ nào.

**Luật:** đệm thì phải CẮT. Mỗi mảnh đo trước độ dài (`segmentLength` — lấy luồng dài hơn
trong hình/tiếng, không lấy `format.duration` vì tệp .MOV nhịp thay đổi khai lệch), rồi
`tpad`+`trim` cho hình và `apad`+`atrim` cho tiếng về đúng con số đó. Hai luồng cùng độ
dài thì `concat` nối chính xác, và `-shortest` không còn việc gì để làm — bỏ luôn.

**Đừng gieo chữ khi đang chép lời.** Cửa `GET /api/projects/:id` gieo chữ từ bảng từ hiện
có; lúc đang chép lời thì bảng đó sắp bị xoá và dựng lại, nên chữ gieo ra neo vào những
từ sắp biến mất. Chép xong, khâu neo-lại kéo chúng sang từ gần nhất theo thời gian và nội
dung không còn khớp lời — đo thật một lần: **67 trên 69 chữ lệch**. Chỉ cần mở lại trang
giữa lúc đang chép là dính.

## 22. Vạch không bao giờ đứng trong quãng đã bỏ

Dải vẽ theo mốc XUẤT RA (§3.2), nên mọi cú bấm và kéo đều rơi vào chỗ còn giữ — mốc xuất
ra không có cách nào trỏ vào một quãng đã bỏ. Nhưng vạch **đang đứng yên** một chỗ mà chỗ
đó *vừa bị bỏ* thì nó kẹt lại bên trong.

Đo thật: bỏ khoảng lặng đầu video (0 → 0,86s) trong khi vạch ở 0. Dải vẽ vạch ở mốc xuất
ra 0 — tức ngay đầu đoạn đầu tiên còn giữ — nên nhìn thì thấy "đang ở đầu video"; còn khung
xem phủ kín chữ *"Đoạn này đã bỏ, sẽ không có trong video"*. Hai cửa nói hai điều khác nhau
về cùng một khoảnh khắc, và người dùng vừa cắt xong thì thấy màn hình trắng xoá.

**Luật:** `time` luôn nằm trong vùng còn giữ. Một hiệu ứng canh `skipRanges`, thấy vạch rơi
vào quãng đã bỏ thì đẩy tới `nextKeptTime`. Đặt ở một chỗ nên mọi đường cắt đều được lo —
bỏ đoạn, bỏ khoảng, gọt mép, hoàn tác — thay vì vá từng đường một.

## 23. Bảng đo mà đo sai thì tệ hơn không có bảng

`/_dev/overlays` in số đo của trang xem cạnh số đo của máy chủ và gắn cờ **"← LỆCH với
khung xem"** khi hai bên chia dòng khác nhau. Nó đã bắt được một lỗi thật (§19), nhưng
sau đó lại báo lệch ở những cụm mà khung xem KHÔNG hề lệch.

Nguyên nhân: bảng gọi `fitCum(text)` thiếu tham số bề rộng, nên rơi vào mặc định `0,9` —
trong khi không dải nào rộng thế (0,78 ở Trên, 0,71 ở Giữa/Dưới). Bảng tưởng chữ có nhiều
chỗ hơn thật nên đếm ra ít dòng hơn, rồi tố cáo phần vẽ. Phần vẽ thì gọi đúng
`fitCum(text, avail)` từ đầu.

**Luật:** tham số nào không có giá trị đúng cho mọi trường hợp thì **đừng cho nó giá trị
mặc định**. `avail` giờ là tham số bắt buộc — quên truyền là lỗi biên dịch, không phải một
con số sai lặng lẽ.

## 24. Kéo dải phải đi theo giờ XUẤT RA

Vạch không được đứng trong quãng đã bỏ (§22), và dải vẽ theo giờ xuất ra (§3.2). Hai luật
đó buộc phép kéo cũng phải tính bằng giờ xuất ra: kéo `dx` pixel là đi `dx / pxPerSecond`
giây **xuất ra**.

Bản đầu cộng thẳng vào giờ GỐC (`seek(startTime - dx / pxPerSecond)`). Vạch đi xuyên qua
những quãng đã bỏ, hiệu ứng ở §22 đẩy nó ra, nhịp kéo sau lại đẩy vào — **vạch nhấp nháy
ở mọi chỗ cắt**. Lăn chuột (`scrubByPixels`) mắc đúng lỗi ấy.

Đo sau khi sửa, trên dự án có 8 chỗ cắt: kéo qua 8 giây (41 nhịp) và lăn 40 nhịp — **0
nhịp nào rơi vào quãng đã bỏ**.

## 25. Chép lời: một dòng mồi đổi được một phần ba số từ sai

`initial_prompt` của Whisper không chỉ để khai báo từ chuyên ngành. Bắt đầu "nguội" thì bộ
giải mã vừa đoán tiếng vừa đoán cách viết; có sẵn một đoạn tiếng Việt đúng chính tả và có
dấu câu ở trước, nó bám theo lối viết đó và đoán tiếng cũng chắc hơn.

Đo trên hai dự án thật, cùng đoạn tiếng, chỉ khác mỗi dòng mồi:

| | Không mồi | Có mồi |
|---|---|---|
| Dự án A (−31 LUFS) | 34% từ nghe không chắc | **23%** |
| Dự án B (−21 LUFS) | 4% | **2%** |

Sửa được cả lỗi thật: *"chuỗi sơ đi"* → *"chuỗi series"*, và thêm dấu câu, viết hoa.

**Mồi trung tính là đủ.** Thử một mồi đầy từ chuyên ngành (phỏng vấn, backend, principal
engineer…) — kết quả **y hệt** mồi trung tính. Cái ăn thua là CÓ mồi, không phải mồi nói
về gì. Nên giữ nó trung tính, đừng kéo mọi video về phía một chủ đề.

**Hai thứ đã thử và KHÔNG ăn thua**, ghi lại để khỏi thử lại:
- **Chuẩn hoá âm lượng** trước khi chép. Dự án A ở −31,3 LUFS, kéo lên −20,8 LUFS: 31 → 32
  từ nghe không chắc trên 90. Không đổi gì.
- **`condition_on_previous_text=True`**: giống hệt bản `False`.

## 26. Việc nặng: một lượt một loại, và xác phải được dọn

Bấm "Xuất video" hai lần là hai luồng ffmpeg cùng ghi vào một `final.mp4` — tệp ra hỏng,
mà bảng việc chỉ có một hàng nên không ai biết có hai luồng. Chép lời cũng vậy: hai luồng
cùng xoá rồi dựng lại bảng từ.

Nên `startJob` chỉ cho **một lượt mỗi loại mỗi dự án**, và trả 409 khi đang bận.

**Nhưng cái chốt đó tự nó là một cái bẫy.** Việc chạy trong tiến trình máy chủ: nó chết
cùng lúc với ffmpeg bị giết, với máy chủ khởi động lại, với một ngoại lệ không ai bắt.
Hàng trong bảng vẫn ghi `running` mãi mãi — và cái chốt biến một trục trặc nhất thời
thành **một cái khoá không mở được**. Gặp thật ngay trong vòng rà kế tiếp: một lượt xuất
chết 939 giây trước khoá mọi lượt xuất sau.

Hai lớp gỡ:
1. **Quét lúc khởi động** — máy chủ vừa lên thì không có việc nào đang chạy, mọi hàng
   `running` đều là xác, đổi hết thành `error` kèm lý do đọc được.
2. **Hạn 3 phút không nhích tiến độ** — bắt cả trường hợp việc chết mà máy chủ vẫn sống.

Luật rút ra: **chốt nào dựa vào một trạng thái được ghi xuống thì phải có đường coi trạng
thái đó là hết hạn.** Không thì cái chốt sống lâu hơn thứ nó bảo vệ.

## 27. Thất bại phải nhìn thấy được

Bàn dựng đổi hình ngay khi bấm rồi mới ghi xuống máy chủ. Ghi hỏng mà không báo thì màn
hình nói một đằng, dữ liệu một nẻo — người dùng chỉ biết ở lần mở sau, lúc đó công đã mất
và không còn manh mối nào.

Rà một lượt tìm được **26 chỗ** viết `.catch(() => {})`, cộng hai việc nặng (chép lời,
xuất video) báo lỗi vào state rồi thôi — nút quay về nhãn cũ như chưa có chuyện gì.

Sửa bằng một hàm dùng chung `boQuaLoi()` cho mọi lệnh ghi, và một `toast` cho hai việc
nặng. Chỗ nào cũng báo giống nhau, và không ai phải nhớ tự viết lấy.

Kèm theo: máy chủ trả `{"error":"..."}` nên phải **bóc lấy câu tiếng Việt** trước khi
hiện — ném nguyên chuỗi JSON ra màn hình thì người dùng đọc được đúng dấu ngoặc và tên
trường.

## 28. Thêm video sau khi chia đoạn thì phải nới đoạn

Đoạn được gieo MỘT LẦN theo bản chép lời lúc đó. Thêm một video chính vào sau thì phần
thêm không thuộc đoạn nào — mà "không thuộc đoạn nào" nghĩa là **không vào video xuất ra**.
Đo thật: hai video chính cộng lại 75,73s, đoạn chỉ phủ tới 66,43s, **9,3 giây biến mất
không báo gì**.

`extendToDuration` nối thêm một đoạn ở đuôi mỗi lần mở dự án. **Nối thêm, không gieo lại**
— gieo lại là xoá sạch những đoạn người dùng đã tách, đã bỏ, đã gọt.

Và khi bản chép lời chạy DÀI HƠN video (tệp đổi sau lúc chép), hàng soát báo **"Bản chép
lời không khớp video"** kèm nút chép lại. Đây là lời nhắc duy nhất không sửa được bằng tay,
nên nó xếp **đầu bảng**: hàng soát giờ sắp theo mức nặng trước, thời gian sau — xếp thuần
theo thời gian thì thứ làm hỏng cả bản xuất nằm lẫn dưới năm chục dòng "nghe không chắc".

## 29. Chỗ nối là một VẬT trên dải, không phải một cờ của dự án

Ba lời than cùng một gốc: không đổi được riêng một chỗ, không đặt được ở chỗ mình muốn,
và nhìn dải không biết chỗ nào đang có hiệu ứng gì. Gốc là **chỗ nối được lưu thành một
cờ của cả dự án** (`projects.zoom_punch`) áp lên những mốc tính ra được lúc xuất.

[CapCut](https://capcutguide.com/capcut-transitions/) làm ngược lại: một dấu nhỏ nằm ngay
mối nối giữa hai khối, bấm vào thì sửa, kéo mép thì đổi thời lượng. Nó là một vật.

Mình theo mẫu đó, nhưng giữ phần "máy làm hộ":

- Cờ dự án thành **mặc định gieo** cho mọi chỗ cắt.
- Bảng `junctions` chỉ lưu **chỗ đã sửa khác**, không gieo sẵn. Gieo sẵn thì cắt thêm một
  chỗ mới là phải nhớ gieo tiếp; không gieo thì luật gọn: có bản sửa thì theo bản sửa,
  không thì theo mặc định.
- Neo bằng giây **BẢN GỐC** (chỗ quãng giữ lại phía trước kết thúc). Mốc trên bản đã cắt
  xê dịch mỗi lần bỏ thêm một quãng ở phía trước.
- Trên dải: một dấu tròn ở mỗi mối nối, mang **hình của kiểu đang dùng** — đọc cả dải là
  biết nhịp cắt của cả video. Chỗ đã sửa riêng tô đậm hơn chỗ theo mặc định.

## 30. Chỗ nối hai phía — và cái ràng buộc không né được

Chuyển cảnh là việc của HAI đoạn. Bản trước áp một hàm đối xứng cho ba kiểu và một hàm
nửa vời cho `zoom-out`, nên không nói được "đoạn trước làm một đằng, đoạn sau một nẻo".

**Ràng buộc:** hiệu ứng nằm trên MỘT luồng đã ghép, và thang phóng không xuống dưới 1
được (dưới 1 là lộ mép đen, `crop` không cứu). Nên hai đầu cửa sổ **bắt buộc** bằng 1 —
không thì chỗ vào cửa sổ giật một cái. Tức là **không làm được ảnh gương thật** kiểu "đoạn
trước thu nhỏ, đoạn sau phóng to".

Thứ còn tự do là **NHỊP**: hai nửa dài ngắn khác nhau.

| | Nửa trước | Nửa sau | Đọc ra là |
|---|---|---|---|
| Zoom vào | 0,50s dồn dần | 0,15s buông | cảnh cũ ập tới rồi cắt |
| Zoom ra | 0,15s giật | 0,50s trôi ra | cắt một nhát, cảnh mới từ từ mở ra |
| Nháy sáng · Chìm đen | đối xứng | đối xứng | một cú đập |

Đo trên bản xuất thật, chỗ nối nháy sáng ở giây 3,50: độ sáng **32 → 231 → 30**, đỉnh
đúng tại mốc.

**Thứ CHƯA làm được:** chuyển cảnh mà hai đoạn cùng hiện một lúc (hoà tan, trượt chồng).
Cái đó cần giữ hai đoạn tách rời rồi chồng lên nhau — và cần "tay cầm" như
[Premiere](https://helpx.adobe.com/premiere/desktop/add-video-effects/apply-video-transitions/clip-handles-settings.html).
Mình luôn có tay cầm (cắt từ bản gốc dài hơn), nhưng đó là việc dựng lại khâu ghép.

**Bẫy đã dính:** `PUT` không có trong danh sách CORS nên lệnh ghi chết với "Failed to
fetch" — máy chủ không có gì trong nhật ký để mà dò. Cái toast báo lỗi thêm ở §27 là thứ
bắt được nó.

## 31. Cú phóng ở chỗ nối từng TRƯỢT chứ không phóng

Bộ lọc cũ: `scale=w='W*z':h='H*z':eval=frame, crop=W:H`.

Trong ffmpeg, `crop` tính `w`/`h` **một lần** lúc dựng chuỗi lọc, còn `x`/`y` tính **theo
từng khung**. Mặc định `x=(in_w-out_w)/2` dùng `in_w` của LIÊN KẾT — con số chốt từ đầu,
tức đúng bằng `out_w` — nên `x` luôn bằng **0**. Ảnh phóng to ra thì phần bị cắt dồn hết
sang phải: nhìn ra là hình **trượt ngang**, không phải phóng từ tâm.

Đo trên một khung có chữ thập ở giữa:

| giây | tâm lệch (cũ) | tâm lệch (đã sửa) |
|---|---|---|
| 0,00 | −0,5px | −0,5px |
| 0,25 | +13,5px | +0,5px |
| 0,50 (đỉnh) | **+42,5px** | +0,8px |

Chữa bằng cách viết thẳng mép cắt theo `t`, qua chính biểu thức phóng:
`crop=W:H:x='(W*z-W)/2':y='(H*z-H)/2'`.

**Đã thử và KHÔNG được:** đảo thứ tự thành `crop` rồi `scale`. `crop` chốt `w`/`h` một
lần nên cửa sổ cắt không bao giờ đổi — đo ra khoảng cách hai vạch mốc đứng nguyên 594px,
tức không phóng một chút nào. Ghi lại để khỏi thử lại.

Khung xem cũng phải đổi theo: nó vẫn dùng hình dạng xung đối xứng cũ và cờ chung của dự
án, giờ đọc `editor.junctions` để mỗi chỗ nối mang kiểu của riêng nó.

## 32. Gọt mép đoạn không được LẤN sang hàng xóm

Gọt vào trong thì phần bị gọt thành chỗ hở — hở không thuộc đoạn nào nên không vào video,
đó là ý đồ. Nhưng nới ra ngoài mà không chặn thì hai đoạn **chồng lên nhau**: đo thật, kéo
mép phải 200px là đoạn 1 kết thúc ở 2,42 trong khi đoạn 2 vẫn bắt đầu ở 1,34 — chồng 1,08
giây. Từ đó mọi phép tính về sau đều sai (khoảng giữ lại đếm hai lần, mốc chỗ nối lệch, độ
dài xuất ra vống lên) và **không chỗ nào báo**.

Chặn ở CẢ HAI nơi:
- **máy chủ** (`trimSegment`) — nó là nơi chốt;
- **màn hình** (`trim`) — thiếu chặn ở đây thì lúc kéo vẫn vẽ lấn qua hàng xóm, thả tay
  xong máy chủ kéo về, người dùng thấy khối giật ngược mà không hiểu vì sao.

## 33. Việc huỷ hoại không chiếm chỗ trên dải

"Bỏ đoạn" từng là một nút nổi lên trên khối đang chọn. Nó che đúng cái dấu chỗ nối ở mép
khối — mà chỗ nối cũng chỉ hiện khi đang chọn. Hai thứ tranh nhau một chỗ thì thứ nào cũng
dùng không xong.

Chuyển sang **chuột phải** và **phím Delete**: hai chỗ người ta đã quen tìm ở mọi phần mềm
dựng, và không cái nào chiếm pixel nào của dải.

Dấu chỗ nối làm lại theo bài học của
[IMG.LY](https://img.ly/blog/designing-a-timeline-for-mobile-video-editing/) — *"vùng bắt
rộng hơn phần nhìn thấy hơn hai lần"*, đúng luật `TrimHandle` đã dùng: vùng bắt 26px trong
suốt, phần nhìn thấy là một viên 18px có icon thật (không phải ký tự unicode 9px, ở cỡ đó
hai mũi tên đọc ra như nhau). Đặt ở GIỮA chiều cao dải phim, không phải mép trên — mép
trên là chỗ dải chữ vẽ đè.

## §34 · Hiệu ứng là một VẬT có quãng, không phải một cờ của dự án

Bản trước: `zoom_punch` là một cột trên `projects` — kiểu chuyển cảnh mặc định cho cả dự
án — cộng bảng `junctions(project_id, at_sec, kind)` lưu những chỗ người dùng sửa khác.
Hệ quả, đều lộ ra khi dùng thật:

- Khoá là một MỐC nên không nói được "hiệu ứng này dài bằng này".
- Hiệu ứng chỉ tồn tại ở nơi CÓ vết cắt, nên không đặt được ở giữa một đoạn.
- Nút trên thanh công cụ ghi "Chỗ nối: zoom vào" đứng cạnh "Thêm chữ" và "Chèn tư liệu"
  — hai việc làm ra một vật ở chỗ con trỏ — nên trông cùng một họ mà làm thì khác hẳn:
  bấm vào không có gì xuất hiện, và ở chỗ không có vết cắt thì nó không đặt được gì.

Giờ: bảng `effects(id, project_id, start_sec, end_sec, kind)`. Chỗ nối tại vết cắt chỉ là
TRƯỜNG HỢP RIÊNG — quãng của nó vắt qua vết cắt, đỉnh xung rơi đúng vào đó.

**Đỉnh suy từ quãng, không lưu riêng.** `effectPeak(start, end, kind)` đặt đỉnh ở
`truoc/(truoc+sau)` của quãng. Thay quãng mặc định `[cắt−truoc, cắt+sau]` vào thì đỉnh rơi
đúng vết cắt, nên bản cũ dựng ra hình y hệt. Kéo quãng dài ra thì hai nửa giãn cùng tỉ lệ:
"zoom vào" vẫn là dồn-chậm-buông-nhanh chứ không hoá thành thứ khác. Đo trên bản xuất thật,
hiệu ứng `zoom-in` quãng `[0 – 2,42]` (đỉnh phải ở 1,861s):

| giây | mức phóng đo được | mô hình lệch | mô hình đối xứng |
|---|---|---|---|
| 0,95 | 1,040 | 1,041 | 1,063 |
| 1,86 | 1,078 | 1,080 | 1,037 |

**Đỉnh luôn tính trên thời gian ĐÃ CẮT.** Trên giây gốc, một quãng vắt qua vết cắt còn ôm
cả phần bị bỏ — dài ngắn tuỳ chỗ đó bỏ nhiều hay ít — nên đỉnh sẽ trôi. Quãng mặc định của
một chỗ nối vì thế là `[cắt−truoc, chỗ-đoạn-sau-bắt-đầu+sau]`: trên giây gốc nó là một cái
hố, trên video nó dán liền.

**Không gieo sẵn.** Vết cắt chưa ai đụng thì hiệu ứng được TỰ SUY theo mặc định dự án, mã
lấy từ chính mốc cắt (`eff_cut_3.500`). Người dùng động vào thì hàng ghi xuống kho mang
đúng mã đó — chỗ đang chọn không nhảy đi đâu, và cái tự suy tự biến mất vì quãng của hàng
mới phủ lên vết cắt. Gieo sẵn thì cắt thêm một chỗ là phải nhớ gieo tiếp, quên một đường
là chỗ đó câm mà chẳng ai biết.

**"Bỏ đánh dấu" ở vết cắt ghi `kind: none`, không xoá hàng** — vết cắt vẫn còn đó, xoá hàng
thì cái tự suy mọc lại ngay.

**Mặc định dự án vẫn còn, nhưng thành một HÀNH ĐỘNG.** Nút "Dùng cho mọi chỗ nối" nằm trong
bảng của chính hiệu ứng đang chọn, nói bằng thứ người dùng vừa chọn xong và đang nhìn thấy,
thay cho một chế độ giấu sau một nút trên thanh công cụ.

## §35 · Chỗ nối và tay nắm gọt mép không được đứng chung một chỗ

Dấu chỗ nối từng vẽ đè lên mép dải phim cho "sát mối nối". Nhưng mép khối cũng đúng là chỗ
tay nắm gọt mép đứng. Đo được: dấu chiếm `[x−13, x+13]` ở lớp 30, tay nắm chiếm `[x, x+14]`
ở lớp 20 — dấu nằm trên và nuốt trọn nửa tay nắm, nên **đoạn nào có chuyển cảnh là không co
dãn được nữa**.

Cách chữa không phải là chỉnh lớp hay thu nhỏ vùng bắt — hai vật khác nhau thì cần hai chỗ
khác nhau. Hiệu ứng có HÀNG RIÊNG cao 16px ngay trên dải phim, cùng toạ độ ngang. Sau khi
tách: chỗ nối ở `y 868–884`, tay nắm ở `y 890–934`, `elementFromPoint` tại tâm mỗi tay nắm
trả về đúng tay nắm, kéo mép phải 150px cho kết quả `3,5 → 2,825`.

Khối trên dải là **khối màu mang TÊN**, dùng chung `TimelineBlock` như bốn dải kia — thêm
một tông `junction` vào bảng `--lane-*` (sắc 25, cách sắc gần nhất là chữ/85 đúng 60 độ).

Bản trước vẽ mỗi kiểu một icon riêng trong một viên tròn 16px. Hai cái sai: ở cỡ đó `⇥⇤`
với `⇤⇥` đọc ra như nhau, và quan trọng hơn — chẳng có lý do gì bắt người dùng học năm cái
hình khi chỗ đó viết được hẳn cái tên. Nên **không icon nào cả**: màu đã nói đây là lớp gì,
chữ nói đây là hiệu ứng gì, và khối hẹp thì phần chữ được lấy trọn bề ngang.

Bên trong khối có một **vạch mảnh ở ĐỈNH** — cần nói ra vì đỉnh không nằm giữa khối: "zoom
vào" đỉnh ở 77% quãng, "zoom ra" ở 23%.

Hiệu ứng đang theo mặc định dự án thì vẽ `muted` (mờ 45%) — đổi mặc định là nó đổi theo,
còn cái đã sửa tay thì đứng yên; phải nhìn ra được sự khác nhau đó mà không cần bấm vào.

Giờ trong bảng dùng `formatTimeFine` (có một chữ số lẻ): `formatTime` cắt cụt xuống giây nên
một hiệu ứng dài 0,24 giây hiện ra là "0:03 → 0:03", đọc như hai mốc trùng nhau.

## §36 · Nút thêm-một-thứ gắn vào VẠCH CHẠY, không đứng thành hàng riêng

Bốn việc thêm-một-thứ vốn đã neo vào vạch từ trong ruột — `addTextAtPlayhead`,
`addEffectAtPlayhead`, `addInsertAtPlayhead`, và giờ cả nhạc; hộp chèn tư liệu còn ghi
thẳng "Chèn tư liệu vào 0:12". Chỉ có mấy cái NÚT là nằm tít trên thanh công cụ, cách chỗ
nó tác động cả trăm pixel.

Đưa được nút về đúng chỗ ấy là nhờ **vạch chạy ghim cứng ở `left-1/2`** — phim trôi, vạch
đứng yên. Nút gắn lên nó là một đích CỐ ĐỊNH trên màn, không thua nút thanh công cụ, mà
lại nằm ngay chỗ mắt đang nhìn (cái kéo đã chứng minh, §4).

- `+` ở đầu TRÊN — thêm vào các dải trên (hiệu ứng, chữ, tư liệu, nhạc).
- kéo cắt ở đầu DƯỚI — chẻ dải phim ở dưới. Nút nằm về phía thứ nó động vào.

Cả hai đặt **ngoài vùng cuộn** của dải: vùng đó `overflow: hidden`, nút thò ra là bị xén.
Chúng thò 12px vào phần đệm 20px của thẻ nên vẫn nguyên vẹn — đo được: kéo ở `y 952–984`,
vùng cuộn hết ở 972, thẻ hết ở 992.

Bỏ được cả hàng thanh công cụ. Ba nút còn lại (hoàn tác, phóng to, thu nhỏ) thành **cột dọc
bên phải** — lấy ~36px bề ngang đang thừa thay vì 40px bề cao đang thiếu. Khung xem lớn từ
334×594 lên **357×634**.

Ba nút ấy để **nền đặc, cỡ 40px** chứ không phải nút chìm 32px: đứng một mình ở mép thẻ,
không có hàng nào quanh để đọc ra "chỗ có nút", nên nút chìm trông như một cái bóng. Hai nút
phóng dính nhau thành một cặp, hoàn tác tách ra trên đầu — hai loại việc khác nhau.

Hai ô chữ trong thanh cũ bỏ hẳn: "0:00 / 1:13" đã in sẵn ở góc khung xem, còn "200 px/giây"
vào tooltip của chính hai nút phóng. Nhãn hoàn tác cũng vào tooltip — ở hàng ngang nó rộng
tới 231px và ĐỔI mỗi lần người dùng làm gì, nên cả thanh xô sang một cái sau từng thao tác.

## §37 · Nhạc là một ĐOẠN, đặt tại vạch

Bài mới từng phủ CẢ video, lý lẽ là "lần đặt đầu tiên ai cũng muốn thế". Đúng cho bài đầu,
sai cho mọi bài sau: muốn mỗi đoạn một bài khác nhau thì bài nào cũng bắt đầu ở giây 0 rồi
đè lên nhau. Nhạc cũng là một lớp có quãng như chữ, như tư liệu — nó nghe theo vạch thì mới
cùng một luật với cả bàn dựng.

Độ dài lấy từ CHÍNH TỆP NHẠC (`probe`), không phải độ dài video như trước.

Không bao giờ đẻ ra khối chồng nhau — dải vẽ chúng lên cùng một hàng và cái sau che cái
trước. Hai luật:

- Đuôi cụt lại ở chỗ bài kế tiếp bắt đầu, và ở cuối video.
- Vạch nằm GIỮA một bài thì **bài cũ dừng ở đúng vạch**, bài mới chạy tiếp từ đó — chính là
  việc "thay nhạc từ đây". Trừ khi cắt xong bài cũ ngắn hơn `MIN_LENGTH`; lúc đó đẩy bài mới
  xuống sau, thà thế còn hơn để lại một mẩu kêu bụp một cái rồi tắt.

Bản đầu tôi cho bài mới nhảy hẳn xuống SAU bài cũ. Thử thật thì bấm ở giây 20 mà bài rơi
xuống giây 66,43 — dời 46 giây khỏi chỗ vừa chỉ, không ai đoán được vì sao. Tránh chồng khối
mà đổi lấy một cú dời câm thì lỗ.

Nhạc kiểu cũ (`music_path` trên `projects`) vẫn chuyển sang phủ cả video như nó vốn thế —
đặt nó tại vạch thì bản dựng cũ tự dưng cụt tiếng mà người dùng không đụng gì.


## §38 · Con trỏ bàn tay: luật ở tầng chung, nhưng component tự phá

`index.css` có sẵn một luật trong `@layer base` phủ `button`, `[role=menuitem]`, `[role=tab]`,
`[role=option]`… → `cursor: pointer`. Vậy mà mục trong bảng `+` vẫn ra `cursor: default`.

Lý do: mục ấy MANG ĐÚNG `role="menuitem"`, nhưng lớp class của chính component có
`cursor-default` — một utility, và utility thắng `@layer base`. Registry shadcn để vậy có
chủ ý (menu hệ điều hành dùng mũi tên), nhưng dự án này có luật riêng: mọi thứ bấm được đều
là bàn tay.

Đã đổi `cursor-default` → `cursor-pointer` ở **15 chỗ / 6 tệp**: `dropdown-menu`,
`context-menu`, `select`, `combobox`, `command`, `menubar` — tất cả đều là mục bấm được
(Item, SubTrigger, CheckboxItem, RadioItem, và hai mũi tên cuộn của Select).

Soát lại bằng cách duyệt DOM thật (kể cả khi đã mở lớp nổi) trên cả trang sửa lẫn
`/_dev/design-system`: **0 chỗ thiếu**. Ba thứ còn báo là `<input role="combobox">` — ô nhập
chữ, `cursor: text` mới đúng ở đó.

Bài học để lần sau khỏi dò lại: luật chung ở `@layer base` KHÔNG cứu được component tự đặt
utility. Thêm một component mới từ registry thì kiểm `cursor-default` trước.

## §39 · Cái kéo luôn hiện; bản chép lời bám theo vạch

**Kéo luôn hiện.** Trước đây nó chỉ hiện khi đang chọn một đoạn. Nhưng
`splitAtPlayhead` chẻ theo GIỜ — máy chủ tự tìm đoạn chứa mốc ấy, nó chưa bao giờ cần ai
chọn trước. Nên người dùng phải tự đoán ra mối liên hệ "chọn đoạn thì mới có kéo", mà không
chỗ nào nói điều đó và bản thân việc chẻ cũng không đòi hỏi.

Giờ luôn hiện, mờ đi khi vạch sát mép đoạn (máy chủ đòi mỗi nửa còn ít nhất `MIN_SEGMENT`)
và **nhãn nói thẳng vì sao**: "Vạch đang sát mép đoạn — kéo sang giữa đoạn rồi tách". Một
nút bấm được mà không làm gì còn tệ hơn một nút mờ đi, nhưng một nút mờ không nói lý do
cũng thế.

Đo trên dự án thử: đoạn dài trung bình 1,18 giây, 15/64 đoạn ngắn dưới 0,6 giây nên không
bao giờ tách được, **54% thời lượng là tách được**. Tức cái kéo sẽ mờ khoảng nửa thời gian —
đó là hệ quả của việc chia đoạn theo cụm lời, không phải của cái nút.

**Bản chép lời bám theo vạch.** Dòng ứng với vạch vẫn luôn được tô sáng, nhưng cuộn-theo chỉ
được nối vào MỘT lối vào: chọn một dòng. Tua vạch thì dòng sáng lên ở ngoài tầm nhìn và
chẳng nói với ai điều gì. Đây không phải một quyết định — chỉ là cuộn-theo viết cho lối vào
thứ nhất rồi dừng ở đó.

Một luật cho cả hai lối vào: đưa dòng lên khoảng **một phần ba** từ trên xuống, và chỉ cuộn
khi nó đang nằm ngoài vùng đọc thoải mái (10%–75%).

Hai chỗ phải nhường:
- **Chọn tay luôn thắng bám-vạch** — chọn là việc người dùng vừa làm có chủ ý.
- **Vừa tự cuộn tay trong 2 giây thì không bám** — không thì đang đọc trước một đoạn mà cứ
  vài giây bị giật về một lần.

Bắt "tự cuộn tay" bằng `wheel` và `pointerdown`, KHÔNG bằng `scroll`: `scrollTo` cũng phát ra
`scroll`, nên nghe `scroll` thì mỗi lần tự cuộn lại tự nhận là người dùng vừa cuộn, và
cuộn-theo tắt vĩnh viễn ngay sau lần đầu.

Đo thật: vạch đi tới 40 giây → bảng cuộn 0 → 1066, dòng đang chạy nằm ở **33%**. Tự cuộn tay
rồi tua ngay → đứng yên ở chỗ vừa kéo. Qua 2 giây, sang dòng mới → cuộn lại vào vùng đọc.

## §40 · Bảng sửa chữ: thôi gọi tên, hãy vẽ ra

Bảng cũ bày cả bốn trục ngang hàng nhau, mỗi trục một nhãn và một câu tả.

| | trước | sau |
|---|---|---|
| số từ | 55 | **12** |
| ký tự | 315 | **152** |
| nút | 20 | **11** |
| câu giải thích | 4 | **0** |

Hơn nửa số từ cũ là lời KỂ về lựa chọn chứ không phải lựa chọn.

**Bốn chỗ hỏng, mỗi chỗ trúng một luật đã có tên.**

1. Nhãn dài 1–4 tiếng nên các ô so le nhau. Luật của dải chọn: các ô BẰNG nhau về bề ngang,
   và nhãn quá hai–ba tiếng thì đổi sang thành phần khác.
2. Một nhãn "Chỗ đặt" chứa hai dải chọn, `5 + 3` = tám lựa chọn. Ngưỡng là năm.
3. Câu tả đang mô tả một BỨC TRANH bằng lời ("Hàng đầu nhỏ và mờ, hàng sau mới là ý chính").
4. Nút chọn chỗ đặt ở cột 3, kết quả hiện ở cột 2 — điều khiển phải là thứ gần nhất về
   không gian với nội dung nó chi phối.

**Chia lại theo TẦN SUẤT, không theo sơ đồ dữ liệu.** Đếm trên 189 chữ trong kho:

```
căn ngang giữ `Giữa`           97,4%      dải dọc  giữ `Dưới`      96,3%
nhấn      giữ `Dẫn nhỏ · ý to` 97,9%      từ khoá  không đánh dấu  97,9%

y nguyên mặc định 179/189 · đổi đúng MỘT trục 5 · đổi từ hai trục lên 4
```

· **Nội dung** — luôn dùng, đứng đầu.
· **Dáng** — lưới 2×2 ô XEM TRƯỚC THẬT, dựng bằng `OverlayTextBlock` từ chính chữ của người
  dùng. Cỡ chữ trong bộ vẽ đo bằng `cqw` nên thu vào ô nhỏ là tự tỉ lệ, không viết lại gì —
  chỉ cần `@container` trên mỗi ô. Cái ô CHÍNH LÀ câu tả, nên bỏ được câu tả.
· **Chỗ đặt** — khung 9:16 tí hon có vẽ vùng MẶT NGƯỜI. Nhờ thế bỏ luôn ghi chú "dải giữa là
  chỗ mặt người ngồi": nhìn là biết.
· **Tinh chỉnh** (gập) — căn ngang và từ khoá, hai thứ dùng 2–3%.

**Từ khoá bấm thẳng vào tiếng trong khung xem.** Mỗi tiếng vốn đã là một phần tử riêng
(`Tieng`), chỉ cần mở `onPick`. CHỈ bật cho chữ ĐANG CHỌN — bật cho mọi chữ thì mỗi cú bấm
vào khung xem để chạy/dừng là đánh dấu nhầm một tiếng. Không chọn thì `pointer-events: none`
nên cú bấm xuyên qua như cũ. Hàng thẻ tiếng vẫn nằm trong "Tinh chỉnh" cho lúc tua ra ngoài
khoảng của chữ — lúc ấy không còn tiếng nào trên màn để mà bấm.

**Chỉ "Dáng" mới đáng vẽ ra; ba trục còn lại icon + nhãn là đủ.**

Hình dạng khối chữ không gọi tên gọn được — nên phải vẽ. Còn "trên / giữa / dưới",
"trái / giữa / phải" và một danh sách tiếng thì ai cũng có sẵn khái niệm trong đầu: bày ba
khung 9:16 chỉ để nói "chữ ở trên" là dựng một bức tranh cho điều đọc một chữ là xong.

Bỏ khung đi thì cả ba trục vừa đủ chỗ hiện THẲNG, không phải giấu sau lớp gập nữa — nên
"Tinh chỉnh" biến mất hẳn. Icon đứng CẠNH nhãn chứ không thay nhãn: hai kiểu cuối của trục
căn ngang (Bậc thang, So le) không có icon nào nói trúng, nên nhãn mới mang nghĩa còn icon
chỉ là mỏ neo cho mắt.

**Mấy hàng này KHÔNG có tooltip.** Luật "thứ bấm được mà chỉ có icon thì phải có tooltip" là
để cứu những nút không có chữ — ở đây chữ nằm sẵn ngay cạnh icon. Thêm tooltip chỉ là bày ra
một hộp đen che mất chính hàng nút đang chọn, để đọc lại đúng cái từ vừa đọc.

Lời nhắc "dải Giữa che mặt người nói" hiện thành một dòng NGAY DƯỚI hàng, và chỉ khi đã chọn
đúng dải đó. Nhét vào tooltip là sai chỗ: một cảnh báo mà bắt rê chuột lên mới thấy thì đúng
những người cần nó nhất lại không bao giờ thấy. In sẵn ra thì nó đứng đó suốt buổi dựng
trong khi 96% số chữ không dùng dải này.

**NỀN của ô xem trước phải TỐI — nhưng tối TRƠN, không phải một khung hình.**

Chữ overlay vốn màu TRẮNG; viền và bóng đổ đều tính cho việc nằm trên video. Đặt lên nền xám
nhạt của thẻ thì chỉ còn cái bóng giữ cho nó đọc được — ra một khối chữ nhoè nhoẹt, và rất
dễ đổ lỗi nhầm cho "chữ nhỏ quá" hay "bóng đổ quá nặng". Không phải: chỉ là sai nền.

Có một đời tôi để ẢNH NỀN thật. Đọc được ngay, nhưng ô này để SO BỐN DÁNG với nhau, mà mỗi ô
một mảng ảnh khác nhau thì mắt phải gạt cái ảnh đi trước rồi mới so được hình khối chữ. Ảnh
thật là việc của khung xem lớn ở cột giữa; ở đây nó chỉ là nhiễu. Nền tối dùng màu CỐ ĐỊNH
(`bg-neutral-800`), không dùng thẻ màu theo chủ đề: chữ vẽ ra luôn trắng nên nền phải tối ở
cả chủ đề sáng lẫn tối.

**Ô đang chọn đánh dấu bằng VIỀN màu chính, không bằng độ mờ.** Làm mờ ô không-chọn thì trên
nền tối, chênh lệch mờ/tỏ đọc ra như bốn ô hơi khác sáng chứ không như một cái được chọn.

**Ô xem trước phải mang tỉ lệ KHUNG HÌNH, và phải XÉN chứ không bóp.**

Bộ vẽ tính cỡ chữ theo diện tích muốn che của một khung 9:16 rồi in ra bằng `cqw` — phần
trăm BỀ RỘNG vùng chứa. Cho ô vuông thì cùng con số ấy ăn vào chiều cao gấp gần hai lần đáng
lẽ: chữ phình gần kín ô rồi tràn xuống dưới, nhìn ra rất thô. Không phải lỗi của chữ — là ô
sai tỉ lệ.

Nhưng để ô đúng 9:16 thì bốn ô cao 194px, cộng hàng "Chỗ đặt" nữa là tràn 136px khỏi cột.
Mà phần trên và dưới khung vốn TRỐNG (khối chữ neo giữa). Nên: bên trong là một khung 9:16
thật mang `@container` — cỡ chữ tính đúng — còn bên ngoài chỉ hé ra dải giữa (`aspect-[5/4]`,
`overflow-hidden`). Xén chỗ trống thì không mất gì.

Khung "Chỗ đặt" KHÔNG xén được: cả điểm của nó là thấy chữ nằm đâu theo chiều dọc.

**Ba lựa chọn thì vẫn để lưới BỐN cột**, để khung ở đây rộng đúng bằng ô hàng "Dáng" ngay
trên. Kéo cho đủ ba cột thì khung to hơn hẳn và hai hàng đọc ra như hai thứ không liên quan.

**Ba cái bẫy gặp khi dựng:**
- `Field` áp `*:w-full` lên con nó, nên mọi bề rộng đặt bên trong đều bị nuốt: khung "Chỗ
  đặt" từng bị ép còn 60px và cụt một nửa. Dùng `grid grid-cols-[1fr_9rem]` chốt cứng cột.
- Bốn ô một hàng thì mỗi ô còn ~80px, chữ bé tới mức bốn dáng trông giống hệt nhau — ô xem
  trước mất sạch lý do tồn tại. Lưới 2×2 mới đủ to.
- "Tinh chỉnh" mở ra 172px, nhiều hơn chỗ còn lại dưới nút, nên mở xong không thấy gì và đọc
  ra như nút hỏng. Tự cuộn phần vừa mở vào tầm mắt + `scroll-fade-b` ở vùng cuộn.
- Bày thanh cuộn thì nó ăn ~12px bề ngang — đủ để ô thứ tư hàng "Dáng" bị cắt cụt. Tắt thanh
  cuộn, để `scroll-fade-b` lo việc báo "còn nữa".
- Dấu "đang chọn" của dải đặt từng vẽ bằng VIỀN, mà chữ trải qua ranh giới hai dải nên viền
  cắt ngang thân chữ. Đổi sang ba khung riêng, mỗi khung một lựa chọn — vừa hết cắt chữ, vừa
  khỏi bắt người dùng tự hiểu rằng cái khung đang bị chia ba.


## §41 · Dấu hiệu trục CĂN NGANG phải tự vẽ

Bộ icon nào cũng có `AlignLeft/Center/Right`, nhưng "căn bậc thang" và "căn so le" là khái
niệm của riêng hệ này nên không bộ nào có. Lấy tạm `IndentIncrease` và `StretchHorizontal`
thì được hai hình không nói gì đúng, mà lại phá tính đồng bộ: ba cái đầu nói về căn chỉnh,
hai cái sau nói về thứ khác hẳn.

Vẽ cả năm bằng CÙNG MỘT LUẬT: ba vạch, khác nhau đúng ở chỗ mỗi vạch nằm đâu — lấy thẳng từ
`indentOf`, chính hàm bộ dựng dùng để đặt các hàng. Dấu hiệu vì thế không phải bản phỏng
đoán, nó là bản thu nhỏ của đúng cái luật sẽ chạy.

Hai chi tiết bắt buộc: ba vạch phải KHÁC BỀ RỘNG (bằng nhau thì trái/giữa/phải trông y hệt),
và phần thụt phải phóng lên 3,4 lần (bản thật thụt 5,5% và 14% trên khung 1080px, thu vào
dấu 14px thì còn chưa tới một pixel). Đo ra: `bậc thang` = 0 / 18,7 / 37,4% (tăng đều) ·
`so le` = 0 / 45 / 13,6% (đan xen).

**Trục CHỖ ĐẶT thì KHÔNG tự vẽ** — giữ `AlignVerticalJustify*` có sẵn. Trên/giữa/dưới là thứ
bộ icon nào cũng vẽ đúng. Tôi có lúc tự vẽ cả cái đó (một khung dọc có vạch), nhưng ở cỡ
14px cái khung đọc ra như một ô trống, thua hẳn icon có sẵn — và đó còn là một thay đổi
không ai yêu cầu.

**Ô chọn dáng dựng bằng CHỮ THẬT của người dùng**, không bằng câu mẫu. Có một đời tôi thay
bằng câu mẫu cố định cho bốn ô "so được với nhau", nhưng người ta chọn dáng cho CÂU CỦA HỌ.
Chỉ mượn chữ khi ô nhập còn trống — trạng thái ấy có thật vì đặt chữ xong con trỏ nhảy thẳng
vào ô nhập.

Hệ quả phải chấp nhận: chưa đánh dấu từ khoá thì ô "Từ khoá to hẳn" hiện ra tiếng ĐẦU to,
phần còn lại nhỏ ở trên — vì đó đúng là thứ sẽ dựng ra (`hero = pieces[0]`, khớp giữa bộ vẽ
và máy chủ). Nhìn hơi lạ nhưng nó THẬT, và hàng "Từ khoá" hiện ngay bên dưới khi chọn dáng
này nên có sẵn đường sửa.

## §42 · Từ khoá chỉ hiện ở dáng thật sự dùng tới nó

Đọc `buildRows` của `server/word-layout.ts`:

| dáng | từ khoá làm gì |
|---|---|
| `tu-khoa-to` | chọn cụm được PHÓNG TO; không đánh dấu thì bốc tiếng đầu |
| `xen-co` | chọn tiếng nào TO; không đánh dấu thì xen theo thứ tự chẵn lẻ |
| `deu` | chỉ đổi độ đặc 0,92 → 1,0 |
| `dan-nho` | chỉ đổi độ đặc 0,92 → 1,0 |

8% độ đặc trên chữ trắng đè video là không nhìn ra được. Nên hàng "Từ khoá" chỉ hiện ở hai
dáng đầu, và cú bấm-tiếng-trong-khung-xem cũng chỉ bật ở hai dáng đó — im lặng ghi một dấu
không đổi được gì còn tệ hơn không cho bấm.

Trước đây hàng này luôn hiện, lý lẽ ghi trong mã là "tiếng đánh dấu in đậm hơn". Đọc lại mã
dựng thì KHÔNG có chỗ nào đổi nét chữ — lý lẽ ấy sai. Một hàng điều khiển không đổi được gì
thì bày ra chỉ để lừa.


## §43 · Viền tiêu điểm bị vùng cuộn gọt — sửa ở thành phần, không vá từng chỗ

Cả hệ vẽ tiêu điểm bằng `focus-visible:ring-3`, mà `ring` của Tailwind là bóng đổ nằm NGOÀI
hộp viền. Vùng cuộn cắt đúng ở mép hộp đệm, nên thứ nào nằm sát mép là ring bị gọt một cạnh.
Lỗi này lặp lại nhiều lần ở dự án.

Soát bằng DOM thay vì bằng mắt — với mọi thứ bấm được, dò tổ tiên gần nhất có `overflow`
khác `visible`, rồi đo khoảng cách từ mép phần tử tới mép vùng cắt; dưới 3px là dính. Phải
lọc bỏ phần tử đã cuộn ra ngoài tầm nhìn, không thì đếm ra 246 chỗ trong khi thật sự chỉ có
5. Kết quả: **cả 5 đều quy về đúng một thành phần** — `ScrollArea`.

Nên sửa ở đó: viewport thêm `p-[3px]`, bằng đúng bề dày ring. Mọi nơi gọi khỏi phải nhớ.

Một vùng cuộn TỰ VIẾT TAY ở trang danh sách dự án không hưởng bản sửa ấy. Chỗ đó đã có sẵn
chú thích nói đúng lý do phải chừa đệm, nhưng để `p-0.5` (2px) trong khi ring dày 3px —
đúng ý, thiếu một pixel, và thiếu một pixel thì vẫn cụt.

Sau khi sửa, soát lại trang chủ / trang design-system / trang sửa (cả lúc mở bảng nổi):
**0 chỗ** trên tất cả.

## §44 · Bốn bảng còn lại theo cùng một luật

Áp đúng bộ luật đã rút ra ở bảng chữ (§40–42) cho đoạn, nhạc, chỗ nối, tư liệu chèn.

| bảng | số từ trước | sau |
|---|---|---|
| Đoạn | 35 | **8** |
| Nhạc nền | 45 | **8** |
| Tư liệu chèn | 62 | **24** |
| Chỗ nối | 55 | **39** |

**Ba câu bị xoá hẳn, mỗi câu một lý do khác nhau.**

- *"Bấm ✂ trên dải để tách đoạn này làm hai"* — nói về một hành vi KHÔNG CÒN NỮA. Cái kéo giờ
  luôn hiện ở đầu dưới vạch chạy (§39), không phải chọn đoạn mới thấy.
- *"Kéo hai đầu khối trên dải để đổi chỗ nhạc vào và ra"* — chọn nhạc là hai tay nắm hiện ra
  ngay trên dải, tự nó chỉ đường. Câu đi kèm *"bỏ bớt quãng video thì nhạc tự dồn lên"* tả một
  việc chạy đúng mà không cần ai biết.
- *"Đè kín phủ toàn khung; ba dáng còn lại là một hộp thụt 8% mỗi bên, đặt ở 13% chiều cao"* —
  đọc ra một BỨC TRANH bằng lời và bắt nhớ ba con số. Thay bằng bốn ô vẽ đúng hình học ấy
  (lấy từ `OverlayRender`).

**Hai câu chuyển thành lời nhắc CÓ ĐIỀU KIỆN** — cùng cách đã dùng cho cảnh báo dải Giữa:

- *"Nhạc chỉ làm nền — trên 60% là nuốt mất giọng nói"* chỉ hiện khi ĐÃ kịch thang. Mặc định
  là 18%, nên in sẵn thì câu ấy đứng đó cả buổi cho một trần chẳng ai chạm tới.
- *"Đang theo mặc định của dự án"* chỉ hiện khi chưa sửa riêng, và cắt bỏ vế *"đổi ở đây là
  chỉ đổi riêng chỗ này"*: chính cái nút "Dùng cho mọi chỗ nối" ở chân thẻ nói điều đó rõ hơn
  — có một nút riêng để áp cho tất cả, nghĩa là bảng này chỉ áp cho một.

**Mốc giờ lên dòng tiêu đề, độ dài thành huy hiệu.** Trước đây mỗi bảng có một dòng
`0:06 → 0:08 · 2.2 giây` riêng. Gộp lên tiêu đề thì bớt một dòng ở cả bốn bảng mà không mất
chữ nào.

**Chỉ vẽ ô xem trước khi hình vẽ được.** "Dáng khung" vẽ được nên vẽ. Còn "Hiện ra" và năm
kiểu chỗ nối là CHUYỂN ĐỘNG — ảnh tĩnh thì "zoom vào" và "zoom ra" ra cùng một hình.

**Và hai trục chuyển động ấy cũng KHÔNG có icon.** Tôi có thêm một đời — `—` `><` `<>` `⚡`
`○` — rồi phải gỡ. Thêm vì hai hàng kia (Chỗ đặt, Căn ngang) có icon, tức vì ĐỐI XỨNG chứ
không vì chúng nói thêm được gì: `><` với `<>` ở cỡ 14px đọc ra như ký tự bàn phím, `—` cho
"Cắt thẳng" chỉ là một gạch ngang. Mà chúng ăn ~25px mỗi nút, đủ để năm lựa chọn gãy thành
4+1 dòng — dải chọn xuống dòng là mất luôn lợi thế "thấy hết cùng lúc", tức mất lý do dùng
dải chọn.

Luật rút ra: **icon chỉ có chỗ khi khái niệm VẼ RA ĐƯỢC** (trên/giữa/dưới, trái/phải/bậc
thang). Khái niệm về THỜI GIAN thì để chữ nói.

**Trạng thái là HUY HIỆU, không phải một dòng chữ xám nữa.** "Đang theo mặc định của dự án"
từng nằm ngay dưới câu tả kiểu — cùng cỡ, cùng màu, xếp chồng — nên hai thứ khác loại hẳn
nhau (một cái tả KIỂU, một cái là TRẠNG THÁI) đọc ra thành một mảng xám.

**Nhãn trục một–hai chữ.** "Đánh dấu chỗ này thế nào" → `Kiểu`; "Hình dáng khung" →
`Dáng khung`; "Hiện ra thế nào" → `Hiện ra`. Tiêu đề thẻ đã nói đang sửa cái gì, nhãn chỉ cần
gọi tên cái trục — như `Dáng` · `Chỗ đặt` · `Âm lượng` ở các bảng khác.

Soát viền tiêu điểm (§43) trên cả bốn bảng: 0 chỗ bị gọt.

## §45 · Phép thử cho mọi con số bày ra: NÓ ĐỔI QUYẾT ĐỊNH NÀO?

Bảng chỗ nối từng bày `Chỗ nối 0:03.0 → 0:03.7` + huy hiệu `theo mặc định` + huy hiệu
`0.65 giây` + một câu tả kiểu. Chạy phép thử qua từng thứ:

| bày ra | đổi quyết định nào | giữ? |
|---|---|---|
| độ dài `0.65 giây` | thấy dài quá thì kéo ngắn lại | ✓ |
| quãng `0:03.0 → 0:03.7` | không — khối đang chọn đã sáng lên trên dải, con số chỉ xác nhận lại điều mắt vừa thấy | ✗ |
| `theo mặc định` | không — nói về XUẤT XỨ của giá trị, không nói phải làm gì | ✗ |
| câu tả kiểu | có — nó nói cái tên không nói được: nhịp hai nửa dài ngắn ra sao | ✓ |

Áp cùng phép thử, bỏ luôn quãng khỏi tiêu đề của cả bốn bảng. Còn `theo mặc định` thì chính
cái nút "Dùng cho mọi chỗ nối" ở chân thẻ đã hàm ý bảng này chỉ áp cho một chỗ.

**Và thứ THIẾU thì lớn hơn thứ thừa: nút "Xem thử".**

Năm lựa chọn của chỗ nối đều là CHUYỂN ĐỘNG. Bảng tả chúng bằng một câu rồi hết — không có
đường nào nhìn thấy nó chạy. Mà chọn giữa "dồn chậm rồi buông nhanh" và "giật một nhát rồi
trôi ra" thì phải XEM mới quyết được; đọc mô tả chỉ là đoán.

Nút đưa vạch về **trước 0,4 giây** rồi cho chạy — hiệu ứng dài nhất mới 0,65 giây, thả đúng
vào đầu thì mắt chưa kịp bắt nhịp là nó đã chạy xong.

Cờ phát nằm ở `EditorPage` (vòng lặp phát dùng đồng hồ thật, gắn với màn chứ không với dữ
liệu) nên phải truyền xuống qua `RightPanel`. Một tầng trung gian thì chấp nhận được; dời cả
vòng lặp vào `useEditor` chỉ để bớt một prop là đổi một thứ đang chạy đúng lấy một thứ gọn
hơn trên giấy.

Kết quả: Đoạn **6 từ** · Nhạc nền **6** · Tư liệu chèn **19** · Chỗ nối **27**.

## §46 · Đổi một lựa chọn CHUYỂN ĐỘNG thì chạy thử ngay

Bảng chỗ nối từng tả năm kiểu bằng một câu rồi hết. Thêm nút "Xem thử" là đỡ, nhưng vẫn thừa
một cú bấm cho thứ mà người dùng chọn vào là để xem. Nên:

- **Hiệu ứng** — CHỌN vào là chạy, và chạy lại khi đổi kiểu.
- **Chữ trên màn** và **tư liệu chèn** — chỉ chạy khi ĐỔI LỰA CHỌN, không chạy lúc vừa chọn
  vật. Hiệu ứng thì chọn vào là để xem nó động; còn cụm chữ thì phần lớn lần chọn là để SỬA
  CHỮ, tự chạy mỗi lần là phiền.
- **Nhạc nền** — không làm được: bài nhạc chỉ được trộn lúc xuất, khung xem không phát nó.

**Chỉ chạy đúng quãng của nó rồi dừng.** Vòng lặp phát nhận thêm một mốc dừng
(`dungTaiRef`); hiệu ứng dài 0,65 giây mà để chạy tiếp thì người dùng phải tự bấm dừng hoặc
ngồi xem cả đoạn sau. Lùi trước 0,2–0,4 giây để mắt kịp bắt nhịp, và chạy quá 0,3 giây để
thấy nó lắng xuống.

Bấm phát bằng tay thì XOÁ mốc dừng — không thì lần phát sau bị cắt ngang ở chỗ hiệu ứng vừa
xem thử, mà chẳng có gì giải thích.

**Chân thẻ hiệu ứng từng có ba nút, hai trong đó không đáng có.**

- *"Xem thử"* — chọn vào là tự chạy rồi.
- *"Bỏ đánh dấu"* ở chỗ nối — nó ĐÚNG BẰNG việc chọn "Cắt thẳng" ở hàng trên, tức một lối
  thứ hai tới cùng một chỗ. Chỉ hiệu ứng TỰ ĐẶT mới cần nút xoá thật: xoá nó là gỡ hẳn một
  vật, không lựa chọn nào ở hàng trên làm được.
- *"Dùng cho mọi chỗ nối"* — ẨN chứ không làm mờ khi nó chẳng làm gì (kiểu ở đây đã đúng bằng
  mặc định dự án). Một cái nút mờ nằm đó suốt buổi trông như hỏng; hiện ra đúng lúc bấm được
  thì nó tự nói "giờ mới có việc để làm".

Kết quả: chỗ nối trùng mặc định thì chân thẻ TRỐNG HẲN, và huy hiệu độ dài cũng bỏ — muốn
biết dài ngắn thì giờ đã xem được.


## §47 · Ô THUẦN HÌNH thì phải có tooltip — ô có chữ thì không

Luật của dự án ("thứ bấm được mà chỉ có icon, không có chữ, thì cần tooltip") phân biệt rõ
hai loại, và tôi từng áp sai cả hai chiều:

- Hàng "Chỗ đặt" / "Căn ngang" có CHỮ nằm cạnh dấu hiệu → thêm tooltip chỉ là bày một hộp đen
  che mất chính hàng nút đang chọn, để đọc lại đúng cái từ vừa đọc. Đã gỡ (§40).
- Bốn ô "Dáng khung" của tư liệu chèn THUẦN HÌNH — không tên thì không gọi ra thành lời được.
  Thiếu tooltip. Đã thêm.

Bốn ô "Dáng" của chữ thì vốn đã có tooltip từ đầu, cùng lý do.

**Bảng tư liệu chèn bỏ nốt hai thứ** (§45 áp tiếp):

- Huy hiệu độ dài — đổi một lựa chọn là khối tự chạy thử (§46), xem là biết dài ngắn.
- Dòng tên tệp `Ảnh · personal-tracker` — khối trên dải đã mang ẢNH THẬT của nó, và khung xem
  đang chiếu chính nó. Một dòng chữ chỉ lặp lại bằng chữ thứ hai mắt đang nhìn.

Còn **16 từ** cho cả bảng.

## §48 · Ba lỗi vẽ ở dải, cùng một gốc: thứ trong suốt nằm đè lên thứ khác

**1 · Nút `+` để lộ chóp vạch chạy.** Kiểu `default` của hệ hạ nền xuống 80% khi rê chuột
(`hover:bg-primary/80`), mà ngay sau nút là đầu vạch chạy — cái chóp hình thoi nhô lên giữa
nút như một lỗi vẽ.

Chữa hai đường, cả hai đều cần:
- Nền ĐẶC kể cả lúc rê (`hover:bg-primary`).
- **Bỏ hẳn cái chóp.** Nó từng để mắt bắt được mốc giữa mấy trăm ô chữ, nhưng nút `+` (vòng
  tròn đặc 32px) giờ nằm đúng chỗ đó và làm việc ấy tốt hơn — chóp luôn bị che, tức đã thành
  đồ trang trí không ai thấy, chỉ chực lộ ra khi có gì trong suốt.

**2 · Nút kéo lúc khoá để lộ vạch chạy.** `disabled:opacity-50` của hệ làm cả cái nút trong
suốt một nửa, vạch chạy lọt qua thân nút, đọc ra như nút bị gạch ngang. Giữ nền đặc
(`disabled:opacity-100`) và chỉ mờ ICON (`disabled:[&_svg]:opacity-30`): nút vẫn là một vật
liền, chỉ cái kéo nhạt đi để nói "chưa dùng được".

**3 · Tay nắm gọt mép trôi ra ngoài khối.** Đo được: khối `[785 … 1051]`, vạch trái
`[781 … 784]`, vạch phải `[1052 … 1055]` — mỗi bên hở đúng 1px, và vì khối bo góc `rounded-md`
còn vạch thì vuông suốt chiều cao nên ở bốn góc cái khe ấy loe ra trông rộng hơn nhiều. Đọc
ra thành "một khối và hai thanh rời", không thành "một khối có hai mép kéo được".

Đời thứ hai kéo vạch vào trong 2px và thụt 3px trên dưới cho lọt vào đường bo góc. **Vẫn hở**
— phóng to 5 lần mới thấy vì sao: vạch bo tròn CẢ HAI ĐẦU, nên ở góc trên và góc dưới nó cong
tách khỏi mép khối, chừa lại đúng hai cái khe hình lưỡi liềm. Thụt vào để tránh góc bo thì
chính chỗ thụt ấy thành khe.

Đời thứ ba cho vạch chạy suốt chiều cao và bo cùng bán kính với khối. Đo ra khít — `x [784 …
788]` với khối `[785 … 1051]`, `y` trùng đúng `[890 … 934]`. **Vẫn gợn**, và lần này là chỗ
khác: viền quanh khối dày 2px, vạch dày 4px, hai thứ gặp nhau ngay trên đường bo góc nên có
một BẬC chuyển tiếp. Vá tới vá lui vẫn còn một chỗ để lộ.

Cách duy nhất không bao giờ hở là **đừng vẽ một vật rời**. Mép dày phải là BÓNG ĐỔ CỦA CHÍNH
KHỐI:

```
inset-ring-2 inset-ring-primary                       ← viền 2px quanh
shadow-[inset_4px_0_0_0_…, inset_-4px_0_0_0_…]        ← mép 4px hai bên
```

Nhưng đặt bóng đổ lên CHÍNH cái nút thì hỏng chỗ khác: `box-shadow: inset` vẽ trên nền nhưng
DƯỚI nội dung, mà khối tư liệu chèn có một ảnh nhỏ 32px dán sát mép trái — nó che mất đúng
cái mép dày ở đó.

Nên viền đang-chọn là một LỚP PHỦ, con cuối cùng của khối:

```
<span aria-hidden class="pointer-events-none absolute inset-0 rounded-[inherit]
      inset-ring-2 inset-ring-primary
      shadow-[inset_4px_0_0_0_…,inset_-4px_0_0_0_…]" />
```

`inset-0` + `rounded-[inherit]` khiến nó trùng khít khối từng pixel (đo: khối và lớp phủ
cùng `[785, 1051, 890, 934]`, cùng bán kính) và dùng chung bán kính bo — không có chỗ cho khe
lẫn bậc. Là con CUỐI nên vẽ trên cả dải ảnh phim, nhãn, lẫn ảnh nhỏ của tư liệu.

Tay nắm từ đây chỉ còn là VÙNG BẮT CHUỘT, không vẽ gì.

Mép dày đi kèm thuộc tính `trimmable`, không phải cứ `active` là có: cụm lời chép lấy khoảng
của chính cụm từ nó neo vào, kéo ra khỏi cụm thì chữ không còn khớp tiếng nào — vẽ mép dày ở
đó là hứa một việc không làm được. Năm dải có tay nắm (đoạn, nhạc, chữ tự do, tư liệu, hiệu
ứng) truyền `trimmable`; dải lời chép thì không.

Vùng bắt vẫn VẮT QUA mép (7px trong, 7px ngoài), đủ 14px như §5. Kéo mép phải cho
`1,34 → 0,93`.

**Ba đời vá đều thất bại theo cùng một kiểu**: vẽ một vật rời rồi tìm cách ép nó khít với vật
khác — lệch 1px, khe hình lưỡi liềm ở góc bo, rồi bậc giữa 2px và 4px. Hai vật thì luôn còn
một đường ranh; một vật thì không.

**Bài học chung:** một thành phần trong suốt (dù chỉ ở trạng thái hover hay disabled) đặt đè
lên thứ khác thì trạng thái ấy là lúc lỗi lộ ra. Kiểm cả `hover` và `disabled`, không chỉ
trạng thái nghỉ.


## §49 · Bán kính bo của khối trên dải: thang riêng, không dùng thang của thẻ

`--radius` của hệ là 10px và cả thang `--radius-*` suy từ đó — dựng cho thẻ và nút cao 40px
trở lên. Khối trên dải chỉ cao 16–24px, nên `rounded-md` (8px) ở đó bo mất một phần ba chiều
cao: lượn quá, và lúc viền đang-chọn dày lên thì đường cong càng lộ.

Thêm một nấc riêng `--radius-lane: 3px` vào `@theme` (sinh ra lớp `rounded-lane`), dùng cho
mọi khối trên dải. Đặt ở tầng thẻ màu chứ không rắc số ở nơi gọi — đổi một lần là cả dải đổi
theo.

Sau khi đổi: `clip` `insert` `music` `junction` đều `3px`, `text` (vẽ đè lên phim) `3px 3px 0
0` — vẫn giữ hai góc dưới vuông để dính vào dải phim bên dưới.

## §50 · Bảng thả xuống rộng theo NỘI DUNG, không theo nút mở nó

`DropdownMenuContent` từng có `w-(--anchor-width)` — ép bảng rộng đúng bằng nút mở. Hợp lý
khi nút mở là một ô chọn dài (đó là lối của `Select`), nhưng sai hẳn khi nút mở là một icon:
bảng co xuống `min-w-32` (128px) và mọi mục dài hơn thế đều gãy dòng.

Lỗi này đã lộ ra hai lần: bảng `+` trên vạch chạy ("Thêm hiệu ứng" gãy làm hai) và bảng ⋮ của
ô tư liệu ("Chuyển sang tư liệu chèn" gãy làm hai). Lần đầu tôi vá bằng `className="w-44"`
tại chỗ gọi — vá đúng một chỗ, để nguyên cái gốc cho nó nổ lại ở chỗ thứ hai.

Sửa ở tầng thành phần: `w-auto min-w-[max(8rem,var(--anchor-width))]` — rộng theo nội dung,
chỉ lấy bề rộng nút mở làm mức TỐI THIỂU. Bỏ luôn bản vá `w-44`.

`Select` và `Combobox` có tệp riêng và vẫn giữ `w-(--anchor-width)`: ở đó bảng rộng bằng ô
chọn mới đúng.

Đo sau khi sửa: bảng `+` rộng 160px, bốn mục đều một dòng; bảng tám mục ở trang design-system
rộng 188px, không mục nào gãy dòng.

## §51 · Mốc từ của máy chép lời CẮT SỚM — đo bằng chính sóng âm

Bấm "Bỏ khoảng lặng" xong nghe ra một tiếng cụt. Không phải ảo giác, đo được:

Lấy bản tiếng của một video 66 giây, tính mức hiệu dụng từng ô 10ms, rồi hỏi "sau mốc kết
thúc câu mà máy chép lời báo, còn bao lâu nữa mới hết tiếng":

```
đuôi tiếng vượt quá mốc:  trung vị 70ms · p90 160ms · dài nhất 380ms
```

Nghĩa là quãng mà bảng Lời gọi là "im lặng" thật ra đang ôm cả đuôi từ cuối câu. Bỏ nó là
chặt ngang một tiếng đang tắt dần. Xuất thử rồi đo lại bản ra: mức rơi thẳng từ **−28dB
xuống −62dB trong một ô 10ms** — vừa mất đuôi từ, vừa tạo một bước nhảy nghe ra như tiếng bụp.

**Ba chỗ sửa, cùng một gốc là "đọc âm thật thay vì tin mốc chữ":**

1. `server/audio-envelope.ts` đo đường bao âm lượng một lần ngay sau khi tách tiếng — mỗi ô
   20ms, mức 0–1, kèm ngưỡng "có ai đang nói" lấy từ nền ồn nhân bốn.
2. `segment-seed.ts` nới mép mỗi cụm lời ra tới chỗ tiếng thật tắt (xa nhất 0,4 giây — phủ
   được cái đuôi dài nhất đo được). Quãng lặng vì thế chỉ còn đúng phần không ai nói.
3. `render.ts` vuốt 8ms hai đầu mỗi mẩu tiếng trước khi nối. Ngắn hơn một khung hình nên
   không ai nghe ra là đã vuốt, mà bước nhảy thì biến mất.

Đo lại sau khi sửa, cùng một chỗ cắt: đuôi tiếng còn nguyên tới −35,9dB rồi mới cắt ở
−42dB — tức là cắt vào chỗ đã im. Trên toàn video, số quãng "không có từ nào mà vẫn còn
tiếng" giảm từ **10/15 xuống 7/23**, và bảy quãng còn lại đều ngắn dưới 0,25 giây nên không
bao giờ hiện thành một dòng im lặng bấm được.

Bảy quãng ấy là **tiếng nói mà máy chép lời bỏ sót** — không mốc chữ nào chỉ ra được chúng.
Đó là lý do phải có dải sóng.

## §52 · Dải sóng âm: lớp duy nhất trả lời "chỗ này có ai nói không"

Đặc tả §12 đã gỡ dải TỪ vì nó bày lại thứ bảng Lời đã nói. Dải sóng thì ngược lại — nó nói
đúng thứ **không chỗ nào khác nói được**: mốc chữ đóng sớm (§51), nên nhìn bảng Lời mà cắt là
cắt mù.

· Nằm TRONG khối phim, là tầng đáy cao 16px của chính khối ấy — xem §60. (Đời đầu vẽ thành
  một dải riêng ngay dưới dải phim; hai vật cho một thứ.)
· Không chọn được, không kéo được: nó nói về chính đoạn phim ngay trên nó, không phải một
  lớp thứ năm.
· Vẽ theo GIỜ XUẤT RA như mọi lớp khác — chỗ đã bỏ không để lại vệt nào.
· Mỗi cột lấy ĐỈNH của khoảng nó gộp, không lấy trung bình: trung bình làm phẳng mọi tiếng
  bật và dải sóng chỉ còn là một cái gò.
· Cột dưới ngưỡng nói thì nhạt hẳn — đó chính là chỗ cắt được mà không mất tiếng ai.

## §53 · Một cái tên nước ngoài bị nghe thành hai cụm thì phải GỘP được

Máy chép lời cắt cụm theo nhịp nói, nên "TensorLab" ra "Tenso" rồi "Lab" — và hai tiếng ấy
rơi vào HAI cụm chữ khác nhau. Sửa từng cụm không bao giờ ghép được: cụm trước thành
"…tên là TensorLab", cụm sau vẫn còn một chữ "Lab" trơ ra trên màn.

Lối duy nhất trước đây là sửa cụm trước rồi XOÁ cụm sau — hai thao tác cho một ý, mà người
dùng phải tự nghĩ ra. Nay bảng sửa chữ có **Gộp với cụm sau**: cụm này nới mép cuối tới hết
cụm sau, nội dung nối lại, cụm sau biến mất. Lời chép bên dưới không đụng tới — nó vẫn là
thứ người ta đã nói.

Kèm theo một cái bẫy đã sập: ô nhập nội dung khoá theo `element.id`, mà gộp thì mã giữ
nguyên còn nội dung đổi — `defaultValue` chỉ đọc một lần lúc dựng nên ô ở lại với lời cũ, và
cú rời ô sau đó ghi đè lời cũ ấy lên bản vừa gộp. Khoá phải gồm cả MÉP CUỐI của cụm.

## §54 · Tên dự án sửa được, ngay tại chỗ nó hiện ra

**Đầu trang bàn dựng giữ đúng ba thứ: TÊN · đường ra · nút Xuất.** Dòng số liệu
`1:02 · 52 chữ · 232 từ · đã bỏ 5 chỗ` từng đứng cạnh nút Xuất đã gỡ — bốn con số cho một
câu hỏi không ai hỏi lúc đang dựng, mà chúng lại đứng ngay cạnh hành động nặng nhất của cả
màn. Nút `Trở về` cũng bỏ icon: chữ đã nói đủ, mũi tên chỉ thêm một vật nữa để mắt phải bỏ
qua.

Máy chủ nhận `title` lúc tạo nhưng chưa từng có cửa nào sửa, mà màn nạp tệp đặt cứng "Dự án
mới" — nên mọi dự án mãi mãi cùng một tên và danh sách thành mười ô không phân biệt được.

Cửa sửa nằm đúng nơi cái tên hiện ra: nút bánh răng cạnh tiêu đề bàn dựng, bấm ra một hộp
thoại. Không đẩy vào một trang cài đặt nào khác — cái tên chỉ có một chỗ, thì chỗ sửa cũng
phải ở đó.

**Hộp thoại, không phải ô nhập ngay tại chỗ.** Đổi tên là việc làm một lần rồi quay lại dựng,
không phải vòng lặp sửa-xem-lại (§8 chỉ cấm modal cho vòng lặp đó). Đổi tại chỗ thì đầu trang
phải nhường chỗ cho một ô nhập và cả hàng nhảy một nấc mỗi lần bấm sửa.

· Nút **mờ sẵn chứ không ẩn hẳn**: ẩn thì không ai biết cái tên sửa được, mà đây đúng là thứ
  người dùng phải biết.
· Mở ra là chữ cũ được bôi đen sẵn: đổi tên gần như luôn là VIẾT LẠI.
· `Enter` hoặc **Lưu** thì ghi, `Esc` / **Huỷ** thì bỏ.
· Tên rỗng thì để MÁY CHỦ quyết (nó trả về "Dự án mới"); hai nơi cùng đặt một giá trị mặc
  định là hai chỗ để chúng lệch nhau.

Đầu thẻ là lưới hai cột (tên | hành động) nên tên và nút phải nằm trong MỘT phần tử — thả
thêm một cái nút vào lưới đó là góc hành động bị đẩy xuống hàng.

**Bôi đen ở `onFocus`, không ở `ref`.** Ô nhập có kiểm soát nên mỗi ký tự gõ vào là một lần
dựng lại, mà hàm `ref` chạy theo mỗi lần dựng — chữ vừa gõ lại bị bôi đen và ký tự sau xoá
sạch nó. Gõ "Sinh nhật 29" ra đúng một chữ "9".

## §55 · Bản vá chiều cao sống lâu hơn cái nó vá

Thẻ "Sẽ không vào video" bày danh sách chỗ đã cắt trong một vùng cuộn cao 192px
(`lg:max-h-48`), trong khi cả thẻ cao gần một nghìn pixel: hai dòng rưỡi hiện ra, còn ba phần
tư thẻ để trống. Đọc ra như một khối bị hỏng, chứ không như một danh sách cuộn được.

Con số ấy là bản vá đúng cho một bố cục KHÁC — hồi cột phải còn là hàng `auto` của lưới, thẻ
tự phình theo nội dung và tràn khỏi cột, nên phải chặn cao thì vùng cuộn mới có việc làm. Từ
khi cột phải thành một ô lưới cao đúng bằng hai cột kia, `min-h-0 flex-1` đã đủ, và cái chặn
kia chỉ còn cắt.

Luật: **bản vá chiều cao phải đi cùng lý do của nó.** Đổi bố cục thì rà lại mọi `max-h-*` đã
đặt vì bố cục cũ — chúng không tự hỏng, chúng chỉ lặng lẽ cắt mất chỗ.

Đo sau khi gỡ: màn 900px — thẻ dùng hết chiều cao, 6 mục hiện, cuộn tiếp; màn 720px — thẻ
360px, vùng cuộn 260px, nội dung 530px, cuộn được và không tràn.

## §56 · Danh sách chỗ đã cắt: một dòng một chỗ, và cả dòng là nút

> **Đã gỡ hẳn — xem §59.** Giữ lại phần dưới vì bốn nhát cắt ở đây dùng được cho mọi danh
> sách khác, và vì nó ghi lại đúng con đường dẫn tới quyết định gỡ.

Bản trước cho mỗi chỗ cắt **hai dòng chữ và hai nút chữ**: khoảng giờ ở dòng trên, nhãn ở
dòng dưới, rồi `Xem` và `Trả lại` bên phải. Năm chỗ cắt thành mười dòng và **mười chữ lặp lại
y hệt** — số chữ lặp còn nhiều hơn số chữ nói được điều gì.

Bốn nhát cắt, theo đúng thứ tự ăn thua:

1. **`Xem` biến mất, cả dòng thành nút.** Đây cũng là nếp của hàng soát ngay cạnh — bấm một
   mục là nhảy tới chỗ đó. Bỏ được năm chữ mà không mất việc nào.
2. **`Trả lại` thành một nút hình** (`Undo2`), tự có tooltip từ nhãn của nó (§47), và chỉ
   hiện khi tay tới gần dòng — như nút xoá trên ô dự án.
3. **Gộp hai dòng làm một.** Mốc giờ đứng trước (nhỏ, mờ, số đều), nhãn đứng sau. Hàng cao
   46px thay vì 76px.
4. **Bỏ mốc KẾT THÚC.** Nó thêm sáu ký tự cho mỗi dòng mà gần như luôn trùng con số đầu — chỗ
   cắt hay ngắn hơn một giây — nên đọc ra thành `0:37–0:37`, một khoảng rỗng. Muốn biết dài
   bao nhiêu thì bấm nghe.

**Và gộp những chỗ cắt DÍNH NHAU.** Bỏ một dòng chữ tạo ra hai đoạn liền nhau (máy chủ tách
ở hai đầu rồi đánh dấu khúc giữa), nên danh sách bày hai dòng cùng mốc giờ và cùng một câu.
Với người dùng đó là MỘT chỗ bị bỏ. Trả lại thì trả cả cụm — gộp trên màn mà chỉ trả một nửa
là để lại một khúc cụt không ai hiểu.

Huy hiệu đếm theo thứ NGƯỜI DÙNG THẤY, không theo số hàng trong cơ sở dữ liệu: "7 chỗ" trong
khi danh sách bày sáu dòng là tự mâu thuẫn.

## §57 · Một quãng lặng, MỘT cách gọi — và nhãn nói cái gì mất, không nói mất cách nào

Cùng một thứ đang được viết ba kiểu ở ba chỗ:

```
bảng Lời          (im lặng 1.5s)
nhãn đoạn trên dải  lặng 0.6 giây
danh sách đã cắt    lặng 0.6 giây · mép đã gọt
```

Hai cách gọi, hai cách viết số, và người dùng phải tự đoán ra chúng là một. Nay cả ba đọc từ
`nhanImLang()`: **`im lặng 1,5s`**. Dấu phẩy thập phân vì đây là tiếng Việt; `s` chứ không
`giây` vì nhãn này còn phải nằm vừa một khối hẹp trên dải.

**"Mép đã gọt" đã bỏ.** Đó là tên mượn từ mã nguồn — người dùng không gọi việc mình vừa làm
là "gọt mép", và cái tên ấy không cho biết họ vừa bỏ mất thứ gì. Cách bỏ là chuyện của bàn
dựng; thứ người ta cần nhận ra là LỜI đã mất, hay một quãng không ai nói.

Nên mọi chỗ cắt đọc chung một luật, bất kể nó sinh ra từ đâu: **có từ nào nằm trong đó thì
lấy chính lời ấy, không có thì đó là một quãng im lặng.**

**Nút trả lại hiện SẴN, chỉ mờ đi.** Ẩn hẳn tới lúc rê chuột thì người dùng nhìn danh sách và
hỏi "làm sao bỏ mấy cái này?" — đúng câu đã nhận được. Đây là hành động duy nhất của mỗi
dòng; giấu nó là giấu mất lý do danh sách này tồn tại.

## §58 · Mép cụm lời và mép ĐOẠN không còn trùng nhau — và một nút im lặng không làm gì

Từ khi đoạn được nới ra tới chỗ tiếng thật tắt (§51), mốc của một cụm lời (dừng ở mốc TỪ)
lệch với mép đoạn chứa nó. Bấm "Bỏ khoảng này" ở cụm cuối một câu thì `removeRange` tách tại
mốc từ, mẩu dư chỉ 0,08 giây — ngắn hơn `MIN_LENGTH` nên `splitAt` từ chối tách. Đoạn ở lại
nguyên vẹn, và vì nó không nằm TRỌN trong khoảng nên chẳng ai đánh dấu nó.

Kết quả: **bấm mà không có gì bị bỏ, cũng không có lời nào báo.** Máy chủ trả 200, màn hình
không đổi, người dùng bấm lại lần nữa. Đây là kiểu hỏng tệ nhất — im lặng.

Chữa ở máy chủ: lấy đoạn nào **phần lớn** nằm trong khoảng (giao ≥ 60% độ dài đoạn), không
đòi nằm trọn. Cùng một ý với luật "không đặt mốc cắt vào giữa một chữ" — chỗ nào lệch vài
chục ms thì theo cái lớn hơn, đừng bỏ rơi nó.

Luật rút ra: **đổi mốc ở một tầng thì rà lại mọi phép so mốc ở tầng khác.** Nới mép đoạn là
một cải tiến đúng, nhưng nó phá vỡ giả định "cụm lời nằm trọn trong đoạn" mà ba chỗ khác
đang dựa vào.

## §59 · Và rồi gỡ hẳn danh sách ấy đi

Sau khi dòng đã bỏ được trả về đúng chỗ của nó trong bảng Lời (§6, bản mới) — gạch ngang, có
nút trả lại ngay trên dòng, kể cả dòng `(im lặng)` — thì danh sách "Sẽ không vào video" bày
lại **đúng những thứ bảng Lời vừa nói**. Đây chính là lỗi đã dùng để gỡ dải TỪ ở §12: ba nơi
cho cùng một chuyện.

Câu hỏi của người dùng nói thẳng ra điều đó: *"vậy tức cái list này cứ nằm ở đây suốt hả?"*
Nó chiếm trọn một phần ba màn hình suốt buổi dựng, cho một thứ không bao giờ "xong".

Nên cột phải trở lại đúng vai của nó: **chỗ của thứ ĐANG CHỌN**, và khi chưa chọn gì thì nói
"Chưa chọn gì" kèm lời mách. Không lấp chỗ trống bằng một danh sách.

Mất hai thứ, và cả hai đều chấp nhận được:
· **Nghe thử mối nối** — vẫn nghe được bằng cách đưa vạch tới đó rồi phát; đây không phải
  việc làm mỗi phút.
· **Danh sách chỗ gọt mép** — nó vốn đã hiện trên dải thành khoảng hở giữa hai khối, và
  hoàn tác được bằng nút Hoàn tác.

Luật rút ra: **một cái bảng "để lấp chỗ trống" là một cái bảng chưa có lý do tồn tại.** Trạng
thái rỗng là một trạng thái hợp lệ, không phải chỗ đợi nhét thêm gì vào.

## §60 · Chữ · hình · sóng là MỘT khối, không phải ba dải

Ba thứ ấy luôn đi cùng nhau vì chúng nói về cùng một đoạn: chữ chạy theo lời của đoạn, sóng
là tiếng của chính đoạn. Xếp chúng thành ba dải rời là bắt mắt ghép lại ba lần cho mỗi lần
nhìn, và ăn thêm hai khoảng hở giữa các dải.

Nay một khối = **chữ đè trên · khung hình 44px · sóng 16px ở đáy**, chung một đường bo, chung
một viền đang-chọn. Đây cũng là lối CapCut vẽ (tên tệp trên, hình giữa, sóng dưới) — và nó
đúng vì cùng một lý do, không phải vì họ làm thế.

**Chữ vẫn phải vẽ ĐÈ, không nhập vào khối.** Một cụm chữ có thể vắt qua hai ba đoạn (§12), nên
nó không thuộc về khối nào cả; nhập nó vào khối là phải chẻ nó ra theo ranh giới đoạn — đúng
thứ §12 đã cấm. Đè lên đỉnh thì một cụm trải ba đoạn vẫn là một băng liền vắt qua ba khối.

**Khung hình 56px, không phải 44.** Dải chữ đè lên 16px trên cùng, nên ở 44 thì khung hình chỉ
còn 28px nhìn thấy — chữ che quá nửa và không còn nhận ra cảnh nào. Ảnh sprite máy chủ dựng ở
88px (2× của 44) nên vẽ ở 56 vẫn dưới cỡ gốc, không lên hạt.

**Sóng mọc từ ĐÁY, cao theo CĂN BẬC HAI của mức.** Dải chỉ cao 16px: căn giữa thì mỗi bên còn
8px và mọi tiếng to nhỏ đều bẹp như nhau. Còn vẽ thẳng theo mức thì vì mức đã chuẩn hoá theo
đỉnh của cả bản — trung vị chỉ 0,095 — quá nửa số cột cao chưa tới 2px, cả dải thành một vạch.
Căn bậc hai kéo khoảng giữa lên (0,095 → 31%) mà vẫn giữ đúng thứ tự to nhỏ; tai người cũng
nghe độ to theo lối nén như vậy.

Nền sóng ĐẶC (`bg-muted`), cột `fill-foreground/60`: nó nằm trên một khối đầy hình, nền nửa
trong suốt thì lúc rõ lúc chìm tuỳ khung hình bên dưới sáng hay tối — mà đó đúng là lỗi vẽ đã
phải gỡ ba lần ở §48. Cùng công thức cho ra sóng sáng trên nền tối khi máy để chế độ tối.

Đo sau khi gộp: khối cao 72px (56 + 16) thay vì 44 + 8 (hở) + 20 = 72px của ba dải rời — cùng
chiều cao, nhưng khung hình to hơn 12px và không còn khoảng hở nào ở giữa.

## §61 · Khối phim mang SẮC CHỦ ĐẠO — nền nhạt, chữ và sóng đậm

Từ khi ba tầng gộp thành một khối (§60), chúng phải đọc ra là MỘT vật. Chữ nền vàng cạnh sóng
nền xám thì mắt lại tách chúng ra làm hai — nên cả hai tầng có nền đều mang chung một sắc.

Đã thử bản **nền đặc màu chủ đạo, chữ trắng** (đúng lối CapCut) và bỏ: trên một dải mà mắt
lướt qua hàng trăm lần một buổi, một khối như thế nặng ngang cái nút Xuất video. Giữ đúng nếp
của mọi dải khác — **nền nhạt, chữ đậm cùng sắc** — chỉ đổi sắc từ vàng sang tím.

Đổi ở TOKEN `--lane-text` trong `src/index.css`, không đặt màu tại chỗ gọi — dải sóng cũng đọc
từ chính token đó (`bg-lane-text`, `fill-lane-text-foreground`), nên hai tầng không bao giờ
lệch màu nhau.

Sóng lấy `lane-text-foreground` chứ KHÔNG lấy `foreground` của trang: nền dưới nó là một mảng
đặc màu, mà `foreground` đổi theo nền TRANG — ở chế độ sáng nó ra đen trên nền tím, đọc như
một vết bẩn.

**Nền phải cách xa màu viền đang-chọn.** Bản nền đặc đặt `--lane-text` sát `--primary` thì
viền `inset-ring-primary` của khối đang chọn chìm hẳn vào nền chữ và nền sóng — chỉ còn đoạn
viền chạy qua khung hình là thấy. Nền nhạt không có vấn đề đó: viền tím đậm nổi rõ trên cả
nền chữ, nền sóng lẫn khung hình.

**Cột sóng hở 40% bề rộng ô, mỗi ô 3px.** Kín quá thì cả dải thành một mảng đặc, mà thứ cần
đọc là NHỊP — chỗ nào dày, chỗ nào thưa. Số cột đi theo bề rộng thật của khối nên phóng to
dải là sóng mịn ra theo; trần 2000 cột chỉ để một đoạn dài ở mức phóng lớn nhất không đẻ ra
hàng vạn thẻ.

## §62 · "Đang theo mặc định" không nói bằng đậm nhạt — không nói bằng gì cả

Chỗ nối chưa ai sửa riêng thì đang chạy theo mặc định của dự án; đổi mặc định là nó đổi theo,
còn cái đã sửa tay thì đứng yên. Ý đúng. Nhưng ba đời liền tôi cố nói điều đó bằng thị giác,
và cả ba đều hỏng theo cùng một kiểu:

1. **Mờ cả khối** (`opacity-45`) — trong hệ này mờ nghĩa là KHOÁ, nên một chỗ nối bình thường
   đọc ra như khối hỏng.
2. **Nhạt riêng phần nền** — hai khối cùng loại nằm trên một dải mà đậm nhạt khác nhau thì mắt
   vẫn đọc ra "cái kia bị sao đó".

Câu hỏi nhận được cả hai lần đều là *"sao cái này mờ hơn"* — chưa lần nào là "à, cái này chưa
chỉnh riêng".

Nay **mọi chỗ nối vẽ y như nhau**. Áp phép thử §45: sự khác nhau ấy có đổi được quyết định nào
lúc đang lướt dải không? Không. Muốn biết một chỗ nối theo mặc định hay đã chốt thì rê vào
(tooltip nói) hoặc bấm vào (bảng sửa nói) — hai chỗ đó nói bằng CHỮ, không ai phải đoán.

Kèm một chỗ lệch lòi ra khi soi: chữ của tông chỗ nối để `0.42` trong khi ba tông kia
`0.38–0.40`, mà sắc đỏ cam ở độ sáng ấy còn trông nhạt thêm một nấc — nên ngay cả khối ĐÃ sửa
tay cũng đọc ra nhợt hơn hàng xóm. Hạ về `0.38`, nâng độ tươi lên `0.12`.
