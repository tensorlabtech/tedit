import { join } from "node:path";

import { buildEnvelope, readEnvelope } from "./audio-envelope";
import { commitCut } from "./commit-cut";
import { db, newId } from "./db";
import { filterHallucinations } from "./hallucination-filter";
import { makeFilmstrip, probe } from "./media-tools";
import { outDir, thumbDir, workDir } from "./paths";
import { renderViaRemotion } from "./remotion-render";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";

import { listMusic } from "./music-tracks";
import {buildMaster, buildPreview, burnElements, type CrossAt, cutRanges, keptBefore, mixMusic, mapToOutput, type KeptRange, normalizeReveal, OUT_HEIGHT, OUT_WIDTH, type RenderElement} from "./render";
import {CROSS_SECONDS, findJunction, junctionHalves, normalizeJunction, type JunctionId} from "./junction-kinds";
import { keptFromSegments, listSegments } from "./segments";
import { seedSegmentsByCaption } from "./segment-seed";
import { buildAsrPrompt } from "./asr-bias";
import { pickCaptionBand } from "./caption-band";
import { buildSubjectMask, emptiestBand, hasSubject, subjectPath } from "./subject-mask";
import { fillFullFrame, scheduleScenes } from "./layout-schedule";
import { buildPlacedSegments } from "./layout-segments";
import { PICKABLE_LAYOUTS } from "./layout-kinds";
import { proposeCuts } from "./ai-cuts";
import { fixTranscript } from "./ai-fix-transcript";
import { trimSilence, trimWordlessIslands } from "./auto-trim-silence";
import { detectSpeech, readSpeech } from "./vad";
import { describeInserts } from "./ai-broll-describe";
import { placeInserts } from "./ai-broll-place";
import { placePersonLayouts } from "./place-person-layouts";
import { pickEffects } from "./ai-effects";
import { pickKeywords } from "./ai-keywords";
import { pickMusic } from "./ai-music";
import { createCaptionElements } from "./caption-elements";
import { placeBlurFrames } from "./blur-frames";
import { hasModel } from "./llm";
import { readStylePack } from "./style-pack-store";
import { stampBlocksFromPack } from "./stamp-blocks";
import { behindPhrase, HEADLINE_FADE } from "./style-pack";
import type { CaptionBlock } from "./style-pack";
import { fromLegacyLayout, type Band } from "./text-layout";
import { failStrandedSteps, resetSteps, setStep } from "./pipeline-steps";
import { transcribeAudio } from "./transcribe";
import { refillTranscriptionGaps } from "./refill-transcription-gaps";

type Row = Record<string, unknown>;

/** Giây thành "1:13" — kết quả chặng đọc ra phải là thứ người ta đọc được. */
function formatClock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function setJob(
  projectId: string,
  kind: string,
  status: string,
  progress: number,
  message?: string,
  resultPath?: string,
) {
  const existing = db
    .prepare("SELECT id FROM jobs WHERE project_id = ? AND kind = ?")
    .get(projectId, kind) as { id: string } | undefined;
  const now = Date.now();
  if (existing) {
    db.prepare(
      "UPDATE jobs SET status=?, progress=?, message=?, result_path=COALESCE(?,result_path), updated_at=? WHERE id=?",
    ).run(
      status,
      progress,
      message ?? null,
      resultPath ?? null,
      now,
      existing.id,
    );
    return existing.id;
  }
  const id = newId("job");
  db.prepare(
    "INSERT INTO jobs (id, project_id, kind, status, progress, message, result_path, updated_at) VALUES (?,?,?,?,?,?,?,?)",
  ).run(
    id,
    projectId,
    kind,
    status,
    progress,
    message ?? null,
    resultPath ?? null,
    now,
  );
  return id;
}

/**
 * Dựng bản CHẤT LƯỢNG cho một dự án — việc nền, xếp sau lượt chép lời.
 *
 * Có sẵn rồi thì thôi: `ensureMaster` gọi hàm này lúc xuất video, mà lúc ấy việc
 * nền thường đã xong từ lâu. Dựng lại một tệp 200 MB cho vui là mất sáu phút.
 */
export async function runMaster(projectId: string) {
  const target = join(workDir(projectId), "base.mp4");
  if (existsSync(target)) return target;
  const sources = mainSources(projectId);
  if (sources.length === 0) throw new Error("Chưa có video chính");
  setJob(projectId, "master", "running", 0, "Đang dựng bản chất lượng");
  const made = await buildMaster(projectId, sources);
  setJob(projectId, "master", "done", 100, "Xong");
  return made;
}

/**
 * `base.mp4` PHẢI có trước khi cắt — dựng ngay tại chỗ nếu chưa.
 *
 * Đường nền có thể chưa chạy tới, hoặc đã chạy mà hỏng, hoặc máy chủ khởi động
 * lại giữa chừng. Lượt xuất không được phép gãy vì mấy chuyện đó: nó chỉ cần
 * thêm thời gian, và người bấm Xuất thì vốn đã đi làm việc khác.
 */
export async function ensureMaster(projectId: string) {
  return runMaster(projectId);
}

function mainSources(projectId: string): string[] {
  return (
    db
      .prepare(
        "SELECT stored_path FROM media_files WHERE project_id=? AND role='main' ORDER BY position",
      )
      .all(projectId) as Array<{ stored_path: string }>
  ).map((row) => row.stored_path);
}

/**
 * Chép lời cho toàn bộ video chính.
 *
 * Ghép trước rồi mới nhận dạng một lượt, thay vì nhận dạng từng tệp rồi cộng
 * mốc: cộng mốc thủ công luôn lệch ở mối nối, mà lệch mốc thì mọi phần tử gắn
 * vào từ đều trôi theo.
 */
export async function runTranscribe(projectId: string) {
  const sources = mainSources(projectId);
  if (sources.length === 0) throw new Error("Chưa có video chính");

  // Dựng lại danh sách chặng NGAY từ đầu: chạy lượt thứ hai mà giữ nguyên danh
  // sách cũ thì màn chờ mở ra đã thấy sẵn dấu tích của lượt trước.
  resetSteps(projectId);

  markStepRunning(projectId, "prepare");
  /*
   * Chỉ dựng thứ BÀN DỰNG CẦN: bản xem trước nhẹ và tệp tiếng cho máy nghe.
   *
   * `base.mp4` (1080×1920, chất lượng cho bản xuất) tách hẳn ra một việc chạy
   * nền phía dưới. Trước đây nó nằm ngay đây và `audio.wav` được tách ra TỪ nó,
   * nên máy nghe phải đợi xong cả lượt mã hoá mới được bắt đầu — đo thật trên
   * một dự án 159 giây: 6 phút 26 giây ngồi nhìn "Chuẩn bị video" trước khi có
   * chữ đầu tiên.
   */
  const { preview, audio } = await buildPreview(projectId, sources);

  // Dựng dải ảnh từ chính bản xem trước: cùng mạch, cùng độ dài, mà dải thu về
  // cao 44px nên 540×960 vẫn thừa nét.
  setJob(projectId, "transcribe", "running", 20, "Đang dựng dải ảnh");
  const baseInfo = await probe(preview);
  // Độ dài video hiện tại — đọc từ tệp, để nơi khác khỏi cộng nhầm các tệp cảnh.
  db.prepare("UPDATE projects SET video_seconds=? WHERE id=?").run(
    baseInfo.duration,
    projectId,
  );
  // Ghi lỗi ra thông báo việc thay vì nuốt im: lần trước lệnh ffmpeg vượt giới
  // hạn bề rộng JPEG, `catch` rỗng nuốt mất, dải vẫn dùng tệp cũ suốt hai lượt.
  const strip = await makeFilmstrip(
    preview,
    join(thumbDir(projectId), "strip.jpg"),
    baseInfo.duration,
  ).catch((error: Error) => {
    setJob(
      projectId,
      "transcribe",
      "running",
      20,
      `Dải ảnh lỗi: ${error.message.slice(0, 60)}`,
    );
    return null;
  });
  if (strip) {
    db.prepare(
      "UPDATE projects SET strip_second_width=?, strip_seconds=?, strip_native_second_width=? WHERE id=?",
    ).run(
      strip.secondWidth,
      strip.totalSeconds,
      strip.nativeSecondWidth,
      projectId,
    );
  }

  // Tệp tiếng đã ra cùng lượt với bản xem trước — không phải tách lại từ đâu nữa.
  setJob(projectId, "transcribe", "running", 30, "Đang đo tiếng");
  // Đo đường bao ngay sau khi có tệp tiếng: dải sóng trên bàn dựng, mép các
  // quãng lặng, và phép lọc câu bịa đều đọc từ đây. Hỏng thì thôi — cả ba chỗ
  // đều có đường lùi.
  const envelope = await buildEnvelope(projectId, audio).catch(() => null);
  // NHẬN DIỆN GIỌNG NÓI: tách giọng khỏi im lặng VÀ tiếng động. Chặng cắt lặng
  // đọc từ đây (bỏ được sột soạt), và chỗ có giọng mà máy nghe bỏ sót cũng lấy từ
  // đây để ép chép lại. Hỏng thì thôi — cắt lặng rơi về đường bao biên độ.
  await detectSpeech(projectId, audio).catch(() => null);

  /*
   * TÁCH NGƯỜI KHỎI NỀN — một lần cho cả video, ngay sau khi có bản xem trước.
   *
   * Ở đây chứ không ở lúc xuất: đo được 58 giây cho một video 133 giây, và mặt
   * nạ chỉ phụ thuộc vào nội dung — tính lại mỗi lượt xuất là bắt người dùng chờ
   * ngần ấy mỗi lần họ sửa một chữ.
   *
   * Đọc BẢN XEM TRƯỚC, không đọc bản chất lượng: mô hình chạy ở 256×256 rồi
   * phóng ngược nên mặt nạ vốn đã mềm mép, mà bản xem trước lại nhẹ hơn nhiều
   * lần. Hai bản cùng nội dung nên cùng độ dài và cùng nhịp khung — đó là điều
   * duy nhất phép này cần.
   *
   * Hỏng thì thôi: bộ dáng nào cần mặt nạ sẽ rơi về lối không có, chứ một chặng
   * phụ không được làm hỏng cả lượt dựng.
   */
  const mask = await buildSubjectMask(projectId, preview);

  setStep(projectId, "prepare", "done", {
    result:
      `${formatClock(baseInfo.duration)} · ${sources.length} tệp` +
      (strip ? ` · ${Math.round(strip.totalSeconds)} khung` : "") +
      (mask ? " · đã tách nền" : ""),
  });

  /**
   * Đọc tư liệu chèn TRƯỚC khi nghe.
   *
   * Chặng này chỉ cần chính các tệp tư liệu, không cần bản chép lời — mà từ
   * vựng nó sinh ra lại mồi được cho máy nghe. Đặt nó ở cuối như bản trước là
   * vứt mất một kênh chống nghe nhầm không tốn thêm gì.
   */
  if (hasModel()) {
    markStepRunning(projectId, "describe");
    try {
      const { described, failed } = await describeInserts(projectId);
      setStep(projectId, "describe", "done", {
        // "đọc 0 tệp" đọc ra như một thất bại, mà nó là chuyện thường: chặng này
        // chỉ chạm tệp nào CHƯA có mô tả, nên không có gì mới để đọc là bình thường.
        result:
          (described > 0 ? `đọc ${described} tệp` : "không có gì mới để đọc") +
          (failed > 0 ? ` · lỗi ${failed}` : ""),
      });
    } catch (error) {
      setStep(projectId, "describe", "failed", {
        error: (error as Error).message.slice(0, 120),
      });
    }
  } else {
    setStep(projectId, "describe", "failed", { error: "chưa có khoá mô hình" });
  }

  markStepRunning(projectId, "transcribe");
  // Mồi từ vựng: tên dự án, lời tự khai của người dùng, mô tả tư liệu vừa đọc.
  const heard = await transcribeAudio(audio, "vi", buildAsrPrompt(projectId));
  // Đóng mốc lời dặn đã dùng: sửa nó sau lượt này thì màn nạp tệp còn biết mà
  // mời chép lại. Đo được lời dặn đổi đúng cái gì: cùng một đoạn tiếng,
  // "Tensolab" thành "TensorLab" — nhưng chỉ khi chép lại.
  db.prepare(
    "UPDATE projects SET profile_at_transcribe=COALESCE(profile,'') WHERE id=?",
  ).run(projectId);
  // Đóng mốc MẠCH CẢNH đã chép: thêm hay bớt cảnh sau lượt này thì phần mới không
  // có lời nào, mà màn nạp tệp vẫn mời mở bàn dựng — sang tới nơi mới thấy một quãng
  // video không chữ. Mốc nằm ở máy chủ chứ không ở một `ref` trong màn hình: giữ
  // trong bộ nhớ thì tải lại trang là lời nhắc biến mất đúng lúc nó còn đúng.
  const mainIds = (
    db
      .prepare(
        "SELECT id FROM media_files WHERE project_id=? AND role='main' ORDER BY position",
      )
      .all(projectId) as Array<{ id: string }>
  ).map((row) => row.id);
  db.prepare("UPDATE projects SET main_files_at_transcribe=? WHERE id=?").run(
    mainIds.join(","),
    projectId,
  );
  // Đối chiếu với sóng âm rồi mới ghi: whisper bịa ra câu trên quãng không ai
  // nói, và không có gì trong bản chép lời tự nói ra điều đó — xem
  // `hallucination-filter.ts`.
  const { kept, dropped } = filterHallucinations(heard, envelope);
  // Cứu lời máy nghe BỎ RƠI: whisper vấp một cửa sổ 30s thì ảo giác rồi nhả rỗng,
  // để lại khoảng dài "không có từ" DÙ ÂM VẪN TO. Không có bước này thì cắt-im-lặng
  // xoá nhầm cả mảng thoại (đo được một video suýt mất 21s narration). Chép LẠI
  // từng khoảng còn to mà thiếu từ, đưa khúc ngắn + ngữ cảnh sạch cho whisper.
  const refill = await refillTranscriptionGaps(
    projectId,
    audio,
    kept,
    envelope,
    await readSpeech(projectId),
    buildAsrPrompt(projectId),
  );
  const segments = refill.segments;

  /**
   * Ghi lại MỐC THỜI GIAN của mọi phần tử trước khi xoá bảng từ.
   *
   * Chép lời lại sinh id từ mới, còn phần tử vẫn trỏ id cũ — phép nối ở khâu
   * xuất là INNER JOIN nên chúng bị loại IM LẶNG. Đo thật: 9/10 phần tử thành
   * mồ côi và mọi chữ mất khỏi video mà không báo gì. Người dùng sửa một từ nghe
   * sai là mất cả buổi đặt chữ.
   *
   * Neo lại theo THỜI GIAN vì đó là thứ duy nhất sống sót qua lần chép lại.
   */

  const clearOld = db.transaction(() => {
    db.prepare("DELETE FROM words WHERE project_id=?").run(projectId);
    db.prepare("DELETE FROM sentences WHERE project_id=?").run(projectId);
  });
  clearOld();

  const insertSentence = db.prepare(
    "INSERT INTO sentences (id, project_id, position, text, start_sec, end_sec, removed) VALUES (?,?,?,?,?,?,0)",
  );
  const insertWord = db.prepare(
    "INSERT INTO words (id, project_id, sentence_id, position, text, start_sec, end_sec, confidence) VALUES (?,?,?,?,?,?,?,?)",
  );

  const write = db.transaction(() => {
    segments.forEach((segment, index) => {
      const sentenceId = newId("s");
      insertSentence.run(
        sentenceId,
        projectId,
        index,
        segment.text,
        segment.start,
        segment.end,
      );
      segment.words.forEach((word, wordIndex) => {
        insertWord.run(
          newId("w"),
          projectId,
          sentenceId,
          wordIndex,
          word.text,
          word.start,
          word.end,
          word.confidence,
        );
      });
    });
  });
  write();

  const wordCount = db
    .prepare("SELECT COUNT(*) AS n FROM words WHERE project_id=?")
    .get(projectId) as { n: number };
  setStep(projectId, "transcribe", "done", {
    result:
      `${wordCount.n} từ · ${segments.length} câu` +
      (refill.refilled > 0 ? ` · cứu ${refill.addedWords} từ bị bỏ rơi` : ""),
  });

  /*
   * GIEO ĐOẠN TRƯỚC KHI CẮT — không phải ở chặng `captions` nữa.
   *
   * "Chỗ này không vào video" chỉ diễn đạt được bằng ĐOẠN: `removeRange` chẻ đoạn
   * ở hai mốc rồi đánh dấu khúc giữa. Bảng `segments` rỗng thì `splitAt` không
   * tìm ra đoạn nào để chẻ, phép lọc chạy trên danh sách rỗng, và mọi đề xuất
   * rơi vào im lặng.
   *
   * Đúng chuyện ấy đã xảy ra khi `silence` và `cuts` chuyển lên trước `captions`
   * mà hạt giống thì ở lại: đo trên `prj_mse91wr6voihwy` — `silence` báo "rút 12
   * chỗ · 57.4s", `cuts` báo đã chạy, mà `segments` có ĐÚNG 0 dòng bị bỏ. Không
   * chặng nào báo lỗi; cả hai vẫn "done" kèm con số. Nhìn dữ liệu sau đó lại
   * càng không thấy, vì `GET /api/projects/:id` tự gieo bù lúc mở dự án.
   *
   * Chặng `captions` vẫn gieo lại một lượt nữa, và vẫn đúng: sau `commit-cut`
   * thì bản chép và trục thời gian đều là bản mới, đoạn cũ không còn nghĩa.
   */
  const mainSeconds = (
    db
      .prepare(
        "SELECT COALESCE(SUM(duration),0) AS total FROM media_files WHERE project_id=? AND role='main'",
      )
      .get(projectId) as { total: number }
  ).total;
  db.prepare("DELETE FROM segments WHERE project_id=?").run(projectId);
  await seedSegmentsByCaption(projectId, mainSeconds, readStylePack(projectId));
  /*
   * Đánh dấu đã gieo theo LUẬT MỚI NHẤT ngay tại đây — TRƯỚC khi áp lặng/cắt.
   *
   * Nếu không, `GET /api/projects/:id` thấy phiên bản cũ hơn sẽ tự gieo lại lúc
   * người dùng mở màn Soát cắt: nó DELETE hết đoạn rồi dựng lại, chỉ giữ `removed`
   * bằng cách xét điểm giữa đoạn MỚI có rơi vào khoảng bỏ CŨ không. Nhát cắt lặng
   * là khe hẹp giữa hai từ, nên điểm giữa của một đoạn-cụm-chữ rơi vào TIẾNG NÓI,
   * không vào khe — cả loạt trim lặng (đo thật: 58s) biến mất, chỉ vài cắt lời to
   * sống sót. Người dùng mở ra thấy còn 1:50 thay vì 1:05, tưởng máy cắt sai.
   *
   * Gieo ở đây DÙNG chính `seedSegmentsByCaption` bản mới nhất, và việc duy nhất
   * migration làm thêm — `splitVerbatimCaptions` — là phép rỗng khi chưa có chữ
   * (chữ chỉ sinh sau `commit-cut`). Nên đây đúng là bản mới, không đánh dấu khống.
   */
  db.prepare("UPDATE projects SET segments_by_caption=4 WHERE id=?").run(projectId);

  /*
   * ── CỔNG MỘT: SOÁT CẮT ──
   *
   * Chạy hai lượt cắt rồi DỪNG. Người dùng xem máy định bỏ đoạn nào, sửa, rồi
   * bấm tiếp — `resumeAfterCutReview` đi tiếp từ đây.
   *
   * Dừng ở đúng chỗ này vì lát cắt nằm THƯỢNG NGUỒN mọi thứ sau: một vết cắt
   * sai làm lệch cả lịch màn, chỗ đặt tư liệu, lẫn từ nhấn. Chốt trước rồi mới
   * dựng chữ thì không có gì phải làm lại.
   */
  await runAiWaves(projectId, ["silence", "cuts"]);

  /*
   * Đánh dấu dự án dùng được NGAY, không đợi tới cuối mạch.
   *
   * Cổng này mở ra là người dùng ngồi đọc vài phút — `base.mp4` dựng nền trong
   * lúc ấy, và `commitCut` ở pha hai cần nó.
   */
  db.prepare("UPDATE projects SET status='ready' WHERE id=?").run(projectId);
  setStep(projectId, "review-cut", "awaiting-user", {
    result: "đang chờ bạn soát chỗ cắt",
  });
  setJob(
    projectId, "transcribe", "done", 100,
    segments.length === 0
      ? "Không nghe được lời nào — video này không có tiếng nói"
      : `Chép được ${segments.length} câu` +
          (dropped.length > 0 ? ` · bỏ ${dropped.length} câu máy bịa` : "") +
          " · mời soát chỗ cắt",
  );
}

/**
 * ── PHA HAI ── chốt lát cắt, chép lời lại, sửa chỗ nghe nhầm.
 *
 * Gọi khi người dùng đã soát xong chỗ cắt. Từ sau `commit-cut` thì phim chỉ còn MỘT
 * trục thời gian — không còn gì phải quy đổi.
 */
export async function resumeAfterCutReview(projectId: string) {
  /*
   * ĐÓNG cổng ngay khi bước qua.
   *
   * Không đóng thì `awaiting` vẫn trả về nó mãi — mà `awaiting` là thứ giao
   * diện dùng để biết đang ở bước nào, nên người dùng bấm xong vẫn thấy y
   * nguyên nút cũ và mạch trông như không nhúc nhích. Đo thật: chạy hết ba pha
   * mà cổng vẫn báo `review-cut`, và bảng dừng ở 12/14.
   */
  setStep(projectId, "review-cut", "done", { result: "đã soát" });
  markStepRunning(projectId, "commit-cut");
  /*
   * Bảo đảm `base.mp4` có TRƯỚC khi cắt.
   *
   * Bản chất lượng dựng bằng một việc NỀN xếp hàng riêng ở `jobs-routes.ts`, mà
   * người dùng có thể bấm qua cổng trước khi việc ấy xong — nhất là với video
   * ngắn, lúc đọc mấy dòng đề xuất cắt nhanh hơn lượt mã hoá.
   *
   * Đo thật: chạy thẳng ba pha không qua tuyến đường thì pha hai ném lỗi
   * ffprobe "không tìm thấy tệp". Người dùng bấm nhanh cũng ra đúng lỗi ấy.
   *
   * `ensureMaster` chỉ dựng khi thật sự thiếu, nên gọi ở đây không tốn gì trong
   * ca thường.
   */
  await ensureMaster(projectId);
  const baseInfo = await probe(join(workDir(projectId), "base.mp4"));
  const cut = await commitCut(projectId, baseInfo.duration);
  setStep(projectId, "commit-cut", "done", {
    result: cut.skipped
      ? "không có gì để cắt"
      : `bỏ ${cut.removedSeconds.toFixed(1)}s · chép lại ${cut.wordsAfter} từ`,
  });

  /*
   * GIEO LẠI ĐOẠN LÊN TRỤC VIDEO ĐÃ CẮT — ngay đây, TRƯỚC cổng `review-text`.
   *
   * Sau `commitCut` thì chữ và trục thời gian là bản MỚI (video đã cắt), còn
   * `segments` vẫn là bản CŨ trên trục NGUỒN với các lát cắt pre-commit. Cổng Soát
   * lời mở ngay dưới và đọc CẢ hai: caption trên trục ĐÃ CẮT, còn `skipRanges` từ
   * segments trên trục NGUỒN — vùng bỏ mốc nguồn áp NHẦM lên caption đã cắt, giấu
   * mất cả câu người dùng đã giữ (đo thật: "Mình muốn ghi lại dấu mốc ngày hôm
   * nay" còn mỗi "nay", vì segment [0,1.56] nguồn trùm đầu câu 0-2.3 của bản cắt).
   *
   * Lát cắt đã NƯỚNG vào video nên ở đây KHÔNG còn gì để bỏ: gieo lại thành đoạn
   * TRƠN (toàn giữ) khớp đúng chữ mới, `skipRanges` rỗng. Chặng `captions` vẫn gieo
   * một lần nữa sau khi soát (để bắt các dòng người dùng thêm lúc soát) nên đây
   * không thừa — nó chỉ lấp đúng cửa sổ giữa commit-cut và cổng soát lời.
   */
  if (!cut.skipped) {
    const cutSeconds =
      (
        db
          .prepare("SELECT video_seconds FROM projects WHERE id=?")
          .get(projectId) as { video_seconds: number | null } | undefined
      )?.video_seconds ?? 0;
    if (cutSeconds > 0) {
      db.prepare("DELETE FROM segments WHERE project_id=?").run(projectId);
      await seedSegmentsByCaption(
        projectId,
        cutSeconds,
        readStylePack(projectId),
      );
      db.prepare("UPDATE projects SET segments_by_caption=4 WHERE id=?").run(
        projectId,
      );
    }
  }

  /**
   * Sửa chỗ nghe nhầm NGAY SAU khi có lời, trước mọi thứ dựng trên lời.
   *
   * Không xếp chung với nhóm chặng AI ở cuối được: chữ, đoạn, và các lượt cắt
   * đều đọc từ bảng từ, nên sửa sau là phải dựng lại tất cả.
   */
  if (hasModel()) {
    markStepRunning(projectId, "fix");
    try {
      const { fixed, rejected, rounds, settled } =
        await fixTranscript(projectId);
      // Câu dựng lại TỪ CHÍNH các từ vừa sửa: để nguyên thì bảng câu còn mang
      // chữ nghe nhầm, mà hàng soát và các lượt AI sau đều đọc từ đó.
      if (fixed > 0) {
        const rows = db
          .prepare(
            `SELECT s.id, (SELECT group_concat(w.text, ' ') FROM words w
               WHERE w.sentence_id = s.id ORDER BY w.start_sec) AS text
             FROM sentences s WHERE s.project_id=?`,
          )
          .all(projectId) as Array<{ id: string; text: string | null }>;
        const update = db.prepare("UPDATE sentences SET text=? WHERE id=?");
        db.transaction(() => {
          for (const row of rows) if (row.text) update.run(row.text, row.id);
        })();
      }
      setStep(projectId, "fix", "done", {
        // Câu NGẮN, đủ đọc trong một dòng không bị cắt.
        //
        // Bỏ chủ đề khỏi đây: nó dài 40 ký tự và đẩy cả dòng vào dấu ba chấm, mà
        // người đang chờ không cần biết mô hình đoán chủ đề là gì — nó chỉ là đầu
        // vào của chính chặng này.
        //
        // "còn có thể sót" đổi thành "hết lượt": `settled` nghĩa là lượt cuối không
        // sửa thêm gì nữa, còn không thì mô hình đã dùng hết số lượt cho phép —
        // "hết lượt" nói đúng chuyện đã xảy ra, "còn có thể sót" là một lời đoán.
        result:
          (fixed > 0
            ? `sửa ${fixed} chỗ · ${rounds} lượt${settled ? "" : " · hết lượt"}`
            : "không có chỗ nào") + (rejected > 0 ? ` · gạt ${rejected}` : ""),
      });
    } catch (error) {
      setStep(projectId, "fix", "failed", {
        error: (error as Error).message.slice(0, 120),
      });
    }
  } else {
    setStep(projectId, "fix", "failed", { error: "chưa có khoá mô hình" });
  }


  setStep(projectId, "review-text", "awaiting-user", {
    result: "đang chờ bạn soát chính tả",
  });
}

/**
 * ── PHA BA ── dựng chữ rồi chạy nốt các lượt làm đẹp.
 *
 * Gọi khi người dùng đã soát xong chính tả. Từ đây bản chép không đổi nữa nên
 * mọi thứ dựng trên nó đều an toàn.
 */
export async function resumeAfterTextReview(projectId: string) {
  setStep(projectId, "review-text", "done", { result: "đã soát" });
  const preview = join(workDir(projectId), "preview.mp4");
  /*
   * `anchors` RỖNG ở luồng mới.
   *
   * Nó vốn để neo lại phần tử sau khi bảng từ bị thay. Mà `commitCut` đã xoá
   * sạch phần tử ở pha hai, nên tới đây không còn gì để neo. Giữ biến để khối
   * dưới không phải viết lại.
   */
  const anchors: Array<{
    id: string;
    kind: string;
    from_sec: number;
    to_sec: number;
  }> = [];

  // Dựng đoạn ngay sau khi có lời: bàn dựng mở ra là đã thấy khối rõ ràng.
  markStepRunning(projectId, "captions");
  // Độ dài đọc từ bản xem trước — nó và bản chất lượng ra từ cùng một đồ thị lọc
  // nên dài bằng nhau tới từng khung, mà bản chất lượng thì lúc này chưa có.
  const info = await probe(preview);
  db.prepare("DELETE FROM segments WHERE project_id=?").run(projectId);
  await seedSegmentsByCaption(projectId, info.duration, readStylePack(projectId));
  // Đánh dấu ĐÚNG bản đã gieo (4 — bản mới nhất, chính hàm ở trên) chứ không phải
  // 3. Ghi 3 thì `GET /api/projects/:id` tưởng còn bản cũ nên gieo LẠI đoạn, mà
  // nó lấy tổng độ dài = SUM(media_files) — tức TRỤC GỐC 118s, không phải trục
  // đã cắt 52s mà `info.duration` vừa gieo đúng. Segments nhảy về 118s, và bàn
  // dựng đọc ra một timeline dài gấp đôi video thật. `splitVerbatimCaptions` mà
  // bước gieo-lại làm thêm là phép rỗng ở đây (chữ vừa gieo là chữ máy, đều ngắn).
  db.prepare("UPDATE projects SET segments_by_caption=4 WHERE id=?").run(
    projectId,
  );

  // Neo lại phần tử vào từ GẦN NHẤT theo thời gian. Lệch vài chục ms là chấp
  // nhận được; mất hẳn chữ thì không.
  const fresh = db
    .prepare(
      "SELECT id, start_sec, end_sec FROM words WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Array<{
    id: string;
    start_sec: number;
    end_sec: number;
  }>;

  let reanchored = 0;
  let refreshed = 0;
  if (fresh.length > 0 && anchors.length > 0) {
    const nearest = (time: number, key: "start_sec" | "end_sec") =>
      fresh.reduce((best, word) =>
        Math.abs(word[key] - time) < Math.abs(best[key] - time) ? word : best,
      );
    const update = db.prepare(
      "UPDATE elements SET from_word_id=?, to_word_id=? WHERE id=?",
    );
    /*
     * Chép LẠI `content` của cụm chữ từ những từ vừa neo vào.
     *
     * `content` là một BẢN SAO của lời chứ không phải phép nối lúc dựng, nên
     * neo lại thôi thì chữ trên video vẫn là lời của lần chép TRƯỚC. Đo thật:
     * chặng sửa lời đã đổi "Fanandef" thành "frontend dev" trong bảng từ, mà
     * video xuất ra vẫn hiện "Fanandef" — cả chặng sửa lời lẫn ô lời dặn thành
     * ra vô nghĩa với đúng thứ người xem đọc được.
     *
     * Làm mới VÔ ĐIỀU KIỆN, không cố đoán xem người dùng đã sửa tay hay chưa:
     *
     * · Sửa chữ trên bàn dựng vốn đã ghi ngược vào bảng từ (`applyTextBackToWords`
     *   ở `elements-routes.ts`). Hai bên vốn là một, không phải hai nguồn.
     * · Mà chép lại lời thì xoá sạch bảng từ rồi ghi từ mới. Bản sửa tay ở mức
     *   từ đã mất từ trước rồi; giữ riêng nó ở mức cụm chữ chỉ tạo ra một cụm
     *   chữ nói khác hẳn lời bên dưới nó.
     * · Và một khi đã lệch thì không tự lành: phép so "content có bằng lời cũ
     *   không" hỏng ngay từ lượt chép thứ hai, nên cụm ấy giữ chữ sai VĨNH VIỄN.
     */
    const rewrite = db.prepare("UPDATE elements SET content=? WHERE id=?");
    const textIn = db.prepare(
      `SELECT group_concat(text, ' ') AS says FROM (
         SELECT text FROM words
          WHERE project_id=? AND start_sec>=? AND end_sec<=? ORDER BY start_sec)`,
    );
    db.transaction(() => {
      for (const anchor of anchors) {
        const from = nearest(anchor.from_sec, "start_sec");
        const to = nearest(anchor.to_sec, "end_sec");
        update.run(from.id, to.id, anchor.id);
        reanchored += 1;
        // Chỉ cụm CHỮ. Phần tử tư liệu chèn cũng neo vào từ nhưng `content` của
        // nó không phải lời nói, ghi đè là xoá mất thứ người dùng đã đặt.
        if (anchor.kind !== "text") continue;
        const says = (
          textIn.get(projectId, from.start_sec, to.end_sec) as {
            says: string | null;
          }
        ).says;
        if (says) {
          rewrite.run(says, anchor.id);
          refreshed += 1;
        }
      }
    })();
  }

  // Dọn xác phần tử KHÔNG neo lại được — chỉ chạy sau khi đã neo xong, vì ngay
  // sau `clearOld()` thì mọi phần tử đều đang trỏ vào từ đã xoá.
  //
  // Gặp khi lần chép sau không ra chữ nào (video không có tiếng nói): phần tử
  // cũ trỏ vào một từ không còn tồn tại nên phép nối ở khâu xuất loại nó IM
  // LẶNG, mà bàn dựng vẫn bày nó ra như một cụm chữ bình thường. Chữ TỰ DO neo
  // theo giây nên không dính vào chuyện này.
  db.prepare(
    `DELETE FROM elements
     WHERE project_id=? AND start_sec IS NULL
       AND from_word_id NOT IN (SELECT id FROM words WHERE project_id=?)`,
  ).run(projectId, projectId);

  /**
   * Sinh chữ NGAY TRONG lượt dựng, không để `GET /api/projects/:id` gieo lười.
   *
   * Gieo lười thì việc chạy SAU khi cổng vào bàn dựng đã mở — trái đúng lối
   * "máy xong hết rồi mới tới lượt người dùng", và lần mở dự án đầu tiên phải
   * gánh cả khâu sinh chữ. Đo được nó còn nói dối: chặng này đếm chữ lúc chưa
   * ai gieo nên báo "0 chữ", trong khi mở dự án ra là có 58.
   *
   * Điều kiện `captions_seeded` giữ nguyên nên dự án CŨ vẫn đi đường gieo lười
   * ở `main.ts` như trước; ở đây chỉ là gieo sớm hơn cho dự án mới.
   */
  const captionState = db
    .prepare(
      "SELECT captions_seeded, subtitle_band, want_captions FROM projects WHERE id=?",
    )
    .get(projectId) as
    | {
        captions_seeded: number | null;
        subtitle_band: string | null;
        want_captions: number | null;
      }
    | undefined;
  // Người dùng tắt phụ đề ở màn nạp tệp thì KHÔNG gieo chữ. Đoạn vẫn dựng — đoạn
  // là chỗ cắt, không phải chữ — nên bàn dựng vẫn cắt được như thường.
  const wantCaptions = captionState?.want_captions !== 0;
  if (wantCaptions && !captionState?.captions_seeded) {
    const pack = readStylePack(projectId);
    /*
     * Chọn dải, không mặc định `bottom` nữa.
     *
     * Chỉ chọn khi người dùng CHƯA tự đặt: cột này cũng là ô họ chỉnh được, và
     * máy đè lên lựa chọn của người là lỗi nặng hơn hẳn một dải đặt chưa khéo.
     * Ghi lại kết quả để bàn dựng và mọi cụm chữ thêm sau đều theo cùng một dải.
     */
    let band = (captionState?.subtitle_band ?? null) as Band | null;
    if (!band) {
      // Đo trên bản xem trước: phép này thu nhỏ khung xuống 192px để đếm độ
      // động, nên độ phân giải nguồn không đổi kết quả.
      const picked = await pickCaptionBand(
        preview,
        info.width ?? OUT_WIDTH,
        info.height ?? OUT_HEIGHT,
        pack,
      );
      band = picked.band;
      db.prepare("UPDATE projects SET subtitle_band=? WHERE id=?").run(
        band,
        projectId,
      );
      setJob(projectId, "transcribe", "running", 70, `Phụ đề đặt ${band === "top" ? "trên" : "dưới"}: ${picked.why}`);
    }
    await createCaptionElements(projectId, band, pack);
    db.prepare(
      "UPDATE projects SET captions_seeded=1, subtitles=0 WHERE id=?",
    ).run(projectId);
  }

  const built = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM segments WHERE project_id=?) AS segments,
              (SELECT COUNT(*) FROM elements WHERE project_id=? AND kind='text') AS texts`,
    )
    .get(projectId, projectId) as { segments: number; texts: number };
  setStep(projectId, "captions", "done", {
    result: `${built.segments} đoạn · ${built.texts} chữ`,
  });


  await runAiWaves(projectId, ["keywords", "place", "effects", "music"]);
  // KHUNG MỜ ở cụm-chốt — đặt SAU `keywords` (cần từ khoá để chọn) + `place` (cần
  // biết b-roll để né). Chỉ bộ có defocus (Prism). Người dùng thêm/bỏ sau tuỳ ý.
  placeBlurFrames(projectId, pack);
  failStrandedSteps(projectId, "chặng này không chạy được ở lượt vừa rồi");
  setJob(projectId, "transcribe", "done", 100, "Xong — mời vào bàn dựng");
}


/**
 * Các khoảng còn giữ lại = TOÀN BỘ video trừ đi những câu đã gạch.
 *
 * Không lấy hợp của các câu còn giữ: làm thế thì mọi quãng nghỉ giữa hai câu
 * cũng bị cắt theo, và người xem nghe ra một tràng câu dồn dập không có chỗ thở.
 * Người dùng gạch câu nào thì chỉ mất đúng câu ấy.
 */
export function keptRanges(
  projectId: string,
  totalDuration: number,
): KeptRange[] {
  // ĐOẠN là nguồn duy nhất của việc "chỗ này có vào video hay không": đoạn đã bỏ
  // thì mất, hở giữa hai đoạn (do gọt mép) cũng mất vì nó không thuộc đoạn nào.
  // Trừ thêm câu đã gạch ở bên trong từng đoạn.
  const segments = listSegments(projectId);

  // Gộp các quãng chồng lấn trước khi trừ: trừ riêng từng quãng sẽ ra khoảng âm.
  const raw = (
    db
      .prepare(
        "SELECT start_sec, end_sec FROM sentences WHERE project_id=? AND removed=1",
      )
      .all(projectId) as Array<{ start_sec: number; end_sec: number }>
  ).sort((a, b) => a.start_sec - b.start_sec);

  const removed: Array<{ start_sec: number; end_sec: number }> = [];
  for (const span of raw) {
    const last = removed[removed.length - 1];
    if (last && span.start_sec <= last.end_sec) {
      last.end_sec = Math.max(last.end_sec, span.end_sec);
      continue;
    }
    removed.push({ ...span });
  }

  const kept: KeptRange[] = [];
  let cursor = 0;
  for (const gap of removed) {
    if (gap.start_sec > cursor + 0.05) {
      kept.push({ start: cursor, end: gap.start_sec });
    }
    cursor = Math.max(cursor, gap.end_sec);
  }
  if (totalDuration > cursor + 0.05)
    kept.push({ start: cursor, end: totalDuration });
  if (segments.length === 0) return mergeAdjacent(kept);
  return mergeAdjacent(
    keptFromSegments(
      projectId,
      removed.map((span) => ({ start: span.start_sec, end: span.end_sec })),
    ),
  );
}

/**
 * Dán liền những khoảng nối đuôi nhau.
 *
 * `keptFromSegments` trả về MỘT KHOẢNG MỖI ĐOẠN, kể cả khi hai đoạn dính sát
 * nhau — tách đoạn bằng ✂ là có thêm một khoảng dù không bỏ gì cả. Mà "chỗ nối"
 * lại đếm theo ranh giới giữa hai khoảng, nên video 9 đoạn không cắt gì vẫn bị
 * nhấn zoom 8 lần, ở đúng những chỗ hình chạy liền mạch.
 *
 * Chỗ nối chỉ tồn tại ở nơi hình thật sự ĐỨT. Dán liền ở đây cũng làm khâu cắt
 * nhẹ đi: ít mảnh `trim`/`concat` hơn.
 */
function mergeAdjacent(ranges: KeptRange[]): KeptRange[] {
  const out: KeptRange[] = [];
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && range.start <= last.end + 0.01) {
      last.end = Math.max(last.end, range.end);
      continue;
    }
    out.push({ ...range });
  }
  return out;
}

/** Hiệu ứng đặt tay, quãng theo giây BẢN GỐC. */
type ManualEffect = { start: number; end: number; kind: JunctionId };

/**
 * Chỗ nối nào dựng được CHUYỂN CẢNH THẬT, và mượn đệm ở đâu.
 *
 * Kiểu hai luồng cần hai cảnh cùng hiện một lúc, mà hình cho phần chồng ấy phải
 * lấy từ chính quãng vừa bị cắt bỏ — nên quãng đó phải đủ dài. Đo trên 98 chỗ
 * nối thật: quãng bỏ trung vị 2,36 giây và 76% chỗ nối đủ.
 *
 * Chỗ không đủ (người dùng cắt thẳng, không bỏ gì ở giữa) thì KHÔNG dựng, và nơi
 * gọi để nó rơi về hiệu ứng một luồng. Đúng kiểu người dùng chọn thì không còn,
 * nhưng có một cú nhấn vẫn hơn là không có gì xảy ra ở chỗ hình vừa đứt.
 *
 * Tách khỏi `runExport` để phép kiểm gọi được mà không cần cả cơ sở dữ liệu lẫn
 * ffmpeg — thứ cần kiểm ở đây chỉ là số học của việc mượn đệm.
 */
export function buildCrossAt(
  kept: KeptRange[],
  manual: ManualEffect[],
  defaultKind: JunctionId,
): CrossAt[] {
  const out: CrossAt[] = [];
  for (let index = 0; index < kept.length - 1; index++) {
    const at = kept[index].end;
    const tay = manual.find((item) => item.start <= at && at <= item.end);
    const spec = findJunction(tay?.kind ?? defaultKind);
    if (!spec.cross) continue;
    if (kept[index + 1].start - at < CROSS_SECONDS) continue;
    out.push({ sau: index, transition: spec.cross, dem: CROSS_SECONDS / 2 });
  }
  return out;
}

/**
 * Từ khoá ĐẮT NHẤT của cả video. `null` khi chưa nhấn gì.
 *
 * Chấm bằng `số lần × độ dài`, không bằng số lần trần. Đo trên một bản thật:
 * đếm trần thì "anh" thắng với 4 lượt — một đại từ, vẽ nó to bằng một phần năm
 * khung thì không nói lên điều gì. Nhân thêm độ dài thì "frontend" (3 lượt, 8
 * chữ) vượt lên, và đó đúng là chủ đề của video.
 *
 * Lý lẽ: tiếng NGẮN mà lặp nhiều gần như luôn là từ chức năng; tiếng DÀI mà lặp
 * nhiều thì phải là thứ bài đang nói về.
 *
 * So không phân biệt hoa thường và bỏ dấu câu — cùng phép chuẩn hoá mà chặng
 * nhấn dùng, nếu không thì "layoff" với "Layoff," đếm thành hai từ khác nhau và
 * không từ nào đủ nhiều để thắng.
 */
// Từ CHỨC NĂNG / đại từ / đệm — lặp nhiều mà KHÔNG mang chủ đề. Chữ-nền phải là
// một từ CÓ NGHĨA ("YOUTH" của Chalk), không phải "mình"/"được" lặp ba lần. Đây
// là lý do trước đây chữ-nền ra "Mình": nó là đại từ hay gặp nhất, thắng điểm.
const BEHIND_STOPWORDS = new Set([
  "mình", "tôi", "tui", "bạn", "mày", "tao", "chúng", "này", "kia", "đó", "ấy",
  "được", "không", "những", "các", "cái", "người", "cũng", "nhưng", "nên", "cho",
  "của", "với", "đã", "sẽ", "đang", "rồi", "lại", "rất", "quá", "hơn", "một",
  "khi", "nếu", "hoặc", "còn", "chỉ", "đến", "từ", "về", "trong", "ngoài", "trên",
  "dưới", "sau", "trước", "giờ", "bây", "thế", "vậy", "nào", "gì", "sao", "thì",
  "luôn", "thôi", "đây", "đâu", "phải", "chưa", "vẫn", "hay", "hoặc", "nữa",
]);

export function topKeyword(projectId: string): string | null {
  const rows = db
    .prepare(
      "SELECT keywords FROM elements WHERE project_id=? AND kind='text' AND keywords IS NOT NULL AND keywords<>''",
    )
    .all(projectId) as Array<{ keywords: string }>;
  const norm = (value: string) =>
    value.toLowerCase().replace(/^[^\p{L}\p{N}]+/gu, "").replace(/[^\p{L}\p{N}]+$/gu, "");
  const count = new Map<string, { text: string; n: number }>();
  for (const row of rows) {
    for (const word of row.keywords.split("|")) {
      const key = norm(word);
      // Bỏ tiếng một chữ cái, số trần, và từ chức năng/đại từ: lặp nhiều mà
      // không mang chủ đề.
      if (key.length < 3 || /^\d+$/.test(key) || BEHIND_STOPWORDS.has(key)) continue;
      const seen = count.get(key);
      if (seen) seen.n += 1;
      else count.set(key, { text: word.replace(/[^\p{L}\p{N}]+$/gu, ""), n: 1 });
    }
  }
  let best: { text: string; n: number } | null = null;
  const score = (item: { text: string; n: number }) => item.n * item.text.length;
  for (const item of count.values()) {
    if (!best || score(item) > score(best)) best = item;
  }
  // Không đòi lặp ≥2 lần: sau khi lọc đại từ/từ đệm, chủ đề có thể chỉ hiện MỘT
  // lần mà vẫn đáng làm chữ-nền. Còn từ có nghĩa nào là lấy; hết sạch mới bỏ.
  return best ? best.text : null;
}

/**
 * GIEO chữ-sau-người thành một ELEMENT — thiết bị độc lập, không phải giá trị
 * tính chớp lúc vẽ.
 *
 * Trước đây chữ-nền là một chuỗi tính ngay lúc xuất (`behindPhrase(topKeyword)`),
 * gắn cứng ở mở màn. Nhưng nó là một BLOCK như b-roll (b-roll có input ảnh, chữ-
 * nền có input chữ) — nên nó phải là một element MANG chữ + mốc riêng, để sau này
 * người dùng thêm/sửa/nhặt vào bất kỳ đâu. Bước này mới chỉ dựng element ở mở màn
 * (bằng đúng chữ + cửa sổ như bản cũ) — nên bản xuất KHÔNG đổi; UX thêm/sửa và vẽ
 * per-element ở mốc bất kỳ là bước sau.
 *
 * Gieo MỘT LẦN: đã có element chữ-nền thì thôi (xoá đi không tự mọc lại). Chỉ bộ
 * dáng KHAI chữ-nền (Phấn) mới gieo.
 */
export function seedBehindText(projectId: string): void {
  const pack = readStylePack(projectId);
  if (!pack.behindText) return;
  const existing = (
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM elements WHERE project_id=? AND kind='behindtext'",
      )
      .get(projectId) as { n: number }
  ).n;
  if (existing > 0) return;
  const line = behindPhrase(topKeyword(projectId));
  if (!line) return;
  // Cửa sổ mở màn = đúng khoảng chữ-nền hiện suốt: `seconds` trôi + `HEADLINE_FADE`
  // tắt dần — khớp `enable='lt(t, seconds+fade)'` của tầng vẽ.
  const end = pack.behindText.seconds + HEADLINE_FADE;
  db.prepare(
    "INSERT INTO elements (id, project_id, kind, content, start_sec, end_sec) VALUES (?,?,?,?,?,?)",
  ).run(newId("e"), projectId, "behindtext", line, 0, end);
}

/**
 * ĐỌC element chữ-sau-người (gieo nếu chưa có) — MỘT nguồn dùng chung cho bản xuất
 * và khung xem trước. Trả `id` để bàn dựng sửa được, `content` để vẽ.
 *
 * Bộ dáng không khai chữ-nền → `null`. Content RỖNG vẫn trả element (id còn đó): ô
 * trống là cách người dùng TẮT chữ-nền mà không xoá khung — phía vẽ tự bỏ khi câu
 * rỗng, và vì element còn tồn tại nên `seedBehindText` không mọc lại chữ cũ.
 */
export function behindElement(
  projectId: string,
): { id: string; content: string } | null {
  const pack = readStylePack(projectId);
  if (!pack.behindText) return null;
  seedBehindText(projectId);
  const row = db
    .prepare(
      "SELECT id, content FROM elements WHERE project_id=? AND kind='behindtext' ORDER BY start_sec LIMIT 1",
    )
    .get(projectId) as { id: string; content: string | null } | undefined;
  return row ? { id: row.id, content: row.content ?? "" } : null;
}

export async function runExport(projectId: string, signal?: AbortSignal) {
  const stop = () => {
    if (signal?.aborted) throw new Error("Đã huỷ");
  };
  setJob(projectId, "export", "running", 5, "Đang chuẩn bị");
  const sources = mainSources(projectId);
  if (sources.length === 0) throw new Error("Chưa có video chính");

  // Bảo đảm mọi element có block look của nó trước khi dựng — nguồn đọc là block
  // trên element, không phải bộ dáng toàn-cục. Fill-NULL nên phủ cả element cũ
  // lẫn mới, chạy lại vô hại.
  stampBlocksFromPack(projectId);

  /*
   * `base.mp4` thường đã có sẵn — việc nền dựng nó xong từ lúc người dùng còn
   * đang sửa lời. `ensureMaster` chỉ dựng khi thật sự thiếu: việc nền chưa chạy
   * tới, đã chạy mà hỏng, hay máy chủ khởi động lại giữa chừng.
   *
   * Bản trước gọi thẳng `buildBase` nên MỖI lượt xuất đều ghép lại từ đầu, kể cả
   * khi tệp còn nguyên đó — sáu phút trả cho một thứ đã có.
   */
  const base = join(workDir(projectId), "base.mp4");
  const baseVideo = base;
  setJob(projectId, "export", "running", 15, "Đang chuẩn bị bản dựng");
  await ensureMaster(projectId);

  const baseInfo = await probe(base);
  const kept = keptRanges(projectId, baseInfo.duration);
  // Mốc các chỗ nối trên dải ĐÃ CẮT: cộng dồn độ dài các khoảng giữ lại. Chỗ nối
  // đầu tiên (giây 0) không tính — không có gì để chuyển từ đó.
  // `zoom_punch` lưu kiểu MẶC ĐỊNH của dự án (tên cột giữ nguyên cho dữ liệu cũ).
  const defaultKind = normalizeJunction(
    (
      db
        .prepare("SELECT zoom_punch FROM projects WHERE id=?")
        .get(projectId) as { zoom_punch: string | number | null } | undefined
    )?.zoom_punch,
  );
  // Hiệu ứng người dùng ĐẶT TAY — quãng theo giây bản gốc, quy sang dải đã cắt.
  const manual = (
    db
      .prepare(
        "SELECT start_sec, end_sec, kind FROM effects WHERE project_id=? ORDER BY start_sec",
      )
      .all(projectId) as Array<{
      start_sec: number;
      end_sec: number;
      kind: string;
    }>
  ).map((row) => ({
    start: row.start_sec,
    end: row.end_sec,
    kind: normalizeJunction(row.kind),
  }));

  const crossAt = buildCrossAt(kept, manual, defaultKind);

  stop();
  setJob(projectId, "export", "running", 35, "Đang bỏ các đoạn đã gạch");
  const cut = await cutRanges(projectId, baseVideo, kept, crossAt);
  /*
   * Cắt MẶT NẠ theo đúng bộ khoảng ấy.
   *
   * Mặt nạ dựng trên `base.mp4` chưa cắt. Nạp thẳng nó vào đồ thị lọc thì nó
   * chạy theo trục của bản ĐÃ cắt, và hai bên lệch đúng bằng phần đã bỏ — đo
   * được trên một bản: bỏ 26 giây, và cái viền bám dáng người ôm một tư thế của
   * mấy giây trước đó.
   */
  const maskCut = hasSubject(projectId)
    ? await cutRanges(projectId, subjectPath(projectId), kept, crossAt, "cut-mask.mp4")
    : null;

  setJob(projectId, "export", "running", 60, "Đang in chữ và chèn tư liệu");
  const elements = resolveElements(projectId, kept);

  // Mỗi vết cắt được TỰ SUY một hiệu ứng theo mặc định của dự án — trừ chỗ đã có
  // hiệu ứng đặt tay phủ lên. Có cả hai thì hai xung cùng kiểu chồng nhau ở cùng
  // một chỗ, mà `max` của chúng chỉ nhô lên đúng một lần: người dùng kéo dài
  // quãng ra mà thấy y như cũ, không hiểu vì sao.
  const junctions: Array<{ start: number; end: number; kind: JunctionId }> = [];
  const [before, after] = junctionHalves(defaultKind);

  // Mốc của MỌI vết cắt trên dải đã cắt, kể cả chỗ sẽ bỏ qua vì đã có hiệu ứng
  // đặt tay: cần đủ danh sách thì mới biết một hiệu ứng được phép lấn tới đâu.
  const cutMarks: number[] = [];
  /**
   * Cùng những vết cắt ấy nhưng đo trên dải GỐC.
   *
   * Phải giữ cả hai thang: quãng hiệu ứng tính trên dải đã cắt, còn `manual` lưu
   * mốc gốc nên muốn biết một vết cắt đã có hiệu ứng đặt tay hay chưa thì phải
   * hỏi bằng mốc gốc. Đem mốc đã cắt đi so với mốc gốc thì chỗ nối có hiệu ứng
   * tay vẫn bị chồng thêm một hiệu ứng tự suy, và `max` của hai xung cùng kiểu
   * chỉ nhô lên một lần — người dùng kéo dài quãng ra mà thấy y như cũ.
   */
  const cutMarksSource: number[] = [];
  let running = 0;
  for (const range of kept.slice(0, -1)) {
    running += range.end - range.start;
    cutMarks.push(running);
    cutMarksSource.push(range.end);
  }
  const keptTotal = kept.reduce((sum, r) => sum + (r.end - r.start), 0);

  const crossFadedAudio = new Set(crossAt.map((item) => item.sau));

  /*
   * KẸP quãng hiệu ứng vào chỗ nó được phép chạy.
   *
   * Hai nửa của một kiểu êm dài tới 2,2–2,6 giây mỗi bên, mà công cụ này cắt im
   * lặng nên đoạn còn lại thường ngắn hơn thế nhiều. Không kẹp thì ra hai hỏng
   * nhìn thấy được:
   *
   * · Chỗ nối gần đầu video cho quãng bắt đầu ở số ÂM. Xung tính theo `t` nên
   *   ngay khung hình đầu tiên nó đã ở lưng chừng — video mở ra đã phóng to sẵn
   *   rồi mới hạ về, ở đúng cảnh người xem nhìn đầu tiên.
   *
   * · Hai chỗ nối gần nhau cho hai quãng CHỒNG nhau, và `max` của hai xung
   *   không bao giờ về 0 ở giữa. Hình không còn trở lại tỉ lệ thật giữa hai
   *   nhịp, nó cứ phóng dở suốt.
   *
   * Đo trên một dải bốn đoạn ngắn (9 giây): kiểu `push-in` cho ba quãng
   * [−1,2 · 3,2] [0,8 · 5,2] [1,8 · 6,2] — một quãng âm và hai quãng chồng.
   *
   * Quãng bị giới hạn trong nửa đường tới hai chỗ nối bên cạnh, và CO ĐỀU hai
   * nửa thay vì cắt cụt bên nào chật.
   *
   * Cắt cụt một bên là đổi tỉ lệ giữa hai nửa, mà đỉnh xung lại được tính LẠI
   * theo đúng tỉ lệ ấy (`effectPeak`) — nên đỉnh trượt khỏi vết cắt và cú nhấn
   * rơi vào chỗ hình đang chạy liền, không phải chỗ hình đứt. Co đều thì tỉ lệ
   * giữ nguyên, đỉnh vẫn đúng chỗ, hiệu ứng chỉ gọn lại.
   */
  for (const [index, cutAt] of cutMarks.entries()) {
    const at = cutMarksSource[index];
    if (manual.some((item) => item.start <= at && at <= item.end)) continue;
    // Chỗ nối đã dựng chuyển cảnh thật thì thôi: chồng một cú phóng lên một cú
    // hoà tan là hai thứ giành nhau, và cái nhìn thấy chỉ là hình vừa mờ vừa
    // giật — không ra kiểu nào cả.
    if (crossFadedAudio.has(index)) continue;
    // Ranh giới là NỬA ĐƯỜNG tới vết cắt bên cạnh, không phải chính vết cắt đó:
    // cho chạy tới tận vết cắt sau thì quãng này và quãng của chỗ nối ấy vẫn
    // giẫm lên nhau, vì quãng kia được phép bắt đầu từ vết cắt trước — tức từ
    // đây. Gặp nhau ở giữa thì hai bên chạm mép mà không chồng.
    const sanTruoc = index > 0 ? (cutMarks[index - 1] + cutAt) / 2 : 0;
    const sanSau =
      index + 1 < cutMarks.length
        ? (cutAt + cutMarks[index + 1]) / 2
        : keptTotal;
    // Nửa dài 0 giây không đòi chỗ nào — để nguyên `Infinity` thì nó không tham
    // gia quyết định hệ số co, thay vì thành 0/0.
    const coTruoc = before > 0 ? (cutAt - sanTruoc) / before : Infinity;
    const coSau = after > 0 ? (sanSau - cutAt) / after : Infinity;
    const co = Math.min(1, coTruoc, coSau);
    const start = cutAt - before * co;
    const end = cutAt + after * co;
    // Quãng bị bóp còn quá ngắn thì bỏ hẳn: một cú nhấn dưới một phần mười giây
    // không đọc ra là hiệu ứng, chỉ đọc ra là hình bị giật.
    if (end - start > 0.1) junctions.push({ start, end, kind: defaultKind });
  }

  // Quy quãng đặt tay sang dải đã cắt. Quãng nằm gọn trong một phần bị bỏ thì
  // biến mất theo — nó không còn chỗ nào để chạy.
  for (const item of manual) {
    const start = keptBefore(kept, item.start);
    const end = keptBefore(kept, item.end);
    if (end > start) junctions.push({ start, end, kind: item.kind });
  }


  /*
   * Dải ít người nhất — đo một lần ở GIỮA phim.
   *
   * Giữa phim chứ không đầu: mấy giây đầu hay là lúc người ta còn chỉnh máy, và
   * một khung ở đó không đại diện cho chỗ họ ngồi suốt phần còn lại.
   */
  const behindPack = readStylePack(projectId);
  /*
   * Chữ chạy sau người lấy từ TỪ KHOÁ, không lấy từ dòng tiêu đề.
   *
   * Tiêu đề là một câu; cắt mấy tiếng đầu của nó ra được "Thị trường" — đúng
   * ngữ pháp mà không mang gì. Thiết bị này vẽ MỘT từ ở cỡ bằng một phần năm
   * bề rộng khung, chồng ba tầng: nó cần từ ĐẮT nhất của video, không cần chủ
   * ngữ của câu đầu.
   *
   * Chặng `keywords` đã chọn sẵn những từ ấy rồi. Lấy từ được nhấn NHIỀU LẦN
   * nhất: lặp lại là dấu hiệu rõ nhất rằng cả video xoay quanh nó.
   */
  // Chữ-nền giờ SỐNG trong một element (gieo một lần nếu chưa có). Đọc chữ từ
  // element thay vì tính chớp — element là nơi người dùng sửa/tắt (ô trống = tắt).
  const behindEl = behindPack.behindText ? behindElement(projectId) : null;
  const behindLine = behindEl?.content.trim() ? behindEl.content : null;
  const behindBand = behindLine
    ? ((await emptiestBand(projectId, baseInfo.duration / 2))?.index ?? 0)
    : 0;

  /*
   * LỊCH MÀN — chỉ xếp khi bộ dáng khai bố cục.
   *
   * Mốc nắn lấy từ mép cụm chữ đã quy sang trục ĐÃ CẮT, cùng hệ với mọi thứ
   * `burnElements` vẽ. Lấy mốc gốc là lệch đúng bằng phần đã bỏ — lỗi tôi đã
   * mắc một lần với mặt nạ người.
   */
  const layoutPack = readStylePack(projectId);
  /*
   * LỊCH MÀN + tư liệu — MỘT nguồn `buildPlacedSegments`, cùng đường với khung xem
   * trước (`scene-schedule.ts`). B-roll và ô người đọc từ cùng bảng `elements`,
   * neo theo từ → giây đã cắt. Vắng segment = toàn-khung (không sinh màn).
   */
  const { segments: placedSegments, media: placedMedia } = buildPlacedSegments(
    projectId,
    kept,
    PICKABLE_LAYOUTS,
    layoutPack.layouts,
  );
  const insertPaths = placedMedia.map((item) => item.path);
  // Lấp khoảng trống bằng toàn-khung: `layoutPlan` lấy nền trang làm nền, nên chỗ
  // trống phải có một màn phủ kín để ra video, không ra nền trang trơ. (`keptTotal`
  // = độ dài phim đã cắt, tính ở trên.)
  const schedule =
    layoutPack.layouts.length > 0
      ? fillFullFrame(scheduleScenes(keptTotal, placedSegments), keptTotal)
      : [];
  /*
   * Tỉ lệ nguồn và chỗ người đứng — hai số làm ô ôm đúng người.
   *
   * Đo một lần: tỉ lệ nguồn quyết khổ ô, mà tỉ lệ thì không đổi giữa chừng.
   */
  const sourceAspect =
    baseInfo.width && baseInfo.height ? baseInfo.width / baseInfo.height : undefined;
  /*
   * Tỉ lệ TỪNG tệp tư liệu — ô phụ đo theo số này, không theo video chính.
   *
   * Cả bốn tệp của dự án thử nghiệm là 720×1280 (dọc 9:16) trong khi ô phụ khai
   * `ngang` (16:9): nhét dọc vào ngang bỏ mất 68% khung hình. Bố cục không biết
   * trước người dùng nạp gì, nên nó không được chốt cứng tỉ lệ của ô đựng thứ ấy.
   */
  const insertAspects = await Promise.all(
    insertPaths.map(async (path) => {
      const info = await probe(path).catch(() => null);
      return info?.width && info?.height ? info.width / info.height : 1;
    }),
  );

  // CỜ ENGINE: Remotion là MÁY VẼ MẶC ĐỊNH (một-engine). Đặt `TEDDIT_ENGINE=ffmpeg`
  // để quay lại `burnElements` (ffmpeg) làm ĐƯỜNG LÙI nếu Remotion hỏng ca nào đó.
  const engine =
    process.env.TEDDIT_ENGINE === "ffmpeg" ? "ffmpeg" : "remotion";
  // CHỐT số sửa NGAY TRƯỚC render (sau mọi bước đóng dấu/chuẩn bị): đây là "phiên
  // bản nội dung" mà bản dựng ghi lại. Set vào `exported_rev` khi xong → sửa gì
  // SAU thời điểm này (content_rev tăng tiếp) tự thành "cũ".
  const renderedRev = (
    db.prepare("SELECT content_rev AS r FROM projects WHERE id=?").get(projectId) as
      | { r: number }
      | undefined
  )?.r ?? 0;
  stop();
  if (engine === "remotion")
    setJob(projectId, "export", "running", 40, "Đang dựng hình (Remotion)");
  const finalPath =
    engine === "remotion"
      ? await renderViaRemotion(
          projectId,
          cut,
          join(outDir(projectId), "final.mp4"),
          {
            signal,
            // Khâu Remotion (0..1) trải lên quãng 40→80 của tiến trình xuất —
            // đây là khâu LÂU nhất; nối vào để thanh chạy mượt thay vì đứng ở 40.
            onProgress: (ratio) =>
              setJob(
                projectId,
                "export",
                "running",
                40 + Math.round(ratio * 40),
                "Đang dựng hình (Remotion)",
              ),
          },
        )
      : await burnElements(
    projectId,
    cut,
    elements,
    // Đọc MỘT LẦN lúc bắt đầu chặng xuất. Đổi bộ dáng giữa chừng chỉ ảnh hưởng
    // lượt sau — bản đang dựng dở không tự đổi dáng ở nửa sau video.
    readStylePack(projectId),
    junctions,
    // Đọc cùng lúc với bộ dáng, cùng lý do: bản đang dựng dở không đổi tiêu đề
    // ở nửa sau video khi người dùng sửa ô nhập giữa chừng.
    (
      db.prepare("SELECT headline FROM projects WHERE id=?").get(projectId) as
        | { headline: string | null }
        | undefined
    )?.headline ?? null,
    // Độ đục hình dán lấy điểm giữa xác định (không còn đo độ sáng khung hình).
    null,
    maskCut,
    /*
     * Chữ chạy sau người dùng lại chính DÒNG TIÊU ĐỀ.
     *
     * Không thêm một ô nhập nữa: người dùng đã gõ một câu đại diện cho video
     * rồi, và bắt họ gõ câu thứ hai cho một thiết bị của bộ dáng là bắt họ học
     * bộ dáng. Bộ nào có `behindText` thì câu ấy được vẽ theo lối này; bộ nào
     * không thì nó vẫn là dòng tiêu đề như cũ.
     */
    behindLine,
    behindBand,
    schedule,
    insertPaths,
    insertAspects,
    sourceAspect,
  );

  // Nhạc đặt theo thời gian NGUỒN trên dải, nên phải quy sang dải ĐÃ CẮT: bỏ
  // một phút ở giữa thì bài nhạc đặt sau đó cũng phải lùi lên đúng một phút,
  // không thì nó kêu lệch hẳn so với chỗ người dùng đã graded.
  const cues = listMusic(projectId)
    .filter((track) => existsSync(track.stored_path))
    .map((track) => {
      const start = keptBefore(kept, track.start_sec);
      return {
        path: track.stored_path,
        start,
        length: keptBefore(kept, track.end_sec) - start,
        volume: track.volume,
      };
    })
    // Bài nằm trọn trong một quãng đã bỏ thì độ dài về 0 — bỏ luôn, giữ lại là
    // `atrim` ra luồng rỗng và cả lệnh trộn hỏng.
    .filter((cue) => cue.length > 0.2);
  if (cues.length > 0) {
    setJob(projectId, "export", "running", 85, "Đang trộn nhạc nền");
    await mixMusic(projectId, finalPath, cues);
  }

  // Đánh dấu bản dựng trên đĩa ứng với phiên bản nội dung nào → nút biết "tươi".
  db.prepare("UPDATE projects SET exported_rev=? WHERE id=?").run(renderedRev, projectId);
  setJob(projectId, "export", "done", 100, "Xong", finalPath);
  await dropExportScratch(projectId);
  return finalPath;
}

/**
 * Dọn tệp trung gian của lượt xuất — CHỈ khi lượt ấy thành công.
 *
 * Mỗi dự án giữ lại khoảng ba tới bốn lần dung lượng tư liệu gốc, và giữ mãi.
 * `teddit.db` nằm cùng ổ với video, nên ổ đầy không phải chuyện "hết chỗ tải
 * thêm" mà là chuyện SQLite hết chỗ ghi — lỗi hiện ra ở một nơi chẳng liên quan
 * gì tới nguyên nhân, thường là giữa lượt dựng của một người khác.
 *
 * Chỉ xoá `cut.mp4` và tệp biểu thức của nó. `base.mp4` và `audio.wav` PHẢI ở
 * lại: dải ảnh (`/api/projects/:id/filmstrip`) và đường bao tiếng
 * (`/api/projects/:id/envelope`) đọc thẳng hai tệp đó mỗi lần mở bàn dựng — xoá
 * chúng là dọn đĩa bằng cách làm hỏng bàn dựng.
 *
 * Không dọn ở nhánh hỏng: lúc ấy chúng là bằng chứng để đọc ra chỗ gãy.
 */
async function dropExportScratch(projectId: string) {
  const work = workDir(projectId);
  for (const name of ["cut.mp4", "cut-filter.txt"]) {
    await unlink(join(work, name)).catch(() => {});
  }
}

/** Đổi phần tử gắn-vào-TỪ thành mốc thời gian trên dải ĐÃ CẮT. */
export function resolveElements(
  projectId: string,
  kept: KeptRange[],
): RenderElement[] {
  const rows = db
    .prepare(
      // LEFT JOIN chứ không INNER: chữ tự do KHÔNG neo vào từ nào, nên phép nối
      // trong sẽ loại sạch chúng và tiêu đề biến mất khỏi video mà không báo gì.
      `SELECT e.*, wf.start_sec AS from_start, wt.end_sec AS to_end, m.stored_path AS media_path
       FROM elements e
       LEFT JOIN words wf ON wf.id = e.from_word_id
       LEFT JOIN words wt ON wt.id = e.to_word_id
       LEFT JOIN media_files m ON m.id = e.media_file_id
       WHERE e.project_id = ?`,
    )
    .all(projectId) as Row[];

  // Mốc từng tiếng, để chữ hiện ra theo nhịp nói chứ không bật cả cụm một lúc.
  //
  // Chỉ dùng khi nội dung chữ CÒN ĐÚNG BẰNG lời của khoảng từ nó neo vào — tức
  // là chữ do máy chia cụm sinh ra và chưa ai viết lại. Người dùng viết lại thì
  // số tiếng không còn khớp, gán mốc theo lời cũ là chữ nhảy loạn nhịp.
  const words = db
    .prepare(
      "SELECT id, text, start_sec FROM words WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Array<{ id: string; text: string; start_sec: number }>;
  const wordIndex = new Map(words.map((word, index) => [word.id, index]));
  const wordBeats = (row: Row): number[] | undefined => {
    if (row.kind !== "text") return undefined;
    const from = wordIndex.get(String(row.from_word_id));
    const to = wordIndex.get(String(row.to_word_id));
    if (from === undefined || to === undefined || to < from) return undefined;
    const inside = words.slice(from, to + 1);
    if (inside.map((word) => word.text).join(" ") !== row.content)
      return undefined;
    return inside.map((word) => word.start_sec);
  };

  const out: RenderElement[] = [];
  for (const row of rows) {
    // Neo theo TỪ thì lấy mốc của từ; neo theo GIỜ thì lấy thẳng mốc đã lưu.
    // Cả hai đều là mốc BẢN GỐC, nên `mapToOutput` dồn chúng như nhau — đúng
    // cách nhạc nền đang làm.
    const source =
      row.from_start === null || row.from_start === undefined
        ? {
            from: Number(row.start_sec ?? Number.NaN),
            to: Number(row.end_sec ?? Number.NaN),
          }
        : { from: Number(row.from_start), to: Number(row.to_end) };
    if (Number.isNaN(source.from) || Number.isNaN(source.to)) continue;
    const rawStart = mapToOutput(kept, source.from);
    const rawEnd = mapToOutput(kept, source.to);

    /*
     * CẢ HAI đầu rơi vào chỗ đã bỏ thì phần tử không còn chỗ nào để hiện — bỏ
     * qua im lặng ở đây là đúng, vì người dùng đã chủ động bỏ câu đó.
     *
     * Nhưng chỉ MỘT đầu rơi thì khác: phần nằm trên đoạn được giữ vẫn có chỗ để
     * hiện. Ca này xảy ra khi một cụm chữ BẮC QUA mép một quãng bị bỏ — chữ neo
     * từ giây 10 tới giây 20 mà người dùng gạch câu ở giây 18 chẳng hạn. Vứt cả
     * nó đi là làm biến mất một dòng chữ người dùng không hề đụng tới, và không
     * có gì báo ra vì "không in dòng đó" cũng là một kết quả hợp lệ.
     *
     * `keptBefore` là hàm luôn trả ra một con số — mốc rơi vào đoạn đã bỏ thì
     * lấy mép của đoạn đó. Chữ vì thế hiện tới đúng lúc hình bị cắt rồi thôi.
     *
     * Phần tử nằm TRỌN trong quãng bỏ mà chỉ chạm mép ở một điểm thì hai mốc
     * quy về cùng một chỗ, và `end <= start` bên dưới loại nó — đúng như trước.
     */
    const start = rawStart ?? (rawEnd === null ? null : keptBefore(kept, source.from));
    const end = rawEnd ?? (rawStart === null ? null : keptBefore(kept, source.to));
    if (start === null || end === null || end <= start) continue;
    // Khung KHÔNG tư liệu (ô người, hay khung 2 ô chưa gắn media) là CẤU TRÚC bố
    // cục — `layoutPlan` vẽ nó từ lịch màn, không phải một lớp phủ ở đây. Chỉ chữ
    // và b-roll (có media) mới thành lớp phủ.
    if (!row.media_path && row.kind !== "text") continue;
    out.push({
      // B-roll = có tư liệu (render kind "insert"); còn lại là chữ.
      kind: row.media_path ? "insert" : "text",
      start,
      end,
      content: (row.content as string) ?? undefined,
      band: (row.position_band as RenderElement["band"]) ?? "top",
      // MỖI TRỤC đọc độc lập, chỉ trục nào còn trống mới lấy từ `layout` gộp cũ.
      //
      // Trước đây cả hai trục cùng đi theo một điều kiện `row.emphasis`: chữ đã
      // chọn căn Phải mà chưa đụng tới ô Nhấn thì `emphasis` vẫn rỗng, và cả
      // `align` bị vứt theo — video in ra căn Giữa trong khi người dùng chọn
      // Phải. Không có lỗi nào báo ra, vì "căn giữa" là một kết quả hợp lệ.
      ...(() => {
        const cu = fromLegacyLayout(row.layout as string | null);
        return {
          align: ((row.align as RenderElement["align"]) ??
            cu.align) as RenderElement["align"],
          emphasis: ((row.emphasis as RenderElement["emphasis"]) ??
            cu.emphasis) as RenderElement["emphasis"],
        };
      })(),
      keywords: row.keywords ? String(row.keywords).split("|") : [],
      // Hai cột ĐÈ ở cấp cụm; rỗng là theo bộ dáng của dự án.
      letterCase:
        row.letter_case === "upper" || row.letter_case === "as-typed"
          ? row.letter_case
          : null,
      keyColor: (row.key_color as string | null) ?? null,
      fontStyle: (row.font_style as string | null) ?? null,
      // Look chữ ĐÃ ĐÓNG DẤU trên cụm — cụm tự mang, không đọc ngược bộ dáng.
      captionBlock: row.caption_block
        ? (JSON.parse(row.caption_block as string) as CaptionBlock)
        : null,
      reveal: normalizeReveal(row.reveal as string | null),
      shape: (row.shape as RenderElement["shape"]) ?? "full",
      mediaPath: (row.media_path as string) ?? undefined,
      isStill: /\.(jpe?g|png|webp|heic)$/i.test(
        (row.media_path as string) ?? "",
      ),
      // Quy mốc từng tiếng sang dải đã cắt. Tiếng nào rơi đúng vào đoạn bị bỏ
      // thì lấy mốc đầu cụm — thà hiện sớm còn hơn không bao giờ hiện.
      wordStarts: wordBeats(row)?.map((at) => mapToOutput(kept, at) ?? start),
    });
  }
  return out;
}

/**
 * Các lượt AI, chạy sau khi bản dựng thô đã xong.
 *
 * Chia thành CHẶNG NỐI ĐUÔI, trong mỗi chặng thì chạy CÙNG LÚC. Chỉ hai ràng
 * buộc là thật:
 * · `silence` trước `cuts` — bản chép gọn rồi thì mô hình đọc đúng mạch hơn, và
 *   hai bên không tranh nhau cắt cùng một quãng.
 * · `cuts` trước nhóm cuối — `keywords` không được nhấn vào chỗ vừa cắt đi, còn
 *   `effects` chỉ có chỗ nối để chọn sau khi đã cắt.
 *
 * Bốn chặng cuối thì KHÔNG ăn nhau: `keywords` sửa cột từ khoá trên chữ, `place`
 * thêm hàng tư liệu, `effects` đọc đoạn, `music` đọc câu — không cái nào đọc kết
 * quả của cái nào. Xếp hàng chờ nhau chỉ vì viết bằng một vòng lặp: đo trên một
 * dự án thật là 118 giây cho việc dài nhất trong nhóm chỉ tốn 52.
 *
 * Một chặng hỏng KHÔNG được kéo theo các chặng sau: chúng đều `required: false`
 * nên hỏng thì đánh dấu rồi đi tiếp. `runOne` đã tự nuốt lỗi của từng chặng, nên
 * chạy cùng lúc cũng không có lượt nào kéo lượt nào xuống.
 */
/**
 * Tiến độ và lời báo của việc `transcribe`, suy từ CHẶNG ĐANG CHẠY.
 *
 * Trước đây chỉ ba chặng đầu gọi `setJob`, nên từ giây thứ 45% trở đi con số
 * đứng im và dòng chữ vẫn là "Đang nghe và chép lời" — trong khi máy đã đi qua
 * `fix`, `captions`, `silence`, `cuts`, `effects`. Đo trên một dự án thật: **10
 * phút cuối của 16 phút** báo sai như vậy.
 *
 * Hậu quả không chỉ là khó chịu. Nó làm "đang chạy" và "đã chết" trông giống hệt
 * nhau — người dùng hỏi "sao lâu thế", và chính tôi cũng đã một lần kết luận
 * nhầm là việc đã chết trong khi nó đang chạy bình thường.
 *
 * Con số là MỐC ƯỚC LƯỢNG, không phải phần trăm công việc thật: các chặng dài
 * ngắn rất khác nhau và còn đổi theo độ dài video. Nó chỉ cần đi tới, và đi tới
 * đúng lúc có chuyện xảy ra.
 */
const STEP_PROGRESS: Record<string, [number, string]> = {
  prepare: [5, "Đang ghép video chính"],
  describe: [40, "Đang đọc tư liệu chèn"],
  transcribe: [45, "Đang nghe và chép lời"],
  fix: [62, "Đang sửa chỗ nghe nhầm"],
  captions: [70, "Đang chia đoạn và sinh chữ"],
  silence: [75, "Đang cắt chỗ im lặng"],
  cuts: [80, "Đang tìm chỗ nên bỏ"],
  keywords: [88, "Đang chọn từ khoá"],
  place: [90, "Đang ghép tư liệu chèn"],
  effects: [93, "Đang chọn hiệu ứng"],
  music: [96, "Đang chọn nhạc nền"],
};

/**
 * Đánh dấu một chặng bắt đầu chạy, VÀ báo lên việc đang chạy tới đâu.
 *
 * Tiến độ chỉ ĐƯỢC PHÉP ĐI TỚI. Chặng cuối chạy song song bốn cái một lúc
 * (`keywords`, `place`, `effects`, `music`) nên đứa nào ghi sau cùng sẽ thắng —
 * không chặn thì thanh tiến độ lùi lại, mà thanh lùi thì đọc ra như hỏng.
 */
function markStepRunning(projectId: string, key: string) {
  setStep(projectId, key, "running");
  const at = STEP_PROGRESS[key];
  if (!at) return;
  const now = db
    .prepare("SELECT progress FROM jobs WHERE project_id=? AND kind='transcribe'")
    .get(projectId) as { progress: number } | undefined;
  if (now && now.progress > at[0]) return;
  setJob(projectId, "transcribe", "running", at[0], at[1]);
}

/**
 * Chạy một nhóm chặng làm đẹp theo TÊN.
 *
 * Trước đây là `runAiSteps` chạy hết một lượt, vì cả mạch đi thẳng từ đầu tới
 * cuối. Nay mạch có hai cổng chờ người nên mỗi pha chỉ chạy phần của nó, và
 * phần ấy phải gọi được bằng tên.
 *
 * Bốn chặng cuối chạy SONG SONG vì chúng đọc cùng bảng từ mà không ghi đè nhau;
 * `silence` và `cuts` thì tuần tự — chúng cùng quyết định bỏ đoạn nào, chạy
 * song song là hai bên tranh nhau cắt một quãng.
 */
const SONG_SONG = new Set(["keywords", "place", "effects", "music"]);

async function runAiWaves(projectId: string, keys: readonly string[]) {
  const byKey = new Map(aiJobs(projectId).map((job) => [job.key, job]));
  for (const key of keys.filter((k) => !SONG_SONG.has(k))) {
    const job = byKey.get(key);
    if (job) await runOne(projectId, job);
  }
  const together = keys
    .filter((k) => SONG_SONG.has(k))
    .map((k) => byKey.get(k))
    .filter((job): job is AiJob => !!job);
  if (together.length > 0) {
    await Promise.all(together.map((job) => runOne(projectId, job)));
  }
}

type AiJob = { key: string; run: () => Promise<string> };

/** Danh sách chặng AI theo đúng thứ tự chạy, kèm phép chạy của từng chặng. */
function aiJobs(projectId: string): AiJob[] {
  return [
    {
      // Chạy TRƯỚC `cuts`: bản chép lời gọn rồi thì mô hình đọc đúng mạch hơn,
      // và hai bên không tranh nhau cắt cùng một quãng.
      key: "silence",
      run: async () => {
        const { trimmed, saved } = trimSilence(
          projectId,
          await readSpeech(projectId),
          await readEnvelope(projectId),
        );
        return trimmed > 0
          ? `rút ${trimmed} chỗ · ${saved.toFixed(1)}s`
          : "không có chỗ nào";
      },
    },
    {
      key: "cuts",
      run: async () => {
        const { applied, rejected } = await proposeCuts(projectId);
        // SAU ai-cuts: dọn ĐẢO GIỮ không-lời (VAD báo nhầm tiếng gõ/ồn thành
        // giọng, ai-cuts không đụng được vì không có chữ). Bản chép giờ đã chốt.
        const island = trimWordlessIslands(projectId);
        return (
          `bỏ ${applied + island.trimmed} chỗ` +
          (rejected > 0 ? ` · gạt ${rejected}` : "")
        );
      },
    },
    {
      key: "keywords",
      run: async () => {
        const { applied, rejected, rounds } = await pickKeywords(projectId);
        return (
          `nhấn ${applied} cụm` +
          (rounds > 1 ? ` · ${rounds} lượt` : "") +
          (rejected > 0 ? ` · gạt ${rejected}` : "")
        );
      },
    },
    {
      key: "place",
      run: async () => {
        const { placed, rejected, why } = await placeInserts(projectId);
        return (
          `đặt ${placed} chỗ` +
          (rejected > 0 ? ` · gạt ${rejected}${why ? ` (${why})` : ""}` : "")
        );
      },
    },
    {
      // Ô người chạy SAU b-roll: nó nhắm 30% thời-gian-CÒN-LẠI (tổng − b-roll),
      // nên b-roll phải đặt xong trước.
      key: "layout",
      run: async () => {
        const { placed } = placePersonLayouts(projectId);
        return `${placed} khung người`;
      },
    },
    {
      key: "effects",
      run: async () => {
        // Hiệu ứng phải chạy SAU `cuts`: chỗ nối chỉ sinh ra ở nơi đã cắt, nên
        // chạy trước thì gần như không có chỗ nào để chọn.
        const total = (
          db
            .prepare(
              "SELECT COALESCE(SUM(duration),0) AS total FROM media_files WHERE project_id=? AND role='main'",
            )
            .get(projectId) as { total: number }
        ).total;
        const { applied, rejected } = await pickEffects(
          projectId,
          keptRanges(projectId, total),
        );
        return (
          `đặt ${applied} chỗ` + (rejected > 0 ? ` · gạt ${rejected}` : "")
        );
      },
    },
    {
      key: "music",
      run: async () => {
        const setting = db
          .prepare("SELECT want_music FROM projects WHERE id=?")
          .get(projectId) as { want_music: number | null } | undefined;
        if (setting?.want_music === 0) return "người dùng tắt nhạc nền";
        const { applied, note } = await pickMusic(projectId);
        return applied > 0 ? note : note || "bỏ qua";
      },
    },
  ];
}

/**
 * Chạy một chặng và ghi kết quả. Tách ra để `retryAiStep` dùng lại đúng phép chạy
 * ấy — chạy lại một chặng phải giống hệt lần đầu, không phải một bản sao gần giống.
 */
async function runOne(
  projectId: string,
  job: { key: string; run: () => Promise<string> },
) {
  // `silence` thuần phép trừ trên mốc từ, không gọi mô hình — thiếu khoá vẫn phải
  // chạy, và đó là chặng cắt được NHIỀU thời lượng nhất.
  if (!hasModel() && job.key !== "silence") {
    setStep(projectId, job.key, "failed", { error: "chưa có khoá mô hình" });
    return;
  }
  markStepRunning(projectId, job.key);
  try {
    setStep(projectId, job.key, "done", { result: await job.run() });
  } catch (error) {
    setStep(projectId, job.key, "failed", {
      error: (error as Error).message.slice(0, 120),
    });
  }
}

/**
 * Chạy lại từ một chặng AI cho tới HẾT mạch.
 *
 * Trước đây "Thử lại" gọi `startTranscribe`, tức dựng lại từ chặng đầu — mất vài
 * phút nghe và chép lời chỉ để làm lại một chặng phụ như chọn hiệu ứng. Và vì đắt
 * thế nên nút chỉ hiện ở chặng CHẶN ĐƯỜNG, còn chặng bỏ qua thì người dùng không có
 * đường nào thử lại dù nó hỏng vì một lý do tạm (mạng, mô hình quá tải).
 *
 * Chạy tới hết, không chỉ đúng một chặng: mạch bị ngắt giữa chừng thì chặng hỏng
 * KÈM mọi chặng sau nó đều dở — chặng sau nằm ở "chờ" và không ai đánh thức. Đo
 * thật: thử lại "Chọn hiệu ứng" xong thì "Chọn nhạc nền" vẫn chờ mãi.
 *
 * Chặng phía sau đã XONG thì bỏ qua: chạy lại một chặng đã xong là ghi đè kết quả
 * người dùng có thể đã xem và chỉnh ở bàn dựng. Riêng chặng được BẤM thì chạy lại dù
 * trạng thái gì — đó chính là điều người dùng vừa yêu cầu.
 *
 * Chỉ nhận chặng AI. Mấy chặng đầu (`prepare`, `transcribe`, `captions`) sinh ra dữ
 * liệu mà mọi chặng sau dựa vào, nên chạy lẻ chúng là để lại một bàn nửa cũ nửa mới.
 */
export async function retryAiStep(projectId: string, key: string) {
  /*
   * Thứ tự chạy lại phải KHỚP thứ tự lượt đầu.
   *
   * Trước đây đọc từ `aiStages()` — một danh sách gom sẵn. Nay mạch chia ba pha
   * nên danh sách ấy không còn; lấy thẳng từ `STEP_PLAN` là nguồn duy nhất, và
   * như thế thêm một chặng chỉ phải khai một chỗ.
   */
  const order = aiJobs(projectId).map((job) => job.key);
  const from = order.indexOf(key);
  if (from < 0) return false;

  const status = new Map(
    (
      db
        .prepare("SELECT key, status FROM steps WHERE project_id=?")
        .all(projectId) as Array<{ key: string; status: string }>
    ).map((row) => [row.key, row.status]),
  );

  // Chạy lại chính chặng được bấm và mọi chặng SAU nó chưa xong: chặng sau đọc
  // kết quả chặng trước, để nguyên là để lại một bàn nửa cũ nửa mới.
  const todo = order
    .slice(from)
    .filter((k) => k === key || status.get(k) !== "done");
  await runAiWaves(projectId, todo);
  failStrandedSteps(projectId, "chặng này không chạy được ở lượt vừa rồi");
  return true;
}
