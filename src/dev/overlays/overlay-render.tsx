import { NHIP_DEN } from "../../../server/style-pack-catalog";
import {
  cssColor,
  headlineRoom,
  headlineTopShare,
  pieceFont,
  trimHeadline,
  styleCase,
  withFontRole,
  type ShownPack,
  type StylePack,
} from "../../../server/style-pack";


/** Bộ mặc định đã chốt vai PHỤ ĐỀ — cùng mặc định với `overlay-model.ts`. */
const BASE_SHOWN = withFontRole(NHIP_DEN, "voice");
import { OverlayFrame } from "./overlay-frame";
import {
  BANDS,
  fitGroup,
  fitRow,
  indentOf,
  packRows,
  widthOf,
  type AlignId,
  type BandId,
  type EmphasisId,
} from "./overlay-model";
import { revealStyle } from "./use-reveal-loop";

/**
 * MỘT bộ dựng cho mọi dáng, chạy từ chữ thật.
 *
 * Hai trục vào đây theo hai đường tách bạch: **nhấn** quyết định chia hàng và cỡ
 * từng tiếng, **căn** chỉ quyết định hàng nằm đâu theo bề ngang. Trộn hai việc đó
 * vào một nhánh là cách sinh ra kiểu trùng nhau — đúng chỗ bản trước bị.
 */

export type Insert = {
  kind: "none" | "image" | "video";
  shape: "square" | "portrait" | "wide" | "full";
};

export type OverlayConfig = {
  text: string;
  align: AlignId;
  emphasis: EmphasisId;
  band: BandId;
  /** Tiếng được đánh dấu là từ khoá — đậm hơn, và là tiếng được phóng to */
  keywords: string[];
  insert: Insert;
};

const SHAPE_RATIO: Record<Insert["shape"], string> = {
  square: "1 / 1",
  portrait: "3 / 4",
  wide: "16 / 9",
  full: "9 / 16",
};

/**
 * Bề dày viền: `edge.share` của bộ dáng, NHÂN ĐÔI khi đặt vào `WebkitTextStroke`.
 *
 * `drawtext` vẽ viền RA NGOÀI nét, còn CSS vẽ viền GIỮA đường biên (một nửa vào
 * trong), nên cùng một con số thì bản in ra dày gấp đôi trang xem.
 */

/** Một tiếng đã có đủ số đo — lúc vẽ không còn gì phải quyết định. */
type Placed = {
  text: string;
  size: number;
  bold: boolean;
  color: string;
  /** Tiếng nhấn phủ ÁNH KIM (gradient chrome) thay màu đặc — bộ dáng có `sheen`. */
  sheen?: boolean;
  /** Tiếng nhấn (từ khoá) — vẽ bằng vai `accent` (font per-word ở bộ hai-họ). */
  keyword?: boolean;
};
type Row = Placed[];

/** Vùng chữ: neo theo dải, và chừa lề phải rộng hơn ở hai dải dưới vì cột nút. */
function bandStyle(band: BandId): React.CSSProperties {
  const found = BANDS.find((item) => item.id === band) ?? BANDS[0];
  const right = band === "top" ? "11%" : "18%";
  if (found.edge === "top")
    return { top: `${found.at * 100}%`, left: LEFT, right };
  if (found.edge === "bottom")
    return { bottom: `${(1 - found.at) * 100}%`, left: LEFT, right };
  // Giữa: neo bằng TÂM khối nên cao mấy dòng cũng tự căn giữa — cùng cách
  // `word-layout.ts` đặt `y` cho bản in ra.
  return {
    top: `${found.at * 100}%`,
    transform: "translateY(-50%)",
    left: LEFT,
    right,
  };
}

/** Bề rộng dùng được của dải này, tính theo tỉ lệ khung. */
/** Lề trái — khớp `SAFE.left` của máy chủ. */
const LEFT = "11%";

export const availOf = (band: BandId) => (band === "top" ? 0.78 : 0.71);

/**
 * Trục NHẤN: chia cụm thành hàng và định cỡ từng tiếng.
 *
 * Đây là chỗ DUY NHẤT quyết định cỡ chữ. Trục căn không được sửa cỡ — sửa cỡ theo
 * chỗ đứng thì hai lựa chọn của người dùng dính vào nhau, và đổi một cái thì cái
 * kia thành gì không ai đoán được.
 */
export function buildRows(config: OverlayConfig, pack: ShownPack = BASE_SHOWN): Row[] {
  const COLOR = {
    main: cssColor(pack.color.main),
    key: cssColor(pack.color.key),
    dim: cssColor(pack.color.dim),
  };
  // Áp trục HOA NGAY TỪ ĐÂY, giống `splitPieces` của máy chủ: mọi phép đo phía
  // sau chạy trên chuỗi này. Không dùng `text-transform: uppercase` vì làm thế
  // là đo chuỗi gốc mà vẽ chuỗi hoa — cụm chữ tự rộng thêm sau lưng phép đo.
  const words = styleCase(config.text, pack).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const avail = availOf(config.band);
  // Đối chiếu từ khoá trên chuỗi GỐC: bật chữ hoa không được làm mất dấu người
  // dùng đã đánh.
  const keys = new Set(
    config.keywords.map((word) => styleCase(word, pack).toLowerCase()),
  );
  const isKey = (word: string) => keys.has(word.toLowerCase());
  const plain = (word: string, size: number): Placed => ({
    text: word,
    size,
    bold: isKey(word),
    color: isKey(word) ? COLOR.key : COLOR.main,
    sheen: isKey(word) && !!pack.sheen,
    keyword: isKey(word),
  });

  if (config.emphasis === "even") {
    // Bẻ dòng theo bề rộng rồi dùng CHUNG một cỡ — dáng phụ đề khổ lớn. Truyền
    // `isKey` để ĐO mỗi tiếng bằng đúng font vai (per-word) → không tràn khung.
    const { lines, size } = fitGroup(words.join(" "), avail, pack, isKey);
    return lines.map((line) =>
      line.split(/\s+/).map((word) => plain(word, size)),
    );
  }

  if (config.emphasis === "keyword-large") {
    // Lấy đoạn từ khoá LIỀN NHAU làm tiếng khổng lồ, phần trước lên trên, phần sau
    // xuống dưới. Bốc riêng một tiếng ra giữa thì câu đọc lộn thứ tự.
    const marked = words.map(isKey);
    const from = marked.indexOf(true);
    let last = from;
    while (last + 1 < words.length && marked[last + 1]) last += 1;
    const hero = from >= 0 ? words.slice(from, last + 1) : [words[0]];
    const before = from >= 0 ? words.slice(0, from) : words.slice(1);
    const after = from >= 0 ? words.slice(last + 1) : [];
    const heroSize = fitRow(hero.join(" "), avail, 1, pack);
    const small = Math.min(heroSize * 0.4, 0.075);
    const secondary = (list: string[]): Row =>
      list.map((word) => ({
        text: word,
        size: small,
        bold: false,
        color: COLOR.dim,
      }));
    return [
      ...(before.length > 0 ? [secondary(before)] : []),
      // MÀU theo từ khoá THẬT, CỠ theo trục nhấn — cùng luật với máy chủ. Cụm
      // chưa đánh dấu tiếng nào thì `hero` là tiếng đầu, chọn theo VỊ TRÍ chứ
      // không theo nghĩa; tô nó bằng màu nhấn là một tiếng ngẫu nhiên đổi màu.
      hero.map((word) => ({
        text: word,
        size: heroSize,
        bold: isKey(word),
        color: isKey(word) ? COLOR.key : COLOR.main,
        sheen: isKey(word) && !!pack.sheen,
        keyword: isKey(word),
      })),
      ...(after.length > 0 ? [secondary(after)] : []),
    ];
  }

  if (config.emphasis === "mixed-size") {
    const SMALL = pack.density.mixedSmallRatio;
    // Chưa đánh dấu tiếng nào thì XEN THEO THỨ TỰ. Không có bước này, "xen cỡ"
    // không từ khoá cho ra cả cụm cùng một cỡ nhỏ — đúng cái tên hứa ngược lại,
    // mà người dùng vừa bấm xong lại thấy chữ bé đi thì tưởng mình bấm nhầm.
    const hasKeyword = words.some(isKey);
    const to = (word: string, index: number) =>
      hasKeyword ? isKey(word) : index % 2 === 0;
    // Cỡ giải từ TỔNG bề rộng của các cỡ khác nhau. Coi cả hàng cùng một cỡ thì ước
    // rộng gần gấp đôi thật, và chữ bị co quắt lại.
    const sizeOf = (list: string[], offset = 0) =>
      Math.min(
        // Trần là `density.maxScale`, KHÔNG phải một con số riêng. Trước đây chỗ
        // này để 0,24 trong khi máy chủ chặn ở 0,15: cụm ngắn ở kiểu xen cỡ hiện
        // trên trang xem to hơn hẳn bản xuất ra, mà chỉ cụm ngắn mới chạm trần
        // nên lệch này không lộ ở cụm dài.
        pack.density.maxScale,
        (avail * 0.94) /
          list.reduce(
            (sum, word, index) =>
              sum +
              widthOf(word, to(word, offset + index) ? 1 : SMALL, pack) +
              pack.density.wordGap,
            0,
          ),
      );
    // Một hàng là dáng gốc. Nhưng bảy tiếng nhồi một hàng thì cỡ tụt xuống 7% —
    // thành chữ chú thích. Chật thì xuống hàng, KHÔNG hạ cỡ.
    const rows = sizeOf(words) < 0.1 ? packRows(words) : [words];
    let seen = 0;
    return rows.map((row) => {
      const offset = seen;
      seen += row.length;
      const size = sizeOf(row, offset);
      return row.map((word, index) => {
        const big = to(word, offset + index);
        return {
          text: word,
          size: big ? size : size * SMALL,
          bold: big,
          color: isKey(word) ? COLOR.key : COLOR.main,
          sheen: isKey(word) && !!pack.sheen,
          keyword: isKey(word),
        };
      });
    });
  }

  // Dẫn nhỏ · ý to: hàng đầu là dẫn nhập nên nhỏ và mờ, hàng sau mới là ý.
  const rows = packRows(words);
  return rows.map((row, index) => {
    const lead = index === 0 && rows.length > 1;
    const text = row.join(" ");
    const size = lead
      ? fitRow(text, avail, 3, pack) * pack.density.leadRatio
      : fitRow(text, avail, rows.length, pack);
    return row.map((word) =>
      lead
        ? { text: word, size, bold: false, color: COLOR.dim }
        : plain(word, size),
    );
  });
}

function Syllable({
  word,
  pack,
  order,
  index,
  seconds,
  startAt,
  until,
  onPick,
}: {
  word: Placed;
  pack: ShownPack;
  order: number;
  index: number;
  seconds: number;
  /** Mốc hiện ra riêng của tiếng này; bỏ trống thì chạy nhịp đều theo hàng/cột */
  startAt?: number;
  /**
   * Tiếng SAU bắt đầu lúc nào — mép tắt của lớp tô sáng.
   *
   * Bỏ trống thì không tô sáng, kể cả khi bộ dáng bật trục đó: không biết tiếng
   * này kết thúc lúc nào thì tô cũng chỉ là đoán.
   */
  until?: number;
  /**
   * Bấm thẳng vào tiếng để đánh dấu từ khoá.
   *
   * Điều khiển phải là thứ GẦN NHẤT về không gian với nội dung nó chi phối. Hàng
   * thẻ tiếng ở bảng bên phải cách kết quả nửa màn hình, và nó lặp lại đúng những
   * tiếng đang hiện ngay trước mắt. Bỏ trống thì tiếng chỉ để nhìn.
   */
  onPick?: (text: string) => void;
}) {
  // ĐỔ CHÉO (Chalk) — khớp `word-layout.ts` bên máy chủ: mỗi tiếng trong hàng tụt
  // dần theo cột (`0,14 cỡ chữ/cột`) + dao động nhẹ, thành cascade chéo thay vì
  // hàng thẳng. Chỉ Phấn (`behindText` là dấu nhận bộ, cùng cách server gate).
  // Đơn vị `cqw` = phần trăm bề rộng khung, khớp offset điểm ảnh (theo cỡ khung)
  // của máy chủ. Cộng VÀO transform của hiệu ứng hiện chữ, không đè lên nó.
  // Font PER-WORD: tiếng nhấn dùng vai `accent`, tiếng thường dùng `voice` (bộ
  // hai-họ như Prism → nền sans + tiếng nhấn serif). Bộ một-họ thì hai vai trùng
  // → về đúng `pack.font` như cũ. Phép ĐO ở `wrapAt` cũng theo font này nên khớp.
  const font = pieceFont(pack, !!word.keyword);
  const reveal = revealStyle(pack, seconds, order, word.size, index, startAt);
  const diagCqw = pack.behindText
    ? word.size * (0.14 * index + 0.05 * Math.sin(index * 2.1 + order)) * 100
    : 0;
  const base =
    reveal.transform && reveal.transform !== "none" ? reveal.transform : "";
  const revealWithDiag: React.CSSProperties = diagCqw
    ? { ...reveal, transform: `${base} translateY(${diagCqw.toFixed(2)}cqw)`.trim() }
    : reveal;
  return (
    <span
      onPointerDown={
        onPick
          ? (event) => {
              // Chặn nổi bọt: khung xem bọc trong vùng bấm để chạy/dừng, không
              // chặn thì mỗi lần đánh dấu một tiếng là video chạy hoặc dừng theo.
              event.stopPropagation();
              event.preventDefault();
              onPick(word.text);
            }
          : undefined
      }
      style={{
        cursor: onPick ? "pointer" : undefined,
        pointerEvents: onPick ? "auto" : "none",
        // `inline-block`: thẻ inline thường bỏ qua `transform`, mất nửa hiệu ứng.
        display: "inline-block",
        whiteSpace: "nowrap",
        // Khoảng cách giữa các tiếng bằng LỀ, không bằng ký tự trắng: dấu cách nằm
        // cuối một thẻ `inline-block` bị trình bày cắt bỏ nên chữ dính vào nhau
        // ("Minhnghĩ"). Lỗi này chỉ lộ ở vài dáng nên rất dễ tưởng là lỗi font.
        marginRight: `${pack.density.wordGap}em`,
        fontSize: `${word.size * 100}cqw`,
        // Đúng họ chữ của bản in ra — không đặt thì nó ăn theo font giao diện.
        fontFamily: font.cssStack,
        // MỘT độ đậm cho mọi tiếng: máy chủ chỉ có một tệp font để vẽ, nên nó
        // không có cách nào làm tiếng này đậm hơn tiếng kia. Trước đây trang xem
        // đổi 600/800 theo từ khoá — một khác biệt chỉ tồn tại ở trang xem, và
        // với Arial thì trình duyệt gộp cả hai về Bold nên không ai thấy. Với
        // font thật có đủ hai độ đậm thì nó lộ ra thành "xem một đằng xuất một
        // nẻo". Từ khoá phân biệt bằng MÀU, không bằng độ đậm.
        fontWeight: font.cssWeight,
        // Nghiêng nằm trong chính TỆP font của bộ dáng, không phải một lựa chọn
        // riêng của trang xem.
        fontStyle: font.italic ? "italic" : "normal",
        lineHeight: pack.density.lineHeight,
        // Nền khối sau chữ, vẽ theo TỪNG TIẾNG — khớp `box=1` của `drawtext`,
        // vốn cũng vẽ nền cho từng lệnh vẽ chứ không cho cả khối.
        ...(pack.box
          ? {
              backgroundColor: cssColor(pack.box.tone),
              padding: `${pack.box.padShare}em ${pack.box.padShare * 1.4}em`,
              // Góc vuông: `drawtext` chỉ cho góc vuông, bo ở đây là trang xem
              // đẹp hơn bản xuất — đúng lỗi cả hệ này chống.
              borderRadius: 0,
            }
          : null),
        // TÔ SÁNG tiếng đang được nói — kiểu karaoke.
        //
        // Đổi thẳng `color` chứ không vẽ đè một lớp thứ hai như máy chủ: CSS đổi
        // được màu theo thời gian, còn `drawtext` thì không (chỉ `alpha`, `x`,
        // `y` nhận biểu thức có `t`). Hai đường vẽ khác cách làm nhưng ra cùng
        // một hình.
        ...(() => {
          const lit =
            pack.highlight &&
            startAt !== undefined &&
            until !== undefined &&
            seconds >= startAt &&
            seconds < until;
          if (!lit || !pack.highlight) return { color: word.color };
          return {
            color: cssColor(pack.highlight.tone),
            // Nền RIÊNG cho tiếng đang nói, đè lên nền thường. Dáng "ô sáng
            // chạy theo lời" khác hẳn dáng chỉ đổi màu chữ.
            ...(pack.highlight.box
              ? {
                  backgroundColor: cssColor(pack.highlight.box),
                  padding: `${pack.box?.padShare ?? 0.12}em ${(pack.box?.padShare ?? 0.12) * 1.4}em`,
                  borderRadius: 0,
                }
              : null),
          };
        })(),
        // Quầng mềm tách chữ khỏi nền — khớp `glow` của máy chủ.
        ...(pack.glow
          ? {
              textShadow: `0 0 ${word.size * pack.glow.cssBlurShare}cqw rgba(0,0,0,${pack.glow.opacity})`,
            }
          : null),
        // Viền mảnh bám sát nét, khớp `edge` của máy chủ: chỉ có quầng mềm thì
        // chữ trắng trên tư liệu sáng không đọc được. `paintOrder: stroke` vẽ
        // viền TRƯỚC rồi mới đè nét chữ lên — thiếu nó thì viền ăn vào trong và
        // chữ mảnh hẳn đi.
        ...(pack.edge
          ? {
              WebkitTextStrokeWidth: `${word.size * 2 * pack.edge.share * 100}cqw`,
              WebkitTextStrokeColor: cssColor(pack.edge.tone),
              paintOrder: "stroke fill",
            }
          : null),
        // ÁNH KIM — tô tiếng nhấn bằng gradient chrome qua `background-clip:text`:
        // màu chữ hoá TRONG SUỐT để lộ gradient bên dưới. Đè lên `color` phẳng ở
        // trên nên phải đứng SAU. Viền/quầng vẫn giữ (viền vẽ trước, quầng là bóng
        // của hình chữ). Chỉ tiếng từ khoá của bộ có `sheen` (vd Prism Pro).
        ...(word.sheen && pack.sheen
          ? {
              backgroundImage: `linear-gradient(${pack.sheen.angle}deg, ${pack.sheen.colors.join(", ")})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }
          : null),
        ...revealWithDiag,
      }}
    >
      {word.text}
    </span>
  );
}

/**
 * Khối chữ của một cụm — không có khung, không có ảnh nền.
 *
 * Tách ra để khung xem trước của editor dùng lại: một bộ dựng cho cả hai chỗ thì
 * không có bản thứ hai để lệch. `seconds` lớn nghĩa là đã hiện xong.
 */
export function OverlayTextBlock({
  config,
  pack = BASE_SHOWN,
  seconds,
  ring,
  wordStarts,
  span,
  onPickWord,
}: {
  config: OverlayConfig;
  /** Bộ dáng của dự án — quyết định font, màu, viền, quầng, nhịp */
  pack?: ShownPack;
  seconds: number;
  /** Viền báo đang chọn — chỉ dùng trong editor */
  ring?: boolean;
  /**
   * Mốc hiện ra của từng tiếng, tính từ đầu cụm. Chữ sinh ra từ lời thì có mốc
   * thật của bản chép lời nên truyền vào đây; chữ người dùng tự viết lại thì
   * không còn khớp tiếng nào với tiếng nào, để trống cho nó chạy nhịp đều.
   */
  wordStarts?: number[];
  /** Bấm vào một tiếng để đánh dấu từ khoá — chỉ bật cho chữ ĐANG CHỌN */
  onPickWord?: (text: string) => void;
  /**
   * Độ dài cụm. Có nó thì lúc thiếu mốc thật, các tiếng được RẢI ĐỀU trong đúng
   * khoảng này — cụm 2 giây thì tiếng cuối hiện ở giây thứ 2, chứ không phải
   * hiện xong từ giây 0,4 rồi đứng im.
   */
  span?: number;
}) {
  const rows = buildRows(config, pack);
  const totalSyllables = rows.reduce((sum, row) => sum + row.length, 0);
  // Đếm phẳng qua các hàng để tra mốc: `wordStarts` là một mảng theo thứ tự
  // tiếng trong câu, không chia hàng.
  let flat = -1;
  /**
   * Mốc hiện ra của tiếng thứ `at`. Vượt quá số tiếng thì trả mốc hết cụm — đó
   * là mép tắt của lớp tô sáng ở tiếng cuối.
   */
  const beat = (at: number): number | undefined => {
    if (wordStarts) return wordStarts[at] ?? span;
    if (span && totalSyllables > 1) return (span * at) / totalSyllables;
    return undefined;
  };
  const items =
    config.align === "center"
      ? "center"
      : config.align === "right"
        ? "flex-end"
        : "flex-start";
  return (
    <>
      <StylePlate pack={pack} />
      <div
        className="absolute"
        data-text-block=""
        // Tầng 2 — trên hình dán. Xem ghi chú `zIndex` ở `StyleGraphics`.
        style={{ ...bandStyle(config.band), zIndex: 2 }}
      >
      <div
        className={ring ? "rounded-md ring-2 ring-primary" : undefined}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: items,
          position: "relative",
          /*
           * HÌNH BÁM CHỮ — `-webkit-mask-box-image` là phép cắt ba lát của CSS,
           * đúng cùng mô hình với ba `overlay` bên máy chủ: hai đầu giữ nguyên
           * `cap` điểm ảnh, khúc giữa `stretch`.
           *
           * Dùng mặt nạ chứ không dùng `border-image`: `border-image` vẽ thẳng
           * ảnh nên không tô màu được, mà cả kiến trúc này sống bằng việc MỘT
           * hình dùng cho mọi bộ dáng, màu do bộ dáng khai.
           *
           * Một chỗ hai đường vẽ lệch, cố ý: bên đây khoanh hiện NGAY, bên máy
           * chủ đợi cụm hiện quá nửa. Khung xem của bàn dựng phần lớn thời gian
           * đứng yên ở một mốc, nên chờ ở đây chỉ làm người dùng tưởng nó hỏng.
           */
          ...wrapMaskStyle(pack),
        }}
      >
        {rows.map((row, index) => {
          const shift = indentOf(config.align, index, rows.length) * 100;
          return (
            <div
              key={`${row.map((word) => word.text).join("-")}-${index}`}
              style={{
                // Cấm bẻ dòng ở tầng HÀNG: thiếu nó thì trình bày âm thầm thêm
                // hàng khi phép ước bề rộng lệch, và cụm 3 hàng thành 4 hàng mà
                // không báo gì. Có nó thì lệch lộ ra thành chữ chạm mép.
                whiteSpace: "nowrap",
                /*
                 * `lineHeight: 0` ở tầng HÀNG — giết thanh chống của hộp dòng.
                 *
                 * Mỗi tiếng là một `inline-block` cao đúng `cỡ chữ × lineHeight`,
                 * nhưng hộp dòng chứa nó còn cộng thêm thanh chống của chính thẻ
                 * hàng, mà thẻ hàng thừa hưởng `line-height` của giao diện. Phần
                 * cộng thêm ấy không có bên `drawtext`, nên cả khối chữ trên
                 * trang xem cao hơn bản xuất — đo được tới 40 điểm ảnh ở khổ
                 * 1920, và nó đẩy lệch chỗ đứng của cả khối chữ.
                 */
                lineHeight: 0,
                ...(config.align === "right"
                  ? { marginRight: `${shift}%` }
                  : { marginLeft: `${shift}%` }),
              }}
            >
              {row.map((word, wordIndex) => {
                flat += 1;
                return (
                  <Syllable
                    key={`${word.text}-${wordIndex}`}
                    word={word}
                    pack={pack}
                    order={index}
                    index={wordIndex}
                    seconds={seconds}
                    startAt={beat(flat)}
                    // Chỉ tô sáng khi chữ CÒN KHỚP lời. Người dùng viết lại thì
                    // `wordStarts` rỗng và tô theo nhịp đều là tô bừa.
                    until={wordStarts ? beat(flat + 1) : undefined}
                    onPick={onPickWord}
                  />
                );
              })}
            </div>
          );
        })}
        </div>
      </div>
    </>
  );
}

/**
 * Đường dẫn PNG đồ hoạ, do Vite băm sẵn.
 *
 * `import.meta.glob` chứ không ghép chuỗi `/assets/...`: chuỗi ghép tay chỉ chạy
 * ở máy phát triển, còn bản dựng băm tên tệp — và lúc đó hình biến mất trên máy
 * chủ mà không lỗi nào báo.
 */
// `import.meta.glob` là API riêng của Vite (biên dịch tĩnh thành bản đồ URL đã
// băm). Bundler khác (webpack của Remotion) không có nó → `import.meta` thành `{}`
// và gọi `.glob(...)` ném lỗi lúc nạp module, làm HỎNG cả file dù export khác
// không đụng graphic. Bọc try/catch để module NẠP ĐƯỢC ở cả hai bundler: Vite vẫn
// băm URL như cũ (lời gọi literal giữ nguyên để Vite biến đổi), còn ở Remotion thì
// bản đồ rỗng và lớp tải asset trung lập lo phần graphic riêng.
let GRAPHIC_URLS: Record<string, string> = {};
try {
  GRAPHIC_URLS = import.meta.glob("../../../assets/graphics/png/*.png", {
    eager: true,
    query: "?url",
    import: "default",
  }) as Record<string, string>;
} catch {
  GRAPHIC_URLS = {};
}

/**
 * Bề rộng hai đầu của từng hình bám chữ, chép từ `assets/graphics/manifest.json`.
 *
 * Chép chứ không đọc thẳng: manifest đọc bằng `node:fs`, mà tệp này chạy ở trình
 * duyệt. Ba con số, và `check:style-pack` canh chúng khớp manifest — nên bản chép
 * này không trôi được.
 */
const WRAP_CAPS: Record<string, number> = {
  "khoanh-oval": 170,
  "gach-chan": 120,
};

export const graphicUrl = (id: string) =>
  Object.entries(GRAPHIC_URLS).find(([path]) => path.endsWith(`/${id}.png`))?.[1];

/**
 * HÌNH DÁN ở trang xem — bản sinh đôi của `graphicsSteps`.
 *
 * `mask-image` + `background-color` chính là `alphamerge` viết bằng CSS: hình chỉ
 * cho biết CHỖ NÀO có nét, màu đến từ bộ dáng. Một tệp PNG, mười bộ dáng.
 *
 * ## Một chỗ hai đường vẽ KHÔNG khớp, và nó cố ý
 *
 * Độ đục ở bản xuất nội suy theo độ sáng khung hình (`sceneLuma`). Hiện bản xuất
 * cũng chưa có con số ấy (đã bỏ bước đo) nên cả hai đường đều lấy ĐIỂM GIỮA hai
 * mức — nên lúc này chúng khớp; giữ mô tả cho khi bước Chuẩn bị nối lại nguồn đo.
 *
 * Chênh lệch cao nhất là nửa khoảng cách giữa `onDark` và `onLight`. Ghi ra đây
 * vì nó là một khoản nợ có ý thức, không phải một chỗ ai đó quên.
 */
function StyleGraphics({ pack }: { pack: Pick<StylePack, "graphics"> }) {
  if (!pack.graphics) return null;
  return (
    <>
      {pack.graphics.map((item) => {
        const url = graphicUrl(item.id);
        if (!url) return null;
        return (
          <div
            key={item.id}
            data-graphic={item.id}
            style={{
              position: "absolute",
              inset: 0,
              // Tầng 1: trên video, dưới chữ. Viết số ra thay vì trông vào thứ tự
              // thẻ — bàn dựng và trang thử xếp thẻ khác nhau, mà thứ tự LỚP thì
              // phải giống nhau ở cả hai.
              zIndex: 1,
              backgroundColor: item.color,
              opacity: (item.opacity.onDark + item.opacity.onLight) / 2,
              maskImage: `url(${url})`,
              maskSize: "100% 100%",
              WebkitMaskImage: `url(${url})`,
              WebkitMaskSize: "100% 100%",
            }}
          />
        );
      })}
    </>
  );
}

/**
 * VÙNG HÌNH — bản sinh đôi của `contentRect` ở phía CSS.
 *
 * Nó làm hai việc, và việc thứ hai mới là việc chính:
 *
 * 1. Thu hình lại, chừa lề, lề là nền màu.
 * 2. **Trở thành `@container` mới.** Mọi số đo bên trong viết bằng `cqw`, nên
 *    chuyển mốc container sang vùng hình là toàn bộ chữ, mảng màu, tiêu đề tự
 *    thu theo — không phải sửa một dòng nào ở các thành phần đó.
 *
 * Vế thứ hai là lý do bên máy chủ cũng chỉ cần truyền `rect.w`/`rect.h` vào
 * `placeWords`: hai đường vẽ giải cùng một bài bằng cùng một cách.
 *
 * ## Vì sao lề dọc dùng `cqw` chứ không dùng `%`
 *
 * `contentRect` đo cả bốn lề theo BỀ RỘNG khung. Trong CSS, `left: 3%` là 3% bề
 * rộng — đúng; nhưng `top: 3%` là 3% CHIỀU CAO — sai, và trên khung 9:16 nó lệch
 * 1,78 lần. `cqw` quy về bề rộng container cho cả bốn phía.
 */
export function ContentRect({
  pack,
  children,
}: {
  pack: Pick<StylePack, "frame" | "graphics">;
  children: React.ReactNode;
}) {
  const frame = pack.frame;
  return (
    <>
      {frame && (
        <div
          data-frame-bg=""
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: cssColor(frame.background),
          }}
        />
      )}
      {/* Hình dán đứng GIỮA: trên hình, dưới chữ — cùng thứ tự lớp với
          `render.ts`. Nó phủ đúng khổ KHUNG chứ không phủ vùng hình, vì một cái
          viền chạy quanh mép video đã thu vào thì thành hai lớp viền chồng nhau. */}
      <StyleGraphics pack={pack} />
      <div
        data-content-rect=""
        className="@container"
        style={{
          position: "absolute",
          overflow: "hidden",
          left: frame ? `${frame.inset.left * 100}cqw` : 0,
          right: frame ? `${frame.inset.right * 100}cqw` : 0,
          top: frame ? `${frame.inset.top * 100}cqw` : 0,
          bottom: frame ? `${frame.inset.bottom * 100}cqw` : 0,
        }}
      >
        {children}
      </div>
    </>
  );
}

/**
 * Style cắt ba lát cho hình bám chữ. `{}` là bộ dáng không có.
 *
 * `cap` đọc từ manifest — cùng một con số với phép `crop` bên máy chủ, nên hai
 * đường vẽ giữ nguyên hai đầu ở đúng cùng một bề rộng.
 */
function wrapMaskStyle(pack: Pick<StylePack, "wrap">): React.CSSProperties {
  if (!pack.wrap) return {};
  const url = graphicUrl(pack.wrap.id);
  const cap = WRAP_CAPS[pack.wrap.id];
  if (!url || cap === undefined) return {};
  return {
    backgroundColor: pack.wrap.color,
    opacity: (pack.wrap.opacity.onDark + pack.wrap.opacity.onLight) / 2,
    WebkitMaskBoxImage: `url(${url}) 0 ${cap} 0 ${cap} stretch`,
  } as React.CSSProperties;
}

/**
 * MẢNG MÀU — dải màu đặc bám mép trên hoặc mép dưới khung.
 *
 * Nằm TRONG `OverlayTextBlock` chứ không đứng riêng ở từng chỗ dựng khung: mảng
 * màu và chữ là một cặp, và bốn chỗ tự ghép lấy là bốn chỗ có thể quên một nửa.
 * Vẽ TRƯỚC khối chữ trong cây DOM nên chữ luôn nằm trên — cùng thứ tự lớp với
 * `drawbox` rồi `drawtext` ở máy chủ.
 *
 * Cao theo phần trăm CHIỀU CAO khung, đúng trục mà `heightShare` khai; `cqw` là
 * trục bề rộng nên dùng nó ở đây sẽ ra một chiều cao khác hẳn ở khổ 9:16.
 */
function StylePlate({ pack }: { pack: ShownPack }) {
  if (!pack.plate) return null;
  return (
    <div
      data-plate=""
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        [pack.plate.band === "top" ? "top" : "bottom"]: 0,
        height: `${pack.plate.heightShare * 100}%`,
        backgroundColor: cssColor(pack.plate.tone),
      }}
    />
  );
}

/**
 * DÒNG TIÊU ĐỀ ở trang xem — bản sinh đôi của `server/headline.ts`.
 *
 * Cùng công thức, khác PHÉP ĐO: máy chủ đo bằng ImageMagick với đúng tệp `.ttf`,
 * trình duyệt đo bằng canvas với đúng `@font-face` của tệp ấy. Hai phép đo, một
 * công thức — `headlineRoom` và `headlineTopShare` khai ở `style-pack.ts` nên
 * không có bản thứ hai để lệch.
 *
 * Đứng ở tầng KHUNG chứ không ở tầng cụm chữ: tiêu đề thuộc về cả dự án, một
 * dòng cho cả video. Đặt nó trong `OverlayTextBlock` thì mỗi cụm phụ đề vẽ thêm
 * một bản.
 */
export function Headline({
  text,
  pack,
}: {
  text: string | null | undefined;
  /** Bộ dáng của dự án — CHƯA chốt vai; tiêu đề tự chọn vai của nó. */
  pack: StylePack;
}) {
  if (!pack.title) return null;
  const clean = trimHeadline(text ?? "");
  if (!clean) return null;

  const shown = withFontRole(pack, pack.title.font);
  // Cùng lề với máy chủ: dải TRÊN, dải rộng nhất. Ở đây mọi số đo là PHẦN
  // bề rộng khung nên bề rộng khung là 1.
  const room = headlineRoom(pack.title, 1, availOf("top"));
  const wanted = pack.title.sizeShare;
  const width = widthOf(clean, wanted, shown);
  // Chỉ thu khi buộc phải — cùng luật với máy chủ, kể cả chỗ `floor`.
  const size = width > room ? Math.floor((wanted * room * 1e6) / width) / 1e6 : wanted;

  return (
    <div
      data-headline=""
      style={{
        position: "absolute",
        zIndex: 2,
        left: 0,
        right: 0,
        top: `${headlineTopShare(pack, size) * 100}%`,
        display: "flex",
        justifyContent: "center",
        // Cấm bẻ dòng: một dòng là cả định nghĩa của trục này. Thiếu nó thì tiêu
        // đề dài tự xuống hàng và đọc ra như một cụm phụ đề khổ lớn.
        whiteSpace: "nowrap",
        fontSize: `${size * 100}cqw`,
        // Hộp dòng cao đúng bằng cỡ chữ — `headlineTopShare` nhận vào con số đó.
        lineHeight: 1,
        fontFamily: shown.font.cssStack,
        fontWeight: shown.font.cssWeight,
        fontStyle: shown.font.italic ? "italic" : "normal",
        color: cssColor(pack.title.tone),
      }}
    >
      {clean}
    </div>
  );
}

export function OverlayRender({
  config,
  pack = BASE_SHOWN,
  seconds,
  showSafeArea = true,
  background,
  headline,
  headlinePack = NHIP_DEN,
}: {
  config: OverlayConfig;
  pack?: ShownPack;
  seconds: number;
  showSafeArea?: boolean;
  /** Video thật làm nền — xem chữ trên chất liệu thật, không trên ảnh tĩnh */
  background?: string | null;
  /** Dòng tiêu đề của dự án. Bỏ trống là không vẽ gì. */
  headline?: string | null;
  /** Bộ dáng CHƯA chốt vai — tiêu đề tự chọn vai của nó qua `title.font`. */
  headlinePack?: StylePack;
}) {
  return (
    <OverlayFrame showSafeArea={showSafeArea} background={background}>
      {config.insert.kind !== "none" &&
        (config.insert.shape === "full" ? (
          <MediaFill
            kind={config.insert.kind}
            className="absolute inset-0 size-full"
          />
        ) : (
          <div className="absolute inset-x-[8%] top-[13%]">
            <MediaFill
              kind={config.insert.kind}
              className="w-full rounded-md"
              ratio={SHAPE_RATIO[config.insert.shape]}
            />
          </div>
        ))}
      <ContentRect pack={headlinePack}>
        <Headline text={headline} pack={headlinePack} />
        <OverlayTextBlock config={config} pack={pack} seconds={seconds} />
      </ContentRect>
    </OverlayFrame>
  );
}

function MediaFill({
  kind,
  className,
  ratio,
}: {
  kind: "image" | "video";
  className: string;
  ratio?: string;
}) {
  const style = ratio ? { aspectRatio: ratio } : undefined;
  return kind === "video" ? (
    <video
      src="/dev-overlays/mau-video.mp4"
      className={`${className} object-cover`}
      style={style}
      muted
      loop
      autoPlay
      playsInline
    />
  ) : (
    <img
      src="/dev-overlays/mau-anh.jpg"
      alt=""
      className={`${className} object-cover`}
      style={style}
    />
  );
}
