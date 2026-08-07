import { type AudioEnvelope } from "./audio-envelope";
import { db } from "./db";
import { listSegments, removeRange, removedCount } from "./segments";
import { type SpeechRegion } from "./vad";

/**
 * Rút ngắn các quãng KHÔNG PHẢI GIỌNG NÓI — im lặng VÀ tiếng động.
 *
 * ══ NGUỒN "CHỖ CÓ GIỌNG": VAD, KHÔNG PHẢI BẢN CHÉP, KHÔNG PHẢI BIÊN ĐỘ ══
 *
 * Ba đời của chặng này:
 *  1. Khe giữa các TỪ — thừa kế mọi lỗi máy nghe: whisper bỏ sót lời thì cắt sạch
 *     cả mảng thoại; chép thưa thì cắt hụt.
 *  2. Đường bao BIÊN ĐỘ — bỏ được phụ thuộc bản chép, nhưng chỉ biết to/nhỏ:
 *     tiếng động (sột soạt, gõ bàn) cũng làm biên độ lên nên bị GIỮ như giọng.
 *  3. (nay) VAD — mô hình phân biệt GIỌNG NÓI với mọi thứ khác. Cắt tất cả chỗ
 *     không-giọng: im lặng, ồn nền, sột soạt. Giữ đúng phần người nói, BẤT KỂ máy
 *     nghe có chép ra chữ hay không.
 *
 * (Bỏ chỗ NÓI LỖI / vấp / lặp / lạc đề — kể cả "Được chưa?" nói với người quay —
 * là của `ai-cuts.ts`: cái đó cần NỘI DUNG nên đọc bản chép. VAD giữ giọng ấy lại,
 * bước chép-lại-khoảng-trống chép nó ra, rồi ai-cuts mới bỏ được.)
 */

/**
 * Không-giọng ngắn hơn thì là nhịp thở tự nhiên, đụng vào là dồn dập. Mặc định
 * 0,3s theo yêu cầu; mỗi dự án hạ thấp hơn được ở màn nạp (`min_silence`).
 */
const SILENCE_MIN = 0.3;
/** Mặc định khi dự án chưa đặt `min_silence` (bản cũ). */
const MIN_SILENCE = 0.8;

/** Chừa nhịp thở quanh giọng — VAD đánh mép khá sát nên không cần chừa nhiều. */
const KEEP_TAIL = 0.1;
const KEEP_ONSET = 0.15;

/** Chừa hai đầu video (với tay bật/tắt máy quay). */
const HEAD = 0.35;
const TAIL = 0.6;

/** Cắt ngắn hơn ngần này thì `removeRange` nuốt lẹm cả mẩu dư — bỏ qua. */
const MIN_EDGE = 0.12;

/**
 * Đổi đường bao BIÊN ĐỘ thành các quãng "có tiếng" — dự phòng khi CHƯA có VAD
 * (dự án bản cũ). Thô hơn VAD: không tách được tiếng động, nhưng vẫn hơn cắt theo
 * khe từ.
 */
function speechFromEnvelope(env: AudioEnvelope): SpeechRegion[] {
  const { hop, values, speechLevel } = env;
  const out: SpeechRegion[] = [];
  let from = -1;
  for (let i = 0; i <= values.length; i += 1) {
    const voiced = i < values.length && (values[i] ?? 0) > speechLevel;
    if (voiced) {
      if (from < 0) from = i;
    } else if (from >= 0) {
      out.push([from * hop, i * hop]);
      from = -1;
    }
  }
  return out;
}

export function trimSilence(
  projectId: string,
  /** Quãng giọng từ VAD — nguồn CHUẨN. `null` thì rơi về đường bao biên độ. */
  speech: SpeechRegion[] | null = null,
  /** Đường bao — dùng khi không có VAD (dự án bản cũ). */
  envelope: AudioEnvelope | null = null,
): { trimmed: number; saved: number } {
  const setting = db
    .prepare("SELECT min_silence FROM projects WHERE id=?")
    .get(projectId) as { min_silence: number | null } | undefined;
  // `0` là "đừng tự rút" — một lựa chọn thật, không rơi về mặc định.
  const minSilence = setting?.min_silence ?? MIN_SILENCE;
  if (minSilence <= 0) return { trimmed: 0, saved: 0 };

  const regions =
    speech && speech.length > 0
      ? [...speech].sort((a, b) => a[0] - b[0])
      : envelope
        ? speechFromEnvelope(envelope)
        : null;
  if (!regions || regions.length === 0) return { trimmed: 0, saved: 0 };

  if (listSegments(projectId).length === 0) {
    throw new Error("Chưa gieo đoạn nào — không có gì để cắt lặng");
  }

  const total = (
    db
      .prepare(
        "SELECT COALESCE(SUM(duration),0) AS total FROM media_files WHERE project_id=? AND role='main'",
      )
      .get(projectId) as { total: number }
  ).total;

  // Ngưỡng rút: không-giọng dài hơn 0,3s là đáng rút; nếu dự án tự đặt thấp hơn thì
  // tôn trọng, nhưng không cao hơn 0,3s.
  const cutOver = Math.min(minSilence, SILENCE_MIN);

  // Các quãng KHÔNG-GIỌNG = phần bù của quãng giọng trong [0, total].
  const gaps: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const [start, end] of regions) {
    if (start - cursor > 0) gaps.push({ start: cursor, end: start });
    cursor = Math.max(cursor, end);
  }
  if (total - cursor > 0) gaps.push({ start: cursor, end: total });

  // Mỗi quãng không-giọng đủ dài → cắt phần giữa, chừa nhịp thở + hai đầu video.
  const targets: Array<{ start: number; end: number }> = [];
  for (const gap of gaps) {
    if (gap.end - gap.start < cutOver) continue;
    const atStart = gap.start <= 0.02;
    const atEnd = gap.end >= total - 0.02;
    const cutStart = atStart
      ? gap.start
      : atEnd
        ? gap.start + TAIL
        : gap.start + KEEP_TAIL;
    const cutEnd = atEnd
      ? gap.end
      : atStart
        ? gap.end - HEAD
        : gap.end - KEEP_ONSET;
    if (cutEnd - cutStart >= MIN_EDGE) targets.push({ start: cutStart, end: cutEnd });
  }

  // Bỏ từ CUỐI lên ĐẦU: `removeRange` tách đoạn, làm xuôi thì mốc sau xê dịch hết.
  targets.sort((a, b) => b.start - a.start);

  let trimmed = 0;
  let saved = 0;
  for (const target of targets) {
    // Đếm theo HIỆU QUẢ THẬT: `removeRange` bỏ qua khi quãng quá ngắn hoặc không
    // đoạn nào phủ đủ 60%, nên đếm số lần GỌI là báo vống lên.
    const was = removedCount(projectId);
    removeRange(projectId, target.start, target.end);
    if (removedCount(projectId) === was) continue;
    trimmed += 1;
    saved += target.end - target.start;
  }

  return { trimmed, saved };
}
