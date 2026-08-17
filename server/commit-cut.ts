import { existsSync } from "node:fs";
import { rename } from "node:fs/promises";
import { join } from "node:path";

import { buildEnvelope } from "./audio-envelope";
import { db, newId } from "./db";
import { makeFilmstrip, probe } from "./media-tools";
import { thumbDir, workDir } from "./paths";
import { keptRanges } from "./pipeline";
import { buildPreview, cutRanges } from "./render";
import { type AsrSegment } from "./transcribe";

/**
 * CHỐT LÁT CẮT — nướng phần đã bỏ vào tệp, rồi chép lời lại trên tệp mới.
 *
 * ══ VÌ SAO ══
 *
 * Hiện hệ này mang HAI TRỤC THỜI GIAN cùng lúc: trục của bản gốc và trục của
 * bản đã cắt. Đếm được **29 chỗ** phải quy đổi qua lại (`mapToOutput`,
 * `keptBefore`, `keptRanges`, `cutRanges`) — riêng `pipeline.ts` hai mươi chỗ.
 *
 * Và cả ba lỗi lệch nặng nhất đều từ đúng chỗ ấy. Chú thích còn nguyên trong mã:
 * mặt nạ người dựng trên bản chưa cắt trong khi bản xuất đã bỏ hai mươi sáu
 * giây, nên cái viền bám dáng người rơi vào sai chỗ; nhạc phải lùi đúng phần đã
 * bỏ; mốc nắn màn phải quy sang trục đã cắt trước khi dùng.
 *
 * Chốt xong thì **chỉ còn một trục**. Không còn gì để quy đổi, nên không còn
 * chỗ nào để lệch.
 *
 * ══ DỜI MỐC, KHÔNG CHÉP LẠI ══
 *
 * Bản trước chép lại toàn bộ bằng whisper (~1 phút) vì sợ "dời mốc thì bản chép
 * tả đoạn tiếng cũ". Nhưng cắt chỉ bỏ khoảng THỜI GIAN (im lặng, tiếng động, đoạn
 * thừa) — CHỮ đã nói ở hai bên KHÔNG đổi. Mà chặng cắt (VAD) đánh mép trong khoảng
 * KHÔNG-GIỌNG nên không chặt trúng giữa từ. Vậy chỉ cần dời mốc từ còn lại sang
 * trục mới và bỏ từ nằm trong vùng đã cắt — đúng, tức thì, giữ nguyên bản chép
 * tốt (đã qua refill VAD + lọc babble), không đẻ lỗi mới từ một lượt whisper nữa.
 *
 * ══ THỨ TỰ, VÀ VÌ SAO KHÔNG ĐƯỢC ĐẢO ══
 *
 *   chép lần 1 → soát CẮT → chốt (hàm này) → chép lần 2 → soát CHÍNH TẢ → khoá
 *
 * Sửa chính tả TRƯỚC khi chốt là ném đi công sửa: lần chép thứ hai ghi đè sạch.
 * Người dùng sửa "TensorLab" rồi thấy máy trả về "Tenso Lab" lần nữa là lần
 * cuối họ tin cái gì trên màn hình này.
 *
 * Nên bản chép lần MỘT là bản nháp — việc duy nhất của nó là cho người ta quyết
 * cắt ở đâu, và nó chết ngay sau đó.
 */

export type CommitResult = {
  /** Bỏ đi bao nhiêu giây. `0` là không có gì để chốt. */
  removedSeconds: number;
  wordsBefore: number;
  wordsAfter: number;
  /** Không cắt gì thì bỏ qua hẳn, không chép lại cho tốn. */
  skipped: boolean;
};

export async function commitCut(
  projectId: string,
  /** Độ dài bản gốc, giây — `keptRanges` cần để biết mép cuối. */
  totalDuration: number,
): Promise<CommitResult> {
  const before = countWords(projectId);
  const kept = keptRanges(projectId, totalDuration);
  const keptSeconds = kept.reduce((sum, r) => sum + (r.end - r.start), 0);
  const removedSeconds = Math.max(0, totalDuration - keptSeconds);

  // Dưới nửa giây thì coi như không cắt: chép lại tốn hơn phần lợi thu được, mà
  // một phép cắt nửa giây không dời mốc đủ để ai nhận ra.
  if (removedSeconds < 0.5 || kept.length === 0) {
    return { removedSeconds, wordsBefore: before, wordsAfter: before, skipped: true };
  }

  const work = workDir(projectId);
  const base = join(work, "base.mp4");
  if (!existsSync(base)) {
    throw new Error("chưa có base.mp4 — chốt lát cắt phải chạy sau chặng dựng nền");
  }

  /*
   * Dựng ra tên TẠM rồi mới đổi tên đè lên `base.mp4`.
   *
   * Cùng lý lẽ với chặng dựng bản cuối: ffmpeg hỏng giữa chừng mà đã ghi thẳng
   * vào `base.mp4` thì dự án mất bản nền, và không có đường nào biết nó mất.
   * Đổi tên là thao tác nguyên tử trên cùng ổ đĩa.
   *
   * `base.mp4` dựng lại được từ tệp người dùng tải lên, nên đè lên nó là an
   * toàn — bản gốc không nằm ở đây.
   */
  const staged = await cutRanges(projectId, base, kept, "base-chot.mp4");
  await rename(staged, base);

  // Dựng lại MỌI tệp DẪN XUẤT trên trục MỚI — hệt chặng chuẩn bị. `base.mp4` giờ
  // là một tệp khác (đã cắt, ngắn hơn), nên bản xem trước, dải ảnh và đường bao
  // cũ còn theo trục cũ (118s) sẽ trật hẳn với timeline mới (52s): sóng lệch
  // lời, dải ảnh lệch khung, khung xem phát nhầm bản chưa cắt. `buildPreview` cho
  // ra bản xem trước nhẹ VÀ `audio.wav` mới trong cùng một lượt giải mã.
  const { preview, audio } = await buildPreview(projectId, [base]);
  // DỜI MỐC bản chép cũ sang trục đã cắt — KHÔNG chép lại bằng whisper. Cắt chỉ
  // bỏ khoảng THỜI GIAN (im lặng, tiếng động, đoạn thừa), KHÔNG đổi CHỮ đã nói ở
  // hai bên; mà cắt VAD lại đánh mép trong khoảng không-giọng nên chẳng chặt trúng
  // giữa từ. Nên dời mốc là đủ và ĐÚNG, lại tức thì — bỏ được ~1 phút whisper mỗi
  // lần chốt. (Đọc bản chép cũ TRƯỚC khi `rewrite` xoá nó bên dưới.)
  const segments = remapTranscript(projectId, kept);

  const previewInfo = await probe(preview);
  // Video vừa NGẮN lại — ghi độ dài mới để nối-đoạn-đuôi và gieo-lại-đoạn không
  // còn kéo dải về trục gốc (tổng các tệp cảnh) nữa.
  db.prepare("UPDATE projects SET video_seconds=? WHERE id=?").run(
    previewInfo.duration,
    projectId,
  );
  const strip = await makeFilmstrip(
    preview,
    join(thumbDir(projectId), "strip.jpg"),
    previewInfo.duration,
  ).catch(() => null);
  if (strip) {
    db.prepare(
      "UPDATE projects SET strip_second_width=?, strip_seconds=?, strip_native_second_width=? WHERE id=?",
    ).run(strip.secondWidth, strip.totalSeconds, strip.nativeSecondWidth, projectId);
  }
  await buildEnvelope(projectId, audio).catch(() => null);

  const rewrite = db.transaction(() => {
    /*
     * Xoá PHẦN TỬ trước, không phải sau.
     *
     * Chữ neo bằng `from_word_id`/`to_word_id`, mà mọi từ sắp bị thay. Để lại
     * là để lại những mối neo trỏ vào hư không — và ràng buộc khoá ngoại sẽ
     * chặn ngay ở chỗ xoá từ, với một thông báo chẳng nói gì về nguyên nhân.
     *
     * Chốt lát cắt xảy ra TRƯỚC khi dựng chữ, nên ở luồng đúng thì bảng này
     * đang rỗng. Câu lệnh này là để luồng SAI không hỏng im lặng.
     */
    db.prepare("DELETE FROM elements WHERE project_id=?").run(projectId);
    db.prepare("DELETE FROM words WHERE project_id=?").run(projectId);
    db.prepare("DELETE FROM sentences WHERE project_id=?").run(projectId);
    // Lát cắt đã nằm trong tệp: giữ lại là cắt hai lần cùng một chỗ.
    db.prepare("DELETE FROM manual_cuts WHERE project_id=?").run(projectId);
    // Xoá phần tử là mất luôn phụ đề đã dựng. HẠ cờ đã-gieo để chặng captions
    // dựng lại — không thì luồng SAI (chữ dựng trước khi cắt) ra bàn dựng KHÔNG
    // CÓ PHỤ ĐỀ mà chẳng báo gì. Luồng ĐÚNG cắt trước khi dựng chữ nên cờ vốn
    // đang 0, câu này là no-op; nó chỉ cứu luồng sai và lần chốt-cắt lại.
    db.prepare(
      "UPDATE projects SET captions_seeded=0, subtitles=0 WHERE id=?",
    ).run(projectId);

    const insertSentence = db.prepare(
      "INSERT INTO sentences (id, project_id, position, text, start_sec, end_sec, removed) VALUES (?,?,?,?,?,?,0)",
    );
    const insertWord = db.prepare(
      "INSERT INTO words (id, project_id, sentence_id, position, text, start_sec, end_sec, confidence) VALUES (?,?,?,?,?,?,?,?)",
    );
    segments.forEach((segment, index) => {
      const sentenceId = newId("s");
      insertSentence.run(sentenceId, projectId, index, segment.text, segment.start, segment.end);
      segment.words.forEach((word, at) => {
        insertWord.run(
          newId("w"), projectId, sentenceId, at, word.text, word.start, word.end, word.confidence,
        );
      });
    });
  });
  rewrite();

  return {
    removedSeconds,
    wordsBefore: before,
    wordsAfter: countWords(projectId),
    skipped: false,
  };
}

/**
 * Dời bản chép hiện có sang trục ĐÃ CẮT — thay cho chép lại bằng whisper.
 *
 * `toOutput` gộp các khoảng GIỮ lại liền nhau: mốc gốc `t` rơi vào khoảng giữ thứ
 * i thì mốc mới = tổng độ dài các khoảng trước đó + phần trong khoảng i. Từ nào
 * NẰM TRONG vùng đã bỏ thì bỏ luôn (giữa nó không có tiếng để mà giữ).
 *
 * Câu giữ NGUYÊN chữ gốc khi không rụng từ nào (giữ dấu câu whisper đặt); rụng từ
 * thì ghép lại từ các từ còn — vì phần bỏ đã không còn tiếng.
 */
function remapTranscript(
  projectId: string,
  kept: Array<{ start: number; end: number }>,
): AsrSegment[] {
  const toOutput = (t: number) => {
    let acc = 0;
    for (const range of kept) {
      if (t < range.start) return acc;
      if (t <= range.end) return acc + (t - range.start);
      acc += range.end - range.start;
    }
    return acc;
  };
  const inKept = (t: number) =>
    kept.some((range) => t >= range.start && t <= range.end);

  const sentences = db
    .prepare(
      "SELECT id, text FROM sentences WHERE project_id=? ORDER BY start_sec, position",
    )
    .all(projectId) as Array<{ id: string; text: string }>;

  const out: AsrSegment[] = [];
  for (const sentence of sentences) {
    const words = db
      .prepare(
        "SELECT text, start_sec, end_sec, confidence FROM words WHERE sentence_id=? ORDER BY position",
      )
      .all(sentence.id) as Array<{
      text: string;
      start_sec: number;
      end_sec: number;
      confidence: number | null;
    }>;
    // Giữ từ nào có TÂM nằm trong vùng giữ (mép rơi vào chỗ cắt vẫn tính là giữ).
    const kw = words
      .filter((w) => inKept((w.start_sec + w.end_sec) / 2))
      .map((w) => ({
        text: w.text,
        start: toOutput(w.start_sec),
        end: toOutput(w.end_sec),
        confidence: w.confidence ?? 1,
      }));
    if (kw.length === 0) continue;
    out.push({
      text:
        kw.length === words.length
          ? sentence.text
          : kw.map((w) => w.text).join(" "),
      start: kw[0].start,
      end: kw[kw.length - 1].end,
      words: kw,
    });
  }
  return out;
}

function countWords(projectId: string): number {
  return (
    db.prepare("SELECT COUNT(*) AS n FROM words WHERE project_id=?").get(projectId) as {
      n: number;
    }
  ).n;
}
