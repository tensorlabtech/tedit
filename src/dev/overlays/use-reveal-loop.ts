import { useEffect, useState } from "react";

import type { StylePack } from "../../../server/style-pack";

/**
 * Nhịp lặp để xem hiệu ứng hiện chữ.
 *
 * Ba luật chép từ `text-overlay-reveal.ts` của bản cũ, mỗi luật có lý do riêng:
 *
 * 1. **Luôn hiện theo TỪNG TIẾNG.** Cả cụm bật ra một lượt thì mắt không biết
 *    bắt đầu đọc từ đâu, và nó không khớp với việc người nói đang nói lần lượt.
 *
 * 2. **Hướng trượt suy từ CỠ chữ, không phải chọn tay.** Cùng một quãng trượt,
 *    chữ nhỏ trông như lướt nhẹ còn chữ lớn trông như bị quăng cả màn hình — vì
 *    mắt đọc quãng đó theo tỉ lệ với chiều cao chữ. Chữ nhỏ trượt NGANG quãng
 *    ngắn (trùng hướng đọc nên gần như không thấy); chữ lớn trượt từ DƯỚI LÊN
 *    quãng dài hơn, vì nó là thứ cần được chú ý.
 *
 * 3. **Nhịp dòng thưa hơn nhịp tiếng.** Mỗi dòng là một ý, còn các tiếng trong
 *    một dòng thuộc cùng một ý nên phải đọc liền.
 *
 * Ràng buộc: mọi kiểu phải xong trong ~0,9 giây. Đồ hoạ này sống trên dưới ba
 * giây; hiệu ứng ăn quá nửa thời gian đó thì người xem chỉ kịp thấy nó đang vào
 * rồi lại thấy nó đi.
 *
 * Sáu con số của nhịp nằm trong `motion` của bộ dáng — máy chủ đọc CÙNG khai báo
 * đó (`server/reveal-expr.ts`), nên hai bên không thể trôi khỏi nhau.
 */
const CYCLE_SECONDS = 4;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Vào rất nhanh rồi dừng êm — chuyển động thấy rõ mà không kịp thành cú giật. */
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/**
 * MỘT đồng hồ cho cả trang, không phải mỗi khung một vòng lặp.
 *
 * Mỗi khung tự chạy `requestAnimationFrame` riêng thì ba mươi khung lệch pha nhau,
 * và người xem không so được kiểu này với kiểu kia vì chúng không cùng thời điểm —
 * đúng thứ cần làm được ở trang đối chiếu.
 */
const listeners = new Set<(seconds: number) => void>();
let running = false;
let startedAt: number | null = null;

function tick(now: number) {
  startedAt ??= now;
  const seconds = ((now - startedAt) / 1000) % CYCLE_SECONDS;
  for (const listener of listeners) listener(seconds);
  if (listeners.size > 0) requestAnimationFrame(tick);
  else running = false;
}

/**
 * `active = false` thì KHÔNG đăng ký nghe — vòng lặp dừng hẳn khi không còn ai
 * nghe (xem `tick`).
 *
 * Cần vì màn chờ bày năm ô mẫu trong lúc ffmpeg đang chạy nền: năm vòng vẽ lại
 * ở 60 khung/giây tranh CPU với đúng việc người dùng đang chờ. Ô nào đang được
 * ngó thì chạy, còn lại đứng ở trạng thái đã hiện xong.
 */
export function useRevealLoop(active = true) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) return;
    listeners.add(setSeconds);
    if (!running) {
      running = true;
      requestAnimationFrame(tick);
    }
    return () => {
      listeners.delete(setSeconds);
    };
  }, [active]);

  return seconds;
}

/** Trễ của tiếng thứ `wordIndex` ở dòng thứ `lineIndex`. */
export function unitDelay(pack: StylePack, lineIndex: number, wordIndex = 0) {
  const { baseDelay, rowDelay, colDelay } = pack.motion;
  return baseDelay + lineIndex * rowDelay + wordIndex * colDelay;
}

/**
 * Style của một tiếng đang hiện ra. Trả style thẳng, không trả class — mỗi cỡ
 * chữ trượt theo trục khác nhau.
 */
export function revealStyle(
  pack: StylePack,
  seconds: number,
  lineIndex: number,
  scale: number,
  wordIndex = 0,
  /** Mốc riêng của tiếng này; bỏ trống thì suy ra từ hàng/cột */
  startAt?: number,
): React.CSSProperties {
  const { reveal, enterSeconds, largeScale, smallShift, largeShift } =
    pack.motion;
  // Tắt hiệu ứng: cả cụm đứng yên, rõ hẳn. KHÔNG trả `{}` — thẻ giữ nguyên
  // `opacity`/`transform` của lượt vẽ trước và cụm đứng lại ở giữa chừng.
  if (reveal === "none") return { opacity: 1, transform: "none" };
  const delay = startAt ?? unitDelay(pack, lineIndex, wordIndex);
  const p = easeOutExpo(clamp01((seconds - delay) / enterSeconds));
  const rest = 1 - p;
  if (scale < largeScale) {
    // Chữ nhỏ: trượt ngang từ trái, quãng rất ngắn.
    return { opacity: p, transform: `translateX(${-rest * smallShift * 100}%)` };
  }
  // Chữ lớn: từ dưới lên, quãng dài hơn để thấy được ở khổ này.
  return { opacity: p, transform: `translateY(${rest * largeShift * 100}%)` };
}
