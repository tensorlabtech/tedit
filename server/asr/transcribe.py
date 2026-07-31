"""Nhận dạng giọng nói cục bộ bằng mlx-whisper, in JSON có mốc TỪNG TỪ ra stdout.

Chạy cục bộ nên không cần khoá API và không gửi tiếng nói của người dùng đi đâu.
"""

import json
import sys

import mlx_whisper
import mlx_whisper.decoding
from dataclasses import replace

MODEL = "mlx-community/whisper-large-v3-turbo"

# KHÔNG đặt beam_size ở đây: mlx-whisper chưa cài beam search, nó ném thẳng
# NotImplementedError ở decoding.py ("Beam search decoder is not yet
# implemented"). Muốn tìm theo chùm — và muốn lấy n-best để sửa lỗi tốt hơn —
# thì phải đổi sang faster-whisper/CTranslate2, đó là một quyết định khác.

# Mồi cho bộ giải mã — một câu tiếng Việt viết chuẩn, KHÔNG có từ chuyên ngành.
#
# Whisper bắt đầu "nguội" thì nó vừa đoán tiếng vừa đoán luôn cách viết; có sẵn
# một đoạn tiếng Việt đúng chính tả và có dấu câu ở trước, nó bám theo lối viết
# đó và đoán tiếng cũng chắc hơn.
#
# Đo trên hai dự án thật, cùng một đoạn tiếng, chỉ khác mỗi dòng mồi này:
#   dự án A: 34% từ máy nghe không chắc → 23%   ("chuỗi sơ đi" → "chuỗi series")
#   dự án B:  4% → 2%                           (thêm cả dấu câu và viết hoa)
#
# Đã thử một mồi CÓ từ chuyên ngành (phỏng vấn, backend, principal engineer…):
# kết quả y hệt mồi trung tính. Cái ăn thua là CÓ mồi, không phải mồi nói về gì —
# nên giữ nó trung tính, đừng kéo mọi video về phía một chủ đề.
PROMPT = "Đây là một video tiếng Việt, người nói tự quay và kể chuyện của mình."


def main() -> int:
    if len(sys.argv) < 2:
        json.dump({"error": "thiếu đường dẫn audio"}, sys.stdout)
        return 1
    audio_path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else "vi"
    # Đoạn mồi từ vựng do phía Node dựng (xem server/asr-bias.ts). Không truyền
    # thì dùng câu mặc định, tức là đúng hành vi cũ.
    prompt = sys.argv[3] if len(sys.argv) > 3 else PROMPT

    # Bơm lại đoạn mồi ở MỌI cửa sổ 30 giây.
    #
    # mlx_whisper chỉ dùng initial_prompt cho cửa sổ ĐẦU: khi
    # condition_on_previous_text=False, nó đặt prompt_reset_since = len(all_tokens)
    # sau mỗi cửa sổ (transcribe.py:531), nên từ giây 30 trở đi máy nghe không còn
    # được mồi gì. Đo thật: "network" nằm ở giây 93 và vẫn ra "nem quốc" dù mồi đã
    # có sẵn từ đó.
    #
    # Không bật condition_on_previous_text=True để chữa: cách ấy mồi bằng chính
    # lời vừa chép, mà lời ấy có thể đã sai — whisper nổi tiếng với vòng lặp lặp
    # chữ khi bật cờ này.
    _OrigTask = mlx_whisper.decoding.DecodingTask
    _orig_init = _OrigTask.__init__

    def _init_with_bias(self, model, options):
        if prompt and not getattr(options, "prompt", None):
            options = replace(options, prompt=prompt)
        _orig_init(self, model, options)

    _OrigTask.__init__ = _init_with_bias

    result = mlx_whisper.transcribe(
        audio_path,
        path_or_hf_repo=MODEL,
        language=language,
        word_timestamps=True,
        condition_on_previous_text=False,
        initial_prompt=prompt,
    )

    segments = []
    for seg in result.get("segments", []):
        words = [
            {
                "text": w["word"].strip(),
                "start": float(w["start"]),
                "end": float(w["end"]),
                "confidence": float(w.get("probability", 1.0)),
            }
            for w in seg.get("words", [])
            if w["word"].strip()
        ]
        if not words:
            continue
        segments.append(
            {
                "text": seg["text"].strip(),
                "start": float(seg["start"]),
                "end": float(seg["end"]),
                # Mô hình tự nói nó nghi đoạn này KHÔNG có ai nói. Trên video chỉ
                # có nhạc, whisper vẫn bịa ra một câu ("Cảm ơn các bạn đã theo
                # dõi.") với độ chắc từng chữ rất cao — con số này là chỗ duy
                # nhất nó thú nhận. Máy chủ đối chiếu tiếp với sóng âm thật.
                "no_speech_prob": float(seg.get("no_speech_prob", 0.0)),
                "words": words,
            }
        )

    json.dump(
        {"language": result.get("language", language), "segments": segments},
        sys.stdout,
        ensure_ascii=False,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
