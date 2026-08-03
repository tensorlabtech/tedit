---
title: "Đồ hoạ cho bộ dáng chữ — đợt 1"
description: "Cặp font có dấu Việt, mảng màu, nền chữ và tiêu đề lớn — tách 3 bộ dáng ra khác nhau rõ rệt mà không cần một tệp đồ hoạ nào"
status: completed
priority: P2
branch: "main"
tags: [style, caption, font, graphics]
blockedBy: []
blocks: [260802-1733-multi-user-hardening]
created: "2026-08-02T15:01:14.435Z"
createdBy: "ck:plan"
source: skill
---

# Đồ hoạ cho bộ dáng chữ — đợt 1

Nguồn: [`brainstorm-report.md`](./brainstorm-report.md) · chứng cứ ở [`anh/`](./anh)

## Overview

Mười bộ dáng chữ hiện tại nhìn không phân biệt được. Đếm được: 8/10 là cùng một
công thức (chữ + viền đen + quầng tối), `box` chỉ có ở 2 pack và cả hai đều đen,
`highlight` chỉ có ở 1 pack. Gốc rễ sâu hơn — `assets/fonts/` có **9 tệp, cả 9
đều sans đậm**, nên mười pack đang chọn trong một hộp màu chỉ có một màu.

Đợt này **không làm đồ hoạ SVG, không tách nền người**. Nó làm bốn thứ rẻ nhất mà
mổ `focus` của Captions chứng minh là đủ: cặp font, mảng màu, nền chữ từng tiếng,
và một dòng tiêu đề.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Harvest Vietnamese Fonts](./phase-01-harvest-vietnamese-fonts.md) | Done |
| 2 | [Font Pair In Style Pack](./phase-02-font-pair-in-style-pack.md) | Done |
| 2b | [Align Word Baselines](./phase-02b-align-word-baselines.md) | Done — chèn thêm, xem ghi chú dưới |
| 3 | [Color Plate And Word Background](./phase-03-color-plate-and-word-background.md) | Done |
| 4 | [Project Title Line](./phase-04-project-title-line.md) | Done |
| 5 | [Build Three Packs And Verify](./phase-05-build-three-packs-and-verify.md) | Done |

Chặng 1 → 2 → **2b** → (3 ‖ 4) → 5. Chặng 3 và 4 độc lập nhau, cùng cần chặng 2.

**Chặng 2b không có trong kế hoạch gốc.** Bộ kiểm bố cục dựng ở chặng 2 lôi ra
một lỗi có sẵn: `drawtext` neo theo mép trên VỆT MỰC nên chân chữ trong cùng một
hàng lệch nhau 31–61% cỡ chữ, ở cả mười một font. Trang xem không có lỗi này, nên
nó đúng là lỗi *xem một đằng xuất một nẻo*. Nó nặng nhất ở hai họ chữ mới
(Playfair 66px, Dancing Script 73px) nên cản thẳng nghiệm thu bằng mắt của chặng
5 — phải xong trước.

## Ba ràng buộc không được phá

1. **Hai đường vẽ tách bạch.** Chữ phải-đọc-được vẫn qua `SAFE` ·
   `MAX_BLOCK_SHARE` · `MAX_LINES` · `MIN_SCALE`, và từ đợt này thêm
   `scripts/layout-guard/` canh. Chữ trang trí (tiêu đề) đi đường riêng, được
   tràn mép. Trộn chung là mất bảo đảm "chữ không bao giờ tràn khung" một lần cho
   tất cả.
2. **Bảy pack ngoài phạm vi không đổi một pixel.** Chúng là nhóm đối chứng.
3. **Catalog vẫn là bảng số.** Thêm một pack không được biến thành một việc thiết
   kế — đó là thứ giữ mô hình hiện tại rẻ.

## Cách thử — TDD trong dự án này nghĩa là gì

Dự án không có test framework; thứ đóng vai trò đó là các phép kiểm bất biến chạy
trên **dữ liệu thật**: `check:ownership`, `check:style-pack`,
`scripts/font-audit/check-glyph-coverage.py`, và `scripts/overlay-parity/`
(Python, **chạy tay** — nó dựng trang rồi so ảnh nên nặng, cố ý để ngoài
`check:all`).

**Repo này chưa có bộ kiểm bố cục.** `style-pack.ts:16` nhắc "bộ kiểm 1920 tổ
hợp" nhưng `docs/editor-interaction-spec.md:541` ghi rõ nó thuộc **dự án trước**.
Chặng 2 dựng `scripts/layout-guard/` bản gọn (~200 tổ hợp) để có lưới an toàn
trước khi chặng 4 nới `SAFE`.

Nên "tests first" ở đây = **mở rộng phép kiểm trước, thấy nó đỏ, rồi mới sửa mã**.
Mỗi chặng nêu rõ phép kiểm nào phải đỏ trước.

Phép kiểm mới đáng giá nhất, rút từ ba bộ thử hỏng trong phiên brainstorm:
**luật loại trừ** — hai lớp cùng nhấn một việc thì không được khai cùng lúc.

## Nghiệm thu

Người lạ nhìn bảng 10 ô dựng trên **footage thật của người dùng**, xem ở
**1080×1920**, phải gọi tên được ít nhất 6 bộ khác nhau mà không cần đọc chữ.

Xem ở bản thu nhỏ không tính: ở 430px cả ba bộ thử đều trông ổn, ở 1080px hai cái
hỏng.

## Dependencies

**`blocks: 260802-1733-multi-user-hardening`** — plan đó có `phase-06` đổi tên
`GOC` → `BASE_PACK` trong `server/style-pack-catalog.ts`, và `phase-04` di chuyển
mã theo miền. Đợt này sửa sâu đúng tệp ấy (thêm `fonts`, `plate`, `title` cho 10
pack). Đổi tên trước rồi sửa sâu là làm hai lần; nên chạy đợt này trước, rename
sau.

Không chặn `phase-01/02/03/05` của plan kia — chúng ở miền khác (vận hành, CI,
bundle).

## Ngoài phạm vi, cố ý

- Đồ hoạ SVG, kiến trúc assets ba tầng → đợt 2
- `roughjs`, `lucide-static`, nét vẽ tay → đợt 3
- Tách nền người (`chalk`, `ignite`) → gác, quyết định riêng
- Texture, collage, sticker → không làm

## Kết quả — 2026-08-03

Cả sáu chặng xong. `npm run check:all` xanh; hai phép so hai đường vẽ chạy tay:
140/140 và 140/140.

| Phép kiểm | Trước đợt này | Sau |
|---|---|---|
| `check:style-pack` | 27 khẳng định | **169** |
| `check:fonts` | không có trong `check:all` | trong, và quét cả thư mục |
| `check:layout` | **không tồn tại** | 260 tổ hợp, có đường cơ sở |
| `overlay-parity` | 100 ca, chỉ vai phụ đề | 140 ca, cả hai vai |

### Bốn lỗi CÓ SẴN mà đợt này lôi ra

Không lỗi nào do đợt này gây ra; cả bốn đều được bộ kiểm mới bắt.

1. **Hai kiểu nhấn vẽ chữ RA NGOÀI khung.** `keyword-large` dồn phần dẫn vào một
   hàng ở cỡ cố định, không hỏi bề rộng — cụm 13 tiếng đặt tiếng ở `x = 2076`
   trên khung rộng 1080. `mixed-size` ước bằng vết mực còn chỗ đặt cộng bước
   tiến. Sửa bằng MỘT chốt chặn ở `placeWords`, không sửa bốn công thức ước.
2. **Chân chữ trôi 31–61% cỡ chữ** trong cùng một hàng, ở **cả mười một font**.
   `drawtext` neo theo mép trên vệt mực. Trang xem không có lỗi này → đúng là lỗi
   "xem một đằng xuất một nẻo", mà phép so hộp bao không bắt được. Nay còn 1–7px.
3. **Phép kẹp "không bao giờ tràn" dùng `Math.round`** — làm tròn LÊN, tức tự cho
   phép nửa pixel vượt qua đúng cái mép nó sinh ra để giữ.
4. **Phép quét `pack.defaults` đếm cả ghi chú**, nên nhắc tới nó trong một lời
   giải thích là bị tính là vi phạm — phép kiểm trừng phạt đúng thứ đáng giữ nhất.

### Điều khoản không giữ được nguyên văn

> **Bảy pack ngoài phạm vi không đổi một pixel.**

Giữ được TINH THẦN, không giữ được nguyên văn. Đo bằng cách dựng lại toàn bộ bố
cục ở `HEAD` (git worktree) rồi so 560 tổ hợp:

| Kiểu nhấn | Lệch lớn nhất |
|---|---|
| `even` · `taper` | **2px** trên khung rộng 1080 |
| `keyword-large` · `mixed-size` | tới 1183px |

Không bộ nào khai `defaults.emphasis` là `keyword-large` hay `mixed-size` — cả
mười đều `even` hoặc `taper`. Nên với bố cục các bộ THẬT SỰ xuất ra, lệch tối đa
2px, đến từ hai lượt sửa làm tròn. Lệch lớn nằm trọn trong hai kiểu nhấn người
dùng phải tự chọn, và **96/96 tổ hợp lệch quá 8px đều là tổ hợp trước đây vẽ chữ
ra ngoài khung**.

### Việc còn treo

| Việc | Vì sao chưa làm |
|---|---|
| Ô mẫu màn chọn chưa bày vai chữ thứ hai | Bày cả hai vai trong một ô 9:16 là việc thiết kế riêng |
| Dancing Script chưa bộ nào dùng | Nét mảnh nhất kho, chỉ hợp cụm rất ngắn cỡ rất lớn |
| Mộc và Sương vẫn hao hao nhau | Cả hai là nhóm đối chứng, cố ý không đụng |
| Nghiệm thu "8/10 bộ" là ý kiến MỘT người | Người đánh giá chính là người dựng ra chúng |

## Validation Log

### Phiên 1 — 2026-08-02

#### Verification Results

- **Tier:** Full (5 chặng, cả 4 vai)
- **Claims checked:** 18 · **Verified:** 12 · **Failed:** 5 · **Unverified:** 1

**Failures**

1. `[Fact Checker]` Kế hoạch định tạo `scripts/fonts/check-vietnamese-coverage.ts`
   và `harvest-google-fonts.ts` — **đã tồn tại** dưới dạng
   `scripts/font-audit/check-glyph-coverage.py`, `fetch-fonts.mjs`,
   `font-candidates.json`. Vi phạm DRY.
2. `[Flow Tracer]` "Bộ kiểm 1920 tổ hợp" **không có trong repo này** —
   `docs/editor-interaction-spec.md:541` ghi rõ thuộc dự án trước. Kế hoạch dùng
   nó làm tiêu chí nghiệm thu ở chặng 4 → không chạy được.
3. `[Contract Verifier]` `resolvePackFont` — kế hoạch viết `(pack, role)`; chữ ký
   thật là `(relativePath: string)` tại `server/paths.ts:46`. Không cần đổi.
4. `[Scope Auditor]` `projects.title` **đã tồn tại** (`db.ts:56`, tên dự án). Cột
   mới đặt là `title_line` sẽ nhầm khi đọc truy vấn.
5. `[Fact Checker]` `overlay-parity` là script **Python chạy tay**
   (`check-overlay-parity.py`), không có npm script, không trong `check:all`. Kế
   hoạch gọi nó như bước thường lệ ở 3 chặng.

**Verified đáng chú ý**

- `elements.keywords TEXT` (`db.ts:419`), ghi bởi `ai-keywords.ts:86` → luật
  "cụm có từ khoá dùng `accent`" đọc được từ dữ liệu đã có, không cần cột mới
- `layoutText` (`text-layout.ts:154`), `textWidth` (`:445`), `placeWords`
  (`word-layout.ts:324`) — đều tồn tại, đều **async**
- `scripts/style-packs/render-real-frames.ts` và `render-pack-sheets.ts` có thật

**Phát hiện thêm ngoài danh mục kiểm:** `fetch-fonts.mjs:8` cảnh báo font biến
thiên phải đông cứng bằng `fonttools varLib.instancer`, nếu không freetype vẽ thể
Regular. **Cả 4 ứng viên thử trong phiên brainstorm đều là font biến thiên** —
tải thẳng bằng `curl` như lúc thử sẽ ra chữ mảnh dính.

#### Quyết định

| Câu hỏi | Chọn |
|---|---|
| `scripts/font-audit/` đã có | **Dùng lại** — chặng 1 thu còn 2h, chỉ thêm ứng viên + nối `check:all` |
| Bộ kiểm bố cục không tồn tại | **Dựng lại quy mô nhỏ** (~200 tổ hợp) trong chặng 2, làm lưới an toàn cho chặng 4 |
| Tên cột tiêu đề | **`headline`** — không nhầm với `projects.title` |
| `overlay-parity` | **Giữ chạy tay**, kế hoạch ghi rõ lệnh Python ở từng chặng |

#### Whole-Plan Consistency Sweep

- Files reread: `plan.md`, `phase-01` … `phase-05`, `brainstorm-report.md`
- Decision deltas checked: 4
- Reconciled stale references: 9
  - `title_line` → `headline` (7 chỗ, `phase-04`)
  - "bộ kiểm 1920 tổ hợp" → `scripts/layout-guard/` (`plan.md` ×2,
    `phase-04` ×3, `brainstorm-report.md` ×2 — thêm đính chính tại chỗ)
  - `resolvePackFont(pack, role)` → ghi chú chữ ký thật, bỏ khỏi danh sách sửa
  - `overlay-parity` → ghi rõ là bước tay kèm lệnh (`phase-02/03/04/05`)
  - `scripts/fonts/*` → `scripts/font-audit/*` (`phase-01` viết lại)
- **Unresolved contradictions: 0**
