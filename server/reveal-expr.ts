import type { ShownPack, StylePack } from "./style-pack";

/**
 * Hiệu ứng HIỆN CHỮ cho bản in ra, viết bằng biểu thức thời gian của ffmpeg.
 *
 * Ba luật lấy nguyên từ `src/dev/overlays/use-reveal-loop.ts` — trang xem và bản
 * in phải là một, nên mọi con số ở đây đều có bản sinh đôi ở đó. Nay cả sáu con
 * số nằm trong `motion` của bộ dáng, nên "một" nghĩa là hai bên đọc CÙNG một
 * pack chứ không phải hai bên chép cho khớp nhau:
 *
 * 1. **Hiện theo TỪNG TIẾNG.** Cả cụm bật ra một lượt thì mắt không biết bắt đầu
 *    đọc từ đâu, và nó không khớp với việc người nói đang nói lần lượt.
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

/** Trễ của tiếng thứ `col` ở hàng thứ `row`. Khớp `unitDelay` của trang xem. */
export function unitDelay(pack: Pick<StylePack, "motion">, row: number, col: number) {
  const { baseDelay, rowDelay, colDelay } = pack.motion;
  return baseDelay + row * rowDelay + col * colDelay;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Phần CÒN LẠI của chuyển động tại thời điểm `t`, viết thành biểu thức ffmpeg.
 *
 * `easeOutExpo` là `1 - 2^(-10u)`, nên phần còn lại đúng bằng `2^(-10u)` — khỏi
 * phải viết phép trừ hai lần. `u` bị kẹp trong [0,1] để trước lúc tới lượt thì
 * đứng yên ở vị trí xuất phát, và sau khi xong thì không trôi tiếp.
 */
function restExpr(startAt: number, enterSeconds: number) {
  const t0 = round(startAt);
  return `pow(2,-10*clip((t-${t0})/${enterSeconds},0,1))`;
}

/**
 * Biểu thức `alpha` của một tiếng: mờ dần thành rõ, rồi giữ nguyên độ đục của màu.
 *
 * Nhân sẵn độ đục của MÀU vào đây thay vì viết vào `fontcolor`: `drawtext` nhân
 * hai lớp đục với nhau, để riêng thì chữ nhạt gấp đôi ý muốn.
 */
export function alphaExpr(
  pack: ShownPack,
  startAt: number,
  colorAlpha: number,
) {
  // Tắt hiệu ứng thì độ đục là một HẰNG, không phải một biểu thức theo `t`. Trả
  // biểu thức luôn-bằng-hằng cũng ra hình đúng, nhưng ffmpeg phải tính lại nó ở
  // mỗi khung cho mỗi tiếng — với năm mươi cụm phụ đề thì đó là tiền thật.
  if (pack.motion.reveal === "none") return String(round(colorAlpha));
  const rest = restExpr(startAt, pack.motion.enterSeconds);
  return `${round(colorAlpha)}*(1-${rest})`;
}

/**
 * Toạ độ của một tiếng trong lúc hiện ra.
 *
 * Trả cả `x` và `y` dù chỉ một trục động: trục còn lại là hằng số, và để ffmpeg
 * nhận một chuỗi số cũng không tốn gì.
 */
export function positionExpr(
  pack: ShownPack,
  options: {
    x: number;
    y: number;
    /** Bề rộng đã đo của tiếng này, tính bằng pixel */
    width: number;
    fontSize: number;
    /** Cỡ chữ theo tỉ lệ bề rộng khung — quyết định trượt ngang hay trượt dọc */
    scale: number;
    startAt: number;
  },
) {
  const { reveal, enterSeconds, largeScale, smallShift, largeShift, lineBox } =
    pack.motion;
  // Tắt hiệu ứng thì toạ độ là hai con số cố định — không tiếng nào trượt vào.
  if (reveal === "none") {
    return { x: String(options.x), y: String(options.y) };
  }
  const rest = restExpr(options.startAt, enterSeconds);
  if (options.scale < largeScale) {
    const shift = round(options.width * smallShift);
    return { x: `${options.x}-${shift}*${rest}`, y: `${options.y}` };
  }
  const shift = round(options.fontSize * lineBox * largeShift);
  return { x: `${options.x}`, y: `${options.y}+${shift}*${rest}` };
}
