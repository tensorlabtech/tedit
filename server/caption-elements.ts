import { buildCaptionGroups } from "./caption-groups";
import { db, newId } from "./db";
import type { Band } from "./text-layout";

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
  band: Band = "bottom",
  /** Chỉ sinh trong khoảng này — dùng khi lấp chữ cho riêng một câu. */
  only?: { start: number; end: number },
) {
  const all = await buildCaptionGroups(projectId, band);
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
  const insert = db.prepare(
    `INSERT INTO elements (id, project_id, kind, from_word_id, to_word_id, content, position_band, align, emphasis, reveal, shape)
     VALUES (?,?,'text',?,?,?,?,'center','taper','none','full')`,
  );

  const created: string[] = [];
  db.transaction(() => {
    for (const group of groups) {
      const overlaps = taken.some(
        (span) => group.start < span.end && group.end > span.start,
      );
      if (overlaps) continue;
      const id = newId("e");
      insert.run(
        id,
        projectId,
        group.words[0].id,
        group.words[group.words.length - 1].id,
        group.text,
        band,
      );
      created.push(id);
    }
  })();
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
export async function splitVerbatimCaptions(projectId: string) {
  const groups = await buildCaptionGroups(projectId);
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
