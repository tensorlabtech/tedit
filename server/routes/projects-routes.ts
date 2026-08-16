import type { FastifyInstance } from "fastify";
import { normalizeJunction } from "../junction-kinds";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { db, newId } from "../db";
import {
  ensureProjectDirs,
  projectDir,
  workDir,
} from "../paths";
import {
  absorbLegacyMusic,
  listMusic,
} from "../music-tracks";
import {
  copyIntoProject,
  kindOf,
} from "../asset-library";
import { pipelineState } from "../pipeline-steps";
import { readSettings } from "../settings";
import { seedSegmentsByCaption } from "../segment-seed";
import {
  absorbManualCuts,
  listSegments,
  extendToDuration,
} from "../segments";
import {
  createCaptionElements,
  hasUserRewrittenCaptions,
  rechunkCaptions,
  splitVerbatimCaptions,
} from "../caption-elements";
import { hasModel } from "../llm";
import { DEFAULT_STYLE_PACK_ID, STYLE_PACKS } from "../style-pack-catalog";
import { readStylePack } from "../style-pack-store";
import { type Band } from "../text-layout";

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

export default async function projectsRoutes(app: FastifyInstance) {
app.post("/api/projects", async (request) => {
  const body = (request.body ?? {}) as { title?: string };
  const id = newId("prj");
  ensureProjectDirs(id);
  // Dự án mới thừa hưởng CÀI ĐẶT của người tạo. Chép vào dự án chứ không đọc lúc
  // dựng là có chủ ý: đổi cài đặt về sau thì dự án cũ giữ nguyên thứ nó đã dựng,
  // chỉ dự án mới mới theo số mới.
  const setting = readSettings(request.viewer!.id);
  db.prepare(
    // `style_pack` set TƯỜNG MINH: cột này có `DEFAULT 'goc'` (bộ nay đã xoá), nên
    // không set thì dự án MỚI cũng dính bộ cũ không-bố-cục. Lấy bộ mặc định hiện
    // hành từ catalog để một chỗ đổi là mọi dự án mới theo.
    `INSERT INTO projects (id, title, status, created_at, owner_id, profile, min_silence, want_captions, want_music, style_pack)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    body.title?.trim() || "Dự án mới",
    "draft",
    Date.now(),
    request.viewer!.id,
    // ĐỀ BÀI của RIÊNG dự án — bắt đầu RỖNG, người dùng nhập ở bước "Đề bài".
    //
    // KHÔNG seed hồ sơ user-level vào đây: `projects.profile` là mốc "đã qua bước
    // Đề bài" của luồng (`hasBrief`), seed sẵn là luồng tưởng đã nhập đề bài rồi
    // và nhảy qua bước "Cảnh phụ". Hồ sơ chung (onboarding) bơm vào prompt ở
    // `ai-context`/`asr-bias` lúc chạy, không đi qua cột này.
    "",
    setting.minSilence,
    setting.wantCaptions ? 1 : 0,
    setting.wantMusic ? 1 : 0,
    DEFAULT_STYLE_PACK_ID,
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
    stylePack?: string;
    fontStyle?: string | null;
    headline?: string;
  };
  const sets: string[] = [];
  const values: Array<string | number | null> = [];

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
  // DÒNG TIÊU ĐỀ. Chuỗi rỗng là XOÁ — khác `title` (tên dự án), nơi rỗng phải
  // rơi về một tên mặc định: một dự án luôn cần tên để gọi, còn tiêu đề thì
  // không có mới là mặc định.
  //
  // Trần 200 ký tự ở đây rộng hơn trần 80 lúc VẼ (`HEADLINE_MAX_CHARS`), và cố
  // ý: chữ người dùng gõ vào là của họ, phần gọt chỉ thuộc về lúc vẽ. Gọt lúc
  // lưu thì họ gõ dài rồi xoá bớt cũng không lấy lại được.
  if (body.headline !== undefined) {
    sets.push("headline=?");
    values.push(body.headline.trim().slice(0, 200));
  }
  if (body.stylePack !== undefined) {
    const pack = STYLE_PACKS.find((item) => item.id === body.stylePack);
    if (!pack) {
      return reply.code(400).send({ error: "Không có bộ dáng này" });
    }
    sets.push("style_pack=?");
    values.push(body.stylePack);
    // NGƯỠNG LẶNG ĐI THEO PHONG CÁCH.
    //
    // Mỗi bộ khai `intensity.minSilence` (bộ mạnh 0,5s — cắt sát; bộ êm 1,2s —
    // giữ nhịp thở), nhưng `auto-trim-silence` vốn đọc `projects.min_silence` mà
    // không ai ghi từ bộ vào — nên trục ấy CHẾT, mọi phong cách cắt lặng như
    // nhau. Chọn bộ là ghi ngưỡng của nó, đúng ý "cắt đi theo phong cách".
    //
    // Không đụng khi người dùng đã tự chỉnh tay: ở luồng này chưa có ô chỉnh
    // `min_silence` riêng, nên chọn bộ là nguồn DUY NHẤT của ngưỡng — an toàn.
    sets.push("min_silence=?");
    values.push(pack.intensity.minSilence);
  }
  // PHONG CÁCH CHỮ mặc định cả video. `null` là XOÁ đè (theo font của bộ chính);
  // một tên thì phải có trong danh sách — nhận rồi rơi lặng thì màn báo "đã lưu"
  // mà CSDL giữ thứ khác. KHÔNG kéo `min_silence` như `stylePack`: đây chỉ đổi
  // chữ, nhịp cắt giữ nguyên.
  if (body.fontStyle !== undefined) {
    if (body.fontStyle !== null && !STYLE_PACKS.some((item) => item.id === body.fontStyle)) {
      return reply.code(400).send({ error: "Không có phong cách chữ này" });
    }
    sets.push("font_style=?");
    values.push(body.fontStyle);
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
      "SELECT id, title, profile, min_silence, want_captions, want_music, insert_source, style_pack, font_style, headline FROM projects WHERE id=?",
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

app.get("/api/projects/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const project = db.prepare("SELECT * FROM projects WHERE id=?").get(id);
  if (!project) return reply.code(404).send({ error: "Không có dự án này" });

  // Độ dài video HIỆN TẠI. Đọc `video_seconds` (đo từ tệp, đúng cả sau khi cắt);
  // dự án cũ chưa có cột này thì rơi về tổng các tệp cảnh — đúng, vì chúng chưa
  // cắt nên cộng lại đúng bằng video. Sau `commit-cut` thì hai con số lệch hẳn
  // (52s vs 118s), và mọi chỗ "video dài bao nhiêu" phải theo con số đo từ tệp.
  const videoSeconds =
    (project as { video_seconds: number | null }).video_seconds ??
    (
      db
        .prepare(
          "SELECT COALESCE(SUM(duration),0) AS total FROM media_files WHERE project_id=? AND role='main'",
        )
        .get(id) as { total: number }
    ).total;

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
  extendToDuration(id, videoSeconds);
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
  // TỰ CỨU cụm vỡ-lúc-gieo: `captions_llm_ok=0` nghĩa là chia cụm bằng heuristic
  // (gọi mô hình HỎNG lúc gieo, hoặc gieo lúc chưa có khoá). Có khoá + máy rảnh +
  // người dùng CHƯA viết lại chữ cụm nào → chia lại MỘT LẦN. Cờ lật 1 sau đó nên
  // GET gọi bao nhiêu lần cũng chỉ chạy một lần. Chỉ chặn theo VIẾT-LẠI-CHỮ (cái
  // chia lại làm mất thật); nhấn được re-map giữ, chỗ-đặt máy đặt lại được.
  const chunkState = db
    .prepare(
      "SELECT captions_llm_ok, captions_auto_healed FROM projects WHERE id=?",
    )
    .get(id) as
    | { captions_llm_ok: number | null; captions_auto_healed: number | null }
    | undefined;
  if (
    idle &&
    hasModel() &&
    seeded?.captions_seeded &&
    !chunkState?.captions_llm_ok &&
    !chunkState?.captions_auto_healed &&
    wordCount.n > 0 &&
    !hasUserRewrittenCaptions(id)
  ) {
    // Đánh dấu ĐÃ THỬ ngay, TRƯỚC khi chia lại: nếu chia lại hỏng (mô hình lỗi →
    // llm_ok vẫn 0) thì cờ này vẫn chặn GET sau tự-cứu lại — không gọi mô hình vô hạn.
    db.prepare("UPDATE projects SET captions_auto_healed=1 WHERE id=?").run(id);
    // Bọc lỗi: tự-cứu là việc PHỤ ở một đường ĐỌC. Nó hỏng thì cứ trả dự án như
    // thường, đừng để cả GET thành 500 và trang không mở được. `rechunkCaptions`
    // đã nguyên-tử (throw thì cụm cũ còn nguyên); ở đây chỉ cần nuốt để GET sống.
    try {
      await rechunkCaptions(
        id,
        (seeded?.subtitle_band ?? "bottom") as Band,
        readStylePack(id),
      );
      // Ép dựng lại đoạn theo cụm MỚI: khối dưới đọc `segments_by_caption` < 4 thì chạy.
      db.prepare("UPDATE projects SET segments_by_caption=0 WHERE id=?").run(id);
    } catch (error) {
      console.warn(
        `[auto-rechunk] ${id} hỏng: ${(error as Error)?.message ?? error}`,
      );
    }
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
    await seedSegmentsByCaption(id, videoSeconds, readStylePack(id));
    db.prepare("UPDATE projects SET segments_by_caption=4 WHERE id=?").run(id);
  }

  return {
    project,
    /**
     * Bản CHẤT LƯỢNG đã dựng xong chưa — thứ `cutRanges` cần lúc xuất video.
     *
     * Nó dựng NỀN sau lượt chép lời, nên có một quãng bàn dựng mở được mà xuất
     * thì chưa. Nói ra để nút Xuất video mờ đi kèm lý do: cho bấm rồi im lặng
     * chờ chính là kiểu hỏng mà cả dự án này đang đi chữa.
     *
     * Đọc bằng `existsSync` chứ không hỏi bảng `jobs`: tệp có mặt mới là sự thật,
     * còn hàng việc thì có thể chết giữa chừng mà không ai xoá dòng của nó.
     */
    masterReady: existsSync(join(workDir(id), "base.mp4")),
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

/**
 * Ba câu mở gợi ý cho "3 giây đầu".
 *
 * `POST` chứ không `GET`: nó gọi mô hình ngôn ngữ, tức là tốn tiền thật mỗi lần.
 * Một đường `GET` mời trình duyệt và mọi lớp đệm ở giữa gọi lại nó bất cứ lúc
 * nào — mà ở đây gọi lại nghĩa là trả tiền lại.
 */
/**
 * CHIA LẠI cụm phụ đề — dựng lại ranh cụm bằng bộ chunk mô hình, giữ chữ+mốc+nhấn.
 *
 * `force` để chấp nhận mất chỗ-đặt per-cụm khi có cụm đã VIẾT LẠI CHỮ (nút tay
 * hỏi xác nhận rồi mới gửi `force`). Không force mà có viết-lại → trả 409 để UI
 * hỏi. Sau khi chia lại, ép dựng lại đoạn ở GET kế bằng cách hạ `segments_by_caption`.
 */
app.post("/api/projects/:id/rechunk", async (request, reply) => {
  const { id } = request.params as { id: string };
  const force = (request.body as { force?: boolean } | undefined)?.force === true;
  if (!hasModel())
    return reply.code(400).send({ error: "chưa có khoá mô hình" });
  const rewritten = hasUserRewrittenCaptions(id);
  if (rewritten && !force)
    return reply.code(409).send({ needsConfirm: true, reason: "rewritten" });
  const band =
    (
      db.prepare("SELECT subtitle_band FROM projects WHERE id=?").get(id) as
        | { subtitle_band: string | null }
        | undefined
    )?.subtitle_band ?? "bottom";
  const count = await rechunkCaptions(id, band as Band, readStylePack(id));
  db.prepare("UPDATE projects SET segments_by_caption=0 WHERE id=?").run(id);
  return { count, rewritten };
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
}
