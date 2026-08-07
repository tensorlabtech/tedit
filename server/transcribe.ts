import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));

const SCRIPT = join(here, "asr", "transcribe.py");
const PYLIBS = join(here, "asr", "pylibs");

/**
 * Trình Python nào chạy được `transcribe.py`.
 *
 * Hai máy cài hai kiểu, vì hai thư viện nghe khác nhau:
 *
 * · Máy Mac dùng mlx-whisper, cài phẳng vào `asr/pylibs` và nạp qua PYTHONPATH.
 * · Máy chủ Ubuntu dùng faster-whisper, cài trong một venv riêng — nó kéo theo
 *   CTranslate2 và cả một cây phụ thuộc, mà cài phẳng những thứ đó vào Python
 *   hệ thống thì Ubuntu chặn thẳng (PEP 668).
 *
 * Có venv thì dùng venv. Không có thì `python3` của máy, tức đúng đường cũ trên
 * Mac.
 */
const VENV_PY = join(here, "asr", "venv", "bin", "python3");
const PYTHON = existsSync(VENV_PY) ? VENV_PY : "python3";

export type AsrWord = {
  text: string;
  start: number;
  end: number;
  confidence: number;
};

export type AsrSegment = {
  text: string;
  start: number;
  end: number;
  /** Mô hình tự đánh giá "chỗ này không có ai nói", 0–1 */
  no_speech_prob?: number;
  /** Trung bình log-xác suất từng token — càng ÂM càng không chắc (-1 là mốc ngờ) */
  avg_logprob?: number;
  /** Tỉ lệ nén bản chép — cao (>2.4) là lặp/gibberish */
  compression_ratio?: number;
  /** Nhiệt độ giải mã — >0 nghĩa là đã phải rơi về lấy mẫu ngẫu nhiên (fallback) */
  temperature?: number;
  words: AsrWord[];
};

/**
 * Nhận dạng cục bộ bằng mlx-whisper. Không gửi tiếng nói của người dùng đi đâu
 * và không cần khoá API nào.
 */
export async function transcribeAudio(
  audioPath: string,
  language = "vi",
  /**
   * Đoạn mồi từ vựng — xem `server/asr-bias.ts`.
   *
   * Truyền qua ĐỐI SỐ chứ không qua biến môi trường: đoạn này dài và có dấu
   * tiếng Việt, mà biến môi trường thì tuỳ hệ điều hành lại cắt hoặc đổi mã.
   */
  prompt?: string,
): Promise<AsrSegment[]> {
  const { stdout } = await run(
    PYTHON,
    [SCRIPT, audioPath, language, ...(prompt ? [prompt] : [])],
    // Bản chép của một video dài chục phút vượt xa mức đệm mặc định 1MB.
    {
      env: { ...process.env, PYTHONPATH: PYLIBS },
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  const parsed = JSON.parse(stdout) as { segments?: AsrSegment[] };
  return repairWordTimings(parsed.segments ?? []);
}

/**
 * Vá những chỗ whisper trả mốc dồn cục.
 *
 * Trên đoạn chỉ có nhạc hoặc một câu ngắn, mô hình hay gán cùng một mốc cho cả
 * chuỗi từ. Cứ để nguyên thì mọi phần tử gắn vào đám từ đó rơi chồng lên nhau
 * đúng một khoảnh khắc. Chia đều trong khoảng của câu là ước lượng thô nhưng
 * luôn cho thứ tự đúng, mà thứ tự mới là thứ mô hình gắn-vào-từ cần.
 */
function repairWordTimings(segments: AsrSegment[]): AsrSegment[] {
  return segments.map((segment) => {
    const words = segment.words;
    if (words.length < 2) return segment;

    const collapsed = words.filter(
      (word, index) => index > 0 && word.start - words[index - 1].start < 0.01,
    ).length;
    if (collapsed / words.length < 0.5) return segment;

    const span = Math.max(segment.end - segment.start, 0.2);
    const step = span / words.length;
    return {
      ...segment,
      words: words.map((word, index) => ({
        ...word,
        start: segment.start + step * index,
        end: segment.start + step * (index + 1),
      })),
    };
  });
}
