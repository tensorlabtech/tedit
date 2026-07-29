import { OverlayFrame } from "./overlay-frame";
import {
  BANDS,
  OVERLAY_FONT_STACK,
  LINE_HEIGHT,
  WORD_GAP,
  fitCum,
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
 * Bề dày viền theo cỡ chữ — khớp `EDGE_SHARE` của `server/render.ts`.
 *
 * Nhân đôi khi đặt vào `WebkitTextStroke`: `drawtext` vẽ viền RA NGOÀI nét, còn
 * CSS vẽ viền GIỮA đường biên (một nửa vào trong), nên cùng một con số thì bản
 * in ra dày gấp đôi trang xem.
 */
const EDGE_SHARE = 0.022;

const COLOR = {
  main: "rgba(255,255,255,0.92)",
  soft: "#ffffff",
  dim: "rgba(214,219,224,0.72)",
};

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
export function buildRows(config: OverlayConfig): Row[] {
  const words = config.text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const avail = availOf(config.band);
  const isKey = (word: string) => config.keywords.includes(word);
  const plain = (word: string, size: number): Placed => ({
    text: word,
    size,
    bold: isKey(word),
    color: isKey(word) ? COLOR.soft : COLOR.main,
  });

  if (config.emphasis === "deu") {
    // Bẻ dòng theo bề rộng rồi dùng CHUNG một cỡ — dáng phụ đề khổ lớn.
    const { lines, size } = fitCum(config.text, avail);
    return lines.map((line) =>
      line.split(/\s+/).map((word) => plain(word, size)),
    );
  }

  if (config.emphasis === "tu-khoa-to") {
    // Lấy đoạn từ khoá LIỀN NHAU làm tiếng khổng lồ, phần trước lên trên, phần sau
    // xuống dưới. Bốc riêng một tiếng ra giữa thì câu đọc lộn thứ tự.
    const marked = words.map(isKey);
    const from = marked.indexOf(true);
    let last = from;
    while (last + 1 < words.length && marked[last + 1]) last += 1;
    const hero = from >= 0 ? words.slice(from, last + 1) : [words[0]];
    const before = from >= 0 ? words.slice(0, from) : words.slice(1);
    const after = from >= 0 ? words.slice(last + 1) : [];
    const heroSize = fitRow(hero.join(" "), avail, 1);
    const small = Math.min(heroSize * 0.4, 0.075);
    const phu = (list: string[]): Row =>
      list.map((word) => ({
        text: word,
        size: small,
        bold: false,
        color: COLOR.dim,
      }));
    return [
      ...(before.length > 0 ? [phu(before)] : []),
      hero.map((word) => ({
        text: word,
        size: heroSize,
        bold: true,
        color: COLOR.soft,
      })),
      ...(after.length > 0 ? [phu(after)] : []),
    ];
  }

  if (config.emphasis === "xen-co") {
    const SMALL = 0.55;
    // Chưa đánh dấu tiếng nào thì XEN THEO THỨ TỰ. Không có bước này, "xen cỡ"
    // không từ khoá cho ra cả cụm cùng một cỡ nhỏ — đúng cái tên hứa ngược lại,
    // mà người dùng vừa bấm xong lại thấy chữ bé đi thì tưởng mình bấm nhầm.
    const coDau = words.some(isKey);
    const to = (word: string, index: number) =>
      coDau ? isKey(word) : index % 2 === 0;
    // Cỡ giải từ TỔNG bề rộng của các cỡ khác nhau. Coi cả hàng cùng một cỡ thì ước
    // rộng gần gấp đôi thật, và chữ bị co quắt lại.
    const sizeOf = (list: string[], offset = 0) =>
      Math.min(
        0.24,
        (avail * 0.94) /
          list.reduce(
            (sum, word, index) =>
              sum +
              widthOf(word, to(word, offset + index) ? 1 : SMALL) +
              WORD_GAP,
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
        const lon = to(word, offset + index);
        return {
          text: word,
          size: lon ? size : size * SMALL,
          bold: lon,
          color: lon ? COLOR.soft : COLOR.main,
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
      ? fitRow(text, avail, 3) * 0.45
      : fitRow(text, avail, rows.length);
    return row.map((word) =>
      lead
        ? { text: word, size, bold: false, color: COLOR.dim }
        : plain(word, size),
    );
  });
}

function Tieng({
  word,
  order,
  index,
  seconds,
  startAt,
  onPick,
}: {
  word: Placed;
  order: number;
  index: number;
  seconds: number;
  /** Mốc hiện ra riêng của tiếng này; bỏ trống thì chạy nhịp đều theo hàng/cột */
  startAt?: number;
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
        marginRight: `${WORD_GAP}em`,
        fontSize: `${word.size * 100}cqw`,
        // Đúng họ chữ của bản in ra — không đặt thì nó ăn theo font giao diện.
        fontFamily: OVERLAY_FONT_STACK,
        fontWeight: word.bold ? 800 : 600,
        // Nghiêng là mặc định của hệ này: bản in ra dùng tệp font Bold Italic.
        fontStyle: "italic",
        lineHeight: LINE_HEIGHT,
        color: word.color,
        // Quầng mềm tách chữ khỏi nền — khớp `GLOW_RADIUS` của máy chủ.
        textShadow: `0 0 ${word.size * 12}cqw rgba(0,0,0,.9)`,
        // Viền mảnh bám sát nét, khớp `EDGE_SHARE`/`EDGE_COLOR` của máy chủ:
        // chỉ có quầng mềm thì chữ trắng trên tư liệu sáng không đọc được.
        // `paintOrder: stroke` vẽ viền TRƯỚC rồi mới đè nét chữ lên — thiếu nó
        // thì viền ăn vào trong và chữ mảnh hẳn đi.
        WebkitTextStrokeWidth: `${word.size * 2 * EDGE_SHARE * 100}cqw`,
        WebkitTextStrokeColor: "rgba(0,0,0,.7)",
        paintOrder: "stroke fill",
        ...revealStyle(seconds, order, word.size, index, startAt),
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
  seconds,
  ring,
  wordStarts,
  span,
  onPickWord,
}: {
  config: OverlayConfig;
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
  const rows = buildRows(config);
  const tongTieng = rows.reduce((sum, row) => sum + row.length, 0);
  // Đếm phẳng qua các hàng để tra mốc: `wordStarts` là một mảng theo thứ tự
  // tiếng trong câu, không chia hàng.
  let flat = -1;
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
        style={{ display: "flex", flexDirection: "column", alignItems: items }}
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
                ...(config.align === "right"
                  ? { marginRight: `${shift}%` }
                  : { marginLeft: `${shift}%` }),
              }}
            >
              {row.map((word, wordIndex) => {
                flat += 1;
                return (
                  <Tieng
                    key={`${word.text}-${wordIndex}`}
                    word={word}
                    order={index}
                    index={wordIndex}
                    seconds={seconds}
                    startAt={
                      wordStarts?.[flat] ??
                      (span && tongTieng > 1
                        ? (span * flat) / tongTieng
                        : undefined)
                    }
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
  seconds,
  showSafeArea = true,
  background,
}: {
  config: OverlayConfig;
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
      <OverlayTextBlock config={config} seconds={seconds} />
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
