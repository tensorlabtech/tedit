# Phase 1 — Block per-element + bỏ pack runtime

**Trạng thái:** pending · **Ưu tiên:** cao (cốt lõi) · **Đầu ra KHÔNG đổi** (stamp = giữ nguyên giá trị pack đang áp).

## Mục tiêu
Mọi thuộc tính look rời `StylePack` toàn-cục, thành block ĐÃ STAMP (bản sao) trên từng element. Render/editor đọc thẳng element, bỏ `findStylePack`. Không đổi một pixel — chỉ đổi NGUỒN đọc.

## Schema (đề xuất: JSON block/element, không đẻ chục cột)
Mỗi element mang JSON block theo LOẠI của nó — bản sao tự chứa:
- `frame_block TEXT` (element b-roll/layout): `{ layoutId, background, edge, mask, tilt, jitter, ... }` — chính là look-ô hiện `pack.subjectEdge`+`pack.page`+`wantTilt` gộp lại.
- `caption_block TEXT` (element caption): `{ font, color, letterCase, glow, box, highlight }` — hiện `pack.fonts`+`color`+`letterCase`+`glow`+`box`.
- `junction_block TEXT` (ranh giới): hiệu ứng nối.
- (chữ-nền / doodle / grade: block riêng hoặc gộp vào frame/scene — chốt lúc code.)

> Vì sao JSON: block là NGUYÊN GÓI atomic (đổi cả cục), không query từng thuộc tính con → JSON gọn hơn chục cột; đọc một phát ra cả block.

## Stamp lúc generate
`place-person-layouts` / `ai-broll-place` / `seedSegmentsByCaption` (đang đọc `readStylePack` rồi stamp `insert_layout/align/emphasis`) → mở rộng: **copy CẢ block** (frame/caption) từ preset vào element lúc đặt. Preset = hàm bốc block (phase 3 hoá hàm; phase 1 tạm đọc pack hiện tại làm nguồn stamp).

## Bỏ `findStylePack` ở runtime (28 điểm)
Chia 3 nhóm:
1. **Render** (`render.ts`, `layout-render.ts`, `layout-segments.ts`, `scene-schedule.ts`): đọc `pack.subjectEdge/page/fonts/behindText/doodles/sweep/...` → đọc từ block của element đang vẽ.
2. **Editor preview** (`preview-panel.tsx`, `overlay-render.tsx`, `scene-layout-geometry.ts`, `inspector-*`): tương tự, đọc block element.
3. **Chỗ THẬT-SỰ cấp video** (nếu còn): grade nền, nhạc — chuyển thành thuộc tính element-video/track (vẫn phẳng), KHÔNG để thành pack.

Liệt kê chính xác 28 file lúc code (đã có lệnh grep trong plan gốc).

## Migration (một lượt, idempotent)
Với mọi project cũ: đọc `style_pack` → dựng pack → **stamp block đầy đủ vào mọi element** (frame/caption/junction) từ pack đó. Cột nào element chưa có thì lấy giá trị pack tương ứng. Chạy MỘT LẦN (có cờ `blocks_stamped`), không tự mọc lại.

## Bản đồ trường StylePack → block (chốt để code cơ học)

| Trường StylePack hiện tại | Về đâu |
|---|---|
| `page`, `subjectEdge`, `scenePush`, jitter/tilt (wantTilt), `doodles` | **frame block** (b-roll/cảnh có bố cục) |
| `fonts`, `letterCase`, `color`, `edge`, `glow`, `box`, `highlight`, `plate`, `wrap` | **caption-style block** (cụm chữ) |
| `behindText`, `grade` | **scene block** (cảnh người / mở màn) |
| `sweep` + hiệu ứng nối (junction-kinds) | **junction block** (ranh giới) |
| `graphics` (catalog plate/wrap/mask/doodle) | định nghĩa asset của block — đi kèm block |
| `intensity`, `grouping`, `rhythm`, `musicBias` | **GENERATION params** — ở lại hàm preset, KHÔNG thành block |
| `id`, `label`, `theme`, `layouts` | metadata preset (`layouts` = tập frame-block preset nhặt) |

> `intensity`/`grouping`/`rhythm` = "cách AI cắt/nhấn/rải b-roll" → chỉ sống lúc generate, editor không cần.

## Map LOẠI element → block (đã soi schema thật)
- **frame_block** → `elements.kind='layout'` (có `media_file_id` = b-roll; NULL = ô người). Look ô = nền/viền/mask/rung.
- **caption_block** → `elements.kind='text'` (cụm chữ).
- **scene_block** (`behindText`, `grade`): CHƯA có element tự nhiên mang. `behindText` = mở màn (tính 1 lần từ topKeyword); `grade` = nắn màu video. **Quyết định cần chốt:** gắn `scene_block` vào ô-người (`kind='layout'` media NULL) hay một element "cảnh gốc" riêng? (đề xuất: grade + behindText nằm trên element ô-người / hoặc một dòng project-scene phẳng — KHÔNG phải tầng config).
- **junction_block** → **bảng `effects` RIÊNG** (junction cũ), KHÔNG phải `elements`. → **Sửa:** cột `junction_block` fork thêm vào `elements` nên chuyển sang `effects` (mỗi effect = một chỗ nối mang block của nó).

## Việc theo thứ tự
1. Thêm cột JSON block + kiểu TS `FrameBlock`/`CaptionBlock`.
2. Hàm `stampBlocksFromPack(projectId, pack)` — dùng cho cả generate mới lẫn migration.
3. Đổi render đọc block (nhóm 1) — verify render 1 project khớp bit bản cũ.
4. Đổi editor đọc block (nhóm 2) — verify preview khớp.
5. Migration + cờ.

## Success criteria
- `npm run typecheck` = 0 · `check:*` liên quan pass.
- Render 1 project TRƯỚC/SAU **giống hệt** (so frame hoặc md5 vài frame).
- Không còn `findStylePack`/`readStylePack` trong đường RENDER/EDITOR (chỉ còn ở generate/migration).

## Rủi ro
- Rộng (28 điểm) → làm theo nhóm, verify từng nhóm, không big-bang.
- Bỏ sót một chỗ đọc pack → còn lẫn hai nguồn. Chốt bằng grep "không còn findStylePack ngoài generate".

## Câu hỏi mở
- `grade` màu + `intensity`/`grouping`/`rhythm` (nhịp cắt, mật độ b-roll) — mấy cái này là "cách AI cắt/bố trí", có phải block per-element không hay chỉ sống ở generate? (nghiêng: chúng là tham số GENERATION, không cần ở editor — xác nhận.)
