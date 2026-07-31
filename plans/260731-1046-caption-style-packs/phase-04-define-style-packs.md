---
phase: 4
title: "Define Style Packs"
status: done
priority: P1
effort: "1d"
dependencies: [1, 3]
---

# Phase 4: Define Style Packs

## Overview

Điền giá trị thật cho 5 bộ dáng, đặt tên tiếng Việt, rồi render cùng một đoạn
video qua cả 5 và đặt cạnh nhau mà soi.

Phase này là **thiết kế**, không phải lập trình. Phần code chỉ là một mảng hằng.

## Key Insights

**`defaults` để giống hệt nhau ở cả 5.** Đây là cách né rủi ro đã chốt: 5 mặc định
(`band` `align` `emphasis` `reveal` `shape`) là thứ duy nhất được ghi vào từng
`element` lúc sinh (`caption-elements.ts:56`). Để chúng giống nhau thì đổi bộ dáng
về sau không đụng một hàng `elements` nào — không cần dialog xác nhận, không cần
luật giữ/đè, không cần đếm "đổi 47 giữ 6".

Giá phải trả: 5 bộ dáng không khác nhau ở bố cục. Chấp nhận được, vì đổi `center`
sang `left` hầu như không ai nhận ra, trong khi đổi từ chữ thường trắng mảnh sang
CHỮ HOA vàng chạy nhanh thì đọc ra hai sản phẩm khác hẳn.

**Mỗi cặp phải khác nhau ở ít nhất HAI trục nhìn thấy được.** Chỉ đổi màu là hai
bộ dáng đọc ra như một bộ có hai lựa chọn màu — không đáng một ô riêng.

**Số bộ dáng phụ thuộc phase 1.** Nếu chỉ 1–2 font dùng được thì phân biệt bằng
hoa/thường + màu nhấn + nhịp + viền. Vẫn ra 5 bộ khác nhau rõ, chỉ là trục font
không gánh được phần việc của nó.

**Mọi font phải nằm trong `assets/fonts/`.** Đã chốt ở phase 1: không trỏ vào font
hệ thống. Và cần quyết một câu ngay tại phase này: **bộ dáng gốc có giữ Arial
không?** Giữ thì bản render cũ không đổi nhưng Arial không phát hành kèm được;
đổi thì mọi dự án cũ xuất lại sẽ ra khác trước.

## Requirements

- 5 bộ dáng, mỗi bộ có tên tiếng Việt gợi **cảm giác**, không gợi thương hiệu
- `defaults` giống hệt nhau ở cả 5
- Mọi font nằm trong `assets/fonts/`, có giấy phép phát hành kèm
- Mỗi cặp khác nhau ≥ 2 trục nhìn thấy được
- Mọi font đều nằm trong danh sách đã kiểm ở phase 1

## Architecture

Bản nháp — con số cuối chốt sau khi soi ảnh thật:

| Tên | Chữ | Màu nhấn | Tách nền | Nhịp | Ghi chú |
|---|---|---|---|---|---|
| **Gạch mộc** | thường | — | viền mảnh + quầng | chạy từng tiếng | đúng dáng hiện nay, là mốc so |
| **Chữ hoa vàng** | HOA | `#FFD400` | viền dày `0.03` | chạy từng tiếng | `lineHeight` theo số đo phase 1 |
| **Nhấn xanh** | thường | `#00E676` | viền mảnh + quầng | chạy từng tiếng | |
| **Nét thưa** | thường | trắng | chỉ quầng, không viền | chạy từng tiếng | `lineHeight 1.25`, `wordGap 0.2` |
| **Đứng yên** | thường | `#FFD400` | viền mảnh | **cả cụm hiện một lượt** | dáng phụ đề sạch — trục `reveal` gánh cả bộ này |

Cả 5 bộ chỉ cần ba trục của phase 3. Bộ thứ sáu — **Nền khối** (chữ hoa trắng
trên nền đen) — đã bỏ khỏi vòng này cùng với trục `box`; ghi lại đây để vòng sau
khỏi nghĩ lại từ đầu.

## Related Code Files

- Modify: `server/style-pack.ts` — mảng 6 pack
- Read: `plans/.../reports/font-audit.md` — danh sách font và `lineHeight` tối thiểu
- Create: `plans/.../reports/style-packs-preview.md` — kết quả soi ảnh

## Implementation Steps

1. **Đọc lại `font-audit.md`** — gán font cho từng bộ dáng theo danh sách đã kiểm
2. **Chốt font của bộ dáng gốc** — giữ Arial hay đổi sang font trong repo. Đây là
   câu duy nhất ở phase này ảnh hưởng tới dự án đã có
3. **Điền giá trị** cho cả 5 pack trong `style-pack.ts`
4. **Đặt tên** — tiếng Việt, ngắn, gợi cảm giác. Tên là thứ người dùng đọc ở
   phase 6 nên đừng để tới lúc đó mới nghĩ
5. **Render so cạnh nhau** — cùng một đoạn 15 giây có cả cụm ngắn lẫn cụm dài, qua
   cả 5 pack. Cụm dài quan trọng: nó là cụm đang chạm trần bề rộng
6. **Soi và loại** — hai bộ nào khó phân biệt thì sửa một cái cho khác hẳn, hoặc
   bỏ. **4 bộ phân biệt được tốt hơn 6 bộ mà có hai cặp na ná**
6. **Kiểm chữ hoa với cụm dài nhất** — chỗ dễ tràn khung nhất
7. **Ghi `reports/style-packs-preview.md`** — ảnh + nhận xét từng bộ

## Todo List

- [x] Gán font theo `font-audit.md`
- [x] Chốt font của bộ dáng gốc (giữ Arial hay đổi)
- [x] Điền giá trị 5 pack
- [x] Đặt tên tiếng Việt
- [x] Render đoạn mẫu qua cả 5
- [x] Soi, loại bộ trùng cảm giác
- [x] Kiểm chữ hoa với cụm dài nhất
- [x] Ghi báo cáo kèm ảnh

## Success Criteria

- [x] 5 bộ dáng, mỗi cặp khác nhau ≥ 2 trục nhìn thấy được
- [x] `defaults` giống hệt nhau ở cả 5 — kiểm được bằng mắt trong mã nguồn
- [x] Mọi font trỏ vào `assets/fonts/`, không còn font hệ thống
- [x] Không bộ nào tràn khung ở cụm dài nhất, kể cả bộ chữ hoa
- [x] Ảnh so sánh lưu lại được để phase 6 dùng làm ô mẫu

## Risk Assessment

| Rủi ro | Mức | Cách xử |
|---|---|---|
| Các bộ na ná nhau | **cao** | Luật ≥ 2 trục. Soi ảnh thật, đừng tin bảng giá trị |
| Font ít quá, không đủ phân biệt | vừa | Đã lường ở phase 1. Dồn sang hoa/thường + màu + nhịp |
| Bộ chữ hoa tràn khung | vừa | Kiểm bằng cụm dài nhất, không phải cụm mẫu |
| Đổi font bộ dáng gốc → dự án cũ xuất lại ra khác | vừa | Chốt ở bước 2. Giữ Arial thì không đổi gì nhưng vướng giấy phép; đổi thì phải nói rõ với người dùng |
| Đặt tên nghe như thương hiệu người khác | thấp | Tên gợi cảm giác: "Gạch mộc", "Nét thưa" — không mượn tên có sẵn |

## Next Steps

Phase 5 làm cho mỗi dự án chọn được một trong 5 bộ này.
