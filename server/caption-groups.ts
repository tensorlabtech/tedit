import { computeCaptionBreaks } from "./ai-caption-groups";
import { db } from "./db";
import { noBreakAfterWords } from "./vi-word-segment";
import { skippedSpans } from "./segments";
import { OUT_HEIGHT, OUT_WIDTH } from "./render";
import { contentRect, shownPacks, type StylePack } from "./style-pack";
import { layoutText, type Band } from "./text-layout";

/** Một từ trong bản chép lời, mang theo mã để chữ còn neo vào được. */
export type CaptionWord = {
  id: string;
  text: string;
  start_sec: number;
  end_sec: number;
  sentence_id: string;
};

/**
 * Một cụm chữ chia ra từ lời nói.
 *
 * Giữ nguyên DANH SÁCH TỪ chứ không chỉ giữ chuỗi chữ: cụm sẽ thành một chữ
 * trên màn, mà chữ trên màn neo vào KHOẢNG TỪ (xem đặc tả §1). Có mã từ ở đây
 * thì cụm mới đi tiếp được; chỉ có chuỗi chữ thì tới lúc dựng phần tử lại phải
 * dò ngược theo thời gian và dò sai là chữ trôi sang câu khác.
 */
export type CaptionGroup = {
  words: CaptionWord[];
  text: string;
  start: number;
  end: number;
  /** Mốc bắt đầu của TỪNG TIẾNG — để chữ hiện đúng lúc tiếng được nói ra */
  wordStarts: number[];
};

const build = (words: CaptionWord[]): CaptionGroup => ({
  words,
  text: words.map((word) => word.text).join(" "),
  start: words[0].start_sec,
  end: words[words.length - 1].end_sec,
  wordStarts: words.map((word) => word.start_sec),
});

/**
 * Tiếng "DÍNH SAU" — gần như luôn gắn với tiếng ĐỨNG SAU nó (mạo/loại từ, liên từ,
 * giới từ, phó từ trước động/tính từ). Kết cụm bằng chúng đọc cụt lủn.
 */
// NGUỒN DUY NHẤT của danh sách tiếng dính-sau — `ai-caption-groups.ts` import lại
// (trước đây hai file khai hai bản lệch nhau, "con/chiếc/ở/trong" chỉ có một bên).
export const ATTACH_FORWARD = new Set([
  "một", "các", "những", "mỗi", "mọi", "cái", "con", "chiếc",
  "và", "hoặc", "hay", "là", "của", "cho", "với", "về", "từ",
  "đến", "tới", "ở", "trong", "để", "mà", "thì", "nếu", "như",
  "theo", "bằng", "sẽ", "đang", "rất", "cũng",
]);
const isAttachForward = (text: string) =>
  ATTACH_FORWARD.has(text.trim().toLowerCase());
/** Dấu KẾT MỆNH ĐỀ (phẩy/chấm-phẩy/hai-chấm) — biên có nghĩa của ASR/LLM. */
const endsClause = (text: string) => /[,;:]$/.test(text.trim());
/** Nghỉ hơi giữa hai tiếng dài hơn ngần này = mép cụm CỨNG (biên thật của giọng). */
const BREATH_GAP = 0.35;
/** Số trần ("30") — không được đứng cuối cụm (xẻ khỏi đơn vị "tuổi"). */
const isBareNumber = (text: string) => /^\d+([.,]\d+)?$/.test(text.trim());

/**
 * Chỗ chẻ ĐẸP NHẤT gần giữa cho một cụm quá dài (khi `fitGroup` buộc chia đôi).
 *
 * Chẻ CHÍNH GIỮA (như bản cũ) hay rơi vào giữa cụm cố định ("30 | tuổi"). Ưu tiên:
 *  1) dấu phẩy gần giữa nhất (biên mệnh đề), rồi
 *  2) chỗ gần giữa mà KHÔNG xẻ số+đơn vị và KHÔNG kết bằng tiếng dính-sau.
 */
function bestSplitPoint(
  words: CaptionWord[],
  noBreak: ReadonlySet<string>,
): number {
  const n = words.length;
  const mid = Math.max(1, Math.round(n / 2));
  let comma = -1;
  let best = Infinity;
  for (let i = 1; i < n; i += 1) {
    // Dấu phẩy ở tiếng cấm-ngắt-sau thì không dùng (không xẻ giữa từ).
    if (endsClause(words[i - 1].text) && !noBreak.has(words[i - 1].id)) {
      const dist = Math.abs(i - mid);
      if (dist < best) {
        best = dist;
        comma = i;
      }
    }
  }
  if (comma !== -1) return comma;
  const bad = (i: number) =>
    isBareNumber(words[i - 1].text) ||
    isAttachForward(words[i - 1].text) ||
    noBreak.has(words[i - 1].id);
  for (let off = 0; off < n; off += 1) {
    for (const i of [mid - off, mid + off]) {
      if (i >= 1 && i < n && !bad(i)) return i;
    }
  }
  return mid;
}

/*
 * CON SỐ CHIA CỤM nằm trong bộ dáng (`pack.grouping`), không còn là hằng.
 *
 * CHỖ NÀY THỰC SỰ ĐANG DÙNG GÌ (đọc kỹ trước khi chỉnh — comment cũ ghi sai số):
 *
 * - **maxWords (thật: 7)** — trần số TIẾNG mỗi cụm. Ràng buộc bề rộng: quá tay
 *   là phép đo font buộc co chữ về cỡ chú thích. Ít chữ to hơn nhiều chữ nhỏ.
 * - **maxChars (thật: 32–36 theo bộ)** — trần KÝ TỰ, ràng buộc THẬT (trần tiếng
 *   chỉ là ước): "Mình" và "nghiêng" đều một tiếng mà dài gấp đôi nhau.
 *
 * Chỉ HAI trần trên được `groupWordsByBreaks` cưỡng chế. Ngưỡng THỜI GIAN thực tế
 * KHÔNG phải `maxSpan` mà là **nghỉ-hơi > 0,35s** (hằng `BREATH_GAP`, dưới) — mép
 * nghỉ hơi cắt cụm cứng.
 *
 * `maxSpan` / `minHold` KHAI trong `pack.grouping` nhưng HÀM NÀY CHƯA đọc — chúng
 * là chỗ để dành cho "phụ đề từng chữ" (`maxWords: 1`, cần sàn thời gian mỗi cụm
 * kẻo một tiếng 0,12s nhấp nháy). Đừng tưởng đổi hai số đó là đổi được hành vi.
 */

/**
 * Gom từ thành cụm chữ chạy theo lời.
 *
 * Gom theo TỪ chứ không lấy nguyên câu: một câu 15 từ in ra là bốn dòng chữ
 * đứng im 6 giây, người xem đọc xong từ lâu rồi mới sang câu sau. Cắt cụm ở
 * chỗ nghỉ tự nhiên khi có, không thì cắt theo số từ.
 */
export async function buildCaptionGroups(
  projectId: string,
  band: Band = "bottom",
  /**
   * Bộ dáng quyết định cỡ chữ và bước dòng, nên nó quyết định luôn CHỖ TÁCH cụm.
   *
   * BẮT BUỘC truyền, không có mặc định — cùng lý do với `avail` của `fitGroup`
   * bên trang xem: nơi nào quên truyền sẽ tách cụm theo mật độ của bộ gốc trong
   * khi video in ra theo mật độ của bộ khác, và không có lỗi nào báo ra.
   */
  pack: StylePack,
): Promise<{ groups: CaptionGroup[]; llmOk: boolean }> {
  const words = db
    .prepare(
      `SELECT w.id, w.text, w.start_sec, w.end_sec, w.sentence_id
       FROM words w
       JOIN sentences s ON s.id = w.sentence_id
       WHERE w.project_id = ? AND s.removed = 0
       ORDER BY w.start_sec`,
    )
    .all(projectId) as CaptionWord[];

  // Mốc các quãng bị bỏ: cụm không được vắt qua chỗ cắt, vì hai đầu cụm sẽ rơi
  // vào hai bên của mối nối và chữ đứng lì suốt cả quãng bị bỏ.
  // Truyền mốc cuối là từ cuối cùng: `skippedSpans` sẽ coi phần dư sau đoạn cuối
  // là một quãng bỏ, mà ở đây không có gì sau từ cuối để bỏ.
  const lastEnd = words.length > 0 ? words[words.length - 1].end_sec : 0;
  const cuts = skippedSpans(projectId, lastEnd).flatMap((span) => [
    span.start,
    span.end,
  ]);

  // CHỖ NGẮT theo NGỮ NGHĨA, chia THEO TỪNG CÂU. `breaks === null` chỉ khi không có
  // khoá mô hình → rơi heuristic width; câu gọi-hỏng chỉ thiếu break câu đó, `fitGroup`
  // lo. `llmOk` = break đáng tin của mô hình → nơi gọi ghi cờ `captions_llm_ok`.
  const { breaks, llmOk } = await computeCaptionBreaks(projectId, words, pack);
  // Tách TỪ tiếng Việt: tiếng nào dính với tiếng sau thành một từ ("phần"→"mềm")
  // thì CẤM ngắt cụm sau nó — dù LLM hay width chọn chỗ đó. Diệt "phần|mềm" tận gốc.
  const noBreak = await noBreakAfterWords(words);
  const groups = groupWordsByBreaks(words, cuts, breaks, pack.grouping, noBreak);

  // Đo rồi mới chốt: trần tiếng và trần ký tự chỉ là ước, còn vừa hay không vừa
  // phải hỏi phép đo bằng đúng tệp font sẽ in — mà cùng một cụm ở dải dưới hẹp
  // hơn dải trên 12% bề rộng, nên vừa ở trên chưa chắc vừa ở dưới.
  const fitted: CaptionGroup[] = [];
  for (const group of groups)
    fitted.push(...(await fitGroup(group, band, pack, noBreak)));

  // CHỐNG VỤN: gộp cụm NGẮN (≤2 tiếng) vào hàng xóm cho tới khi hết. Cụm 2 tiếng
  // chỉ nên dành cho lúc NHẤN — còn lại đọc lên cụt ngủn. Chỉ GỘP (không xẻ) nên
  // không bao giờ vỡ từ ghép.
  return { groups: mergeShort(fitted, pack.grouping.maxWords, cuts), llmOk };
}

/**
 * Gom từ thành cụm theo CHỖ NGẮT cho sẵn — phần THUẦN (không mạng, không đo font),
 * tách ra để guard kiểm được tất định.
 *
 * `llmBreaks` = tập chỉ số tiếng "ngắt-sau" (toàn cục). `null` → không có mô hình,
 * rơi heuristic width (biên cứng + trần số-từ/ký-tự, nhả đuôi dính-sau). Có tập
 * (kể cả rỗng / thiếu vài câu) → chỉ ngắt ở biên cứng + chỗ mô hình chọn; câu không
 * có break thành một cụm dài, để `fitGroup` chẻ theo biên đẹp (biết từ ghép).
 */
export function groupWordsByBreaks(
  words: readonly CaptionWord[],
  cuts: readonly number[],
  llmBreaks: Set<number> | null,
  grouping: { maxWords: number; maxChars: number },
  /** Mã tiếng mà "sau nó CẤM ngắt" (dính tiếng sau thành một từ). */
  noBreak: ReadonlySet<string> = new Set(),
): CaptionGroup[] {
  const { maxWords, maxChars } = grouping;
  const groups: CaptionGroup[] = [];
  let current: CaptionWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    groups.push(build(current));
    current = [];
  };

  // Cắt "mềm" (do số-từ/ký-tự — biên bị ÉP, chỉ dùng khi KHÔNG có mô hình).
  // Ưu tiên: (1) lùi về DẤU PHẨY gần nhất; (2) nhả đuôi "dính sau" về cụm kế. Cả
  // hai đều giữ ít nhất một tiếng ở cụm trước.
  const flushSoft = () => {
    if (current.length === 0) return;
    let cut = -1;
    for (let j = current.length - 1; j >= 1; j -= 1) {
      if (endsClause(current[j].text)) {
        cut = j + 1; // gồm cả tiếng mang dấu phẩy
        break;
      }
    }
    if (cut === -1) {
      cut = current.length;
      // Nhả đuôi "dính sau" VÀ không xẻ giữa một từ (tiếng cấm-ngắt-sau).
      while (
        cut > 1 &&
        (isAttachForward(current[cut - 1].text) || noBreak.has(current[cut - 1].id))
      )
        cut -= 1;
    }
    groups.push(build(current.slice(0, cut)));
    current = current.slice(cut);
  };

  /** Số ký tự của cụm nếu thêm từ này vào, tính cả dấu cách nối. */
  const charsWith = (word: { text: string }) =>
    current.reduce((sum, w) => sum + w.text.length + 1, 0) + word.text.length;

  for (let idx = 0; idx < words.length; idx += 1) {
    const word = words[idx];
    if (current.length > 0) {
      const previous = current[current.length - 1];
      const gap = word.start_sec - previous.end_sec;
      // Không bao giờ gộp hai câu vào một cụm. Câu sau viết hoa nên cụm ra thành
      // "còn quá non Mỗi năm" — đọc lên là hai mẩu ý dính nhau, vô nghĩa.
      const newSentence = word.sentence_id !== previous.sentence_id;
      const crossesCut = cuts.some(
        (at) => previous.end_sec <= at + 0.01 && word.start_sec >= at - 0.01,
      );
      // Mô hình bảo ngắt SAU tiếng trước (index idx-1)?
      const llmBreakHere = llmBreaks?.has(idx - 1) ?? false;
      // Tiếng trước DÍNH với tiếng này thành một từ → CẤM ngắt ở đây (dù mô hình
      // hay width chọn). Biên cứng (nghỉ hơi/hết câu/chỗ cắt) vẫn tôn trọng: chúng
      // là ranh THẬT, gần như không rơi vào giữa một từ.
      const glued = noBreak.has(previous.id);

      // Thứ tự: (1) BIÊN CỨNG (nghỉ hơi / hết câu / qua chỗ cắt). (2) MÔ HÌNH ngắt
      // theo NGHĨA (giữ từ ghép, cỡ cụm). (3) TRẦN BỀ-RỘNG làm LƯỚI AN TOÀN — LUÔN
      // áp, kể cả khi có break mô hình: câu nào mô hình BỎ SÓT / GỌI HỎNG (không có
      // break) mà cứ trôi thì trần này chặn ở biên đẹp. Cả (2) và (3) đều KHÔNG được
      // xẻ giữa một từ (`glued`) — chờ hết từ rồi ngắt.
      if (gap > BREATH_GAP || newSentence || crossesCut) flush();
      else if (llmBreakHere && !glued) flush();
      else if (!glued && (current.length >= maxWords || charsWith(word) > maxChars)) {
        flushSoft();
      }
    }
    current.push(word);
  }
  flush();
  return groups;
}

/**
 * Gộp cụm NGẮN (≤2 tiếng) vào hàng xóm — chống video cụt ngủn.
 *
 * Chỉ gộp khi CÙNG CÂU, không qua dấu chấm câu / chỗ cắt, và tổng ≤ `maxWords + 1`
 * (chừa dư một tiếng cho từ ghép). Ưu tiên gộp vào hàng xóm NGẮN HƠN để cân cỡ.
 * Lặp tới khi ổn định. Thuần GỘP, không cắt → không vỡ từ ghép. Cụm ngắn không
 * gộp được (hàng xóm khác câu / đã đầy) thì để yên — đó là ca nhấn thật sự.
 */
export function mergeShort(
  groups: CaptionGroup[],
  maxWords: number,
  cuts: readonly number[],
): CaptionGroup[] {
  const list = groups.map((group) => group.words);
  const ceiling = maxWords + 1;
  const linkOk = (a: CaptionWord, b: CaptionWord) =>
    a.sentence_id === b.sentence_id &&
    !/[.!?]$/.test(a.text.trim()) &&
    !cuts.some((at) => a.end_sec <= at + 0.01 && b.start_sec >= at - 0.01);

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].length > 2) continue;
      const cur = list[i];
      const prev = list[i - 1];
      const next = list[i + 1];
      const prevOk =
        !!prev &&
        linkOk(prev[prev.length - 1], cur[0]) &&
        prev.length + cur.length <= ceiling;
      const nextOk =
        !!next &&
        linkOk(cur[cur.length - 1], next[0]) &&
        cur.length + next.length <= ceiling;
      // Gộp vào hàng xóm NGẮN hơn (cân cỡ); hoà thì ưu tiên trước.
      if (prevOk && (!nextOk || prev.length <= next.length)) {
        list[i - 1] = [...prev, ...cur];
        list.splice(i, 1);
        changed = true;
        break;
      }
      if (nextOk) {
        list[i + 1] = [...cur, ...next];
        list.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return list.map(build);
}


/**
 * Tách đôi cho tới khi mỗi cụm nằm gọn trong trần dòng.
 *
 * Tách ở ranh giới TỪ, nên hai nửa vẫn neo được vào từ đầu và từ cuối của chính
 * nó — co chữ thì mất phong cách, còn tách cụm chỉ chia lại thời gian của cùng
 * một câu.
 */
async function fitGroup(
  group: CaptionGroup,
  band: Band,
  pack: StylePack,
  noBreak: ReadonlySet<string>,
  depth = 0,
): Promise<CaptionGroup[]> {
  /*
   * Đo bằng CẢ HAI vai chữ, không chỉ vai phụ đề.
   *
   * Chia cụm chạy lúc SINH chữ, còn `ai-keywords.ts` đánh dấu từ khoá SAU đó —
   * nên cụm vừa chốt "vừa một dòng" theo vai `voice` hoàn toàn có thể về sau
   * được vẽ bằng vai `accent`. Vai đó rộng hơn thì chữ tràn khung, và không
   * lệnh nào sai: chỉ là phép đo đã hỏi nhầm font.
   *
   * Vừa cho vai rộng nhất thì vừa cho mọi vai, nên lấy hợp của các cờ. Bộ chưa
   * dùng vai thứ hai chỉ đo một lần, y như trước.
   */
  let needsSplit = false;
  let truncated = false;
  // Đo trong VÙNG HÌNH: bộ đưa video vào khung thì chỗ cho chữ hẹp lại, và cụm
  // chốt "vừa một dòng" theo khung ngoài sẽ tràn khi vẽ vào khung trong.
  const rect = contentRect(pack, OUT_WIDTH, OUT_HEIGHT);
  for (const shown of shownPacks(pack)) {
    const laid = await layoutText(group.text, band, rect.w, rect.h, shown);
    needsSplit ||= laid.needsSplit;
    truncated ||= laid.truncated;
  }
  // Dừng ở độ sâu 3: cụm một tiếng mà vẫn không vừa thì tách nữa cũng vô ích,
  // và `truncated` sẽ báo lên hàng "Cần bạn xem".
  if ((!needsSplit && !truncated) || group.words.length < 2 || depth >= 3) {
    return [group];
  }
  // Chẻ ở BIÊN ĐẸP (dấu phẩy / tránh xẻ số+đơn vị / tránh kết dính-sau) thay vì
  // chính giữa — chẻ giữa hay rơi vào "30 | tuổi".
  const mid = bestSplitPoint(group.words, noBreak);
  return [
    ...(await fitGroup(build(group.words.slice(0, mid)), band, pack, noBreak, depth + 1)),
    ...(await fitGroup(build(group.words.slice(mid)), band, pack, noBreak, depth + 1)),
  ];
}
