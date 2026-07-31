import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { db } from "./db";
import { workDir } from "./paths";
import { listSegments } from "./segments";

/**
 * Chấm điểm một bản dựng bằng SỐ, không bằng cảm giác.
 *
 * Trước đây "tốt hơn chưa" chỉ trả lời được bằng cách nhìn khung hình — mà nhìn
 * thì không so được hai lần chạy, và cũng không phát hiện được lúc sửa cho video
 * này lại làm hỏng video kia. Đã dính đúng một lần: nới tay chặng cắt cho bắt
 * được câu nói với người quay phim, và mất luôn câu kêu gọi theo dõi.
 *
 * Mọi số ở đây đo được từ CSDL và đường bao âm thanh, không cần xem video.
 */

export type QualityReport = {
  projectId: string;
  /** Độ dài bản dựng và phần bị bỏ đi */
  outputSeconds: number;
  sourceSeconds: number;
  /** Lặng còn sót trên bản dựng — càng thấp càng đặc */
  silenceLeftSeconds: number;
  /** Nhịp nghỉ còn lại: hết sạch thì nghe dồn không kịp thở */
  breathSeconds: number;
  /**
   * Lời bị bỏ, đo bằng sóng âm.
   *
   * KHÔNG phải cứ khác 0 là hỏng: chặng `cuts` cố ý bỏ những câu có tiếng
   * (nói với người quay phim, lặp ý). Con số này chỉ có nghĩa khi so với
   * `wordsTotal - wordsKept` — lệch nhiều nghĩa là có chỗ bị xén mà không
   * qua chặng cắt nào, tức là cắt lặng đã ăn vào tiếng thật.
   */
  speechRemovedSeconds: number;
  /** Phần lời còn giữ, tính theo số từ */
  wordsKept: number;
  wordsTotal: number;
  /** Chữ trên màn phủ bao nhiêu phần thời lượng */
  captionCoverage: number;
  effects: number;
  inserts: number;
  musicTracks: number;
  keywordShare: number;
  /** Câu cuối có còn không — lời chào/kêu gọi hay bị cắt oan nhất */
  lastSentenceKept: boolean;
};

type Envelope = { hop: number; values: number[]; speechLevel: number };

function readEnvelope(projectId: string): Envelope | null {
  const path = join(workDir(projectId), "envelope.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Envelope;
  } catch {
    return null;
  }
}

export function qualityReport(projectId: string): QualityReport {
  const segments = listSegments(projectId);
  const kept = segments.filter((segment) => !segment.removed);
  const outputSeconds = kept.reduce(
    (total, segment) => total + (segment.end_sec - segment.start_sec),
    0,
  );
  const sourceSeconds = (
    db
      .prepare(
        "SELECT COALESCE(SUM(duration),0) AS total FROM media_files WHERE project_id=? AND role='main'",
      )
      .get(projectId) as { total: number }
  ).total;

  const words = db
    .prepare(
      "SELECT text, start_sec, end_sec FROM words WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Array<{ text: string; start_sec: number; end_sec: number }>;

  /** Mốc nguồn này còn nằm trong bản dựng không. */
  const alive = (at: number) =>
    kept.some((segment) => segment.start_sec <= at && at < segment.end_sec);

  const envelope = readEnvelope(projectId);
  let silenceLeft = 0;
  let speechRemoved = 0;
  if (envelope) {
    const { hop, values, speechLevel } = envelope;
    for (let index = 0; index < values.length; index += 1) {
      const at = index * hop;
      const loud = values[index] > speechLevel;
      if (alive(at) && !loud) silenceLeft += hop;
      if (!alive(at) && loud) speechRemoved += hop;
    }
  }

  // Nhịp nghỉ trên trục XUẤT: khe giữa hai từ liền nhau sau khi đã bỏ bớt.
  const toOutput = (at: number) => {
    let total = 0;
    for (const segment of kept) {
      if (at >= segment.end_sec) total += segment.end_sec - segment.start_sec;
      else if (at >= segment.start_sec) return total + (at - segment.start_sec);
      else return null;
    }
    return total;
  };
  let breath = 0;
  for (let index = 0; index < words.length - 1; index += 1) {
    const from = toOutput(words[index].end_sec);
    const to = toOutput(words[index + 1].start_sec);
    if (from === null || to === null) continue;
    const gap = to - from;
    if (gap > 0.15) breath += gap;
  }

  const captions = db
    .prepare(
      `SELECT wf.start_sec AS a, wt.end_sec AS b FROM elements e
       JOIN words wf ON wf.id = e.from_word_id
       JOIN words wt ON wt.id = e.to_word_id
       WHERE e.project_id=? AND e.kind='text'`,
    )
    .all(projectId) as Array<{ a: number; b: number }>;
  const covered = captions
    .filter((span) => alive((span.a + span.b) / 2))
    .reduce((total, span) => total + (span.b - span.a), 0);

  const count = (sql: string) =>
    (db.prepare(sql).get(projectId) as { n: number }).n;

  const lastSentence = db
    .prepare(
      "SELECT start_sec, end_sec FROM sentences WHERE project_id=? ORDER BY position DESC LIMIT 1",
    )
    .get(projectId) as { start_sec: number; end_sec: number } | undefined;

  return {
    projectId,
    outputSeconds: Number(outputSeconds.toFixed(1)),
    sourceSeconds: Number(sourceSeconds.toFixed(1)),
    silenceLeftSeconds: Number(silenceLeft.toFixed(1)),
    breathSeconds: Number(breath.toFixed(1)),
    speechRemovedSeconds: Number(speechRemoved.toFixed(1)),
    wordsKept: words.filter((word) => alive(word.start_sec)).length,
    wordsTotal: words.length,
    captionCoverage: outputSeconds
      ? Number((covered / outputSeconds).toFixed(2))
      : 0,
    effects: count("SELECT COUNT(*) AS n FROM effects WHERE project_id=?"),
    inserts: count(
      "SELECT COUNT(*) AS n FROM elements WHERE project_id=? AND kind='insert'",
    ),
    musicTracks: count(
      "SELECT COUNT(*) AS n FROM music_tracks WHERE project_id=?",
    ),
    keywordShare: (() => {
      const total = count(
        "SELECT COUNT(*) AS n FROM elements WHERE project_id=? AND kind='text'",
      );
      const marked = count(
        "SELECT COUNT(*) AS n FROM elements WHERE project_id=? AND kind='text' AND keywords IS NOT NULL AND keywords<>''",
      );
      return total ? Number((marked / total).toFixed(2)) : 0;
    })(),
    lastSentenceKept: lastSentence
      ? alive((lastSentence.start_sec + lastSentence.end_sec) / 2)
      : false,
  };
}
