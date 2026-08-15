# Brainstorm — Vá chunker cụm phụ đề + đường chia lại

Ngày: 2026-08-15 · Trạng thái: đã chốt hướng, chờ /ck:plan

## Vấn đề

Bản chép ở **Soát lời** hiện cụm vỡ giữa từ ghép (`xây|dựng`, `chia|sẻ`,
`Personal|Branding`), dòng kết bằng hư từ (`tại`, `đã`, `khiến`). Data MỚI.

## Chẩn đoán (đã verify bằng đọc nguồn)

- Cụm ở Soát lời do **gieo-lười** `createCaptionElements → buildCaptionGroups →
  llmCaptionBreaks`, đặt **đúng 1 lần** rồi khoá `captions_seeded=1`. Bước
  `captions` sau Soát lời **không chia lại cụm** (chỉ dựng lại segment). ⇒ cụm ở
  gate = cụm cuối, nhưng **đóng băng**.
- `caption-groups.ts:206`: có `llmBreaks` (kể cả rỗng) → cấm trần bề-rộng; **chỉ
  `llmBreaks === null` mới tụt heuristic width** → đúng dấu-vân-tay cụm vỡ.
- `ai-caption-groups.ts`: `null` khi `!hasModel()`, `words<4`, hoặc **`catch {}`
  nuốt CÂM mọi lỗi gọi LLM**. Cả bản chép chia trong **1 lời gọi** → 1 lỗi = vỡ
  cả video, không log, không retry, không cứu từng phần.
- Hai lỗi độc lập: **(A)** chunker fail câm → tụt width; **(B)** seed đóng băng,
  không có đường chia lại → sửa chunker xong dự án cũ vẫn vỡ mãi.

## Ghi chú phụ (đã làm rõ cho user)

`fix` ("Sửa chỗ nghe nhầm") **chạy TRƯỚC Soát lời** (commit-cut → fix →
review-text), không phải phía sau. Bản chép user soát đã được LLM sửa nghe-nhầm.
`fix` sửa CHỮ, khác hệ với chia CỤM — không liên quan lỗi cụm vỡ.

## Hướng đã chốt: "Sửa gốc + nút chia lại"

### Vá A — chunker không fail câm (`ai-caption-groups.ts`)
1. Log lỗi trong `catch` (projectId + message).
2. Retry lỗi tạm (timeout / "No endpoints" / rate-limit) 1–2 lần.
3. Tách "không model" (null hợp lệ → width OK) ≠ "gọi hỏng" (KHÔNG đóng băng
   width như bản cuối → ghi cờ cần-chia-lại).
4. **Chia theo TỪNG CÂU** [user chốt CÓ]: gọi LLM cho mỗi câu, **CHỈ câu vượt
   maxWords/maxChars** mới cần gọi (câu ngắn = 1 cụm, khỏi gọi) → giảm mạnh số
   call. Chạy song song (cap concurrency) giữ wall-clock thấp. Lỗi 1 câu chỉ
   hỏng câu đó.

### Vá B — đường chia lại
5. Cờ `captions_llm_ok` (0/1) đặt lúc gieo: 1 nếu dùng break LLM, 0 nếu tụt width
   do gọi-hỏng.
6. **Nút "Chia lại cụm"** [user chốt: chỉ ở **Soát lời**] → POST rechunk →
   `createCaptionElements` lại từ bảng từ (chữ/mốc giữ, chỉ đổi ranh) → thay cụm.
7. **Tự cứu** [user chốt: chỉ dự-án-lỗi-lúc-gieo]: GET dự án mà
   `captions_llm_ok=0` + có model + **chưa bị sửa cụm** + máy rảnh → tự chia lại
   1 lần. KHÔNG version-bump toàn bộ (tránh xoá tinh chỉnh dự án tốt).

### Ràng buộc: chia lại vs công sức đã bỏ
Chia lại đổi ranh cụm → **nhãn per-cụm (từ-nhấn, kiểu chữ, chỗ đặt) mất** (chữ/mốc
giữ). Nên:
- Dự án chưa tinh chỉnh (vỡ-lúc-gieo): auto an toàn.
- Dự án đã tinh chỉnh: nút chia lại **hỏi xác nhận** trước khi mất nhãn.

## File đụng tới (dự kiến)
- `server/ai-caption-groups.ts` — log/retry/per-sentence/tách no-model-vs-fail.
- `server/caption-groups.ts` — nhận break theo câu; ghi cờ llm_ok.
- `server/caption-elements.ts` — rechunk thay cụm, giữ chữ/mốc.
- `server/routes/*` — endpoint POST rechunk; auto-cứu ở GET project.
- `server/db.ts` — cột `captions_llm_ok` (+ migration).
- `src/routes/flow/soat-loi-step.tsx` (+ panel) — nút "Chia lại cụm" + xác nhận.

## Quyết định user
- Tự-cứu: **chỉ dự án lỗi-lúc-gieo**.
- Nút chia lại: **chỉ Soát lời**.
- Chia theo từng câu: **CÓ**.

## Câu hỏi chưa chốt
- Ngưỡng retry (1 hay 2 lần) + có nên log ra telemetry riêng không → chốt ở plan.
- Concurrency cap khi gọi song song per-câu (đề xuất 4–5) → chốt ở plan.
