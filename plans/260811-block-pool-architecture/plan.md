# Kiến trúc Pool-Block: bỏ "pack ở runtime", phong cách chỉ là preset

**Trạng thái:** pending · **Ngày:** 2026-08-11

## Vấn đề (ý tưởng của chủ dự án)

Mọi thứ hình ảnh (bố cục, look ô, nền, font, màu chữ, chỗ nối, doodle...) là **block bình đẳng** trong một pool chung. **Phong cách chỉ là PRESET** — bộ config để AI/App bốc combo block hợp vibe lúc SINH. **Vào editor thì không còn khái niệm pack**: mỗi element mang block của riêng nó, trộn tự do (khung look-Phấn + chữ look-Nhịp-đen chả sao).

Hiện tại SAI: `StylePack` là **túi treatment TOÀN CỤC**; render/editor khắp nơi `findStylePack(project.stylePack)` rồi áp `pack.subjectEdge/page/fonts/...` lên CẢ video. → chọn khung nào trong project Phấn cũng ra viền vàng; "look của Phấn" không đi theo block mà bôi từ project.

**Triệu chứng đo được:**
- Chọn khung nhóm "Khác" (Nhịp đen) trong project Phấn → vẫn ra viền vàng (treatment toàn-cục).
- **Rung stop-motion** của Phấn dính vào CẤU TRÚC: gate `wantTilt = slot.mask && page && slots.length > 1` (`layout-render.ts:461`). `broll-don` 1 ô → không rung; đổi mặc định sang nó là mất rung. Rung/tilt/viền-xé đáng ra là HÀNH VI của block "look-ô Phấn", đi theo block bất kể layout.
- Preview không mirror rung (`scene-layout-geometry.ts`) → cảnh collage rung ở export nhưng đứng hình ở editor (parity thiếu).

## Mục tiêu (mô hình PHẲNG — không tầng config cao hơn)

1. **Element mang thẳng block của nó, đầy đủ.** Không có "project config" / "resolvedStyle" ở trên. Phẳng, bình đẳng.
2. **Bỏ pack ở runtime.** Render/editor KHÔNG `findStylePack`, KHÔNG fallback lên tầng nào. Đọc thẳng `element.block`.
3. **Preset = HÀM generation-only.** Phấn/Nhịp đen chỉ là hàm bốc-block, chạy lúc sinh → **đóng dấu block vào TỪNG element**, rồi biến mất.
4. **"Đổi cả video" = bulk-edit** (chọn nhiều element rồi sửa), không phải sửa config tầng trên.
5. **Không đổi đầu ra** ở phase đầu (stamp = giữ nguyên giá trị pack đang áp), rồi mở khoá trộn.

## Quyết định ĐÃ CHỐT

- **Block = NGUYÊN GÓI, atomic.** Frame block (b-roll) = cấu trúc + nền + viền/mask + rung/tilt (một cục). Caption-style block = font + màu + HOA/thường + glow/box (một cục). Junction block = một hiệu ứng nối. Đổi look = đổi block, không tinh chỉnh từng thuộc tính con.
- **Element = BẢN SAO tự chứa.** Generate: preset **copy** thuộc tính block vào element. Sửa pool KHÔNG động element đã có. "Đổi cả video" = **bulk-edit** (chọn nhiều rồi đổi block).
- **Không tầng config.** Render/editor đọc THẲNG thuộc tính đã stamp trên element. Không `findStylePack`, không fallback.
- **Pool = union block các preset định nghĩa** (VD 4 khung Đen + 3 khung Phấn = 7). Editor hiện đủ, **prefix tên preset**.
- **Preset = hàm generation-only.** Sau generate, `style_pack` chỉ còn NHÃN "sinh từ preset nào".
- **Migration:** dự án cũ → chạy MỘT lượt stamp đầy block vào mọi element từ pack cũ; xong không ai đọc pack để render nữa.

## Block = THIẾT BỊ độc lập, mỗi cái có INPUT riêng, nhặt vào đâu cũng được

**Không có "video Phấn".** Chỉ có video + block; preset chỉ bốc sẵn block cho AI. Mỗi block tự chứa + có input của nó, KHÔNG thuộc phong cách nào:

| Block (thiết bị) | Input riêng | Ghi chú |
|---|---|---|
| **khung b-roll** | chọn ảnh/video | cấu trúc+nền+viền+mask+rung gói trong block |
| **khung chữ-sau-người** (behindText) | **nhập chữ** | block RIÊNG, không bó vào cảnh; nhặt vào bất kỳ đâu |
| **caption** (cụm chữ) | chữ + style | font+màu+HOA+glow+box |
| **doodle** | (chọn nét) | nhặt vào chỗ trống |
| **viền-người** | — | block treatment người |
| **grade màu** | — | block treatment cảnh, nhặt vào cảnh nào cảnh đó nắn |
| **chỗ nối** (junction) | — | ở bảng `effects`, mỗi nối mang block |

→ Editor: mỗi element/block bày đúng INPUT của nó (b-roll → media picker; chữ-sau-người → ô nhập chữ; ...). Preset = hàm bốc block + điền input mặc định lúc generate.

## Các phase

| # | Phase | Ý | Rủi ro |
|---|---|---|---|
| 1 | [Block per-element + bỏ pack runtime](phase-01-blocks-on-elements.md) | Mọi trục look thành block trên element (schema + stamp lúc generate); 28 chỗ render/editor đọc thẳng element, bỏ `findStylePack`. Migration stamp dữ liệu cũ. **Stamp = giữ nguyên giá trị pack đang áp → KHÔNG đổi hình.** | Rộng, cốt lõi |
| 2 | [Mở khoá trộn per-element](phase-02-unlock-mixing.md) | Editor cho chọn/đổi từng block per-element (layout+look-ô, font, màu, chỗ nối, nền-cảnh); hết bị treatment toàn-cục đè. Rung/tilt/viền theo block look-ô, không theo cấu trúc. | Render + UI |
| 3 | [Preset = hàm generation-only](phase-03-preset-as-function.md) | Phấn/Nhịp đen từ "pack runtime" → HÀM bốc-block lúc sinh. `style_pack` tụt xuống chỉ còn nhãn. Bỏ ngôn ngữ "pack" ở editor/render. | Đổi tên rộng |
| 4 | [Pool block taxonomy](phase-04-block-pool-taxonomy.md) | Mỗi trục = catalog **block hoàn chỉnh** (VD frame block = cấu trúc + look: nền/viền/rung). Mỗi block tag 1 preset. Element trỏ tới block. Preset = tập block nó nhặt. Nền làm hàng loạt theme. | Thiết kế |

**Frame block (chốt từ VD "7 khung = 4 đen + 3 phấn"):**
- Block = **cấu trúc + look** (nền/viền/mask/rung...). "Phấn·2-ô" ≠ "Đen·2-ô" — HAI block, cùng cấu trúc khác look.
- Look (nền, viền vàng, rung) **NẰM TRONG block**, KHÔNG phải `pack.subjectEdge/page` toàn-cục (đây là cái sai lớn nhất hiện tại).
- Editor hiện ĐỦ mọi block, **prefix tên preset** ("Phấn · 2-ô", "Đen · 2-ô") cho đỡ nhầm — bỏ kiểu nhóm "Gợi ý/Khác" đã làm.
- Element b-roll trỏ tới 1 frame block; render đọc look từ block đó.

## Gộp lại việc đã lỡ làm sai

- "Bình đẳng layout" + "phong cách chữ per-cụm" (đã code) build trên mô hình pack-toàn-cục → **gấp vào phase 2-3, làm lại cho đúng** (giữ ý tưởng, đổi cơ chế).
- **Theme-render Phấn** (jitter/khung xé/Anton/chéo/pop — thuần ffmpeg đầu ra) **đúng, giữ nguyên**; chỉ tách phần "block nào áp cho ô nào" ra per-element.

## Nguyên tắc thực thi

- **Từng phase KHÔNG đổi đầu ra** trừ khi cố ý (phase 1 = tương đương tuyệt đối).
- Mỗi phase qua `npm run typecheck` + các `check:*` liên quan trước khi sang phase sau.
- Migration dữ liệu: idempotent, seed-once, không tự mọc lại.
