"""Nhận dạng giọng nói cục bộ bằng mlx-whisper, in JSON có mốc TỪNG TỪ ra stdout.

Chạy cục bộ nên không cần khoá API và không gửi tiếng nói của người dùng đi đâu.
"""

import json
import sys

import mlx_whisper

MODEL = "mlx-community/whisper-large-v3-turbo"

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

    result = mlx_whisper.transcribe(
        audio_path,
        path_or_hf_repo=MODEL,
        language=language,
        word_timestamps=True,
        condition_on_previous_text=False,
        initial_prompt=PROMPT,
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
