import {
  BAND_ANCHOR,
  MAX_LINES,
  SAFE,
  advanceWidth,
  fitLines,
  indentShare,
  inkTopOffset,
  textWidth,
  usableWidthOf,
  type AlignId,
  type Band,
  type EmphasisId,
} from "./text-layout";
import {
  boxPadShare,
  boxPadShareY,
  styleCase,
  type ShownPack,
  type Tone,
} from "./style-pack";

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

/**
 * Khối chữ đã xếp: các tiếng, kèm HỘP BAO của cả khối.
 *
 * Hộp bao là thứ bộ kiểm khớp bố cục đo để so trang xem với bản xuất, và nó phải
 * tính ở ĐÚNG chỗ đã tính ra `y` của từng hàng. Tính lại ở nơi khác nghĩa là chép
 * `halfLeading` và phép cộng chiều cao hàng sang một tệp thứ hai — hai bản chép
 * của cùng một phép đo là hai bản sẽ trôi khỏi nhau.
 */
export type PlacedBlock = {
  words: PlacedWord[];
  box: {
    /** Mép TRÊN hộp khối — khớp mép trên của thẻ bọc bên trang xem */
    top: number;
    /** Mép DƯỚI hộp khối */
    bottom: number;
    /** Mép trái vùng dùng được của dải */
    left: number;
    /** Bề rộng vùng dùng được của dải */
    width: number;
  };
};

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

/*
 * Không còn hằng `MIN_SCALE` ở tệp này.
 *
 * Sàn cỡ chữ vẫn tồn tại — nhưng ở `text-layout.ts`, nơi phép BẺ DÒNG dùng nó để
 * quyết định "cụm này phải tách". Ở đây thì hàng đã bị chốt số dòng từ trước
 * (`packRows`), nên áp sàn chỉ còn một tác dụng: đẩy chữ ra ngoài khung.
 */


type Piece = { text: string; keyword: boolean };
type Sized = {
  text: string;
  fontSize: number;
  color: string;
  alpha: number;
};

/**
 * Tách cụm thành từng tiếng, đánh dấu tiếng nào là từ khoá, và áp trục HOA.
 *
 * Viết hoa NGAY TỪ ĐÂY chứ không viết hoa lúc vẽ: mọi phép đo phía sau đều chạy
 * trên chuỗi này, và chữ hoa rộng hơn chữ thường. Đo bằng chuỗi thường rồi in ra
 * chuỗi hoa là chữ tràn khung — mà tràn khung là bảo đảm lớn nhất của sản phẩm.
 *
 * Đối chiếu từ khoá vẫn dùng chuỗi GỐC: người dùng đánh dấu "quyết" thì bật chữ
 * hoa lên không được làm mất dấu đó.
 */
export function splitPieces(
  content: string,
  keywords: string[],
  pack: ShownPack,
): Piece[] {
  const marked = new Set(keywords.map((word) => word.toLowerCase()));
  return content
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => ({
      text: styleCase(text, pack),
      keyword: marked.has(text.toLowerCase()),
    }));
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
 *
 * **Bề rộng thắng SÀN cỡ chữ.** Trước đây có `Math.max(MIN_SCALE, …)` bọc ngoài,
 * nên hàng nào chỉ vừa ở cỡ 0,07 vẫn bị kéo lên 0,09 và chạy hẳn ra ngoài khung —
 * đo thật trên cụm 15 tiếng ở kiểu `taper` thì chữ vượt mép phải 12% bề rộng
 * khung. Hàng không xuống dòng được (`packRows` đã chốt số hàng theo `MAX_LINES`)
 * nên sàn và bề rộng không thể cùng thoả; giữa "chữ nhỏ hơn ngưỡng đọc" và "chữ
 * ra ngoài khung" thì bảo đảm KHÔNG BAO GIỜ TRÀN là thứ không được hy sinh —
 * cùng lý lẽ với phép kẹp `x` ở cuối `placeWords`.
 */
async function fitRow(
  text: string,
  usable: number,
  rows: number,
  videoWidth: number,
  pack: ShownPack,
) {
  const byHeight = pack.density.maxScale * (rows > 2 ? 0.7 : rows > 1 ? 0.85 : 1);
  // Đo ở cỡ 100 rồi suy: bề rộng tỉ lệ thuận với cỡ chữ.
  //
  // Cộng nền khối của TỪNG tiếng: hàng này vẽ ra là chữ CỘNG nền, mà đo mỗi chữ
  // thì bộ có nền khối luôn chọn cỡ to hơn chỗ nó có.
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const at100 =
    (await textWidth(text, 100, pack)) + wordCount * boxPadShare(pack) * 2 * 100;
  const perUnit = Math.max(0.001, at100 / 100);
  const byWidth = (usable * 0.98) / (perUnit * videoWidth);
  return Math.min(byHeight, byWidth);
}

/** Trục NHẤN: chia hàng và định cỡ. Đây là chỗ DUY NHẤT quyết định cỡ chữ. */
async function buildRows(
  pieces: Piece[],
  emphasis: EmphasisId,
  usable: number,
  videoWidth: number,
  pack: ShownPack,
): Promise<Sized[][]> {
  const px = (scale: number) => Math.round(videoWidth * scale);
  const { main, dim, key } = pack.color;

  // Kiểu "hero khổng lồ" chỉ phóng to được MỘT cụm nhấn liền nhau. Đánh dấu ≥2 cụm
  // rời thì cụm sau bị bỏ rơi ở dòng dẫn nhỏ — người dùng bấm nhấn mà không thấy
  // nhấn. Nên ≥2 cụm → "xen cỡ": mọi tiếng nhấn đều to hơn tiếng thường. Khớp
  // `overlay-render.tsx` của trang xem.
  const markedRuns = pieces.reduce(
    (n, piece, i) =>
      n + (piece.keyword && !(i > 0 && pieces[i - 1].keyword) ? 1 : 0),
    0,
  );
  const eff: EmphasisId =
    emphasis === "keyword-large" && markedRuns > 1 ? "mixed-size" : emphasis;

  if (eff === "keyword-large") {
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
    // Cỡ nhấn = 75% mức vừa-khung (khớp `overlay-render.tsx`): hero to hết cỡ đọc
    // ra "hét"; 3/4 cho nổi mà không lấn. Dòng dẫn suy từ đây nên co theo cùng tỉ lệ.
    const heroScale = (await fitRow(heroText, usable, 1, videoWidth, pack)) * 0.75;
    // Cùng số với `overlay-render.tsx` (trang xem): tỉ lệ 0,48 và trần 0,085 cho
    // dòng dẫn đọc rõ hơn. Trước để 0,4/0,075 nên bản xuất có dòng dẫn bé hơn preview.
    const small = Math.min(heroScale * 0.48, 0.085);
    // Dòng dẫn (before/after) là MỘT hàng cấm bẻ. Cỡ-dẫn cố định làm dòng dài
    // (vd cụm tiếng Anh "personal branding") chạy ra ngoài mép khung. Lấy cỡ nhỏ
    // hơn giữa cỡ-dẫn và cỡ-vừa-khung của CHÍNH hàng đó → không bao giờ tràn.
    const fitSmall = async (list: Piece[]) =>
      list.length > 0
        ? Math.min(
            small,
            await fitRow(
              list.map((piece) => piece.text).join(" "),
              usable,
              1,
              videoWidth,
              pack,
            ),
          )
        : small;
    const smallBefore = await fitSmall(before);
    const smallAfter = await fitSmall(after);
    const row = (list: Piece[], scale: number, tone: Tone) =>
      list.map((piece) => ({
        text: piece.text,
        fontSize: px(scale),
        ...tone,
      }));
    // MÀU theo từ khoá THẬT, CỠ theo trục nhấn — hai việc tách bạch.
    //
    // Cụm chưa đánh dấu tiếng nào thì `hero` là tiếng đầu, chọn theo VỊ TRÍ chứ
    // không theo nghĩa. Tô nó bằng màu từ khoá là nói dối: với bộ dáng có màu
    // nhấn thật (vàng, xanh) thì một tiếng ngẫu nhiên bỗng đổi màu. Nó đã nổi
    // bằng cỡ chữ rồi, không cần nổi thêm bằng màu.
    const heroRow = hero.map((piece) => ({
      text: piece.text,
      fontSize: px(heroScale),
      ...(piece.keyword ? key : main),
    }));
    return [
      ...(before.length > 0 ? [row(before, smallBefore, dim)] : []),
      heroRow,
      ...(after.length > 0 ? [row(after, smallAfter, dim)] : []),
    ];
  }

  if (eff === "mixed-size") {
    const SMALL = pack.density.mixedSmallRatio;
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
        const at100 = await textWidth(piece.text, 100, pack);
        width +=
          (at100 / 100) * (to(piece, offset + index) ? 1 : SMALL) +
          pack.density.wordGap;
      }
      // Cùng lý do như `fitRow`: quy về tỉ lệ bề rộng khung trước khi so với trần.
      return Math.min(
        pack.density.maxScale,
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
            // Cùng luật với `keyword-large`: cỡ theo trục nhấn, MÀU theo từ khoá
            // thật. Cụm chưa đánh dấu gì thì `big` là các tiếng chẵn lẻ — tô
            // chúng bằng màu từ khoá là một nửa cụm đổi màu vô cớ.
            ...(piece.keyword ? key : main),
          };
        }),
      );
    }
    return out;
  }

  if (eff === "even") {
    // Cỡ đều: bẻ dòng theo bề rộng rồi dùng CHUNG một cỡ — dáng phụ đề khổ lớn.
    // Vẫn trả về từng tiếng chứ không trả cả dòng, vì hiệu ứng hiện ra chạy theo
    // TIẾNG. Gộp dòng lại thì cả dòng bật ra một lượt, mất đúng thứ làm nên nhịp.
    const content = pieces.map((piece) => piece.text).join(" ");
    const { lines, scale } = await fitLines(content, usable, videoWidth, pack);
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
          ...(marked.get(word.toLowerCase()) ? key : main),
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
      ? (await fitRow(text, usable, 3, videoWidth, pack)) *
        pack.density.leadRatio
      : await fitRow(text, usable, rows.length, videoWidth, pack);
    out.push(
      row.map((piece) => ({
        text: piece.text,
        fontSize: px(scale),
        ...(lead ? dim : piece.keyword ? key : main),
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
async function rowWidth(row: Sized[], pack: ShownPack) {
  const padShare = boxPadShare(pack);
  let width = 0;
  for (const [index, word] of row.entries()) {
    // Nền khối nới MỖI tiếng ra cả hai bên, nên cộng vào bề rộng của mọi tiếng —
    // kể cả tiếng cuối, nơi phép đo lấy vết mực thay cho bước tiến.
    width += word.fontSize * padShare * 2;
    if (index === row.length - 1) {
      width += await textWidth(word.text, word.fontSize, pack);
    } else {
      width +=
        (await advanceWidth(word.text, word.fontSize, pack)) +
        word.fontSize * pack.density.wordGap;
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
  pack: ShownPack,
): Promise<PlacedBlock> {
  const empty = { top: 0, bottom: 0, left: 0, width: 0 };
  const pieces = splitPieces(content, keywords, pack);
  if (pieces.length === 0) return { words: [], box: empty };

  const lineHeight = pack.density.lineHeight;
  const usable = usableWidthOf(band, videoWidth);
  const left = Math.round(videoWidth * SAFE.left);
  const right = left + usable;
  const rows = await buildRows(pieces, emphasis, usable, videoWidth, pack);

  /*
   * CHỐT CHẶN CUỐI: hàng nào vẫn rộng hơn chỗ nó có thì thu cả hàng cho vừa.
   *
   * Bốn nhánh của `buildRows` mỗi nhánh tự ƯỚC bề rộng theo một công thức riêng,
   * còn chỗ ĐẶT lại đo bằng `rowWidth`. Hai phép đo đó không bằng nhau, và chênh
   * lệch đủ để chữ chạy ra ngoài khung:
   *
   * - `keyword-large` dồn toàn bộ phần dẫn vào MỘT hàng ở cỡ cố định
   *   `min(heroScale × 0,4 ; 0,075)` — không hỏi bề rộng lấy một câu. Cụm mười
   *   ba tiếng chưa đánh dấu từ khoá nào thì hàng dẫn dài gấp đôi khung.
   * - `mixed-size` ước bằng VẾT MỰC còn `rowWidth` cộng BƯỚC TIẾN, mà bước tiến
   *   gồm cả khoảng đệm hai bên chữ nên lớn hơn vết mực ở font không nghiêng.
   *   Nó cũng quên khoảng đệm của nền khối.
   *
   * Sửa từng nhánh là sửa bốn công thức ước và chờ nhánh thứ năm. Thu ở đây thì
   * bảo đảm nằm ở chỗ ĐẶT — nơi con số cuối cùng được quyết định — nên không
   * phép ước nào bất đồng với nó được.
   *
   * Thu được đúng bằng phép nhân vì bề rộng TUYẾN TÍNH theo cỡ chữ: mọi phép đo
   * đều lấy ở cỡ 100 rồi nhân tỉ lệ. `floor` để phần dôi rơi về phía an toàn.
   *
   * Chữ thu nhỏ hơn ngưỡng đọc là cái giá đã chốt từ trước, cùng lý lẽ với phép
   * kẹp `x` ở cuối hàm này: giữa "chữ nhỏ quá" và "chữ ra ngoài khung" thì bảo
   * đảm KHÔNG BAO GIỜ TRÀN là thứ không được hy sinh.
   */
  for (const row of rows) {
    const width = await rowWidth(row, pack);
    if (width <= usable) continue;
    /*
     * Chừa lại một pixel cho MỖI tiếng trước khi chia tỉ lệ.
     *
     * Vòng đặt chữ làm tròn toạ độ một lần cho mỗi tiếng, nên sai số dồn lên tới
     * nửa pixel một tiếng. Thu vừa khít `usable` thì hàng tám tiếng vẫn nhô ra
     * một hai pixel — đo được, và nó biến một bảo đảm thành "gần như luôn đúng".
     */
    const shrink = Math.max(0, usable - row.length) / width;
    for (const word of row) {
      word.fontSize = Math.max(1, Math.floor(word.fontSize * shrink));
    }
  }

  // Chiều cao cả khối để neo được từ mép DƯỚI: hai dải dưới mọc lên, không thì khối
  // ba hàng chữ khổ lớn ở dải `bottom` chạy hẳn ra ngoài đáy khung.
  // Lấy thẳng `density.lineHeight` chứ không chép số: trước đây chỗ này ghi 1,15
  // còn `text-layout.ts` ghi 1,28 — hai bên đo cùng một khối ra hai chiều cao
  // khác nhau, và dải dưới đội chữ lên khỏi chỗ đã canh.
  // Đệm DỌC của nền khối nằm TRONG chiều cao hàng.
  //
  // Bên trang xem mỗi tiếng là một `inline-block` có `padding`, nên đệm nở hộp
  // dòng ra thật; bên này trước đây chỉ nhân `lineHeight`. Đo được trên dự án
  // thật: khối hai hàng của bộ "Lửa" xuất ra thấp hơn trang xem 86 điểm ảnh —
  // đúng bằng 2 hàng × 2 cạnh × 0,14 cỡ chữ. Phép so hai đường vẽ không bắt
  // được vì nó chỉ so số dòng và cỡ chữ, không so CHỖ ĐỨNG.
  const padY = boxPadShareY(pack);
  const rowHeights = rows.map((row) =>
    Math.round(
      Math.max(...row.map((word) => word.fontSize)) * (lineHeight + padY * 2),
    ),
  );
  const total = rowHeights.reduce((sum, height) => sum + height, 0);
  const anchor = BAND_ANCHOR[band];
  // Nửa khoảng đệm dòng: `lineHeight` bên trang xem đẩy nét chữ xuống một
  // nửa phần dôi so với mép hộp dòng, còn `drawtext` đặt chữ ngay mép trên. Bỏ
  // qua thì cả khối in ra cao hơn bản xem chừng 2% chiều cao khung.
  const halfLeading = Math.round(
    (rows[0]?.reduce((max, word) => Math.max(max, word.fontSize), 0) ?? 0) *
      ((lineHeight - 1) / 2 + padY),
  );
  const startY =
    anchor.edge === "top"
      ? Math.round(videoHeight * anchor.at) + halfLeading
      : anchor.edge === "bottom"
        ? Math.round(videoHeight * anchor.at - total) + halfLeading
        : // Giữa: neo bằng TÂM khối, cao mấy dòng cũng tự căn giữa.
          Math.round(videoHeight * anchor.at - total / 2) + halfLeading;

  let y = startY;
  const out: PlacedWord[] = [];
  for (const [index, row] of rows.entries()) {
    const shift = Math.round(usable * indentShare(align, index, rows.length));
    const width = await rowWidth(row, pack);
    let x: number;
    if (align === "center") x = Math.round(left + (usable - width) / 2);
    else if (align === "right") x = Math.round(right - width - shift);
    else x = left + shift;
    // Không bao giờ để tràn: thà lệch khỏi kiểu căn còn hơn chữ ra ngoài khung.
    //
    // `floor` chứ không `round`: đây là phép KẸP, mà kẹp làm tròn LÊN thì nó
    // tự cho phép nửa pixel vượt ra đúng cái mép nó sinh ra để giữ.
    x = Math.max(left, Math.min(x, Math.floor(right - width)));

    /*
     * Con trỏ chạy bằng SỐ THỰC, chỉ làm tròn lúc phát ra toạ độ từng tiếng.
     *
     * Bản trước làm tròn rồi CỘNG DỒN, nên sai số nửa pixel mỗi tiếng chồng lên
     * nhau: hàng tám tiếng lệch tới bốn pixel, và tiếng cuối của hàng căn phải
     * nhô ra ngoài mép dù `rowWidth` đã tính vừa khít. Đo được: sáu bộ dáng vượt
     * mép phải 1–2 pixel ở các cụm chạm trần bề rộng.
     *
     * Làm tròn một lần cho mỗi tiếng thì sai số của tiếng này không truyền sang
     * tiếng sau — cả hàng lệch nhiều nhất nửa pixel. Trang xem cũng đặt chữ bằng
     * số thực, nên cách này còn kéo hai đường vẽ lại gần nhau hơn.
     */
    let cursor = x;
    for (const [col, word] of row.entries()) {
      // KHÔNG đổ chéo từng tiếng: bộ vẽ-tay nghiêng ở tầng CỤM (xoay cả khối),
      // nên hàng ở đây phải THẲNG. Bản trước tụt dần theo cột + dao động sin, cộng
      // vào phép xoay thành chân chữ nhấp nhô, khó đọc — bản gốc Chalk nghiêng cả
      // DÒNG chứ không lệch từng từ.
      out.push({
        text: word.text,
        // `x` của lệnh vẽ là chỗ CHỮ bắt đầu, còn nền khối chìa ra trước nó một
        // khoảng đệm. Không dời thì mép trái của nền nằm ngoài mép hàng.
        x: Math.round(cursor + word.fontSize * boxPadShare(pack)),
        // `y` của lệnh vẽ là mép trên VỆT MỰC, không phải mép trên hộp dòng —
        // nên tiếng có dấu chồng dấu phải dịch xuống đúng bằng khoảng trống mà
        // tiếng không dấu để lại phía trên. Không bù thì cả hàng có chân chữ
        // nhấp nhô, và trang xem không có lỗi đó vì CSS xếp theo chân chữ.
        y:
          y +
          Math.round(await inkTopOffset(word.text, word.fontSize, pack)),
        fontSize: word.fontSize,
        row: index,
        col,
        color: word.color,
        alpha: word.alpha,
      });
      cursor +=
        (await advanceWidth(word.text, word.fontSize, pack)) +
        word.fontSize * pack.density.wordGap +
        word.fontSize * boxPadShare(pack) * 2;
    }
    y += rowHeights[index];
  }
  // Mép trên hộp khối = chỗ hàng đầu bắt đầu TRỪ nửa khoảng đệm dòng — tức là
  // trả lại đúng phần `halfLeading` đã cộng vào lúc tính `y`. Bên trang xem, mép
  // trên thẻ bọc nằm đúng ở đó.
  const top = startY - halfLeading;
  return { words: out, box: { top, bottom: top + total, left, width: usable } };
}
