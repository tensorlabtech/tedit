import { canTieng, doTieng } from "./auto-audio";
import { autoGradeOn, canHinh, doHinh } from "./auto-grade";
import { join } from "node:path";

import { buildEnvelope } from "./audio-envelope";
import { db, newId } from "./db";
import { filterHallucinations } from "./hallucination-filter";
import { extractAudio, makeFilmstrip, probe } from "./media-tools";
import { thumbDir, workDir } from "./paths";
import { existsSync } from "node:fs";

import { listMusic } from "./music-tracks";
import {buildBase, burnElements, cutRanges, keptBefore, mixMusic, mapToOutput, type KeptRange, normalizeReveal, type RenderElement} from "./render";
import {junctionHalves, normalizeJunction, type JunctionId} from "./junction-kinds";
import { keptFromSegments, listSegments } from "./segments";
import { seedSegmentsByCaption } from "./segment-seed";
import { buildAsrPrompt } from "./asr-bias";
import { proposeCuts } from "./ai-cuts";
import { fixTranscript } from "./ai-fix-transcript";
import { trimSilence } from "./auto-trim-silence";
import { describeInserts } from "./ai-broll-describe";
import { placeInserts } from "./ai-broll-place";
import { pickEffects } from "./ai-effects";
import { pickEmoji } from "./ai-emoji";
import { pickKeywords } from "./ai-keywords";
import { pickMusic } from "./ai-music";
import { createCaptionElements } from "./caption-elements";
import { hasModel } from "./llm";
import { readStylePack } from "./style-pack-store";
import { fromLegacyLayout, type Band } from "./text-layout";
import { failStrandedSteps, resetSteps, setStep } from "./pipeline-steps";
import { transcribeAudio } from "./transcribe";

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

  setStep(projectId, "prepare", "running");
  setJob(projectId, "transcribe", "running", 5, "Đang ghép video chính");
  const base = await buildBase(projectId, sources);

  // Dựng dải ảnh ngay ở bước này: bàn dựng cần nó để người dùng nhìn ra mình
  // đang ở khoảnh khắc nào, mà bước chép lời thì đã ghép sẵn `base.mp4`.
  setJob(projectId, "transcribe", "running", 20, "Đang dựng dải ảnh");
  const baseInfo = await probe(base);
  // Ghi lỗi ra thông báo việc thay vì nuốt im: lần trước lệnh ffmpeg vượt giới
  // hạn bề rộng JPEG, `catch` rỗng nuốt mất, dải vẫn dùng tệp cũ suốt hai lượt.
  const strip = await makeFilmstrip(
    base,
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

  setJob(projectId, "transcribe", "running", 30, "Đang tách tiếng");
  const audio = join(workDir(projectId), "audio.wav");
  await extractAudio(base, audio);
  // Đo đường bao ngay sau khi có tệp tiếng: dải sóng trên bàn dựng, mép các
  // quãng lặng, và phép lọc câu bịa đều đọc từ đây. Hỏng thì thôi — cả ba chỗ
  // đều có đường lùi.
  const envelope = await buildEnvelope(projectId, audio).catch(() => null);

  setStep(projectId, "prepare", "done", {
    result:
      `${formatClock(baseInfo.duration)} · ${sources.length} tệp` +
      (strip ? ` · ${Math.round(strip.totalSeconds)} khung` : ""),
  });

  /**
   * Đọc tư liệu chèn TRƯỚC khi nghe.
   *
   * Chặng này chỉ cần chính các tệp tư liệu, không cần bản chép lời — mà từ
   * vựng nó sinh ra lại mồi được cho máy nghe. Đặt nó ở cuối như bản trước là
   * vứt mất một kênh chống nghe nhầm không tốn thêm gì.
   */
  if (hasModel()) {
    setStep(projectId, "describe", "running");
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

  setStep(projectId, "transcribe", "running");
  setJob(projectId, "transcribe", "running", 45, "Đang nghe và chép lời");
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
  const { kept: segments, dropped } = filterHallucinations(heard, envelope);

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
  const anchors = db
    .prepare(
      `SELECT e.id, wf.start_sec AS from_sec, wt.end_sec AS to_sec
       FROM elements e
       JOIN words wf ON wf.id = e.from_word_id
       JOIN words wt ON wt.id = e.to_word_id
       WHERE e.project_id = ?`,
    )
    .all(projectId) as Array<{ id: string; from_sec: number; to_sec: number }>;

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
    result: `${wordCount.n} từ · ${segments.length} câu`,
  });

  /**
   * Sửa chỗ nghe nhầm NGAY SAU khi có lời, trước mọi thứ dựng trên lời.
   *
   * Không xếp chung với nhóm chặng AI ở cuối được: chữ, đoạn, và các lượt cắt
   * đều đọc từ bảng từ, nên sửa sau là phải dựng lại tất cả.
   */
  if (hasModel()) {
    setStep(projectId, "fix", "running");
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

  // Dựng đoạn ngay sau khi có lời: bàn dựng mở ra là đã thấy khối rõ ràng.
  setStep(projectId, "captions", "running");
  const info = await probe(base);
  db.prepare("DELETE FROM segments WHERE project_id=?").run(projectId);
  await seedSegmentsByCaption(projectId, info.duration, readStylePack(projectId));
  db.prepare("UPDATE projects SET segments_by_caption=3 WHERE id=?").run(
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
  if (fresh.length > 0 && anchors.length > 0) {
    const nearest = (time: number, key: "start_sec" | "end_sec") =>
      fresh.reduce((best, word) =>
        Math.abs(word[key] - time) < Math.abs(best[key] - time) ? word : best,
      );
    const update = db.prepare(
      "UPDATE elements SET from_word_id=?, to_word_id=? WHERE id=?",
    );
    db.transaction(() => {
      for (const anchor of anchors) {
        update.run(
          nearest(anchor.from_sec, "start_sec").id,
          nearest(anchor.to_sec, "end_sec").id,
          anchor.id,
        );
        reanchored += 1;
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
    await createCaptionElements(
      projectId,
      (captionState?.subtitle_band ?? "bottom") as Band,
      readStylePack(projectId),
    );
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

  await runAiSteps(projectId);

  db.prepare("UPDATE projects SET status='ready' WHERE id=?").run(projectId);
  setJob(
    projectId,
    "transcribe",
    "done",
    100,
    // Không nghe ra chữ nào thì NÓI THẲNG, đừng báo "chép được 0 câu" như một
    // con số bình thường: người dùng vừa đợi vài phút, họ phải biết ngay là
    // video này không có tiếng nói chứ không phải máy hỏng.
    segments.length === 0
      ? "Không nghe được lời nào — video này không có tiếng nói"
      : `Chép được ${segments.length} câu` +
          (dropped.length > 0 ? ` · bỏ ${dropped.length} câu máy bịa` : "") +
          (reanchored > 0 ? ` · neo lại ${reanchored} phần tử` : ""),
  );
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

export async function runExport(projectId: string) {
  setJob(projectId, "export", "running", 5, "Đang chuẩn bị");
  const sources = mainSources(projectId);
  if (sources.length === 0) throw new Error("Chưa có video chính");

  const base = join(workDir(projectId), "base.mp4");
  const baseVideo = sources.length ? base : base;
  setJob(projectId, "export", "running", 15, "Đang ghép video chính");
  await buildBase(projectId, sources);

  const baseInfo = await probe(base);
  const kept = keptRanges(projectId, baseInfo.duration);
  setJob(projectId, "export", "running", 35, "Đang bỏ các đoạn đã gạch");
  const cut = await cutRanges(projectId, baseVideo, kept);

  setJob(projectId, "export", "running", 60, "Đang in chữ và chèn tư liệu");
  const elements = resolveElements(projectId, kept);

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

  // Mỗi vết cắt được TỰ SUY một hiệu ứng theo mặc định của dự án — trừ chỗ đã có
  // hiệu ứng đặt tay phủ lên. Có cả hai thì hai xung cùng kiểu chồng nhau ở cùng
  // một chỗ, mà `max` của chúng chỉ nhô lên đúng một lần: người dùng kéo dài
  // quãng ra mà thấy y như cũ, không hiểu vì sao.
  const junctions: Array<{ start: number; end: number; kind: JunctionId }> = [];
  const [before, after] = junctionHalves(defaultKind);

  // Mốc của MỌI vết cắt trên dải đã cắt, kể cả chỗ sẽ bỏ qua vì đã có hiệu ứng
  // đặt tay: cần đủ danh sách thì mới biết một hiệu ứng được phép lấn tới đâu.
  const cutMarks: number[] = [];
  let running = 0;
  for (const range of kept.slice(0, -1)) {
    running += range.end - range.start;
    cutMarks.push(running);
  }
  const tongDaCat = kept.reduce((sum, r) => sum + (r.end - r.start), 0);

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
    if (manual.some((item) => item.start <= cutAt && cutAt <= item.end))
      continue;
    // Ranh giới là NỬA ĐƯỜNG tới vết cắt bên cạnh, không phải chính vết cắt đó:
    // cho chạy tới tận vết cắt sau thì quãng này và quãng của chỗ nối ấy vẫn
    // giẫm lên nhau, vì quãng kia được phép bắt đầu từ vết cắt trước — tức từ
    // đây. Gặp nhau ở giữa thì hai bên chạm mép mà không chồng.
    const sanTruoc = index > 0 ? (cutMarks[index - 1] + cutAt) / 2 : 0;
    const sanSau =
      index + 1 < cutMarks.length
        ? (cutAt + cutMarks[index + 1]) / 2
        : tongDaCat;
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
   * ĐO TRÊN BẢN ĐÃ CẮT, không phải trên từng tệp gốc.
   *
   * Một dự án có thể ghép nhiều tệp quay ở nhiều chỗ; đo riêng từng tệp rồi
   * chỉnh riêng thì đoạn nọ sáng hơn đoạn kia, và chỗ nối nào cũng thành một
   * cú nhảy sáng. Đo bản đã ghép thì cả video đi theo một mức.
   *
   * Tốn hai giây quét — chấp nhận được ở chặng cuối, nơi ffmpeg vốn đã chạy
   * hàng chục giây.
   */
  const tuCan = autoGradeOn(projectId);
  const canh = tuCan ? canHinh(await doHinh(cut)) : null;
  if (canh) console.log(`[render] tự cân hình: ${canh.lyDo.join(" · ")}`);

  // Đo TIẾNG trên cùng bản đã cắt, cùng lý do với hình: nhiều tệp ghép lại thì
  // mỗi tệp một mức, đo riêng rồi chỉnh riêng là đoạn nọ to hơn đoạn kia.
  const canhTieng = tuCan ? canTieng(await doTieng(cut)) : null;
  if (canhTieng) console.log(`[render] tự cân tiếng: ${canhTieng.lyDo.join(" · ")}`);

  const finalPath = await burnElements(
    projectId,
    cut,
    elements,
    // Đọc MỘT LẦN lúc bắt đầu chặng xuất. Đổi bộ dáng giữa chừng chỉ ảnh hưởng
    // lượt sau — bản đang dựng dở không tự đổi dáng ở nửa sau video.
    readStylePack(projectId),
    junctions,
    canh,
  );

  // Nhạc đặt theo thời gian NGUỒN trên dải, nên phải quy sang dải ĐÃ CẮT: bỏ
  // một phút ở giữa thì bài nhạc đặt sau đó cũng phải lùi lên đúng một phút,
  // không thì nó kêu lệch hẳn so với chỗ người dùng đã canh.
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
  if (cues.length > 0 || canhTieng) {
    setJob(
      projectId, "export", "running", 85,
      cues.length > 0 ? "Đang trộn nhạc nền" : "Đang cân âm lượng",
    );
    await mixMusic(projectId, finalPath, cues, canhTieng);
  }

  setJob(projectId, "export", "done", 100, "Xong", finalPath);
  return finalPath;
}

/** Đổi phần tử gắn-vào-TỪ thành mốc thời gian trên dải ĐÃ CẮT. */
function resolveElements(
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
    const start = mapToOutput(kept, source.from);
    const end = mapToOutput(kept, source.to);
    // Phần tử neo vào câu đã bị gạch bỏ thì không còn chỗ nào để hiện — bỏ qua
    // im lặng ở đây là đúng, vì người dùng đã chủ động bỏ câu đó.
    if (start === null || end === null || end <= start) continue;
    out.push({
      kind: row.kind === "insert" ? "insert" : "text",
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
      // Cột GIÁ TRỊ, không phải cột đè: bộ dáng không dùng emoji thì khâu vẽ
      // im lặng bỏ qua, cột vẫn còn nguyên cho lúc đổi về bộ có dùng.
      emoji: (row.emoji as string | null) ?? null,
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
async function runAiSteps(projectId: string) {
  for (const stage of aiStages(projectId)) {
    await Promise.all(stage.map((job) => runOne(projectId, job)));
  }
  // Chặng nào có tên trong bảng mà không có phép chạy thì tới đây vẫn đang chờ, và
  // từ giây này trở đi không còn ai đánh thức nó nữa.
  failStrandedSteps(projectId, "chặng này không chạy được ở lượt vừa rồi");
}

type AiJob = { key: string; run: () => Promise<string> };

/**
 * Các chặng AI, gom theo lượt chạy: chặng sau chờ chặng trước, trong cùng một
 * chặng thì chạy song song.
 */
function aiStages(projectId: string): AiJob[][] {
  const byKey = new Map(aiJobs(projectId).map((job) => [job.key, job]));
  const take = (...keys: string[]) =>
    keys.map((key) => byKey.get(key)).filter((job): job is AiJob => !!job);
  return [
    take("silence"),
    take("cuts"),
    take("keywords", "emoji", "place", "effects", "music"),
  ];
}

/** Danh sách chặng AI theo đúng thứ tự chạy, kèm phép chạy của từng chặng. */
function aiJobs(projectId: string): AiJob[] {
  return [
    {
      // Chạy TRƯỚC `cuts`: bản chép lời gọn rồi thì mô hình đọc đúng mạch hơn,
      // và hai bên không tranh nhau cắt cùng một quãng.
      key: "silence",
      run: async () => {
        const { trimmed, saved } = trimSilence(projectId);
        return trimmed > 0
          ? `rút ${trimmed} chỗ · ${saved.toFixed(1)}s`
          : "không có chỗ nào";
      },
    },
    {
      key: "cuts",
      run: async () => {
        const { applied, rejected } = await proposeCuts(projectId);
        return `bỏ ${applied} chỗ` + (rejected > 0 ? ` · gạt ${rejected}` : "");
      },
    },
    {
      key: "keywords",
      run: async () => {
        const { applied, rejected } = await pickKeywords(projectId);
        return (
          `nhấn ${applied} cụm` + (rejected > 0 ? ` · gạt ${rejected}` : "")
        );
      },
    },
    {
      // Cùng chặng với `keywords` chứ không sau nó: emoji bám vào CỤM, từ khoá
      // bám vào TIẾNG trong cụm — hai bên ghi hai cột khác nhau và không đọc kết
      // quả của nhau.
      key: "emoji",
      run: async () => {
        const { applied, rejected } = await pickEmoji(projectId);
        return (
          `gắn ${applied} hình` + (rejected > 0 ? ` · gạt ${rejected}` : "")
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
  setStep(projectId, job.key, "running");
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
  const stages = aiStages(projectId);
  const from = stages.findIndex((stage) =>
    stage.some((job) => job.key === key),
  );
  if (from < 0) return false;

  const status = new Map(
    (
      db
        .prepare("SELECT key, status FROM steps WHERE project_id=?")
        .all(projectId) as Array<{ key: string; status: string }>
    ).map((row) => [row.key, row.status]),
  );

  // Đi theo đúng chặng như lượt dựng đầu: chặng sau chờ chặng trước, trong cùng
  // một chặng thì chạy song song. Chạy lại phải giống hệt lần đầu, không phải một
  // bản sao gần giống.
  for (const stage of stages.slice(from)) {
    const todo = stage.filter(
      (job) => job.key === key || status.get(job.key) !== "done",
    );
    await Promise.all(todo.map((job) => runOne(projectId, job)));
  }
  failStrandedSteps(projectId, "chặng này không chạy được ở lượt vừa rồi");
  return true;
}
