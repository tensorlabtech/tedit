---
phase: 2
title: "Extract Style Constants"
status: pending
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 2: Extract Style Constants

## Overview

Gom những hằng số đang quyết định dáng chữ vào một kiểu `StylePack`, rồi luồn nó
xuống các chỗ đang đọc hằng. Khai **một** pack duy nhất mang đúng giá trị hiện
hành.

Phase nhàm chán nhất và quan trọng nhất. Mục tiêu: video xuất ra **giống hệt**
trước và sau.

## Requirements

**Functional**
- Có kiểu `StylePack` và một pack `goc` mang đúng giá trị đang chạy
- Cả máy chủ (ffmpeg) lẫn trang xem (CSS) đọc chung một pack

**Non-functional**
- **Không đổi hành vi.** Render một dự án có sẵn trước và sau phải ra tệp giống
  nhau tới từng pixel

## Key Insights

**Chỉ nâng thứ đang là hằng LÚC VẼ.** Font, màu, viền, quầng, mật độ chưa bao giờ
được lưu vào bảng `elements` — đó chính là lý do đổi style về sau không đụng dữ
liệu người dùng. Giữ nguyên tính chất này là toàn bộ giá trị của phase.

**Bốn thứ KHÔNG được vào pack.** Chúng là ràng buộc của sản phẩm, không phải vẻ
ngoài — cho pack đổi là mỗi pack phải chạy lại bộ kiểm 1920 tổ hợp:

| Hằng | Giá trị | Vì sao khoá |
|---|---|---|
| `SAFE` | `{.1 .2 .11 .18}` | bảo đảm "chữ không bao giờ tràn khung" |
| `MAX_BLOCK_SHARE` | `0.3` | bảo đảm "chữ không che mặt người nói" (§19) |
| `MAX_LINES` | `3` | quá 3 dòng thì không đọc kịp |
| **sàn** `LINE_HEIGHT` | `≥ 1.0` | dưới 1 là cắt cụt dấu chồng dấu tiếng Việt |

Pack chỉnh `lineHeight` trong **[1.0, 1.4]**, không tự do.

**`MAX_SCALE` vào pack được, `MIN_SCALE` thì không.** Trần cỡ chữ là lựa chọn
thẩm mỹ (§19 hạ 0,24 → 0,15) và `MAX_BLOCK_SHARE` vẫn chặn phía sau. Sàn 0,09 thì
là ngưỡng đọc được — không phải chuyện phong cách. Cho pack chỉnh `maxScale`
trong **[0.11, 0.16]**.

## Architecture

```
server/style-pack.ts          ← MỚI: kiểu + pack `goc` + hàm đọc pack
        │
        ├─→ server/render.ts        font, edge, glow
        ├─→ server/word-layout.ts   color, maxScale, leadRatio
        ├─→ server/text-layout.ts   lineHeight, wordGap
        └─→ src/dev/overlays/       trang xem đọc CÙNG pack
```

Pack truyền xuống bằng **tham số**, không bằng biến toàn cục — vì phase 5 sẽ có
nhiều pack cùng tồn tại và mỗi dự án dùng một cái.

```ts
type StylePack = {
  id: string
  label: string
  font: { file: string }
  letterCase: "as-typed" | "upper"
  color: { main: Tone; dim: Tone; key: Tone }
  edge: { share: number; color: string } | null
  glow: number | null
  box: { color: string; padShare: number } | null
  density: { maxScale: number; lineHeight: number; wordGap: number; leadRatio: number }
  motion: { enterSeconds: number; rowDelay: number; colDelay: number }
  defaults: { band: BandId; align: AlignId; emphasis: EmphasisId; reveal: RevealId }
}
```

Phase này chỉ cần các trường **đã có giá trị thật**. `letterCase` khai sẵn với
giá trị trung tính, phase 3 mới làm cho nó chạy. `box` khai sẵn nhưng **luôn
`null`** — trục nền khối đã hoãn sang vòng sau, giữ trường lại để về sau thêm
không phải đổi kiểu.

## Related Code Files

- Create: `server/style-pack.ts`
- Modify: `server/render.ts` — `OVERLAY_FONT`(:769) · `EDGE_SHARE`(:37) ·
  `EDGE_COLOR`(:38) · `GLOW_OPACITY`(:23)
- Modify: `server/word-layout.ts` — `COLOR`(:52) · `MAX_SCALE`(:59) · `SMALL`(:149)
- Modify: `server/text-layout.ts` — `LINE_HEIGHT`(:122) · `WORD_GAP`(:133)
- Modify: `server/reveal-expr.ts` — `ENTER_SECONDS` · `unitDelay`
- Modify: `src/dev/overlays/overlay-render.tsx` — `COLOR`(:57) · `EDGE_SHARE`(:55) ·
  `SMALL`(:150)
- Modify: `server/paths.ts` — `OVERLAY_FONT` thành giá trị mặc định của pack `goc`

## Implementation Steps

1. **Dựng `server/style-pack.ts`** — kiểu `StylePack` và pack `goc` chép đúng
   từng con số đang chạy. Chưa ai dùng.
2. **Luồn vào `text-layout.ts`** — `lineHeight` và `wordGap` thành tham số. Đây là
   chỗ khó nhất vì ba đường đang cùng đọc chúng (§19 đã kể: từng có ba mô hình
   khác nhau cho cùng một khoảng, và hạ `WORD_GAP` là chúng tách ra ngay).
3. **Luồn vào `word-layout.ts`** — `COLOR`, `MAX_SCALE`, `SMALL` (thành
   `density.leadRatio`).
4. **Luồn vào `render.ts`** — font, `EDGE_SHARE`, `EDGE_COLOR`, `GLOW_OPACITY`.
5. **Luồn vào `reveal-expr.ts`** — `ENTER_SECONDS`, hai hệ số của `unitDelay`.
6. **Luồn vào trang xem** — `overlay-render.tsx` đọc cùng pack.
7. **Chạy `/_dev/overlays`** — bảng này in kết quả hai đường cạnh nhau và gắn cờ
   *"← LỆCH với khung xem"*. Không được có cờ nào.
8. **So bản render** — xuất lại một dự án có sẵn, so với bản cũ.

## Todo List

- [ ] `server/style-pack.ts` + pack `goc`
- [ ] Luồn vào `text-layout.ts`
- [ ] Luồn vào `word-layout.ts`
- [ ] Luồn vào `render.ts`
- [ ] Luồn vào `reveal-expr.ts`
- [ ] Luồn vào `overlay-render.tsx`
- [ ] `/_dev/overlays` không còn cờ lệch
- [ ] So hai bản render, khác 0 pixel

## Success Criteria

- [ ] Render một dự án có sẵn trước/sau ra tệp **giống hệt**
- [ ] `/_dev/overlays` không báo lệch ở bất kỳ tổ hợp nào
- [ ] `SAFE`, `MAX_LINES`, `MIN_SCALE`, `MAX_BLOCK_SHARE` vẫn là hằng, không nằm
      trong pack
- [ ] `npm run build` và `npm run lint` sạch

## Risk Assessment

| Rủi ro | Mức | Cách xử |
|---|---|---|
| Bỏ sót một chỗ đọc hằng → hai đường lệch | **cao** | `/_dev/overlays` là lưới an toàn. Chạy nó sau **mỗi** bước, đừng để tới cuối |
| Trang xem và máy chủ dùng hai bản pack khác nhau | vừa | Pack phải khai ở **một** chỗ, hai bên cùng import. Đừng chép sang |
| Refactor kéo theo sửa hành vi "tiện tay" | vừa | Phép so pixel bắt được. Thấy khác thì dừng, tìm cho ra, đừng nhận |
| `letterCase` khai trong kiểu mà chưa chạy | thấp | Cố ý — phase 3 làm. Để giá trị trung tính, đừng để `undefined` |
| `box` khai mà không bao giờ dùng | thấp | Cố ý — đã hoãn. Luôn `null`, và mã đọc nó phải xử `null` chứ đừng giả định có |

## Next Steps

Phase 3 thêm trục mới vào chính kiểu này. Phase 5 làm cho pack đọc được từ CSDL.
