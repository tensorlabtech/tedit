import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { workDir } from "./paths";

/**
 * Nhận diện GIỌNG NÓI (VAD) — nguồn sự thật cho "chỗ nào có người nói".
 *
 * Đường bao âm chỉ biết TO/NHỎ, không phân biệt được giọng nói với tiếng động
 * (sột soạt, gõ bàn, ồn nền) — cả hai đều làm biên độ lên. Mô hình silero học đặc
 * trưng phổ của giọng người nên tách được. Nhờ vậy:
 *   · cắt-im-lặng bỏ được cả tiếng động không-thoại, không chỉ chỗ lặng;
 *   · biết chỗ CÓ giọng mà máy nghe bỏ sót để ép chép lại.
 *
 * Chạy trong `asr/vad.py` qua onnxruntime (không kéo torch). Lưu cạnh `audio.wav`
 * như đường bao — số đo lại được từ tệp tiếng, không nhét vào CSDL.
 */

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, "asr", "vad.py");
const PYLIBS = join(here, "asr", "pylibs");
const VENV_PY = join(here, "asr", "venv", "bin", "python3");
const PYTHON = existsSync(VENV_PY) ? VENV_PY : "python3";

/** Một quãng CÓ GIỌNG NÓI: `[bắt đầu, kết thúc]` tính bằng giây. */
export type SpeechRegion = [number, number];

const vadPath = (projectId: string) => join(workDir(projectId), "vad.json");

/** Chạy VAD trên tệp tiếng, lưu kết quả, trả các quãng giọng. */
export async function detectSpeech(
  projectId: string,
  audioPath: string,
): Promise<SpeechRegion[]> {
  const { stdout } = await run(PYTHON, [SCRIPT, audioPath], {
    env: { ...process.env, PYTHONPATH: PYLIBS },
    maxBuffer: 16 * 1024 * 1024,
  });
  const parsed = JSON.parse(stdout) as { speech?: SpeechRegion[] };
  const speech = parsed.speech ?? [];
  await writeFile(vadPath(projectId), JSON.stringify({ speech }), "utf8");
  return speech;
}

/** Đọc kết quả VAD đã lưu; `null` khi dự án dựng bằng bản cũ chưa có tệp này. */
export async function readSpeech(
  projectId: string,
): Promise<SpeechRegion[] | null> {
  const path = vadPath(projectId);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as {
      speech?: SpeechRegion[];
    };
    return parsed.speech ?? [];
  } catch {
    return null;
  }
}
