# Số đo từ video mẫu Captions

Nguồn: `~/Desktop/tedit-samples/caption-styles/` — 46 tệp .mp4.
Cách đo: `ffmpeg fps=8` → lưới ảnh → đọc từng khung (0,125 s/khung).

## Chalk (10,0 s · 24fps)

| t (s) | việc |
|---|---|
| 0,125–0,375 | "YOUTH" **viết ra từng chữ cái** (`Y` → `YO'` → `YOUTH`) — 0,25 s |
| 0,375–0,5 | tầng 2, tầng 3 hiện → chồng 3 tầng xong |
| 0,5 | thẻ phụ đề đầu tiên |
| 2,0–2,25 | "YOUTH" nhạt dần rồi hết → **tuổi thọ 2,1 s** |
| 2,25–2,5 | **khoảng trống 0,25 s**, không thiết bị nào |
| 2,5–5,4 | viền vàng quanh người — **một mạch liền 2,9 s** |
| 5,5–5,6 | **quét mờ sang bảng đen — 0,15 s** |
| 5,6–7,4 | bảng đen; ảnh b-roll nhỏ → to trong 0,5 s, viền vàng vẽ dần theo |
| 7,5–7,75 | hoà tan về video — 0,25 s |
| 8,4–8,6 | quét sang trang giấy kem — 0,2 s |
| 8,6–10,0 | trang kem: ảnh video nghiêng + ảnh b-roll nghiêng viền vàng + nét vẽ tay |

**4 màn / 10 giây.**

## Focus (10,0 s · 24fps)

| t (s) | việc |
|---|---|
| 0,375–0,625 | mảng xanh **mọc lên từ đáy** — 0,25 s |
| 0,625 | "FOLLOWERS" đầy trên mảng |
| 2,5–2,875 | mảng **tụt xuống** rồi hết → **tuổi thọ 2,5 s** |
| 3,4–3,9 | mảng xanh mọc lại rồi **phủ kín khung** — 0,4 s |
| 4,0 | b-roll hiện ra dưới màn phủ |
| 4,6–4,9 | **viền xanh dày vẽ quanh b-roll** — 0,25 s |

**Thẻ phụ đề**: nền TRẮNG chữ đen; từ nhấn **đảo màu** (nền đen chữ trắng).

## Quy luật chung (đo trên 10 bộ)

1. **Đổi màn mỗi 2,5–3,5 giây.** Không bộ nào giữ một bố cục quá 5 giây.
2. **Khối chữ lớn sống 2,1–2,5 giây** rồi tắt hẳn. Không bộ nào để nó suốt phim.
3. **Chuyển màn 0,15–0,4 giây.** Rất nhanh.
4. **Thiết bị chạy MỘT MẠCH LIỀN**, có khoảng trống 0,25 s giữa hai thiết bị.
5. **Phụ đề dồn trong cụm, xoá giữa hai cụm.** ~0,25–0,375 s một tiếng.
6. **B-roll luôn có khung**, và khung là chữ ký của bộ.

## Lens · Y2K · Sketch

| | Lens | Y2K | Sketch |
|---|---|---|---|
| vào | video **nở từ một điểm** 0,125s | đạo cụ **rơi xuống** xếp chồng 0,6s | tiêu đề **trượt từ phải** 0,375s |
| khối chữ | "Aperture" **gõ từng chữ** 0,125s/chữ | — | "MIND MAP" + **ê-líp vẽ dần** |
| tuổi thọ | **2,65 s** | **2,4 s** | **2,4 s** |
| ra | **gõ ngược** 0,4s | đạo cụ tản ra, một cái phóng tới | trượt ngược ra |
| thẻ phụ đề | thanh đen **dựng sẵn đủ bề rộng**, chữ điền vào | không thẻ, chữ vàng | không thẻ → **có thanh tối từ 3,1s** |
| chuyển màn | loang màu | **lau chéo** 0,25s + cửa sổ trượt vào nhân 3 lớp 0,4s | — |
| trang trí | chữ dọc **hai mép** · HUD máy ảnh giả | sticker · con trỏ chuột | — |

## LUẬT THỜI GIAN — đo trên 5 bộ

| | Chalk | Focus | Lens | Y2K | Sketch |
|---|---|---|---|---|---|
| tuổi thọ khối chữ | 2,1 | 2,5 | 2,65 | 2,4 | 2,4 |

→ **2,4 s ± 0,25** ở CẢ NĂM. Đây là hằng số, không phải lựa chọn.

- vào: 0,25–1,0 s (gõ từng chữ thì lâu hơn)
- ra: 0,25–0,4 s
- đổi màn: mỗi 2,5–3,5 s
- chuyển màn: 0,15–0,4 s
- phụ đề: ~0,3 s một tiếng, dồn trong cụm, xoá giữa cụm

## Volt (10,3 s · 24fps) — bộ HIỆN ĐẠI, phá luật

Bóc HẾT video (6fps × 62 khung), không cắt nửa chừng như bốn bộ trên.

| t (s) | việc |
|---|---|
| 0,0 | mở bằng **cận mặt nhoè** rồi lùi ra — không có thiết bị nào |
| 0,17–0,33 | phụ đề 2 dòng: dòng 1 trắng thường, **dòng 2 xanh chanh nghiêng đậm** |
| 1,0–1,67 | "SMARTER" **chữ RỖNG viền, vân kim loại**, trượt vào từ mép trên, **bị cắt cụt ở mép** |
| **1,83** | **MỘT KHUNG TRẮNG** — chuyển cảnh trong **1/24 giây** |
| 2,0–3,67 | b-roll (cổ tay đeo vòng) **phủ kín, KHÔNG khung** |
| 4,5–7,8 | **khung HUD bo góc mảnh** quanh mặt + nhãn "● LEARNING" nhấp nháy |
| 8,2–10,3 | "SMART" **lặp dọc từ trên xuống dưới**, trượt lên, chồng qua người |

### Ba chỗ phá luật

1. **B-roll KHÔNG có khung.** Chalk/Focus/Lens/Y2K đều đóng khung b-roll; Volt cho nó phủ kín trần. → luật "b-roll luôn có khung" SAI.
2. **Chuyển cảnh 1 khung hình** (1/24 s), không phải 0,15–0,4 s. → dải rộng hơn tôi nghĩ.
3. **Nhấn nằm ở DÒNG RIÊNG**, không nội tuyến. Dòng 1 trắng thường, dòng 2 xanh nghiêng đậm — cả dòng đổi vai, không phải một từ.

### Đúng luật

- Thiết bị sống 2,1–3,5 s (SMARTER 3,5 · HUD 3,3 · SMART-lặp 2,1)
- Đổi màn mỗi ~2 s
- Phụ đề dồn trong cụm, xoá giữa cụm
