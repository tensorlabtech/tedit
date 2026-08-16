import { spawn } from "node:child_process";
import { join } from "node:path";

/**
 * TÁCH TỪ tiếng Việt (underthesea) → trả tập MÃ TIẾNG mà "sau nó CẤM ngắt cụm".
 *
 * Tiếng Việt viết rời từng tiếng, mà "phần mềm"/"chia sẻ"/"bản thân" là MỘT từ
 * nhiều tiếng — chunker (LLM hay width) hay ngắt vào GIỮA chúng. Thay vì hardcode
 * vài chục cặp (brượt kịch bản khác là toang), hỏi bộ tách-từ: từ nào nhiều tiếng
 * thì các tiếng KHÔNG-cuối của nó bị "cấm ngắt sau". Phủ cả ngôn ngữ (không phải
 * một danh sách hardcode vài chục cặp — vượt kịch bản khác là toang).
 *
 * Chạy python bên ngoài (không có gói NLP tiếng Việt thuần Node đủ tốt + bảo trì).
 * HỎNG (chưa cài, python lỗi) → trả tập RỖNG: chunker chạy y như trước, không dính
 * từ — mất một lớp bảo hiểm chứ không sai.
 */

const PYTHON =
  process.env.VI_SEGMENT_PYTHON ??
  join(process.cwd(), "scripts/vi-segment/vienv/bin/python3");
const SCRIPT = join(process.cwd(), "scripts/vi-segment/segment.py");

type WordLite = { id: string; text: string; sentence_id: string };

// Tách từ NẶNG (nạp model ~1–2s) mà một lần re-chunk gọi buildCaptionGroups vài
// lần trên CÙNG bản chép — nhớ theo chữ để chỉ chạy python một lần.
const cache = new Map<string, Set<string>>();

/** Nhóm tiếng theo câu, GIỮ thứ tự. */
function bySentence(words: readonly WordLite[]): WordLite[][] {
  const out: WordLite[][] = [];
  let last: string | null = null;
  for (const word of words) {
    if (word.sentence_id !== last) {
      out.push([]);
      last = word.sentence_id;
    }
    out[out.length - 1].push(word);
  }
  return out;
}

function runPython(input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [SCRIPT], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(err.slice(0, 200) || `exit ${code}`)),
    );
    child.stdin.write(input);
    child.stdin.end();
  });
}

/**
 * Trả tập `word.id` mà "sau tiếng này CẤM ngắt cụm" (nó dính với tiếng SAU thành
 * một từ). Nơi gọi chỉ cần `has(previous.id)` để quyết có được ngắt hay không.
 */
export async function noBreakAfterWords(
  words: readonly WordLite[],
): Promise<Set<string>> {
  if (words.length === 0) return new Set();
  const key = words.map((w) => w.text).join(" ");
  const hit = cache.get(key);
  if (hit) return hit;

  const sentences = bySentence(words);
  const input = JSON.stringify({
    sentences: sentences.map((s) => s.map((w) => w.text)),
  });

  let result: Set<string>;
  try {
    const raw = await runPython(input);
    const { noBreak } = JSON.parse(raw) as { noBreak: number[][] };
    result = new Set();
    noBreak.forEach((locals, si) => {
      const sentence = sentences[si];
      for (const local of locals) {
        const word = sentence?.[local];
        if (word) result.add(word.id);
      }
    });
  } catch (error) {
    console.warn(
      `[vi-segment] tách từ hỏng, bỏ qua (chunk không dính từ): ` +
        `${(error as Error)?.message ?? error}`,
    );
    result = new Set();
  }
  cache.set(key, result);
  return result;
}
