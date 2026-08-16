# Audit màn FLOW — logic + UI/UX + liên đới — 2026-08-16

Nguồn: 2 code-reviewer đọc sâu (control/state + step UI) + browser thật (chụp từng bước).
Đã dedupe + xếp hạng + điều chỉnh severity (verify bằng đọc server).

## 🔴 CRITICAL (sửa ngay)

**C1 — Một CHẶNG BẮT BUỘC lỗi = ngõ cụt không cứu được.**
`flow-page.tsx:143-148` suy `stage` CHỈ từ `running||awaiting-user`, KHÔNG đọc `failed`
lẫn `data.pipeline.blocked` (API có trả — `api.ts:176`). `currentStep` (`flow-steps.ts`)
cũng bỏ qua `failed`. Khi `captions` (bắt buộc) hoặc `commit-cut` THROW → chỉ nó
`failed`, các chặng sau `waiting` → `settled=false`, `stage=null` → `currentStep` rơi
về `"preparing"`:
- Sidebar sáng "Chuẩn bị" + xoay icon **VĨNH VIỄN**.
- Panel lọc theo `preparing` → **giấu chặng lỗi** → nút **"Thử lại"** KHÔNG hiện.
- Hero báo **"N/N chặng xong"** vui vẻ. `action=null` → không nút.
→ Render THẬT hỏng, pipeline không bao giờ settle, UI báo "xong", **0 đường cứu**.
**LIVE NGAY:** OpenRouter cạn credit → bước `captions`/`fix` fail → dính đúng ca này.
**Fix:** suy `stage` gồm cả `failed && required`; route panel về chặng lỗi để lộ nút
"Thử lại"; cân nhắc đọc `pipeline.blocked`.

**C2 — Sửa-cắt MẤT ÂM THẦM khi mạng lỗi, rồi commit VĨNH VIỄN.**
`use-cut-edit.ts:257-266` `resizeSpan`: `await dissolve(id)` rồi `await removeRange(...)`
— 2 round-trip KHÔNG nguyên tử, KHÔNG try/catch (chỉ envelope có catch, `:172`).
`enqueue` nuốt reject (`:103-106`), caller `void cut.resizeSpan()` → **không toast, không
báo lỗi**. removeRange fail → cut biến mất im lặng → user không biết → "Chốt bản cắt"
(không có đường lùi) bake sai. (commitCut đọc segments SERVER nên là "mất cut" chứ không
"bake rác" — nhưng vẫn im lặng + qua cổng không-undo.) **Fix:** try/catch từng op, toast,
re-fetch `listSegments` khi lỗi.

## 🟠 HIGH (nên sửa trước khi land)

**H3 — [LỖI CỦA CHÍNH FIX remakeProject VỪA RỒI] clobber `minSilence`.**
`use-upload.ts:201-206`: PATCH `minSilence=pack-default` nhưng KHÔNG `setMinSilence` →
UI≠DB; và **xoá giá trị 0 người dùng cố ý** ("đừng tự cắt lặng, tôi cắt tay"). (Phần
mang stylePack thì ĐÚNG — ref sync, PATCH 1 lần.) **Fix:** `setMinSilence` giá trị vừa
ghi; đừng reset nếu user đặt tay.

**H2 — `saveStylePack` nuốt lỗi PATCH, không revert** (`use-upload.ts:869-874`
`.catch(()=>{})`). Fail → UI hiện Prism, DB giữ pack cũ → **export sai pack** (block-pool
seed theo pack DB lúc tạo). Khác hẳn `saveInsertSource` (revert + toast). **Fix:** revert
state + toast khi fail.

**H1 — `useUpload` hardcode URL `/upload`** (`:207`, `:355`) trong khi chạy dưới `/flow`
→ `remakeProject`/404-restore rewrite address bar sang `/upload/:id` → router lệch URL,
reload sai trang. **Fix:** truyền base path vào hook.

**H4 — Guard `noSpeechFound` CHẾT ở `/flow`** (`use-upload.ts:1104`, `FlowPage` không đọc)
→ video không lời → studio caption rỗng, không cảnh báo. **Fix:** chặn vào studio theo
tín hiệu no-speech.

**H6 — `pull()` không `catch`** (`flow-page.tsx:134-163`) → 500 → màn intake trống +
unhandled rejection. **Fix:** thêm catch + error state.

**H-ASR — Scribe LÀM CHẾT bias từ brief.** Scribe bỏ qua `prompt` (`asr-scribe.ts` không
truyền bias) → "Đề bài · Video nói về gì" copy hứa "để nghe đúng tên riêng" giờ **SAI cho
ASR** (chỉ còn giá trị cho bước LLM). **Fix:** đổi copy, hoặc truyền keyword hints nếu
Scribe hỗ trợ.

## 🟡 IMPORTANT / MEDIUM

- **I2 (cut) — `setTimeout` rò trong `audit()`** (`cut-step.tsx:243`) không clear → pause
  playback nhầm lúc; editor đã tránh đúng pattern này. **Fix:** lưu ref + clear.
- **I4 (cut) — không pause khi scrub cut-lane** (`cut-lane.tsx:344`) → 2 playhead đánh nhau;
  studio thì có pause. **Fix:** pause on pointerdown.
- **M1 (control) — action `stale` che nút export ở studio** (`flow-page.tsx:286`) →
  `stale` true là nút primary thành "Chép lại lời" HỦY DIỆT (xoá cut/soát/caption) 1 click.
  **Fix:** scope `stale` không đè studio/cut/proofread + confirm.
- **I1 (cut) — số ở dialog cổng cắt LỆCH** (poll 1.5s vs editor state) — chỉ HIỂN THỊ
  (commit đúng), nhưng gây hiểu nhầm ở cổng không-undo. **Fix:** lấy số từ editor state.
- **H5 — remove+undo file mở-lại tạo file MA** (`use-upload.ts:643`) — undo re-insert
  serverId đã chết. **Fix:** disable undo cho file server không còn local source.
- **Đề bài — style card KHÔNG có preview** (chỉ chữ "Nhịp đen"/"Phấn"/"Prism Pro") →
  chọn mù. **Fix:** thêm thumbnail/preview mỗi style.
- **M2 — nút không có pending/disabled + "Chép lại lời" hủy diệt không confirm.**
- **M3 — `flow-page` poll `getProject` mỗi 1.5s VĨNH VIỄN** kể cả ở studio (settled) +
  trùng poll của use-upload. **Fix:** dừng poll khi settled.

## ⚪ MINOR
- b-roll empty state không dùng DS `Empty` (`broll-list.tsx:69`).
- `flow-preview.tsx` `<video>` không `onError` → 404 hiện khung trắng.
- CutStep giữ prop `words` CHẾT + flow-page map words mỗi poll để feed nó (`cut-step.tsx:61`).
- 3 nguồn format thời lượng khác nhau (`clock()` + 2 `formatDuration`) → số có thể lệch.
- `StripRow` `.map` 1-phần-tử thừa (`scene-strip.tsx:135`).
- `syncPositions` O(n) PATCH mỗi lần reorder.
- keydown effect re-subscribe mỗi render (`cut-step.tsx:203`).

## Đã kiểm ĐÚNG (không phải lỗi)
- Cảnh chính CÓ nút gỡ clip ("Gỡ cảnh", `scene-strip.tsx`) — tôi dò nhầm aria-label lúc đầu.
- drag handle cursor='grab' (đúng).
- `ensureProject` single-flight chống race 2-file-2-project (đúng).
- remakeProject mang stylePack: phần style ĐÚNG (chỉ minSilence sai — H3).
- Cursor/tooltip ở Soát lời/Bàn dựng: sạch.

## Câu hỏi mở
1. Có đường retry chặng-lỗi ngoài `MachineWorkingPanel` không? Nếu không, C1 chặn hoàn toàn.
2. Server có đảm bảo thứ tự `main_files_at_transcribe` = client `mainKeyOf` không? (quyết M1).
