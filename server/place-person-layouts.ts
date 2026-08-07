import { db, newId } from "./db";
import { findLayout } from "./layout-kinds";
import { readStylePack } from "./style-pack-store";

/**
 * GIEO Ô NGƯỜI — máy gợi ý vài khung KHÁC mặc định ở câu đặc biệt.
 *
 * Mô hình mới: toàn-khung là mặc định (không segment), b-roll đã được `placeInserts`
 * rải theo nội dung. Còn lại là đoạn NGƯỜI NÓI trơn — chỗ này đặt thưa vài ô đơn/ô
 * lệch cho đỡ đơn điệu, nhưng CHỈ ở câu đặc biệt, không rải khắp.
 *
 * "Đặc biệt" = câu có TỪ NHẤN (caption `keywords` khác rỗng) — chặng `keywords` đã
 * chọn sẵn những câu mang tin. Không cần mô hình: đã có mốc thật thì một phép chọn
 * đủ, đúng lối bộ xếp lịch cũ.
 *
 * NGÂN SÁCH: ~30% thời-gian-CÒN-LẠI (tổng − b-roll). Cách nhau tối thiểu để không
 * nhấp nháy. Chạy MỘT LẦN (đã có ô người thì thôi) — xoá đi không tự mọc lại.
 */

/** Phần thời-gian-còn-lại nhắm cho ô người. */
const TARGET_SHARE = 0.3;
/** Hai ô người cách nhau tối thiểu, không thì đổi khung liên tục thành nhiễu. */
const MIN_GAP_SECONDS = 6;
/** Ô người dài quá thì mất nhịp — bỏ qua câu quá dài. */
const MAX_SECONDS = 5;

type Span = { fromWordId: string; toWordId: string; start: number; end: number };

export function placePersonLayouts(projectId: string): { placed: number } {
  const pack = readStylePack(projectId);
  const personLayouts = pack.layouts.filter(
    (id) => !findLayout(id).needsInsert && id !== "toan-khung",
  );
  if (personLayouts.length === 0) return { placed: 0 };

  // Đã có Ô NGƯỜI → không gieo lại. Xoá đi rồi mở lại mà nó mọc lại thì người
  // dùng không xoá được gì — cùng luật `captions_seeded`.
  //
  // Chỉ đếm ô NGƯỜI (`media_file_id IS NULL`), KHÔNG đếm b-roll: b-roll cũng
  // `kind='layout'` nhưng có `media_file_id`. `ai-broll-place` có thể đã đặt b-roll
  // trước, đếm cả nó thì chặn nhầm và ô người không bao giờ được gieo — video mất
  // hẳn bố cục người dù bộ dáng có layout.
  const existing = (
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM elements WHERE project_id=? AND kind='layout' AND media_file_id IS NULL",
      )
      .get(projectId) as { n: number }
  ).n;
  if (existing > 0) return { placed: 0 };

  const total = (
    db
      .prepare(
        "SELECT COALESCE(SUM(duration),0) AS t FROM media_files WHERE project_id=? AND role='main'",
      )
      .get(projectId) as { t: number }
  ).t;
  if (total <= 0) return { placed: 0 };

  // B-roll đã đặt (giây gốc) — ô người tránh đè lên.
  const broll = db
    .prepare(
      `SELECT w1.start_sec AS start, w2.end_sec AS end
         FROM elements e
         JOIN words w1 ON w1.id = e.from_word_id
         JOIN words w2 ON w2.id = e.to_word_id
        WHERE e.project_id=? AND e.media_file_id IS NOT NULL`,
    )
    .all(projectId) as Array<{ start: number; end: number }>;
  const brollTime = broll.reduce((sum, b) => sum + (b.end - b.start), 0);
  const target = TARGET_SHARE * Math.max(0, total - brollTime);
  if (target <= 0) return { placed: 0 };

  // Câu ĐẶC BIỆT = caption có từ nhấn, theo mốc bắt đầu.
  const specials = db
    .prepare(
      `SELECT e.from_word_id AS fromWordId, e.to_word_id AS toWordId,
              w1.start_sec AS start, w2.end_sec AS end
         FROM elements e
         JOIN words w1 ON w1.id = e.from_word_id
         JOIN words w2 ON w2.id = e.to_word_id
        WHERE e.project_id=? AND e.kind='text'
          AND e.keywords IS NOT NULL AND e.keywords<>''
        ORDER BY w1.start_sec`,
    )
    .all(projectId) as Span[];

  const overlapsBroll = (s: Span) =>
    broll.some((b) => s.start < b.end && s.end > b.start);

  const insert = db.prepare(
    `INSERT INTO elements (id, project_id, kind, from_word_id, to_word_id, position_band, insert_layout, align, emphasis, reveal, shape)
     VALUES (?,?,'layout',?,?,'top',?,'center','taper','none','full')`,
  );

  let used = 0;
  let lastEnd = -Infinity;
  let placed = 0;
  for (const s of specials) {
    if (used >= target) break;
    if (s.end - s.start > MAX_SECONDS) continue;
    if (s.start - lastEnd < MIN_GAP_SECONDS) continue;
    if (overlapsBroll(s)) continue;
    // Xoay vòng ô đơn / ô lệch cho đỡ lặp hình.
    const layout = personLayouts[placed % personLayouts.length];
    insert.run(newId("e"), projectId, s.fromWordId, s.toWordId, layout);
    used += s.end - s.start;
    lastEnd = s.end;
    placed += 1;
  }

  return { placed };
}
