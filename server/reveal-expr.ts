/**
 * Hiệu ứng HIỆN CHỮ cho bản in ra, viết bằng biểu thức thời gian của ffmpeg.
 *
 * Ba luật lấy nguyên từ `src/dev/overlays/use-reveal-loop.ts` — trang xem và bản
 * in phải là một, nên mọi con số ở đây đều có bản sinh đôi ở đó:
 *
 * 1. **Hiện theo TỪNG TIẾNG.** Cả cụm bật ra một lượt thì mắt không biết bắt đầu
 *    đọc từ đâu, và nó không khớp với việc người nói đang nói lần lượt. Đây là
 *    khác biệt lớn nhất giữa "có làm đồ hoạ" và "có gắn phụ đề".
 * 2. **Hướng trượt suy từ CỠ chữ.** Chữ nhỏ trượt ngang quãng ngắn (trùng hướng
 *    đọc nên gần như không thấy); chữ lớn trượt từ dưới lên quãng dài hơn.
 * 3. **Nhịp dòng thưa hơn nhịp tiếng.** Mỗi dòng là một ý; các tiếng trong một
 *    dòng thuộc cùng một ý nên phải đọc liền.
 *
 * Vì sao viết bằng biểu thức chứ không dựng từng khung hình: `drawtext` nhận
 * `alpha`, `x`, `y` là biểu thức có biến `t`, nên cả hiệu ứng chỉ tốn đúng một
 * lệnh vẽ cho mỗi tiếng. Dựng khung thì phải sinh vài trăm ảnh PNG trong suốt
 * cho mỗi cụm.
 */

/** Thời gian một tiếng hiện xong. Khớp `ENTER_SECONDS`. */
export const ENTER_SECONDS = 0.3;

/** Từ 14% bề rộng khung trở lên là CHỮ LỚN — trượt dọc, quãng dài. */
export const LARGE_SCALE = 0.14;

/** Quãng trượt: chữ nhỏ 3,5% bề rộng CHÍNH NÓ, chữ lớn 24% chiều cao dòng của nó. */
const SMALL_SHIFT = 0.035;
const LARGE_SHIFT = 0.24;

/** Chiều cao hộp một tiếng — `lineHeight: 1.15` bên trang xem. */
const LINE_BOX = 1.15;

/** Trễ của tiếng thứ `col` ở hàng thứ `row`. Khớp `unitDelay`. */
export function unitDelay(row: number, col: number) {
  return 0.06 + row * 0.16 + col * 0.07;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Phần CÒN LẠI của chuyển động tại thời điểm `t`, viết thành biểu thức ffmpeg.
 *
 * `easeOutExpo` là `1 - 2^(-10u)`, nên phần còn lại đúng bằng `2^(-10u)` — khỏi
 * phải viết phép trừ hai lần. `u` bị kẹp trong [0,1] để trước lúc tới lượt thì
 * đứng yên ở vị trí xuất phát, và sau khi xong thì không trôi tiếp.
 */
function restExpr(startAt: number) {
  const t0 = round(startAt);
  return `pow(2,-10*clip((t-${t0})/${ENTER_SECONDS},0,1))`;
}

/**
 * Biểu thức `alpha` của một tiếng: mờ dần thành rõ, rồi giữ nguyên độ đục của màu.
 *
 * Nhân sẵn độ đục của MÀU vào đây thay vì viết vào `fontcolor`: `drawtext` nhân
 * hai lớp đục với nhau, để riêng thì chữ nhạt gấp đôi ý muốn.
 */
export function alphaExpr(startAt: number, colorAlpha: number) {
  return `${round(colorAlpha)}*(1-${restExpr(startAt)})`;
}

/**
 * Toạ độ của một tiếng trong lúc hiện ra.
 *
 * Trả cả `x` và `y` dù chỉ một trục động: trục còn lại là hằng số, và để ffmpeg
 * nhận một chuỗi số cũng không tốn gì.
 */
export function positionExpr(options: {
  x: number;
  y: number;
  /** Bề rộng đã đo của tiếng này, tính bằng pixel */
  width: number;
  fontSize: number;
  /** Cỡ chữ theo tỉ lệ bề rộng khung — quyết định trượt ngang hay trượt dọc */
  scale: number;
  startAt: number;
}) {
  const rest = restExpr(options.startAt);
  if (options.scale < LARGE_SCALE) {
    const shift = round(options.width * SMALL_SHIFT);
    return { x: `${options.x}-${shift}*${rest}`, y: `${options.y}` };
  }
  const shift = round(options.fontSize * LINE_BOX * LARGE_SHIFT);
  return { x: `${options.x}`, y: `${options.y}+${shift}*${rest}` };
}
