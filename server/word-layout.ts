import {
  BAND_ANCHOR,
  MAX_LINES,
  SAFE,
  advanceWidth,
  LINE_HEIGHT,
  WORD_GAP,
  fitLines,
  indentShare,
  textWidth,
  usableWidthOf,
  type AlignId,
  type Band,
  type EmphasisId,
} from "./text-layout";

/**
 * Xếp một cụm chữ theo TỪNG TIẾNG — mỗi tiếng có cỡ và toạ độ riêng.
 *
 * Dùng khi trục **nhấn** khác `deu`. Cỡ đều nhau thì đi đường `layoutText`: bẻ dòng
 * rồi in mỗi dòng một lệnh, nhẹ hơn nhiều.
 *
 * Chia việc đúng như bên trang xem (`src/dev/overlays/overlay-render.tsx`):
 * **nhấn** chia hàng và định cỡ, **căn** chỉ đặt hàng theo bề ngang. Hai bên phải
 * cùng luật, không thì xem một đằng xuất một nẻo.
 *
 * Người dùng chỉ CHỌN hai trục và đánh dấu từ khoá; mọi số đo do đây tính. Cho kéo
 * thả tự do từng tiếng là ném đi bảo đảm "chữ không bao giờ tràn khung".
 */

export type PlacedWord = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  /** Hàng thứ mấy và tiếng thứ mấy trong hàng — hiệu ứng hiện ra so le theo hai số này */
  row: number;
  col: number;
  /** Màu nền chữ dạng `#RRGGBB`, khớp bảng màu của trang xem */
  color: string;
  /** Độ đục của màu, tách khỏi màu để nhân chung với độ đục của hiệu ứng hiện ra */
  alpha: number;
};

/**
 * Ba mức màu, chép từ `COLOR` của `overlay-render.tsx`.
 *
 * Chữ thường hơi trong một chút, chữ nhấn trắng đặc, chữ dẫn thì xám và mờ. Ba
 * mức này là thứ tạo ra lớp lang trong khối chữ — in tất cả bằng trắng đặc thì
 * mọi tiếng cùng hét lên và không tiếng nào nổi.
 */
const COLOR = {
  main: { color: "#FFFFFF", alpha: 0.92 },
  soft: { color: "#FFFFFF", alpha: 1 },
  dim: { color: "#D6DBE0", alpha: 0.72 },
};

/** Trần và sàn cỡ chữ theo tỉ lệ BỀ RỘNG khung — cùng bộ số với trang xem. */
const MAX_SCALE = 0.15;
const MIN_SCALE = 0.09;


type Piece = { text: string; keyword: boolean };
type Sized = {
  text: string;
  fontSize: number;
  color: string;
  alpha: number;
};

/** Tách cụm thành từng tiếng, đánh dấu tiếng nào là từ khoá. */
export function splitPieces(content: string, keywords: string[]): Piece[] {
  const marked = new Set(keywords.map((word) => word.toLowerCase()));
  return content
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => ({ text, keyword: marked.has(text.toLowerCase()) }));
}

/** Dồn các tiếng vào tối đa `MAX_LINES` hàng. */
function packRows(pieces: Piece[]) {
  const perRow = Math.ceil(pieces.length / MAX_LINES);
  const rows: Piece[][] = [];
  for (let i = 0; i < pieces.length; i += perRow) {
    rows.push(pieces.slice(i, i + perRow));
  }
  return rows;
}

/**
 * Cỡ lớn nhất mà một hàng còn nằm trong bề rộng cho phép — trả về TỈ LỆ bề rộng khung.
 *
 * `usable` và phép đo đều tính bằng pixel, còn trần cỡ là tỉ lệ; chia cho bề rộng
 * khung để hai vế cùng đơn vị. Thiếu phép chia này thì `byWidth` ra một con số
 * pixel luôn lớn hơn trần, `Math.min` luôn chọn trần, và chữ dài bao nhiêu cũng
 * in ở cỡ tối đa rồi chạy ra ngoài khung.
 */
async function fitRow(
  text: string,
  usable: number,
  rows: number,
  videoWidth: number,
) {
  const byHeight = MAX_SCALE * (rows > 2 ? 0.7 : rows > 1 ? 0.85 : 1);
  // Đo ở cỡ 100 rồi suy: bề rộng tỉ lệ thuận với cỡ chữ.
  const at100 = await textWidth(text, 100);
  const perUnit = Math.max(0.001, at100 / 100);
  const byWidth = (usable * 0.98) / (perUnit * videoWidth);
  return Math.max(MIN_SCALE, Math.min(byHeight, byWidth));
}

/** Trục NHẤN: chia hàng và định cỡ. Đây là chỗ DUY NHẤT quyết định cỡ chữ. */
async function buildRows(
  pieces: Piece[],
  emphasis: EmphasisId,
  usable: number,
  videoWidth: number,
): Promise<Sized[][]> {
  const px = (scale: number) => Math.round(videoWidth * scale);

  if (emphasis === "keyword-large") {
    // Đoạn từ khoá LIỀN NHAU phóng to, phần trước lên trên, phần sau xuống dưới.
    // Bốc riêng tiếng từ khoá dài nhất ra giữa là đảo thứ tự chữ của người dùng.
    const marked = pieces.map((piece) => piece.keyword);
    const from = marked.indexOf(true);
    let last = from;
    while (last + 1 < pieces.length && marked[last + 1]) last += 1;
    const hero = from >= 0 ? pieces.slice(from, last + 1) : [pieces[0]];
    const before = from >= 0 ? pieces.slice(0, from) : pieces.slice(1);
    const after = from >= 0 ? pieces.slice(last + 1) : [];
    const heroText = hero.map((piece) => piece.text).join(" ");
    const heroScale = await fitRow(heroText, usable, 1, videoWidth);
    const small = Math.min(heroScale * 0.4, 0.075);
    const row = (list: Piece[], scale: number, tone: (typeof COLOR)["main"]) =>
      list.map((piece) => ({
        text: piece.text,
        fontSize: px(scale),
        ...tone,
      }));
    return [
      ...(before.length > 0 ? [row(before, small, COLOR.dim)] : []),
      row(hero, heroScale, COLOR.soft),
      ...(after.length > 0 ? [row(after, small, COLOR.dim)] : []),
    ];
  }

  if (emphasis === "mixed-size") {
    const SMALL = 0.55;
    // Chưa đánh dấu tiếng nào thì XEN THEO THỨ TỰ — cùng luật với trang xem.
    // Không có bước này thì cả cụm ra một cỡ nhỏ, đúng cái tên hứa ngược lại.
    const hasKeyword = pieces.some((piece) => piece.keyword);
    const to = (piece: Piece, index: number) =>
      hasKeyword ? piece.keyword : index % 2 === 0;
    // Cỡ giải từ TỔNG bề rộng của các cỡ khác nhau: coi cả hàng cùng một cỡ thì ước
    // rộng gần gấp đôi thật và chữ bị co quắt lại.
    const scaleOf = async (list: Piece[], offset = 0) => {
      let width = 0;
      for (const [index, piece] of list.entries()) {
        const at100 = await textWidth(piece.text, 100);
        width +=
          (at100 / 100) * (to(piece, offset + index) ? 1 : SMALL) + WORD_GAP;
      }
      // Cùng lý do như `fitRow`: quy về tỉ lệ bề rộng khung trước khi so với trần.
      return Math.min(
        MAX_SCALE,
        (usable * 0.98) / (Math.max(0.001, width) * videoWidth),
      );
    };
    // Một hàng là dáng gốc; chật quá thì xuống hàng, KHÔNG hạ cỡ xuống chữ chú thích.
    const rows = (await scaleOf(pieces)) < 0.1 ? packRows(pieces) : [pieces];
    const out: Sized[][] = [];
    let seen = 0;
    for (const row of rows) {
      const offset = seen;
      seen += row.length;
      const scale = await scaleOf(row, offset);
      out.push(
        row.map((piece, index) => {
          const big = to(piece, offset + index);
          return {
            text: piece.text,
            fontSize: px(big ? scale : scale * SMALL),
            ...(big ? COLOR.soft : COLOR.main),
          };
        }),
      );
    }
    return out;
  }

  if (emphasis === "even") {
    // Cỡ đều: bẻ dòng theo bề rộng rồi dùng CHUNG một cỡ — dáng phụ đề khổ lớn.
    // Vẫn trả về từng tiếng chứ không trả cả dòng, vì hiệu ứng hiện ra chạy theo
    // TIẾNG. Gộp dòng lại thì cả dòng bật ra một lượt, mất đúng thứ làm nên nhịp.
    const content = pieces.map((piece) => piece.text).join(" ");
    const { lines, scale } = await fitLines(content, usable, videoWidth);
    const marked = new Map(
      pieces.map((piece) => [piece.text.toLowerCase(), piece.keyword]),
    );
    return lines.map((line) =>
      line
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => ({
          text: word,
          fontSize: px(scale),
          ...(marked.get(word.toLowerCase()) ? COLOR.soft : COLOR.main),
        })),
    );
  }

  // Dẫn nhỏ · ý to: hàng đầu là dẫn nhập nên nhỏ và mờ, hàng sau mới là ý.
  const rows = packRows(pieces);
  const out: Sized[][] = [];
  for (const [index, row] of rows.entries()) {
    const text = row.map((piece) => piece.text).join(" ");
    const lead = index === 0 && rows.length > 1;
    const scale = lead
      ? (await fitRow(text, usable, 3, videoWidth)) * 0.45
      : await fitRow(text, usable, rows.length, videoWidth);
    out.push(
      row.map((piece) => ({
        text: piece.text,
        fontSize: px(scale),
        ...(lead ? COLOR.dim : piece.keyword ? COLOR.soft : COLOR.main),
      })),
    );
  }
  return out;
}

/**
 * Bề rộng thật của một hàng: các tiếng trước tính theo BƯỚC TIẾN, tiếng cuối tính
 * theo VẾT MỰC.
 *
 * Tiếng cuối phải tính vết mực vì nét nghiêng của nó là thứ chạm mép khung —
 * tính bước tiến thì hàng căn phải bị nhô ra ngoài lề.
 */
async function rowWidth(row: Sized[]) {
  let width = 0;
  for (const [index, word] of row.entries()) {
    if (index === row.length - 1) {
      width += await textWidth(word.text, word.fontSize);
    } else {
      width +=
        (await advanceWidth(word.text, word.fontSize)) +
        word.fontSize * WORD_GAP;
    }
  }
  return width;
}

export async function placeWords(
  content: string,
  keywords: string[],
  align: AlignId,
  emphasis: EmphasisId,
  band: Band,
  videoWidth: number,
  videoHeight: number,
): Promise<PlacedWord[]> {
  const pieces = splitPieces(content, keywords);
  if (pieces.length === 0) return [];

  const usable = usableWidthOf(band, videoWidth);
  const left = Math.round(videoWidth * SAFE.left);
  const right = left + usable;
  const rows = await buildRows(pieces, emphasis, usable, videoWidth);

  // Chiều cao cả khối để neo được từ mép DƯỚI: hai dải dưới mọc lên, không thì khối
  // ba hàng chữ khổ lớn ở dải `bottom` chạy hẳn ra ngoài đáy khung.
  // Lấy thẳng `LINE_HEIGHT` chứ không chép số: trước đây chỗ này ghi 1,15 còn
  // `text-layout.ts` ghi 1,28 — hai bên đo cùng một khối ra hai chiều cao khác
  // nhau, và dải dưới đội chữ lên khỏi chỗ đã canh.
  const rowHeights = rows.map((row) =>
    Math.round(Math.max(...row.map((word) => word.fontSize)) * LINE_HEIGHT),
  );
  const total = rowHeights.reduce((sum, height) => sum + height, 0);
  const anchor = BAND_ANCHOR[band];
  // Nửa khoảng đệm dòng: `lineHeight` bên trang xem đẩy nét chữ xuống một
  // nửa phần dôi so với mép hộp dòng, còn `drawtext` đặt chữ ngay mép trên. Bỏ
  // qua thì cả khối in ra cao hơn bản xem chừng 2% chiều cao khung.
  const halfLeading = Math.round(
    (rows[0]?.reduce((max, word) => Math.max(max, word.fontSize), 0) ?? 0) *
      ((LINE_HEIGHT - 1) / 2),
  );
  let y =
    anchor.edge === "top"
      ? Math.round(videoHeight * anchor.at) + halfLeading
      : anchor.edge === "bottom"
        ? Math.round(videoHeight * anchor.at - total) + halfLeading
        : // Giữa: neo bằng TÂM khối, cao mấy dòng cũng tự căn giữa.
          Math.round(videoHeight * anchor.at - total / 2) + halfLeading;

  const out: PlacedWord[] = [];
  for (const [index, row] of rows.entries()) {
    const shift = Math.round(usable * indentShare(align, index, rows.length));
    const width = await rowWidth(row);
    let x: number;
    if (align === "center") x = Math.round(left + (usable - width) / 2);
    else if (align === "right") x = Math.round(right - width - shift);
    else x = left + shift;
    // Không bao giờ để tràn: thà lệch khỏi kiểu căn còn hơn chữ ra ngoài khung.
    x = Math.max(left, Math.min(x, Math.round(right - width)));

    for (const [col, word] of row.entries()) {
      out.push({
        text: word.text,
        x,
        y,
        fontSize: word.fontSize,
        row: index,
        col,
        color: word.color,
        alpha: word.alpha,
      });
      x += Math.round(
        (await advanceWidth(word.text, word.fontSize)) +
          word.fontSize * WORD_GAP,
      );
    }
    y += rowHeights[index];
  }
  return out;
}
