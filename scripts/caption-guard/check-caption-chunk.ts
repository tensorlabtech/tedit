/**
 * GUARD chia cụm phụ đề — khoá các bất biến của chunker mà không cần MẠNG.
 *
 * Vì sao guard chứ không unit-test: dự án không dùng vitest, mà theo idiom
 * `scripts/*-guard/check-*.ts` (như `check:commit-cut`, `check:llm-cache`). Guard
 * bơm `sentenceFn`/`ask` GIẢ nên chạy tất định, không gọi mô hình.
 *
 * Bất biến khoá:
 *  1. `groupWordsByBreaks` NGẮT ĐÚNG chỗ mô hình chọn → LLM giữ từ ghép thì cụm giữ.
 *  2. Đường width (breaks=null) KHÔNG kết cụm bằng tiếng dính-sau.
 *  3. `computeCaptionBreaks` chia THEO CÂU: câu ngắn khỏi gọi; một câu hỏng chỉ
 *     mất break câu đó (llmOk=false) chứ không sập cả bản; chỉ số map đúng toàn cục.
 *  4. `llmBreaksForSentence` RETRY lỗi tạm + LOG (không nuốt câm) + lọc break bẩn.
 *  5. `mergeShort` gộp mẩu ≤2 tiếng, giữ đủ chữ, không xẻ.
 */
import {
  computeCaptionBreaks,
  llmBreaksForSentence,
  type SentenceBreaks,
} from "../../server/ai-caption-groups";
import {
  groupWordsByBreaks,
  mergeShort,
  type CaptionWord,
} from "../../server/caption-groups";
import type { StylePack } from "../../server/style-pack";

const PACK = { grouping: { maxWords: 5, maxChars: 26 } } as unknown as StylePack;
const GROUPING = { maxWords: 5, maxChars: 26 };

// Tiếng "dính sau" — phải khớp tập trong caption-groups.ts.
const ATTACH = [
  "một", "các", "những", "mỗi", "mọi", "cái", "con", "chiếc", "và", "hoặc",
  "hay", "là", "của", "cho", "với", "về", "từ", "đến", "tới", "ở", "trong",
  "để", "mà", "thì", "nếu", "như", "theo", "bằng", "sẽ", "đang", "rất", "cũng",
];

let clock = 0;
let seq = 0;
function word(text: string, sid: string): CaptionWord {
  const start = clock;
  clock += 0.3; // khoảng cách 0,05s < 0,35s nên KHÔNG kích ngắt-do-nghỉ-hơi
  seq += 1;
  return { id: `w${seq}`, text, start_sec: start, end_sec: start + 0.25, sentence_id: sid };
}
function sentence(text: string, sid: string): CaptionWord[] {
  return text.split(" ").map((t) => word(t, sid));
}

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  // ── 1. groupWordsByBreaks ngắt đúng chỗ mô hình chọn ──────────────────────
  clock = 0;
  const s1 = sentence("Vậy tại sao mình không xây dựng một phần mềm", "s1");
  const g1 = groupWordsByBreaks(s1, [], new Set([2, 6]), GROUPING);
  const t1 = g1.map((g) => g.text);
  check(
    "honors LLM breaks (xây dựng / phần mềm nguyên khối)",
    JSON.stringify(t1) ===
      JSON.stringify(["Vậy tại sao", "mình không xây dựng", "một phần mềm"]),
    t1.join(" | "),
  );

  // ── 2. đường width (null) không kết cụm bằng tiếng dính-sau ────────────────
  clock = 0;
  const s2 = sentence("video này là của để dành cho ngày mai luôn", "s1");
  const g2 = groupWordsByBreaks(s2, [], null, GROUPING);
  const dangles = g2.filter((g) =>
    ATTACH.includes(g.words[g.words.length - 1].text.toLowerCase()),
  );
  check(
    "width fallback: không cụm nào kết bằng tiếng dính-sau",
    dangles.length === 0,
    dangles.map((g) => g.text).join(" | "),
  );

  // ── 3. computeCaptionBreaks chia theo câu ─────────────────────────────────
  process.env.OPENROUTER_API_KEY = "guard"; // hasModel() → true
  clock = 0;
  const words = [
    ...sentence("Chào các bạn", "sA"), // 3 tiếng — NGẮN, khỏi gọi
    ...sentence("mình muốn xây dựng một phần mềm mới", "sB"), // 8 — cần gọi
    ...sentence("để giúp mọi người rất là nhiều", "sC"), // 7 — cần gọi, sẽ HỎNG
  ];
  const called: string[] = [];
  const fake = async (
    _pid: string,
    ws: readonly { text: string }[],
  ): Promise<SentenceBreaks> => {
    called.push(ws.map((w) => w.text).join(" "));
    if (ws[0].text === "để") return { breaks: null, reason: "failed" };
    return { breaks: new Set([3]), reason: "ok" }; // ngắt sau "dựng" (local 3)
  };
  const r = await computeCaptionBreaks("guard", words, PACK, fake);
  check("câu ngắn KHÔNG gọi mô hình", !called.includes("Chào các bạn"), called.join(" | "));
  check("một câu hỏng → llmOk=false", r.llmOk === false);
  check("break map đúng chỉ số toàn cục (global 6 = dựng)", r.breaks?.has(6) === true, [...(r.breaks ?? [])].join(","));

  const rOk = await computeCaptionBreaks(
    "guard",
    words,
    PACK,
    async () => ({ breaks: new Set([3]), reason: "ok" }),
  );
  check("mọi câu ok → llmOk=true", rOk.llmOk === true);

  // ── 4. llmBreaksForSentence: retry + log + lọc ────────────────────────────
  let askCalls = 0;
  const throwAsk = async () => {
    askCalls += 1;
    throw new Error("No endpoints found that can handle the requested parameters");
  };
  const warns: string[] = [];
  const origWarn = console.warn;
  console.warn = (...a: unknown[]) => {
    warns.push(a.join(" "));
  };
  const failRes = await llmBreaksForSentence(
    "guard",
    sentence("một hai ba bốn năm sáu bảy", "sx"),
    PACK,
    { ask: throwAsk as never },
  );
  console.warn = origWarn;
  check("retry lỗi tạm (3 lần = RETRIES+1)", askCalls === 3, `askCalls=${askCalls}`);
  check("LOG khi hỏng (không nuốt câm)", warns.some((w) => w.includes("caption-breaks")), warns.join(" | "));
  check("hỏng → reason=failed, breaks=null", failRes.reason === "failed" && failRes.breaks === null);

  const okAsk = async () => ({ breaks: [1, 99, 0] }); // 1="30" số trần; 99 ngoài khoảng
  const cleanRes = await llmBreaksForSentence(
    "guard",
    sentence("Mình 30 tuổi rồi nhé", "sy"),
    PACK,
    { ask: okAsk as never },
  );
  check("lọc break số-trần", !!cleanRes.breaks && !cleanRes.breaks.has(1), [...(cleanRes.breaks ?? [])].join(","));
  check("lọc break ngoài khoảng", !!cleanRes.breaks && !cleanRes.breaks.has(99));

  // ── 5. mergeShort ─────────────────────────────────────────────────────────
  clock = 0;
  const raw = groupWordsByBreaks(
    sentence("Mình muốn ghi lại dấu mốc ngày", "s1"),
    [],
    new Set([2, 3]), // → "Mình muốn ghi" | "lại"(1) | "dấu mốc ngày"
    GROUPING,
  );
  check("trước gộp có mẩu ≤2 tiếng", raw.some((g) => g.words.length <= 2));
  const merged = mergeShort(raw, 5, []);
  check("gộp hết mẩu ≤2 tiếng (cùng câu)", merged.every((g) => g.words.length >= 2), merged.map((g) => `${g.words.length}:${g.text}`).join(" | "));
  check("giữ đủ chữ (7 tiếng)", merged.reduce((s, g) => s + g.words.length, 0) === 7);

  console.log(failures === 0 ? "\nOK — chunker guard xanh." : `\nFAIL — ${failures} bất biến vỡ.`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
