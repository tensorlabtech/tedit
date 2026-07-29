import type { AudioEnvelope } from "./audio-envelope";
import type { AsrSegment } from "./transcribe";

/**
 * Bỏ những câu máy chép lời BỊA RA trên quãng không có ai nói.
 *
 * Thả một video chỉ có nhạc vào thì whisper vẫn trả về đúng một câu — thường là
 * "Cảm ơn các bạn đã theo dõi." — trải suốt 26 giây, độ chắc từng chữ 0,99, và
 * các từ dồn cả về hai đầu (một từ dài 25 giây). Không có gì trong bản chép lời
 * nói rằng nó bịa; người dùng mở bàn dựng ra và tưởng máy nghe nhầm.
 *
 * Cách duy nhất biết chắc là ĐỐI CHIẾU VỚI SÓNG ÂM: chỗ nào mô hình bảo có
 * người nói mà đường bao âm lượng nằm im ở nền ồn thì không có ai nói cả. Đo
 * hai video thật, phân tách rất rộng:
 *
 * ```
 *                       video chỉ có nhạc     video có lời thật
 *   tỉ lệ ô có tiếng          0,00            min 0,56 · trung vị 0,78
 *   từ dài nhất              25,62 giây             0,78 giây
 * ```
 *
 * Nên ngưỡng đặt rất bảo thủ — thà bỏ sót một câu bịa còn hơn xoá nhầm một câu
 * người ta đã nói thật.
 */

/** Dưới mức này thì trong khoảng đó gần như không có tiếng nào. */
const MIN_SPEECH_RATIO = 0.15;
/** Một tiếng người dài hơn ngần này là mốc hỏng, không phải cách ai đó nói. */
const MAX_WORD_LENGTH = 3;
/** Mô hình tự nghi "không có ai nói" từ mức này trở lên. */
const NO_SPEECH_SUSPECT = 0.6;
/** Nghi ngờ của mô hình chỉ thành án khi sóng âm cũng thưa tiếng tới mức này. */
const THIN_SPEECH_RATIO = 0.4;

export type FilterResult = {
  kept: AsrSegment[];
  /** Câu đã bỏ, kèm lý do đọc được — để còn ghi vào nhật ký việc */
  dropped: Array<{ text: string; reason: string }>;
};

/** Tỉ lệ ô có tiếng người trong một khoảng, 0–1. */
function speechRatio(envelope: AudioEnvelope, from: number, to: number) {
  const { hop, values, speechLevel } = envelope;
  const start = Math.max(0, Math.floor(from / hop));
  const stop = Math.min(values.length, Math.ceil(to / hop));
  if (stop <= start) return 1;
  let count = 0;
  for (let i = start; i < stop; i += 1) {
    if ((values[i] ?? 0) > speechLevel) count += 1;
  }
  return count / (stop - start);
}

export function filterHallucinations(
  segments: AsrSegment[],
  envelope: AudioEnvelope | null,
): FilterResult {
  // Không đo được sóng âm thì KHÔNG đoán: bỏ nhầm một câu thật còn tệ hơn giữ
  // lại một câu bịa, vì câu bịa còn sửa được bằng tay.
  if (!envelope) return { kept: segments, dropped: [] };

  const kept: AsrSegment[] = [];
  const dropped: FilterResult["dropped"] = [];

  for (const segment of segments) {
    const ratio = speechRatio(envelope, segment.start, segment.end);
    const longestWord = segment.words.reduce(
      (max, word) => Math.max(max, word.end - word.start),
      0,
    );
    const noSpeech = segment.no_speech_prob ?? 0;

    const reason =
      ratio < MIN_SPEECH_RATIO
        ? `không có tiếng nào trong khoảng này (${Math.round(ratio * 100)}% ô)`
        : longestWord > MAX_WORD_LENGTH && ratio < THIN_SPEECH_RATIO
          ? `một tiếng kéo dài ${longestWord.toFixed(1)} giây — mốc không tin được`
          : noSpeech > NO_SPEECH_SUSPECT && ratio < THIN_SPEECH_RATIO
            ? `máy tự nghi không có ai nói (${Math.round(noSpeech * 100)}%)`
            : null;

    if (reason) dropped.push({ text: segment.text, reason });
    else kept.push(segment);
  }

  return { kept, dropped };
}
