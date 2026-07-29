import {
  readEnvelope,
  speechEndsAt,
  speechStartsAt,
} from "./audio-envelope";
import { buildCaptionGroups } from "./caption-groups";
import { db, newId } from "./db";

/**
 * Nới mép cụm lời xa nhất bằng này giây để ôm hết đuôi và đầu tiếng.
 *
 * 0,4 giây phủ tới đuôi dài nhất đo được (380ms) mà không nuốt cả một quãng
 * nghỉ ngắn: quãng dưới 0,25 giây vốn đã không được tính là khoảng lặng.
 */
const SPEECH_MARGIN = 0.4;

/**
 * Dựng đoạn theo CỤM CHỮ và KHOẢNG LẶNG.
 *
 * Trước đây đoạn cắt theo "nhắm 10 giây một đoạn rồi kéo về chỗ nghỉ gần nhất"
 * — một con số tuỳ tiện, không liên quan gì tới nội dung. Hệ quả: dải phim chia
 * theo một nhịp, bảng Lời chia theo một nhịp khác, và muốn bỏ một cụm thì phải
 * tách đoạn ra ở hai đầu rồi mới bỏ được khúc giữa.
 *
 * Giờ mỗi cụm chữ là một đoạn, mỗi quãng không ai nói là một đoạn. Được ba thứ:
 *
 * · Dải phim và bảng Lời chia y hệt nhau — một cấu trúc, nhìn ở hai chỗ.
 * · Bỏ một cụm chỉ còn là bật cờ trên đúng một đoạn, không phải tách rồi bỏ.
 * · Khoảng lặng thành một VẬT nhìn thấy và bấm được, thay vì chỗ trống vô hình.
 *
 * Đoạn phải LIỀN MẠCH phủ kín từ 0 tới hết video: chừa hở thì quãng nghỉ nằm ở
 * đó không thuộc đoạn nào và sẽ bị cắt mất, làm người xem nghe ra một tràng dồn
 * dập không có chỗ thở.
 */
export async function seedSegmentsByCaption(
  projectId: string,
  totalDuration: number,
) {
  const groups = await buildCaptionGroups(projectId);
  if (groups.length === 0) return 0;

  const envelope = await readEnvelope(projectId);

  const moc: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const group of groups) {
    // Mép cụm nới ra tới chỗ TIẾNG THẬT tắt, không dừng ở mốc máy chép lời báo.
    //
    // Máy chép lời đóng mốc sớm: đo trên một bản 66 giây, đuôi tiếng còn kéo
    // thêm 70ms (trung vị), có chỗ tới 380ms sau mốc kết thúc câu — và đầu từ
    // cũng vào muộn tương tự. Ranh giới đoạn đặt đúng mốc đó thì cái quãng gọi
    // là "im lặng" thật ra đang ôm cả đuôi từ cuối câu: bỏ nó đi là nghe ra một
    // tiếng bị chặt ngang. Nới mép cụm ra thì phần tiếng đó thuộc về đoạn CÓ
    // LỜI, và quãng lặng chỉ còn đúng phần không ai nói.
    const start = envelope
      ? Math.max(cursor, speechStartsAt(envelope, group.start, SPEECH_MARGIN))
      : group.start;
    const end = envelope
      ? speechEndsAt(envelope, group.end, SPEECH_MARGIN)
      : group.end;

    // Khoảng lặng trước cụm này. Dưới 0,25 giây thì không phải quãng lặng, chỉ
    // là kẽ hở giữa hai tiếng — đẻ ra một đoạn cho nó là làm dải vụn vô ích.
    if (start - cursor > 0.25) {
      moc.push({ start: cursor, end: start });
    }
    moc.push({
      start: Math.max(cursor, start),
      end: Math.max(end, Math.max(cursor, start) + 0.05),
    });
    cursor = moc[moc.length - 1].end;
  }
  if (totalDuration - cursor > 0.25) {
    moc.push({ start: cursor, end: totalDuration });
  }
  gopChoVuaChu(projectId, moc);
  // Mép đầu và mép cuối phải chạm hai đầu video, không thì hai mẩu ở rìa rơi ra
  // ngoài mọi đoạn và biến mất khỏi bản xuất.
  moc[0].start = 0;
  moc[moc.length - 1].end = Math.max(moc[moc.length - 1].end, totalDuration);

  const insert = db.prepare(
    "INSERT INTO segments (id, project_id, position, start_sec, end_sec, label, removed) VALUES (?,?,?,?,?,NULL,?)",
  );
  // Giữ nguyên những gì ĐANG BỊ BỎ: dựng lại đoạn mà quên chúng thì mọi nhát
  // cắt người dùng đã làm lặng lẽ quay về video.
  const daBo = daBoTruoc(projectId);

  db.transaction(() => {
    db.prepare("DELETE FROM segments WHERE project_id=?").run(projectId);
    moc.forEach((span, index) => {
      const giua = (span.start + span.end) / 2;
      const bo = daBo.some((cu) => giua >= cu.start && giua < cu.end);
      insert.run(
        newId("seg"),
        projectId,
        index,
        span.start,
        span.end,
        bo ? 1 : 0,
      );
    });
  })();
  return moc.length;
}

/**
 * KHÔNG đặt mốc cắt vào giữa một chữ.
 *
 * Luật của bàn dựng là "một đoạn, một chữ". Chữ máy sinh luôn ≤5 tiếng nên vừa
 * đúng một cụm; nhưng chữ người dùng tự viết có thể phủ mười mấy tiếng, và lúc
 * đó mốc cắt của các cụm bên dưới rơi vào GIỮA nó — thành một chữ nằm trên bốn
 * đoạn, đúng thứ phá luật.
 *
 * Chữa bằng cách gộp đoạn cho vừa chữ, KHÔNG phải chẻ chữ cho vừa đoạn: chẻ chữ
 * nghĩa là thay lời người ta viết bằng lời máy chép ("Nhưng năm nay thì khác"
 * chỉ năm chữ mà phủ mười bốn tiếng nói). Gộp đoạn thì không mất gì — đoạn chỉ
 * là chỗ cắt, mà hai đoạn dính nhau gộp lại vẫn ra đúng ngần ấy video.
 */
function gopChoVuaChu(
  projectId: string,
  moc: Array<{ start: number; end: number }>,
) {
  const chu = db
    .prepare(
      `SELECT wf.start_sec AS start, wt.end_sec AS end
       FROM elements e
       JOIN words wf ON wf.id = e.from_word_id
       JOIN words wt ON wt.id = e.to_word_id
       WHERE e.project_id = ? AND e.kind = 'text'`,
    )
    .all(projectId) as Array<{ start: number; end: number }>;
  if (chu.length === 0) return;

  for (let i = moc.length - 1; i > 0; i -= 1) {
    const ranh = moc[i].start;
    const catGiuaChu = chu.some(
      (item) => ranh > item.start + 0.02 && ranh < item.end - 0.02,
    );
    if (!catGiuaChu) continue;
    moc[i - 1].end = moc[i].end;
    moc.splice(i, 1);
  }
}

/** Những quãng đang KHÔNG vào video, đọc trước khi dựng lại đoạn. */
function daBoTruoc(projectId: string) {
  const rows = db
    .prepare(
      "SELECT start_sec, end_sec, removed FROM segments WHERE project_id=? ORDER BY start_sec",
    )
    .all(projectId) as Array<{
    start_sec: number;
    end_sec: number;
    removed: number;
  }>;

  const out: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const row of rows) {
    // Hở giữa hai đoạn (do gọt mép) cũng là chỗ không vào video.
    if (row.start_sec > cursor + 0.05) {
      out.push({ start: cursor, end: row.start_sec });
    }
    if (row.removed) out.push({ start: row.start_sec, end: row.end_sec });
    cursor = Math.max(cursor, row.end_sec);
  }
  return out;
}
