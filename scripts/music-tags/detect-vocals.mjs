/**
 * Bài nào CÓ LỜI HÁT — dò bằng chính bộ nhận dạng giọng nói đã có sẵn.
 *
 * Vì sao dùng whisper chứ không đo phổ: giọng hát và nhạc cụ chồng lên nhau
 * trong cùng một dải tần, nên mọi phép đo phổ đều chỉ ra được "có thứ gì đó ở
 * dải giữa" — mà cây guitar cũng vậy. Whisper thì trả lời đúng câu đang hỏi:
 * có ai đang HÁT RA CHỮ không.
 *
 * Chạy cục bộ (mlx-whisper), không cần khoá API và không tệp nào rời khỏi máy.
 *
 * Cách đọc kết quả: bài không lời cho ra chuỗi rỗng, hoặc vài mảnh vụn rời rạc
 * mà whisper bịa ra từ tiếng nhạc. Nên ngưỡng không phải "có chữ nào không" mà
 * là "có ĐỦ chữ trong đủ nhiều đoạn không" — xem `LOOKS_SUNG`.
 *
 *   node scripts/music-tags/detect-vocals.mjs > /tmp/music-vocals.json
 */
import { execFile } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");
const library = join(projectRoot, "server", "data", "music");
const script = join(projectRoot, "server", "asr", "transcribe.py");
const pylibs = join(projectRoot, "server", "asr", "pylibs");
const AUDIO = /\.(mp3|m4a|aac|wav|ogg|flac)$/i;

/** Nghe 60 giây từ giây thứ 20 — bỏ đoạn mở đầu, ở đó thường chưa vào lời. */
const SKIP_SECONDS = 20;
const LISTEN_SECONDS = 60;

/**
 * Ngưỡng "đây là lời hát thật" chứ không phải whisper bịa ra từ tiếng nhạc.
 *
 * Ba điều kiện cùng lúc:
 *
 * 1. **`no_speech_prob` thấp** — đây là con số của chính mô hình cho câu hỏi
 *    "chỗ này có ai nói không". Nó là bằng chứng mạnh nhất và rẻ nhất.
 * 2. **Đủ nhiều TỪ** sau khi đã bỏ những câu bịa quen mặt.
 * 3. **Trải trên đủ nhiều ĐOẠN** — bài không lời thỉnh thoảng cho ra một cụm
 *    dài vô nghĩa ở đúng một chỗ; nó qua được điều kiện 2 nhưng không qua được
 *    điều kiện này.
 *
 * Đo thật trên cả 55 bài của kho: mọi bài đều ra `khong-loi`, và thứ whisper
 * trả về là hai câu bịa quen mặt ("Hãy subscribe cho kênh…") — đúng thứ ba điều
 * kiện trên loại bỏ.
 */
const MIN_WORDS = 25;
const MIN_SEGMENTS = 5;
const MAX_NO_SPEECH = 0.5;

/**
 * Những câu whisper BỊA RA trên quãng không có ai nói. Chúng lặp gần như nguyên
 * văn nên nhận ra bằng một mẩu đặc trưng là đủ.
 */
const HALLUCINATIONS = [
  "hãy subscribe",
  "đăng ký kênh",
  "cảm ơn các bạn đã theo dõi",
  "ghiền mì gõ",
  "la la school",
  "một đoạn nhạc",
];

const stripHallucinations = (text) =>
  text
    .split(/(?<=[.!?])\s+/)
    .filter((line) => {
      const lower = line.toLowerCase();
      return !HALLUCINATIONS.some((phrase) => lower.includes(phrase));
    })
    .join(" ");

const LOOKS_SUNG = (words, segments, noSpeech) =>
  noSpeech <= MAX_NO_SPEECH && words >= MIN_WORDS && segments >= MIN_SEGMENTS;

/** Mồi TRUNG TÍNH, không gợi ý chủ đề — ở đây chỉ cần biết có chữ hay không. */
const PROMPT = "Một đoạn nhạc.";

async function listen(path, workDir) {
  const clip = join(workDir, "clip.wav");
  await run("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-ss",
    String(SKIP_SECONDS),
    "-t",
    String(LISTEN_SECONDS),
    "-i",
    path,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    clip,
  ]);

  const { stdout } = await run("python3", [script, clip, "vi", PROMPT], {
    env: { ...process.env, PYTHONPATH: pylibs },
    maxBuffer: 64 * 1024 * 1024,
  });
  const parsed = JSON.parse(stdout);
  const segments = parsed.segments ?? [];
  const raw = segments
    .map((segment) => String(segment.text ?? "").trim())
    .join(" ")
    .trim();
  const text = stripHallucinations(raw).trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  const noSpeech = segments.length
    ? Math.min(...segments.map((s) => Number(s.no_speech_prob ?? 1)))
    : 1;
  return {
    words,
    segments: segments.length,
    noSpeech: Math.round(noSpeech * 100) / 100,
    text: raw.slice(0, 120),
  };
}

const workDir = mkdtempSync(join(tmpdir(), "vocal-"));
try {
  const files = readdirSync(library).filter((name) => AUDIO.test(name));
  const rows = [];
  for (const file of files) {
    let heard = { words: 0, segments: 0, noSpeech: 1, text: "" };
    try {
      heard = await listen(join(library, file), workDir);
    } catch (cause) {
      process.stderr.write(`✗ ${file} — ${String(cause).slice(0, 80)}\n`);
    }
    const vocal = LOOKS_SUNG(heard.words, heard.segments, heard.noSpeech)
      ? "co-loi"
      : "khong-loi";
    rows.push({ file, vocal, ...heard });
    process.stderr.write(
      `· ${file} — ${vocal} (${heard.words} từ / ${heard.segments} đoạn / im ${heard.noSpeech})\n`,
    );
  }
  console.log(JSON.stringify(rows, null, 2));
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
