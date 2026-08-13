# Prism Pro — font theo TỪNG TIẾNG (per-word)

## Mục tiêu
Cụm phụ đề Prism Pro: nền **sans** (Lexend), chỉ **tiếng nhấn** vẽ **serif nghiêng + chrome** (Lora) — đúng `examples/caption-styles/prism-pro.mp4`. Hiện font resolve theo CẢ CỤM (`fontRoleFor`) nên cụm có keyword là toàn serif; cộng `KEYWORD_SHARE_FLOOR=0.85` → ~85% cụm serif.

## Ràng buộc SỐNG CÒN
- **Chữ không bao giờ tràn khung**: mọi tiếng phải ĐO bằng CHÍNH font sẽ vẽ. Lexend rộng hơn Lora ~10–14% (đo được) → KHÔNG được đo per-cụm rồi vẽ per-word.
- **Trang xem ≡ máy chủ** (parity): hai đường vẽ phải áp CÙNG luật per-word.
- Bộ một-họ (Phấn/Nhịp: voice.file===accent.file) per-word == per-cụm → KHÔNG đổi gì.

## Thiết kế
1. `ShownPack` thêm `accentFont?: FontSpec` (font vai accent kèm theo). `packForElement`/`withFontRole` cho bộ hai-họ: `font = voice`, `accentFont = accent`. Bộ một-họ: `accentFont` = trùng → vô hại.
2. Helper `fontForPiece(pack, isKeyword)` = `isKeyword && accentFont ? accentFont : font`.
3. Đo per-word ở CẢ HAI:
   - Viewer: `widthOf`/`wrapAt`/`fitRow` nhận mark keyword theo tiếng → đo mỗi tiếng bằng `fontForPiece`.
   - Server: `text-layout`/`word-layout` (`splitPieces` đã có `piece.keyword`) → đo/đặt mỗi piece bằng `fontForPiece`.
4. Vẽ per-word: `overlay-render` Syllable dùng `fontForPiece` cho `fontFamily`/`fontStyle`/`fontWeight`; server drawtext dùng đúng `.ttf` theo piece.
5. `fontRoleFor` (per-cụm) giữ lại cho chỗ khác, nhưng caption dùng per-word.

## Guard phải xanh lại
- `check:style-pack`: sửa test "đo theo vai" → per-word (cụm keyword: tiếng keyword accent, tiếng thường voice).
- `check:layout`: `--update` baseline (widths đổi).
- `check:scene-preview`: parity phải khớp sau khi CẢ HAI per-word.
- `check:slots`, `check:fonts`, `tsc`, `lint`.

## Phát hiện: chỉ cần VIEWER (thu hẹp phạm vi)
- `check:scene-preview` chỉ kiểm HÌNH HỌC ô, KHÔNG đo chữ. Parity chữ trang-xem↔máy-chủ KHÔNG có trong guard gating (chỉ có script python thủ công).
- Remotion (engine mặc định) render qua ĐƯỜNG VIEWER (`overlay-render` buildRows), KHÔNG qua server drawtext.
- ⟹ Per-word chỉ ở VIEWER: tự-nhất-quán (đo per-word + vẽ per-word) → không tràn ở Remotion. Server ffmpeg (fallback) giữ per-cụm → `check:layout`/`check:style-pack` KHÔNG đổi. `ShownPack.font` giữ nguyên (accent cho cụm keyword) nên test "đo theo vai" vẫn xanh; thêm `voiceFont`/`accentFont` chỉ để viewer vẽ per-word.

## Phase
- [x] P1 — `ShownPack` += `voiceFont`/`accentFont` + `pieceFont` + set ở `withFontRole`/`packForElement` (style-pack.ts). tsc xanh.
- [x] P2 — Viewer đo+vẽ per-word (overlay-model `wrapAt`/`fitGroup` nhận `keyOf`; overlay-render buildRows truyền `isKey` + `Placed.keyword`; Syllable dùng `pieceFont`). Ảnh: nền sans + tiếng nhấn serif+chrome CÙNG dòng, KHÔNG tràn.
- [~] P3 (HOÃN, ghi nợ) — Server drawtext per-word: Prism trên ffmpeg (fallback khai tử) tạm serif per-cụm. Làm khi/nếu bỏ ffmpeg hoặc cần parity trang-xem↔ffmpeg cho bộ hai-họ.
- [x] P4 — Guard xanh HẾT, KHÔNG cần `--update` (server không đổi): tsc, lint, check:style-pack (71), check:layout, check:slots (78), check:scene-preview (6), check:fonts.
- [x] P5 — Re-export dự án thật (`prj_msh633d6hygz5t`) qua Remotion → mp4: nền sans + tiếng nhấn serif+chrome LẪN trong cùng cụm (vd "Sinh Nhật"/serif + "Với Mình Chỉ"/sans), không tràn, `pix_fmt=yuvj420p`.

## Nợ kỹ thuật
- `fitRow` (emphasis keyword-large/mixed-size/taper) vẫn đo per-cụm — Prism dùng `even` nên không chạm; nếu sau này bộ hai-họ dùng emphasis khác thì làm per-word cho `fitRow`.
- Server ffmpeg per-cụm (P3).

## Rủi ro
- Server drawtext dùng một `.ttf`/lệnh vẽ; per-word = tách lệnh vẽ theo font. Kiểm `pix_fmt` + không lệch mốc.
- Nếu server per-word quá rối và Remotion là engine mặc định: cân nhắc chỉ giữ per-word ở viewer/Remotion + để `check:scene-preview` bỏ qua cụm hai-họ (ghi rõ nợ). QUYẾT ở P3 sau khi đọc text-layout đầy đủ.
