# Research: Kho b-roll MIỄN PHÍ phù hợp Tedit

_2026-08-19 · nguồn: trang điều khoản/API chính chủ + tổng hợp so sánh_

## TL;DR

3 nguồn đáng tích hợp API ngay: **Pexels Video** (nền tảng chính), **Pixabay Video** (bù độ phủ),
**Coverr** (clip "ít stocky", API sạch). Ba cái này đều: free, có REST API, cho dùng thương mại,
KHÔNG cần attribution trong video xuất ra (Coverr yêu cầu ghi nguồn ở app).
Nguồn không-API (Mixkit, Mazwai, Dareful…) chỉ nên **tải tay để seed kho** `server/data/assets/`.
Khoảng trống lớn nhất: **b-roll bối cảnh Việt Nam / người Việt** — không kho free nào phủ đủ.

---

## Tầng 1 — Tích hợp API (khuyến nghị)

| Kho | API | Giới hạn | License | Attribution | Ghi chú cho Tedit |
|---|---|---|---|---|---|
| **Pexels** | `/v1/videos/search` | 200 req/h, 20k/tháng (xin nâng được) | Pexels License, thương mại OK | Không bắt buộc trong video; **bắt buộc link "Pexels" trong app** khi dùng API | Tốt nhất: có `orientation=portrait` (đúng 9:16), `size`, `locale` (có vi-VN) → tìm bằng tiếng Việt luôn |
| **Pixabay** | `/api/videos/` | 100 req/60s, **bắt buộc cache 24h** | Content License (post-2019), thương mại OK | Không bắt buộc, nhưng **phải hiện nguồn trong UI kết quả tìm** | **Cấm hotlink vĩnh viễn** → phải tải về server (đúng kiến trúc kho hiện có). 4 mức: large/medium/small/tiny |
| **Coverr** | `api.coverr.co` | Demo 50 req/h · Production 2.000 req/h | Coverr License, thương mại OK | **Yêu cầu ghi nguồn Coverr** | Thư viện tuyển chọn, hợp gu "ambient/texture" — đúng loại b-roll mà mô hình `loop` của mình chịu được |

Cả 3 đều **cấm phân phối clip ở dạng thô (standalone)**. Tedit render clip vào video có
cắt/khung/chữ → đã là "creative effort", hợp lệ. **Đừng làm nút "Tải clip gốc"** trong app —
đó chính là hành vi bị cấm.

## Tầng 2 — Không có API, tải tay để seed kho

| Kho | Chất lượng | License | Bẫy |
|---|---|---|---|
| **Mixkit** (Envato) | Cao, cinematic | Mixkit License, thương mại OK, không cần credit | Không API; **cấm scrape/redistribute** → chỉ tải tay số lượng nhỏ |
| **Mazwai** | Boutique cinematic | CC-BY 3.0 **hoặc** Mazwai License (tuỳ clip) | Đã về tay Freepik; phải đọc license **từng clip** |
| **Dareful** | 4K | CC-BY (bắt buộc ghi nguồn) | Attribution trong video xuất → phiền cho SaaS, cân nhắc bỏ |
| **Freepik Video** (nuốt Videvo) | Rất lớn (500k+) | Free tier cần attribution; API là **trả phí** | Videvo.net đã redirect; đừng build trên API cũ |
| **Vecteezy** | Lớn | Free = bắt buộc credit | Cùng vấn đề attribution |

## Tầng 3 — Public domain (rủi ro pháp lý = 0)

- **NASA Image & Video Library** (`images-api.nasa.gov`) — API mở, PD. Hợp chủ đề khoa học/vũ trụ/trái đất.
- **Internet Archive / Prelinger** — API mở, ~17k mục archival. Chất liệu retro, chất lượng kém đều.
- **Wikimedia Commons / Library of Congress / National Park Service** — PD hoặc CC, chất lượng lẫn lộn.

Dùng làm "gia vị" (b-roll minh hoạ khái niệm, tư liệu cũ), không làm nền tảng.

## Tầng 4 — Bù khoảng trống bối cảnh Việt Nam

Kho free hầu như chỉ có b-roll phương Tây / châu Á chung chung. Ba đường bù:

1. **Query có locale**: Pexels `locale=vi-VN` + từ khoá "Hà Nội", "phở", "xe máy"… (số lượng ít nhưng có).
2. **Sinh bằng AI**: dự án đã có đường Veo 3 / Hailuo qua skill `ai-multimodal` → sinh b-roll 5–8s
   theo đúng câu đang nói. Đắt hơn nhưng khớp nội dung 100%, không vướng license.
3. **Tự quay 1 pack gốc** (~100 clip: bàn làm việc, quán cà phê, đường phố VN) → tài sản riêng, dài hạn rẻ nhất.

---

## Khớp với kiến trúc hiện có

- Kho đã đúng khuôn: `server/asset-library.ts` (thư mục là nguồn sự thật + chống trùng bằng SHA-256).
  Clip tải từ stock đi thẳng vào `server/data/assets/`, hash dedupe có sẵn — hai lần tải cùng clip Pexels không nhân đôi kho.
- `server/ai-broll-describe.ts` mô tả 3 khung/clip bằng tiếng Việt → **giữ nguyên**, chạy luôn cho clip stock;
  không cần tin metadata/tag tiếng Anh của nhà cung cấp (vốn rác và lệch ngôn ngữ với `ai-broll-place.ts`).
- Nên thêm cột nguồn + link tác giả vào `library_assets` (`source`, `source_url`, `author`) để trả nghĩa vụ ghi nguồn
  của Pexels/Coverr ở UI kho, không phải ở video.
- Adapter tách file theo nhà cung cấp: `server/stock/pexels.ts`, `stock/pixabay.ts`, `stock/coverr.ts`,
  cùng trả về một shape rồi đổ vào `LibraryAsset`. Cache kết quả search (Pixabay **bắt buộc** 24h, Pexels để né trần 200 req/h).
- Lọc trước khi nhập kho: ưu tiên `orientation=portrait` hoặc ≥1080p landscape, độ dài ≥ `MIN_SECONDS` (2,5s trong `ai-broll-place.ts`),
  loại clip có chữ/watermark cháy trong hình (hỏng bố cục khung).

## Rủi ro cần biết

- Điều khoản Pexels cấm scraping/khai thác dữ liệu **cho mục đích machine learning**. Gửi khung hình cho Gemini để
  *mô tả* (inference) khác với *huấn luyện*, nhưng nếu sau này định build embedding index trên clip tải hàng loạt thì phải xem lại.
- Không kho free nào **bồi thường (indemnification)**: người/logo/thương hiệu nhận diện được trong clip là rủi ro của mình.
  → Tránh clip có mặt người rõ trong ngữ cảnh nhạy cảm (sức khoẻ, tài chính, tiêu cực).
- Tải hàng loạt tự động bị cấm ở cả Pixabay lẫn Mixkit → nhập kho theo nhu cầu (on-demand khi user tìm), đừng crawl toàn thư viện.

## Câu chưa trả lời

1. B-roll lấy theo **on-demand lúc user tìm** hay **seed sẵn một kho tuyển ~500 clip**? (ảnh hưởng hẳn thiết kế adapter)
2. Có định cho user thấy nguồn/tác giả clip trong UI không? (Pexels/Coverr đòi, Pixabay đòi)
3. Ngân sách cho b-roll sinh bằng AI — có mở không, hay chỉ stock?

---

# Phụ lục — Giai đoạn 0: tải tay, up vào kho (chốt 2026-08-19)

Quyết định: chưa tích hợp API, tự tải tay rồi up lên `/library` dùng trước.

## Bên nào tải tay (thứ tự ưu tiên)

| # | Bên | Cần đăng ký? | Credit? | Dùng cho | Tỉ lệ kho đề xuất |
|---|---|---|---|---|---|
| 1 | **Pexels Videos** | Không | Không | Xương sống. Có bộ lọc **Portrait** + chọn độ phân giải khi tải | ~50% |
| 2 | **Mixkit** | Không | Không | Clip cinematic "có gu", ít mùi stock | ~25% |
| 3 | **Coverr** | Không | Không (khi tải tay từ web) | Ambient/texture, loop mượt — hợp fit-mode `loop` | ~15% |
| 4 | **Pixabay Videos** | **Có** (free) | Không | Bù chủ đề lạ Pexels thiếu | ~10% |

Tránh ở giai đoạn này: Videvo/Freepik, Vecteezy, Dareful, Mazwai — hoặc đòi credit hiện trong video,
hoặc license khác nhau từng clip → tốn công kiểm mà không thêm được bao nhiêu.

## Chuẩn chọn clip (bám ràng buộc code hiện có)

- **Độ dài 6–15s**. Sàn cứng là `MIN_SECONDS = 2.5` (`ai-broll-place.ts`); 6–15s cho phép chọn in/out mà không phải lặp.
- **Ưu tiên dọc 9:16** cho khung `toan-khung`; ngang 1080p vẫn tốt cho khung thẻ/collage.
- **1080p là đủ** — 4K chỉ tải khi định crop/zoom, còn lại chỉ làm nặng render.
- **Không chữ / logo / watermark cháy trong hình** — hỏng bố cục khung và đá nhau với caption.
- **Ít mặt người rõ**: ưu tiên bàn tay, đồ vật, bối cảnh. Mặt người lạ đá nhau với người nói + rủi ro chân dung.
- **Một cảnh liền, chuyển động chậm**: clip có sẵn cắt cảnh giữa chừng sẽ nhảy khi mình cắt/lặp.
- **Đặt lại tên tệp có nghĩa** (`go-phim-ban-dem.mp4`) — kho lấy tên tệp làm title mặc định.

## Cách nạp — dùng UI, đừng thả thẳng thư mục

`server/data/assets/` là nguồn sự thật nên thả tay vào vẫn hiện trong kho, **nhưng mất hai thứ**:
không có hàng trong `library_assets` → **mất chống trùng theo hash**, và không có `description`.

Up qua `POST /api/library/assets` (màn `/library`) thì có hash + mô tả. Lưu ý cách route đang chạy:
**`title`/`tags`/`description` là MỘT bộ dùng chung cho cả lô upload**. Nên:

- Up **theo lô cùng chủ đề**, 10–15 clip/lô, điền `tags` + `description` chung cho lô đó; hoặc
- Để trống mô tả — khi kéo clip từ kho vào dự án, `describeInserts` trong pipeline sẽ tự mô tả từng clip
  (`media_files.role='insert'` mà `description` rỗng thì được mô tả), nên AI đặt b-roll vẫn có cái để đọc.

## Mục tiêu lô đầu: 40–60 clip, 8 nhóm

`bàn làm việc / gõ phím` · `cà phê, quán` · `đường phố, người qua lại` · `màn hình, biểu đồ, số liệu` ·
`giấy tờ, ghi chép, ký` · `điện thoại trên tay` · `thiên nhiên, bầu trời, nước` · `texture trừu tượng, bokeh, ánh sáng`

Mỗi nhóm 5–8 clip là đủ để chặng đặt b-roll luôn có lựa chọn mà không lặp mặt.
Kho hiện có 12 tệp, gần hết là screen recording → coi như đang trống.
