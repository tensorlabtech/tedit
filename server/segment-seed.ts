import {
  readEnvelope,
  speechEndsAt,
  speechStartsAt,
} from "./audio-envelope";
import { buildCaptionGroups } from "./caption-groups";
import type { StylePack } from "./style-pack";
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
  /**
   * Bộ dáng của dự án — nó quyết định chỗ tách cụm, mà đoạn thì gieo THEO cụm.
   * Truyền bộ gốc trong khi dự án dùng bộ khác là đoạn chia theo một nhịp còn
   * chữ in ra theo một nhịp khác.
   */
  pack: StylePack,
) {
  const { groups } = await buildCaptionGroups(projectId, "bottom", pack);
  if (groups.length === 0) return 0;

  const envelope = await readEnvelope(projectId);

  const spans: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const [index, group] of groups.entries()) {
    // Phần nới KHÔNG được ăn sang cụm bên cạnh.
    //
    // Đây là chỗ bản đầu làm sai và hậu quả lộ ra bằng mắt: khi hai cụm nói
    // liền nhau không có quãng lặng, `speechEndsAt` chạy hết 0,4 giây cho phép
    // và mép đoạn cắm vào giữa cụm sau. Đo trên một dự án thật: mép chữ lệch
    // mép đoạn trung vị 0,60 giây — 120px ở mức phóng thường — nên gần như mọi
    // cụm chữ đều vắt qua một ranh giới đoạn, và dải đọc ra loạn hẳn.
    //
    // Nới chỉ có nghĩa ở chỗ SẮP THÀNH QUÃNG LẶNG: đó là chỗ người dùng sẽ bấm
    // bỏ, và là chỗ duy nhất cần chừa đuôi tiếng. Hai cụm dính nhau thì không
    // có quãng lặng nào để cắt, nên cũng không có gì phải chừa.
    const previous = groups[index - 1];
    const next = groups[index + 1];
    // Mép cụm nới ra tới chỗ TIẾNG THẬT tắt, không dừng ở mốc máy chép lời báo.
    //
    // Máy chép lời đóng mốc sớm: đo trên một bản 66 giây, đuôi tiếng còn kéo
    // thêm 70ms (trung vị), có chỗ tới 380ms sau mốc kết thúc câu — và đầu từ
    // cũng vào muộn tương tự. Ranh giới đoạn đặt đúng mốc đó thì cái quãng gọi
    // là "im lặng" thật ra đang ôm cả đuôi từ cuối câu: bỏ nó đi là nghe ra một
    // tiếng bị chặt ngang. Nới mép cụm ra thì phần tiếng đó thuộc về đoạn CÓ
    // LỜI, và quãng lặng chỉ còn đúng phần không ai nói.
    const start = envelope
      ? Math.max(
          cursor,
          previous?.end ?? 0,
          speechStartsAt(envelope, group.start, SPEECH_MARGIN),
        )
      : group.start;
    const end = envelope
      ? Math.min(
          speechEndsAt(envelope, group.end, SPEECH_MARGIN),
          next?.start ?? Number.POSITIVE_INFINITY,
        )
      : group.end;

    // Khoảng lặng trước cụm này. Hở LỚN (>0,25s) → đoạn lặng riêng (người dùng
    // bấm bỏ được). Hở NHỎ (≤0,25s) thì KHÔNG đáng một đoạn — nhưng NÓ VẪN PHẢI
    // THUỘC MỘT ĐOẠN: để trống thì `keptRanges` bỏ nó, trục render NÉN lại, phụ đề
    // trôi khỏi tiếng và đuôi video cụt (đúng ý định "đoạn LIỀN MẠCH" ở đầu tệp).
    // Nên hở nhỏ thì GỘP vào đầu đoạn lời này (đoạn bắt đầu từ `cursor`).
    const hasGap = start - cursor > 0.25;
    if (hasGap) {
      spans.push({ start: cursor, end: start });
    }
    const spanStart = hasGap ? start : cursor;
    spans.push({
      start: spanStart,
      end: Math.max(end, spanStart + 0.05),
    });
    cursor = spans[spans.length - 1].end;
  }
  if (totalDuration - cursor > 0.25) {
    spans.push({ start: cursor, end: totalDuration });
  }
  mergeSpansCuttingText(projectId, spans);
  // Mép đầu và mép cuối phải chạm hai đầu video, không thì hai mẩu ở rìa rơi ra
  // ngoài mọi đoạn và biến mất khỏi bản xuất.
  spans[0].start = 0;
  spans[spans.length - 1].end = Math.max(spans[spans.length - 1].end, totalDuration);

  const insert = db.prepare(
    "INSERT INTO segments (id, project_id, position, start_sec, end_sec, label, removed) VALUES (?,?,?,?,?,NULL,?)",
  );
  // Giữ nguyên những gì ĐANG BỊ BỎ: dựng lại đoạn mà quên chúng thì mọi nhát
  // cắt người dùng đã làm lặng lẽ quay về video.
  const removed = daBoTruoc(projectId);

  db.transaction(() => {
    db.prepare("DELETE FROM segments WHERE project_id=?").run(projectId);
    spans.forEach((span, index) => {
      const mid = (span.start + span.end) / 2;
      const skipped = removed.some((cu) => mid >= cu.start && mid < cu.end);
      insert.run(
        newId("seg"),
        projectId,
        index,
        span.start,
        span.end,
        skipped ? 1 : 0,
      );
    });
  })();
  return spans.length;
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
function mergeSpansCuttingText(
  projectId: string,
  spans: Array<{ start: number; end: number }>,
) {
  const texts = db
    .prepare(
      `SELECT wf.start_sec AS start, wt.end_sec AS end
       FROM elements e
       JOIN words wf ON wf.id = e.from_word_id
       JOIN words wt ON wt.id = e.to_word_id
       WHERE e.project_id = ? AND e.kind = 'text'`,
    )
    .all(projectId) as Array<{ start: number; end: number }>;
  if (texts.length === 0) return;

  for (let i = spans.length - 1; i > 0; i -= 1) {
    const boundary = spans[i].start;
    const cutsThroughText = texts.some(
      (item) => boundary > item.start + 0.02 && boundary < item.end - 0.02,
    );
    if (!cutsThroughText) continue;
    spans[i - 1].end = spans[i].end;
    spans.splice(i, 1);
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
