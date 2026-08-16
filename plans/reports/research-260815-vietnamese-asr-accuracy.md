# Research: Nâng độ chính xác chép lời (Vietnamese ASR) — 2026-08-15

## Executive Summary

Bản chép sai nhiều **KHÔNG phải do dùng Whisper**, mà do dùng **bản Whisper GENERIC
`large-v3-turbo`** — chưa việt-hoá. Đòn bẩy LỚN NHẤT, rẻ nhất, GIỮ RIÊNG TƯ (chạy
local): **đổi sang model Whisper fine-tune tiếng Việt** — drop-in cho `faster-whisper`
(cùng CTranslate2), gần như đổi một chuỗi tên model. Bậc hai: tối ưu `initial_prompt`
(biasing). Bậc ba (chính xác nhất nhưng GỬI TIẾNG NÓI lên cloud, trái cam kết
"không gửi đi đâu" hiện có): ElevenLabs Scribe v2 / GPT-4o-transcribe.

## Hiện trạng (scout)

- `server/asr/transcribe.py`: `faster-whisper-large-v3-turbo-ct2` (Ubuntu) /
  `mlx-community/whisper-large-v3-turbo` (Mac). Lang=vi, có `initial_prompt` bias,
  Silero VAD, `hallucination-filter.ts`, bước `fix` (LLM sửa nghe-nhầm).
- Chạy LOCAL — code ghi rõ "Không gửi tiếng nói của người dùng đi đâu".

## Phát hiện chính

### 1. turbo vs large-v3: gap NHỎ (không phải thủ phạm chính)
Turbo cắt decoder 32→4 lớp, nhanh 6×, WER chỉ kém large-v3 ~0.5–2% (trên benchmark
CHỦ YẾU tiếng Anh). ⇒ Nâng turbo→large-v3 (non-turbo) chỉ lợi NHỎ, chậm hơn nhiều.
KHÔNG đáng là đòn bẩy chính.

### 2. Việt-hoá model = đòn bẩy THẬT (local, riêng tư)
- **EraX-WoW-Turbo-V1.1-CT2** — Whisper large-v3-**turbo** fine-tune tiếng Việt,
  sẵn CTranslate2 → **drop-in cho faster-whisper**, GIỮ tốc độ turbo, tăng chính xác
  tiếng Việt. Đổi `MODEL_FASTER` là gần xong (Ubuntu). Mac (mlx) cần bản mlx hoặc convert.
- **PhoWhisper-Large** (VinAI, fine-tune 844h giọng Việt) — CER thấp nhất nhóm large,
  SOTA benchmark Việt (Common Voice, VIVOS, VLSP). NHƯNG **yếu ở code-switching**
  (Việt+Anh lẫn) và chậm (large, không turbo).
- **VietASR** (2025) — WER câu tốt nhất, nhưng mới/ít kiểm chứng.

### 3. Code-switching (Việt+Anh) — quan trọng với nội dung tech của bạn
Nội dung có nhiều tiếng Anh ("Personal Branding", "dev", "software"). Nghịch lý:
**Whisper-large-v3 GENERIC lại THẮNG ở vùng code-switch** (thấp nhất CS-WER), hơn cả
PhoWhisper. ⇒ Model thuần-Việt (PhoWhisper) có thể sai TIẾNG ANH nhiều hơn. EraX-turbo
(nền large-v3-turbo + việt-hoá) là dung hoà tốt nhất: giữ được sức code-switch của
large-v3, thêm chính xác tiếng Việt.

### 4. Biasing (`initial_prompt`) — mẹo rẻ đang chưa tối ưu
Whisper CHỈ dùng **≤224 token CUỐI** của prompt; token cuối ảnh hưởng mạnh hơn. ⇒
prompt phải NGẮN GỌN, đặt **tên riêng / từ khoá hiếm Ở CUỐI**. Bias sai còn GÂY
hallucination. Bạn đã bias (`_init_with_bias`) — cần soát lại: có nhồi tên riêng ở
cuối, đủ ngắn không.

### 5. Cloud ASR — chính xác nhất, nhưng GỬI TIẾNG NÓI đi
| Dịch vụ | WER (bench chung) | Ghi chú |
|---|---|---|
| **ElevenLabs Scribe v2** | ~2.3% | Tốt nhất; tự nhận code-switch trong một file |
| **GPT-4o-transcribe** | ~4% | Nhận **keyword hints** + multi-language hints (hợp code-switch + tên sản phẩm); $0.006/phút; ĐÃ có key OpenAI |
| AssemblyAI Universal-2 | ~14.5% | Kém |
| Deepgram Nova-3 | ~18% | Kém |
Vietnamese nói chung tụt 15–22% WER (tiếng Việt khó). **Cloud phá cam kết "local/
riêng tư"** — chỉ chọn nếu bạn chấp nhận đánh đổi (hoặc bật opt-in).

## Khuyến nghị (theo đòn bẩy)

1. **[Làm ngay, local, rẻ] Đổi model sang bản việt-hoá.** Thử **EraX-WoW-Turbo-V1.1-CT2**
   trước (drop-in Ubuntu, giữ turbo). A/B trên 1–2 video THẬT của bạn (đo bằng mắt số
   chỗ sai) trước khi chốt — claim benchmark ≠ footage của bạn (mic, giọng, nhiễu).
2. **[Rẻ] Tối ưu `initial_prompt`**: ngắn, tên riêng/từ khoá từ "Đề bài" đặt CUỐI, ≤224 token.
3. **[Nếu 1–2 chưa đủ] Giữ `fix` LLM** nhưng nâng: cho LLM nghe cả AUDIO (multimodal
   verify) thay vì chỉ sửa theo chủ đề — bắt được lỗi mà text-only bỏ sót.
4. **[Chỉ khi chấp nhận gửi cloud] GPT-4o-transcribe** (dễ nhất — đã có key, có keyword
   hints) hoặc **ElevenLabs Scribe v2** (chính xác nhất). Cân nhắc opt-in per-dự-án.

## Cảnh báo / cạm bẫy
- **A/B trên footage THẬT** — benchmark công bố dùng data sạch; mic/giọng/nhiễu của
  bạn mới quyết định. Đo bằng "số chỗ phải sửa tay", không tin số WER công bố.
- Đổi model turbo→large-v3 non-turbo: đừng kỳ vọng nhiều, chậm mà lợi ít.
- PhoWhisper: coi chừng tiếng Anh sai NHIỀU hơn (yếu code-switch).
- initial_prompt nhồi quá → hallucination; giữ ngắn.
- Mac (mlx) và Ubuntu (faster-whisper) là HAI đường — đổi model phải lo cả hai (mlx
  cần bản mlx; nếu EraX chỉ có CT2 thì Mac cần convert hoặc chấp nhận lệch model 2 máy).

## Câu hỏi chưa chốt
- Có giữ cam kết "local/riêng tư" tuyệt đối không? (quyết định cloud có được cân nhắc.)
- Máy dev chính là Mac (mlx) hay Ubuntu (faster-whisper)? — quyết định model nào ưu tiên convert.

## Nguồn
- [PhoWhisper (VinAI, ICLR 2024)](https://arxiv.org/abs/1801.01331) · benchmark Việt
- [VietASR 2025](https://arxiv.org/pdf/2505.21527) · [Vietnamese code-switch ASR (TSPC)](https://arxiv.org/pdf/2509.05983)
- [EraX-WoW-Turbo-V1.1-CT2 (HF)](https://huggingface.co/erax-ai/EraX-WoW-Turbo-V1.1-CT2)
- [Best open-source STT 2026 — Northflank](https://northflank.com/blog/best-open-source-speech-to-text-stt-model-in-2026-benchmarks)
- [GPT-4o-transcribe (OpenAI)](https://developers.openai.com/api/docs/models/gpt-4o-transcribe) · [ElevenLabs Scribe bench](https://www.retellai.com/blog/best-speech-to-text-models)
- [faster-whisper (SYSTRAN)](https://github.com/SYSTRAN/faster-whisper) · [Whisper hallucination](https://github.com/openai/whisper/discussions/679)
