# Báo cáo kiểm thử — teddit-v2

Phiên 28–29/07/2026 · 11 vòng · app chạy thật (vite + fastify), video mẫu từ `~/Desktop/tedit-samples`

Ảnh chụp từng bước: `qa/screenshots/`

---

## 1. Đã sửa (13 mục)

### Lỗi logic

| # | Vấn đề | Bằng chứng | Sửa ở đâu |
|---|---|---|---|
| 1 | Mở dự án chưa chép lời → toast đỏ *"Không lưu được thay đổi · Chưa ghép video chính"* ngay khi vào màn, người dùng chưa làm gì | `POST /filmstrip` trả 409, ảnh `r1-open-draft.png` | `use-editor.ts` — chỉ dựng lại dải ảnh khi dự án đã `ready` |
| 2 | Máy chủ không trả lời → trang chủ hiện **"Chưa có dự án nào"** kèm nút tạo mới. Người vừa dựng 7 dự án mở lên tưởng mất sạch | `projects-page.tsx:34` `.catch(() => setProjects([]))` | Trạng thái lỗi riêng + nút **Thử lại** |
| 3 | Tải lại `/upload` giữa chừng → mất sạch mạch đang xếp, dự án thành mục "Chưa chép lời" mồ côi. **Đây là nguồn của loạt dự án rác trong danh sách** | `r3-after-reload.png` | Mã dự án lên đường dẫn `/upload/:projectId?`, mở lại là dựng lại từ máy chủ (kèm tiến độ chép lời đang chạy) |
| 4 | 200KB byte ngẫu nhiên đặt đuôi `.mp4` lọt qua `ffprobe` (nó đoán ra luồng 352×288 dài 0 giây) và thành một ô tư liệu trông như dùng được | thử nghiệm trực tiếp | `server/main.ts` — không đo được khung hình, hoặc video dài 0 giây → trả lại kèm lý do |
| 5 | Ô tải hỏng vẫn chiếm một số cảnh → khung Xem trước báo "Cảnh 1/4" cho mạch chỉ có 3 cảnh | `r3-dup-and-broken.png` | Đánh số theo ô thật sự vào được video |
| 6 | **Cắt "khoảng lặng" làm cụt đuôi tiếng nói** — xem mục 2 bên dưới | đo sóng âm + xuất video | `audio-envelope.ts`, `segment-seed.ts`, `render.ts` |

### Lỗi UI/UX

| # | Vấn đề | Sửa |
|---|---|---|
| 7 | Bàn dựng không có đường về danh sách — vào rồi kẹt, chỉ còn nút lùi của trình duyệt (`/upload` thì có) | Thêm **Trở về** ở đầu trang, đúng chỗ nó đứng ở `/upload` |
| 8 | Bảy dự án cùng tên "Dự án mới", không cách nào phân biệt | Ô dự án hiện mốc tạo: `14:30` · `Hôm qua` · `27/07` |
| 9 | Nút xác nhận **Xoá** mang màu chủ đạo (màu của "đi tiếp") cho một việc không lấy lại được | `variant="destructive"` |
| 10 | Màn 720px: dòng tên ô bị xén ngang giữa chữ ngay lần đầu mở, dù chỉ có một hàng | Ô đo theo **vùng cuộn** (`container-type: size` + `100cqh`), không theo `vh` |
| 11 | Dấu ✂ "sẽ cắt hai bên" hiện cả trên tư liệu chèn — mà tư liệu chèn không bị cắt | Chỉ hiện với cảnh chính |
| 12 | `←` `→` không đi được cảnh trước/sau ở khung Xem trước (ca kiểm §7 của đặc tả upload) | Thêm phím tắt, tránh cướp phím khi đang kéo ô bằng bàn phím |
| 13 | Gộp hai cụm chữ xong, ô nhập vẫn giữ lời cũ → cú rời ô ghi đè mất phần vừa gộp | Khoá ô nhập gồm cả mép cuối của cụm |

## 2. Phát hiện lớn nhất: mốc chữ cắt sớm hơn tiếng thật

Anh nghi *"đoạn hiện là không có từ nhưng cắt đi lại mất tiếng của đoạn trước"* — **đúng, và đo được**.

Lấy bản tiếng 66 giây, tính mức hiệu dụng từng ô 10ms:

```
đuôi tiếng vượt quá mốc kết thúc câu:  trung vị 70ms · p90 160ms · dài nhất 380ms
```

Xuất thử một bản đã bỏ khoảng lặng rồi đo lại:

```
bản gốc  tại 2.02s:  −31.8 dB  (đuôi "…hôm nay" đang tắt dần)
bản xuất tại 2.02s:  −62.4 dB  ← rơi thẳng 33 dB trong một ô 10ms
```

Vừa mất đuôi từ, vừa tạo bước nhảy nghe ra như tiếng bụp.

**Đã sửa ba tầng:**

1. `server/audio-envelope.ts` — đo đường bao âm lượng một lần sau khi tách tiếng (ô 20ms).
2. `segment-seed.ts` — nới mép cụm lời tới chỗ tiếng thật tắt (xa nhất 0,4s). Quãng lặng chỉ còn đúng phần không ai nói.
3. `render.ts` — vuốt 8ms hai đầu mỗi mẩu tiếng trước khi nối.

**Đo lại sau khi sửa, cùng chỗ cắt:** đuôi tiếng còn nguyên tới −35,9 dB rồi mới cắt ở −42 dB. Trên toàn video, số quãng "không có từ mà vẫn còn tiếng" giảm **10/15 → 7/23**; bảy quãng còn lại đều dưới 0,25 giây nên không hiện thành dòng bấm được.

Bảy quãng ấy là **tiếng nói mà máy chép lời bỏ sót** — không mốc chữ nào chỉ ra được. Đó là lý do phải có dải sóng.

## 3. Dải sóng âm — nên có, và đã làm

Câu hỏi của anh: *có nên để dải âm như TikTok không?*

**Nên** — nhưng không phải vì TikTok có. Vì nó là lớp duy nhất trả lời được "chỗ này có ai nói không, tiếng kéo tới đâu". Đặc tả §12 đã gỡ dải TỪ vì nó lặp lại bảng Lời; dải sóng thì ngược lại, nó nói đúng thứ mốc chữ nói sai (mục 2).

Đã dựng theo đúng nếp của dự án:
- dải riêng ngay dưới dải phim, cao 20px, **không đè lên khung hình** (§48);
- không chọn/kéo được — nó nói về chính đoạn phim trên nó;
- vẽ theo **giờ xuất ra**, chỗ đã bỏ không để lại vệt;
- mỗi cột lấy **đỉnh** (trung bình làm phẳng mọi tiếng bật);
- cột dưới ngưỡng nói thì nhạt hẳn — đó là chỗ cắt được mà không mất tiếng.

Ảnh: `r5-waveform.png`, `r9-dark-editor2.png` (nền tối).

## 4. Sửa lời tự nhiên: gộp cụm

Ca thật trong video mẫu: **"TensorLab" bị nghe thành "Tenso" + "Lab", rơi vào HAI cụm chữ**.

Trước: sửa cụm trước thành "…tên là TensorLab" thì cụm sau vẫn còn chữ "Lab" trơ trên màn. Lối duy nhất là sửa rồi **xoá** cụm sau — hai thao tác cho một ý, mà người dùng phải tự nghĩ ra.

Nay bảng sửa chữ có **Gộp với cụm sau**. Quy trình còn ba bước, đều nằm trong tầm mắt:

1. bấm mục "Nghe không chắc: Tenso" ở hàng soát → nhảy tới đúng cụm;
2. **Gộp với cụm sau**;
3. gõ "TensorLab".

Đã kiểm tới thành phẩm: video xuất ra in đúng `TensorLab` (`frame-tensorlab.png`). Lời chép bên dưới giữ nguyên "Tenso"/"Lab" — đúng thứ người ta đã nói, và đó là chủ ý của đặc tả §7.

## 5. Ca kiểm đã chạy

**Đặc tả Editor §11** — T1 ✓ · T2 ✓ · T3 ✓ (lăn chạy dải, Ctrl+lăn phóng) · T5 ✓ (cắt tại vạch, đúng mốc sau khi đổi giờ xuất→gốc) · H1 ✓ · H2 ✓ (tay nắm đúng 14×44px) · H3 ✓ · H4 ✓ (gọt mép, dải không trôi) · H5 ✓ · N1 ✓ (bỏ một dòng, mốc mọi chữ khác không xê dịch) · P3 ✓ (Esc đóng bảng)

**Đặc tả Upload §7** — video dọc không mang nhãn khung ngang ✓ · rê ngang để tua ✓ · kéo thả đổi thứ tự, số đánh lại, đẩy lên máy chủ ✓ · thả trùng tệp ra hai ô ✓ · tệp hỏng → ô đỏ + **Thử lại** ở cột Thiết lập ✓ · ảnh chèn ngang/dọc cùng chiều cao, không có huy hiệu thời lượng ✓ · màn 720px không ô nào bị gọt ✓ (sau khi sửa) · máy để chế độ tối thì cả trang tối ✓

**Luồng đầy đủ** — nạp tệp → chép lời (4 bước) → sửa lời → cắt → nhạc nền → tư liệu chèn → hiệu ứng → xuất video, kiểm bằng khung hình và sóng âm của bản ra.

**Sạch:** `npm run typecheck` không lỗi · `npm run build` chạy được · console phiên mới không lỗi nào · lint chỉ còn 32 cảnh báo `fast-refresh`/`exhaustive-deps` có sẵn từ trước.

## 6. Vòng sau — theo trả lời của anh

**Đã làm thêm:**

| Việc | Kết quả |
|---|---|
| **Đổi tên dự án** — icon bút cạnh tiêu đề bàn dựng | `PATCH /api/projects/:id` + `editor-title.tsx`. Bút mờ sẵn (không ẩn hẳn — ẩn thì không ai biết sửa được), bấm ra ô nhập cao 32px với chữ cũ bôi đen sẵn, `Enter`/rời ô lưu, `Esc` bỏ |
| **Chặn chép lời bịa bằng giải âm** | `hallucination-filter.ts` đối chiếu từng câu với đường bao âm lượng. Video chỉ có nhạc: **0 câu** thay vì một câu bịa 26 giây; việc kết thúc với *"Không nghe được lời nào — video này không có tiếng nói"*, cột Thiết lập hiện dòng đỏ kèm nút **Thêm video**. Kiểm ngược trên video có lời: **27/27 câu giữ nguyên**, chép lại lần nữa vẫn đủ và neo lại 58 phần tử |
| Dọn chữ mồ côi sau lần chép lại không ra lời | Trước: 3 cụm chữ trỏ vào từ đã bị xoá, bàn dựng vẫn bày ra nhưng video không bao giờ có. Nay xoá sạch — và chỉ xoá SAU khi neo lại xong |

Ngưỡng lọc lấy từ đo thật, phân tách rất rộng nên đặt rất bảo thủ:

```
                      video chỉ có nhạc     video có lời thật
  tỉ lệ ô có tiếng          0,00            min 0,56 · trung vị 0,78
  từ dài nhất              25,62 giây             0,78 giây
```

**Bỏ theo ý anh:** cảnh báo khi gọt mép cắt vào tiếng nói — dải sóng đã nói bằng hình.

**Còn treo:**

- **Kéo ô bằng bàn phím** (ô CẢNH ở màn `/upload`, cái kéo thả để đổi thứ tự mạch): `Space` nhấc được ô lên, `←` `→` không tới tay dnd-kit. Đo: sự kiện phím không bị ai chặn, thư viện không phản ứng — nghi dnd-kit v6 chưa hợp với React 19. Lối đi bằng chuột và menu ⋮ ("Đưa lên trước / Đưa xuống sau") vẫn chạy, nên chỉ mất lối bàn phím thuần.
- **Hàng soát còn nhắc sau khi sửa tay**: gộp "Tenso"+"Lab" rồi gõ "TensorLab" thì chữ trên màn đã đúng, nhưng lời chép bên dưới vẫn giữ hai từ cũ (số tiếng không còn khớp nên máy chủ không ghi ngược — đúng thiết kế §7). Hàng soát đọc từ lời chép nên vẫn thấy hai từ nghe-không-chắc ấy. Có ba lối: để nguyên (bấm ✓ là xong), tự đánh dấu đã xem khi cụm chứa từ đó vừa bị sửa tay, hoặc cho phép sửa thẳng một TỪ trong lời chép.

## 7. Tệp đã đụng

```
server/audio-envelope.ts        (mới)  đo đường bao âm lượng
server/hallucination-filter.ts  (mới)  lọc câu máy bịa bằng sóng âm
server/asr/transcribe.py               trả thêm no_speech_prob
src/routes/editor/editor-title.tsx (mới)  sửa tên dự án tại chỗ
server/segment-seed.ts                 nới mép cụm theo tiếng thật
server/pipeline.ts                     đo đường bao sau khi tách tiếng
server/render.ts                       vuốt 8ms tại chỗ nối
server/main.ts                         chặn tệp hỏng · API /envelope
src/lib/format-moment.ts        (mới)  mốc thời gian ngắn
src/lib/api.ts                         getEnvelope
src/main.tsx                           /upload/:projectId?
src/routes/projects/*                  trạng thái lỗi · mốc tạo · nút xoá đỏ
src/routes/upload/*                    khôi phục phiên · số cảnh · ✂ · phím ←→ · bề rộng ô
src/routes/editor/timeline-audio-lane.tsx (mới)  dải sóng âm
src/routes/editor/*                    dải sóng · gộp cụm chữ · nút Trở về
docs/editor-interaction-spec.md        §51 §52 §53
docs/upload-interaction-spec.md        §8 §9 §10 §11 §12
```
