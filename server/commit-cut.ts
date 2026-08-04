import { existsSync } from "node:fs";
import { rename } from "node:fs/promises";
import { join } from "node:path";

import { buildAsrPrompt } from "./asr-bias";
import { db, newId } from "./db";
import { extractAudio } from "./media-tools";
import { workDir } from "./paths";
import { keptRanges } from "./pipeline";
import { cutRanges } from "./render";
import { transcribeAudio } from "./transcribe";

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
 * ══ VÌ SAO PHẢI CHÉP LẠI, KHÔNG DỜI MỐC ══
 *
 * Dời mốc từ sang trục mới thì rẻ hơn, nhưng nó giữ nguyên NHỮNG CHỮ CŨ. Phép
 * cắt bỏ khoảng lặng và đoạn bật/tắt máy quay, nên hai mép ghép lại thành một
 * đoạn tiếng chưa ai từng nghe — mà bản chép vẫn tả đoạn tiếng cũ. Chép lại thì
 * bản chép luôn là thứ tai nghe được, và đó là điều kiện để bước sau tin nó.
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
  const staged = await cutRanges(projectId, base, kept, [], "base-chot.mp4");
  await rename(staged, base);

  // Tiếng phải rút lại từ tệp MỚI, không dùng `audio.wav` cũ — nó còn theo trục
  // cũ, và đó chính là loại lệch cả hàm này sinh ra để dẹp.
  const audio = join(work, "audio.wav");
  await extractAudio(base, audio);
  const segments = await transcribeAudio(audio, "vi", buildAsrPrompt(projectId));

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

function countWords(projectId: string): number {
  return (
    db.prepare("SELECT COUNT(*) AS n FROM words WHERE project_id=?").get(projectId) as {
      n: number;
    }
  ).n;
}
