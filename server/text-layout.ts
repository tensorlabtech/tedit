import { measureInkTop, measureText } from "./media-tools";
import { resolvePackFont } from "./paths";
import {
  boxPadShare,
  styleCase,
  type AlignId,
  type Band,
  type EmphasisId,
  type ShownPack,
} from "./style-pack";

export type { AlignId, Band, EmphasisId } from "./style-pack";

/**
 * Dải an toàn 9:16 — trên 10%, dưới 20%, trái 11%, phải 18%.
 *
 * Lề phải rộng hơn lề trái vì cột nút của TikTok/Reels nằm bên phải; chữ chạm
 * vào đó là bị nút đè lên.
 *
 * Lề trái 11% chứ không 5%: đo bảy khung của video tham khảo (`examples/`), mép
 * trái khối chữ nằm ở đúng 11% ở CẢ BẢY, không lệch một lần. Chữ bắt đầu quá sát
 * mép là mất cái dáng "khối chữ được đặt vào khung", thành ra dáng phụ đề chạy
 * hết bề ngang.
 */
export const SAFE = { top: 0.1, bottom: 0.2, left: 0.11, right: 0.18 };


/**
 * Lề phải theo dải: chỉ nửa dưới khung mới bị cột nút của TikTok/Reels chiếm.
 *
 * Giữ 18% cho cả bốn dải là mất 12% bề rộng ở hai dải trên mà không đổi lấy gì —
 * và mất bề rộng là chữ phải co nhỏ, tức mất đúng cái phong cách này sống bằng.
 */
const RIGHT_MARGIN: Record<Band, number> = {
  // 11% cho cân với lề trái — khối rộng 78%, đúng bằng 74–79% đo được ở video
  // tham khảo. Dải trên không bị cột nút che nên đây là lựa chọn DÁNG, không
  // phải ràng buộc nền tảng.
  top: 0.11,
  middle: 0.18,
  bottom: 0.18,
};

/**
 * Dải neo khối chữ. Hai dải trên neo bằng mép TRÊN, hai dải dưới neo bằng mép DƯỚI.
 *
 * Neo mọi dải bằng mép trên là lỗi im lặng: dải `bottom` bắt đầu ở 72% chiều cao,
 * khối ba dòng cao 45% thì mép dưới rơi vào 117% — chữ chạy hẳn ra ngoài đáy khung
 * mà phép đo vẫn báo "vừa", vì nó chỉ kiểm chiều cao khối chứ không kiểm khối rơi
 * vào đâu. Dải dưới thì phải mọc LÊN, đúng như phụ đề thật.
 */
export const BAND_ANCHOR: Record<
  Band,
  { edge: "top" | "bottom" | "center"; at: number }
> = {
  top: { edge: "top", at: 0.12 },
  // Giữa neo bằng TÂM khối, nên nó tự căn giữa dù cao mấy dòng.
  middle: { edge: "center", at: 0.5 },
  // Đáy khối chữ ở 80% — SÁT lề an toàn dưới (`SAFE.bottom` 20%), tức vị trí phụ
  // đề CHUẨN (thấp, ngay trên vùng UI nền tảng). 73% trước đó nằm cao giữa khung,
  // đọc ra "chữ lơ lửng" chứ không ra phụ đề.
  bottom: { edge: "bottom", at: 0.8 },
};

/**
 * Trần chiều cao khối chữ — nhỉnh hơn mức ba dòng có thể chạm tới.
 *
 * Ba dòng ở cỡ lớn nhất là 3 × 0,17 × bề rộng = 28,7% chiều cao khung 9:16, nên
 * 30% là cái trần không bao giờ cắt vào thiết kế mà vẫn chặn được ca bất thường.
 * Bản trước để 45% cho MỖI dải trong khi dải an toàn chỉ có 70% — hai khối là
 * 90%, bài toán vô nghiệm ngay từ hằng số.
 */
const MAX_BLOCK_SHARE = 0.3;

/** Chỗ khối chữ được phép chiếm ở dải này, tính theo chiều cao khung. */
function blockRoom(band: Band) {
  const anchor = BAND_ANCHOR[band];
  // Mép trên khung chừa 10%, mép dưới chừa 20% — đó là dải an toàn.
  const room =
    anchor.edge === "top"
      ? 1 - SAFE.bottom - anchor.at
      : anchor.edge === "bottom"
        ? anchor.at - SAFE.top
        : 1 - SAFE.top - SAFE.bottom;
  return Math.min(MAX_BLOCK_SHARE, room);
}

/**
 * Trần số dòng của một cụm. Quá trần thì TÁCH CỤM, không co chữ.
 *
 * Bốn dòng chữ khổ lớn chiếm hơn nửa khung dọc, và dòng thứ tư luôn là dòng bị bẻ
 * giữa ý — đọc tới đó thì câu đã trôi qua. Co chữ cho vừa thì mất phong cách; tách
 * cụm thì chỉ chia lại thời gian, không mất gì.
 *
 * Phải khớp với `MAX_LINES` bên `src/dev/overlays/overlay-frame.tsx`: một bên là
 * trang xem, một bên là bản in ra, lệch nhau là xem một đằng xuất một nẻo.
 */
export const MAX_LINES = 3;

/**
 * Cỡ chữ tính theo BỀ RỘNG khung, không theo chiều cao.
 *
 * Bản trước lấy 17%–8,5% CHIỀU CAO. Cùng một con số mà đổi trục thì ra cỡ khác
 * hẳn ở khung 9:16, nên trang xem và bản in ra không bao giờ khớp nhau. Bản cũ
 * định nghĩa `hero` là 30% BỀ RỘNG — lấy luôn trục đó cho cả hai bên.
 *
 * Sàn 15%: dưới mức này là cỡ chú thích. Gặp cụm không cỡ nào vừa thì việc phải
 * làm là tách cụm, không phải hạ sàn.
 */
/**
 * SÀN cỡ chữ, theo bề rộng khung. Trần thì bộ dáng đổi được
 * (`density.maxScale`), sàn thì không: dưới 0,09 là cỡ chú thích, tức là ngưỡng
 * ĐỌC ĐƯỢC chứ không phải chuyện phong cách. Gặp cụm không cỡ nào vừa thì việc
 * phải làm là tách cụm, không phải hạ sàn.
 */
const MIN_SCALE = 0.09;

/**
 * SÀN của bước dòng. Bộ dáng chỉnh `density.lineHeight` trong [1.0, 1.4], không
 * tự do.
 *
 * KHÔNG được xuống dưới 1: tiếng Việt có dấu chồng dấu (`Ắ`, `Ữ`, `ệ`), dưới 1
 * là dấu vượt ra ngoài hộp dòng và bị cắt cụt. Lỗi này không có ở tiếng Anh nên
 * rất dễ lọt nếu chỉ thử bằng chữ mẫu tiếng Anh.
 *
 * Các dòng gần CHẠM nhau (1,0) là dáng của kiểu chữ này — xem ảnh tham khảo ở
 * `examples/`. Bộ dáng chữ HOA phải nới ra, xem `reports/font-audit.md`.
 */
export const MIN_LINE_HEIGHT = 1;

/**
 * Cùng thang với `overlay-model.ts` của trang xem — hai bên phải là MỘT con số.
 *
 * Trước đây bản in dùng 0,30–0,15 còn trang xem 0,24–0,09: cùng một cụm chữ ra
 * hai cỡ khác nhau, mà chênh lệch chỉ lộ khi so hai ảnh cạnh nhau nên đã sống
 * rất lâu. Sửa cỡ ở đây thì phải sửa cả bên kia.
 */

export type LaidOutText = {
  lines: string[];
  /** Có dòng bị cắt bớt vì không cỡ nào vừa — chỗ này cần người xem lại */
  truncated: boolean;
  /** Cụm quá dài cho một khung: phải tách thành nhiều cụm hiện lần lượt */
  needsSplit: boolean;
  fontSize: number;
  /** Toạ độ mép trái của khối chữ, đã căn giữa trong vùng an toàn */
  centerX: number;
  topY: number;
  lineHeight: number;
};

/**
 * Bẻ dòng và thu cỡ chữ cho tới khi khối chữ nằm gọn trong dải an toàn.
 *
 * Đo bằng ImageMagick với đúng tệp font sẽ dùng để in, chứ không ước lượng theo
 * số ký tự: "IIIII" và "mmmmm" cùng 5 ký tự nhưng rộng gấp đôi nhau.
 */
export async function layoutText(
  content: string,
  band: Band,
  videoWidth: number,
  videoHeight: number,
  pack: ShownPack,
): Promise<LaidOutText> {
  const { maxScale, lineHeight: lineHeightShare, wordGap } = pack.density;
  const usableWidth = videoWidth * (1 - SAFE.left - RIGHT_MARGIN[band]);
  // Chỗ cao được phép chiếm phụ thuộc DẢI: dải dưới không có 45% để dùng.
  const maxBlockHeight = videoHeight * blockRoom(band);
  const anchor = BAND_ANCHOR[band];
  /** Mép trên của khối: dải dưới thì suy ra từ mép dưới, nên phụ thuộc số dòng. */
  const topOf = (lineCount: number, lineHeight: number) =>
    anchor.edge === "top"
      ? Math.round(videoHeight * anchor.at)
      : anchor.edge === "bottom"
        ? Math.round(videoHeight * anchor.at - lineCount * lineHeight)
        : Math.round(videoHeight * anchor.at - (lineCount * lineHeight) / 2);

  // Hệ Oversize: chữ TO đến mức gần tràn mép, không phải chữ vừa khít trong lề.
  let fontSize = Math.round(videoWidth * maxScale);
  const minSize = Math.round(videoWidth * MIN_SCALE);

  // Đo từng từ một lần, rồi dò cỡ bằng phép tính — không gọi lại ImageMagick.
  const measured = await measureWords(content, pack);

  for (; fontSize >= minSize; fontSize -= 2) {
    const lines = wrapAtSize(
      measured,
      fontSize,
      usableWidth,
      wordGap,
      boxPadShare(pack) * 2,
    );
    if (!lines) continue;
    // Quá trần dòng thì thử cỡ nhỏ hơn; hết cỡ thì báo cần tách cụm.
    if (lines.length > MAX_LINES) continue;
    const lineHeight = Math.round(fontSize * lineHeightShare);
    if (lines.length * lineHeight <= maxBlockHeight) {
      return {
        lines,
        truncated: false,
        needsSplit: false,
        fontSize,
        centerX: Math.round(
          videoWidth * (SAFE.left + (1 - SAFE.left - RIGHT_MARGIN[band]) / 2),
        ),
        topY: topOf(lines.length, lineHeight),
        lineHeight,
      };
    }
  }

  // Không cỡ nào vừa: giữ cỡ sàn, cắt phần thừa và BÁO cần tách cụm. Thà mất một
  // dòng còn hơn để chữ tràn ra ngoài khung — bảo đảm "không bao giờ tràn" là thứ
  // không được phép hy sinh. Cụm phụ đề tự tách trước khi tới đây; chỉ chữ do
  // người tự nhập mới rơi vào nhánh này.
  const lineHeight = Math.round(minSize * lineHeightShare);
  const lines =
    wrapAtSize(measured, minSize, usableWidth, wordGap, boxPadShare(pack) * 2) ?? [
      content,
    ];
  const room = Math.max(1, Math.floor(maxBlockHeight / lineHeight));
  const kept = lines.slice(0, Math.min(MAX_LINES, room));
  return {
    lines: kept,
    truncated: kept.length < lines.length,
    needsSplit: lines.length > MAX_LINES,
    fontSize: minSize,
    centerX: Math.round(
      videoWidth * (SAFE.left + (1 - SAFE.left - RIGHT_MARGIN[band]) / 2),
    ),
    topY: topOf(kept.length, lineHeight),
    lineHeight,
  };
}

/**
 * Đo MỘT lần ở cỡ gốc rồi nhân tỉ lệ, thay vì đo lại ở từng cỡ.
 *
 * Bề rộng chữ tỉ lệ thuận với cỡ chữ, nên đo ở 100pt là biết mọi cỡ. Bản trước
 * gọi ImageMagick cho từng cỡ × từng từ: một cụm 5 tiếng dò 40 cỡ là 200 lần gọi
 * tiến trình con, và 50 cụm phụ đề thì mất hơn hai phút — chậm tới mức không đo
 * nổi cả dự án để kiểm.
 *
 * Nhớ kết quả theo từ: các cụm phụ đề dùng lại rất nhiều từ giống nhau.
 */
const BASE_SIZE = 100;
const widthCache = new Map<string, number>();

async function baseWidth(text: string, pack: ShownPack) {
  // Khoá nhớ gồm cả TỆP FONT: hai bộ dáng dùng hai font khác nhau thì cùng một
  // chữ ra hai bề rộng, và nhớ chung một khoá là bộ dáng thứ hai đọc số của bộ
  // thứ nhất — chữ tràn khung mà không lệnh nào sai.
  const fontPath = resolvePackFont(pack.font.file);
  const key = `${fontPath}|${text}`;
  const hit = widthCache.get(key);
  if (hit !== undefined) return hit;
  const { width } = await measureText(text, fontPath, BASE_SIZE);
  // Chặn số phần tử để chạy lâu không phình bộ nhớ; từ vựng một dự án nhỏ hơn thế.
  if (widthCache.size > 5000) widthCache.clear();
  widthCache.set(key, width);
  return width;
}

type Measured = { words: string[]; widths: number[] };

async function measureWords(
  content: string,
  pack: ShownPack,
): Promise<Measured> {
  // Áp trục HOA TRƯỚC khi đo: chữ hoa rộng hơn chữ thường, đo bằng chuỗi thường
  // rồi in ra chuỗi hoa là chữ tràn khung.
  const words = styleCase(content, pack).trim().split(/\s+/).filter(Boolean);
  const widths = await Promise.all(words.map((word) => baseWidth(word, pack)));
  return { words, widths };
}

/** Trả `null` nếu có MỘT từ đơn lẻ đã rộng hơn khung — cỡ này vô vọng, thử cỡ nhỏ hơn. */
function wrapAtSize(
  measured: Measured,
  fontSize: number,
  maxWidth: number,
  wordGap: number,
  /**
   * Phần nền khối cộng vào MỖI tiếng (cả hai bên), tính theo cỡ chữ.
   *
   * Không có nó thì bộ có nền khối bẻ dòng theo bề rộng CHỮ trong khi thứ vẽ ra
   * là chữ CỘNG nền — và cả hàng tràn ra ngoài khung.
   */
  padPerWord: number,
): string[] | null {
  const { words, widths } = measured;
  if (words.length === 0) return [""];
  const ratio = fontSize / BASE_SIZE;
  const pad = fontSize * padPerWord;

  const lines: string[] = [];
  let current: string[] = [];
  let currentWidth = 0;

  for (const [index, word] of words.entries()) {
    const wordWidth = widths[index] * ratio + pad;
    if (wordWidth > maxWidth) return null;
    // Cùng công thức với lúc vẽ (`placeWords`): khoảng giữa hai tiếng là
    // `density.wordGap` nhân cỡ chữ, không phải bề rộng dấu cách của font.
    const added =
      current.length === 0 ? wordWidth : fontSize * wordGap + wordWidth;
    if (currentWidth + added <= maxWidth) {
      current.push(word);
      currentWidth += added;
      continue;
    }
    lines.push(current.join(" "));
    current = [word];
    currentWidth = wordWidth;
  }
  if (current.length > 0) lines.push(current.join(" "));
  return lines;
}

/**
 * Bẻ dòng và dò cỡ cho cụm chữ CỠ ĐỀU — trả tỉ lệ bề rộng khung, không trả pixel.
 *
 * Cùng luật với `fitCum` của trang xem: hạ dần cỡ tới khi cụm nằm trong trần
 * dòng. Khác một điểm có lợi: đo bằng đúng tệp font sẽ in thay vì ước theo số
 * ký tự, nên không có chuyện "vừa trên trang xem, tràn trên bản in".
 */
export async function fitLines(
  content: string,
  usable: number,
  videoWidth: number,
  pack: ShownPack,
): Promise<{ lines: string[]; scale: number; needsSplit: boolean }> {
  const { maxScale, wordGap } = pack.density;
  const padPerWord = boxPadShare(pack) * 2;
  const measured = await measureWords(content, pack);
  if (measured.words.length === 0)
    return { lines: [], scale: maxScale, needsSplit: false };
  const room = usable * 0.98;
  for (let scale = maxScale; scale >= MIN_SCALE - 0.0001; scale -= 0.005) {
    const lines = wrapAtSize(measured, scale * videoWidth, room, wordGap, padPerWord);
    if (lines && lines.length <= MAX_LINES)
      return { lines, scale, needsSplit: false };
  }
  const lines =
    wrapAtSize(measured, MIN_SCALE * videoWidth, room, wordGap, padPerWord) ?? [content];
  return {
    lines: lines.slice(0, MAX_LINES),
    scale: MIN_SCALE,
    needsSplit: lines.length > MAX_LINES,
  };
}

/**
 * Cách xếp các DÒNG của một cụm.
 *
 * Trước đây bản in ra chỉ biết một cách: căn giữa mọi dòng (`x=(w-text_w)/2`).
 * Trang xem thì bày bốn cách xếp — thẳng lề, hai kiểu bậc thang, so le chẵn lẻ —
 * và không cách nào tồn tại ở bản in. Xếp dòng là chuyện của toạ độ, không phải
 * chuyện của phép đo, nên nó thuộc về đây chứ không cần một hệ riêng.
 */

/**
 * Đổi giá trị `layout` cũ sang hai trục mới.
 *
 * CSDL đang có phần tử lưu `mot-tieng-khong-lo`, `flush`, `lech-tam`… — đó là hồi
 * hai trục còn bị gộp làm một danh sách. Đọc là đổi ngay, không sửa CSDL: sửa dữ
 * liệu thì bản cũ đang chạy đọc vào sẽ không hiểu, mà bảng đổi này thì rẻ.
 */
export function fromLegacyLayout(value: string | null | undefined): {
  align: AlignId;
  emphasis: EmphasisId;
} {
  switch (value) {
    case "center":
      return { align: "center", emphasis: "even" };
    case "right":
      return { align: "right", emphasis: "even" };
    case "stair-right":
      return { align: "stair", emphasis: "even" };
    case "stair-left":
      return { align: "stair", emphasis: "even" };
    case "split":
    case "so-le":
      return { align: "stagger", emphasis: "even" };
    case "mot-tieng-khong-lo":
      return { align: "left", emphasis: "keyword-large" };
    case "lech-tam":
      return { align: "right", emphasis: "even" };
    case "xen-co":
      return { align: "left", emphasis: "mixed-size" };
    case "duoi-len":
      return { align: "left", emphasis: "taper" };
    case "left":
    case "stair":
      return { align: value, emphasis: "even" };
    // `flush` và mọi giá trị lạ: căn giữa, cỡ đều — đúng thứ bản in ra vẫn làm.
    default:
      return { align: "center", emphasis: "even" };
  }
}

/** Tổng thụt của bậc thang bị chặn 11%: không chặn thì dòng cuối đẩy chữ ra ngoài. */
const MAX_TOTAL_INDENT = 0.11;

export function indentShare(
  align: AlignId,
  lineIndex: number,
  lineCount: number,
) {
  if (lineIndex === 0) return 0;
  if (align === "left" || align === "center" || align === "right") return 0;
  // So le: nhịp KHÔNG đều mới ra thiết kế, lệch đều nhau đọc ra như lỗi căn lề.
  if (align === "stagger") return [0, 0.14, 0.04][lineIndex % 3];
  return (
    Math.min(0.055, MAX_TOTAL_INDENT / Math.max(1, lineCount - 1)) * lineIndex
  );
}

/**
 * Biểu thức `x` của một dòng cho `drawtext`.
 *
 * Trả biểu thức chứ không trả số vì `stair-left` căn theo mép PHẢI của chữ, mà bề
 * rộng chữ chỉ ffmpeg biết lúc vẽ (`text_w`).
 */
export function lineX(
  align: AlignId,
  lineIndex: number,
  lineCount: number,
  band: Band,
  videoWidth: number,
) {
  const shift = Math.round(
    videoWidth * indentShare(align, lineIndex, lineCount),
  );
  if (align === "center") return "(w-text_w)/2";
  if (align === "right") {
    const right = Math.round(videoWidth * (1 - RIGHT_MARGIN[band]));
    return `${right - shift}-text_w`;
  }
  return String(Math.round(videoWidth * SAFE.left) + shift);
}

/** Bề rộng dùng được của dải này, tính theo px. */
export function usableWidthOf(band: Band, videoWidth: number) {
  return videoWidth * (1 - SAFE.left - RIGHT_MARGIN[band]);
}

/** Bề rộng VẾT MỰC ở một cỡ bất kỳ — dùng lại phép đo đã nhớ, không gọi lại ImageMagick. */
export async function textWidth(
  text: string,
  fontSize: number,
  pack: ShownPack,
) {
  return ((await baseWidth(text, pack)) * fontSize) / BASE_SIZE;
}

/**
 * BƯỚC TIẾN của một chuỗi — chỗ tiếng kế tiếp bắt đầu, không phải mép nét mực.
 *
 * Chữ nghiêng có nét chìa ra khỏi ô của nó: "nghĩ" ở cỡ 100 có vết mực 225 mà
 * bước tiến chỉ 211. Lấy vết mực làm bước nhảy thì mỗi tiếng đẩy tiếng sau ra xa
 * thêm tới 14% cỡ chữ, và cả hàng giãn ra so với trang xem — trang xem để trình
 * bày lo, mà trình bày luôn đi theo bước tiến.
 *
 * Đo bằng cách nhân đôi chuỗi: vết mực của "AA" bằng bước tiến của "A" cộng vết
 * mực của "A", nên hiệu hai phép đo chính là bước tiến. Cả hai đều đã nhớ sẵn.
 */
/**
 * Cộng bao nhiêu vào `y` để CHÂN CHỮ của tiếng này thẳng hàng với các tiếng khác.
 *
 * `drawtext` đặt mép trên VỆT MỰC vào đúng `y`, chứ không đặt hộp dòng. Nên hai
 * tiếng cùng `y` mà một tiếng có dấu chồng dấu (`ấ`, `Ừ`) còn tiếng kia chỉ có
 * chữ thấp (`an`) thì chân chữ lệch nhau tới 61% cỡ chữ — đo trên chính ffmpeg,
 * và có ở CẢ MƯỜI MỘT font trong kho.
 *
 * Bù bằng chính khoảng trống phía trên vệt mực: cộng nó vào thì mọi tiếng đều
 * đặt chân lên cùng một đường, đúng chỗ mà hộp dòng chỉ định. Đó cũng chính là
 * chỗ CSS đặt chân chữ ở trang xem, nên phép bù này kéo hai đường vẽ về một mối
 * chứ không phải thêm một luật riêng cho máy chủ.
 *
 * Nhớ theo tiếng như `baseWidth`, và đo ở cỡ gốc rồi nhân tỉ lệ — khoảng trống
 * ấy tỉ lệ thuận với cỡ chữ.
 */
const inkTopCache = new Map<string, number>();

export async function inkTopOffset(
  text: string,
  fontSize: number,
  pack: ShownPack,
) {
  const fontPath = resolvePackFont(pack.font.file);
  const key = `${fontPath}|${text}`;
  let base = inkTopCache.get(key);
  if (base === undefined) {
    base = await measureInkTop(text, fontPath, BASE_SIZE);
    if (inkTopCache.size > 5000) inkTopCache.clear();
    inkTopCache.set(key, base);
  }
  return (base * fontSize) / BASE_SIZE;
}

export async function advanceWidth(
  text: string,
  fontSize: number,
  pack: ShownPack,
) {
  const [single, doubled] = await Promise.all([
    baseWidth(text, pack),
    baseWidth(text + text, pack),
  ]);
  return ((doubled - single) * fontSize) / BASE_SIZE;
}
