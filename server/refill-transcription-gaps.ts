import { unlink } from "node:fs/promises";
import { join } from "node:path";

import type { AudioEnvelope } from "./audio-envelope";
import { filterHallucinations } from "./hallucination-filter";
import { run } from "./media-tools";
import { workDir } from "./paths";
import { transcribeAudio, type AsrSegment } from "./transcribe";
import { type SpeechRegion } from "./vad";

/**
 * CHÉP LẠI CÁC KHOẢNG TRỐNG — cứu lời mà máy nghe BỎ RƠI.
 *
 * mlx-whisper thỉnh thoảng vấp một cửa sổ 30s: nó ảo giác vài token dồn cục
 * (mốc zero-duration) rồi NHẢ RỖNG cả phần còn lại của cửa sổ. Kết quả là một
 * quãng dài "không có từ" DÙ ÂM VẪN TO — có người nói thật ở đó. Bước cắt-im-lặng
 * sau đó tưởng quãng ấy là im lặng nên xoá; đo được một video mất 21s narration
 * (−22dB, 47% khung trên ngưỡng nói) chỉ vì whisper không chép ra chữ nào.
 *
 * Cách chữa ở đây: sau lượt chép chính, tìm các khoảng DÀI mà envelope còn to
 * (có nói thật) nhưng THIẾU từ, cắt riêng khúc audio đó rồi chép LẠI từng khúc.
 * Đưa một đoạn ngắn + ngữ cảnh sạch vào whisper thì nó thường không vấp lại đúng
 * chỗ vừa vấp trong lượt chép cả bài.
 */

/** (Dự phòng, đường bao) Khoảng không-từ ngắn hơn thì là ngắt tự nhiên. */
const MIN_GAP = 2.5;
/** (Dự phòng) Dải nói liền tối thiểu để coi khoảng "có lời thật" (giây). */
const LOUD_RUN = 1.2;
/** (VAD) Gộp hai quãng giọng-thiếu-từ cách nhau dưới ngần này thành một cụm. */
const MERGE_GAP = 1.0;
/** (VAD) Cụm giọng-thiếu-từ ngắn hơn thì bỏ — chép khúc quá ngắn dễ ảo giác. */
const MIN_SPEECH = 0.6;
/** Đệm hai đầu cho whisper có ngữ cảnh; lọc lại từ ngoài khoảng sau khi chép. */
const PAD = 0.4;

/** Dải nói LIÊN TỤC dài nhất (giây) trong quãng — như `auto-trim-silence`. */
function longestLoudRun(env: AudioEnvelope, from: number, to: number): number {
  const { hop, values, speechLevel } = env;
  if (speechLevel <= 0) return 0;
  let best = 0;
  let run = 0;
  for (let at = Math.floor(from / hop); at <= Math.floor(to / hop); at += 1) {
    if ((values[at] ?? 0) > speechLevel) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best * hop;
}

export async function refillTranscriptionGaps(
  projectId: string,
  audioPath: string,
  segments: AsrSegment[],
  envelope: AudioEnvelope | null,
  /** Quãng giọng từ VAD — nếu có thì dùng để bắt chỗ CÓ GIỌNG mà thiếu từ. */
  speech: SpeechRegion[] | null,
  prompt?: string,
): Promise<{ segments: AsrSegment[]; refilled: number; addedWords: number }> {
  if (!envelope) return { segments, refilled: 0, addedWords: 0 };
  const total = envelope.values.length * envelope.hop;

  // Mốc mọi từ đã chép, theo thời gian. Bỏ từ zero-duration (rác ảo giác) — chúng
  // không phủ giây tiếng nào nên không được tính là "đã có lời ở đây".
  const words = segments
    .flatMap((s) => s.words)
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start);

  let candidates: Array<{ start: number; end: number }>;
  if (speech && speech.length > 0) {
    // VAD: mỗi quãng GIỌNG mà không phủ từ nào → máy nghe đã bỏ sót ở đó. Gộp các
    // quãng gần nhau (kể cả xen chút không-giọng) để chép cả cụm một lượt — khúc
    // quá ngắn thì whisper thiếu ngữ cảnh, dễ ảo giác. Đây là cách bắt được cả câu
    // ngoài-cảnh ngắn ("Được chưa?") lẫn mảng narration dài bị bỏ.
    const hasWord = (s: number, e: number) =>
      words.some((w) => w.start < e && w.end > s);
    const missed = speech
      .filter(([s, e]) => !hasWord(s, e))
      .sort((a, b) => a[0] - b[0]);
    const merged: Array<{ start: number; end: number }> = [];
    for (const [s, e] of missed) {
      const last = merged[merged.length - 1];
      if (last && s - last.end <= MERGE_GAP) last.end = Math.max(last.end, e);
      else merged.push({ start: s, end: e });
    }
    candidates = merged.filter((g) => g.end - g.start >= MIN_SPEECH);
  } else {
    // Dự phòng (chưa có VAD): khoảng KHÔNG có từ mà đường bao CÒN TO liền mạch.
    const gaps: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    for (const w of words) {
      if (w.start - cursor >= MIN_GAP) gaps.push({ start: cursor, end: w.start });
      cursor = Math.max(cursor, w.end);
    }
    if (total - cursor >= MIN_GAP) gaps.push({ start: cursor, end: total });
    candidates = gaps.filter(
      (g) => longestLoudRun(envelope, g.start, g.end) > LOUD_RUN,
    );
  }
  if (candidates.length === 0) return { segments, refilled: 0, addedWords: 0 };

  const extra: AsrSegment[] = [];
  let addedWords = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    const gap = candidates[i];
    const from = Math.max(0, gap.start - PAD);
    const to = Math.min(total, gap.end + PAD);
    const clip = join(workDir(projectId), `gap-${i}.wav`);
    try {
      // Cắt khúc audio, giữ 16kHz mono như `audio.wav` gốc.
      await run("ffmpeg", [
        "-y",
        "-ss",
        String(from),
        "-to",
        String(to),
        "-i",
        audioPath,
        "-ac",
        "1",
        "-ar",
        "16000",
        clip,
      ]);
      const heard = await transcribeAudio(clip, "vi", prompt);
      // Dời mốc của khúc về TRỤC GỐC (whisper trả mốc tính từ 0 của khúc).
      for (const seg of heard) {
        seg.start += from;
        seg.end += from;
        for (const w of seg.words) {
          w.start += from;
          w.end += from;
        }
      }
      // Lọc câu bịa bằng envelope gốc (đã cùng trục sau khi dời).
      const { kept } = filterHallucinations(heard, envelope);
      // Chỉ giữ từ RƠI ĐÚNG trong khoảng trống — phần đệm có thể chồng lời cũ.
      for (const seg of kept) {
        // CỔNG CHẤT LƯỢNG: các khoảng này KHÓ (whisper vấp ở đây trong lượt chính),
        // chép lại hay đoán liều — avg_logprob rất âm, hoặc compression_ratio cao
        // (lặp). Bản như thế đưa vào thành phụ đề RÁC. Bỏ đi: Tầng 1 (lưới an toàn)
        // đã giữ ÂM lại nên không mất tiếng, chỉ là chỗ đó chưa có chữ — hơn hẳn
        // chèn chữ sai. Ngưỡng lấy đúng mốc whisper tự dùng để kích hoạt fallback.
        if ((seg.avg_logprob ?? 0) < -1.0 || (seg.compression_ratio ?? 0) > 2.4) {
          continue;
        }
        const inGap = seg.words.filter(
          (w) => w.start >= gap.start - 0.05 && w.start < gap.end + 0.05 && w.end > w.start,
        );
        if (inGap.length === 0) continue;
        extra.push({
          ...seg,
          words: inGap,
          start: inGap[0].start,
          end: inGap[inGap.length - 1].end,
        });
        addedWords += inGap.length;
      }
    } catch {
      // Một khúc chép hỏng thì bỏ qua, không chặn cả mạch chép lời.
    } finally {
      await unlink(clip).catch(() => {});
    }
  }

  if (extra.length === 0) return { segments, refilled: 0, addedWords: 0 };
  const merged = [...segments, ...extra].sort((a, b) => a.start - b.start);
  return { segments: merged, refilled: extra.length, addedWords };
}
