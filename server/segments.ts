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

// Mẩu nhỏ nhất khi CHIA đoạn — đủ nhỏ để chẻ được khoảng lặng ngắn lọt trong một
// đoạn, vẫn đủ lớn để dải không đầy khối vụn không bấm nổi.
const MIN_LENGTH = 0.15;

export function listSegments(projectId: string): Segment[] {
  return db
    .prepare("SELECT * FROM segments WHERE project_id=? ORDER BY position")
    .all(projectId) as Segment[];
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

/**
 * Mẩu nhỏ nhất khi người dùng CHỈ ĐÍCH DANH một mốc.
 *
 * `MIN_LENGTH` là để dải không đẻ ra những khối vụn không bấm nổi —
 * đúng cho việc chia đoạn. Nhưng khi người dùng kéo mép một khoảng cắt tới đúng
 * chỗ họ nghe thấy, mẩu còn lại nhỏ bao nhiêu không quan trọng: nó chỉ là phần
 * phim còn giữ, không phải một khối để bấm. Nửa khung hình ở 30 hình/giây.
 */
const EXACT_MIN = 0.02;

/** Tách đoạn đang chứa mốc `at` thành hai. Trả `null` nếu không tách được. */
export function splitAt(projectId: string, at: number, least = MIN_LENGTH) {
  const target = listSegments(projectId).find(
    (item) => at > item.start_sec + least && at < item.end_sec - least,
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
  // Nửa SAU kế thừa cờ `removed` của đoạn gốc. `insert` mặc định `removed=0`, nên
  // chẻ trúng một khoảng ĐANG BỎ thì nửa sau hoá "giữ" — kéo mép một chỗ cắt trùm
  // lên chỗ cắt khác là chỗ kia biến mất, phim ở đó lặng lẽ trở lại bản dựng (đo
  // được: gộp hai chỗ cắt làm "còn 1:07" nhảy lên "còn 1:14").
  if (target.removed) {
    db.prepare("UPDATE segments SET removed=1 WHERE id=?").run(newId2);
  }
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

/**
 * Đếm số đoạn ĐANG bị bỏ.
 *
 * Để nơi gọi `removeRange` báo con số THẬT SỰ bỏ được, không báo con số định bỏ.
 * Hai con số ấy từng lệch nhau mà không ai biết: `silence` báo "rút 12 chỗ ·
 * 57.4s" trong khi bảng này có đúng 0 dòng bị bỏ, vì lúc đó chưa gieo đoạn nào.
 */
export function removedCount(projectId: string): number {
  return (
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM segments WHERE project_id=? AND removed=1",
      )
      .get(projectId) as { n: number }
  ).n;
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
  coalesceRemoved(projectId);
  return listSegments(projectId);
}

/**
 * BỎ ĐÚNG KHOẢNG NGƯỜI DÙNG VẼ RA — không nới, không co.
 *
 * `removeRange` nhận đoạn nào phủ ĐỦ 60%, và luật ấy đúng cho đề xuất của máy:
 * mốc mô hình đưa ra bám mép TỪ, còn mép đoạn đã nới tới chỗ tiếng thật tắt, nên
 * đòi nằm trọn thì gần như không bao giờ khớp.
 *
 * Với thao tác tay thì luật ấy sai hẳn. Đo thật: bấm thêm một khoảng ở giây 9,58
 * xin bỏ 1 giây, mà đoạn [9,28 → 10,50] phủ 75% nên bị bỏ TRỌN — chỗ cắt hoá ra
 * bắt đầu sớm hơn chỗ bấm 0,3 giây và dài gấp rưỡi. Người dùng kéo mép để nghe
 * cho vừa tai, rồi máy tự nới ra chỗ khác; không có gì báo.
 *
 * Nên đường của người đi lối riêng: chẻ đúng hai mốc (với mẩu nhỏ nhất là nửa
 * khung hình thay vì 0,3 giây), rồi bỏ đúng những đoạn nằm TRỌN trong khoảng.
 */
export function cutExactly(projectId: string, start: number, end: number) {
  if (!(end - start > 0.05)) return listSegments(projectId);
  splitAt(projectId, start, EXACT_MIN);
  splitAt(projectId, end, EXACT_MIN);
  for (const segment of listSegments(projectId)) {
    if (
      segment.start_sec >= start - 0.001 &&
      segment.end_sec <= end + 0.001 &&
      segment.end_sec > segment.start_sec
    ) {
      setSegmentRemoved(segment.id, true);
    }
  }
  coalesceRemoved(projectId);
  return listSegments(projectId);
}

/**
 * Gộp những đoạn ĐÃ BỎ nằm liền nhau thành một.
 *
 * `removeRange` chẻ ở hai mốc rồi đánh dấu mọi đoạn phủ đủ 60%. Nếu trong khoảng
 * ấy đã sẵn có một lằn chia — hay gặp, vì mỗi lần bỏ trước đó đều để lại hai lằn
 * — thì cả hai mẩu đều bị đánh dấu, và một chỗ cắt duy nhất thành HAI dòng.
 *
 * Đo thật: bấm thêm một khoảng ở giây 13,3 làm số khoảng nhảy từ 12 lên 14.
 * Trên dải trông vẫn là một mảng liền, nên không ai thấy; nhưng hàng soát mọc
 * thêm một dòng, và xoá dòng ấy chỉ trả lại được nửa chỗ phim.
 *
 * "Một chỗ cắt là một đoạn" là bất biến của cả màn cắt. Giữ nó ở đây, chỗ duy
 * nhất sinh ra đoạn bị bỏ, chứ không bắt mỗi nơi đọc phải tự gộp lại.
 */
export function coalesceRemoved(projectId: string) {
  let merged = true;
  while (merged) {
    merged = false;
    const rows = listSegments(projectId);
    for (let at = 1; at < rows.length; at += 1) {
      const previous = rows[at - 1];
      const current = rows[at];
      if (!previous.removed || !current.removed) continue;
      // Dính nhau tới từng mili giây — hở thật thì là hai chỗ cắt khác nhau.
      if (Math.abs(current.start_sec - previous.end_sec) > 0.001) continue;
      db.prepare("UPDATE segments SET end_sec=? WHERE id=?").run(
        current.end_sec,
        previous.id,
      );
      db.prepare("DELETE FROM segments WHERE id=?").run(current.id);
      merged = true;
      break;
    }
    if (merged) renumber(projectId);
  }
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

/**
 * HÀN LỖ HỔNG giữa hai đoạn liền kề — đoạn phải liền mạch từ 0 tới hết.
 *
 * Màn Cắt lỗi chỉ bỏ CẢ khoảng, KHÔNG gọt mép, nên mọi lỗ hổng ở bước ấy là RÁC
 * (một cú kéo dở dang thời còn tranh async để lại). Mà lỗ hổng thì `keptFromSegments`
 * bỏ qua (mất khỏi video xuất), và `cuts` bên Soát lời tính nó là "đã bỏ" — trong
 * khi màn Cắt chỉ nhìn `removed` nên vẫn hiện nó là GIỮ. Ba nơi lệch nhau, người
 * dùng thấy content còn ở màn Cắt mà biến mất khi soát lời.
 *
 * Hàn thì lỗ nhập vào đoạn GIỮ liền kề (kéo mép nó lấp sang) để KHÔNG đánh rơi
 * nội dung người dùng không cố ý bỏ; hai bên đều đã-bỏ thì kéo đoạn trước lấp
 * sang (vẫn nằm trong chỗ bỏ). CHỈ gọi ở màn Cắt: bàn dựng gọt-mép có chủ ý cũng
 * đẻ ra lỗ, hàn ở đó là undo việc người dùng cố tình làm.
 */
export function sealGaps(projectId: string): number {
  const segs = listSegments(projectId); // theo thứ tự position
  let sealed = 0;
  for (let i = 0; i < segs.length - 1; i += 1) {
    const a = segs[i];
    const b = segs[i + 1];
    if (b.start_sec - a.end_sec <= 0.001) continue; // đã liền
    if (a.removed === 0 || b.removed !== 0) {
      // Đoạn trước GIỮ (nhập lỗ vào chỗ giữ), hoặc đoạn sau cũng đã-bỏ (nhập vào
      // đâu cũng là chỗ bỏ) → kéo mép SAU của đoạn trước lấp tới đầu đoạn sau.
      db.prepare("UPDATE segments SET end_sec=? WHERE id=?").run(b.start_sec, a.id);
    } else {
      // Đoạn trước đã-bỏ mà đoạn sau GIỮ → kéo mép TRƯỚC của đoạn sau lùi lại để
      // lỗ nhập vào chỗ giữ, không rơi vào chỗ bỏ.
      db.prepare("UPDATE segments SET start_sec=? WHERE id=?").run(a.end_sec, b.id);
    }
    sealed += 1;
  }
  return sealed;
}
