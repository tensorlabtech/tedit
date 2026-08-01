import { GOC } from "../../../server/style-pack-catalog";
import {
  cssColor,
  styleCase,
  type StylePack,
} from "../../../server/style-pack";
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
type Placed = { text: string; size: number; bold: boolean; color: string };
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
export function buildRows(config: OverlayConfig, pack: StylePack = GOC): Row[] {
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
  });

  if (config.emphasis === "even") {
    // Bẻ dòng theo bề rộng rồi dùng CHUNG một cỡ — dáng phụ đề khổ lớn.
    const { lines, size } = fitGroup(words.join(" "), avail, pack);
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
  pack: StylePack;
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
        fontFamily: pack.font.cssStack,
        // MỘT độ đậm cho mọi tiếng: máy chủ chỉ có một tệp font để vẽ, nên nó
        // không có cách nào làm tiếng này đậm hơn tiếng kia. Trước đây trang xem
        // đổi 600/800 theo từ khoá — một khác biệt chỉ tồn tại ở trang xem, và
        // với Arial thì trình duyệt gộp cả hai về Bold nên không ai thấy. Với
        // font thật có đủ hai độ đậm thì nó lộ ra thành "xem một đằng xuất một
        // nẻo". Từ khoá phân biệt bằng MÀU, không bằng độ đậm.
        fontWeight: pack.font.cssWeight,
        // Nghiêng nằm trong chính TỆP font của bộ dáng, không phải một lựa chọn
        // riêng của trang xem.
        fontStyle: pack.font.italic ? "italic" : "normal",
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
        ...revealStyle(pack, seconds, order, word.size, index, startAt),
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
  pack = GOC,
  seconds,
  ring,
  wordStarts,
  span,
  onPickWord,
}: {
  config: OverlayConfig;
  /** Bộ dáng của dự án — quyết định font, màu, viền, quầng, nhịp */
  pack?: StylePack;
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
    <div className="absolute" style={bandStyle(config.band)}>
      <div
        className={ring ? "rounded-md ring-2 ring-primary" : undefined}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: items,
          position: "relative",
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
  );
}

export function OverlayRender({
  config,
  pack = GOC,
  seconds,
  showSafeArea = true,
  background,
}: {
  config: OverlayConfig;
  pack?: StylePack;
  seconds: number;
  showSafeArea?: boolean;
  /** Video thật làm nền — xem chữ trên chất liệu thật, không trên ảnh tĩnh */
  background?: string | null;
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
      <OverlayTextBlock config={config} pack={pack} seconds={seconds} />
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
