import { normalizeJunction } from "./junction-kinds";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, rm, unlink } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { fromNodeHeaders } from "better-auth/node";
import Fastify from "fastify";

import { auth } from "./auth";
import { authGuard } from "./auth-guard";
import { PROJECT_ROOT, PUBLIC_URL } from "./env";
import { assertInProject, assertOwnerIs } from "./ownership";

import { buildEnvelope, readEnvelope } from "./audio-envelope";
import { db, newId } from "./db";
import {
  makeFilmstrip,
  makeThumbnail,
  probe,
  type ProbeResult,
} from "./media-tools";
import {
  DATA_ROOT,
  ensureProjectDirs,
  mediaDir,
  projectDir,
  thumbDir,
  workDir,
} from "./paths";
import {
  absorbLegacyMusic,
  addMusic,
  deleteMusic,
  listMusic,
  mainDuration,
  restoreMusic,
  updateMusic,
} from "./music-tracks";
import {
  ASSETS,
  copyIntoProject,
  fingerprint,
  findDuplicate,
  kindOf,
  listAssets,
  rememberAsset,
  safeAssetName,
  setAssetStar,
  updateAsset,
} from "./asset-library";
import {
  AUDIO as AUDIO_LIB,
  LIBRARY,
  listLibrary,
  rememberUpload,
  safeName,
  setStar,
} from "./music-library";
import { retryAiStep, runExport, runTranscribe, setJob } from "./pipeline";
import { failRunningStep, pipelineState } from "./pipeline-steps";
import { readSettings, writeSettings } from "./settings";
import { seedSegmentsByCaption } from "./segment-seed";
import { OUT_HEIGHT, OUT_WIDTH } from "./render";
import {
  absorbManualCuts,
  listSegments,
  mergeIntoPrevious,
  removeRange,
  skippedSpans,
  renameSegment,
  setSegmentRemoved,
  splitAt,
  trimSegment,
  extendToDuration,
} from "./segments";
import {
  applyTextBackToWords,
  createCaptionElements,
  refreshCaptionsAfterWordEdit,
  splitVerbatimCaptions,
} from "./caption-elements";
import { suggestOpeningLines } from "./ai-opening";
import { KEY_COLORS } from "./style-pack";
import { GOC, STYLE_PACKS } from "./style-pack-catalog";
import { readStylePack } from "./style-pack-store";
import { layoutText, type Band } from "./text-layout";

const app = Fastify({ bodyLimit: 4 * 1024 * 1024 * 1024 });

await app.register(multipart, {
  limits: { fileSize: 4 * 1024 * 1024 * 1024, files: 20 },
});
/**
 * Cửa đăng nhập. Better Auth tự lo mọi đường dưới `/api/auth/`.
 *
 * Dựng một `Request` chuẩn web từ request của Fastify vì Better Auth nhận đúng
 * kiểu đó. Gốc lấy từ `PUBLIC_URL` chứ KHÔNG từ tiêu đề `Host`: sau lớp chuyển
 * tiếp (Vite lúc phát triển, Caddy lúc chạy thật) thì `Host` là thứ khách gửi
 * lên và sửa được, mà gốc này quyết định đường Google trả người dùng về — để nó
 * cho khách đặt là mở đường chuyển hướng người dùng sang chỗ khác.
 */
app.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  async handler(request, reply) {
    const url = new URL(request.url, PUBLIC_URL);
    const response = await auth.handler(
      new Request(url, {
        method: request.method,
        headers: fromNodeHeaders(request.raw.headers),
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      }),
    );
    reply.status(response.status);
    // `headers.forEach` chứ không `Object.fromEntries`: một lượt đăng nhập đặt
    // NHIỀU `set-cookie`, mà gộp vào object thì chỉ còn cái cuối.
    response.headers.forEach((value, key) => reply.header(key, value));
    return reply.send(response.body ? await response.text() : null);
  },
});

/**
 * Khoá toàn bộ `/api/` và `/files/`.
 *
 * Gắn TRƯỚC `fastifyStatic`: móc thêm vào sau chỉ áp cho route của chính thực thể
 * này, không lan sang plugin đã đăng ký xong — mà `/files/` chính là chỗ hở to
 * nhất, nên gắn sai thứ tự là khoá tất cả trừ đúng cái cần khoá.
 *
 * Dùng `onRequest` chứ không `preHandler` để chặn TRƯỚC lúc đọc thân request:
 * người chưa đăng nhập gửi tệp 4GB thì bị chối ngay ở tiêu đề, không phải chờ
 * nhận hết tệp rồi mới nói không.
 */
app.addHook("onRequest", authGuard);

await app.register(fastifyStatic, { root: DATA_ROOT, prefix: "/files/" });

/*
 * Ảnh emoji — cùng bộ tệp mà bộ dựng dán vào video.
 *
 * Cùng MỘT tệp cho cả hai đường vẽ, không phải hai bộ hình na ná nhau. Đó là mức
 * khớp mạnh nhất có thể có giữa trang xem và bản xuất, và nó có được chỉ vì
 * emoji là ảnh chứ không phải chữ.
 *
 * Tiền tố `/emoji/` chứ không `/assets/emoji/`: `/assets/` là chỗ Vite đổ tệp
 * bản dựng ra, đặt chung là hai bộ phục vụ tĩnh giẫm lên nhau ở đúng môi trường
 * thật mà lúc chạy dev không thấy gì.
 *
 * `decorateReply: false`: `reply.sendFile` chỉ được gắn MỘT lần cho cả ứng dụng.
 */
await app.register(fastifyStatic, {
  root: join(PROJECT_ROOT, "assets", "emoji"),
  prefix: "/emoji/",
  decorateReply: false,
});

const VIDEO = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;
const IMAGE = /\.(jpe?g|png|webp|heic)$/i;
const AUDIO = /\.(mp3|m4a|aac|wav|ogg|flac)$/i;

app.post("/api/projects", async (request) => {
  const body = (request.body ?? {}) as { title?: string };
  const id = newId("prj");
  ensureProjectDirs(id);
  // Dự án mới thừa hưởng CÀI ĐẶT của người tạo. Chép vào dự án chứ không đọc lúc
  // dựng là có chủ ý: đổi cài đặt về sau thì dự án cũ giữ nguyên thứ nó đã dựng,
  // chỉ dự án mới mới theo số mới.
  const setting = readSettings(request.viewer!.id);
  db.prepare(
    `INSERT INTO projects (id, title, status, created_at, owner_id, profile, min_silence, want_captions, want_music, insert_source)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    body.title?.trim() || "Dự án mới",
    "draft",
    Date.now(),
    request.viewer!.id,
    setting.profile,
    setting.minSilence,
    setting.wantCaptions ? 1 : 0,
    setting.wantMusic ? 1 : 0,
    setting.insertSource,
  );
  return { id };
});

/**
 * Đổi tên dự án.
 *
 * Máy chủ nhận `title` lúc tạo nhưng chưa từng có cửa nào sửa, mà màn nạp tệp
 * thì đặt cứng "Dự án mới" — nên mọi dự án mãi mãi cùng một tên và danh sách
 * thành mười ô không phân biệt được.
 */
app.patch("/api/projects/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = (request.body ?? {}) as {
    title?: string;
    profile?: string;
    minSilence?: number;
    wantCaptions?: boolean;
    wantMusic?: boolean;
    insertSource?: string;
    stylePack?: string;
  };
  const sets: string[] = [];
  const values: Array<string | number> = [];

  if (body.title !== undefined) {
    // Tên rỗng thì trả về mặc định, không lưu chuỗi rỗng: một ô không có chữ
    // nào trên danh sách còn khó nhận ra hơn mười ô trùng tên.
    sets.push("title=?");
    values.push((body.title.trim() || "Dự án mới").slice(0, 120));
  }
  if (body.profile !== undefined) {
    // LỜI DẶN: video nói về gì, có tên riêng nào. Hai chặng đọc nó — mồi từ vựng
    // cho máy nghe (`asr-bias.ts`) và chặng sửa lời (`ai-fix-transcript.ts`) —
    // và với tên riêng thì đây là nguồn duy nhất: không ngữ cảnh nào cho máy
    // đoán ra tên một công ty chưa ai nghe. Đo thật khi ô này còn rỗng:
    // "TensorLab" chép ra "Tensolab".
    //
    // Trần 600 ký tự khớp trần mồi của whisper (xem `MAX_CHARS` ở `asr-bias`):
    // dài hơn thì phần đuôi bị cắt ÂM THẦM, mà đuôi mới là chỗ đặt từ vựng.
    sets.push("profile=?");
    values.push(body.profile.trim().slice(0, 600));
  }
  if (typeof body.minSilence === "number") {
    // Kẹp trong khoảng có nghĩa: dưới 0 là vô nghĩa, trên 3 giây thì gần như
    // không quãng nghỉ nào bị rút và cài đặt thành vô tác dụng.
    sets.push("min_silence=?");
    values.push(Math.min(3, Math.max(0, body.minSilence)));
  }
  // Hai cờ chỉ đọc bởi mạch tự động, nên đổi lúc nào cũng được — nhưng đổi SAU
  // khi mạch đã chạy thì không có tác dụng gì với bản đã dựng.
  if (typeof body.wantCaptions === "boolean") {
    sets.push("want_captions=?");
    values.push(body.wantCaptions ? 1 : 0);
  }
  if (typeof body.wantMusic === "boolean") {
    sets.push("want_music=?");
    values.push(body.wantMusic ? 1 : 0);
  }
  // Nguồn tư liệu chốt theo TỪNG dự án: video này toàn cảnh quay sẵn thì mở cả
  // kho, video sau chỉ dùng đúng mấy tệp vừa nạp thì khoá lại — mà không phải
  // sang trang Cài đặt đổi qua đổi lại.
  if (
    body.insertSource === "project" ||
    body.insertSource === "starred" ||
    body.insertSource === "library"
  ) {
    sets.push("insert_source=?");
    values.push(body.insertSource);
  }
  // BỘ DÁNG CHỮ. Tên không có trong danh sách thì trả 400 chứ KHÔNG nhận rồi
  // lặng lẽ rơi về mặc định: nhận rồi rơi thì màn chọn báo "đã lưu" trong khi
  // CSDL giữ một thứ khác, và người dùng chỉ biết lúc xem video xuất ra.
  //
  // Đổi bộ dáng KHÔNG đụng bảng `elements`: cả bộ dáng nằm trong một cột ở đây.
  if (body.stylePack !== undefined) {
    if (!STYLE_PACKS.some((pack) => pack.id === body.stylePack)) {
      return reply.code(400).send({ error: "Không có bộ dáng này" });
    }
    sets.push("style_pack=?");
    values.push(body.stylePack);
  }
  if (sets.length === 0) {
    return reply.code(400).send({ error: "Không có gì để đổi" });
  }

  const found = db
    .prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id=?`)
    .run(...values, id);
  if (found.changes === 0) {
    return reply.code(404).send({ error: "Không có dự án này" });
  }
  return db
    .prepare(
      "SELECT id, title, profile, min_silence, want_captions, want_music, insert_source, style_pack FROM projects WHERE id=?",
    )
    .get(id);
});

app.get("/api/projects", async (request) =>
  db
    .prepare(
      // Ảnh đại diện lấy từ video chính ĐẦU TIÊN: đó là khung mở đầu của video
      // thành phẩm, nên nhìn vào là nhận ra ngay dự án nào.
      `SELECT p.*,
              (SELECT COUNT(*) FROM media_files m WHERE m.project_id = p.id) AS file_count,
              (SELECT COUNT(*) FROM sentences s WHERE s.project_id = p.id) AS sentence_count,
              (SELECT SUM(m.duration) FROM media_files m
                WHERE m.project_id = p.id AND m.role = 'main') AS duration,
              (SELECT m.thumb_path FROM media_files m
                WHERE m.project_id = p.id AND m.thumb_path IS NOT NULL
                ORDER BY (m.role <> 'main'), m.position LIMIT 1) AS thumb_path
       FROM projects p
       WHERE p.owner_id = ?
       ORDER BY p.created_at DESC`,
    )
    .all(request.viewer!.id),
);

/**
 * Đổi dáng mặc định của chữ sinh từ lời: `Đều nhau` → `Dẫn nhỏ · ý to`.
 *
 * Đổi mặc định lúc TẠO thì chỉ chữ mới được hưởng, còn dự án đang có vẫn mang
 * dáng cũ — mà không ai đi đổi tay năm chục chữ, nên coi như không đổi gì.
 *
 * CHỈ đụng vào chữ máy tự sinh và CHƯA ai chỉnh: nội dung còn đúng bằng lời nó
 * neo vào (phép thử "máy làm, chưa ai viết lại" đã dùng ở `nhipNoi` và
 * `refreshCaptionsAfterWordEdit`), và trục nhấn vẫn đúng giá trị máy đặt. Người
 * dùng đã chọn `Đều nhau` cho một chữ thì đó là lựa chọn của họ, không phải chỗ
 * để mình sửa lưng.
 */
function seedDefaultCaptionStyle(projectId: string) {
  const existing = db
    .prepare("SELECT caption_style FROM projects WHERE id=?")
    .get(projectId) as { caption_style: number | null } | undefined;
  if (existing?.caption_style) return;

  const words = db
    .prepare("SELECT id, text FROM words WHERE project_id=? ORDER BY start_sec")
    .all(projectId) as Array<{ id: string; text: string }>;
  const wordIndex = new Map(words.map((word, index) => [word.id, index]));
  const rows = db
    .prepare(
      "SELECT id, content, from_word_id, to_word_id FROM elements WHERE project_id=? AND kind='text' AND emphasis='even' AND from_word_id IS NOT NULL",
    )
    .all(projectId) as Array<{
    id: string;
    content: string | null;
    from_word_id: string;
    to_word_id: string;
  }>;

  const setEmphasis = db.prepare(
    "UPDATE elements SET emphasis='taper' WHERE id=?",
  );
  db.transaction(() => {
    for (const row of rows) {
      const from = wordIndex.get(row.from_word_id);
      const to = wordIndex.get(row.to_word_id);
      if (from === undefined || to === undefined || to < from) continue;
      const joined = words
        .slice(from, to + 1)
        .map((word) => word.text)
        .join(" ");
      if (joined !== row.content) continue;
      setEmphasis.run(row.id);
    }
    db.prepare("UPDATE projects SET caption_style=1 WHERE id=?").run(projectId);
  })();
}

/** Xem chú thích ở chỗ gọi trong `GET /api/projects/:id`. */
function mergeDismissedUnsureIssues(projectId: string) {
  const rows = db
    .prepare(
      "SELECT issue_id FROM dismissed_issues WHERE project_id=? AND issue_id LIKE 'unsure-%'",
    )
    .all(projectId) as Array<{ issue_id: string }>;
  if (rows.length === 0) return;
  const clearUnsure = db.prepare(
    "UPDATE words SET confidence=1 WHERE id=? AND project_id=?",
  );
  const deleteIssue = db.prepare(
    "DELETE FROM dismissed_issues WHERE project_id=? AND issue_id=?",
  );
  db.transaction(() => {
    for (const row of rows) {
      clearUnsure.run(row.issue_id.slice("unsure-".length), projectId);
      deleteIssue.run(projectId, row.issue_id);
    }
  })();
}

// Máy chủ vừa khởi động thì KHÔNG có việc nào đang chạy — việc sống trong tiến
// trình này, tiến trình chết là việc chết. Hàng còn ghi `running` là xác, dọn
// ngay để lần bấm sau không bị chốt chặn lại.
{
  const cleaned = db
    .prepare("UPDATE jobs SET status='error', message=? WHERE status='running'")
    .run("Bị ngắt giữa chừng — bấm lại giúp mình");
  // Chặng cũng phải dọn theo, không thì màn chờ mở ra thấy một con quay của
  // việc đã chết cùng tiến trình trước và quay mãi mãi.
  //
  // Dọn cả chặng CÒN CHỜ, không chỉ chặng ĐANG CHẠY. Chặng chờ mới là chỗ chết
  // người: nó không có con quay lẫn nút Thử lại nên trông y hệt một chặng sắp tới,
  // trong khi không còn lượt nào đánh thức nó nữa — `settled` mãi không đạt và cổng
  // vào bàn dựng khoá vĩnh viễn, không một đường nào mở ra. Đo thật: một dự án treo
  // ở 10/11 với `music` nằm chờ. Và vì `tsx watch` dựng lại máy chủ mỗi lần lưu tệp,
  // lúc phát triển thì đây là chuyện thường xuyên chứ không phải hiếm.
  //
  // Quét cả bảng là đúng: vừa vào tiến trình mới thì không việc nào còn sống, nên
  // mọi hàng `waiting` đều là xác của lượt trước.
  db.prepare(
    "UPDATE steps SET status='failed', error=?, updated_at=? WHERE status IN ('running','waiting')",
  ).run("Bị ngắt giữa chừng", Date.now());
  if (cleaned.changes > 0) {
    app.log.info(`dọn ${cleaned.changes} việc dở dang từ lần chạy trước`);
  }
}

app.get("/api/projects/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const project = db.prepare("SELECT * FROM projects WHERE id=?").get(id);
  if (!project) return reply.code(404).send({ error: "Không có dự án này" });

  // Đổi "cắt tay" kiểu cũ thành đoạn đã bỏ, một lần cho mỗi dự án. Đặt ở đây vì
  // đây là cửa duy nhất mọi màn đều đi qua trước khi sửa gì.
  absorbManualCuts(id);
  // "Bỏ qua" một lời nhắc NGHE KHÔNG CHẮC kiểu cũ đổi thành hạ hẳn cờ ngờ vực.
  //
  // Cách cũ chỉ giấu dòng nhắc, còn `confidence` giữ nguyên nên gạch chấm dưới
  // chữ nằm lại vĩnh viễn — hàng soát bảo "xong rồi" trong khi bản chép lời vẫn
  // bảo "chỗ này đáng ngờ". Giờ chỉ còn một câu trả lời ("chữ này đúng") và nó
  // ghi vào đúng chỗ giữ sự thật; mấy dòng bỏ-qua cũ phải chuyển theo, không thì
  // người dùng không còn nút nào để dọn chúng.
  mergeDismissedUnsureIssues(id);
  // Bốn dải cũ rút còn ba: `upper` và `lower` đều nằm quanh khoảng giữa khung nên
  // gộp về `middle`. Bốn dải liên tiếp phủ gần kín chiều dọc, đặt chữ ở hai dải
  // giữa là che đúng mặt người nói — thứ mà cả video đang nói về.
  db.prepare(
    "UPDATE elements SET position_band='middle' WHERE project_id=? AND position_band IN ('upper','lower')",
  ).run(id);
  seedDefaultCaptionStyle(id);
  // Thêm video chính sau khi đã chia đoạn thì phần thêm chưa thuộc đoạn nào —
  // nối thêm một đoạn ở đuôi, không thì nó lặng lẽ mất khỏi bản xuất.
  extendToDuration(
    id,
    (
      db
        .prepare(
          "SELECT COALESCE(SUM(duration),0) AS total FROM media_files WHERE project_id=? AND role='main'",
        )
        .get(id) as { total: number }
    ).total,
  );
  // Nhạc kiểu cũ (hai cột trên `projects`) đổi thành một hàng ở bảng nhạc, cũng
  // một lần cho mỗi dự án — cùng lý do và cùng chỗ.
  absorbLegacyMusic(id);
  // Gieo chữ từ lời ĐÚNG MỘT LẦN cho mỗi dự án.
  //
  // Chép lời xong là có chữ ngay — không có bước "bật phụ đề" nào cả, vì chữ
  // chạy theo lời là thứ gần như ai cũng muốn. Nhưng phải nhớ đã gieo rồi: xoá
  // hết chữ đi mà mở lại nó tự mọc lại thì người dùng không xoá được gì cả.
  //
  // Cờ `subtitles` cũ tính là "đã muốn có chữ", nên gieo luôn cho họ.
  const seeded = db
    .prepare(
      "SELECT captions_seeded, subtitles, subtitle_band FROM projects WHERE id=?",
    )
    .get(id) as
    | {
        captions_seeded: number | null;
        subtitles: number | null;
        subtitle_band: string | null;
      }
    | undefined;
  const wordCount = db
    .prepare("SELECT COUNT(*) AS n FROM sentences WHERE project_id=?")
    .get(id) as { n: number };
  // ĐANG chép lời thì chưa gieo gì cả.
  //
  // Bảng từ lúc này là bảng CŨ, sắp bị xoá và dựng lại. Gieo vào đó là sinh ra
  // một loạt chữ neo vào những từ sắp biến mất — chép lời xong, khâu neo-lại
  // kéo chúng sang từ gần nhất theo thời gian, và nội dung chữ không còn khớp
  // lời ở chỗ đó nữa. Đo thật một lần: 67 trên 69 chữ lệch. Chỉ cần người dùng
  // mở lại trang trong lúc đang chép là dính.
  const transcribeJob = db
    .prepare("SELECT status FROM jobs WHERE project_id=? AND kind='transcribe'")
    .get(id) as { status: string } | undefined;
  const idle = transcribeJob?.status !== "running";

  if (idle && !seeded?.captions_seeded && wordCount.n > 0) {
    await createCaptionElements(
      id,
      (seeded?.subtitle_band ?? "bottom") as Band,
      readStylePack(id),
    );
    db.prepare(
      "UPDATE projects SET captions_seeded=1, subtitles=0 WHERE id=?",
    ).run(id);
  }
  // Dựng lại đoạn theo cụm chữ và khoảng lặng — cũng một lần cho mỗi dự án.
  // Đoạn cũ chia theo "10 giây một khối" nên dải phim và bảng Lời chia theo hai
  // nhịp khác nhau, và bỏ một cụm phải tách đoạn ra ở hai đầu trước.
  const seedState = db
    .prepare("SELECT segments_by_caption FROM projects WHERE id=?")
    .get(id) as { segments_by_caption: number | null } | undefined;
  // Số phiên bản, không phải cờ bật/tắt: mỗi lần luật chia đoạn đổi thì dự án
  // đã dựng bằng luật cũ phải dựng lại một lần.
  //   1 → chia theo cụm, nhưng còn cắt vào giữa những chữ dài
  //   2 → không cắt vào giữa chữ nữa
  //   3 → chẻ trước những chữ chép nguyên lời mà dài hơn một cụm
  //   4 → phần nới mép theo tiếng thật không ăn sang cụm bên cạnh nữa
  if (idle && (seedState?.segments_by_caption ?? 0) < 4 && wordCount.n > 0) {
    await splitVerbatimCaptions(id, readStylePack(id));
    const total = (
      db
        .prepare(
          "SELECT COALESCE(SUM(duration),0) AS total FROM media_files WHERE project_id=? AND role='main'",
        )
        .get(id) as { total: number }
    ).total;
    await seedSegmentsByCaption(id, total, readStylePack(id));
    db.prepare("UPDATE projects SET segments_by_caption=4 WHERE id=?").run(id);
  }

  return {
    project,
    music: listMusic(id),
    // `kind` do MÁY CHỦ chốt, suy từ đuôi của đường dẫn thật trên đĩa. Giao diện
    // từng tự đoán bằng đuôi của `name`, mà `name` là chữ người dùng đặt — tệp
    // nào mất đuôi thì bị vẽ như một tấm ảnh, và khung xem trước dựng thẻ `<img>`
    // cho một tệp video rồi ra ô hỏng.
    files: (
      db
        .prepare(
          "SELECT * FROM media_files WHERE project_id=? ORDER BY role, position",
        )
        .all(id) as Array<Record<string, unknown>>
    ).map((row) => ({
      ...row,
      kind: kindOf(String(row.stored_path ?? "")) ?? "video",
    })),
    sentences: db
      .prepare("SELECT * FROM sentences WHERE project_id=? ORDER BY position")
      .all(id),
    words: db
      .prepare(
        "SELECT * FROM words WHERE project_id=? ORDER BY start_sec, position",
      )
      .all(id),
    elements: db.prepare("SELECT * FROM elements WHERE project_id=?").all(id),
    segments: listSegments(id),
    jobs: db.prepare("SELECT * FROM jobs WHERE project_id=?").all(id),
    // Màn chờ đọc từ đây. Gửi kèm `settled`/`blocked` thay vì để client tự suy:
    // luật "chặng bỏ qua vẫn tính là xong" chỉ nên có MỘT bản, và nó là bản
    // quyết định cổng vào bàn dựng nên phải nằm cùng chỗ với dữ liệu.
    pipeline: pipelineState(id),
    effects: db
      .prepare(
        "SELECT id, start_sec, end_sec, kind FROM effects WHERE project_id=? ORDER BY start_sec",
      )
      .all(id),
    dismissed: (
      db
        .prepare("SELECT issue_id FROM dismissed_issues WHERE project_id=?")
        .all(id) as Array<{ issue_id: string }>
    ).map((row) => row.issue_id),
  };
});

// Bỏ qua / lấy lại một lời nhắc ở hàng soát.
//
// Ghi xuống máy chủ chứ không giữ trong bộ nhớ màn hình: hàng soát dựng lại từ
// dữ liệu mỗi lần mở dự án, nên nhớ trong bộ nhớ thì tải lại là hỏi lại.
/**
 * Ba câu mở gợi ý cho "3 giây đầu".
 *
 * `POST` chứ không `GET`: nó gọi mô hình ngôn ngữ, tức là tốn tiền thật mỗi lần.
 * Một đường `GET` mời trình duyệt và mọi lớp đệm ở giữa gọi lại nó bất cứ lúc
 * nào — mà ở đây gọi lại nghĩa là trả tiền lại.
 */
app.post("/api/projects/:id/opening-lines", async (request) => {
  const { id } = request.params as { id: string };
  // Không có khoá mô hình thì trả mảng rỗng, KHÔNG trả lỗi: hai đường xử lý kia
  // của màn "3 giây đầu" không cần AI, nên một lỗi ở đây sẽ chặn cả ba.
  const lines = await suggestOpeningLines(id).catch(() => []);
  return { lines };
});

app.post("/api/projects/:id/dismissed", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { issueId } = request.body as { issueId?: string };
  if (!issueId) return reply.code(400).send({ error: "Thiếu mã lời nhắc" });
  db.prepare(
    "INSERT OR IGNORE INTO dismissed_issues (project_id, issue_id) VALUES (?,?)",
  ).run(id, issueId);
  return { ok: true };
});

/**
 * Đặt hoặc sửa MỘT hiệu ứng. Cùng một cửa cho cả "thêm mới" lẫn "sửa quãng /
 * đổi kiểu" — màn hình tự sinh mã, nên nó biết mình đang nói về cái nào.
 */
app.put("/api/projects/:id/effects/:effectId", async (request, reply) => {
  const { id, effectId } = request.params as { id: string; effectId: string };
  const { start, end, kind } = request.body as {
    start?: number;
    end?: number;
    kind?: string;
  };
  if (typeof start !== "number" || typeof end !== "number" || end <= start) {
    return reply.code(400).send({ error: "Quãng hiệu ứng không hợp lệ" });
  }
  if (!kind) return reply.code(400).send({ error: "Thiếu kiểu hiệu ứng" });
  // Chốt kiểu ở CỬA, không để chuỗi lạ nằm lại trong CSDL. Bản vẽ rơi về "cắt
  // thẳng" khi gặp kiểu không biết, nên một lần gõ sai tên sẽ đi qua êm ru và
  // chỉ lộ ra lúc người dùng thắc mắc sao chỗ nối này không có gì.
  if (normalizeJunction(kind) === "none" && kind !== "none") {
    return reply.code(400).send({ error: `Không có kiểu hiệu ứng "${kind}"` });
  }
  db.prepare(
    `INSERT INTO effects (id, project_id, start_sec, end_sec, kind) VALUES (?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET start_sec=excluded.start_sec, end_sec=excluded.end_sec, kind=excluded.kind`,
  ).run(effectId, id, start, end, kind);
  return { ok: true };
});

app.delete("/api/projects/:id/effects/:effectId", async (request) => {
  const { id, effectId } = request.params as { id: string; effectId: string };
  db.prepare("DELETE FROM effects WHERE project_id=? AND id=?").run(
    id,
    effectId,
  );
  return { ok: true };
});

app.delete("/api/projects/:id/dismissed/:issueId", async (request) => {
  const { id, issueId } = request.params as { id: string; issueId: string };
  db.prepare(
    "DELETE FROM dismissed_issues WHERE project_id=? AND issue_id=?",
  ).run(id, issueId);
  return { ok: true };
});

app.delete("/api/projects/:id", async (request) => {
  const { id } = request.params as { id: string };
  // Xoá hàng trước rồi mới xoá thư mục: xoá thư mục mà hàng còn thì lần mở sau
  // dự án hiện lên rỗng ruột và mọi thao tác đều lỗi.
  db.prepare("DELETE FROM projects WHERE id=?").run(id);
  await rm(projectDir(id), { recursive: true, force: true });
  return { ok: true };
});

app.post("/api/projects/:id/files", async (request, reply) => {
  const { id } = request.params as { id: string };
  if (!db.prepare("SELECT 1 FROM projects WHERE id=?").get(id)) {
    return reply.code(404).send({ error: "Không có dự án này" });
  }
  ensureProjectDirs(id);

  const saved: unknown[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];

  /**
   * Thứ tự NGƯỜI DÙNG chọn, do màn nạp tệp gửi kèm.
   *
   * Không suy ra được ở đây: mỗi tệp đi một request riêng và chúng chạy đua nhau,
   * nên "tệp nào tới trước" là thứ tự tệp nào NHẸ NHẤT, không phải thứ tự người
   * dùng xếp. Đo thật trên một dự án 6 cảnh: người dùng chọn main-1…main-6, mốc
   * lưu ra là 5-1-2-4-3-6 và độ dài lần lượt 8,0 · 6,1 · 10,0 · 38,7 · 42,0 · 13,1
   * giây — đúng thứ tự từ nhẹ tới nặng. Mà thứ tự này là thứ tự CẢNH TRONG PHIM.
   *
   * Chỉ có màn nạp tệp biết thứ tự thật, nên nó phải nói ra. Thiếu thì rơi về lối
   * cũ `MAX+1` — tải lên bằng công cụ khác vẫn chạy, chỉ là không giữ được thứ tự.
   */
  let order: number | null = null;

  for await (const part of request.parts()) {
    if (part.type !== "file") {
      if (part.fieldname === "order") {
        const value = Number((part as { value?: unknown }).value);
        if (Number.isFinite(value)) order = Math.max(0, Math.trunc(value));
      }
      continue;
    }
    const name = basename(part.filename ?? "khong-ten");
    const isVideo = VIDEO.test(name);
    const isImage = IMAGE.test(name);
    if (!isVideo && !isImage) {
      // Phải đọc hết luồng rồi mới bỏ, không thì phần sau của multipart lệch khung.
      await part.toBuffer();
      rejected.push({ name, reason: "Không nhận định dạng này" });
      continue;
    }

    const fileId = newId("f");
    const target = join(mediaDir(id), `${fileId}${extname(name)}`);
    await pipeline(part.file, createWriteStream(target));

    // Khai đúng kiểu `ProbeResult`: để suy kiểu từ giá trị mặc định thì `info`
    // chỉ còn bốn trường, và `info.warnings` phía dưới luôn là `undefined` —
    // cảnh báo "tệp mất tiếng" / "nhịp khung thay đổi" không bao giờ tới người
    // dùng. Máy chủ trước không được kiểm kiểu nên chỗ này im lặng suốt.
    let info: ProbeResult = {
      duration: 0,
      width: null,
      height: null,
      hasAudio: false,
      videoCodec: null,
      audioCodec: null,
      rotation: 0,
      variableFrameRate: false,
      warnings: [],
    };
    try {
      info = await probe(target);
    } catch {
      await unlink(target).catch(() => {});
      rejected.push({ name, reason: "Tệp hỏng, không đọc được" });
      continue;
    }

    // ffprobe KHÔNG ném lỗi cho mọi tệp hỏng: ném vào nó 200KB byte ngẫu nhiên
    // đặt đuôi `.mp4` thì nó vẫn đoán ra một luồng 352×288 dài 0 giây và trả về
    // bình thường. Tệp đó đi tiếp thì thành một ô trông như dùng được, và chỗ
    // vỡ dời tới tận lúc dựng — sau khi người dùng đã đợi vài phút chép lời.
    // Không đo được khung hình, hoặc video không dài nổi một khung, là hỏng.
    const unusable = !info.width || !info.height || (isVideo && !info.duration);
    if (unusable) {
      await unlink(target).catch(() => {});
      rejected.push({ name, reason: "Tệp hỏng, không đọc được" });
      continue;
    }

    let thumb: string | null = join(thumbDir(id), `${fileId}.jpg`);
    try {
      await makeThumbnail(target, thumb, isImage ? 0 : 0.5);
    } catch {
      thumb = null;
    }

    const role = isVideo && info.hasAudio ? "main" : "insert";
    // Số của người dùng dùng chung cho CẢ HAI vai, nên trong một vai nó có thể
    // nhảy cóc (0, 2, 5…). Không sao: mọi chỗ đọc đều `ORDER BY position` chứ
    // không đòi số liền nhau. Đánh lại số cho liền chỉ tổ phải biết vai của tệp
    // trước khi đo được nó có tiếng hay không — mà vai thì tới đây mới biết.
    const position =
      order ??
      (
        db
          .prepare(
            "SELECT COALESCE(MAX(position),-1) AS p FROM media_files WHERE project_id=? AND role=?",
          )
          .get(id, role) as { p: number }
      ).p + 1;

    db.prepare(
      `INSERT INTO media_files (id, project_id, name, size, role, position, duration, width, height, has_audio, stored_path, thumb_path)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      fileId,
      id,
      name,
      part.file.bytesRead ?? 0,
      role,
      position,
      info.duration,
      info.width,
      info.height,
      info.hasAudio ? 1 : 0,
      target,
      thumb,
    );
    const row = db
      .prepare("SELECT * FROM media_files WHERE id=?")
      .get(fileId) as Record<string, unknown>;
    // Cảnh báo đi kèm TỆP, không gộp vào lỗi chung: người dùng cần biết đúng tệp
    // nào có vấn đề, mà mấy chuyện này không chặn việc dựng.
    saved.push({ ...row, warnings: info.warnings });
  }

  return { saved, rejected };
});

/** Trả tệp gốc để khung xem trước dùng — không lộ đường dẫn đĩa ra ngoài. */
app.get("/api/files/:fileId/raw", async (request, reply) => {
  const { fileId } = request.params as { fileId: string };
  const file = db
    .prepare("SELECT stored_path, name FROM media_files WHERE id=?")
    .get(fileId) as { stored_path: string; name: string } | undefined;
  if (!file) return reply.code(404).send({ error: "Không có tệp này" });
  return reply.sendFile(
    file.stored_path.slice(file.stored_path.indexOf("/data/") + 6),
  );
});

app.patch("/api/files/:fileId", async (request, reply) => {
  const { fileId } = request.params as { fileId: string };
  const body = request.body as {
    role?: string;
    position?: number;
    description?: string;
  };
  const file = db
    .prepare("SELECT * FROM media_files WHERE id=?")
    .get(fileId) as { has_audio: number; role: string } | undefined;
  if (!file) return reply.code(404).send({ error: "Không có tệp này" });

  // Tệp không có tiếng thì không làm được video chính: video chính là phần CÓ
  // lời nói, và cả bản chép lời dựng từ đó.
  if (body.role === "main" && !file.has_audio) {
    return reply
      .code(400)
      .send({ error: "Tệp không có tiếng, không làm video chính được" });
  }
  if (body.role) {
    db.prepare("UPDATE media_files SET role=? WHERE id=?").run(
      body.role,
      fileId,
    );
  }
  if (typeof body.position === "number") {
    db.prepare("UPDATE media_files SET position=? WHERE id=?").run(
      body.position,
      fileId,
    );
  }
  // Mô tả tư liệu chèn. Người dùng viết thì máy KHÔNG đọc lại: chặng đọc tư liệu
  // chỉ chạm tệp nào cột này còn rỗng, nên viết vào đây là thắng luôn máy — và
  // đúng ra phải thế, máy chỉ tả được thứ nhìn thấy còn ý nghĩa thì người biết.
  //
  // Xoá trắng thì trả tệp về cho máy đọc ở lượt dựng sau. Ghi `NULL` chứ không
  // ghi chuỗi rỗng cho khớp với điều kiện `IS NULL OR =''` bên chặng đó.
  if (typeof body.description === "string") {
    const clean = body.description.trim().slice(0, 600);
    db.prepare("UPDATE media_files SET description=? WHERE id=?").run(
      clean || null,
      fileId,
    );
  }
  return db.prepare("SELECT * FROM media_files WHERE id=?").get(fileId);
});

app.delete("/api/files/:fileId", async (request) => {
  const { fileId } = request.params as { fileId: string };
  const file = db
    .prepare("SELECT stored_path FROM media_files WHERE id=?")
    .get(fileId) as { stored_path: string } | undefined;
  db.prepare("DELETE FROM media_files WHERE id=?").run(fileId);
  if (file) await unlink(file.stored_path).catch(() => {});
  return { ok: true };
});

/** Thêm một bài nhạc nền. Nhiều bài cùng lúc được — mỗi bài một khối trên dải. */
app.post("/api/projects/:id/music", async (request, reply) => {
  const { id } = request.params as { id: string };
  ensureProjectDirs(id);
  for await (const part of request.parts()) {
    if (part.type !== "file") continue;
    const name = basename(part.filename ?? "nhac");
    if (!AUDIO.test(name)) {
      await part.toBuffer();
      return reply.code(400).send({ error: "Không nhận định dạng nhạc này" });
    }
    // Tên tệp mang mã bài: nhiều bài mà cùng ghi đè `music.mp3` thì bài thứ hai
    // xoá mất tiếng của bài thứ nhất.
    const target = join(mediaDir(id), `music-${newId("m")}${extname(name)}`);
    await pipeline(part.file, createWriteStream(target));
    // Độ dài BÀI HÁT, đo từ chính tệp vừa nhận. Bản trước chỉ truyền độ dài
    // video vào nên mọi bài đều dài bằng phim, đúng vì nó luôn phủ cả video —
    // giờ đặt tại vạch thì phải biết bài thật sự dài bao nhiêu.
    const at = Number((request.query as { at?: string }).at ?? 0);
    const length = (await probe(target).catch(() => null))?.duration ?? 0;
    const track = addMusic(
      id,
      name,
      target,
      mainDuration(id),
      length,
      Number.isFinite(at) ? at : 0,
    );
    return track ?? reply.code(500).send({ error: "Không lưu được bài nhạc" });
  }
  return reply.code(400).send({ error: "Không có tệp nào" });
});

/**
 * KHO TƯ LIỆU DÙNG CHUNG — ảnh và video chèn cho mọi dự án.
 *
 * Khác tư liệu của MỘT dự án (`media_files` với role='insert'): thứ ở đây chưa
 * thuộc dự án nào, và đặt vào dự án là CHÉP một bản sang thư mục của dự án đó.
 * Chép chứ không trỏ chung: xoá dự án là xoá cả thư mục của nó, mà trỏ chung thì
 * cú xoá ấy rút mất tệp khỏi kho và mọi dự án khác dùng nó cùng gãy.
 */

/**
 * CÀI ĐẶT của người đang đăng nhập.
 *
 * Là MẶC ĐỊNH cho dự án tạo về sau, không áp ngược lên dự án đã dựng: đổi một nút
 * ở đây mà bản dựng hôm qua tự đổi theo thì người dùng mất công sửa cả buổi.
 */
app.get("/api/settings", async (request) => readSettings(request.viewer!.id));

app.patch("/api/settings", async (request) =>
  writeSettings(request.viewer!.id, (request.body ?? {}) as never),
);

app.get("/api/library/assets", async (request) =>
  listAssets(request.viewer!.id),
);

app.post("/api/library/assets", async (request) => {
  await mkdir(ASSETS, { recursive: true });
  let title = "";
  let tags: string[] = [];
  let description = "";
  const saved: unknown[] = [];
  const trung: Array<{ name: string; sameAs: string }> = [];

  for await (const part of request.parts()) {
    if (part.type !== "file") {
      const value = String((part as { value?: unknown }).value ?? "");
      if (part.fieldname === "title") title = value.trim().slice(0, 160);
      if (part.fieldname === "description")
        description = value.trim().slice(0, 600);
      if (part.fieldname === "tags") {
        tags = value
          .split(",")
          .map((tag) => tag.trim().slice(0, 30))
          .filter(Boolean)
          .slice(0, 12);
      }
      continue;
    }
    const name = basename(part.filename ?? "tu-lieu");
    if (!kindOf(name)) {
      await part.toBuffer();
      trung.push({ name, sameAs: "" });
      continue;
    }
    const file = safeAssetName(name);
    const target = join(ASSETS, file);
    await pipeline(part.file, createWriteStream(target));

    // CHỐNG TRÙNG theo nội dung, không theo tên. Cùng một tấm ảnh tải lại lần hai
    // thì tên khác mà vân tay y hệt — giữ cả hai là kho phình ra, và chặng ghép
    // tư liệu sẽ đặt hai bản của cùng một hình vào hai chỗ khác nhau.
    const hash = fingerprint(target);
    const daCo = findDuplicate(hash);
    if (daCo) {
      await unlink(target).catch(() => {});
      trung.push({ name, sameAs: daCo });
      continue;
    }

    const info = await probe(target).catch(() => null);
    const seconds = kindOf(file) === "video" ? (info?.duration ?? 0) : 0;
    rememberAsset({
      file,
      title: title || file.replace(/\.[^.]+$/, ""),
      tags,
      description,
      seconds,
      hash,
      uploadedBy: request.viewer!.id,
    });
    saved.push(file);
  }

  // Trả về CẢ danh sách mới lẫn danh sách bị bỏ vì trùng: người dùng thả mười tệp
  // mà chỉ thấy bảy cái hiện ra thì phải biết ba cái kia đi đâu.
  return {
    assets: listAssets(request.viewer!.id),
    added: saved.length,
    duplicates: trung,
  };
});

app.patch("/api/library/assets/:file", async (request) => {
  const { file } = request.params as { file: string };
  const body = (request.body ?? {}) as {
    title?: string;
    tags?: string[];
    description?: string;
  };
  updateAsset(decodeURIComponent(file), body);
  return { ok: true };
});

app.put("/api/library/assets/:file/star", async (request) => {
  const { file } = request.params as { file: string };
  const body = (request.body ?? {}) as { on?: boolean };
  setAssetStar(request.viewer!.id, decodeURIComponent(file), body.on !== false);
  return { ok: true };
});

/**
 * Đặt một tư liệu TỪ KHO vào dự án.
 *
 * CHÉP một bản sang thư mục của dự án, không trỏ chung vào tệp trong kho: xoá dự
 * án là xoá cả thư mục của nó, mà trỏ chung thì cú xoá ấy rút mất tệp khỏi kho và
 * mọi dự án khác đang dùng nó cùng gãy.
 *
 * Chỉ nhận TÊN TỆP. Cho client truyền đường dẫn là mở một cửa trỏ vào bất kỳ tệp
 * nào trên máy chủ.
 */
app.post("/api/projects/:id/assets/from-library", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = (request.body ?? {}) as { file?: string };
  const file = basename(body.file ?? "");
  if (!file || !kindOf(file))
    return reply.code(400).send({ error: "Thiếu tên tư liệu" });

  const row = await copyIntoProject(id, file);
  if (!row) return reply.code(404).send({ error: "Kho không có tư liệu này" });
  return row;
});

/**
 * KHO NHẠC DÙNG CHUNG — danh mục để nghe thử và chọn.
 *
 * Khác `POST /api/projects/:id/music`: đường kia nhận một bài rồi đặt THẲNG vào
 * một dự án. Còn kho thì nằm ngoài mọi dự án, ai cũng thấy như nhau.
 */
app.get("/api/library/music", async (request) =>
  listLibrary(request.viewer!.id),
);

app.post("/api/library/music", async (request, reply) => {
  let title = "";
  let tags: string[] = [];
  let saved: { file: string; seconds: number } | null = null;

  for await (const part of request.parts()) {
    if (part.type !== "file") {
      const value = String((part as { value?: unknown }).value ?? "");
      if (part.fieldname === "title") title = value.trim().slice(0, 120);
      if (part.fieldname === "tags") {
        tags = value
          .split(",")
          .map((tag) => tag.trim().slice(0, 30))
          .filter(Boolean)
          .slice(0, 12);
      }
      continue;
    }
    const name = basename(part.filename ?? "nhac.mp3");
    if (!AUDIO_LIB.test(name)) {
      // Đọc hết luồng rồi mới chối, không thì phần sau của multipart lệch khung.
      await part.toBuffer();
      return reply.code(400).send({ error: "Không nhận định dạng nhạc này" });
    }
    const file = safeName(name);
    const target = join(LIBRARY, file);
    await pipeline(part.file, createWriteStream(target));
    const length = (await probe(target).catch(() => null))?.duration ?? 0;
    // Tệp không đọc được thời lượng thì không phải nhạc — vứt ngay, đừng để kho
    // mọc ra một bài câm mà tới lúc xuất video mới vỡ.
    if (!(length > 1)) {
      await unlink(target).catch(() => {});
      return reply.code(400).send({ error: "Tệp hỏng, không đọc được nhạc" });
    }
    saved = { file, seconds: length };
  }

  if (!saved) return reply.code(400).send({ error: "Không có tệp nào" });
  rememberUpload(
    saved.file,
    title || saved.file.replace(/\.[^.]+$/, ""),
    tags,
    saved.seconds,
    request.viewer!.id,
  );
  return listLibrary(request.viewer!.id).find(
    (track) => track.file === saved!.file,
  );
});

app.put("/api/library/music/:file/star", async (request) => {
  const { file } = request.params as { file: string };
  const body = (request.body ?? {}) as { on?: boolean };
  setStar(request.viewer!.id, decodeURIComponent(file), body.on !== false);
  return { ok: true };
});

/**
 * Đặt một bài TỪ KHO vào dự án, tại vạch.
 *
 * Không cho client tự truyền đường dẫn: nó sẽ thành một cửa trỏ vào bất kỳ tệp
 * nào trên máy chủ. Chỉ nhận TÊN TỆP, rồi tự ghép với thư mục kho.
 */
app.post("/api/projects/:id/music/from-library", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = (request.body ?? {}) as { file?: string; at?: number };
  const file = basename(body.file ?? "");
  if (!file || !AUDIO_LIB.test(file)) {
    return reply.code(400).send({ error: "Thiếu tên bài" });
  }
  const source = join(LIBRARY, file);
  if (!existsSync(source)) {
    return reply.code(404).send({ error: "Kho không có bài này" });
  }
  const length = (await probe(source).catch(() => null))?.duration ?? 0;
  const at = Number(body.at ?? 0);
  const track = addMusic(
    id,
    file,
    source,
    mainDuration(id),
    length,
    Number.isFinite(at) ? Math.max(0, at) : 0,
  );
  return track ?? reply.code(409).send({ error: "Chỗ này đã có nhạc" });
});

app.patch("/api/music/:trackId", async (request, reply) => {
  const { trackId } = request.params as { trackId: string };
  const body = request.body as {
    volume?: number;
    start?: number;
    end?: number;
  };
  const track = updateMusic(trackId, body);
  return track ?? reply.code(404).send({ error: "Không có bài nhạc này" });
});

app.delete("/api/music/:trackId", async (request, reply) => {
  const { trackId } = request.params as { trackId: string };
  const track = deleteMusic(trackId);
  return track ?? reply.code(404).send({ error: "Không có bài nhạc này" });
});

/**
 * Đặt lại một bài vừa gỡ.
 *
 * Chỉ nhận tệp NẰM TRONG thư mục của chính dự án đó — nếu không thì đây là một
 * cửa cho người ngoài trỏ vào bất kỳ tệp nào trên máy chủ.
 */
app.post("/api/projects/:id/music/restore", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as {
    id: string;
    position: number;
    name: string;
    storedPath: string;
    start: number;
    end: number;
    volume: number;
  };
  if (!resolve(body.storedPath).startsWith(resolve(mediaDir(id)))) {
    return reply.code(400).send({ error: "Tệp không thuộc dự án này" });
  }
  const track = restoreMusic(id, {
    id: body.id,
    position: body.position,
    name: body.name,
    stored_path: body.storedPath,
    start_sec: body.start,
    end_sec: body.end,
    volume: body.volume,
  });
  return track ?? reply.code(500).send({ error: "Không đặt lại được" });
});

/**
 * Bố cục chữ cho khung xem trước.
 *
 * Màn hình KHÔNG tự tính lấy: nó không có tệp font để đo, nên bẻ dòng sẽ khác
 * bản in ra và người dùng canh trên màn xong xuất video lại lệch. Máy chủ đo
 * bằng đúng tệp font sẽ dùng để in, rồi trả số đo theo TỈ LỆ khung.
 */
app.post("/api/layout", async (request) => {
  const body = request.body as {
    content: string;
    band?: Band;
    projectId?: string;
  };
  // Bộ dáng đổi cả cỡ chữ lẫn chỗ bẻ dòng, nên khung xem trước phải hỏi bằng bộ
  // dáng của ĐÚNG dự án đang mở. Thiếu `projectId` thì rơi về bộ gốc.
  //
  // KIỂM QUYỀN TẠI CHỖ, không trông vào cổng chung: `auth-guard` soi mã trên
  // ĐƯỜNG DẪN, mà mã ở đây nằm trong THÂN request — đường dẫn `/api/layout`
  // không khớp mẫu nào nên nó đi thẳng qua cổng. Đây là đúng cái bẫy mà ghi chú
  // ở `ownership.ts` cảnh báo: cửa cứ mở, cho tới hôm có người đi qua.
  if (body.projectId) {
    assertOwnerIs(request.viewer!, "project", body.projectId);
  }
  const layout = await layoutText(
    body.content ?? "",
    body.band ?? "top",
    OUT_WIDTH,
    OUT_HEIGHT,
    body.projectId ? readStylePack(body.projectId) : GOC,
  );
  return {
    lines: layout.lines,
    truncated: layout.truncated,
    needsSplit: layout.needsSplit,
    fontRatio: layout.fontSize / OUT_HEIGHT,
    topRatio: layout.topY / OUT_HEIGHT,
    lineHeightRatio: layout.lineHeight / OUT_HEIGHT,
  };
});

/**
 * Sửa một TỪ máy nghe sai.
 *
 * Chỉ đổi chữ, giữ nguyên mốc và hạ cờ "không chắc": người đã nghe lại rồi thì
 * máy không còn quyền nghi ngờ nữa.
 */
app.patch("/api/words/:wordId", async (request, reply) => {
  const { wordId } = request.params as { wordId: string };
  const body = request.body as { text?: string };
  if (!body.text?.trim()) {
    return reply.code(400).send({ error: "Chữ không được để trống" });
  }
  // Đọc chữ CŨ trước khi ghi đè: đó là thứ duy nhất cho biết chữ trên màn nào
  // còn nguyên như máy sinh ra và nên sửa theo.
  const previous = db
    .prepare("SELECT project_id, text FROM words WHERE id=?")
    .get(wordId) as { project_id: string; text: string } | undefined;
  // Không có từ này thì phải NÓI. Trả 200 cho một mã không tồn tại là nói dối:
  // màn hình đã đổi chữ theo kiểu lạc quan, máy chủ im lặng không ghi gì, và
  // lần mở sau cú sửa biến mất mà không ai báo. Xảy ra thật khi một tab cũ còn
  // giữ mã từ của bản chép lời đã bị thay.
  if (!previous) return reply.code(404).send({ error: "Không có từ này" });
  db.prepare("UPDATE words SET text=?, confidence=1 WHERE id=?").run(
    body.text.trim(),
    wordId,
  );
  {
    refreshCaptionsAfterWordEdit(
      previous.project_id,
      wordId,
      previous.text,
      body.text.trim(),
    );
  }
  const word = db.prepare("SELECT * FROM words WHERE id=?").get(wordId) as
    { sentence_id: string } | undefined;
  if (word) {
    // Dựng lại lời của câu từ các từ: hai nguồn lệch nhau thì bản chép lời hiện
    // một đằng mà bản in ra một nẻo.
    const words = db
      .prepare("SELECT text FROM words WHERE sentence_id=? ORDER BY position")
      .all(word.sentence_id) as Array<{ text: string }>;
    db.prepare("UPDATE sentences SET text=? WHERE id=?").run(
      words.map((item) => item.text).join(" "),
      word.sentence_id,
    );
  }
  return db.prepare("SELECT * FROM words WHERE id=?").get(wordId);
});

app.patch("/api/sentences/:sentenceId", async (request) => {
  const { sentenceId } = request.params as { sentenceId: string };
  const body = request.body as { removed?: boolean; text?: string };
  if (typeof body.removed === "boolean") {
    db.prepare("UPDATE sentences SET removed=? WHERE id=?").run(
      body.removed ? 1 : 0,
      sentenceId,
    );
  }
  if (typeof body.text === "string") {
    db.prepare("UPDATE sentences SET text=? WHERE id=?").run(
      body.text,
      sentenceId,
    );
  }
  return db.prepare("SELECT * FROM sentences WHERE id=?").get(sentenceId);
});

app.get("/api/projects/:id/segments", async (request) => {
  const { id } = request.params as { id: string };
  return listSegments(id);
});

app.post("/api/projects/:id/segments/split", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as { at: number };
  if (!splitAt(id, body.at)) {
    return reply.code(400).send({ error: "Chỗ này không tách được đoạn" });
  }
  return listSegments(id);
});

app.post("/api/segments/:segmentId/merge", async (request, reply) => {
  const { segmentId } = request.params as { segmentId: string };
  const row = db
    .prepare("SELECT project_id FROM segments WHERE id=?")
    .get(segmentId) as { project_id: string } | undefined;
  if (!row) return reply.code(404).send({ error: "Không có đoạn này" });
  if (!mergeIntoPrevious(segmentId)) {
    return reply.code(400).send({ error: "Không gộp được — đây là đoạn đầu" });
  }
  return listSegments(row.project_id);
});

app.patch("/api/segments/:segmentId", async (request, reply) => {
  const { segmentId } = request.params as { segmentId: string };
  const body = request.body as {
    removed?: boolean;
    label?: string;
    edge?: "start" | "end";
    at?: number;
  };
  // Cùng lý do với `PATCH /api/words/:id`: mã không tồn tại thì trả 404, đừng
  // báo thành công rồi không ghi gì.
  const exists = db
    .prepare("SELECT id FROM segments WHERE id=?")
    .get(segmentId) as { id: string } | undefined;
  if (!exists) return reply.code(404).send({ error: "Không có đoạn này" });
  if (typeof body.removed === "boolean")
    setSegmentRemoved(segmentId, body.removed);
  if (typeof body.label === "string") renameSegment(segmentId, body.label);
  if (body.edge && typeof body.at === "number")
    trimSegment(segmentId, body.edge, body.at);
  return db.prepare("SELECT * FROM segments WHERE id=?").get(segmentId);
});

/** Bỏ một quãng theo giây — vẫn là ĐOẠN, chỉ là tách sẵn hai đầu. */
app.post("/api/projects/:id/segments/remove-range", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as { start?: number; end?: number };
  if (typeof body.start !== "number" || typeof body.end !== "number") {
    return reply.code(400).send({ error: "Thiếu mốc đầu hoặc mốc cuối" });
  }
  return removeRange(id, body.start, body.end);
});

/** Những quãng sẽ KHÔNG vào video: đoạn đã bỏ, và hở do gọt mép đoạn. */
app.get("/api/projects/:id/skipped", async (request) => {
  const { id } = request.params as { id: string };
  const total = (
    db
      .prepare(
        "SELECT COALESCE(SUM(duration),0) AS total FROM media_files WHERE project_id=? AND role='main'",
      )
      .get(id) as { total: number }
  ).total;
  return skippedSpans(id, total);
});

/** Bật/tắt nhấn zoom ở các chỗ nối đoạn. */
app.patch("/api/projects/:id/zoom-punch", async (request) => {
  const { id } = request.params as { id: string };
  // Nhận KIỂU chỗ nối: none | zoom-in | zoom-out | flash | dip. Vẫn nhận `on` và
  // `in`/`out` kiểu cũ cho bản đang chạy ở máy khác.
  const body = request.body as { punch?: string; on?: boolean };
  const allowed = ["none", "zoom-in", "zoom-out", "flash", "dip"];
  const value = allowed.includes(body.punch ?? "")
    ? body.punch
    : body.punch === "in"
      ? "zoom-in"
      : body.punch === "out"
        ? "zoom-out"
        : typeof body.on === "boolean"
          ? body.on
            ? "zoom-in"
            : "none"
          : null;
  if (value) {
    db.prepare("UPDATE projects SET zoom_punch=? WHERE id=?").run(value, id);
  }
  return db.prepare("SELECT zoom_punch FROM projects WHERE id=?").get(id) as {
    zoom_punch: string;
  };
});

/** Thêm một phần tử — chữ trên màn, hoặc một lần chèn tư liệu. */
app.post("/api/projects/:id/elements", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as {
    kind?: "text" | "insert";
    fromWordId?: string;
    toWordId?: string;
    content?: string;
    band?: string;
    mediaFileId?: string;
    /** Neo theo giờ — chữ tự do dùng cặp này thay cho cặp mã từ */
    start?: number;
    end?: number;
  };
  // HAI kiểu neo, phải có đúng một kiểu.
  //
  // Neo theo TỪ: chữ chép lời và tư liệu chèn — chúng thuộc về mấy tiếng cụ thể,
  // bỏ câu phía trước thì vẫn dính đúng chỗ.
  // Neo theo GIỜ: chữ tự do (tiêu đề, con số) — nó thuộc về một khoảnh khắc,
  // không chép tiếng nào, nên bắt nó chọn một câu là bịa ra quan hệ không có.
  const byWord = Boolean(body.fromWordId && body.toWordId);
  const byTime = typeof body.start === "number" && typeof body.end === "number";
  if (!body.kind || (!byWord && !byTime)) {
    return reply.code(400).send({ error: "Thiếu loại hoặc khoảng" });
  }
  if (byTime && (body.end as number) <= (body.start as number)) {
    return reply.code(400).send({ error: "Khoảng rỗng" });
  }
  // Ba mã này tới từ thân request nên cổng chặn không thấy: phải tự đối chiếu
  // chúng có thuộc đúng dự án đang sửa hay không.
  assertInProject(id, "file", body.mediaFileId);
  assertInProject(id, "word", body.fromWordId);
  assertInProject(id, "word", body.toWordId);
  const elementId = newId("e");
  db.prepare(
    `INSERT INTO elements (id, project_id, kind, from_word_id, to_word_id, start_sec, end_sec, content, position_band, media_file_id, align, emphasis, reveal, shape)
     VALUES (?,?,?,?,?,?,?,?,?,?,'center','taper','none','full')`,
  ).run(
    elementId,
    id,
    body.kind,
    byWord ? body.fromWordId : null,
    byWord ? body.toWordId : null,
    byWord ? null : body.start,
    byWord ? null : body.end,
    body.content ?? null,
    body.band ?? "top",
    body.mediaFileId ?? null,
  );
  return db.prepare("SELECT * FROM elements WHERE id=?").get(elementId);
});

/** Khối chữ ngắn hơn mức này thì đọc không kịp — cũng là sàn lúc kéo hai đầu. */
const MIN_TEXT_LENGTH = 0.4;

/**
 * Áp một KIỂU cho toàn bộ chữ chạy theo lời của dự án.
 *
 * Đo trên một dự án thật: 82% cụm giữ dáng mặc định, 88% giữ chỗ đặt, 90% giữ
 * căn ngang. Nghĩa là người dùng gần như không đổi từng cụm — họ muốn đổi PHONG
 * CÁCH của cả video. Mà bảng sửa chỉ sửa được một cụm, nên việc đó là 51 cú bấm
 * y hệt nhau.
 *
 * Chỉ áp cho chữ neo theo TỪ. Chữ tự do là tiêu đề, con số, nhãn — người dùng
 * đặt tay từng cái với ý riêng, gộp nó vào một cú "áp cho tất cả" là xoá mất
 * đúng những chỗ đã bỏ công nhất.
 */
app.patch("/api/projects/:id/elements/style", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = (request.body ?? {}) as {
    band?: string;
    align?: string;
    emphasis?: string;
  };
  const sets: string[] = [];
  const values: string[] = [];
  if (body.band) {
    sets.push("position_band=?");
    values.push(body.band);
  }
  if (body.align) {
    sets.push("align=?");
    values.push(body.align);
  }
  if (body.emphasis) {
    sets.push("emphasis=?");
    values.push(body.emphasis);
  }
  if (sets.length === 0) {
    return reply.code(400).send({ error: "Không có kiểu nào để áp" });
  }
  const result = db
    .prepare(
      `UPDATE elements SET ${sets.join(", ")}
       WHERE project_id=? AND kind='text' AND start_sec IS NULL`,
    )
    .run(...values, id);
  return { changed: result.changes };
});

app.patch("/api/elements/:elementId", async (request, reply) => {
  const { elementId } = request.params as { elementId: string };
  const body = request.body as {
    content?: string;
    band?: string;
    align?: string;
    emphasis?: string;
    reveal?: string;
    shape?: string;
    keywords?: string[];
    /** `null` = bỏ đè, quay về theo bộ dáng của dự án */
    letterCase?: string | null;
    keyColor?: string | null;
    sentenceId?: string;
    fromWordId?: string;
    toWordId?: string;
    /** Kéo hai đầu khối chữ tự do trên dải */
    start?: number;
    end?: number;
  };
  const current = db
    .prepare("SELECT * FROM elements WHERE id=?")
    .get(elementId) as
    | {
        project_id: string;
        kind: string;
        content: string | null;
        from_word_id: string;
        to_word_id: string;
      }
    | undefined;
  if (!current) return reply.code(404).send({ error: "Không có phần tử này" });

  // Ba mã neo tới từ thân request. Dự án suy ra từ chính phần tử đang sửa — cổng
  // chặn đã xác nhận phần tử đó thuộc người gọi, nên đây chỉ còn việc buộc mấy
  // mã neo phải cùng dự án với nó.
  assertInProject(current.project_id, "sentence", body.sentenceId);
  assertInProject(current.project_id, "word", body.fromWordId);
  assertInProject(current.project_id, "word", body.toWordId);

  // Kéo hai đầu khối chữ tự do. Chặn hai mép chạm nhau ở MÁY CHỦ chứ không chỉ
  // ở màn hình — màn hình có thể là bản cũ, còn đây là cửa duy nhất.
  if (typeof body.start === "number" || typeof body.end === "number") {
    const marks = db
      .prepare("SELECT start_sec, end_sec FROM elements WHERE id=?")
      .get(elementId) as { start_sec: number | null; end_sec: number | null };
    const first = body.start ?? marks.start_sec ?? 0;
    const last = body.end ?? marks.end_sec ?? 0;
    if (last - first >= MIN_TEXT_LENGTH) {
      db.prepare("UPDATE elements SET start_sec=?, end_sec=? WHERE id=?").run(
        Math.max(0, first),
        last,
        elementId,
      );
    }
  }

  if (typeof body.content === "string") {
    db.prepare("UPDATE elements SET content=? WHERE id=?").run(
      body.content,
      elementId,
    );
    // Sửa chữ ở đây thì sửa luôn LỜI CHÉP bên dưới, khi còn ghép được một-một.
    //
    // Đây là điều làm cho "sửa chữ chỉ có một chỗ" thành đúng: người dùng sửa
    // một lỗi nghe nhầm trên chữ, mà bản chép lời vẫn giữ lỗi cũ thì lần sinh
    // chữ sau hoặc hàng soát lại nói ngược. Chỉ ghép khi SỐ TIẾNG khớp — họ rút
    // gọn hay viết lại hẳn thì không còn tiếng nào ứng với tiếng nào.
    if (current.kind === "text") {
      applyTextBackToWords(
        current.project_id,
        current.from_word_id,
        current.to_word_id,
        body.content,
      );
    }
  }
  if (typeof body.band === "string") {
    db.prepare("UPDATE elements SET position_band=? WHERE id=?").run(
      body.band,
      elementId,
    );
  }
  for (const [key, value] of [
    ["align", body.align],
    ["emphasis", body.emphasis],
    ["reveal", body.reveal],
    ["shape", body.shape],
  ] as const) {
    if (typeof value === "string") {
      db.prepare(`UPDATE elements SET ${key}=? WHERE id=?`).run(
        value,
        elementId,
      );
    }
  }
  if (Array.isArray(body.keywords)) {
    db.prepare("UPDATE elements SET keywords=? WHERE id=?").run(
      body.keywords.join("|"),
      elementId,
    );
  }
  // Hai cột ĐÈ ở cấp cụm. `null` là BỎ ĐÈ, quay về theo bộ dáng của dự án —
  // nên phải phân biệt `null` với "không gửi trường này", và đó là lý do chỗ
  // này kiểm `!== undefined` chứ không kiểm giá trị có thật hay không.
  //
  // Giá trị lạ bị gạt chứ không ghi: cột này đi thẳng vào lệnh vẽ, một chuỗi
  // rác ở đây thành một màu ffmpeg không đọc được và cả lượt xuất video hỏng.
  if (body.letterCase !== undefined) {
    const next =
      body.letterCase === "upper" || body.letterCase === "as-typed"
        ? body.letterCase
        : null;
    db.prepare("UPDATE elements SET letter_case=? WHERE id=?").run(
      next,
      elementId,
    );
  }
  if (body.keyColor !== undefined) {
    const next = KEY_COLORS.some((item) => item.value === body.keyColor)
      ? body.keyColor
      : null;
    db.prepare("UPDATE elements SET key_color=? WHERE id=?").run(
      next,
      elementId,
    );
  }
  // Kéo mép: neo lại vào TỪ khác. Mép b-roll bám ranh giới từ chứ không bám
  // giây — cùng lý do với mọi thứ khác trên bàn dựng (đặc tả §1): cắt bỏ một
  // câu phía trước thì nó vẫn dính đúng chỗ mà không phải tính lại mốc.
  for (const [cot, giaTri] of [
    ["from_word_id", body.fromWordId],
    ["to_word_id", body.toWordId],
  ] as const) {
    if (typeof giaTri !== "string") continue;
    const exists = db.prepare("SELECT 1 FROM words WHERE id=?").get(giaTri);
    if (exists) {
      db.prepare(`UPDATE elements SET ${cot}=? WHERE id=?`).run(
        giaTri,
        elementId,
      );
    }
  }
  // Dời sang câu khác: neo lại vào khoảng từ của câu đó, giữ nguyên mọi kiểu.
  if (body.sentenceId) {
    const words = db
      .prepare("SELECT id FROM words WHERE sentence_id=? ORDER BY position")
      .all(body.sentenceId) as Array<{ id: string }>;
    if (words.length > 0) {
      db.prepare(
        "UPDATE elements SET from_word_id=?, to_word_id=? WHERE id=?",
      ).run(words[0].id, words[words.length - 1].id, elementId);
    }
  }
  return db.prepare("SELECT * FROM elements WHERE id=?").get(elementId);
});

app.delete("/api/elements/:elementId", async (request) => {
  const { elementId } = request.params as { elementId: string };
  db.prepare("DELETE FROM elements WHERE id=?").run(elementId);
  return { ok: true };
});

/**
 * Lấp chữ cho một câu đang trống.
 *
 * Không còn nút "tạo chữ" toàn dự án: chữ đã tự có từ lúc chép lời. Cửa này chỉ
 * dùng khi người dùng xoá hết chữ của một câu rồi muốn lấy lại — hỏi ngay tại
 * câu đó, không phải một cái nút toàn cục làm cả video mọc chữ.
 */
app.post("/api/projects/:id/captions", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = (request.body ?? {}) as { sentenceId?: string };
  // Mã câu tới từ thân request — cổng chặn không thấy nó.
  assertInProject(id, "sentence", body.sentenceId);
  const sentence = body.sentenceId
    ? (db
        .prepare("SELECT start_sec, end_sec FROM sentences WHERE id=?")
        .get(body.sentenceId) as
        { start_sec: number; end_sec: number } | undefined)
    : undefined;
  if (body.sentenceId && !sentence) {
    return reply.code(404).send({ error: "Không có câu này" });
  }
  const band = ((
    db.prepare("SELECT subtitle_band FROM projects WHERE id=?").get(id) as
      { subtitle_band: string | null } | undefined
  )?.subtitle_band ?? "bottom") as Band;
  const created = await createCaptionElements(
    id,
    band,
    readStylePack(id),
    sentence ? { start: sentence.start_sec, end: sentence.end_sec } : undefined,
  );
  return { created };
});

/**
 * Dựng lại dải ảnh cho dự án đã có.
 *
 * Cần vì dải ảnh chỉ dựng một lần ở bước chép lời: dự án tạo trước khi dải ảnh
 * biết cách dựng bản 2× thì mãi mãi giữ bản mờ, mà bắt người dùng chép lời lại
 * (mất vài phút và mất luôn lời đã sửa tay) chỉ để có ảnh nét là quá đắt.
 */
/**
 * Đường bao âm lượng để vẽ dải sóng trên bàn dựng.
 *
 * Dựng lại tại chỗ nếu chưa có: dự án chép lời bằng bản cũ không có tệp này, mà
 * bắt người dùng chép lại (mất vài phút và mất lời đã sửa tay) chỉ để thấy dải
 * sóng là quá đắt.
 */
app.get("/api/projects/:id/envelope", async (request, reply) => {
  const { id } = request.params as { id: string };
  const san = await readEnvelope(id);
  if (san) return san;
  const audio = join(workDir(id), "audio.wav");
  if (!existsSync(audio)) {
    return reply.code(404).send({ error: "Chưa tách tiếng" });
  }
  return buildEnvelope(id, audio);
});

app.post("/api/projects/:id/filmstrip", async (request, reply) => {
  const { id } = request.params as { id: string };
  const base = join(workDir(id), "base.mp4");
  if (!existsSync(base)) {
    return reply.code(409).send({ error: "Chưa ghép video chính" });
  }
  const info = await probe(base);
  const strip = await makeFilmstrip(
    base,
    join(thumbDir(id), "strip.jpg"),
    info.duration,
  );
  db.prepare(
    "UPDATE projects SET strip_second_width=?, strip_seconds=?, strip_native_second_width=? WHERE id=?",
  ).run(strip.secondWidth, strip.totalSeconds, strip.nativeSecondWidth, id);
  return {
    secondWidth: strip.secondWidth,
    seconds: strip.totalSeconds,
    nativeSecondWidth: strip.nativeSecondWidth,
  };
});

/**
 * Chạy một việc nền và ghi trạng thái vào bảng jobs.
 *
 * Không `await`: người dùng phải nhận được câu trả lời ngay rồi hỏi tiến độ sau,
 * chứ không treo kết nối vài phút cho tới lúc ffmpeg xong.
 */
/**
 * Chạy một việc nặng, và CHỈ MỘT lượt cho mỗi loại mỗi dự án.
 *
 * Không chặn thì bấm "Xuất video" hai lần là hai luồng ffmpeg cùng ghi vào một
 * tệp `final.mp4` — tệp ra hỏng, mà bảng việc chỉ có một hàng nên không ai biết
 * có hai luồng. Bấm đúp là chuyện thường, nhất là khi lượt đầu chưa kịp đổi nhãn
 * nút. Chép lời cũng vậy: hai luồng cùng xoá và dựng lại bảng từ.
 *
 * Trả `false` khi đang bận để nơi gọi còn nói cho người dùng biết.
 */
/**
 * Việc coi như CHẾT nếu quá lâu không nhích tiến độ.
 *
 * Cái chốt "một lượt mỗi loại" chỉ đúng khi biết được việc còn sống. Việc chạy
 * trong tiến trình máy chủ, nên nó chết cùng lúc với ffmpeg bị giết, với máy chủ
 * khởi động lại, với một ngoại lệ không ai bắt. Hàng trong bảng thì vẫn ghi
 * `running` mãi mãi — và cái chốt biến một trục trặc nhất thời thành một cái
 * khoá không mở được. Gặp thật ngay khi vừa thêm chốt: một lượt xuất chết 939
 * giây trước khoá mọi lượt xuất sau.
 */
const JOB_STALE_MS = 3 * 60_000;

function startJob(
  projectId: string,
  kind: string,
  run: () => Promise<unknown>,
) {
  const running = db
    .prepare(
      "SELECT status, updated_at FROM jobs WHERE project_id=? AND kind=? AND status='running'",
    )
    .get(projectId, kind) as { status: string; updated_at: number } | undefined;
  if (running && Date.now() - running.updated_at < JOB_STALE_MS) return false;

  setJob(projectId, kind, "running", 0, "Đang xếp hàng");
  void run().catch((error: Error) => {
    setJob(projectId, kind, "error", 0, error.message.slice(0, 300));
    // Đánh hỏng luôn chặng đang chạy, không thì màn chờ để nó quay mãi: người
    // dùng ngồi nhìn một con quay của việc đã chết từ lâu.
    failRunningStep(projectId, error.message.slice(0, 200));
  });
  return true;
}

app.post("/api/projects/:id/transcribe", async (request, reply) => {
  const { id } = request.params as { id: string };
  if (!startJob(id, "transcribe", () => runTranscribe(id))) {
    return reply.code(409).send({ error: "Đang chép lời rồi" });
  }
  return reply.code(202).send({ status: "running" });
});

/**
 * Chạy lại từ một chặng.
 *
 * Dùng chung ngăn việc `transcribe`: chạy lại một chặng giữa lúc cả mạch đang chạy
 * thì hai bên ghi lên cùng một bảng chặng và kết quả đọc ra lộn xộn.
 */
app.post("/api/projects/:id/steps/:key/retry", async (request, reply) => {
  const { id, key } = request.params as { id: string; key: string };
  if (
    !startJob(id, "transcribe", async () => {
      // Chặng đầu (`prepare`, `transcribe`, `captions`) không chạy lẻ được — chúng
      // đẻ ra dữ liệu mà mọi chặng sau dựa vào. Nhưng nút Thử lại VẪN hiện ở đó, và
      // trước đây bấm vào chỉ nhận 400 rồi chẳng gì xảy ra: một cái nút chết ở đúng
      // chỗ người dùng đang bị chặn. Dựng lại cả mạch là đường duy nhất còn lại, và
      // lúc ấy không mất gì của người dùng — bàn dựng vẫn đang khoá vì chặng bắt
      // buộc đang hỏng.
      if (await retryAiStep(id, key)) {
        // ĐÓNG việc lại. `startJob` chỉ mở nó ra; chặng `transcribe` bình thường tự
        // gọi `setJob(..., "done")` ở cuối, còn phép chạy lẻ này thì không — và việc
        // treo ở "running" chặn mọi lượt `startJob` sau đó bằng 409, kể cả nút Thử
        // lại lần hai và cả lượt xuất video. Đo thật: chặng chạy xong từ lâu mà việc
        // vẫn "running · Đang xếp hàng".
        setJob(id, "transcribe", "done", 100, "Xong");
        return;
      }
      await runTranscribe(id);
    })
  ) {
    return reply.code(409).send({ error: "Đang có việc chạy rồi" });
  }
  return reply.code(202).send({ status: "running" });
});

app.post("/api/projects/:id/export", async (request, reply) => {
  const { id } = request.params as { id: string };
  if (!startJob(id, "export", () => runExport(id))) {
    return reply.code(409).send({ error: "Đang xuất video rồi" });
  }
  return reply.code(202).send({ status: "running" });
});

app.get("/api/projects/:id/jobs/:kind", async (request, reply) => {
  const { id, kind } = request.params as { id: string; kind: string };
  const job = db
    .prepare("SELECT * FROM jobs WHERE project_id=? AND kind=?")
    .get(id, kind);
  if (!job) return reply.code(404).send({ error: "Chưa chạy việc này" });
  return job;
});

/**
 * Trả bản build của trang — CHỈ khi `dist/` có thật.
 *
 * Lúc chạy thật đây là cách duy nhất trang tới được người dùng: không có Vite
 * nào trên máy chủ, nên thiếu khối này thì tên miền trả về rỗng. Và vì trang và
 * API cùng một gốc, cookie phiên đi kèm mọi request mà không cần CORS.
 *
 * Lúc phát triển thì `dist/` thường là bản cũ. Không sao: trình duyệt đứng ở
 * Vite (5173), còn Fastify (5190) chỉ nhận request đã qua chuyển tiếp — nên bản
 * cũ ở đây không ai nhìn thấy. Vẫn kiểm `existsSync` để máy chưa build lần nào
 * cũng khởi động được.
 *
 * `decorateReply: false`: `@fastify/static` chỉ được gắn `reply.sendFile` MỘT
 * lần cho cả thực thể, mà lần gắn ở `/files/` phía trên đã dùng chỗ đó.
 */
const WEB_ROOT = join(PROJECT_ROOT, "dist");
const hasWebBuild = existsSync(join(WEB_ROOT, "index.html"));

if (hasWebBuild) {
  await app.register(fastifyStatic, {
    root: WEB_ROOT,
    prefix: "/",
    decorateReply: false,
    // Tắt wildcard để đường dẫn không khớp tệp nào rơi xuống `setNotFoundHandler`
    // bên dưới, thay vì `@fastify/static` tự trả 404 và chặn mất bước đó.
    wildcard: false,
  });

  /**
   * Mọi đường dẫn lạ đều trả `index.html` để React Router tự xử.
   *
   * Cần vì đường dẫn nằm bên trong trang: mở thẳng `/editor/prj_abc` hay bấm tải
   * lại ở đó thì máy chủ được hỏi trước React, mà máy chủ không có tệp nào tên
   * vậy — không có nhánh này thì tải lại trang giữa lúc đang dựng là ra 404.
   *
   * `/api/` và `/files/` KHÔNG rơi vào đây: chúng phải trả 404 thật. Trả HTML cho
   * một lời gọi API là biến "không có dữ liệu này" thành một lỗi phân tích JSON ở
   * phía trình duyệt, và chỗ báo lỗi khi đó chỉ vào đúng dòng vô can.
   */
  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split("?")[0];
    if (path.startsWith("/api/") || path.startsWith("/files/")) {
      return reply.code(404).send({ error: "Không tìm thấy" });
    }
    return reply
      .type("text/html")
      .send(createReadStream(join(WEB_ROOT, "index.html")));
  });
}

const port = Number(process.env.PORT ?? 5190);
/**
 * Chỉ nghe trên máy nội bộ. Lúc chạy thật thì Caddy/nginx đứng trước và nói
 * chuyện với cổng này; mở ra `0.0.0.0` là phơi thẳng cổng chưa có HTTPS ra
 * internet, mà cookie phiên đi qua đường không mã hoá thì ai chặn được đường
 * truyền cũng đọc được nó.
 */
await app.listen({ port, host: "127.0.0.1" });
app.log.info(
  `API chạy ở http://127.0.0.1:${port}` +
    (hasWebBuild ? " (kèm bản build của trang)" : " (chưa có dist/, chỉ API)"),
);
export { app };
