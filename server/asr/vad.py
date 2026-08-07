"""Nhận diện GIỌNG NÓI (VAD) bằng mô hình silero — chạy thẳng qua onnxruntime.

KHÔNG dùng gói `silero-vad` vì `__init__` của nó nạp `torchaudio` (kéo theo cả
torch ~1GB). Ở đây nạp thẳng file `.onnx` bằng onnxruntime + numpy, tự chạy vòng
suy luận 512 mẫu/lần và tự gộp thành các quãng giọng — nhẹ, cùng chạy được trên
Mac lẫn VPS.

Vào:  đường dẫn `audio.wav` (16kHz, mono, PCM 16-bit — đúng thứ pipeline tách ra).
Ra:   JSON {"speech": [[start, end], ...]} — các quãng CÓ GIỌNG NÓI, tính bằng giây.

Việc phân biệt giọng nói với TIẾNG ĐỘNG (sột soạt, gõ bàn, ồn nền) là thứ ngưỡng
biên độ thô không làm được: mô hình học được đặc trưng phổ của giọng người.
"""

import json
import os
import sys
import wave

import numpy as np
import onnxruntime as ort

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, "pylibs", "silero_vad", "data", "silero_vad.onnx")

SR = 16000
CHUNK = 512  # silero ăn 512 mẫu/lần ở 16kHz (~32ms)
CONTEXT = 64  # v5 nối 64 mẫu CUỐI của chunk trước vào đầu (input thật = 576 mẫu)
HOP = CHUNK / SR

# Ngưỡng silero mặc định + trễ (hysteresis): vào giọng ở 0.5, chỉ rời khi tụt hẳn
# dưới 0.35 — tránh nhấp nháy vào/ra ngay ranh giới.
ON = 0.5
OFF = 0.35
MIN_SPEECH = 0.25  # quãng giọng ngắn hơn thì là nhiễu, bỏ
MIN_SILENCE = 0.10  # lặng ngắn hơn thì nối hai quãng giọng làm một
PAD = 0.03  # nới hai mép quãng giọng cho khỏi cụt đầu/đuôi âm


def read_wav(path: str) -> np.ndarray:
    with wave.open(path, "rb") as w:
        sr = w.getframerate()
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    audio = pcm.astype(np.float32) / 32768.0
    if sr != SR:
        # audio.wav của pipeline vốn đã 16kHz; lấy mẫu lại thô phòng khi khác.
        idx = (np.arange(int(len(audio) * SR / sr)) * sr / SR).astype(np.int64)
        audio = audio[np.clip(idx, 0, len(audio) - 1)]
    return audio


def speech_probs(audio: np.ndarray) -> list[float]:
    sess = ort.InferenceSession(MODEL, providers=["CPUExecutionProvider"])
    state = np.zeros((2, 1, 128), dtype=np.float32)
    sr = np.array(SR, dtype=np.int64)
    context = np.zeros((1, CONTEXT), dtype=np.float32)
    probs: list[float] = []
    for i in range(0, len(audio) - CHUNK + 1, CHUNK):
        chunk = audio[i : i + CHUNK].reshape(1, CHUNK).astype(np.float32)
        # Nối 64 mẫu context vào ĐẦU chunk → input 576 mẫu (đúng cái model chờ).
        inp = np.concatenate([context, chunk], axis=1)
        out, state = sess.run(None, {"input": inp, "state": state, "sr": sr})
        context = inp[:, -CONTEXT:]
        probs.append(float(out[0][0]))
    return probs


def segments(probs: list[float]) -> list[list[float]]:
    """Gộp các ô prob thành quãng giọng — cùng lối `get_speech_timestamps`."""
    out: list[list[float]] = []
    triggered = False
    start = 0.0
    temp_end = 0.0
    for i, p in enumerate(probs):
        t = i * HOP
        if p >= ON:
            if temp_end:
                temp_end = 0.0
            if not triggered:
                triggered = True
                start = t
        elif p < OFF and triggered:
            if not temp_end:
                temp_end = t
            if t - temp_end < MIN_SILENCE:
                continue
            if temp_end - start >= MIN_SPEECH:
                out.append([start, temp_end])
            triggered = False
            temp_end = 0.0
    if triggered:
        end = len(probs) * HOP
        if end - start >= MIN_SPEECH:
            out.append([start, end])

    # Nới mép + gộp chỗ chồng lấn sau khi nới.
    padded: list[list[float]] = []
    for s, e in out:
        s = max(0.0, s - PAD)
        e = e + PAD
        if padded and s <= padded[-1][1]:
            padded[-1][1] = max(padded[-1][1], e)
        else:
            padded.append([s, e])
    return [[round(s, 3), round(e, 3)] for s, e in padded]


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"speech": []}))
        return 0
    audio = read_wav(sys.argv[1])
    json.dump({"speech": segments(speech_probs(audio))}, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
