# Research: Mô hình CLIP b-roll cho editor neo-transcript

_Thực hiện: 2026-08-13 15:22 · 4 nguồn (Descript, B-Script/ACM, DaVinci/Premiere, CapCut/Captions)_

## Executive Summary

Hiện tại b-roll = khung-có-tư-liệu, span neo theo TỪ, nguồn phát 0→lặp; vừa thêm in/out. Kéo span dài hơn nguồn → **LẶP** (user thấy "không ổn").

**Kết luận:** cách mình đang làm (loop-to-fill) TRÙNG với prototype nghiên cứu **B-Script** — hợp lý cho b-roll ambient, nhưng NLE chuyên nghiệp (Resolve/Premiere) KHÔNG lặp: họ dùng **Fit-to-Fill (đổi tốc độ)** hoặc **Freeze frame**. Lặp có điểm-nối-nhảy, chỉ hợp b-roll không có hành động rõ.

**Khuyến nghị cốt lõi:** nâng b-roll từ "khung có media" thành một **CLIP object** với 3 trục tách biệt + **fit mode**. Đây là cái ĐÓNG GÓI mọi tính năng tương lai (tốc độ, crop, keyframe, chuyển cảnh) — trả lời trực tiếp "sau này nhiều chức năng nữa".

---

## Mô hình CLIP đề xuất (cái để scale)

Một b-roll clip = 3 trục ĐỘC LẬP + 1 chiến lược khớp:

| Trục | Là gì | Trạng thái |
|---|---|---|
| **Placement (span)** | Ở đâu / dài bao nhiêu trên timeline — NEO THEO TỪ | ✅ có (kéo mép) |
| **Source (in/out)** | Lấy phần nào của clip nguồn | ✅ vừa làm |
| **Fit mode** | Khớp span ↔ nguồn khi LỆCH | ❌ đang cứng = `loop` |
| _(future)_ Speed, Crop/Position, Keyframe, Transition | Treo trên clip | ❌ |

### Fit mode — trục THIẾU (giải "loop không ổn")

Khi span ≠ (out−in), chọn cách khớp:

| Mode | Làm | Hợp khi | Nguồn |
|---|---|---|---|
| `loop` (hiện tại) | Lặp đoạn đã lấy | B-roll ambient/texture (gõ phím, phố xá) — không có hành động 1-lần | B-Script |
| **`fit`** (fit-to-fill) | Đổi TỐC ĐỘ cho vừa span, 1 lần, không lặp | Span lệch NHẸ (±2×); mượt nhất | Resolve/Premiere |
| **`freeze`** | Phát 1 lần rồi ĐỨNG khung cuối | Nguồn ngắn hơn span nhiều; không muốn nhảy | Premiere/Resolve |
| `hold` | Đứng khung ĐẦU tới khi tới đoạn | Ken-Burns tĩnh | — |

**Mặc định nên đổi:** thay `loop` cứng bằng **`fit` khi lệch trong ±1.5–2×, `freeze` khi lệch nhiều, `loop` chỉ khi user chọn**. Hoặc gọn hơn: mặc định `freeze` (không nhảy, không slow-mo lạ) + cho chọn `loop`/`fit`. → hết "không ổn".

---

## Bài học từ đối thủ

### Descript (gần mình nhất — neo transcript)
- **Scenes** = `/` trên transcript (giống "khung/cảnh" của mình).
- B-roll = **clip**: di chuyển được, chỉnh độ dài, **kéo handle chọn điểm bắt đầu** (= source in). → xác nhận hướng "drag body = dời, inspector = source" đã bàn.

### B-Script (ACM 2019 — nghiên cứu chính)
- B-roll overlay: **kéo mép đổi độ dài**; ngắn hơn = cắt cuối, **dài hơn = LẶP**. → mình đang y hệt prototype này.
- Có **gợi ý tự động** chỗ đặt b-roll theo narration (mình đã có auto-place).

### DaVinci / Premiere (chuẩn NLE)
- Tách **source in/out** VÀ **timeline in/out** (2 range) — đúng như mình tách span vs nguồn.
- **Fit-to-Fill**: lấy đoạn nguồn + đổi tốc độ cho khít khoảng timeline (tự tính speed). → cách chuẩn xử lý lệch.
- **Freeze / Ripple / Speed** là các thao tác chuẩn trên clip.

### CapCut / Captions (bộ tính năng short-form tương lai)
- Keyframe animation, slow-mo/speed ramp, chroma key, stabilization, **auto-reframe/crop**, transition, overlay position. → đây là "nhiều chức năng nữa" — TẤT CẢ treo trên clip object.

---

## Roadmap tính năng (treo trên clip object)

Ưu tiên từ đau nhất → xa:

1. **Fit mode** (`freeze`/`fit`/`loop`) — giải "loop không ổn" NGAY. Nhỏ, giá trị cao.
2. **Kéo-để-DỜI** b-roll (drag body, snap theo từ) — đã bàn, còn nợ.
3. **Speed** per-clip (0.5×–2×) — treo trên clip; fit-to-fill dùng lại nó.
4. **Crop / Position / Scale** trong ô (reframe) — b-roll ngang nhét khung dọc.
5. **Keyframe / Ken-Burns** (zoom-pan chậm) — clip "sống" hơn.
6. **Transition in/out** per-clip (fade/slide) — hiện chỉ có junction ở vết cắt.

→ Điều kiện tiên quyết cho 3–6: **clip là object đủ trường** (đã có id/span/source, thêm `fitMode`, `speed`, `crop`, `keyframes`). Làm #1 kèm refactor nhẹ để mở đường.

---

## Kiến trúc gợi ý (KISS, khớp block-pool)

- B-roll element thêm field: `fit_mode` (enum), sau này `speed`, `crop`(json), `keyframes`(json). ĐÓNG DẤU trên element như in/out — render đọc từ element, không đọc pack (đúng nguyên tắc block-pool).
- Composition: 1 hàm `resolveClip(scene, insert)` → `{trimBefore, trimAfter, playbackRate, transform, loop}` tuỳ `fitMode`. Mọi tính năng tương lai chảy qua đây.
- Inspector "Tư liệu": scrubber in/out (có) + **selector Fit mode** + (sau) speed slider + crop.
- Timeline: giữ span (kéo mép) + thêm drag-body dời.

---

## Khuyến nghị hành động

1. **Ngay:** thêm `fitMode` (mặc định `freeze` hoặc smart) — dứt điểm "loop không ổn". ~1 field + render branch + 1 selector.
2. **Kế:** kéo-để-dời b-roll (đã thiết kế).
3. **Refactor mở đường:** gom logic clip vào `resolveClip()` để #3–6 cắm vào 1 chỗ.
4. Đừng làm sớm: keyframe/transition/chroma — YAGNI tới khi cần.

## Unresolved

- Fit mode mặc định: `freeze` (an toàn, không nhảy) hay `fit`/speed (mượt nhưng đổi tốc độ có thể lạ với b-roll người)? → cần user quyết + xem thử.
- Có nên CẤM span > nguồn (clamp) thay vì fit mode? → cứng hơn nhưng đơn giản; fit mode linh hoạt hơn, nghiêng fit mode.

## Nguồn
- [B-Script: Transcript-based B-roll Editing with Recommendations (ACM CHI 2019)](https://dl.acm.org/doi/fullHtml/10.1145/3290605.3300311)
- [Descript — Add B-roll / Scenes model](https://www.descript.com/tools/add-broll-video)
- [DaVinci Resolve — 7 ways to edit into timeline (Fit to Fill)](https://cutsio.com/blog/davinci-resolve-seven-ways-to-edit-timeline)
- [Premiere — Freeze frame for clip duration](https://helpx.adobe.com/premiere/desktop/edit-projects/change-clip-speed/freeze-a-video-frame-for-the-duration-of-a-clip.html)
- [Premiere — Change clip speed and duration](https://helpx.adobe.com/premiere/desktop/edit-projects/change-clip-speed/different-ways-to-change-clip-speed-and-duration.html)
- [Captions vs CapCut — AI editor feature set](https://captions.ai/blog/captions-vs-capcut)
