import type { LayoutKindId } from "./layout-kinds";
import type { FrameBlock } from "./style-pack";
import type { ScheduledScene } from "./timing";

/**
 * XẾP LỊCH MÀN — nay THƯA, không tile kín phim.
 *
 * ══ VÌ SAO ĐỔI ══
 *
 * Bản trước chia CẢ phim thành màn liền nhau rồi tự gán bố cục (ô đơn/ô lệch xoay
 * vòng), kể cả những màn toàn-khung mặc định. Từ đó đẻ ra: cờ "máy tự / người
 * sửa", khối mờ trên dải, và một cái "lỗ" phải tự lấp khi b-roll co lại.
 *
 * Mô hình mới: **toàn-khung là MẶC ĐỊNH, không phải một màn được vẽ ra.** Chỉ chỗ
 * nào KHÁC mặc định mới là một segment — ô người hoặc b-roll — do máy gợi ý hoặc
 * người đặt, và được LƯU lại (neo theo từ). Giống hệt dải Chuyển cảnh: vắng dấu =
 * cắt thẳng; ở đây vắng segment = toàn-khung.
 *
 * Nên hàm này không còn "xếp" gì nhiều: nhận các segment ĐÃ ĐẶT (mốc trên trục đã
 * cắt, bố cục đã chọn), kẹp vào phim, bỏ đoạn chồng, xếp theo mốc — và trả về.
 * Khoảng giữa các segment KHÔNG sinh màn: bản dựng vẽ video phủ kín ở đó.
 *
 * Thiết bị nhấn (hero/push) tạm để trống — nó là hoa lá của bộ auto-tile cũ; sau
 * sẽ thành một setting của riêng từng segment.
 */

/** Một segment bố cục ĐÃ ĐẶT trên trục đã cắt. `insert` có = b-roll. */
export type PlacedSegment = {
  start: number;
  end: number;
  layout: LayoutKindId;
  /** Chỉ số tư liệu (tra vào mảng inserts) nếu là b-roll; thiếu = ô người. */
  insert?: number;
  /** Mã element của segment — để màn hình sửa/xoá. */
  elementId?: string;
  /** Look Ô (nền/viền/dồn) đã đóng dấu — cảnh mang look riêng của nó. */
  frameBlock?: FrameBlock;
};

/**
 * Trả lịch màn THƯA từ các segment đã đặt.
 *
 * Kẹp vào `[0, total]`, bỏ đoạn hỏng, xếp theo mốc bắt đầu, bỏ đoạn CHỒNG lên đoạn
 * trước (một khoảnh khắc chỉ một bố cục). Không lấp khoảng trống — đó là toàn-khung.
 */
export function scheduleScenes(
  total: number,
  segments: readonly PlacedSegment[],
): ScheduledScene[] {
  if (total <= 0) return [];
  const clean = segments
    .map((seg) => ({
      start: Math.max(0, seg.start),
      end: Math.min(total, seg.end),
      layout: seg.layout,
      insert: seg.insert,
      elementId: seg.elementId,
      frameBlock: seg.frameBlock,
    }))
    .filter((seg) => seg.end > seg.start)
    .sort((a, b) => a.start - b.start);
  // So chồng với cảnh GIỮ cuối, KHÔNG với phần tử mảng liền trước.
  //
  // Bản trước dùng `arr[i-1].end` — mà `arr[i-1]` có thể là cảnh VỪA BỊ BỎ vì
  // chồng, và đuôi nó thường xa hơn. Hệ quả: một cảnh HỢP LỆ (không đè cảnh nào
  // đang giữ) bị bỏ oan chỉ vì đứng sau một cảnh bị loại có đuôi dài. Ví dụ
  // A[0-3] giữ, B[2-10] bỏ (đè A), C[5-8] KHÔNG đè A nhưng `5>=B.end(10)` sai →
  // C rớt. Giữ mốc đuôi của cảnh GIỮ CUỐI thì C được so đúng với A và ở lại.
  const kept: typeof clean = [];
  for (const seg of clean) {
    if (kept.length === 0 || seg.start >= kept[kept.length - 1].end) {
      kept.push(seg);
    }
  }
  return kept.map(
      (seg): ScheduledScene => ({
        start: seg.start,
        end: seg.end,
        layout: seg.layout,
        hero: null,
        insert: seg.insert,
        push: false,
        elementId: seg.elementId,
        frameBlock: seg.frameBlock,
      }),
    );
}

/**
 * Lấp khoảng trống bằng màn TOÀN-KHUNG — CHỈ cho đường dựng ffmpeg.
 *
 * Lịch thưa để trống chỗ mặc định; nhưng `layoutPlan` lấy NỀN TRANG làm luồng
 * nền, nên chỗ trống sẽ ra nền trang trơ chứ không ra video phủ kín. Lấp bằng
 * `toan-khung` (ô chính phủ kín, che hết nền trang) thì chỗ trống lại ra đúng
 * video phủ kín — khớp KHUNG XEM (nơi vắng màn tự vẽ full-frame). Khung xem không
 * cần lấp: nó không dựng nền trang liên tục.
 */
export function fillFullFrame(
  schedule: readonly ScheduledScene[],
  total: number,
): ScheduledScene[] {
  const out: ScheduledScene[] = [];
  let cursor = 0;
  const full = (start: number, end: number): ScheduledScene => ({
    start,
    end,
    layout: "toan-khung",
    hero: null,
  });
  for (const scene of schedule) {
    if (scene.start > cursor + 0.01) out.push(full(cursor, scene.start));
    out.push(scene);
    cursor = scene.end;
  }
  if (total > cursor + 0.01) out.push(full(cursor, total));
  return out;
}

