import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import type { AsrSegment, AsrWord } from "./transcribe";

/**
 * Nhận dạng bằng ElevenLabs **Scribe** (cloud) — chính xác hơn Whisper cho tiếng
 * Việt (WER ~3% vs ~15–22%), trả word-timestamps + tự nhận code-switch Việt/Anh.
 *
 * KHÔNG chạy local: gửi audio lên ElevenLabs. Chỉ bật khi có `ELEVENLABS_API_KEY`
 * — thiếu khoá thì `transcribe.ts` tự rơi về Whisper local.
 *
 * Trả về ĐÚNG shape `AsrSegment[]` như Whisper: mỗi SEGMENT = một CÂU (tách theo
 * dấu kết câu Scribe cho sẵn — nhờ vậy hết bệnh "câu khổng lồ" gộp chục câu). Các
 * metric riêng của Whisper (no_speech_prob…) để trống — Scribe hallucinate ít nên
 * không cần; downstream đọc chúng là optional.
 */

const ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";
const MODEL = process.env.ELEVENLABS_STT_MODEL ?? "scribe_v1";

type ScribeWord = {
  text: string;
  start: number;
  end: number;
  type: "word" | "spacing" | "audio_event";
  logprob?: number;
};

/** ISO 639-1 (vi) → 639-3 (vie) mà Scribe chờ; mã khác giữ nguyên. */
const toIso3 = (language: string) => (language === "vi" ? "vie" : language);

/** logprob (0 = chắc, âm = ngờ) → xác suất 0–1 cho cột `confidence`. */
const toConfidence = (logprob: number | undefined) =>
  logprob === undefined ? 1 : Math.min(1, Math.max(0, Math.exp(logprob)));

/** Tiếng kết CÂU (chấm/hỏi/than/ba-chấm) — mở segment mới sau nó. */
const endsSentence = (text: string) => /[.!?…]$/.test(text.trim());

export function hasScribe(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export async function transcribeWithScribe(
  audioPath: string,
  language = "vi",
): Promise<AsrSegment[]> {
  const buffer = await readFile(audioPath);
  const form = new FormData();
  form.append("model_id", MODEL);
  form.append("language_code", toIso3(language));
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)]),
    basename(audioPath),
  );

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY as string },
    body: form,
  });
  if (!response.ok) {
    throw new Error(
      `Scribe ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }
  const data = (await response.json()) as { words?: ScribeWord[] };
  const words = (data.words ?? []).filter((w) => w.type === "word");
  return groupIntoSentences(words);
}

/**
 * Gộp danh sách TỪ phẳng của Scribe thành các CÂU (segment).
 *
 * Mở câu mới sau: (1) tiếng kết câu (`.!?…`), (2) khoảng lặng dài (>1s) để không
 * dính hai câu người nói tách hẳn, (3) trần an toàn 40 tiếng cho câu không có
 * dấu. Mỗi câu là một `AsrSegment` khớp shape Whisper.
 */
function groupIntoSentences(words: readonly ScribeWord[]): AsrSegment[] {
  const segments: AsrSegment[] = [];
  let current: AsrWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    segments.push({
      text: current.map((w) => w.text).join(" "),
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current,
    });
    current = [];
  };

  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    if (current.length > 0) {
      const gap = w.start - current[current.length - 1].end;
      if (gap > 1) flush();
    }
    current.push({
      text: w.text,
      start: w.start,
      end: w.end,
      confidence: toConfidence(w.logprob),
    });
    if (endsSentence(w.text) || current.length >= 40) flush();
  }
  flush();
  return segments;
}
