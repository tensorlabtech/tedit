# Hợp nhất Bố cục ↔ B-roll thành "layout segment"

## Quyết định đã chốt (user)
- **B-roll = một loại bố cục cần media.** Không còn khái niệm/subsystem riêng.
- **Dải bố cục THƯA** như dải Chuyển cảnh: chỉ vẽ segment KHÁC mặc định. Vắng = toàn-khung. Xoá segment → về toàn-khung.
- **Bỏ nhị nguyên auto/manual:** mọi thứ trên dải là segment cụ thể (dù AI hay người đặt). Không cờ `manual`, không khối mờ, không chữ "Máy đang tự chọn", không nút "Thành b-roll", không "Tự động".
- **Máy vẫn gợi ý** (2 lượt): (1) b-roll phủ HẾT asset user đưa; (2) ô người THƯA ~30% thời-gian-còn-lại (tổng − b-roll), ưu tiên câu đặc biệt (hero/mở màn, có từ-khoá nhấn), có khoảng cách tối thiểu giữa 2 ô.
- **Data hợp nhất:** một khái niệm, một bảng. Neo theo TỪ để sống qua cắt lời.
- **Style thừa kế:** segment ăn theo style dự án (KHÔNG cột style per-segment).
- **Đặt tên:** layout đặc trưng của style → "Tên phong cách · Tên bố cục"; layout dùng chung (toàn-khung, ô đơn) để trần.

## Mô hình data
Gộp về `elements` với `kind='layout'` (bỏ `kind='insert'`):
- `insert_layout` = LayoutKindId của segment (cả b-roll lẫn ô người).
- `media_file_id` NULL = ô người; có = b-roll. `needsInsert` của layout quyết định BẮT BUỘC có media.
- Neo `from_word_id`/`to_word_id` (đã có sẵn).
- **Bỏ bảng `scene_layouts`** (override cũ). Migrate: `kind='insert'`→`kind='layout'`; overrides `scene_layouts` (ít, test=0) map anchor_ms→word span, cái nào không map sạch thì bỏ.

## Phases
- [x] **P1 — Data (XONG).** `elements` kind='insert' (b-roll) + kind='layout' (ô người), neo theo từ, phân biệt bằng media. Reader hợp nhất `buildPlacedSegments`. Bỏ `scene_layouts`/`scene-overrides` + route POST /scene-layout. (Bảng `scene_layouts` để lại rỗng, vô hại.)
- [x] **P2 — Engine THƯA (XONG).** `scheduleScenes` nhận segment đã đặt → kẹp/xếp/bỏ-chồng, KHÔNG auto-tile, vắng = toàn-khung. `elementId` luồn qua để sửa/xoá.
- [x] **P3 — Placement (XONG).** `placePersonLayouts`: ~30% thời-gian-còn-lại, câu có từ nhấn, min-gap 6s, chạy 1 lần. Bước pipeline "layout" sau "place". (B-roll: `placeInserts` sẵn có.)
- [x] **P4 — Render parity (XONG).** `fillFullFrame` lấp khoảng trống bằng toàn-khung cho ffmpeg; preview: nền trang + video-vào-ô CHỈ khi có màn (`cell`), vắng → video phủ kín.
- [x] **P5 — UI dải thưa (XONG).** LayoutLane chỉ vẽ segment (ô người theo elementId + b-roll); bỏ khối mờ/baseline/auto/manual/overrides.
- [x] **P6 — Inspector gộp (XONG).** ScenePane: danh sách bố cục ĐẦY ĐỦ; chọn b-roll → hỏi tư liệu; xoá → toàn-khung. Bỏ "Thành b-roll"/"Tự động"/"Máy đang tự chọn".
- [x] **Polish (XONG):** (a) phong cách hiện ở NHÃN khối ("Khung hình · Nhịp đen"), thẻ giữ tên bố cục gọn — per-thẻ "Nhịp đen ·" bị cắt cụt phần phân biệt nên bỏ; toàn-khung bỏ khỏi picker (chọn qua "Bỏ khung"). (b) nút "+ Thêm khung" đặt ô người ~3s quanh vạch. (c) xoá `opensStrong`/`layoutAt` chết; giữ `onInsertTrimmed` (vẫn cần refetch lịch sau gọt b-roll).
- [x] **Bug render (XONG):** chỉ số lớp chữ `[N:v]` không trừ input chèn bị bỏ khi `layoutActive` → filtergraph trỏ input không có. Bug tồn tại từ trước, lộ khi export có b-roll+layout. Fix: `1 + (layoutActive ? 0 : inserts.length)`.
- [x] **Test full (XONG):** export ffmpeg thật `final.mp4` (130s, 1080×1920); soi khung 40s=phủ kín · 1.5s=ô o-don · 11s=b-roll 2 ô — khớp preview. typecheck/build/lint + 7 guard (timing/slots/scene-preview/layout/style-pack/render/commit-cut) 0 trượt.
- [x] **P7 — Bug riêng (XONG).** B-roll video trong ô bố cục nay tua theo đồng hồ DẢI (`preview-panel.tsx`): bỏ `autoPlay/loop`, thêm ref + effect drive `currentTime = sweepAt − sceneStart` + play/pause theo `playing`. Verified scrub: cell `paused=true` khi dải dừng, `currentTime` = offset đúng trong màn.
- [ ] **P8 — Dọn.** Bỏ `fillPerson`/luật auto-tile thừa; bỏ cờ manual, `onInsertTrimmed` fill-hole (thành thừa ở mô hình thưa); check guards.

## Rủi ro
- Migration mất override cũ nếu map anchor→word không sạch → chấp nhận (ít, user xếp lại).
- Placement ~30% là heuristic "làm đại" — tinh chỉnh sau.
- Giữ app chạy giữa các phase: đổi data+read cùng lúc trong mỗi phase, verify compile+guards+browser mỗi bước.

## Vòng 2 — MỘT LOẠI thật ("Khung") ở mọi mặt người dùng chạm (XONG)
- **Gộp 2 inspector → 1** `inspector-layout-pane.tsx` (LayoutKhungPane): b-roll và ô người mở CÙNG bảng "Khung". Tư liệu chỉ là một HÀNG thuộc tính (hiện khi khung có tư liệu). Xoá `inspector-scene-pane`, bảng B-roll cũ, `layout-picker`, `inspector-insert-shape-tiles`.
- **6 kiểu → 2 cấu trúc + thuộc tính**: nhãn "1 ô · Trên/Dưới" (o-don/o-lech, khác vị trí) và "2 ô · Đều/Vuông trên/Ngang trên" (hai-o/vuong-ngang/ngang-vuong, khác tỉ lệ). Toàn-khung = mặc định (bỏ khỏi picker).
- **Asset = thuộc tính, không phải loại**: chọn "2 ô" khi chưa có tư liệu → hỏi tư liệu (người→b-roll); chọn "1 ô" khi có → gỡ tư liệu (b-roll→người). Ảnh/video = thuộc tính tệp. Hàm `convertBrollToPerson` + `addSceneBroll(layout)`.
- **Lane cùng tông**: b-roll cùng màu ô người (hue 260), chỉ khác ở mặt tệp (thumbnail) = "khung này có tư liệu".
- Verified: chọn ô người & b-roll ra CÙNG pane (ảnh); chuyển 2 chiều chạy (broll↔người qua picker); preview 2-ô vuong-ngang đúng; typecheck/build/lint + 5 guard 0 trượt.
- **Còn ẩn (không thấy):** DB vẫn 2 `kind` ('insert'/'layout') — đọc thống nhất bằng media-presence, người dùng không chạm. Gộp thành 1 kind là plumbing thuần, để dành.

## Vòng 3 — pane gọn + tư liệu-là-thuộc-tính + gộp DB (XONG)
- **Auto-play**: bấm chọn khung KHÔNG tự chạy nữa; chỉ chạy khi ĐỔI.
- **Pane gọn** (sửa spacing xấu): thẻ khung đang chọn + nút "Đổi khung" → **modal lưới** (co giãn tới trăm kiểu). Bỏ dải 5 thẻ chen chúc + khoảng trống hoác.
- **Viền active hết bị cắt**: `OptionPicker` đổi `ring` (vẽ ngoài, bị overflow xén) → `inset-ring` (vẽ trong).
- **Gộp DB một `kind='layout'`**: b-roll = khung CÓ media (migration idempotent; mọi chỗ đọc đổi sang media-presence; `shape-project`, `resolveElements`, ai-broll-place, place-person, quality-report).
- **Tư liệu = thuộc tính, có placeholder (point 4)**: cấu trúc lấy từ `insert_layout` (không từ media); khung 2 ô CHƯA tư liệu = placeholder (reader emit, preview vẽ ô "Chưa có tư liệu", render bỏ ô phụ an toàn). Chọn 2 ô KHÔNG ép modal; tư liệu chọn ở hàng "Tư liệu" riêng (`setSegmentMedia`).
- Verified: modal chọn khung áp+đóng; placeholder hiện ở preview + lấp thành b-roll được; export ffmpeg không crash với placeholder; build/lint + 4 guard 0 trượt.
- **Q3 = để riêng** (chỗ nối + khung 2 lane). **Q2 (hai-ô người đè cắt b-roll) = chưa đụng** — hình học đo thật, chờ chốt: sửa cho hết chồng, hay thêm "phủ kín (cutaway)".

## Vòng 4 — 3 phản hồi UI (XONG)
- **#9 pane**: user xác nhận gọn, ổn.
- **#10 modal 2 thẻ sáng viền**: viền focus trắng của thẻ đầu (modal tự focus) đọc ra như chọn 2 cái → `OptionPicker` thêm `outline-none` + focus bằng nền nhạt (không viền).
- **#11 b-roll đè lên video (dạng chồng lệch)**: `hai-o` đổi z → ô phụ (b-roll) z cao hơn ô người → b-roll vẽ TRÊN, chỗ đè là thân/vai (không phải mặt), b-roll KHÔNG bị cắt. Render xếp theo `z` (`layout-render` sort slots); preview vẽ ô b-roll SAU ô người. `vuong-ngang`/`ngang-vuong` cũng chỉnh z nhất quán (không chồng nên vô hình). Verified: preview (broll-ontop) + export (khung 12s hai-ô) — b-roll trên, nguyên vẹn, khớp nhau.
- **Auto-play**: bấm chọn khung không tự chạy.
- Guards: timing 46/slots 74/scene-preview 6/layout 300/style-pack 255 — 0 trượt; export ffmpeg DONE.
- Lưu ý: mất session browser giữa chừng (dev-login Base UI không click được qua CDP) nên #10 chỉ verify bằng code, chưa chụp lại; #11 verify đầy đủ (preview + export).
