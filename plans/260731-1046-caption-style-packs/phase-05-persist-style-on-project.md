---
phase: 5
title: "Persist Style On Project"
status: done
priority: P1
effort: "0.5d"
dependencies: [4]
---

# Phase 5: Persist Style On Project

## Overview

Thêm cột `style_pack` vào bảng `projects`, luồn nó xuống pipeline và render. Chưa
có giao diện nào — kiểm bằng cách sửa CSDL bằng tay.

Dữ liệu trước giao diện: làm ngược lại thì không biết nút bấm có thật sự đổi được
gì không.

## Key Insights

**Đây là chỗ lời hứa "đổi bộ dáng an toàn" thành sự thật.** Cả bộ dáng nằm trong
**một** trường trên `projects`; bảng `elements` không có cột nào của nó. Đổi bộ
dáng = ghi một dòng, video vẽ lại theo. Người dùng đã sửa 30 cụm cũng không mất gì,
vì thứ họ sửa là *nội dung* và *bố cục*, không phải font.

**Dự án cũ phải rơi về pack `goc`.** `db.ts` đã có cơ chế vá cột dần — cột mới với
`DEFAULT` là dự án cũ ra đúng như trước, không cần migration riêng.

**`defaults` đọc lúc SINH, phần vẽ đọc lúc RENDER.** Hai thời điểm khác nhau, và
đó là lý do đổi bộ dáng chỉ đổi được phần vẽ. Viết rõ chỗ này trong mã, vì nó là
bất biến mà mọi phase sau dựa vào.

## Requirements

**Functional**
- Cột `style_pack` trên `projects`, mặc định `goc`
- `pipeline.ts` đọc pack khi sinh chữ (lấy `defaults`)
- `render.ts` đọc pack khi xuất video (lấy phần vẽ)
- API đọc/ghi pack của một dự án

**Non-functional**
- Dự án cũ không có cột → ra đúng như trước, không lỗi
- Pack không tồn tại (tên rác trong CSDL) → rơi về `goc`, không sập

## Architecture

```
projects.style_pack  ──┬─→ pipeline.ts   lúc SINH chữ   → defaults
                       └─→ render.ts     lúc XUẤT video → font, màu, nhịp
```

API:
- `GET /api/projects/:id` trả thêm `stylePack`
- `PATCH /api/projects/:id` nhận `stylePack`
- Đi qua `auth-guard.ts` như mọi route khác — luật phân quyền áp theo dạng đường
  dẫn nên route mới mặc định đã bị khoá, chỉ cần khai đúng chỗ

## Related Code Files

- Modify: `server/db.ts:353` — thêm `["projects", "style_pack", "TEXT DEFAULT 'goc'"]`
  vào danh sách vá cột
- Modify: `server/pipeline.ts` — đọc pack, truyền `defaults` cho `createCaptionElements`
- Modify: `server/caption-elements.ts:56` — nhận `defaults` thay vì chuỗi cứng
- Modify: `server/render.ts` — nhận pack thay vì đọc pack `goc`
- Modify: `server/main.ts` — trả và nhận `stylePack`
- Modify: `server/ownership.ts` / `auth-guard.ts` — nếu cần khai route mới
- Modify: `src/lib/api.ts` — hàm gọi phía web

## Implementation Steps

1. **Thêm cột** ở `db.ts` theo đúng lối vá cột dần đang dùng
2. **Hàm `readStylePack(projectId)`** — đọc cột, tra trong mảng 6 pack, không thấy
   thì trả `goc`. Một chỗ duy nhất chịu trách nhiệm rơi-về-mặc-định
3. **`caption-elements.ts` nhận `defaults`** — thay 4 giá trị cứng trong câu
   `INSERT` bằng tham số. Giữ nguyên ghi chú ở đó về lý do chọn `taper` (§20), chỉ
   sửa cho nó nói về pack thay vì nói về hằng. **Đừng đụng cột `elements.layout`**
   — nó là di sản đã chết (`db.ts:373`, xem ghi chú ở phase 3), sửa câu `INSERT`
   mà tiện tay ghi vào nó là làm sống lại một mô hình đã bỏ
4. **`pipeline.ts` truyền pack xuống** cả nhánh sinh chữ lẫn nhánh xuất video
5. **API** — trả `stylePack` trong `GET`, nhận trong `PATCH`. Ghi giá trị không có
   trong danh sách thì trả 400, đừng nhận rồi rơi về mặc định trong im lặng
6. **Kiểm bằng tay** — `UPDATE projects SET style_pack='chu-hoa-vang' WHERE id=…`
   rồi xuất lại. Video phải đổi dáng, `SELECT * FROM elements` phải y nguyên

## Todo List

- [x] Cột `style_pack` + vá cột dần
- [x] `readStylePack` với luật rơi về `goc`
- [x] `caption-elements.ts` nhận `defaults`
- [x] `pipeline.ts` truyền pack
- [x] `render.ts` nhận pack
- [x] API `GET`/`PATCH`
- [x] Kiểm bằng `UPDATE` tay

## Success Criteria

- [x] Đổi cột bằng tay rồi xuất lại → video đổi dáng
- [x] Bảng `elements` **không đổi một hàng nào** sau khi đổi pack
- [x] Dự án cũ (không có cột) xuất ra đúng như trước
- [x] Tên pack rác trong CSDL → rơi về `goc`, không sập
- [x] `npm run check:ownership` sạch

## Risk Assessment

| Rủi ro | Mức | Cách xử |
|---|---|---|
| Route mới lọt lưới phân quyền | vừa | Luật áp theo dạng đường dẫn ở **một** cổng (`auth-guard.ts`), route mới mặc định đã khoá. Chạy `check:ownership` |
| `defaults` bị đọc lúc render thay vì lúc sinh | vừa | Phá bất biến. Kiểm: đổi pack rồi so bảng `elements` — khác một hàng là sai |
| Dự án đang chạy pipeline mà đổi pack | thấp | Pack đọc một lần lúc bắt đầu chặng. Đổi giữa chừng chỉ ảnh hưởng lượt sau |
| Tên pack rác làm sập render | thấp | `readStylePack` là cổng duy nhất, luôn trả pack hợp lệ |

## Next Steps

Phase 6 cho người dùng chọn ở màn chờ. Phase 7 cho đổi trong bàn dựng.
