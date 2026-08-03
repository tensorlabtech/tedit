/**
 * ĐƯỜNG VẼ RIÊNG cho dòng tiêu đề — tách hẳn khỏi đường bố cục của phụ đề.
 *
 * ## Vì sao phải là một tệp riêng
 *
 * Phụ đề mang một lời hứa: **chữ không bao giờ tràn khung**. Lời hứa đó do bốn
 * hằng giữ (`SAFE` · `MAX_BLOCK_SHARE` · `MAX_LINES` · `MIN_SCALE`) và nay có
 * `scripts/layout-guard/` canh. Tiêu đề thì ngược lại: tràn mép là DÁNG.
 *
 * Cho hai loại chữ đi chung một đường rồi thêm một cờ "cái này được tràn" là mất
 * lời hứa kia **một lần cho tất cả** — từ đó về sau không ai còn khẳng định được
 * phụ đề nằm trong khung nữa, vì đường bố cục đã có một nhánh nói không.
 *
 * Nên tệp này KHÔNG gọi `layoutText()` cũng KHÔNG gọi `placeWords()`, và ngược
 * lại đường phụ đề không đọc `pack.title`. `style-pack-check.ts` quét mã nguồn
 * canh đúng hai điều đó — cùng cách nó canh `pack.defaults`.
 *
 * Nó VẪN dùng `textWidth` và `inkTopOffset`: đó là phép ĐO, không phải phép bố
 * cục. Đo bằng đúng tệp font sẽ in là ràng buộc chung của cả hệ, và có hai bản
 * đo khác nhau mới là chỗ sinh lỗi.
 */
import {
  headlineRoom,
  headlineTopShare,
  trimHeadline,
  type ShownPack,
  type Tone,
} from "./style-pack";
import { inkTopOffset, textWidth, usableWidthOf } from "./text-layout";

export type HeadlineDraw = {
  text: string;
  fontSize: number;
  /** Toạ độ mép trái. ÂM khi chữ tràn qua mép trái — đó là ý đồ, không phải lỗi. */
  x: number;
  y: number;
  tone: Tone;
  /** Có phải đã thu cỡ so với `sizeShare` bộ dáng khai hay không. */
  shrunk: boolean;
};

/**
 * Chỗ đứng và cỡ chữ của dòng tiêu đề. `null` là không vẽ gì.
 *
 * MỘT dòng, không bao giờ bẻ dòng: tiêu đề bẻ hai dòng thì nó đọc ra như một cụm
 * phụ đề khổ lớn, mất hẳn cái vai "đại diện cho cả video".
 *
 * Cỡ chữ lấy thẳng từ `sizeShare` và **chỉ thu khi buộc phải**: chữ dài quá chỗ
 * nó có thì thu cho vừa, chứ không cắt bớt tiếng. Chọn thu chứ không chọn cắt vì
 * tiêu đề chỉ có 3–6 tiếng — mất một tiếng là mất một phần sáu ý, còn nhỏ đi 15%
 * thì không ai nhận ra. Trần ký tự ở trên chặn ca bất thường trước khi tới đây.
 */
export async function layoutHeadline(
  raw: string | null | undefined,
  pack: ShownPack,
  frameWidth: number,
  frameHeight: number,
): Promise<HeadlineDraw | null> {
  if (!pack.title) return null;
  const text = trimHeadline(raw ?? "");
  // Tiêu đề rỗng thì KHÔNG vẽ gì — không vẽ một chuỗi rỗng, vì `drawtext` với
  // chuỗi rỗng vẫn dựng một lệnh lọc và vẫn tốn một lượt vẽ mỗi khung hình.
  if (!text) return null;

  // Lề an toàn lấy ở dải TRÊN — dải rộng nhất trong ba dải. Tiêu đề không
  // thuộc dải nào của phụ đề, nên lấy dải hẹp nhất là bóp nó vô cớ.
  const room = headlineRoom(
    pack.title,
    frameWidth,
    usableWidthOf("top", frameWidth),
  );
  let fontSize = Math.round(frameWidth * pack.title.sizeShare);
  let width = await textWidth(text, fontSize, pack);
  let shrunk = false;
  if (width > room) {
    // Bề rộng tỉ lệ thuận với cỡ chữ nên chia một lần là đủ; `floor` để phần dôi
    // rơi về phía an toàn.
    fontSize = Math.max(1, Math.floor((fontSize * room) / width));
    width = await textWidth(text, fontSize, pack);
    shrunk = true;
  }

  // Cùng phép bù chân chữ như phụ đề: `drawtext` neo theo mép trên VỆT MỰC, nên
  // tiêu đề có dấu chồng dấu sẽ tụt xuống nếu không cộng khoảng trống phía trên.
  const inkTop = Math.round(await inkTopOffset(text, fontSize, pack));
  return {
    text,
    fontSize,
    // Căn giữa theo bề ngang khung. Ra số ÂM khi chữ rộng hơn khung — đúng ý đồ
    // của `bleed`, và `drawtext` nhận `x` âm.
    x: Math.round((frameWidth - width) / 2),
    y: Math.round(frameHeight * headlineTopShare(pack, fontSize / frameHeight)) + inkTop,
    tone: pack.title.tone,
    shrunk,
  };
}
