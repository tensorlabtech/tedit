---
phase: 7
title: "Style Switch In Editor"
status: pending
priority: P2
effort: "0.5d"
dependencies: [6]
---

# Phase 7: Style Switch In Editor

## Overview

Một dòng `Dáng: <tên>` cạnh khung xem, bấm vào mở Dialog đổi bộ dáng. Bên trái là
khung xem lớn tại vạch hiện tại, bên phải là lưới 5 ô. Bấm ô là khung xem đổi
ngay, chưa lưu.

## Key Insights

**Đổi được thì người ta mới dám thử.** Quyết định không hoàn tác được thì người
dùng chọn mặc định — đó là phản xạ chung, và nó dẫn ngược về đúng chỗ xuất phát:
mọi video giống nhau, chỉ khác là có thêm một màn chọn mà ai cũng bấm "để nguyên".

**Không cần dialog xác nhận, không cần đếm.** Vì `defaults` giống hệt nhau ở cả 5
bộ (phase 4), đổi bộ dáng chỉ đụng phần vẽ — không có cụm nào bị mất, không có
luật merge nào. Nếu thấy mình đang định viết câu *"đổi 47 cụm · giữ 6 cụm bạn đã
sửa"* thì nghĩa là phase 4 đã làm sai: `defaults` đang khác nhau giữa các bộ.

**Không thêm tab thứ tư vào cột phải.** Ba tab (Soát · Sửa · Kho nhạc) đã đủ tải,
và bộ dáng là chuyện **cấp dự án** — đặt trong Inspector là sai cấp, vì Inspector
là nơi sửa *vật đang chọn*.

**Dialog vì đây là việc làm một lần cho cả dự án**, cần diện tích để so sánh, và
không đáng chiếm chỗ vĩnh viễn trong ba cột.

**Khung xem hiện chưa có chỗ để đặt dòng đó.** `preview-panel.tsx:147` là
`<Card size="sm">` chứa thẳng `CardContent` — không có `CardHeader`. Đã chốt:
**thêm `CardHeader`** cho thẻ khung xem. `CardHeader` tự thành lưới hai cột khi có
`CardAction` (§16 của upload spec đã dùng đúng tính chất này), nên tên bộ dáng đứng
bên trái, nút đổi bên phải, và thẻ chỉ cao thêm một hàng tiêu đề.

## Requirements

- Dòng `Dáng: <tên>` cạnh khung xem, có nút đổi
- Dialog: khung xem lớn + lưới 5 ô
- Bấm ô → khung xem đổi ngay, **chưa ghi**
- Nút nhận và nút thôi
- Đóng Dialog bằng phím Esc = thôi, không ghi

## Architecture

```
┌─ Đổi dáng chữ ──────────────────────────────────┐
│  ┌──────────────┐   ┌────┐┌────┐┌────┐          │
│  │  khung xem   │   │ Aa ││ Aa ││ Aa │          │
│  │  tại vạch    │   └────┘└────┘└────┘          │
│  │  hiện tại    │   ┌────┐┌────┐┌────┐          │
│  └──────────────┘   │ Aa ││ Aa ││ Aa │          │
│                     └────┘└────┘└────┘          │
│                              [Thôi] [Dùng dáng] │
└──────────────────────────────────────────────────┘
```

Khung xem lớn vẽ **cụm chữ tại vạch hiện tại** — thứ người dùng đang nhìn, không
phải cụm đầu video. Ô mẫu nhỏ tái dùng component của phase 6.

## Related Code Files

- Create: `src/routes/editor/style-switch-dialog.tsx`
- Modify: `src/routes/editor/preview-panel.tsx:147` — thêm `CardHeader` +
  `CardAction` cho thẻ khung xem (hiện chỉ có `CardContent`)
- Reuse: `src/routes/pipeline/style-preview-tile.tsx` (phase 6)
- Modify: `src/lib/api.ts` — dùng lại `PATCH` của phase 5

## Implementation Steps

1. **Thêm `CardHeader` cho thẻ khung xem** — tên bộ dáng bên trái, nút đổi trong
   `CardAction` bên phải. Chữ không đậm ở nút, theo luật "chữ không đậm ở thành
   phần tương tác". Đo lại chiều cao khung xem sau khi thêm: nó có sàn riêng, đừng
   để tiêu đề ép nó xuống dưới sàn
2. **Dialog** với hai vùng: khung xem lớn và lưới 5 ô. Đệm 20px theo thang của
   design system
3. **Chọn tạm** — bấm ô đổi khung xem, giữ trong `state`, chưa gọi API
4. **Nhận** — `PATCH` rồi đóng, chữ trên bàn dựng vẽ lại theo bộ dáng mới
5. **Thôi / Esc** — bỏ chọn tạm, không ghi gì
6. **Kiểm cụm đã sửa** — sửa vài cụm rồi đổi bộ dáng: nội dung và bố cục của chúng
   phải y nguyên, chỉ font/màu/nhịp đổi

## Todo List

- [ ] `CardHeader` + `CardAction` cho thẻ khung xem
- [ ] Đo lại chiều cao khung xem sau khi thêm tiêu đề
- [ ] Dialog hai vùng
- [ ] Chọn tạm, chưa ghi
- [ ] Nhận / Thôi / Esc
- [ ] Kiểm cụm đã sửa không bị đụng

## Success Criteria

- [ ] Đổi bộ dáng → chữ trên bàn dựng đổi ngay, không phải tải lại trang
- [ ] Cụm người dùng đã sửa giữ nguyên nội dung và bố cục
- [ ] Bảng `elements` **không đổi hàng nào** sau khi đổi bộ dáng
- [ ] Thôi hoặc Esc thì không ghi gì
- [ ] Xuất video ra đúng bộ dáng đang chọn

## Risk Assessment

| Rủi ro | Mức | Cách xử |
|---|---|---|
| Phase 4 lỡ để `defaults` khác nhau → đổi bộ dáng làm mất bố cục | vừa | Kiểm ở tiêu chí "bảng `elements` không đổi hàng nào". Sai thì sửa phase 4, đừng vá bằng dialog xác nhận |
| Khung xem lớn vẽ khác bản xuất | vừa | Dùng đúng đường vẽ của trang xem, và `/_dev/overlays` đã canh hai bên khớp |
| Thêm `CardHeader` làm khung xem tụt dưới sàn chiều cao | vừa | Khung xem có `min-h-80` ở màn hẹp. Đo ở cả 1160px lẫn 720px sau khi thêm |
| Dialog che mất bàn dựng, mất ngữ cảnh | thấp | Khung xem trong Dialog vẽ đúng vạch hiện tại, nên ngữ cảnh đi theo |

## Next Steps

Hết nhánh bộ dáng chữ. Phase 8–10 là ba nhánh độc lập: nhạc, b-roll, hook.
