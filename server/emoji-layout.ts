// Lấy kiểu từ `style-pack.ts` chứ không từ `text-layout.ts`: tệp này phải nạp
// được ở TRÌNH DUYỆT, mà `text-layout.ts` có `node:*` — kể cả `import type`
// cũng đủ để TypeScript của phía web đi kiểm cả tệp đó và báo lỗi.
import type { Band, StylePack } from "./style-pack";

/**
 * Chỗ đứng của emoji so với khối chữ — MỘT luật cho cả hai đường vẽ.
 *
 * Cùng vai trò với `insert-reveal.ts` và `reveal-expr.ts`: tệp này không vẽ gì,
 * nó chỉ trả về con số để bên `render.ts` dựng bộ lọc và bên
 * `overlay-render.tsx` dựng CSS. Chép luật ra hai chỗ là hai chỗ trôi khỏi nhau.
 *
 * ## Vì sao emoji KHÔNG chen vào bố cục chữ
 *
 * Cách hiển nhiên là coi emoji như một hàng nữa của khối. Nhưng làm thế thì nó
 * đụng vào `MAX_LINES`, đụng `MAX_BLOCK_SHARE`, và đụng phép đo bề rộng — tức là
 * đụng đúng ba thứ đang giữ lời hứa "chữ không bao giờ tràn khung". Đổi lấy một
 * cái emoji thì không đáng.
 *
 * Nên emoji NỔI bên ngoài khối: khối chữ đặt ở đâu thì đặt, emoji bám vào mép
 * trên hoặc mép dưới của nó. Bố cục chữ không đổi một điểm ảnh nào, và phép so
 * hai đường vẽ (`scripts/overlay-parity/`) vẫn đo đúng thứ nó đang đo.
 */

export type EmojiSpot = {
  /** Bám mép nào của khối chữ */
  side: "above" | "below";
  /**
   * Cạnh của hình vuông emoji, cùng ĐƠN VỊ với `largestFontSize` truyền vào.
   *
   * KHÔNG làm tròn ở đây: máy chủ truyền vào điểm ảnh và cần số nguyên cho
   * ffmpeg, còn trang xem truyền vào `cqw` — đơn vị mà `1` đã là 10,8 điểm ảnh,
   * nên làm tròn ở đây là trang xem lệch hẳn một nấc so với bản xuất. Bên nào
   * cần số nguyên thì bên đó làm tròn.
   */
  size: number;
  /** Khoảng hở giữa emoji và mép khối, cùng đơn vị với `size` */
  gap: number;
};

/**
 * Hở bằng 22% cạnh emoji: sát quá thì emoji đọc ra như một chữ cái của dòng đầu,
 * xa quá thì nó đọc ra như một vật rời không liên quan tới cụm.
 */
const GAP_SHARE = 0.22;

/**
 * Kẹp mép TRÊN của emoji vào trong lề an toàn.
 *
 * Ca xấu nhất là có thật: khối ba hàng ở dải `middle` với cỡ chữ trần thì mép
 * trên khối đã gần chạm lề, và emoji đặt phía trên sẽ nhô ra ngoài. Thà lệch
 * khỏi khoảng hở đã canh còn hơn một nửa cái emoji bị cắt cụt — cùng cách xử lý
 * mà `placeWords` dùng cho chữ tràn mép.
 */
export function clampEmojiTop(
  top: number,
  size: number,
  frameHeight: number,
  safe: { top: number; bottom: number },
): number {
  const highest = Math.round(frameHeight * safe.top);
  const lowest = Math.round(frameHeight * (1 - safe.bottom)) - size;
  return Math.max(highest, Math.min(top, lowest));
}

/**
 * Emoji bám mép nào — quyết định THEO DẢI, không theo phép đo.
 *
 * Dải `top` neo ở 12% chiều cao mà lề an toàn trên là 10%, nên phía trên khối chỉ
 * còn 2% khung — không đủ chỗ cho một hình cao chừng 10%. Hai dải kia thì phía
 * trên rộng rãi.
 *
 * Quyết theo dải chứ không theo "còn chỗ thì để trên": luật phụ thuộc phép đo là
 * luật mà hai đường vẽ có thể tính ra hai kết quả khác nhau khi phép đo lệch một
 * điểm ảnh, và lúc đó emoji nhảy từ trên xuống dưới giữa trang xem và bản xuất.
 */
export function emojiSpot(
  band: Band,
  largestFontSize: number,
  pack: StylePack,
): EmojiSpot | null {
  const emoji = pack.emoji;
  if (!emoji) return null;
  const size = largestFontSize * emoji.scale;
  return {
    side: band === "top" ? "below" : "above",
    size,
    gap: size * GAP_SHARE,
  };
}
