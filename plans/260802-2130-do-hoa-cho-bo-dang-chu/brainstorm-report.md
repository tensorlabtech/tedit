# Đồ hoạ cho bộ dáng chữ — báo cáo brainstorm

Ngày 2026-08-02. Chưa phải kế hoạch thi công, chưa động vào mã sản phẩm.
Mọi thứ dựng trong phiên này đều là ảnh thử, nằm ở `anh/`.

## Vấn đề

Mười bộ dáng chữ hiện tại **nhìn không phân biệt được nếu không để ý sâu**.
Không phải cảm tính — đếm được trong `server/style-pack-catalog.ts`:

| Trục | Có ở mấy pack |
|---|---|
| `edge` viền mảnh | 7/10, **cả 7 đều `#000000`** |
| `glow` quầng tối | ~10/10, chỉ khác bán kính |
| `box` nền khối | **2/10**, cả hai `#000000` góc vuông |
| `highlight` tô theo lời | **1/10** |

Tám trên mười là cùng một công thức: chữ + viền đen + quầng tối, đổi font đổi màu.

`style-pack.ts:174` đã ghi nhận triệu chứng này rồi — *"hai bộ dáng chọn kiểu khác
nhau mà xem video thật vẫn hao hao"* — và chữa bằng cách cho mỗi pack cầm
`intensity` riêng. Chữa đúng một nửa.

## Vì sao chữ không tách các pack ra được

**Chữ bắt buộc phải đọc được.** Ràng buộc đó hẹp: đủ to, đủ tương phản với nền
động, đủ dày, đứng ở dải không che mặt, không tràn khung. `style-pack.ts:14`
đóng đinh `SAFE` · `MAX_BLOCK_SHARE` · `MAX_LINES` · `MIN_SCALE` ngoài tầm với
của mọi pack.

> Đính chính sau khi kiểm (phiên validate): `style-pack.ts:16` nhắc "bộ kiểm 1920
> tổ hợp" nhưng **repo này không có nó** — `docs/editor-interaction-spec.md:541`
> ghi rõ đó là dự án trước. Ràng buộc vẫn nằm trong mã, chỉ là chưa có phép kiểm
> nào canh. Kế hoạch đợt 1 dựng bản gọn.

Mọi lời giải tốt cho một bài toán hẹp đều nằm gần nhau. Mười pack hao hao **không
phải vì làm chưa tới** — đó là hội tụ, và hội tụ là dấu hiệu bài toán đã giải đúng.

Đồ hoạ **không mang thông tin nào**, nên không có ràng buộc nào. Lệch được, tràn
được, mờ được, méo được. Trục không ràng buộc là trục phân kỳ.

Thêm: người lướt **nhận ra hình trước khi đọc chữ**.

## Ràng buộc gốc rễ chưa ai nói tới: kho font

`assets/fonts/` có **9 tệp, cả 9 đều sans đậm**. Không một serif, không một
script, không một chữ viết tay.

Nên mười pack không chỉ thiếu đồ hoạ — chúng **đang chọn trong một hộp màu chỉ
có một màu**. Cả nửa thanh lịch của thị trường (Linen, Elevate, Magazine,
Cinematic) Tedit không dựng được kể cả khi có đủ đồ hoạ.

## Chứng cứ thu thập

144 style của Captions, tải về 46 cái + 8 cái đối chứng (`anh/`):

- `46-style-phan-1.jpg` · `46-style-phan-2.jpg` — toàn cảnh 46 style thế hệ AI-edit
- `nhom-duoi-chi-la-phu-de.jpg` — 8 mẫu ngẫu nhiên từ 98 cái còn lại

**8/8 mẫu nhóm đuôi chỉ là chữ phụ đề**: hộp trắng, hộp xanh, chữ viền, không
một món đồ hoạ nào. Tên chúng đặt hàng loạt theo chòm sao (Betelgeuse, Polaris,
Sirius, Andromeda…).

→ Ngay cả Captions cũng có **~98 style chỉ khác font và màu**, y hệt Tedit.
Tỷ lệ style "có đồ hoạ" ở họ là **46/144 ≈ 1/3**. Tedit không thua 144 style;
Tedit đang có 10 cái thuộc nhóm 98, và thiếu hẳn nhóm 46.

*(Đã kiểm 8/98, chưa kiểm hết. Đủ để tin ở mức cao, chưa đủ để nói chắc chắn.)*

## Năm thành phần làm nên một style

Rút từ 46 ô, và Tedit hiện có đúng hai:

```
1. motif đồ hoạ / chất liệu        ✗  chưa có khái niệm
2. CẶP font (nặng + serif/script)   ✗  mỗi pack đang có 1 font
3. một màu nhấn khoá chặt           ~  có color.key, 7/10 pack chưa dùng khác nhau
4. một dòng TIÊU ĐỀ lớn             ✗  có ở 12/12 ô đầu tiên khảo sát
5. cách đóng khung tư liệu chèn     ~  có box w/h, chưa thành trục của pack
```

## Mổ bốn style — bốn mức chi phí

### `focus` — 0 tệp đồ hoạ (`anh/mo-focus.jpg`)

Khối xanh đặc nửa dưới khung, chữ trắng trong khối. Phụ đề chữ đen nền trắng,
từ nhấn **đảo màu**. Khung viền xanh dày bao video thu nhỏ. Chia đôi người/tư
liệu. Chuyển cảnh bằng mảng màu quét ngang.

**Toàn bộ là `drawbox` + `drawtext`. Không một PNG.** Và nó là một trong những
style dễ nhận ra nhất bảng.

### `lens` — 1 lớp hình học (`anh/mo-lens.jpg`)

Nền navy, video đặt trong khung có lề. Tiêu đề `Aperture` cam **gõ dần từng ký
tự**. Dòng `1/125  f5.4  ISO 200` ở đáy, đổi giá trị theo cảnh. Phụ đề hộp đen
chữ mono viết hoa. Giai đoạn giữa: **chữ chạy dọc hai mép** `APERTURE & FOCUS ·`
lặp, trượt liên tục; **chia hai ô** người trên tư liệu dưới. Chuyển cảnh loé sáng
cam. Giai đoạn cuối bỏ nền, về full-bleed.

Không một asset vẽ tay nào. Ứng viên tốt nhất về tỉ lệ khác-biệt / chi phí.

### `y2k` — cần asset thật (`anh/mo-y2k.jpg`)

Cửa sổ máy tính có thanh title 3 nút + con trỏ → sinh được.
Cửa sổ **nhân bản nhiều lớp lệch dần** → sinh được.
Ô vuông trắng nhấp nháy rải trên mặt → sinh được.
**Nhưng**: mở đầu là ảnh điện thoại cũ **đã tách nền** rơi xếp quanh mặt, và
người nói nằm *trong* màn hình điện thoại. Đó là ảnh chụp thật — không sinh được.

→ Nhóm "giao diện giả" rẻ, nhưng `y2k` trộn thêm collage ảnh thật.

### `chalk` — cần tách nền người (`anh/mo-chalk.jpg`)

**Viền vàng nguệch ngoạc ôm sát silhouette người** — đây là bằng chứng rõ ràng
nhất về nhu cầu matting. Chữ `YOUTH` nét phấn lặp nhiều dòng, có vẻ nằm sau
người. Tư liệu chèn **cắt theo viền bất quy tắc** có viền vàng. Cuối video:
polaroid nghiêng + mặt cười vẽ tay + mây vẽ tay.

## Phân nhóm 46 style theo chi phí

| Nhóm | Style | Cần gì |
|---|---|---|
| Mảng màu · cặp font · nền chữ | focus, lift, recess, clarity, linen, prism-pro, rebel, grit | **0 tệp** |
| Hình học sinh từ tham số | lens, align, bloom, growth, cinematic-ii, pulse, magazine, blueprint, form, orbit | script sinh SVG |
| Giao diện giả | y2k, clarity, evo, blueprint | hình chữ nhật + chấm + thanh |
| Chia màn nhiều ô | align, byline, lens, magazine, lift | overlay nhiều luồng |
| Nét vẽ tay | sketch, chalk, impact-ii | `roughjs` |
| **Cần tách nền người** | chalk, ignite, archive + (HARD, REALTY) | mô hình segmentation |
| **Cần người vẽ** | paper-ii, pop, zine, y2k (một phần) | ảnh chất liệu thật |

Chỉ **2–4 / 46** thật sự cần designer. Nhóm cần matting là khoản đầu tư riêng,
đắt hơn hẳn mọi thứ còn lại.

## Kiến trúc assets — ba tầng

```
SVG (nguồn, trong git)  →  PNG trắng (bản dựng)  →  tô màu lúc chạy (ffmpeg)
     designer/script sửa       rsvg-convert, lúc build     alphamerge, 0 phụ thuộc
```

Đã kiểm thật, chạy được:

```
[png]alphaextract[m]; color=c=0x2ED3B7[c]; [c][m]alphamerge
```

**Mấu chốt:** màu tách khỏi hình → **một hình dùng cho mọi pack**, mỗi pack chỉ
khai một mã màu. Đây là thứ giữ được mô hình "catalog là bảng số" thay vì biến
thêm-một-pack thành thuê-người-vẽ. Và vì màu áp bằng ffmpeg nên **máy chủ không
cần thêm phụ thuộc nào** — `rsvg-convert` chỉ cần lúc phát triển.

Ba loại hình, ba cơ chế:

| Loại | Ví dụ | Cơ chế |
|---|---|---|
| `plate` | khung, lưới, sọc, film gate | `overlay 0:0`, dán một lần cả video |
| `wrap` | vòng khoanh, gạch chân | 3-slice ngang, lấy số từ `textWidth()` |
| `spot` | mũi tên, sao, tia | đặt vào vùng trống đã khai |

Cấu trúc:

```
assets/graphics/
├── src/          # SVG — nguồn, một màu currentColor
├── build/        # PNG trắng — sinh ra, .gitignore
└── manifest.json # loại, vùng co, chỗ neo, đệm quanh chữ
```

`npm run check:style-pack` mở rộng ba phép kiểm:
- hình được tham chiếu phải có trong manifest
- **không pack nào trùng chữ ký đồ hoạ với pack khác** (ngược với `defaults` —
  chỗ đó canh *giống*, chỗ này canh *khác*)
- **luật loại trừ**: pack đã có `box` thì không được thêm `wrap` cùng màu

## Không có designer thì làm sao — cái máy sinh rồi lọc

| Thành phần | Tự động | Bằng gì |
|---|---|---|
| Font có dấu Việt | ~100% | Google Fonts API + kiểm glyph thật |
| Nét vẽ tay | ~100% | `roughjs` (MIT), có `seed` nên tái lập được |
| Hình rời | 100% | `lucide-static` (ISC) — repo đã dùng `lucide-react` |
| Bảng màu | ~100% | `culori` + `auto-grade.ts` đã đo màu khung hình |
| Hình học | 100% | ~50 dòng tự sinh |
| "Đẹp hay xấu" | 0% | mắt người, một lần |

**Đảo ngược bài toán:** không thiết kế 10 pack, mà **sinh 200 rồi lọc còn 10**.

```
1. Sinh tổ hợp  font × màu × motif × nền-chữ        → vài nghìn
2. Luật loại tự động: tương phản kém, trùng chữ ký  → còn ~200
3. Dựng contact sheet trên KHUNG THẬT của người dùng
4. Người nhìn một lượt, chấm 10 cái
```

Bước 3 dùng lại `scripts/style-packs/render-real-frames.ts` và
`render-pack-sheets.ts` đã có — chúng vốn sinh ra để làm đúng việc này.

### Số đo thật trong phiên này

- Tải + kiểm dấu Việt 8 font: **8 giây** → 6 đạt, 2 trượt
- Sinh 7 ứng viên hoàn chỉnh (SVG → PNG trắng → tô màu → render lên footage
  thật → contact sheet): **4 giây**, script 95 dòng bash
- Suy ra 200 ứng viên ≈ **2 phút**

Xem `bay-ung-vien-sinh-tu-dong.jpg` và `generate-style-candidates.sh`.
Trong 7 cái đó, nhìn 15 giây loại được 4. Đúng mô hình: máy sinh rẻ, người lọc nhanh.

## Cạm bẫy đã đo được, không phải đoán

**1. `magick` render SVG sai.** Cùng tệp `arrow-curve.svg`: `rsvg-convert` ra
đúng, `magick` **mất hẳn thân mũi tên** vì rơi về bộ MSVG nội bộ. Đây là lý do
SVG→PNG chỉ được xảy ra lúc build — một phụ thuộc render âm thầm sai còn tệ hơn
một phụ thuộc thiếu hẳn.

**2. Metadata font nói dối.** `Caveat` và `Bebas Neue` khai có tiếng Việt nhưng
render `Ở Ự ượ` ra ô vuông. Phải render chuỗi `Ệ Ễ Ở Ự Ỳ ỹ Đ đ ượ ầ` bằng chính
tệp đó rồi bắt tofu. Xem `kiem-dau-viet-truot.png` / `kiem-dau-viet-dat.png`.

**3. Đồ hoạ không sống được bằng hằng số.** Chữ nền để `alpha 0.22`: trên cảnh
cửa sổ đêm gần như biến mất, trên cảnh tường trắng rõ mồn một. Cùng con số, hai
kết quả trái ngược. `auto-grade.ts` **đã đo độ sáng khung hình** — chỉ là chưa ai
dùng số đó cho việc này.

**4. Chỗ đặt phải suy từ tỉ lệ khung gốc.** Footage của người dùng quay **ngang
1280×720** rồi crop dọc, nên đáy khung là bàn tay và mic — dải màu đặt ở đáy che
đúng vào đó. Trên khung dọc quay sẵn thì đáy thường trống.

**5. Ba lỗi thiết kế đầu tiên đều cùng một dạng.** Vòng khoanh vàng đè nền vàng,
dải màu chiếm chỗ mà không mang nội dung, khối chữ căn giữa cãi nhau với ý đồ
khối vuông. Không cái nào là lỗi toạ độ — **đồ hoạ và chữ tranh nhau cùng một
việc**. Đó là lý do cần luật loại trừ trong manifest.

**6. Phải xem ở kích thước thật.** Ở 430px cả ba bộ thử đều trông ổn; ở 1080px
hai cái hỏng. Xem `ba-bo-thu-tren-footage-that.jpg`.

## Lộ trình đề xuất

```
Đợt 1 · 0 hình     → font mới (serif + script có dấu Việt)
                     + mảng màu + nền chữ từng tiếng + cặp font
                     → chi phí ~0, đủ tách 10 pack ra rõ rệt
Đợt 2 · hình sinh   → khung, lưới, sọc, gạch chân từ tham số
                     → thêm kiến trúc assets ba tầng
Đợt 3 · nét tay     → roughjs + lucide-static, có graphics:sheet canh
Sau, riêng          → tách nền người (chalk/ignite) — quyết định độc lập
Không làm           → texture, collage, sticker vẽ tay
```

Điểm đáng chú ý: **đợt 1 không đụng gì tới đồ hoạ**, mà `focus` chứng minh nhóm
đó một mình đã tạo ra style dễ nhận ra bậc nhất.

## Rủi ro

- **Đồ hoạ dở hại hơn phụ đề dở.** Phụ đề xấu vẫn đọc được và người xem lướt qua;
  đồ hoạ xấu làm cả video trông rẻ tiền và nó choán khung suốt thời lượng.
  Hiện chưa có gì bắt được "cái này xấu" — `overlay-parity` chỉ bắt được "hai bên
  vẽ lệch nhau".
- **Đồ hoạ lỗi mốt trước font.** Sans đậm trắng dùng được mười năm; khung neon là
  dấu vân tay của đúng giai đoạn này. Bộ đồ hoạ phải thay được rẻ.
- **Mỗi trục đồ hoạ thêm vào là thêm một chỗ cho trang xem và bản in lệch nhau.**
- **Nguồn asset ngoài**: chỉ lấy từ nơi có API và giấy phép khai rõ (Google Fonts
  API, npm MIT/ISC), kèm `LICENSE-*.txt` như đã làm với font. Không scrape.

## Nghiệm thu

1. Dựng contact sheet 10 pack trên **cùng một khung hình thật** của người dùng —
   người lạ nhìn phải gọi tên được ít nhất 6 bộ khác nhau mà không cần đọc chữ.
2. `check:style-pack` chặn được: pack trùng chữ ký đồ hoạ, tương phản dưới ngưỡng,
   vi phạm luật loại trừ.
3. Mọi ảnh kiểm phải xem ở **1080×1920**, không phải bản thu nhỏ.
4. `overlay-parity` vẫn xanh sau khi thêm trục đồ hoạ.

## Quyết định đã chốt

1. **Đợt 1 làm 3 pack**, không sửa cả 10. Nên chọn 3 pack ở 3 `theme` khác nhau
   (`manh` · `ke-chuyen` · `gon`) để đo được biên độ — bảy pack còn lại giữ
   nguyên, làm nhóm đối chứng.
2. **Mỗi pack hai họ font**, không chỉ đổi trọng lượng. Một họ cho *lời* (phụ đề
   chạy theo tiếng nói), một họ cho *cảm xúc* (cụm cần đọng lại) — đúng cách
   `Prime` luân phiên sans trắng ↔ script cyan. Kéo theo: phải bổ sung serif và
   script có đủ dấu Việt trước khi làm gì khác.
3. **Tiêu đề lớn**: nội dung do AI đề xuất một câu, người sửa được — tái dùng
   `ai-opening.ts` chứ không thêm chặng AI mới.

   *Phần neo tự chốt (người dùng trả lời phần nội dung):* tiêu đề là **một cho cả
   video** nên đặt thành **cột trên `projects`**, không thành hàng trong
   `elements`. Ba lý do:
   - `elements` neo vào `from_word_id`/`to_word_id`, mà tiêu đề không thuộc tiếng
     nào — nó phải sống sót khi người dùng cắt mất câu đầu.
   - Tiền lệ đã có và đã đúng: bộ dáng chữ cũng nằm trong **một cột trên
     `projects`**, và chính vì vậy mà đổi bộ dáng không đụng nội dung người dùng
     đã chỉnh tay.
   - Một cột thì không cần luật giữ/đè, không cần dialog xác nhận.

   Watermark · thanh tiến trình · CTA cuối video sau này đi cùng đường này.
4. **Chữ trang trí được miễn `SAFE`** — tràn mép là dáng, không phải lỗi.
   Bắt buộc kèm theo: **hai đường vẽ tách bạch**. Chữ phải-đọc-được vẫn đi qua
   `SAFE` · `MAX_BLOCK_SHARE` · `MAX_LINES` · `MIN_SCALE`; chữ chỉ-để-nhìn đi
   đường riêng, không đụng vào bảo đảm cũ. Trộn hai đường là mất bảo đảm "chữ
   không bao giờ tràn khung" một lần cho tất cả.

   Kèm điều kiện phát hiện lúc validate: repo chưa có phép kiểm nào canh bảo đảm
   đó, nên đợt 1 phải dựng `scripts/layout-guard/` trước khi nới `SAFE`.
5. **Tách nền người: gác.** Không đo, không thử trong đợt này. `chalk` · `ignite`
   nằm ngoài phạm vi.
