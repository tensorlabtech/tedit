import { join } from "node:path";

import { buildEnvelope } from "./audio-envelope";
import { db, newId } from "./db";
import { filterHallucinations } from "./hallucination-filter";
import { extractAudio, makeFilmstrip, probe } from "./media-tools";
import { thumbDir, workDir } from "./paths";
import { existsSync } from "node:fs";

import { listMusic } from "./music-tracks";
import {
  buildBase,
  burnElements,
  cutRanges,
  keptBefore,
  mixMusic,
  mapToOutput,
  type KeptRange,
  junctionHalves,
  normalizeJunction,
  type JunctionId,
  normalizeReveal,
  type RenderElement,
} from "./render";
import { keptFromSegments, listSegments } from "./segments";
import { seedSegmentsByCaption } from "./segment-seed";
import { fromLegacyLayout } from "./text-layout";
import { transcribeAudio } from "./transcribe";

type Row = Record<string, unknown>;

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

  setJob(projectId, "transcribe", "running", 45, "Đang nghe và chép lời");
  const nghe = await transcribeAudio(audio, "vi");
  // Đối chiếu với sóng âm rồi mới ghi: whisper bịa ra câu trên quãng không ai
  // nói, và không có gì trong bản chép lời tự nói ra điều đó — xem
  // `hallucination-filter.ts`.
  const { kept: segments, dropped } = filterHallucinations(nghe, envelope);

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

  // Dựng đoạn ngay sau khi có lời: bàn dựng mở ra là đã thấy khối rõ ràng.
  const info = await probe(base);
  db.prepare("DELETE FROM segments WHERE project_id=?").run(projectId);
  await seedSegmentsByCaption(projectId, info.duration);
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
  const macDinh = normalizeJunction(
    (
      db
        .prepare("SELECT zoom_punch FROM projects WHERE id=?")
        .get(projectId) as { zoom_punch: string | number | null } | undefined
    )?.zoom_punch,
  );
  // Hiệu ứng người dùng ĐẶT TAY — quãng theo giây bản gốc, quy sang dải đã cắt.
  const dat = (
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
  const [truoc, sau] = junctionHalves(macDinh);
  let running = 0;
  for (const range of kept.slice(0, -1)) {
    running += range.end - range.start;
    const cat = range.end;
    if (dat.some((item) => item.start <= cat && cat <= item.end)) continue;
    junctions.push({ start: running - truoc, end: running + sau, kind: macDinh });
  }

  // Quy quãng đặt tay sang dải đã cắt. Quãng nằm gọn trong một phần bị bỏ thì
  // biến mất theo — nó không còn chỗ nào để chạy.
  for (const item of dat) {
    const start = keptBefore(kept, item.start);
    const end = keptBefore(kept, item.end);
    if (end > start) junctions.push({ start, end, kind: item.kind });
  }

  const finalPath = await burnElements(projectId, cut, elements, junctions);

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
  if (cues.length > 0) {
    setJob(projectId, "export", "running", 85, "Đang trộn nhạc nền");
    await mixMusic(projectId, finalPath, cues);
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
  const viTri = new Map(words.map((word, index) => [word.id, index]));
  const nhipNoi = (row: Row): number[] | undefined => {
    if (row.kind !== "text") return undefined;
    const from = viTri.get(String(row.from_word_id));
    const to = viTri.get(String(row.to_word_id));
    if (from === undefined || to === undefined || to < from) return undefined;
    const trong = words.slice(from, to + 1);
    if (trong.map((word) => word.text).join(" ") !== row.content)
      return undefined;
    return trong.map((word) => word.start_sec);
  };

  const out: RenderElement[] = [];
  for (const row of rows) {
    // Neo theo TỪ thì lấy mốc của từ; neo theo GIỜ thì lấy thẳng mốc đã lưu.
    // Cả hai đều là mốc BẢN GỐC, nên `mapToOutput` dồn chúng như nhau — đúng
    // cách nhạc nền đang làm.
    const goc =
      row.from_start === null || row.from_start === undefined
        ? {
            from: Number(row.start_sec ?? Number.NaN),
            to: Number(row.end_sec ?? Number.NaN),
          }
        : { from: Number(row.from_start), to: Number(row.to_end) };
    if (Number.isNaN(goc.from) || Number.isNaN(goc.to)) continue;
    const start = mapToOutput(kept, goc.from);
    const end = mapToOutput(kept, goc.to);
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
      reveal: normalizeReveal(row.reveal as string | null),
      shape: (row.shape as RenderElement["shape"]) ?? "full",
      mediaPath: (row.media_path as string) ?? undefined,
      isStill: /\.(jpe?g|png|webp|heic)$/i.test(
        (row.media_path as string) ?? "",
      ),
      // Quy mốc từng tiếng sang dải đã cắt. Tiếng nào rơi đúng vào đoạn bị bỏ
      // thì lấy mốc đầu cụm — thà hiện sớm còn hơn không bao giờ hiện.
      wordStarts: nhipNoi(row)?.map((at) => mapToOutput(kept, at) ?? start),
    });
  }
  return out;
}
