# Lưu bộ dáng · Giao diện · Nhạc · Nhịp · Ba giây đầu

**Ngày:** 2026-07-31 · **Phase:** 5 · 6 · 7 · 8 · 9 · 10 · **Trạng thái:** xong

## Phase 5 — Lưu bộ dáng trên dự án

Cột `projects.style_pack TEXT DEFAULT 'goc'`, vá cột dần như mọi cột khác. Dự án
cũ ra đúng như trước, không cần migration riêng.

**`readStylePack` là cổng DUY NHẤT chịu trách nhiệm rơi-về-mặc-định**
(`server/style-pack-store.ts`). Dự án không tồn tại, cột chưa vá, hay tên rác
trong CSDL — cả ba đều trả bộ gốc. Thà ra dáng mặc định còn hơn dừng cả mạch vì
một chuỗi lạ.

**Bất biến của cả nhánh:** `defaults` đọc lúc **SINH** chữ
(`caption-elements.ts`), phần vẽ đọc lúc **RENDER** (`render.ts`). Hai thời điểm
khác nhau, và đó chính là lý do đổi bộ dáng chỉ đổi được phần vẽ.

API: `PATCH /api/projects/:id` nhận `stylePack`; tên không có trong danh sách trả
**400** chứ không nhận rồi lặng lẽ rơi về mặc định — nhận rồi rơi thì màn chọn
báo "đã lưu" trong khi CSDL giữ một thứ khác. Route đi qua `auth-guard` theo mẫu
`/api/projects/:id` sẵn có, `npm run check:ownership` 24/24 đạt.

`/api/layout` nhận thêm `projectId` để khung xem trước đo bằng đúng bộ dáng của
dự án đang mở.

### Phép kiểm mới: `npm run check:style-pack`

25 phép, chạy trên CSDL tạm. Kiểm đúng thứ **sai mà không có lỗi nào hiện ra**:

- luật rơi về mặc định (6 phép: cột rỗng, tên rác, dự án không tồn tại…)
- **`defaults` giống hệt nhau ở cả 5 bộ** — đây là bất biến làm cho việc đổi bộ
  dáng không đụng bảng `elements`
- mỗi cặp bộ dáng khác nhau ≥ 2 trục nhìn thấy được (10 cặp, thấp nhất 4 trục)
- `maxScale` trong [0.11, 0.16] và `lineHeight` trong [1.0, 1.4]

## Phase 6 — Chọn dáng ở màn chờ

`src/routes/pipeline/style-picker-card.tsx` + `style-preview-tile.tsx`, đặt ở cột
phải `/pipeline/:projectId`, **dưới** danh sách chặng.

- Ô mẫu dùng lại `OverlayTextBlock` — cùng bộ máy với `/_dev/overlays` và với
  khung xem trong bàn dựng. Một bộ vẽ thứ hai chỉ dành cho ô mẫu là một bản để lệch.
- Chữ trong ô là **lời thật của người dùng**: bảy tiếng đầu từ bảng `words` (lấy
  từ `words` chứ không từ `elements` — chặng `captions` chạy **sau** `transcribe`,
  nên lúc đang chọn thì chưa có phần tử chữ nào). Chưa có lời thì chạy chữ ví dụ.
- Chọn là **ghi ngay**, không có nút xác nhận: thao tác rẻ và đảo ngược được, mà
  một nút xác nhận biến thẻ này thành việc phải làm cho xong.
- **Câu "Không chọn cũng được — máy đang dùng …"** là phần quan trọng nhất của
  thẻ. Không có nó thì năm ô đọc ra như một bước bắt buộc, và cả màn đang hứa
  *"cứ làm việc khác đi"*.
- **Chi phí:** `useRevealLoop(active)` chỉ đăng ký nghe khi có ô đang được ngó.
  Năm ô vẽ lại ở 60 khung/giây trong lúc ffmpeg chạy nền là tranh CPU với đúng
  việc người dùng đang chờ.

Đo bố cục ở 460px / 380px / 300px bằng `scripts/ui-preview/` — thẻ cao ≈200px ở
bề rộng thật của cột phải, không xô layout khi trang tự hỏi lại.

## Phase 7 — Đổi dáng trong bàn dựng

`CardHeader` mới trên thẻ khung xem (`preview-panel.tsx`): `Dáng: <tên>` bên
trái, nút **Đổi dáng** trong `CardAction` bên phải. `CardHeader` tự thành lưới
hai cột khi có `CardAction`, nên thẻ chỉ cao thêm một hàng tiêu đề.

`style-switch-dialog.tsx`: khung xem lớn vẽ **cụm tại vạch hiện tại** (ngữ cảnh
đi theo người dùng vào Dialog) + lưới 5 ô. Bấm ô là đổi tạm, chưa ghi; Esc hoặc
"Thôi" bỏ hẳn.

**Không có phép đếm "đổi 47 cụm · giữ 6 cụm bạn đã sửa"** — `defaults` giống hệt
nhau ở cả 5 bộ nên đổi bộ dáng không đụng bảng `elements`. Nếu thấy mình đang
định viết câu đó thì chỗ phải sửa là `style-pack-catalog.ts`, không phải Dialog.

Bộ dáng nay chảy tới **mọi chỗ vẽ chữ**: khung xem trong bàn dựng, ô mẫu chọn
dáng ở Inspector, và phép đo `/api/layout` mà hàng soát dùng.

## Phase 8 — Vốn từ cho nhạc

### Ba trục, giá trị đóng (`server/music-tags.ts`)

| Trục | Giá trị | Phân bố trên 55 bài |
|---|---|---|
| năng lượng | `manh` · `vua` · `em` | 5 · 23 · 27 |
| độ dày | `day` · `thua` | 28 · 27 |
| lời | `co-loi` · `khong-loi` | 0 · 55 |

Cột `tags` tự do giữ nguyên cho phần MÔ TẢ ("chiptune", "buồn") — đó là thứ người
đọc; ba trục này là thứ máy lọc.

### Gán nhãn: đo được, và LẶP LẠI được

Gán 55 bài bằng tai là một buổi, và một buổi ấy **không lặp lại được** — thả thêm
ba mươi bài vào thư mục là lại một buổi nữa, do người khác gán, với ba trục thành
ba mươi cách hiểu. Nên mỗi trục lấy bằng chứng ở chỗ nó đáng tin nhất:

- **năng lượng** ← nhãn của người soạn kho (`kho.json`: "dồn dập", "ru êm"), rơi
  về phép đo độ sáng phổ khi bài không có nhãn nào.
- **độ dày** ← đo `rolloff` bằng `aspectralstats` của ffmpeg. Không ai gắn nhãn
  dày/thưa bằng tai một cách nhất quán qua 55 bài.
- **có lời** ← **chạy chính whisper đã có sẵn lên từng bài.** Không đo bằng phổ:
  giọng hát và nhạc cụ chồng lên nhau trong cùng dải tần, nên mọi phép đo phổ
  chỉ nói được "có thứ gì đó ở dải giữa" — mà cây guitar cũng vậy.

Kết quả trục "có lời": **cả 55 bài đều không lời.** Thứ whisper trả về là hai câu
bịa quen mặt ("Hãy subscribe cho kênh Ghiền Mì Gõ…") — đúng thứ ba điều kiện của
`LOOKS_SUNG` loại bỏ (`no_speech_prob` ≤ 0,5 · ≥ 25 từ sau khi lọc câu bịa · ≥ 5
đoạn). Kết quả này khớp với việc kho là nhạc CC0 lo-fi/chiptune.

Bằng chứng máy đọc được: `reports/music-tags/features.json` · `vocals.json`.

### Thiên lệch của bộ dáng, đo trên kho thật

| Bộ dáng | `musicBias` | Số bài lọt |
|---|---|---|
| Gạch mộc | không lọc | 55 |
| Chữ hoa vàng | `manh\|vua` + `day` | 22 |
| Nhấn xanh | `vua` + `day` | 17 |
| Nét thưa | `em` + `thua` | 21 |
| Đứng yên | `em\|vua` + `thua` | 27 |

**Chữ hoa vàng ↔ Nét thưa dùng chung 0 bài** — thiên lệch thật sự tách ra hai tập
nhạc, không phải một nhãn trang trí.

Bản nháp ban đầu để Chữ hoa vàng là `manh` một mình → chỉ còn **5 bài**, tức mọi
video dùng bộ đó đều rút từ đúng năm bài. Đó chính là thứ cả kế hoạch đang chống,
nên nới sang `manh|vua`.

**Hai luật an toàn:** bài **chưa gán nhãn luôn lọt qua** (thư mục là nguồn sự
thật, bài mới thả vào chưa có hàng nào ở bảng); lọc xong mà **rỗng thì rơi về cả
kho** — thà một bài hơi chỏi tông còn hơn video không có nhạc.

`ai-music.ts` lọc **trước** khi hỏi mô hình: mô hình biết nội dung video còn nhãn
thì không, nên nó vẫn là bên chọn, chỉ là chọn trong tập đã lọc.

Kho nhạc bày nhãn ở dòng mô tả và tìm được bằng chính ô tìm đang có ("mạnh",
"êm", "dày") — không thêm hàng nút lọc thứ hai cho cùng một việc.

## Phase 9 — Kiểu hiện tư liệu và nhịp

### Hai kiểu hiện mới

Ba kiểu cũ (`none`, `fade`, `fade-up`) đều là biến thể của **mờ dần** — đổi kiểu
mà video vẫn đọc ra như nhau. Thêm:

- **`slide` · Trượt vào** — rõ ngay từ đầu, đi vào từ mép trái. Thứ đọc được là
  CHUYỂN ĐỘNG, nên cố ý **không** kèm mờ; kèm vào là nó lẫn với `fade-up`.
- **`pop` · Giữ rồi bật** — đứng ngoài suốt 0,25 giây rồi vào trong 0,08 giây.
  Chính quãng đứng im làm cú bật đọc ra như một nhịp.

Một khai báo cho cả hai đường vẽ: `server/insert-reveal.ts` giữ hằng số + hàm
`revealCss`, `overlay-model.ts` re-export. Trước đây ba chỗ chép nhau bằng tay
(`render.ts`, `overlay-model.ts`, `insert-card.tsx`) — thêm một kiểu là phải nhớ
sửa ba chỗ, mà chỗ quên sẽ **im lặng vẽ ra kiểu cũ**.

**Bảng sửa đổi từ dải nút sang hộp chọn.** Năm nhãn không nằm vừa một hàng ở cột
Inspector, mà ghi chú ở đầu `inspector-panel.tsx` đã nói rõ: dải chọn xuống dòng
là mất hẳn lợi thế "thấy hết cùng lúc".

### Nhịp thành con số

```
rhythm { junctionShare, brollEverySec, brollHoldSec }
effectBias { junction[], insertReveal[] }
```

| Bộ dáng | chỗ nối được đánh dấu | b-roll |
|---|---|---|
| Gạch mộc | 50% | 12s một lần |
| Chữ hoa vàng | **80%** | **7s** |
| Nhấn xanh | 60% | 10s |
| Nét thưa | **25%** | **18s** |
| Đứng yên | 35% | 15s |

Đây mới là thứ tách "nhanh" khỏi "êm". Một bộ chỉ nhặt `flash` + `zoom-in` mà vẫn
đặt 3 giây một cái thì không nhanh — nó chỉ chói.

`ai-effects` và `ai-broll-place` đọc cả hai. Thiên lệch là **ưu tiên, không phải
hàng rào**: lời nhắc cho mô hình nói rõ *"ưu tiên khi hai lựa chọn ngang nhau,
đừng ép nếu mạch chuyển đòi kiểu khác"*, và bảng sửa vẫn bày đủ mọi kiểu.

### Đổi bộ dáng KHÔNG tự đặt lại hiệu ứng

Cột `projects.effects_style_pack` ghi bộ dáng đang dùng lúc chặng hiệu ứng chạy
lần cuối. Khác bộ dáng hiện tại → hàng soát hiện **một dòng mời**, có đúng một
câu trả lời: bấm là chạy lại chặng `effects` theo nhịp mới, bỏ qua là dòng biến
mất hẳn.

Không tự đặt lại vì hiệu ứng và tư liệu chèn là những vật **nằm trên dải** —
người dùng nhìn thấy chúng và có thể đã sắp lại bằng tay.

## Phase 10 — Ba giây đầu

Một dòng trong hàng "Cần bạn xem", **không đẻ màn mới**.

**Chỉ hiện khi có dấu hiệu rào đón**: quãng im trước lời thật (> 0,35 giây), hoặc
ba tiếng đầu có tiếng lấp (`ừm` `à` `ờ` `thì` `kiểu`…). Video mở đầu gọn mà vẫn bị
nhắc thì hàng soát thành chỗ nhắc cho đủ, và người dùng học được cách không đọc nó.

**Không có con số chấm điểm nào.** Hook hay hay không thì máy không đo được, và
một con số bịa ở màn này làm hỏng lòng tin vào mọi con số khác đang bày ra.

Bấm dòng → `opening-hook-pane.tsx`, ba đường:

| Đường | Máy làm gì | Xem thử bằng cách nào | Đụng gì |
|---|---|---|---|
| **Nghe thử 3 giây đầu** | `onPreview(0, 3)` | chính nó | không gì |
| **Bỏ phần rào đón** | `cutRange(0, mốc lời thật)` | nghe từ mốc mới | `segments` — cơ chế cắt có sẵn, lấy lại được |
| **Phóng to câu đầu** | cụm đầu → `middle` + `keyword-large` | **vẽ ra kết quả** bằng `OverlayTextBlock` | `elements`, vẫn neo vào khoảng từ |
| **Tự viết câu mở** | ô nhập + 3 gợi ý từ `ai-opening.ts` | đọc câu trước khi nhận | `elements` neo vào 8 tiếng đầu |

Phần rẻ nhất và có giá trị nhất là **nút nghe thử** — gần như không ai từng nghe
lại ba giây đầu của chính mình một cách có ý thức. Ba đường không cùng phụ thuộc
một thứ: chỉ đường thứ ba cần mô hình ngôn ngữ, và thiếu khoá thì hai đường kia
vẫn chạy (`/api/projects/:id/opening-lines` trả mảng rỗng thay vì lỗi).

Không tạo loại `element` mới, không đụng `segments.position`. Đường **đảo câu
chốt lên đầu** cố ý không làm — `render.ts` ghép đoạn theo `position` tuyến tính.

## Đã kiểm

- [x] `npm run typecheck` · `lint` · `build` sạch
- [x] `npm run check:ownership` 24/24
- [x] `npm run check:style-pack` 25/25
- [x] Hai đường vẽ khớp số dòng: 50/50 (5 bộ × 10 cụm)
- [x] Render trước/sau: 8/10 lệch 0 điểm ảnh, 2 tổ hợp `taper` đổi đúng như chờ
      đợi (sửa lỗi tràn khung)
- [x] Bộ dáng chảy tới mọi chỗ vẽ chữ, không còn chỗ nào dùng bộ gốc cứng

## Câu chưa dứt

1. **Chưa xem tận mắt** ba màn mới trên dự án thật: `/pipeline` và bàn dựng đều
   nằm sau cổng Google, mà Google chối đăng nhập từ trình duyệt bị điều khiển tự
   động. Đã dựng `scripts/ui-preview/` để soi thẻ chọn dáng và Dialog đổi dáng
   bằng dữ liệu giả; riêng màn "3 giây đầu" cần một `EditorState` thật nên chỉ
   mới kiểm bằng kiểu và biên dịch.
2. **Trục "có lời" chưa có ca dương tính để đối chứng** — cả 55 bài đều không
   lời, nên phép dò mới chỉ chứng minh được chiều "không nhầm bài không lời thành
   có lời". Thả một bài có hát vào kho rồi chạy lại
   `scripts/music-tags/detect-vocals.mjs` là đủ.
3. **`brollHoldSec` khai trong bộ dáng nhưng chưa ai đọc** — độ dài một lần chèn
   hiện vẫn do quãng từ mà mô hình chọn quyết định. Nối nó vào đòi sửa cách
   `ai-broll-place` chốt `toWordId`, đó là một việc riêng.
