---
title: "Bộ dáng chữ và hook mở đầu"
description: "Nâng các hằng số dáng chữ thành bộ dáng chọn được, thêm trục còn thiếu, và làm 3 giây đầu thành việc nhìn thấy được"
status: pending
priority: P2
branch: "main"
tags: [style, caption, hook, ux]
blockedBy: []
blocks: []
created: "2026-07-31T03:46:58.473Z"
createdBy: "ck:plan"
source: skill
---

# Bộ dáng chữ và hook mở đầu

## Vấn đề

Mọi video xuất ra từ Tedit đều một dáng. Không phải vì thiếu công cụ — chữ đã có
5 trục chọn được (`align` 5 × `emphasis` 4 × `band` 3 × `reveal` 3). Mà vì những
thứ quyết định dáng mạnh nhất **chưa bao giờ là một trục**:

- Font là hằng số duy nhất — `paths.ts:43`, Arial Bold Italic
- Ba mức màu đều trắng/xám — `word-layout.ts:52`
- Màu từ khoá không tồn tại: `COLOR.soft` chênh `COLOR.main` đúng 0,08 alpha nên
  đánh dấu từ khoá ở kiểu `even` và `taper` **nhìn không ra**
- Chữ HOA không tồn tại
- Chữ **luôn** chạy từng tiếng, không tắt được — `reveal` chỉ áp cho tư liệu chèn
  (`render.ts:478`), chữ thì không có trục này
- 5 mặc định chôn cứng trong câu `INSERT` — `caption-elements.ts:56`

Spec §20 đã tự viết ra kết luận: *"công cụ đã đủ, mặc định mới là thứ quyết định
dáng của cả sản phẩm"*. Ai cũng dùng đúng một bộ mặc định, nên ai cũng ra một dáng.

## Ba quyết định đã chốt

**1. Style là THIÊN LỆCH, không phải hàng rào.** Style đặt điểm xuất phát; người
dùng vẫn đè được mọi thứ trong bàn dựng. Không khoá lựa chọn nào — đi ngược §20
(*"người dùng đã tự chọn thì đó là lựa chọn của họ"*).

**2. Ba loại trục, ba cách hành xử.**

| Loại | Ví dụ | Style làm gì | Đổi style thì sao |
|---|---|---|---|
| **A · áp hàng loạt** | font, màu, cỡ, nhấn, căn | đặt mặc định | đổi hàng loạt |
| **B · AI đặt hộ** | b-roll, chuyển cảnh, nhạc | đặt thiên lệch | **không tự đặt lại** |
| **C · ràng buộc** | `SAFE`, `MAX_LINES`, sàn `LINE_HEIGHT` | **không đụng** | — |

**3. Né rủi ro bằng thiết kế, không bằng cắt tính năng.** Font/màu/nhịp chưa bao
giờ lưu vào `elements` — chúng là hằng lúc vẽ. Nâng chúng thành một trường trên
`projects` thì đổi style **không đụng một hàng `elements` nào**. Rủi ro chỉ nằm ở
5 mặc định (đã ghi vào element lúc sinh), nên **v1 để 5 bộ dáng có `defaults`
giống hệt nhau** — đổi style thành an toàn tuyệt đối, không cần dialog xác nhận,
không cần luật merge.

*Đã kiểm ngày 31-07-2026:* bảng `elements` có `kind` `from_word_id` `to_word_id`
`content` `position_band` `media_file_id` + vá thêm `layout` `start_sec` `end_sec`
`keywords` `align` `emphasis` `reveal` `shape`. **Không có cột nào cho font, màu,
viền, quầng, mật độ, nhịp** — nền móng đứng vững.

## Các phase

| # | Phase | Làm gì | Vì sao xếp ở đây |
|---|---|---|---|
| 1 | [Font Audit](./phase-01-font-audit.md) | In bảng chữ mẫu qua các font ứng viên, cả hoa lẫn thường, cả ffmpeg lẫn CSS; **đóng gói font vào repo** | Thứ duy nhất có thể giết cả kế hoạch. Số font dùng được quyết định số bộ dáng thật sự làm được |
| 2 | [Extract Style Constants](./phase-02-extract-style-constants.md) | Tách hằng số dáng thành tham số `StylePack`, khai một pack mang đúng giá trị hiện tại | Refactor thuần, **không đổi hành vi**. Mọi phase sau đều dựa vào |
| 3 | [Add Missing Style Axes](./phase-03-add-missing-style-axes.md) | Thêm 3 trục chưa tồn tại: `reveal` cho chữ · chữ HOA · màu nhấn thật | `reveal` cho chữ là trục rẻ nhất mà tách phong cách mạnh nhất |
| 4 | [Define Style Packs](./phase-04-define-style-packs.md) | Điền giá trị thật cho 5 bộ dáng, đặt tên, render so cạnh nhau | Cần font thật từ phase 1 và trục thật từ phase 3 |
| 5 | [Persist Style On Project](./phase-05-persist-style-on-project.md) | Thêm cột `style_pack`, luồn xuống pipeline và render | Dữ liệu trước giao diện. Kiểm được bằng cách sửa CSDL tay |
| 6 | [Style Picker On Waiting Screen](./phase-06-style-picker-on-waiting-screen.md) | Card chọn dáng ở `/pipeline`, ô mẫu chạy chữ thật của người dùng | Màn chờ là chỗ duy nhất người dùng rảnh mà vẫn đang tập trung vào dự án |
| 7 | [Style Switch In Editor](./phase-07-style-switch-in-editor.md) | Dòng `Dáng: …` cạnh khung xem + Dialog đổi | Đổi được thì người ta mới dám thử. An toàn nhờ quyết định 3 |
| 8 | [Music Tag Vocabulary](./phase-08-music-tag-vocabulary.md) | Chốt tập nhãn đóng cho nhạc, gán lại nhãn, lọc trước khi đưa cho LLM | Việc dữ liệu nhiều hơn việc code. Độc lập với 1–7 |
| 9 | [Broll Variety And Rhythm](./phase-09-broll-variety-and-rhythm.md) | Thêm kiểu hiện b-roll, đưa nhịp thành con số, cho AI đọc thiên lệch | Thêm kiểu vào kho **không** tự làm đa dạng — luật chọn mới làm |
| 10 | [Opening Hook](./phase-10-opening-hook.md) | Một dòng "3 giây đầu" trong hàng soát, nghe thử được, ba đường xử lý | Dùng lại `onPreview` và hàng soát đã có. Không đẻ màn mới |

## Đường ngắn nhất

**1 → 2 → 3 (ba trục rẻ) → 4 → 5 → 6.** Sáu phase đó đủ để người dùng chọn được
dáng và video hết giống nhau. Phase 7–10 là mở rộng.

Cắt được khi hụt thời gian: phase 7 (bù bằng phase 6) · phase 9–10 sang vòng sau.

Đã cắt sẵn: trục `box` (nền khối) và bộ dáng thứ sáu đi kèm nó — ffmpeg chỉ cho
nền góc vuông, bo tròn phải vẽ lớp riêng và ngốn bằng ba trục kia cộng lại.

Không cắt được: phase 1 (không biết thì không thiết kế được) · phase 2 (nền của
mọi thứ) · trục `reveal` cho chữ ở phase 3.

## Luật xuyên suốt

**Mọi thay đổi về dáng đều có hai đường vẽ** — ffmpeg ở máy chủ và CSS ở trang
xem. Phase nào cũng phải sửa cả hai, và `/_dev/overlays` là thứ bắt lệch giữa
chúng. Nó từng bắt được lỗi `WORD_GAP` (§19). Đừng bỏ nó.

## Dependencies

Không phụ thuộc plan nào khác — đây là plan đầu tiên của dự án.

## Validation Log

### Session 1 — 2026-07-31
**Trigger:** `/ck:plan validate` ngay sau khi viết plan, trước khi thực thi
**Questions asked:** 4

#### Verification Results
- **Tier:** Full (10 phase)
- **Claims checked:** ~25 · **Verified:** 21 · **Failed:** 2 · **Phát hiện thêm:** 2

**Đã xác nhận**
- Bảng `elements` **không có** cột font/màu/viền/quầng/mật độ/nhịp → nền móng của
  cả plan đứng vững
- `render.ts:478` + `inspector-panel.tsx:211` → `reveal` đúng là chỉ áp cho tư liệu
  chèn; chữ luôn chạy từng tiếng
- `COLOR.main` alpha `.92` vs `COLOR.soft` alpha `1` → trục từ khoá đúng là gần
  như vô hình
- Màn chờ có thật: `src/routes/pipeline/pipeline-page.tsx`, route
  `/pipeline/:projectId` (`main.tsx:107`)

**Sai, đã sửa**
1. *[Fact Checker]* phase 3 ghi `word-layout.ts:52,107,143,185` — số dòng thật là
   **143, 184, 208, 226**; dòng 107 thuộc `overlay-render.tsx`. Và hai nhánh *từ
   khoá thật sự* chỉ là **208** (`even`) và **226** (`taper`)
2. *[Fact Checker]* phase 7 đặt dòng `Dáng:` vào `preview-panel.tsx` — thẻ đó
   không có `CardHeader`, chỉ có `CardContent` (`:147`)

**Phát hiện thêm**
3. Cột **`elements.layout DEFAULT 'flush'`** (`db.ts:373`) là **di sản đã chết** —
   `text-layout.ts:337` xác nhận, `overlay-legacy.ts` đang quy đổi. Đã ghi cảnh
   báo vào phase 3 và 5 để không hồi sinh nó
4. `library_tracks` có **0 hàng** trong khi `server/data/music/` có **57 tệp
   (55 mp3)** — khớp ghi chú `db.ts:58` "thư mục là nguồn sự thật"

#### Questions & Answers

1. **[Scope]** Trục `box` (nền khối sau chữ) — ffmpeg `drawtext` chỉ cho nền góc
   vuông; bo tròn phải vẽ lớp riêng.
   - Options: Hoãn sang vòng sau (Recommended) | Làm, chấp nhận góc vuông | Làm đầy đủ, bo tròn
   - **Answer:** Hoãn sang vòng sau
   - **Rationale:** Phase 3 còn 3 trục, phase 4 còn 5 bộ dáng. Trường `box` vẫn
     khai trong kiểu với giá trị `null` để vòng sau thêm không phải đổi kiểu.

2. **[Risk]** Font mặc định trỏ vào font hệ thống macOS — máy chủ Linux không có.
   - Options: Đóng gói font vào repo (Recommended) | Giữ font hệ thống | Phân đôi
   - **Answer:** Đóng gói font vào repo
   - **Rationale:** Thêm `assets/fonts/` vào phạm vi phase 1; giấy phép trở thành
     điều kiện vào danh sách chứ không phải chuyện kiểm sau. Đẻ ra một câu hỏi con
     cho phase 4: bộ dáng gốc có giữ Arial không.

3. **[Architecture]** Chỗ đặt dòng `Dáng: <tên>` — `preview-panel.tsx` không có
   `CardHeader`.
   - Options: Thêm CardHeader cho khung xem (Recommended) | Đặt ở hàng soát | Đặt cạnh nút xuất video
   - **Answer:** Thêm CardHeader cho khung xem
   - **Rationale:** `CardHeader` tự thành lưới hai cột khi có `CardAction`. Rủi ro
     mới: khung xem có sàn chiều cao, phải đo lại ở 1160px và 720px.

4. **[Assumptions]** Nhãn nhạc ghi vào đâu — thư mục là nguồn sự thật, bảng rỗng.
   - Options: Vá cột vào library_tracks (Recommended) | Tệp JSON cạnh thư mục | Cắt phase 8
   - **Answer:** Vá cột vào `library_tracks`
   - **Rationale:** Giữ đúng lối đang có, không đẻ nguồn sự thật thứ ba. Kéo theo
     một ràng buộc: mọi truy vấn nhãn phải dựng từ thư mục rồi `LEFT JOIN` sang
     bảng, không `SELECT` thẳng từ bảng.

#### Confirmed Decisions
- Trục `box`: hoãn — trường giữ lại, luôn `null`
- Font: đóng gói vào `assets/fonts/`, giấy phép là điều kiện vào danh sách
- Số bộ dáng v1: **5**, không phải 6
- Dòng `Dáng:`: `CardHeader` mới trên thẻ khung xem
- Nhãn nhạc: cột trên `library_tracks`, truy vấn chịu được bảng rỗng

#### Impact on Phases
- **Phase 1:** thêm `assets/fonts/` + kiểm giấy phép; rủi ro giấy phép thấp → cao;
  thêm rủi ro "đổi font gốc làm lệch bản render cũ"
- **Phase 2:** `box` luôn `null`, mã đọc phải xử `null`
- **Phase 3:** bỏ trục `box` (4 → 3 trục); sửa số dòng `word-layout.ts`; thêm cảnh
  báo `elements.layout`
- **Phase 4:** 6 → 5 bộ dáng, bỏ bộ "Nền khối"; thêm bước chốt font bộ dáng gốc
- **Phase 5:** thêm cảnh báo không ghi vào `elements.layout`
- **Phase 6:** 6 → 5 ô; đường dẫn route chính xác
- **Phase 7:** thêm `CardHeader`; 6 → 5 ô; thêm rủi ro chiều cao khung xem
- **Phase 8:** quy mô đã đo (55 bài) → loại rủi ro "kho quá lớn"; thêm ràng buộc
  bảng rỗng

### Whole-Plan Consistency Sweep
- Files reread: `plan.md`, `phase-01` … `phase-10`
- Decision deltas checked: 4
- Reconciled stale references: 24 (mọi chỗ "6 bộ" / "sáu ô" / "bốn trục" / `box`)
- Unresolved contradictions: 0
