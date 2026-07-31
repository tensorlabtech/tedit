import { db, newId } from "./db";

export type Segment = {
  id: string;
  project_id?: string;
  position: number;
  start_sec: number;
  end_sec: number;
  label: string | null;
  removed: number;
};

const MIN_LENGTH = 0.3;

export function listSegments(projectId: string): Segment[] {
  return db
    .prepare("SELECT * FROM segments WHERE project_id=? ORDER BY position")
    .all(projectId) as Segment[];
}

/**
 * Dựng đoạn lần đầu từ bản chép lời: mỗi cụm câu liền nhau là một đoạn.
 *
 * Cắt theo chỗ NGHỈ dài chứ không cắt theo từng câu: một video 2 phút có ba
 * chục câu, băm thành ba chục khối thì dải thành một hàng vụn không đọc được.
 */
export function seedSegments(projectId: string, totalDuration: number) {
  if (listSegments(projectId).length > 0) return;

  const sentences = db
    .prepare(
      "SELECT text, start_sec, end_sec FROM sentences WHERE project_id=? ORDER BY position",
    )
    .all(projectId) as Array<{
    text: string;
    start_sec: number;
    end_sec: number;
  }>;

  if (sentences.length === 0) {
    insert(projectId, 0, 0, totalDuration, null);
    return;
  }

  /**
   * Cắt theo ĐỘ DÀI ĐỀU, ưu tiên rơi vào chỗ nghỉ gần nhất.
   *
   * Cắt thuần theo chỗ nghỉ là sai với người nói liên tục: đo trên video thật
   * thấy nó ra một khối 44 giây trên tổng 66, và người dùng phải bấm tách tay
   * từng chỗ. Nhắm 10 giây một đoạn rồi kéo mép về chỗ nghỉ gần nhất thì vừa
   * đều vừa không cắt giữa câu.
   */
  const TARGET = 10;
  const groups: Array<{ start: number; end: number; first: string }> = [];
  let current = {
    start: sentences[0].start_sec,
    end: sentences[0].end_sec,
    first: sentences[0].text,
  };
  for (let i = 1; i < sentences.length; i += 1) {
    const sentence = sentences[i];
    const wouldBe = sentence.end_sec - current.start;
    const gapHere = sentence.start_sec - current.end;
    // Đủ dài rồi, hoặc thêm câu này là vượt xa mốc — chốt đoạn tại chỗ nghỉ này.
    if (
      current.end - current.start >= TARGET ||
      (wouldBe > TARGET * 1.5 && gapHere > 0.2)
    ) {
      groups.push(current);
      current = {
        start: sentence.start_sec,
        end: sentence.end_sec,
        first: sentence.text,
      };
      continue;
    }
    current.end = sentence.end_sec;
  }
  groups.push(current);

  // Các đoạn phải LIỀN MẠCH, phủ kín từ 0 tới hết video.
  //
  // Chừa hở giữa hai đoạn thì quãng nghỉ nằm ở đó không thuộc đoạn nào, và
  // "giữ những đoạn chưa bỏ" sẽ cắt mất luôn nhịp thở giữa các câu — đúng lỗi
  // làm người xem nghe ra một tràng dồn dập.
  groups[0].start = 0;
  for (let i = 0; i < groups.length - 1; i += 1) {
    groups[i].end = groups[i + 1].start;
  }
  groups[groups.length - 1].end = Math.max(
    groups[groups.length - 1].end,
    totalDuration,
  );

  // Nhãn để TRỐNG: nó chỉ là "Đoạn N · mốc giờ", mà cả hai vế đổi theo mỗi lần
  // tách, gộp hay gọt mép. Lưu vào cơ sở dữ liệu là tự nhận việc cập nhật nó ở
  // năm chỗ, và sót một chỗ thì trên dải có hai đoạn cùng tên. Cột `label` giờ
  // chỉ dành cho tên người dùng tự đặt.
  groups.forEach((group, index) => {
    insert(projectId, index, group.start, group.end, null);
  });
}

function insert(
  projectId: string,
  position: number,
  start: number,
  end: number,
  label: string | null,
) {
  const id = newId("seg");
  db.prepare(
    "INSERT INTO segments (id, project_id, position, start_sec, end_sec, label, removed) VALUES (?,?,?,?,?,?,0)",
  ).run(id, projectId, position, start, end, label);
  return id;
}

/** Tách đoạn đang chứa mốc `at` thành hai. Trả `null` nếu không tách được. */
export function splitAt(projectId: string, at: number) {
  const target = listSegments(projectId).find(
    (item) =>
      at > item.start_sec + MIN_LENGTH && at < item.end_sec - MIN_LENGTH,
  );
  if (!target) return null;

  const newId2 = insert(
    projectId,
    target.position + 1,
    at,
    target.end_sec,
    null,
  );
  db.prepare("UPDATE segments SET end_sec=? WHERE id=?").run(at, target.id);
  renumber(projectId);
  return newId2;
}

/**
 * Gộp một đoạn vào đoạn liền trước — dùng để hoàn tác việc tách.
 *
 * Gộp về TRƯỚC chứ không về sau: tách luôn sinh ra đoạn mới ở phía sau, nên đảo
 * lại đúng nghĩa là trả nó về cho đoạn đã bị cắt ngắn.
 */
export function mergeIntoPrevious(id: string) {
  const row = db.prepare("SELECT * FROM segments WHERE id=?").get(id) as
    Segment | undefined;
  if (!row) return false;
  const previous = db
    .prepare(
      "SELECT * FROM segments WHERE project_id=? AND end_sec<=? ORDER BY end_sec DESC LIMIT 1",
    )
    .get(row.project_id ?? "", row.start_sec + 0.001) as Segment | undefined;
  const prev =
    previous ??
    (db
      .prepare(
        "SELECT * FROM segments WHERE project_id=(SELECT project_id FROM segments WHERE id=?) AND position=? LIMIT 1",
      )
      .get(id, row.position - 1) as Segment | undefined);
  if (!prev || prev.id === id) return false;

  db.prepare("UPDATE segments SET end_sec=? WHERE id=?").run(
    row.end_sec,
    prev.id,
  );
  db.prepare("DELETE FROM segments WHERE id=?").run(id);
  const projectId = db
    .prepare("SELECT project_id FROM segments WHERE id=?")
    .get(prev.id) as { project_id: string } | undefined;
  if (projectId) renumber(projectId.project_id);
  return true;
}

export function setSegmentRemoved(id: string, removed: boolean) {
  db.prepare("UPDATE segments SET removed=? WHERE id=?").run(
    removed ? 1 : 0,
    id,
  );
}

export function trimSegment(id: string, edge: "start" | "end", at: number) {
  const row = db.prepare("SELECT * FROM segments WHERE id=?").get(id) as
    | Segment
    | undefined;
  if (!row) return false;

  // Không được LẤN sang đoạn bên cạnh.
  //
  // Gọt vào trong thì phần bị gọt thành chỗ hở — hở không thuộc đoạn nào nên
  // không vào video, đó là ý đồ. Nhưng nới ra ngoài mà không chặn thì hai đoạn
  // CHỒNG lên nhau: đo thật, kéo mép phải 200px là đoạn 1 kết thúc ở 2,42 trong
  // khi đoạn 2 vẫn bắt đầu ở 1,34 — chồng 1,08 giây. Từ đó mọi phép tính về sau
  // đều sai: khoảng giữ lại đếm hai lần, mốc chỗ nối lệch, độ dài xuất ra vống
  // lên. Không chỗ nào báo.
  const neighbour = db
    .prepare(
      edge === "start"
        ? "SELECT end_sec AS boundary FROM segments WHERE project_id=? AND end_sec<=? ORDER BY end_sec DESC LIMIT 1"
        : "SELECT start_sec AS boundary FROM segments WHERE project_id=? AND start_sec>=? ORDER BY start_sec ASC LIMIT 1",
    )
    .get(
      row.project_id,
      edge === "start" ? row.start_sec : row.end_sec,
    ) as { boundary: number } | undefined;

  if (edge === "start") {
    const floor = Math.max(0, neighbour?.boundary ?? 0);
    const value = Math.min(Math.max(at, floor), row.end_sec - MIN_LENGTH);
    db.prepare("UPDATE segments SET start_sec=? WHERE id=?").run(value, id);
  } else {
    const ceiling = neighbour?.boundary ?? Number.POSITIVE_INFINITY;
    const value = Math.min(
      Math.max(at, row.start_sec + MIN_LENGTH),
      ceiling,
    );
    db.prepare("UPDATE segments SET end_sec=? WHERE id=?").run(value, id);
  }
  // Nhãn có mốc bắt đầu trong đó, nên gọt mép trái là nhãn sai theo.
  if (row.project_id) renumber(row.project_id);
  return true;
}

export function renameSegment(id: string, label: string) {
  db.prepare("UPDATE segments SET label=? WHERE id=?").run(label, id);
}

/**
 * Đánh lại số thứ tự VÀ nhãn cho mọi đoạn.
 *
 * Nhãn phải sinh lại ở đây chứ không giữ nguyên từ lúc tạo: nhãn chứa số thứ tự,
 * mà tách hay gộp một đoạn là mọi đoạn phía sau đổi số. Giữ nhãn cũ thì sau một
 * lần tách có hai đoạn cùng tên "Đoạn 3" nằm cạnh nhau trên dải — người dùng
 * không còn cách nào gọi tên đoạn mình đang sửa.
 */
function renumber(projectId: string) {
  const rows = db
    .prepare(
      "SELECT id, start_sec FROM segments WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Array<{ id: string; start_sec: number }>;
  // Xoá luôn nhãn máy sinh còn sót từ bản trước (`Đoạn N · m:ss`): giữ lại thì
  // nó đè lên nhãn tính theo vị trí mới và hai đoạn cạnh nhau lại trùng tên.
  const update = db.prepare(
    "UPDATE segments SET position=?, label=CASE WHEN label LIKE 'Đoạn %' OR label='Toàn bộ' THEN NULL ELSE label END WHERE id=?",
  );
  db.transaction(() =>
    rows.forEach((row, index) => update.run(index, row.id)),
  )();
}

/** Các khoảng còn giữ: đoạn chưa bị bỏ, trừ tiếp câu đã gạch và đoạn cắt tay. */
export function keptFromSegments(
  projectId: string,
  removedSpans: Array<{ start: number; end: number }>,
) {
  const kept: Array<{ start: number; end: number }> = [];
  for (const segment of listSegments(projectId)) {
    if (segment.removed) continue;
    let pieces = [{ start: segment.start_sec, end: segment.end_sec }];
    for (const gap of removedSpans) {
      pieces = pieces.flatMap((piece) => {
        if (gap.end <= piece.start || gap.start >= piece.end) return [piece];
        const out: typeof pieces = [];
        if (gap.start > piece.start)
          out.push({ start: piece.start, end: gap.start });
        if (gap.end < piece.end) out.push({ start: gap.end, end: piece.end });
        return out;
      });
    }
    kept.push(...pieces.filter((piece) => piece.end - piece.start > 0.05));
  }
  return kept;
}

/**
 * Bỏ một quãng theo giây — làm bằng ĐOẠN, không bằng một cơ chế riêng.
 *
 * Tách ở hai đầu quãng rồi bỏ đoạn ở giữa. Ba bước với máy, một bấm với người.
 *
 * Vì sao không giữ bảng "cắt tay" riêng: hai cơ chế cho cùng một ý "chỗ này không
 * vào video" nghĩa là hai chỗ để lệch nhau, hai chỗ phải nhớ khi tính lại, và hai
 * cách hiện trên dải cho cùng một chuyện. Đoạn đã đủ diễn đạt: bỏ đoạn thì mất,
 * gọt mép đoạn thì phần bị gọt thành hở, mà hở cũng không vào video.
 */
export function removeRange(projectId: string, start: number, end: number) {
  if (!(end - start > 0.05)) return listSegments(projectId);
  splitAt(projectId, start);
  splitAt(projectId, end);
  // Lấy đoạn nào PHẦN LỚN nằm trong khoảng, không đòi nằm TRỌN.
  //
  // Mép cụm lời và mép đoạn không còn trùng nhau: đoạn đã được nới ra tới chỗ
  // tiếng thật tắt, còn cụm lời dừng ở mốc từ. Bỏ cụm cuối một câu thì mẩu dư
  // chỉ 0,08 giây — ngắn hơn `MIN_LENGTH` nên `splitAt` từ chối tách, đoạn ở
  // lại nguyên vẹn và vì nó không nằm TRỌN trong khoảng nên chẳng ai đánh dấu
  // nó. Kết quả: bấm "Bỏ khoảng này" mà không có gì bị bỏ, cũng không có lời
  // nào báo. Đo được ngay trên dòng "Chúc mừng sinh nhật mình".
  const overlap = (a: number, b: number) =>
    Math.max(0, Math.min(b, end) - Math.max(a, start));
  const inside = listSegments(projectId).filter((segment) => {
    const length = segment.end_sec - segment.start_sec;
    if (length <= 0) return false;
    return overlap(segment.start_sec, segment.end_sec) >= length * 0.6;
  });
  for (const segment of inside) setSegmentRemoved(segment.id, true);
  return listSegments(projectId);
}

/**
 * Đổi các "cắt tay" cũ thành đoạn đã bỏ — chạy MỘT lần cho mỗi dự án.
 *
 * Dự án làm trước khi gộp cơ chế vẫn còn hàng trong `manual_cuts`. Đổi rồi xoá
 * hàng đi: để lại thì bản mới không đọc nữa mà video xuất ra lại khác trước, và đó
 * là kiểu sai âm thầm nhất — không lỗi, chỉ thiếu mất mấy giây.
 */
export function absorbManualCuts(projectId: string) {
  const cuts = db
    .prepare(
      "SELECT id, start_sec, end_sec FROM manual_cuts WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Array<{
    id: string;
    start_sec: number;
    end_sec: number;
  }>;
  if (cuts.length === 0) return 0;
  // Chỉ đổi được khi đã có đoạn; chưa chép lời thì chưa có đoạn nào để tách.
  if (listSegments(projectId).length === 0) return 0;
  for (const cut of cuts) removeRange(projectId, cut.start_sec, cut.end_sec);
  db.prepare("DELETE FROM manual_cuts WHERE project_id=?").run(projectId);
  return cuts.length;
}

/**
 * Các quãng KHÔNG vào video: đoạn đã bỏ, và hở giữa hai đoạn do gọt mép.
 *
 * Hở cũng phải liệt ra: nó không thuộc đoạn nào nên `keptFromSegments` bỏ qua, mà
 * người dùng thì cần thấy mình vừa gọt mất chỗ nào và lấy lại được.
 */
export function skippedSpans(projectId: string, totalDuration: number) {
  const segments = listSegments(projectId);
  const spans: Array<{
    id: string;
    start: number;
    end: number;
    kind: "segment" | "gap";
    label: string | null;
  }> = [];
  let cursor = 0;
  for (const segment of segments) {
    if (segment.start_sec > cursor + 0.05) {
      spans.push({
        id: `gap-${segment.id}`,
        start: cursor,
        end: segment.start_sec,
        kind: "gap",
        label: null,
      });
    }
    if (segment.removed) {
      spans.push({
        id: segment.id,
        start: segment.start_sec,
        end: segment.end_sec,
        kind: "segment",
        label: segment.label,
      });
    }
    cursor = Math.max(cursor, segment.end_sec);
  }
  if (totalDuration > cursor + 0.05) {
    spans.push({
      id: "gap-end",
      start: cursor,
      end: totalDuration,
      kind: "gap",
      label: null,
    });
  }
  return spans;
}

/**
 * Nới đoạn cuối cho phủ hết video, khi có thêm video chính sau lúc chia đoạn.
 *
 * Đoạn được gieo MỘT LẦN theo bản chép lời lúc đó. Người dùng thêm một video
 * chính vào sau thì phần thêm không thuộc đoạn nào — mà "không thuộc đoạn nào"
 * nghĩa là không vào video xuất ra. Đo thật trên một dự án: hai video chính cộng
 * lại 75,73s, đoạn chỉ phủ tới 66,43s, **9,3 giây biến mất mà không báo gì**.
 *
 * Chữa bằng cách NỐI THÊM một đoạn ở đuôi, không gieo lại từ đầu: gieo lại là
 * xoá sạch những đoạn người dùng đã tách, đã bỏ, đã gọt.
 *
 * Không có lời cho phần thêm (chưa chép lại), nên đoạn mới là một khối trơn —
 * vẫn hơn là mất hẳn.
 */
export function extendToDuration(projectId: string, total: number) {
  if (!(total > 0)) return false;
  const segs = listSegments(projectId);
  if (segs.length === 0) return false;
  const last = segs[segs.length - 1];
  if (total - last.end_sec <= 0.05) return false;
  insert(projectId, last.position + 1, last.end_sec, total, null);
  renumber(projectId);
  return true;
}
