# Ba trục mới + Năm bộ dáng — kết quả

**Ngày:** 2026-07-31 · **Phase:** 3 và 4 · **Trạng thái:** xong

## Kết luận một dòng

Ba trục đã chạy ở cả hai đường vẽ, năm bộ dáng đọc ra năm sản phẩm khác nhau, và
**50/50 tổ hợp (5 bộ × 10 cụm) khớp số dòng giữa khung xem và bản xuất**.

Ảnh so cạnh nhau: `reports/style-packs/sosanh-*.png`.

## Phase 3 — ba trục

### Trục 1 · `reveal` cho chữ

`motion.reveal: "per-word" | "none"`. Trước đây chữ **luôn** chạy từng tiếng,
không tắt được — `reveal` chỉ áp cho tư liệu chèn.

- Máy chủ: `alphaExpr` trả một HẰNG thay vì biểu thức theo `t`, `positionExpr`
  trả hai số cố định. Không phải "biểu thức luôn bằng hằng" — ffmpeg sẽ phải tính
  lại nó ở mỗi khung cho mỗi tiếng, và năm mươi cụm phụ đề thì đó là tiền thật.
- Trang xem: `revealStyle` trả `{ opacity: 1, transform: "none" }`. **Không trả
  `{}`** — thẻ sẽ giữ nguyên `opacity`/`transform` của lượt vẽ trước và cụm đứng
  lại ở giữa chừng.
- `enableRange` không đụng tới: cụm vẫn vào và ra đúng khoảng từ nó neo vào.

Bộ **Đứng yên** dùng trục này, và một mình nó đã đủ làm bộ đó đọc ra khác hẳn.

### Trục 2 · `letterCase`

`letterCase: "as-typed" | "upper"`, áp bằng `styleCase()` — **một hàm cho cả hai
đường vẽ**.

Viết hoa **ngay tại chỗ tách tiếng** (`splitPieces` ở máy chủ, `buildRows` ở
trang xem), không viết hoa lúc vẽ: mọi phép đo phía sau chạy trên chuỗi đó, mà
chữ hoa rộng hơn chữ thường. Đo bằng chuỗi thường rồi in ra chuỗi hoa là chữ tràn
khung.

Trang xem **không dùng `text-transform: uppercase`** vì đúng lý do đó: làm thế là
đo chuỗi gốc mà vẽ chuỗi hoa, cụm chữ tự rộng thêm sau lưng phép đo.

`elements.content` không đổi — người dùng mở bảng sửa vẫn thấy đúng thứ họ gõ.
Đối chiếu từ khoá cũng chạy trên chuỗi gốc.

### Trục 3 · `color.key`

Trước: `COLOR.main` trắng 0,92 và `COLOR.soft` trắng 1,00 — chênh 0,08 độ đục
trên cùng một màu trắng, tức là trên nền video **không nhìn ra**.

Kèm theo một sửa về luật, không phải về giá trị:

> **MÀU theo từ khoá THẬT, CỠ theo trục nhấn.**

Trước đây hai việc bị trộn: ở `keyword-large`, cụm chưa đánh dấu tiếng nào thì
`hero` là tiếng ĐẦU — chọn theo vị trí chứ không theo nghĩa — mà nó vẫn được tô
màu từ khoá. Ở `mixed-size` còn nặng hơn: không có từ khoá thì các tiếng chẵn lẻ
thành `big`, tức **một nửa cụm** đổi màu. Với `COLOR.soft` trắng thì chẳng ai
thấy; với màu nhấn thật (vàng, xanh) thì nó thành lỗi lộ liễu ngay.

Nay: cỡ vẫn theo trục nhấn, màu chỉ theo `piece.keyword`.

## Phase 4 — năm bộ dáng

| Tên | Font | Chữ | Màu nhấn | Tách nền | Mật độ | Nhịp |
|---|---|---|---|---|---|---|
| **Gạch mộc** | Be Vietnam Pro ExtraBold Italic | thường, nghiêng | trắng | viền 0,022 + quầng | 0,15 · 1,0 · 0,12 | từng tiếng |
| **Chữ hoa vàng** | Anton | **HOA**, đứng hẹp | `#FFD400` | viền **0,03** + quầng | 0,15 · **1,4** · 0,12 | từng tiếng |
| **Nhấn xanh** | Archivo Expanded Black | thường, **đứng rộng** | `#00E676` | viền 0,022 + quầng | **0,135** · 1,05 · 0,12 | từng tiếng |
| **Nét thưa** | Barlow Condensed Bold Italic | thường, nghiêng hẹp | trắng | **không viền**, chỉ quầng đậm | **0,16** · **1,25** · **0,2** | từng tiếng |
| **Đứng yên** | Lexend Bold | thường, đứng | `#FFD400` | viền 0,022 + quầng | **0,13** · 1,15 · **0,14** | **cả cụm một lượt** |

Mật độ đọc là `maxScale · lineHeight · wordGap`.

### Luật ≥ 2 trục — đã kiểm từng cặp

| Cặp | Khác nhau ở |
|---|---|
| Gạch mộc ↔ Chữ hoa vàng | font · HOA · màu · viền · bước dòng (5) |
| Gạch mộc ↔ Nhấn xanh | font · nghiêng→đứng · màu nhấn · trần cỡ (4) |
| Gạch mộc ↔ Nét thưa | font · **mất viền** · bước dòng · khoảng tiếng (4) |
| Gạch mộc ↔ Đứng yên | font · nghiêng→đứng · **nhịp** · màu nhấn (4) |
| Chữ hoa vàng ↔ Nhấn xanh | HOA↔thường · hẹp↔rộng · vàng↔xanh (3) |
| Chữ hoa vàng ↔ Nét thưa | HOA↔thường · viền dày↔không viền · font (3) |
| Chữ hoa vàng ↔ Đứng yên | HOA↔thường · nhịp · font (3) |
| Nhấn xanh ↔ Nét thưa | rộng↔hẹp · viền↔không · xanh↔trắng (3) |
| Nhấn xanh ↔ Đứng yên | font · nhịp · xanh↔vàng (3) |
| Nét thưa ↔ Đứng yên | font · nhịp · không viền↔có viền (3) |

Không cặp nào chỉ khác một trục.

### `defaults` giống hệt nhau ở cả 5

Khai một lần trong `SHARED_DEFAULTS`, năm bộ cùng trỏ vào — kiểm được bằng mắt
trong mã nguồn, không phải bằng cách so năm khối giá trị.

`{ align: "center", emphasis: "taper", reveal: "none" }`.

**Không có `band`** trong `defaults`, khác bản nháp của plan: dải đã là một cột
riêng của dự án (`projects.subtitle_band`) và pipeline đọc nó ở
`pipeline.ts:423`. Thêm vào bộ dáng nữa là hai nguồn sự thật cho cùng một thứ.

### Cách viết: mỗi bộ chỉ khai ĐIỀU NÓ KHÁC

`BASE` giữ mười lăm trường chung, mỗi bộ spread rồi ghi đè. Viết đủ cho từng bộ
thì khác biệt chìm trong chỗ giống nhau — mà luật "≥ 2 trục" chỉ kiểm được bằng
mắt khi chỗ khác nhau đứng riêng ra.

`server/style-pack-catalog.ts` (dữ liệu) tách khỏi `server/style-pack.ts` (kiểu
và hàm dùng chung): hai tệp trả lời hai câu khác nhau, và câu *"có những bộ dáng
nào"* không nên nằm sau hai trăm dòng khai kiểu.

## Lỗi CÓ SẴN đã sửa: chữ tràn khung ở kiểu `taper`

Đo trên cụm 15 tiếng: chữ vượt mép phải **12% bề rộng khung**. Đã dựng lại bản
mã trước phiên làm việc và render cùng cụm đó — **ra y hệt**, nên đây là lỗi có
sẵn chứ không phải do gom hằng số.

Nguyên nhân: `fitRow` bọc `Math.max(MIN_SCALE, …)` ngoài phép dò cỡ. Hàng nào chỉ
vừa ở cỡ 0,07 vẫn bị kéo lên sàn 0,09 và chạy hẳn ra ngoài. Hàng đã bị chốt số
dòng từ trước (`packRows` chia theo `MAX_LINES`) nên sàn và bề rộng **không thể
cùng thoả**.

Sửa: bỏ sàn khỏi `fitRow` ở CẢ HAI đường vẽ. Giữa "chữ nhỏ hơn ngưỡng đọc" và
"chữ ra ngoài khung" thì bảo đảm *không bao giờ tràn* là thứ không được hy sinh —
cùng lý lẽ với phép kẹp `x` ở cuối `placeWords`.

Sàn vẫn còn ở `text-layout.ts`, nơi phép bẻ dòng dùng nó để quyết định "cụm này
phải tách".

**Ảnh hưởng:** dự án cũ có cụm `taper` dài xuất lại sẽ ra chữ nhỏ hơn ~5%. Đo lại
10 tổ hợp: **8/10 vẫn lệch 0 điểm ảnh**, 2 tổ hợp `taper` đổi đúng như chờ đợi.

## Đã kiểm

- [x] Tắt `reveal` → cả cụm đứng yên, không tiếng nào trượt vào
- [x] Chữ hoa không tràn khung, không đè dòng trên (`lineHeight` 1,4 theo số đo)
- [x] Đánh dấu từ khoá ở kiểu `even` **nhìn thấy được** — ảnh `sosanh-tu-khoa-deu.png`
- [x] `elements.content` không đổi khi bật chữ hoa (viết hoa lúc tách tiếng, không ghi CSDL)
- [x] 50/50 tổ hợp khớp số dòng giữa hai đường vẽ
- [x] Không bộ nào tràn khung ở cụm dài nhất
- [x] `defaults` giống hệt nhau ở cả 5 — một hằng dùng chung
- [x] Mọi font trỏ vào `assets/fonts/`, cả năm đều vào được bản build
- [x] `npm run typecheck` · `npm run lint` · `npm run build` sạch

## Công cụ để lại

```
scripts/style-packs/render-pack-sheets.ts   in 4 cảnh × 5 bộ dáng qua đường vẽ thật
scripts/overlay-parity/                      bắt lệch hai đường vẽ, nay chạy cả 5 bộ
```

## Câu chưa dứt

1. **Bộ dáng gốc giữ màu nhấn TRẮNG** — nên trục từ khoá vẫn vô hình ở riêng bộ
   đó. Đúng theo bản nháp của plan ("Gạch mộc … màu nhấn —"), nhưng nó nghĩa là
   người dùng bộ gốc vẫn gặp đúng vấn đề mà trục 3 sinh ra để chữa.
2. **Chỗ tách cụm không mô phỏng kiểu `taper`** — `buildCaptionGroups` quyết định
   tách bằng `layoutText` (luật của kiểu `even`), trong khi mặc định của sản phẩm
   là `taper` với cách chia hàng khác hẳn. Đó là gốc rễ của lỗi tràn khung vừa
   sửa; phép sửa hiện tại chặn hậu quả chứ không chặn nguyên nhân.
