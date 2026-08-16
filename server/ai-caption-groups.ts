import { voiBoiCanh } from "./ai-context";
import { ATTACH_FORWARD } from "./caption-groups";
import { ask, hasModel, object } from "./llm";
import type { StylePack } from "./style-pack";

/**
 * CHIA CỤM PHỤ ĐỀ bằng mô hình — quyết định chỗ NGẮT theo NGỮ NGHĨA.
 *
 * Chia cụm là chỗ heuristic (đếm từ/ký tự/nghỉ hơi) làm dở nhất: nó cắt giữa cụm
 * có nghĩa ("…đăng một" | "dòng…") vì không hiểu câu. Mô hình đọc cả câu rồi ngắt
 * ở biên ý — đúng việc nó giỏi.
 *
 * BẤT BIẾN SỐNG CÒN: mô hình CHỈ chọn CHỖ NGẮT (theo số thứ tự tiếng), TUYỆT ĐỐI
 * không đụng vào chữ hay mốc thời gian — mọi phần tử neo vào KHOẢNG TỪ, lệch một
 * tiếng là chữ trôi sang câu khác. Nên trả về `breaks` = số thứ tự tiếng, không
 * trả về chữ (khỏi phải dò ngược chuỗi mà dò sai).
 *
 * CHIA THEO TỪNG CÂU: trước đây cả bản chép chia trong MỘT lời gọi — một lỗi gọi
 * (timeout / "No endpoints" / lệch schema) làm rơi TOÀN BỘ về heuristic width,
 * vỡ từ ghép cả video, mà `catch` lại NUỐT CÂM nên không ai biết. Giờ mỗi câu một
 * lời gọi (song song, có trần): một câu hỏng chỉ mất break câu đó — nó thành một
 * cụm dài rồi `fitGroup`/`bestSplitPoint` (biết từ ghép) chẻ hộ, KHÔNG rơi về
 * width mù. Lỗi gọi được LOG, không nuốt câm.
 */

type BreaksReply = { breaks: number[] };

// `ATTACH_FORWARD` (tiếng dính-sau, không được đứng CUỐI cụm) import từ
// `caption-groups.ts` — một nguồn duy nhất cho cả bên chọn break lẫn bên gom cụm.

const SCHEMA = object({
  breaks: { type: "array", items: { type: "integer" } },
});

/** Gọi lại tối đa ngần này lần khi lỗi TẠM (timeout / no-endpoints / rate-limit). */
const RETRIES = 2;
/** Số câu gọi mô hình song song cùng lúc — cân giữa nhanh và tránh rate-limit. */
const CONCURRENCY = 5;

const INSTRUCTIONS = (maxWords: number, maxChars: number) =>
  `Bạn chia MỘT CÂU chép lời tiếng Việt thành các CỤM PHỤ ĐỀ — mỗi cụm là MỘT dòng
chữ hiện lên màn hình, chạy theo lời nói.

Đầu vào: mỗi dòng là "số|tiếng" theo ĐÚNG thứ tự nói.

Trả về "breaks": danh sách SỐ THỨ TỰ của những tiếng KẾT THÚC một cụm (chỗ ngắt nằm
NGAY SAU tiếng đó). Ví dụ breaks=[3,7]: cụm 1 = tiếng 0..3, cụm 2 = tiếng 4..7, cụm
3 = phần còn lại. Câu ngắn vừa một dòng thì trả breaks=[] (không ngắt).

GIỚI HẠN (bắt buộc):
- Mỗi cụm TỐI ĐA ${maxWords} tiếng VÀ ${maxChars} ký tự. Đây là giới hạn CỨNG vì chữ
  in rất to. Mệnh đề dài hơn thì BẮT BUỘC chia thành nhiều cụm.

NGẮT Ở ĐÂU:
- Ở BIÊN CÓ NGHĨA: hết một ý / một vế / một mệnh đề, chỗ người đọc dừng tự nhiên.
  Ưu tiên bám dấu phẩy nếu có.
- Mệnh đề dài quá giới hạn: chia tại chỗ CÓ NGHĨA NHẤT (ranh giới hai vế), KHÔNG cắt
  bừa giữa dòng.

CẤM (rất quan trọng):
- KHÔNG tách TỪ GHÉP / CỤM TỪ CỐ ĐỊNH ra hai cụm. Tiếng Việt viết rời từng tiếng
  nên phải tự nhận ra khối đi liền. Ví dụ phải GIỮ NGUYÊN MỘT KHỐI:
  "phần mềm", "công ty", "thị trường", "nền tảng", "thành tựu", "sinh nhật",
  "ngày hôm nay", "hôm nay", "trưởng thành", "bản thân", "một chút", "xây dựng",
  "chia sẻ", số đi với đơn vị ("30 tuổi", "3 tệp"). Thà cụm ngắn/dài hơn một tiếng
  còn hơn xẻ đôi một từ ghép — cắt "công ty phần | mềm" hay "sinh | nhật" là SAI.
- KHÔNG để tiếng "dính sau" đứng CUỐI cụm (phải đi cùng tiếng SAU): một, các, những,
  mỗi, cái, và, hoặc, hay, là, của, cho, với, về, từ, để, mà, thì, nếu, như, sẽ,
  đang, rất, cũng.
- TUYỆT ĐỐI không đổi, thêm, bớt, hay đảo tiếng nào. Chỉ chọn chỗ ngắt.

Ví dụ (tiếng, đầu ra):
  0|Mình 1|muốn 2|ghi 3|lại 4|dấu 5|mốc 6|ngày 7|hôm 8|nay
  breaks=[3]  →  "Mình muốn ghi lại" | "dấu mốc ngày hôm nay"
(KHÔNG ra [7] vì [7] xẻ "ngày hôm nay".)`;

/** Kết quả chia MỘT câu. `reason` phân biệt để tính `llmOk` + quyết định có LOG. */
export type SentenceBreaks = {
  /** Số thứ tự tiếng "ngắt-sau" (0-based, CỤC BỘ trong câu). `null` = không có break. */
  breaks: Set<number> | null;
  reason: "ok" | "no-model" | "failed";
};

/** Từ tối thiểu để chia cụm cần biết. */
export type WordText = { text: string };

/** Có thể tiêm `ask` để guard chạy tất định, không gọi mạng. */
export type BreaksDeps = { ask?: typeof ask };

/**
 * Lọc break thô của mô hình: bỏ số ngoài khoảng, số trần ("30" | "tuổi"), và tiếng
 * DÍNH-SAU ("nữa là" | …) — gộp về tiếng sau, `fitGroup` lo vừa.
 */
function cleanBreaks(raw: number[] | undefined, words: readonly WordText[]) {
  return new Set(
    (raw ?? []).filter((at) => {
      if (!Number.isInteger(at) || at < 0 || at >= words.length - 1) return false;
      const text = words[at].text.trim().toLowerCase();
      if (/^\d+([.,]\d+)?$/.test(text)) return false; // số trần → dính đơn vị sau
      if (ATTACH_FORWARD.has(text)) return false; // dính-sau → đi cùng tiếng sau
      return true;
    }),
  );
}

/**
 * Chia chỗ ngắt cho MỘT câu (danh sách tiếng theo thứ tự nói, chỉ số CỤC BỘ).
 *
 * `no-model`: không có khoá mô hình — không phải lỗi, không LOG (nơi gọi để `fitGroup`
 * lo). `failed`: gọi hỏng sau khi đã retry — LOG (`console.warn`), KHÔNG nuốt câm.
 */
export async function llmBreaksForSentence(
  projectId: string,
  words: readonly WordText[],
  pack: StylePack,
  deps: BreaksDeps = {},
): Promise<SentenceBreaks> {
  if (!hasModel()) return { breaks: null, reason: "no-model" };
  if (words.length < 4) return { breaks: new Set(), reason: "ok" };
  const askFn = deps.ask ?? ask;
  const { maxWords, maxChars } = pack.grouping;
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const reply = await askFn<BreaksReply>({
        instructions: voiBoiCanh(INSTRUCTIONS(maxWords, maxChars), projectId),
        input: words.map((word, at) => `${at}|${word.text}`).join("\n"),
        schemaName: "caption_breaks",
        schema: SCHEMA,
        // Bậc CHAT (deepseek-chat): chia cụm gọi NHIỀU lần (mỗi câu một lời gọi) nên
        // cần RẺ + NHANH + TIN CẬY. Pro (v4-pro) đắt, dễ hết credit giữa chừng →
        // fail cả lượt; mà chia-cụm là "ngắt ở đâu", không phải việc suy luận sâu,
        // chat làm tốt. KHÔNG truyền `effort` — kèm reasoning có endpoint từ chối.
        cheap: true,
        // Output CHỈ là một mảng vài SỐ (~50 token) → đặt trần THẤP. Trần cao vô
        // ích còn có hại: khi credit thấp, "đòi" nhiều token hơn số chi được là HỎNG
        // cả lượt ("afford N"). 800 thừa cho mảng số mà gần như luôn chi nổi.
        maxTokens: 800,
      });
      return { breaks: cleanBreaks(reply.breaks, words), reason: "ok" };
    } catch (error) {
      lastError = error;
    }
  }
  const preview = words
    .slice(0, 6)
    .map((w) => w.text)
    .join(" ");
  console.warn(
    `[caption-breaks] ${projectId} câu "${preview}…" hỏng sau ${RETRIES + 1} lần: ` +
      `${(lastError as Error)?.message ?? lastError}`,
  );
  return { breaks: null, reason: "failed" };
}

/** Một câu = dãy chỉ số TOÀN CỤC của các tiếng cùng `sentence_id`, theo thứ tự. */
function bySentence(words: readonly { sentence_id: string }[]): number[][] {
  const spans: number[][] = [];
  let last: string | null = null;
  for (let i = 0; i < words.length; i += 1) {
    const sid = words[i].sentence_id;
    if (sid !== last) {
      spans.push([]);
      last = sid;
    }
    spans[spans.length - 1].push(i);
  }
  return spans;
}

/** Chạy `fn` trên `items` với trần song song `limit`, giữ thứ tự kết quả. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Câu cần gọi mô hình? Câu ngắn (≤ trần từ VÀ ký tự) là một cụm, khỏi gọi. */
function needsBreaks(
  words: readonly WordText[],
  maxWords: number,
  maxChars: number,
): boolean {
  if (words.length > maxWords) return true;
  const chars = words.reduce((sum, w) => sum + w.text.length + 1, 0) - 1;
  return chars > maxChars;
}

/**
 * Chỗ ngắt cụm cho CẢ bản chép — chia THEO TỪNG CÂU rồi gộp về chỉ số toàn cục.
 *
 * Trả `breaks` = tập chỉ số toàn cục "ngắt-sau", và `llmOk` = "break này đáng tin
 * là của mô hình" (có khoá + KHÔNG câu nào gọi-hỏng). `breaks === null` CHỈ khi
 * không có khoá mô hình — giữ đúng đường heuristic width cũ cho ca đó. Câu gọi-hỏng
 * (có khoá) KHÔNG kéo cả bản về null: nó chỉ thiếu break câu đó, `fitGroup` lo.
 *
 * `sentenceFn` tiêm được để test tất định (không gọi mạng).
 */
export async function computeCaptionBreaks(
  projectId: string,
  words: readonly (WordText & { sentence_id: string })[],
  pack: StylePack,
  sentenceFn: (
    projectId: string,
    words: readonly WordText[],
    pack: StylePack,
  ) => Promise<SentenceBreaks> = llmBreaksForSentence,
): Promise<{ breaks: Set<number> | null; llmOk: boolean }> {
  if (!hasModel() || words.length < 4) return { breaks: null, llmOk: false };
  const { maxWords, maxChars } = pack.grouping;
  const spans = bySentence(words);
  const needy = spans.filter((span) =>
    needsBreaks(
      span.map((i) => words[i]),
      maxWords,
      maxChars,
    ),
  );
  const results = await mapWithConcurrency(needy, CONCURRENCY, (span) =>
    sentenceFn(
      projectId,
      span.map((i) => words[i]),
      pack,
    ),
  );

  const global = new Set<number>();
  let anyFailed = false;
  needy.forEach((span, at) => {
    const result = results[at];
    if (result.reason === "failed") anyFailed = true;
    if (result.breaks) for (const local of result.breaks) global.add(span[local]);
  });
  return { breaks: global, llmOk: !anyFailed };
}
