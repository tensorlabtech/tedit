import type { InsertStrip } from "./use-insert-filmstrips";

/** Bề rộng một ô ảnh (px) — cùng cỡ với dải video chính. */
const CELL_WIDTH = 40;

/**
 * DẢI ẢNH của clip vẽ PHỦ khối b-roll trên dải thời gian, chỉ đoạn `[in,out]`
 * đang lấy. Cùng kỹ thuật với dải video chính: xếp ô rộng `CELL_WIDTH`, mỗi ô
 * lấy khung theo GIỜ NGUỒN (`in + x/pxPerSecond`) ở thang `nativeSecondWidth` nên
 * KHÔNG méo tỉ lệ. Kéo mép khối đổi `in`/bề rộng → dải trượt theo, thấy ngay đang
 * lấy đoạn nào. Toạ độ CỤC BỘ trong khối (0…bề rộng) nên khỏi lo trục nguồn/xuất.
 */
/** Chiều cao chuẩn mà `nativeSecondWidth` được tính (khớp `makeFilmstrip`). */
const NATIVE_LANE_HEIGHT = 56;

export function InsertFilmstrip({
  widthPx,
  heightPx,
  mediaIn,
  pxPerSecond,
  strip,
}: {
  /** Bề rộng khối (px) — bằng `(out−in) × pxPerSecond`. */
  widthPx: number;
  /** Chiều cao khối (px) — để scale thang ảnh cho KHỎI méo khi khối thấp hơn 56. */
  heightPx: number;
  /** Giây bắt đầu trong clip (điểm vào). */
  mediaIn: number;
  pxPerSecond: number;
  strip: InsertStrip;
}) {
  // Px/giây ở ĐÚNG chiều cao khối: `nativeSecondWidth` chuẩn cho 56px, khối thấp
  // hơn thì thu cả hai chiều theo cùng tỉ lệ → khung không méo.
  const nsw = (strip.nativeSecondWidth * heightPx) / NATIVE_LANE_HEIGHT;
  const count = Math.max(1, Math.ceil(widthPx / CELL_WIDTH));
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }, (_, index) => {
        const localX = index * CELL_WIDTH;
        // Giờ trong clip tại mép trái ô này: điểm vào + khoảng cách quy ra giây.
        const source = mediaIn + localX / pxPerSecond;
        return (
          <span
            key={index}
            className="absolute inset-y-0"
            style={{
              left: localX,
              width: CELL_WIDTH,
              backgroundImage: `url(${strip.url})`,
              backgroundSize: `${strip.seconds * nsw}px 100%`,
              backgroundPositionX: `${-source * nsw}px`,
              backgroundRepeat: "no-repeat",
            }}
          />
        );
      })}
    </span>
  );
}
