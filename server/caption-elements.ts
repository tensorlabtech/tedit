import { arrangementFor } from "./caption-arrangement";
import { buildCaptionGroups, type CaptionGroup } from "./caption-groups";
import { db, newId } from "./db";
import type { StylePack } from "./style-pack";
import type { Band } from "./text-layout";

/**
 * Chèn các cụm thành phần tử chữ — phần ĐỒNG BỘ, KHÔNG tự bọc transaction (nơi
 * gọi bọc). Bỏ qua cụm trùng khoảng đã có chữ (`taken`); `taken` rỗng nghĩa là
 * chèn tất. Tách ra để `rechunkCaptions` xoá-rồi-chèn được TRONG MỘT transaction
 * (dựng lại từ lời máy sau khi đã tính cụm xong ở ngoài — không có `await` xen
 * giữa xoá và chèn nên không có cửa sổ "không cụm nào" và throng thì cuộn lại hết).
 */
function insertCaptionGroups(
  projectId: string,
  band: Band,
  groups: readonly CaptionGroup[],
  pack: StylePack,
  taken: ReadonlyArray<{ start: number; end: number }>,
): string[] {
  // KHÔNG ghi vào cột `elements.layout`: nó là di sản đã chết (`db.ts`,
  // `text-layout.ts:337`), đã bị thay bằng `align` + `emphasis`. Sửa câu INSERT
  // này mà tiện tay ghi vào nó là làm sống lại một mô hình đã bỏ.
  const insert = db.prepare(
    `INSERT INTO elements (id, project_id, kind, from_word_id, to_word_id, content, position_band, align, emphasis, reveal, shape)
     VALUES (?,?,'text',?,?,?,?,?,?,?,'full')`,
  );
  const created: string[] = [];
  for (const group of groups) {
    if (taken.some((span) => group.start < span.end && group.end > span.start))
      continue;
    const id = newId("e");
    // Bố cục theo BỘ CÔNG THỨC của bộ dáng (rải ngang + cỡ, ổn định theo câu);
    // bộ nào không có công thức thì rơi về `defaults`.
    const recipe = arrangementFor(pack.id, group.words[0].id);
    insert.run(
      id,
      projectId,
      group.words[0].id,
      group.words[group.words.length - 1].id,
      group.text,
      band,
      recipe?.align ?? pack.defaults.align,
      recipe?.emphasis ?? pack.defaults.emphasis,
      pack.defaults.reveal,
    );
    created.push(id);
  }
  return created;
}

/**
 * Đổi lời nói thành CHỮ TRÊN MÀN — những phần tử thật, sửa và xoá được.
 *
 * Trước đây đây là "phụ đề": một cờ bật/tắt cho cả dự án, dựng lại lúc xuất và
 * không lưu gì. Hệ quả là bàn dựng có hai khái niệm cho cùng một thứ hiện trên
 * khung hình — người dùng không sửa được một cụm phụ đề, không thấy nó trên
 * dải, và "Thêm chữ" thì tạo ra một thứ trông y hệt nhưng lại thuộc loại khác.
 *
 * Giờ chỉ còn MỘT khái niệm. Máy chia cụm giúp, còn lại là chữ của người dùng:
 * giữ, sửa, đổi kiểu hay xoá là quyền của họ.
 *
 * Cái mất: chữ đã tạo không tự đổi theo khi sửa lời chép nữa. Bù lại bằng
 * `refreshCaptionsAfterWordEdit` — chữ nào còn y nguyên như lúc máy sinh ra thì
 * tự cập nhật, chữ nào người dùng đã sửa thì không đụng vào.
 */
export async function createCaptionElements(
  projectId: string,
  band: Band,
  /**
   * Bộ dáng của dự án. Đọc ở ĐÂY — lúc SINH chữ — chứ không đọc lúc render:
   * `defaults` là thứ duy nhất của bộ dáng đi vào bảng `elements`, nên nó phải
   * được ghi một lần rồi thôi. Đọc lại lúc render là đổi bộ dáng sẽ ghi đè bố
   * cục người dùng đã chỉnh tay.
   *
   * BẮT BUỘC truyền, và đứng TRƯỚC `only`: để nó ở cuối với một giá trị mặc
   * định thì nơi nào quên truyền sẽ sinh chữ theo bộ gốc mà không báo gì.
   */
  pack: StylePack,
  /** Chỉ sinh trong khoảng này — dùng khi lấp chữ cho riêng một câu. */
  only?: { start: number; end: number },
) {
  const { groups: all, llmOk } = await buildCaptionGroups(projectId, band, pack);
  const groups = only
    ? all.filter((group) => group.start < only.end && group.end > only.start)
    : all;
  if (groups.length === 0) return [];

  // Khoảng thời gian đã có chữ rồi thì KHÔNG chèn thêm: bấm nút lần nữa là để
  // lấp chỗ trống, không phải để đè lên thứ mình vừa đặt tay. Nhờ vậy nút này
  // bấm bao nhiêu lần cũng an toàn.
  const taken = db
    .prepare(
      `SELECT wf.start_sec AS start, wt.end_sec AS end
       FROM elements e
       JOIN words wf ON wf.id = e.from_word_id
       JOIN words wt ON wt.id = e.to_word_id
       WHERE e.project_id = ? AND e.kind = 'text'`,
    )
    .all(projectId) as Array<{ start: number; end: number }>;

  // Mặc định `dan-nho` (Dẫn nhỏ · ý to), KHÔNG phải `deu`.
  //
  // Đo video tham khảo (`examples/`): dòng dẫn cao 4,0% khung, dòng ý cao 6,5% —
  // chênh 1,6 lần. Chính cái chênh đó ép hai dòng cài răng lược vào nhau và làm
  // nên dáng "khối gạch"; bước dòng của họ vẫn ≈1,06 lần cỡ chữ, không hề dưới 1.
  // Cỡ đều nhau thì ba dòng cùng khổ, đọc ra phụ đề chứ không ra thiết kế.
  //
  // Đây là chỗ quyết định dáng của CẢ dự án: mọi chữ đều sinh ra từ đây, và
  // không ai đi đổi tay năm chục lần.
  //
  // Bốn giá trị dưới đây đến từ `pack.defaults`, không viết cứng nữa. Cả năm bộ
  // dáng khai `defaults` GIỐNG HỆT NHAU, nên đổi bộ dáng không đụng một hàng
  // `elements` nào — xem `SHARED_DEFAULTS` ở `style-pack-catalog.ts`.
  //
  const created: string[] = [];
  db.transaction(() => {
    created.push(...insertCaptionGroups(projectId, band, groups, pack, taken));
  })();
  // Ghi cờ nguồn-gốc CHỈ khi dựng ĐẦY ĐỦ (không phải lấp riêng một câu `only`):
  // cờ là cấp-dự-án, phản ánh chất lượng chia cụm cả bản. Lấp một câu không được
  // đụng vào phán quyết của cả bản.
  if (!only) {
    db.prepare("UPDATE projects SET captions_llm_ok=? WHERE id=?").run(
      llmOk ? 1 : 0,
      projectId,
    );
  }
  return created;
}

/**
 * Chẻ chữ dài thành cụm — CHỈ khi nội dung còn đúng bằng lời nó phủ.
 *
 * Luật của bàn dựng là "một đoạn, một chữ". Chữ chép nguyên lời mà dài hơn một
 * cụm thì chẻ ra là xong, không mất gì: "Mình muốn ghi lại dấu mốc ngày hôm nay"
 * thành "Mình muốn ghi lại" + "dấu mốc ngày hôm nay", vẫn đúng từng tiếng.
 *
 * Chữ ĐÃ VIẾT LẠI thì không đụng tới. "Nhưng năm nay thì khác" chỉ năm chữ mà
 * phủ mười bốn tiếng nói — chẻ nó thành bốn phần là phải bịa ra chữ cho ba phần
 * còn lại, hoặc thay lời người ta viết bằng lời máy chép. Với những cái đó thì
 * làm ngược lại: gộp đoạn cho vừa chữ (xem `gopChoVuaChu` ở `segment-seed.ts`).
 *
 * Giữ nguyên kiểu dáng cho từng mảnh: người dùng đã chọn dải, căn, nhấn, từ
 * khoá cho khối gốc thì các mảnh phải thừa hưởng, không thì chẻ xong là mất dáng.
 */
export async function splitVerbatimCaptions(
  projectId: string,
  pack: StylePack,
) {
  const { groups } = await buildCaptionGroups(projectId, "bottom", pack);
  if (groups.length === 0) return 0;

  const words = db
    .prepare("SELECT id, text FROM words WHERE project_id=? ORDER BY start_sec")
    .all(projectId) as Array<{ id: string; text: string }>;
  const wordIndex = new Map(words.map((word, index) => [word.id, index]));

  const rows = db
    .prepare(`SELECT * FROM elements WHERE project_id=? AND kind='text'`)
    .all(projectId) as Array<Record<string, unknown>>;

  const insert = db.prepare(
    `INSERT INTO elements (id, project_id, kind, from_word_id, to_word_id, content, position_band, align, emphasis, reveal, shape, keywords)
     VALUES (?,?,'text',?,?,?,?,?,?,?,?,?)`,
  );
  const removeElement = db.prepare("DELETE FROM elements WHERE id=?");

  let rebuilt = 0;
  db.transaction(() => {
    for (const row of rows) {
      const from = wordIndex.get(String(row.from_word_id));
      const to = wordIndex.get(String(row.to_word_id));
      if (from === undefined || to === undefined || to <= from) continue;
      const joined = words
        .slice(from, to + 1)
        .map((word) => word.text)
        .join(" ");
      if (joined !== row.content) continue;

      const inside = groups.filter((group) => {
        const a = wordIndex.get(group.words[0].id);
        const b = wordIndex.get(group.words[group.words.length - 1].id);
        return a !== undefined && b !== undefined && a >= from && b <= to;
      });
      if (inside.length < 2) continue;

      removeElement.run(row.id);
      for (const group of inside) {
        insert.run(
          newId("e"),
          projectId,
          group.words[0].id,
          group.words[group.words.length - 1].id,
          group.text,
          row.position_band ?? "bottom",
          row.align ?? "center",
          row.emphasis ?? "even",
          row.reveal ?? "none",
          row.shape ?? "full",
          row.keywords ?? null,
        );
      }
      rebuilt += inside.length;
    }
  })();
  return rebuilt;
}

/**
 * Sửa chữ trên màn → sửa luôn LỜI CHÉP bên dưới, khi còn ghép được một-một.
 *
 * Chiều ngược của `refreshCaptionsAfterWordEdit`. Hai chiều cộng lại thành lời
 * hứa "sửa chữ chỉ có một chỗ": sửa ở đâu cũng được, hai bên không lệch nhau.
 *
 * Chỉ ghép khi SỐ TIẾNG khớp. Sửa một lỗi nghe nhầm thì số tiếng giữ nguyên —
 * đó chính là trường hợp cần đồng bộ. Rút gọn hay viết lại hẳn thì không còn
 * tiếng nào ứng với tiếng nào, và lời chép phải giữ đúng thứ người ta đã NÓI.
 */
export function applyTextBackToWords(
  projectId: string,
  fromWordId: string,
  toWordId: string,
  content: string,
) {
  const words = db
    .prepare(
      "SELECT id, text, sentence_id FROM words WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Array<{
    id: string;
    text: string;
    sentence_id: string;
  }>;
  const wordIndex = new Map(words.map((word, index) => [word.id, index]));
  const from = wordIndex.get(fromWordId);
  const to = wordIndex.get(toWordId);
  if (from === undefined || to === undefined || to < from) return 0;

  const nextTexts = content.trim().split(/\s+/).filter(Boolean);
  const inside = words.slice(from, to + 1);
  if (nextTexts.length !== inside.length) return 0;

  const update = db.prepare("UPDATE words SET text=?, confidence=1 WHERE id=?");
  const sentencesToRebuild = new Set<string>();
  let changed = 0;
  db.transaction(() => {
    for (const [index, word] of inside.entries()) {
      if (word.text === nextTexts[index]) continue;
      update.run(nextTexts[index], word.id);
      sentencesToRebuild.add(word.sentence_id);
      changed += 1;
    }
    // Lời của CÂU dựng lại từ bảng từ: hai nguồn lệch nhau thì bản chép lời
    // hiện một đằng mà chữ trên màn một nẻo.
    for (const sentenceId of sentencesToRebuild) {
      const sentence = db
        .prepare("SELECT text FROM words WHERE sentence_id=? ORDER BY position")
        .all(sentenceId) as Array<{ text: string }>;
      db.prepare("UPDATE sentences SET text=? WHERE id=?").run(
        sentence.map((item) => item.text).join(" "),
        sentenceId,
      );
    }
  })();
  return changed;
}

/**
 * Sửa một từ trong lời → sửa luôn những chữ trên màn CHƯA ai đụng tới.
 *
 * Gọi ngay lúc sửa từ, vì đó là lúc duy nhất còn biết CHỮ CŨ. Có chữ cũ thì
 * không phải đoán: dựng lại nội dung mà máy đã sinh ra bằng lời cũ, so với nội
 * dung đang lưu — bằng nhau nghĩa là người dùng chưa viết lại, sửa giúp họ;
 * khác nhau nghĩa là họ đã viết lại, đừng đè lên công của họ.
 *
 * Đây là thứ bù cho cái mất khi bỏ khái niệm "phụ đề": phụ đề cũ dựng lại mỗi
 * lần xuất nên luôn khớp lời, còn chữ thì được lưu nên có thể lệch.
 */
export function refreshCaptionsAfterWordEdit(
  projectId: string,
  wordId: string,
  oldText: string,
  newText: string,
) {
  if (oldText === newText) return 0;
  const words = db
    .prepare("SELECT id, text FROM words WHERE project_id=? ORDER BY start_sec")
    .all(projectId) as Array<{ id: string; text: string }>;
  const wordIndex = new Map(words.map((word, index) => [word.id, index]));
  const editIndex = wordIndex.get(wordId);
  if (editIndex === undefined) return 0;

  const rows = db
    .prepare(
      `SELECT id, content, from_word_id, to_word_id FROM elements
       WHERE project_id = ? AND kind = 'text'`,
    )
    .all(projectId) as Array<{
    id: string;
    content: string | null;
    from_word_id: string;
    to_word_id: string;
  }>;

  const joined = (from: number, to: number, replace?: string) =>
    words
      .slice(from, to + 1)
      .map((word, i) =>
        from + i === editIndex && replace !== undefined ? replace : word.text,
      )
      .join(" ");

  const update = db.prepare("UPDATE elements SET content=? WHERE id=?");
  let changed = 0;
  db.transaction(() => {
    for (const row of rows) {
      const from = wordIndex.get(row.from_word_id);
      const to = wordIndex.get(row.to_word_id);
      if (from === undefined || to === undefined || to < from) continue;
      if (editIndex < from || editIndex > to) continue;
      // Nội dung đang lưu có đúng bằng lời CŨ của chính khoảng này không.
      if (row.content !== joined(from, to, oldText)) continue;
      update.run(joined(from, to), row.id);
      changed += 1;
    }
  })();
  return changed;
}

/** Từ theo thứ tự nói + bảng tra id→chỉ số, dùng chung cho các phép trên cụm. */
function orderedWords(projectId: string) {
  // Chỉ từ của câu CÒN LẠI (removed=0) — đúng tập mà cụm được dựng từ đó
  // (`buildCaptionGroups` lọc `s.removed=0`). Lấy cả từ câu đã bỏ thì chuỗi ghép
  // theo span có thể chèn từ đã bỏ vào giữa → so lệch nhầm với `content`.
  const words = db
    .prepare(
      `SELECT w.id, w.text FROM words w JOIN sentences s ON s.id = w.sentence_id
       WHERE w.project_id=? AND s.removed=0 ORDER BY w.start_sec`,
    )
    .all(projectId) as Array<{ id: string; text: string }>;
  const indexOf = new Map(words.map((word, index) => [word.id, index]));
  return { words, indexOf };
}

/**
 * Có cụm nào người dùng ĐÃ VIẾT LẠI CHỮ không (khác lời máy chép của chính khoảng đó)?
 *
 * Đây là tín hiệu DUY NHẤT đáng tin cho "người dùng đã sửa" per-cụm: chia lại cụm
 * dựng chữ từ bảng từ nên viết-lại KHÔNG khôi phục được. Nhấn/đặt thì MÁY (bước
 * `keywords`/`place`) cũng đặt — không phân biệt được người hay máy, mà nhấn lại
 * được re-map khi chia lại nên không cần chặn vì nó.
 */
export function hasUserRewrittenCaptions(projectId: string): boolean {
  const { words, indexOf } = orderedWords(projectId);
  const rows = db
    .prepare(
      `SELECT content, from_word_id, to_word_id FROM elements
       WHERE project_id=? AND kind='text'`,
    )
    .all(projectId) as Array<{
    content: string | null;
    from_word_id: string;
    to_word_id: string;
  }>;
  for (const row of rows) {
    const from = indexOf.get(row.from_word_id);
    const to = indexOf.get(row.to_word_id);
    if (from === undefined || to === undefined || to < from) continue;
    const verbatim = words
      .slice(from, to + 1)
      .map((word) => word.text)
      .join(" ");
    if (row.content !== null && row.content !== verbatim) return true;
  }
  return false;
}

/**
 * CHIA LẠI cụm cho cả dự án — thay ranh cụm, GIỮ chữ + mốc (dựng lại từ bảng từ
 * nên chữ máy không đổi), GIỮ nhấn bằng RE-MAP theo từng TỪ.
 *
 * Nhấn (`keywords`) vốn theo TỪNG TIẾNG, nên trước khi xoá gom tập TIẾNG được
 * nhấn (theo mã từ), rồi bật lại đúng những tiếng đó trên cụm mới. Chỗ-đặt/căn
 * per-cụm đặt lại theo bộ dáng — máy đặt được, không mất công người dùng.
 *
 * Người dùng viết-lại chữ thì KHÔNG giữ được (chia lại là dựng lại từ lời máy) —
 * nơi gọi tự-cứu đã chặn ca đó qua `hasUserRewrittenCaptions`; nút tay thì hỏi
 * xác nhận trước.
 */
export async function rechunkCaptions(
  projectId: string,
  band: Band,
  pack: StylePack,
): Promise<number> {
  const { words, indexOf } = orderedWords(projectId);

  // Gom tiếng-được-nhấn theo MÃ TỪ (chính xác hơn theo chữ: cùng một chữ có thể
  // xuất hiện nhiều nơi mà chỉ một chỗ được nhấn).
  const oldEls = db
    .prepare(
      `SELECT from_word_id, to_word_id, keywords FROM elements
       WHERE project_id=? AND kind='text' AND keywords IS NOT NULL AND keywords<>''`,
    )
    .all(projectId) as Array<{
    from_word_id: string;
    to_word_id: string;
    keywords: string;
  }>;
  const emphasizedIds = new Set<string>();
  for (const el of oldEls) {
    const from = indexOf.get(el.from_word_id);
    const to = indexOf.get(el.to_word_id);
    if (from === undefined || to === undefined) continue;
    const kw = new Set(
      el.keywords
        .split("|")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    for (let i = from; i <= to; i += 1)
      if (kw.has(words[i].text.trim().toLowerCase())) emphasizedIds.add(words[i].id);
  }

  // Tính cụm MỚI TRƯỚC khi đụng DB: buildCaptionGroups gọi mô hình + đo font (vài
  // giây `await`). Xoá trước rồi mới await là để dự án RỖNG cụm suốt quãng đó (khung
  // xem / render đọc trúng lúc ấy thấy trống) và MẤT HẲN nếu await ném lỗi.
  const { groups, llmOk } = await buildCaptionGroups(projectId, band, pack);
  // Build rỗng (mọi câu bị bỏ, chưa có lời…) thì ĐỪNG xoá — giữ nguyên cụm cũ.
  if (groups.length === 0) return 0;

  // Tráo NGUYÊN TỬ: xoá + chèn + re-map + cờ trong MỘT transaction đồng bộ (không
  // `await` xen giữa) → không có cửa sổ rỗng, và throw thì cuộn lại, cụm cũ còn nguyên.
  const created: string[] = [];
  db.transaction(() => {
    db.prepare("DELETE FROM elements WHERE project_id=? AND kind='text'").run(
      projectId,
    );
    created.push(...insertCaptionGroups(projectId, band, groups, pack, []));

    // Re-map nhấn lên cụm MỚI: cụm nào chứa tiếng-được-nhấn thì bật lại đúng tiếng đó.
    if (emphasizedIds.size > 0) {
      const newEls = db
        .prepare(
          `SELECT id, from_word_id, to_word_id FROM elements
           WHERE project_id=? AND kind='text'`,
        )
        .all(projectId) as Array<{
        id: string;
        from_word_id: string;
        to_word_id: string;
      }>;
      const setKeywords = db.prepare(
        "UPDATE elements SET keywords=? WHERE id=?",
      );
      for (const el of newEls) {
        const from = indexOf.get(el.from_word_id);
        const to = indexOf.get(el.to_word_id);
        if (from === undefined || to === undefined) continue;
        const kws: string[] = [];
        for (let i = from; i <= to; i += 1)
          if (emphasizedIds.has(words[i].id)) kws.push(words[i].text);
        if (kws.length > 0) setKeywords.run(kws.join("|"), el.id);
      }
    }

    db.prepare("UPDATE projects SET captions_llm_ok=? WHERE id=?").run(
      llmOk ? 1 : 0,
      projectId,
    );
  })();

  return created.length;
}
