# KHUÔN — ép thời gian, mở hình thức

## Vì sao chia thế

Đo 6 bộ Captions (chalk · focus · lens · y2k · sketch · volt):

- **Thời gian gần như TRÙNG** ở cả sáu, dù hình thức khác hoàn toàn.
  Tuổi thọ thiết bị nổi: 2,1 · 2,5 · 2,65 · 2,4 · 2,4 · 2,1–3,5.
- **Hình thức thì mở hoàn toàn.** Cùng trục "khung b-roll": Chalk mép rách ·
  Focus viền dày · Volt **không có**. Không luật nào.

→ Khuôn phải **ép thời gian** và **mở hình thức**. Ngược lại là sai cả hai đầu:
ép hình thức thì mọi bộ giống nhau; thả thời gian thì ra spam (đã đo trên bản
Phấn — viền rải khắp phim).

## BẢY LUẬT (cứng, có phép kiểm)

| # | luật | số đo |
|---|---|---|
| R1 | Mỗi **màn** dài 2–3,5 s. Không màn nào quá 5 s | đổi màn mỗi 2–3,5 s ở cả 6 bộ |
| R2 | Mỗi màn có **tối đa MỘT thiết bị nổi** | không bộ nào chồng hai |
| R3 | Thiết bị nổi sống **2,0–3,5 s** rồi tắt hẳn | 2,1–3,5 đo được |
| R4 | Giữa hai thiết bị nổi có **≥0,25 s trống** | Chalk chừa đúng 0,25 s |
| R5 | Vào **0,15–1,0 s** · ra **0,2–0,4 s** · chuyển màn **≤0,4 s** | Volt chuyển bằng 1 khung |
| R6 | **Lớp chữ chạy suốt**, dồn trong cụm, xoá giữa cụm, ~0,3 s/tiếng. KHÔNG tính là thiết bị nổi | cả 6 bộ |
| R7 | **Màn đầu (0–3 s) bắt buộc có một thiết bị nổi** | cả 6 bộ |

## HÌNH THỨC (mở — bộ dáng chọn)

| trục | biến thể đo được |
|---|---|
| nền trang | video phủ kín · video thu vào nền màu · nền màu không video |
| khung video | không · bo góc · viền dày · ảnh dán nghiêng · cửa sổ chrome · **khung HUD mảnh** |
| phụ đề: hạt | không thẻ · thẻ mỗi tiếng · thẻ cả cụm · **thanh dựng sẵn chữ điền vào** |
| phụ đề: xếp | một dòng · bẻ dòng · rải tự do |
| nhấn | đổi font · thẻ màu · đảo màu · tô sáng · **cả dòng đổi vai** |
| khối chữ: vào | viết từng chữ · gõ từng chữ · trượt vào · mảng mọc · rơi xuống |
| khối chữ: ra | mờ · gõ ngược · trượt ngược · mảng tụt · tản ra |
| khối chữ: dáng | đặc · **rỗng viền** · **lặp dọc tràn khung** · sau người |
| b-roll: khung | không · mép rách · viền dày · ngăn lưới · cửa sổ |
| b-roll: vào | viền vẽ dần · khung nở · trượt vào · phủ kín |
| người | không · viền quanh · cắt rời |
| trang trí | không · nét vẽ tay · chữ dọc mép · HUD giả · sticker |
| chuyển màn | **một khung trắng** · quét sơn · màn màu phủ · lau chéo · loang |

## LÀM GÌ TRƯỚC — chọn theo (wow ÷ công)

**Lớp Volt là rẻ nhất và hiện đại nhất: KHÔNG cần asset mới nào.**
Toàn bộ là `drawtext` + `drawbox` + `overlay` + phép nở-trừ đã có.

| thiết bị | đã thử | công |
|---|---|---|
| **chữ lặp dọc tràn khung** | ✅ chạy | ~30 dòng |
| **chữ rỗng viền** | ✅ chạy (nở-trừ) | ~20 dòng, dùng lại nguyên thuỷ viền người |
| **khung HUD bo góc + nhãn** | — | `drawbox`+`drawtext`, tầm thường |
| **chuyển cảnh MỘT KHUNG TRẮNG** | — | một `overlay` có `enable`, tầm thường |
| **nhấn cả dòng** | — | đã vẽ theo tiếng, chỉ đổi phạm vi |
| **thanh dựng sẵn chữ điền vào** | — | `drawbox` đủ bề rộng cụm + `drawtext` theo tiếng |

**Bỏ qua có chủ ý** (đắt, ít lợi): đạo cụ rơi (Y2K) · ảnh cắt dán nghiêng (Chalk
màn 3) · nhân bản cửa sổ · chữ dọc mép (cần xoay lớp chữ).
