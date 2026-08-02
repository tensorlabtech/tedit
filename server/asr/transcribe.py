"""Nhận dạng giọng nói cục bộ, in JSON có mốc TỪNG TỪ ra stdout.

Chạy cục bộ nên không cần khoá API và không gửi tiếng nói của người dùng đi đâu.

HAI ĐƯỜNG CHẠY, chọn theo máy — không phải để cho vui, mà vì bắt buộc:

· **mlx-whisper** trên máy Mac. MLX là thư viện của Apple, tính trên chip Metal
  của chính máy đó. Nhanh nhất trên Mac, và không cài được ở đâu khác.

· **faster-whisper** trên Linux. Máy chủ Contabo chạy x86, không có Metal, nên
  `import mlx_whisper` ở đó ném ImportError ngay dòng đầu.

Hai thư viện cho ra cùng một hình dạng dữ liệu (đoạn, từ, mốc, độ chắc,
no_speech_prob) nên phía Node không phải biết bên dưới là bên nào.

Đặt `TEDDIT_ASR=faster` hoặc `TEDDIT_ASR=mlx` để ép một đường cụ thể; bỏ trống
thì tự chọn theo thứ có trên máy.
"""

import json
import os
import sys

MODEL_MLX = "mlx-community/whisper-large-v3-turbo"
# Bản đã chuyển sang CTranslate2 của CÙNG mô hình. Cùng chất lượng nghe, khác
# mỗi cách tính — nên bản chép trên máy chủ không lệch so với lúc thử ở máy.
MODEL_FASTER = "deepdml/faster-whisper-large-v3-turbo-ct2"

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


def chon_duong() -> str:
    """Chọn thư viện nhận dạng: theo biến môi trường, nếu không thì theo máy."""
    ep = os.environ.get("TEDDIT_ASR", "").strip().lower()
    if ep in ("mlx", "faster"):
        return ep
    try:
        import mlx_whisper  # noqa: F401
        return "mlx"
    except ImportError:
        return "faster"


def chay_mlx(audio_path: str, language: str, prompt: str) -> dict:
    import mlx_whisper
    import mlx_whisper.decoding
    from dataclasses import replace

    # KHÔNG đặt beam_size ở đây: mlx-whisper chưa cài beam search, nó ném thẳng
    # NotImplementedError ở decoding.py ("Beam search decoder is not yet
    # implemented"). Muốn tìm theo chùm thì phải đổi sang faster-whisper —
    # tức đúng nhánh bên dưới, nơi beam search có sẵn.

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

    return mlx_whisper.transcribe(
        audio_path,
        path_or_hf_repo=MODEL_MLX,
        language=language,
        word_timestamps=True,
        condition_on_previous_text=False,
        initial_prompt=prompt,
    )


def chay_faster(audio_path: str, language: str, prompt: str) -> dict:
    """Đường chạy trên máy chủ Linux.

    `compute_type="int8"` là bắt buộc trên VPS: bản float16 cần GPU, còn float32
    ăn gấp bốn lần bộ nhớ và chậm hơn nhiều trên CPU. Sai lệch do int8 nhỏ hơn
    nhiều so với sai lệch giữa hai lần người nói phát âm cùng một từ.

    `beam_size=5` — thứ mlx không có. Trên CPU nó tốn thêm chút thời gian nhưng
    bù lại bản chép chắc hơn, và máy chủ thì chép nền chứ không ai ngồi đợi.

    `vad_filter` cắt các quãng im trước khi đưa vào mô hình. Vừa nhanh hơn, vừa
    chặn đúng cái tật whisper bịa một câu cảm ơn trên đoạn chỉ có nhạc.
    """
    from faster_whisper import WhisperModel

    # `TEDDIT_WORKER_THREADS` trước, `os.cpu_count()` chỉ là đường lùi.
    #
    # Trong container, `os.cpu_count()` trả về số core của MÁY CHỦ, không đọc hạn
    # mức `cpus` của cgroup. Máy chủ có 4 core mà container chỉ được 2,5 thì bốn
    # luồng tranh nhau phần ấy: cgroup bóp lại từng nhịp, và tổng thời gian tệ
    # hơn cả lúc chưa đặt trần. Số luồng phải khai từ bên ngoài vì chỉ bên ngoài
    # mới biết hạn mức thật là bao nhiêu.
    thread_count = int(os.environ.get("TEDDIT_WORKER_THREADS") or 0) or (
        os.cpu_count() or 4
    )
    model = WhisperModel(
        MODEL_FASTER,
        device="cpu",
        compute_type="int8",
        cpu_threads=thread_count,
    )
    segments, info = model.transcribe(
        audio_path,
        language=language,
        beam_size=5,
        word_timestamps=True,
        condition_on_previous_text=False,
        initial_prompt=prompt,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    # faster-whisper trả về bộ sinh lười; phải duyệt hết thì việc mới thực sự
    # chạy. Đổi luôn sang đúng hình dạng mà nhánh mlx trả ra.
    ra = []
    for seg in segments:
        ra.append(
            {
                "text": seg.text,
                "start": seg.start,
                "end": seg.end,
                "no_speech_prob": seg.no_speech_prob,
                "words": [
                    {
                        "word": w.word,
                        "start": w.start,
                        "end": w.end,
                        "probability": w.probability,
                    }
                    for w in (seg.words or [])
                ],
            }
        )
    return {"language": info.language, "segments": ra}


def main() -> int:
    if len(sys.argv) < 2:
        json.dump({"error": "thiếu đường dẫn audio"}, sys.stdout)
        return 1
    audio_path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else "vi"
    # Đoạn mồi từ vựng do phía Node dựng (xem server/asr-bias.ts). Không truyền
    # thì dùng câu mặc định, tức là đúng hành vi cũ.
    prompt = sys.argv[3] if len(sys.argv) > 3 else PROMPT

    duong = chon_duong()
    # Ghi ra stderr, không phải stdout: stdout là chỗ trả JSON cho phía Node, lẫn
    # một dòng chữ vào đó là hỏng cả bước phân tích.
    print(f"[asr] dùng {duong}", file=sys.stderr)

    if duong == "mlx":
        result = chay_mlx(audio_path, language, prompt)
    else:
        result = chay_faster(audio_path, language, prompt)

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
