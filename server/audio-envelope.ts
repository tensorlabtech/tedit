import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { run } from "./media-tools";
import { workDir } from "./paths";

/**
 * Đường bao âm lượng của bản tiếng — đo MỘT LẦN lúc chép lời, dùng ở hai chỗ.
 *
 * 1. Dải sóng âm trên bàn dựng: nhìn là biết chỗ nào có tiếng, chỗ nào lặng,
 *    không phải bấm phát rồi đoán.
 * 2. Đẩy mép quãng lặng ra khỏi tiếng nói (`segment-seed.ts`). Mốc từ của máy
 *    chép lời cắt SỚM hơn tiếng thật: đo trên một bản 66 giây, đuôi tiếng còn
 *    kéo thêm 70ms (trung vị) tới 380ms sau mốc kết thúc câu. Bỏ "khoảng lặng"
 *    theo đúng mốc đó là chặt mất đuôi từ cuối câu — nghe ra một tiếng cụt.
 *
 * Lưu thành tệp cạnh `audio.wav` chứ không nhét vào CSDL: nó là số đo lại được
 * từ tệp tiếng, và dài hàng nghìn con số.
 */

/** Một ô của đường bao dài bằng này giây. 20ms đủ mịn để thấy từng tiếng. */
export const ENVELOPE_HOP = 0.02;

export type AudioEnvelope = {
  hop: number;
  /** Mức to của từng ô, 0–1 (chuẩn hoá theo đỉnh của cả bản) */
  values: number[];
  /**
   * Trên mức này thì coi là CÓ AI ĐANG NÓI, cùng thang 0–1 với `values`.
   *
   * Lấy nền ồn (phân vị 10) nhân bốn — tức là +12dB. Đủ cao để tiếng máy lạnh
   * không tính là nói, đủ thấp để đuôi từ đang tắt dần vẫn còn được tính.
   */
  speechLevel: number;
};

const envelopePath = (projectId: string) =>
  join(workDir(projectId), "envelope.json");

/**
 * Đo đường bao từ tệp tiếng đã tách.
 *
 * Đọc thẳng PCM 16-bit qua ffmpeg rồi tự tính hiệu dụng từng ô, không dùng
 * `astats`: bộ lọc đó in ra theo khung nội bộ của nó nên bước nhảy không đặt
 * được đúng, mà bước nhảy chính là thứ quyết định dải sóng vẽ ra mịn hay vụn.
 */
export async function buildEnvelope(
  projectId: string,
  audioPath: string,
): Promise<AudioEnvelope> {
  const sampleRate = 16000;
  const { stdout } = await run(
    "ffmpeg",
    ["-v", "error", "-i", audioPath, "-ac", "1", "-ar", String(sampleRate), "-f", "s16le", "-"],
    // Một giờ tiếng ở 16kHz/16-bit là 115MB — cho hẳn 512MB để không vỡ giữa chừng.
    { encoding: "buffer", maxBuffer: 512 * 1024 * 1024 },
  );
  const pcm = stdout as unknown as Buffer;
  const samples = new Int16Array(
    pcm.buffer,
    pcm.byteOffset,
    Math.floor(pcm.byteLength / 2),
  );

  const step = Math.round(sampleRate * ENVELOPE_HOP);
  const count = Math.floor(samples.length / step);
  const rms: number[] = new Array(count);
  for (let i = 0; i < count; i += 1) {
    let sum = 0;
    for (let j = i * step; j < (i + 1) * step; j += 1) {
      const value = samples[j] / 32768;
      sum += value * value;
    }
    rms[i] = Math.sqrt(sum / step);
  }

  const peak = Math.max(...rms, 1e-6);
  const values = rms.map((value) => Number((value / peak).toFixed(4)));
  const sorted = [...values].sort((a, b) => a - b);
  const noiseFloor = sorted[Math.floor(sorted.length * 0.1)] ?? 0;

  const envelope: AudioEnvelope = {
    hop: ENVELOPE_HOP,
    values,
    speechLevel: Number(Math.max(noiseFloor * 4, 0.01).toFixed(4)),
  };
  await writeFile(envelopePath(projectId), JSON.stringify(envelope), "utf8");
  return envelope;
}

/** Đọc đường bao đã đo; `null` khi dự án dựng bằng bản cũ chưa có tệp này. */
export async function readEnvelope(
  projectId: string,
): Promise<AudioEnvelope | null> {
  const path = envelopePath(projectId);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8")) as AudioEnvelope;
  } catch {
    return null;
  }
}

/** Ô nào của đường bao đang có tiếng người. */
const hasSpeech = (envelope: AudioEnvelope, index: number) =>
  (envelope.values[index] ?? 0) > envelope.speechLevel;

/**
 * Giây cuối cùng còn nghe thấy tiếng, tính từ `from` đi tới, xa nhất `limit` giây.
 *
 * Cho phép hụt vài ô rồi mới coi là hết: giữa hai tiếng của một từ vẫn có chỗ
 * trũng, dừng ngay ở ô trũng đầu tiên là cắt vào giữa từ.
 */
export function speechEndsAt(
  envelope: AudioEnvelope,
  from: number,
  limit: number,
) {
  const { hop, values } = envelope;
  let index = Math.max(0, Math.floor(from / hop));
  const stop = Math.min(values.length - 1, Math.floor((from + limit) / hop));
  let last = index - 1;
  let miss = 0;
  while (index <= stop) {
    if (hasSpeech(envelope, index)) {
      last = index;
      miss = 0;
    } else if (++miss >= 3) {
      break;
    }
    index += 1;
  }
  return Math.min(from + limit, Math.max(from, (last + 1) * hop));
}

/**
 * Giây đầu tiên nghe thấy tiếng khi đi NGƯỢC từ `to` về trước, xa nhất `limit`.
 *
 * Máy chép lời cũng hay vào muộn, nhất là với phụ âm bật hơi ở đầu từ.
 */
export function speechStartsAt(
  envelope: AudioEnvelope,
  to: number,
  limit: number,
) {
  const { hop, values } = envelope;
  let index = Math.min(values.length - 1, Math.floor(to / hop));
  const stop = Math.max(0, Math.floor((to - limit) / hop));
  let first = index + 1;
  let miss = 0;
  while (index >= stop) {
    if (hasSpeech(envelope, index)) {
      first = index;
      miss = 0;
    } else if (++miss >= 3) {
      break;
    }
    index -= 1;
  }
  return Math.max(to - limit, Math.min(to, first * hop));
}
