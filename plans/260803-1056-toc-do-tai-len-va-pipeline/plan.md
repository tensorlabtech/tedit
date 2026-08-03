# Tốc độ: tải lên, chuẩn bị video, xem trước

Gốc: bạn trong whitelist (`duylinhdang1998@gmail.com`) báo upload 15 phút không
xong. Lần theo thì ra một chuỗi vấn đề nối nhau, đo được hết trên máy chủ thật
ngày 03/08/2026 với chính ba tệp người dùng gửi.

**Tệp đo:** `main-1.MOV` 20,2 MB · `main-2.mov` 316,7 MB · `main-3.MOV` 129,3 MB
— h264 1920×1080, **52–60 fps nhịp thay đổi**, tổng 466 MB / 159,2 giây.

---

## Đã sửa và đã lên máy chủ

Nhánh `feat/resumable-upload`, commit `2e1f69b` và `558f90b`. **Chưa merge vào
`main`** — deploy từ `main` lần tới sẽ nuốt mất.

### Lượt hai (`558f90b`)

| | trước | sau |
|---|---|---|
| Trần bộ nhớ container | 2500 MB, chạm trần 1238 lần | **3500 MB** |
| Video khung xem trước | `base.mp4` 202,6 MB | `preview.mp4` **7,5 MB** |
| `moov` (bảng mục lục) | cuối tệp, byte 212.245.935 | **byte 32** |
| Khung khoá | mỗi 6–7 giây | **mỗi 1,0 giây** |
| Dải ảnh dựng từ | `base.mp4` 1080×1920 | `preview.mp4` 540×960 |
| Màn nạp tệp | chỉ phần trăm | thêm "còn khoảng 2 phút" |
| Đổi cảnh ở màn nạp | `ERR_FILE_NOT_FOUND` đỏ console | im |

Hai tệp ra từ **một lượt giải mã** — giải mã mới là phần đắt, còn bản xem trước
nhỏ hơn bốn lần về số điểm ảnh nên phần mã hoá thêm gần như không thấy.

Phép kiểm: `npm run check:render`. Nó canh đúng ba thứ gãy im lặng — thiếu
`+faststart` hay thiếu `-g` thì tệp **vẫn ra, vẫn phát được, vẫn qua mọi phép
kiểm hình thức**, chỉ người dùng kéo thanh thời gian mới thấy giật.

| | trước | sau |
|---|---|---|
| Tệp > 100 MB | không bao giờ lên được | 466 MB trong ~60s |
| Đứt giữa chừng | mất trắng | tải tiếp từ mốc |
| Lượt tải chết | treo im vô hạn | 90 giây không nhích là báo lỗi |
| Bấm Huỷ | chỉ đổi nhãn, byte vẫn đi | dừng thật |

**Nguyên nhân gốc:** Cloudflare chối mọi thân request quá 100 MB (đo: 100 MB
qua, 105 MB trả 413 sau khi nuốt ~2 MB). `main-2` và `main-3` vượt trần nên
không có đường nào lên tới máy chủ. Tệ hơn một lỗi thường: XHR không bắn `load`
cũng không bắn `error`, nên thanh tiến độ đứng im chứ không báo hỏng.

Chi tiết ở `README.md` mục "Tải tệp lên". Phép kiểm: `npm run check:upload`.

---

## Chưa sửa — xếp theo mức đau

### 1. Trần bộ nhớ container quá sát 🔴

```
memory.peak  2.621.444.096   ← vượt trần 4 KB, tức đã kịch
memory.max   2.621.440.000   ← mem_limit: 2500m
max          1238            ← chạm trần 1238 lần, mỗi lần ép thu hồi bộ nhớ
```

Máy: 7,8 GB tổng, **4,8 GB khả dụng**, swap đã ăn 1,6/2,0 GB.

Mô hình nghe ~1,5–2 GB cộng node ~320 MB ép sát trần 2,44 GB. Kernel không giết
(`oom_kill 0`) nhưng phải thu hồi liên tục, và máy phải swap.

Đây là nghi can số một cho việc chép lời chạy **2,6× thời gian thực** (mục 3):
`large-v3-turbo` bản `int8` lẽ ra nhanh hơn thế trên 2 core, nhưng nó không có
chỗ để thở.

**Sửa:** `deploy/docker-compose.yml` → `mem_limit: 3500m`. Một dòng.

Ghi chú của bản cũ nói 2500m là "để tedit đừng thành thứ kích hoạt OOM killer" —
lý do đó vẫn đúng, nhưng nó được chọn khi máy chật hơn. Giờ còn 4,8 GB khả dụng
nên 3500m vẫn chừa hơn 4 GB cho 29 container kia.

### 2. "Chuẩn bị video" 6 phút, ~90% không đáng phải đợi 🟠

Đo bằng mốc thời gian tệp trên `prj_mscojybvffuytc`:

| | xong lúc | tốn |
|---|---|---|
| tải xong 3 tệp | 05:40:12 | ~60s |
| `base.mp4` | 05:46:13 | **≈ 358s** |
| `strip.jpg` | 05:46:51 | 38s |
| `audio.wav` | 05:46:51 | ~1s |
| `envelope.json` | 05:46:52 | 1s |

`buildBase` chiếm ~90%. Nó giải mã hơn 8.200 khung 1920×1080 (nguồn 52–60fps rồi
ép về 30fps) và mã hoá lại 4.776 khung 1080×1920 bằng libx264 trên **2 core** →
0,44× thời gian thực. Con số ấy đúng với phần cứng, không phải dấu hiệu hỏng.

**Nhưng máy nghe chỉ cần `audio.wav`.** Tách tiếng thẳng từ ba tệp nguồn mất vài
giây. `base.mp4` chỉ cần xong trước khi người dùng mở bàn dựng.

**Sửa:** tách tiếng trước → chạy máy nghe ngay; `base.mp4` dựng nền song song
hoặc sau. "Chuẩn bị video" từ 6 phút xuống vài giây, **không đánh đổi chất lượng**.

### 3. Chép lời 2,6× thời gian thực 🟠

`audio.wav` xong **05:46:52**, việc báo xong **05:53:41** → **6 phút 49** cho 159
giây tiếng. Quãng đó gồm cả chặng `describe` (gọi mô hình qua mạng) và phần hậu
xử lý phía node, nhưng máy nghe chiếm phần lớn.

Cộng với mục 2: **13,5 phút** từ lúc tải xong tới lúc có bản chép lời, chia gần
đều hai nửa — mã hoá video và nghe.

**Nghi can:** mục 1 (không đủ bộ nhớ để thở). Sửa mục 1 rồi đo lại trước khi làm
gì thêm. Nếu vẫn 2,6× thì tính tiếp: `beam_size=5` hạ xuống 1 (nhanh rõ, đổi lại
sai nhiều hơn ở tiếng Việt), hoặc `BatchedInferencePipeline` của faster-whisper.

### 4. Trình xem trước giật 🟠

`src/routes/editor/preview-panel.tsx:275` phát thẳng `base.mp4`. Tệp đó hội tụ
bốn thứ tệ cùng lúc:

```
mdat  tại 40             212.245.895 byte
moov  tại 212.245.935        176.835 byte   ← BẢNG MỤC LỤC Ở CUỐI TỆP
```

- **`moov` nằm cuối** — thiếu `-movflags +faststart`. Trình duyệt phải với tới
  tận cuối tệp 212 MB mới biết cấu trúc để phát và tua.
- **10,5 Mbps · 212 MB** cho một bản xem trước.
- **Khung khoá cách nhau 6–7 giây** (đo được ở khung 1, 212, 386, 562 — không có
  cờ `-g` nên x264 dùng mặc định). Mỗi lần tua phải giải mã tới 200 khung.
- **Cloudflare không cache** (`cf-cache-status: BYPASS`) → mỗi lượt xem kéo 212 MB
  từ VPS ở châu Âu.

**Sửa:** dựng riêng một bản xem trước — 540×960, ~1,5 Mbps, `-g 30`,
`-movflags +faststart`. Giữ `base.mp4` nguyên chất lượng cho bản xuất.

### 5. Giải mã cùng một video ba lần 🟡

`buildBase`, `makeFilmstrip`, `extractAudio` mỗi hàm mở tệp giải mã lại từ đầu.

**Sửa:** một lượt ffmpeg, nhiều đầu ra.

> **Mục 2, 4, 5 gộp thành MỘT thay đổi.** Một lượt ffmpeg giải mã một lần rồi
> xuất bốn thứ: `base.mp4` (chất lượng, cho bản xuất) · `preview.mp4` (nhỏ,
> faststart, GOP ngắn) · `audio.wav` · dải ảnh. Rồi cho máy nghe chạy ngay khi có
> tiếng. Một cú tái cấu trúc, ba vấn đề.

### 6. Lỗi blob URL trong console 🟡

`blob:...ERR_FILE_NOT_FOUND` — thẻ `<video>` còn đọc một blob URL vừa bị
`URL.revokeObjectURL` thu hồi khi đổi cảnh (`sequence-preview-card.tsx:89`,
`use-hover-scrub.ts:32`). Chỉ là tiếng ồn ở console, nhưng nó đã một lần khiến
người dùng tưởng đó là nguyên nhân upload hỏng.

### 7. Hiện thời gian còn lại 🟡

Áp cho cả tải lên lẫn màn chờ. Không nhanh hơn một giây nào, nhưng "còn 40 giây"
khác hẳn "53%" — phần lớn cảm giác lâu nằm ở chỗ không biết bao giờ xong.

### 8. Nhìn từ ngoài không phân biệt được CHẬM với CHẾT 🟡

Không phải lỗi đã bắt được — là một khoảng trống trong cách báo trạng thái, và
hôm nay chính tôi đã ngã vào nó: thấy việc đứng ở 45%, không có tiến trình python,
CPU 0,59%, RAM 324 MB suốt mấy lần đo, nên kết luận nó chết. Nó không chết — nó
đang bò dưới sức ép bộ nhớ, và sáu phút sau chép xong 22 câu.

Nhịp tim ở `server/job-queue.ts` → `beat()` chỉ chứng minh tiến trình *node* còn
sống, không nói gì về việc đang chạy. Nên "đang chạy" và "đã chết" trông giống hệt
nhau — với người dùng, và như vừa rồi, với cả người đi sửa.

**Sửa:** cho việc nặng báo tiến độ THẬT (máy nghe biết đang ở giây thứ mấy của
đoạn tiếng), và canh tiến trình con — nó thoát mà việc chưa xong thì đánh dấu hỏng
kèm mã thoát. Cùng tinh thần với đồng hồ 90 giây vừa thêm cho đường tải lên.

---

## Cần bạn quyết

**`-preset veryfast` → `ultrafast`?** Nhanh 2–3 lần, nhưng `base.mp4` là nguồn
cho bản xuất cuối (`pipeline.ts:568`, `media-routes.ts:36`) nên đây là đánh đổi
chất lượng hình thật, không phải tệp tạm vứt đi.

Nếu làm mục 4 (tách bản xem trước riêng) thì câu hỏi này nhẹ hẳn: `base.mp4` chỉ
còn phục vụ bản xuất, không ai ngồi đợi nó nữa.

---

## Máy nghe: đã đo, đã hết đường rẻ

Chạy lại trọn lượt trên bản sao dữ liệu, cùng trần tài nguyên như bản thật
(`-m 3500m --cpus 2.0`), 03/08/2026:

```
ghép video (buildBase)   12:26:25 → 12:32:27    6 phút 02
nghe và chép lời         12:32:27 → 12:41:39    9 phút 12
```

**`mem_limit` đã ăn thua** — bằng chứng ở `memory.events` của cả lượt chạy:

| | trần 2500m | trần 3500m |
|---|---|---|
| chạm trần | 1238 lần | **0** |
| đỉnh / trần | 2.621.444.096 / 2.621.440.000 — kịch | 2.957.225.984 / 3.670.016.000 |
| CPU lúc nghe | 0,59% (vật lộn thu hồi bộ nhớ) | **~200%** (hai lõi chạy hết) |

Trước là nghẽn bộ nhớ, giờ là nghẽn phép tính. Nhưng thời gian không giảm — vì
nghẽn CPU thì chỉ có ít CPU hơn hoặc nhiều việc hơn mới đổi được.

### Hai đòn bẩy đã thử, cả hai đều BỎ

Đo trên 60 giây tiếng thật của dự án, cùng máy, cùng trần:

| | nhanh hơn | đổi lại | kết luận |
|---|---|---|---|
| `BatchedInferencePipeline` | **1,03×** | cắt 3 đoạn thay vì 10 | bỏ |
| `beam_size` 5 → 1 | **1,08×** | chữ chép ra khác hẳn | bỏ |

Lý thuyết "gom lô đỡ chi phí nạp trọng số" đúng với GPU chứ không đúng với CPU —
ở đây nghẽn là phép tính thuần, gom lô không bớt được phép tính nào. Còn 8% thì
không đáng đổi lấy một bản chép khác đi.

**Đừng thử lại hai thứ này.** Số đo ở trên là trên chính phần cứng và chính đoạn
tiếng của sản phẩm.

Còn lại toàn đường đắt: thêm CPU (VPS dùng chung, 30 container), mô hình nhỏ hơn
(mất độ chính xác), hoặc gửi tiếng đi nơi khác (trái với điều `README.md` đã hứa).
Nên **~1,6× thời gian thực là giá của việc nghe trên hai lõi** — coi đó là hằng số
và đi tối ưu chỗ khác.

## Đã cân nhắc rồi bỏ

- **Nén video ở trình duyệt trước khi tải.** Cắt được ~60 giây tải, trong khi mục
  3 cắt 6 phút. Làm sau, nếu còn thấy cần.
- **Mảnh 16 MB thay vì 8 MB.** Bớt ~5% chi phí khứ hồi, đổi lại thử lại đắt gấp
  đôi khi mạng chập. Lợi mỏng.
- **Tải nhiều tệp song song.** Đo thật: ba tệp nối nhau cách đúng 1 giây, tốc độ
  7,1–10,0 MB/s. Cùng ngần ấy byte qua cùng một đường — song song không tạo thêm
  băng thông, chỉ làm cả ba thanh cùng bò. Trình duyệt lại nối tới Cloudflare Hong
  Kong (~30–50ms) nên một luồng thừa sức lấp đường.
- **Hạ `MAX_FILE_SIZE`.** Định hạ vì app hứa 2 GB mà đường đi chỉ cho 100 MB —
  nhưng cắt mảnh đã xoá trần đó, nên 2 GB giờ là con số thật.

## Việc lặt vặt

- Merge `feat/resumable-upload` vào `main` (máy chủ đang chạy nhánh, lệch quy ước
  trong `.claude/skills/deploy/SKILL.md`).
- `git prune` — cảnh báo gc có sẵn từ trước.

### Lượt ba — bàn dựng giật

Đo trên máy người dùng thật, 15 giây phát, trước và sau:

| | trước | sau | máy phát triển (qua hầm) |
|---|---|---|---|
| FPS | 60 | 60 | 60 |
| tác vụ dài | 0 | 1 | 0–1 |
| khung video rơi | 0 | 0 | 0 |
| **video TUA lại** | **38** | **4** | 4 |
| **video ĐỢI nạp** | **38** | **3** | 3 |

**Cái giật không nằm ở chỗ vẽ.** FPS đã là 60 và không có tác vụ dài nào ngay từ
đầu — React sạch. Nó nằm ở chỗ vòng phát tính mốc bằng **đồng hồ tường** rồi bắt
video tua cho khớp khi lệch quá 0,3 giây: mạng khựng → video tụt → bị tua → nạp
lại từ chỗ mới → tụt tiếp. Một vòng tự nuôi nhau, 2,5 lượt tua mỗi giây.

Chỉ lộ ra khi có độ trễ mạng thật. Trên máy phát triển qua đường hầm thì tua 0 cả
trước lẫn sau — nên **đọc mã không thấy được, phải đo trên máy người dùng**.

Giờ vòng phát lấy `currentTime` của chính video làm mốc. Bốn lượt tua còn lại là
bốn lần vượt qua chỗ cắt — dự án có **181 quãng bị bỏ** nên nhảy vài lần trong 15
giây là đúng chức năng.

**Ba lượt sửa trước không chạm tới nguyên nhân này.** Chúng vẫn đáng: video xem
trước 202,6 MB → 7,5 MB, dải ảnh thôi vượt trần texture GPU, số lượt dựng lại
React giảm ba lần. Nhưng thứ người dùng kêu là video nhảy, không phải giao diện ì
— và tôi đã đoán sai ba lần trước khi chịu vào trình duyệt đo.

**Bài học ghi lại:** đọc mã đoán được chỗ *có thể* chậm, không đoán được chỗ *đang*
chậm. Ba lượt đoán tốn nhiều thời gian hơn một lượt dựng container thử rồi lái
trình duyệt vào đo.

## Còn lại

Xong: mục 1 (trần bộ nhớ), 4 (xem trước), 5 (giải mã một lượt), 6 (blob URL),
7 (thời gian còn lại), và một phần mục 2 (dải ảnh nhẹ đi).

**Chưa làm, và vì sao:**

- **Mục 3 — chép lời 2,6× thời gian thực.** Cố ý chưa đụng: `mem_limit` vừa nới
  là nghi can chính, mà sửa hai thứ cùng lúc thì không biết thứ nào có tác dụng.
  Chạy lại một lượt rồi đo trước đã.
- **Mục 2 — cho chép lời chạy TRƯỚC khi mã hoá video.** Tách tiếng thẳng từ nguồn
  (vài giây) thay vì từ `base.mp4` (6 phút) thì bản chép lời tới sớm hơn sáu phút.
  Nhưng nó đảo thứ tự cả `runTranscribe`, và **tổng thời gian không đổi** — chỉ
  đổi thứ tự thứ gì xong trước. Đó là quyết định về sản phẩm (người dùng có làm
  được gì với bản chép lời khi chưa có hình không?) chứ không còn là tối ưu, nên
  để bạn quyết.
- **Mục 8 — tiến độ thật + canh tiến trình con.** Việc thật, chưa làm.

- **Bản xem trước của dòng thời gian ĐÃ CẮT.** Bốn lượt tua còn lại là bốn lần
  nhảy qua quãng đã bỏ, và mỗi lần nhảy là một lần video nạp lại — trên đường Việt
  Nam sang châu Âu thì lần nào cũng thấy. Chỉnh player hết đường rồi; lối đúng là
  dựng sẵn một bản đã cắt để player chạy một mạch. Chỉ làm nếu người dùng còn thấy
  khựng ở chỗ cắt — đo xong lượt ba thì họ nói "đạt", nên chưa cần.

## Đòn bẩy DUY NHẤT còn lại: hoãn `base.mp4`

Sau khi đo xong máy nghe, bức tranh còn lại rất gọn:

```
ghép video   6 phút    ← còn gỡ được
nghe         9 phút    ← đã đo, hết đường rẻ
```

Bàn dựng giờ chỉ cần `preview.mp4` (nhẹ, dựng nhanh) và `audio.wav`. `base.mp4`
**chỉ `cutRanges` lúc xuất video mới dùng** (`pipeline.ts:568`). Nên nó không có
lý do gì chặn người dùng vào bàn dựng.

Thiết kế:

1. Tách `buildBase` thành `buildPreview` (chỉ `preview.mp4` + `audio.wav`) và
   `buildMaster` (`base.mp4`). Bản xem trước ít hơn bốn lần số điểm ảnh nên dựng
   nhanh hơn nhiều.
2. `runTranscribe` gọi `buildPreview` → dải ảnh → máy nghe. Xong là báo done.
3. `buildMaster` xếp thành MỘT việc riêng trong hàng đợi, chạy nền ngay sau đó.
4. Nút Xuất video mờ kèm chữ *"đang chuẩn bị bản dựng"* cho tới khi `base.mp4`
   xong. Cho bấm rồi im lặng chờ chính là cái bệnh cả tài liệu này đi chữa.

Đánh đổi: giải mã nguồn hai lượt thay vì một, tức tổng công việc tăng ~30%. Nhưng
thời gian **người dùng phải ngồi đợi** giảm từ 6 phút xuống dưới 2.

**Chưa làm.** Nó đụng vào đường xuất video — bước ăn tiền — mà một lượt xuất mất
hàng chục phút nên không thử được cho tử tế ở cuối một phiên dài. Đáng làm thành
một việc riêng, có đo lượt xuất trước và sau.

## Câu chưa trả lời được

- Vì sao mấy lần đo liên tiếp đều không thấy tiến trình python, RAM đứng ở 324 MB,
  mà việc vẫn chép xong 22 câu? Sức ép bộ nhớ là nghi can, nhưng chưa giải thích
  được vì sao mô hình không hề hiện diện trong bộ nhớ ở những lát cắt ấy. Nâng
  `mem_limit` rồi đo lại bằng `docker stats` liên tục trong cả lượt chạy.
- Mảnh 8 MB qua Cloudflare mới chỉ suy ra (body 10 MB và 95 MB đều qua), chưa đo
  bằng một lượt tải thật qua trình duyệt.
