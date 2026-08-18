import { db } from "./db";
import { listSegments, removeRange } from "./segments";

/**
 * Bỏ CÂU BỎ DỞ RỒI NÓI LẠI — pass TẤT ĐỊNH, chạy sau `ai-cuts`.
 *
 * Mô hình cắt được khúc rác rõ ("ờ, duyệt những cái--") nhưng HAY để sót lần nói
 * ĐẦU khi nó trông như câu hoàn chỉnh ("Và mình đã quay video," rồi "và mình quay
 * video này để test..."). Đọc ra lắp. Prompt không sửa nổi vì mô hình không tất
 * định ở chỗ này.
 *
 * Cách bắt CHẮC: một "lần nói" (chuỗi từ liền mạch, NGĂN hai đầu bằng chỗ đã
 * cắt/khoảng nghỉ) mà NGAY SAU nó nói LẠI gần như y hệt phần đầu — tức lần đầu là
 * bản nháp bị bỏ. Đo bằng ĐỘ TRÙNG chuỗi con (LCS) giữa lần đầu và đầu lần sau.
 *
 * ══ VÌ SAO AN TOÀN (không cắt nhầm cấu trúc song song) ══
 *
 * "Các bạn có thể DUYỆT lời / Các bạn có thể CHỌN style" trùng phần đầu "Các bạn
 * có thể" rồi RẼ khác — LCS thấp (chỉ 4/8), không nổ. Nhấn mạnh lặp liền ("Rất
 * quan trọng, rất quan trọng đấy") nói LIỀN không nghỉ nên nằm CÙNG một lần nói,
 * không thành hai để so. Chỉ nổ khi: (1) hai lần nói TÁCH nhau bằng cut/nghỉ,
 * (2) lần đầu NGẮN, (3) LCS cao (bản sau lặp gần trọn phần đầu bản trước).
 */

type Word = { text: string; start_sec: number; end_sec: number };

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const isInterrupted = (w: Word) => /--\s*$/.test(w.text); // ASR đánh dấu bị ngắt

/** Lần nói đầu dài hơn (giây / số tiếng) thì gần như chắc không phải bản nháp. */
const MAX_ATTEMPT_SECONDS = 3;
const MAX_ATTEMPT_WORDS = 9;
/** Khoảng nghỉ trong MỘT lần nói; rộng hơn coi như tách lần nói. */
const MAX_GAP_SECONDS = 0.8;
/** Bản sau phải lặp lại ngần này phần đầu bản trước mới coi là "nói lại". */
const REPEAT_RATIO = 0.75;
/** Có dấu "--" (chắc chắn bị ngắt) thì hạ ngưỡng lặp. */
const REPEAT_RATIO_INTERRUPTED = 0.5;

/** Độ dài chuỗi con chung dài nhất giữa hai mảng tiếng (đã chuẩn hoá). */
function lcs(a: string[], b: string[]): number {
  const dp = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i += 1)
    for (let j = 1; j <= b.length; j += 1)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[a.length][b.length];
}

export function trimFalseStarts(projectId: string): { trimmed: number } {
  const words = db
    .prepare(
      "SELECT text, start_sec, end_sec FROM words WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Word[];
  const removed = listSegments(projectId)
    .filter((s) => s.removed)
    .map((s) => ({ start: s.start_sec, end: s.end_sec }));
  const inRemoved = (t: number) => removed.some((r) => r.start <= t && t < r.end);
  /** Có chỗ đã cắt trong khe giữa hai từ, hoặc khoảng nghỉ rộng → tách lần nói. */
  const breakBetween = (endPrev: number, startNext: number) =>
    startNext - endPrev > MAX_GAP_SECONDS ||
    removed.some((r) => r.start < startNext && r.end > endPrev);

  // Gom từ GIỮ thành các "lần nói" (run) liền mạch.
  const runs: Word[][] = [];
  for (const w of words) {
    if (inRemoved(w.start_sec)) continue;
    const run = runs[runs.length - 1];
    const prev = run?.[run.length - 1];
    if (run && prev && !breakBetween(prev.end_sec, w.start_sec)) run.push(w);
    else runs.push([w]);
  }

  const cuts: Array<{ start: number; end: number }> = [];
  for (let i = 0; i + 1 < runs.length; i += 1) {
    const a = runs[i];
    const b = runs[i + 1];
    const dur = a[a.length - 1].end_sec - a[0].start_sec;
    if (a.length > MAX_ATTEMPT_WORDS || dur > MAX_ATTEMPT_SECONDS) continue;

    // Bản sau lặp lại phần đầu bản trước tới đâu (so đầu-B đúng độ dài A + đệm).
    const aWords = a.map((w) => norm(w.text)).filter(Boolean);
    const bHead = b
      .slice(0, a.length + 3)
      .map((w) => norm(w.text))
      .filter(Boolean);
    if (aWords.length === 0) continue;
    const ratio = lcs(aWords, bHead) / aWords.length;
    const need = a.some(isInterrupted)
      ? REPEAT_RATIO_INTERRUPTED
      : REPEAT_RATIO;
    if (ratio >= need) {
      cuts.push({ start: a[0].start_sec, end: a[a.length - 1].end_sec });
    }
  }

  // Đếm theo THỜI LƯỢNG bỏ, KHÔNG theo số đoạn: cắt này hay gộp với đoạn lặng kề
  // (`coalesceRemoved`) làm số đoạn không đổi dù đã bỏ thêm — đếm đoạn thì báo hụt.
  const removedSec = () =>
    (
      db
        .prepare(
          "SELECT COALESCE(SUM(end_sec-start_sec),0) AS s FROM segments WHERE project_id=? AND removed=1",
        )
        .get(projectId) as { s: number }
    ).s;

  // Bỏ từ CUỐI lên ĐẦU: `removeRange` tách đoạn, làm xuôi thì mốc sau trôi.
  cuts.sort((x, y) => y.start - x.start);
  let trimmed = 0;
  for (const c of cuts) {
    const was = removedSec();
    removeRange(projectId, c.start, c.end);
    if (removedSec() > was + 0.01) trimmed += 1;
  }
  return { trimmed };
}
