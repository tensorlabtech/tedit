/**
 * Phép tính của một cụm chữ overlay — không có React, không có style.
 *
 * Tách riêng vì đây là chỗ QUYẾT ĐỊNH mọi số đo, mà nó phải khớp với
 * `server/text-layout.ts` và `server/word-layout.ts`. Trộn vào chỗ dựng giao diện
 * thì mỗi lần sửa giao diện là một lần có nguy cơ lệch số so với bản in ra.
 *
 * Bố cục là HAI TRỤC, không phải một danh sách:
 *
 * - **Căn** — các hàng nằm đâu theo bề ngang.
 * - **Nhấn** — trong cụm, tiếng nào to hơn tiếng nào.
 *
 * Bản trước gộp cả hai vào một danh sách mười một kiểu. Hai hộp chọn mà chỉ giữ
 * được một giá trị, nên bấm bên này là mất bên kia — giao diện bày ra hai lựa chọn
 * trong khi máy chỉ có một. Gộp như thế còn sinh kiểu TRÙNG ("lệch tâm" chính là
 * căn phải, "so le" chính là một cách căn) và làm mất những tổ hợp không gọi ra
 * được (căn giữa + từ khoá to hẳn). Hai trục: chín nút cho hai mươi dáng, không nút
 * nào lặp ý nút nào.
 */

/** Trần dòng: dài hơn thì TÁCH CỤM, không co chữ. Khớp `MAX_LINES` của máy chủ. */
export const MAX_LINES = 3;

/**
 * Họ chữ của lớp overlay — phải là ĐÚNG họ mà bản in ra dùng.
 *
 * Bản in dùng tệp `Arial Bold Italic`. Trước đây trang xem không đặt họ chữ nên
 * ăn theo font giao diện: hai bên xếp chữ theo hai bộ số đo khác nhau, cùng một
 * cụm ra hai cỡ và hai chỗ bẻ dòng.
 */
export const OVERLAY_FONT_STACK = "Arial, Helvetica, sans-serif";

/** Bề rộng trung bình một ký tự — chỉ dùng khi không đo được (không có DOM). */
const CHAR_WIDTH = 0.6;

/** Khoảng cách giữa hai tiếng, theo cỡ chữ. Khớp `WORD_GAP` của máy chủ và `marginRight` khi vẽ. */
export const WORD_GAP = 0.12;

const BASE_SIZE = 100;
const widthCache = new Map<string, number>();
const measurer =
  typeof document === "undefined"
    ? null
    : document.createElement("canvas").getContext("2d");

/**
 * Bề rộng thật của một chuỗi ở cỡ gốc, đo bằng chính font sẽ vẽ.
 *
 * Đếm ký tự rồi nhân một hằng số là cách ước rẻ tiền nhưng sai lệch tới hàng
 * chục phần trăm: "IIIII" và "mmmmm" cùng năm ký tự mà rộng gấp đôi nhau. Sai số
 * đó đẩy cả cỡ chữ lẫn chỗ bẻ dòng lệch khỏi bản in ra.
 */
function baseWidth(text: string) {
  const hit = widthCache.get(text);
  if (hit !== undefined) return hit;
  let width: number;
  if (measurer) {
    measurer.font = `italic 800 ${BASE_SIZE}px ${OVERLAY_FONT_STACK}`;
    const metric = measurer.measureText(text);
    // Lấy bề rộng VẾT MỰC, không lấy bước tiến con trỏ. Chữ nghiêng có nét chìa
    // ra khỏi ô của nó, nên bước tiến hụt chừng 5% — đúng bằng mức làm cụm chữ
    // rộng hơn bản in ra. Máy chủ đo bằng vết mực nên hai bên phải cùng cách đo.
    const ink =
      metric.actualBoundingBoxRight + Math.max(0, metric.actualBoundingBoxLeft);
    width = Math.max(metric.width, Number.isFinite(ink) ? ink : 0);
  } else {
    width = text.length * CHAR_WIDTH * BASE_SIZE;
  }
  if (widthCache.size > 5000) widthCache.clear();
  widthCache.set(text, width);
  return width;
}

/** Cỡ lớn nhất và nhỏ nhất theo tỉ lệ bề rộng khung. */
const MAX_SCALE = 0.15;
/**
 * Bước dòng — phải KHỚP `LINE_HEIGHT` của `server/text-layout.ts`.
 *
 * Các dòng gần chạm nhau để cả khối đọc ra một mảng đặc. Không xuống dưới 1:
 * tiếng Việt có dấu chồng dấu (`Ắ`, `Ữ`, `ệ`), dưới 1 là dấu bị cắt cụt.
 */
export const LINE_HEIGHT = 1;
const MIN_SCALE = 0.09;

export type AlignId = "left" | "center" | "right" | "stair" | "stagger";
export type EmphasisId = "even" | "keyword-large" | "mixed-size" | "taper";
export type BandId = "top" | "middle" | "bottom";

export const ALIGNS: Array<{ id: AlignId; label: string; note: string }> = [
  { id: "center", label: "Giữa", note: "Mọi hàng căn giữa khung" },
  { id: "left", label: "Trái", note: "Mọi hàng bám lề trái" },
  { id: "right", label: "Phải", note: "Mọi hàng bám lề phải" },
  { id: "stair", label: "Bậc thang", note: "Hàng sau thụt vào dần" },
  { id: "stagger", label: "So le", note: "Mỗi hàng lệch một mức khác nhau" },
];

export const EMPHASES: Array<{ id: EmphasisId; label: string; note: string }> =
  [
    { id: "even", label: "Đều nhau", note: "Mọi tiếng cùng một cỡ" },
    {
      id: "keyword-large",
      label: "Từ khoá to hẳn",
      note: "Đoạn từ khoá phóng to, phần còn lại lùi về cỡ nhỏ",
    },
    {
      id: "mixed-size",
      label: "Xen cỡ",
      note: "To nhỏ đan nhau ngay trong một hàng",
    },
    {
      id: "taper",
      label: "Dẫn nhỏ · ý to",
      note: "Hàng đầu nhỏ và mờ, hàng sau mới là ý chính",
    },
  ];

export const BANDS: Array<{
  id: BandId;
  label: string;
  edge: "top" | "bottom" | "center";
  at: number;
  note?: string;
}> = [
  { id: "top", label: "Trên", edge: "top", at: 0.12 },
  {
    id: "middle",
    label: "Giữa",
    edge: "center",
    at: 0.5,
    // Giữa khung là chỗ có MẶT người nói. Vẫn để chọn được — có lúc cần, như
    // một tấm bìa đè lên b-roll — nhưng nói rõ giá của nó ngay tại chỗ chọn.
    note: "Che mặt người nói — chỉ dùng khi thật sự cần",
  },
  { id: "bottom", label: "Dưới", edge: "bottom", at: 0.8 },
];

/**
 * Chỗ khối chữ được phép chiếm, tính theo chiều cao khung.
 *
 * PHẢI khớp `MAX_BLOCK_SHARE` / `TOP_BLOCK_SHARE` bên `server/text-layout.ts` —
 * một bên là trang xem, một bên là bản in ra. Lệch nhau thì cảnh báo "chữ đè
 * chữ" báo sai, mà sai kiểu nào cũng tệ: báo thừa thì người dùng học cách phớt
 * lờ, báo thiếu thì họ xuất ra video hỏng.
 */
const BLOCK_SHARE = 0.3;

/** Khoảng cao NHẤT một khối ở dải này có thể chiếm: `[mép trên, mép dưới]`. */
export function bandSpan(id: BandId): [number, number] {
  const band = BANDS.find((item) => item.id === id) ?? BANDS[0];
  if (band.edge === "top") return [band.at, band.at + BLOCK_SHARE];
  if (band.edge === "bottom") return [band.at - BLOCK_SHARE, band.at];
  return [band.at - BLOCK_SHARE / 2, band.at + BLOCK_SHARE / 2];
}

/**
 * Hai dải có thể CHẠM nhau không.
 *
 * Suy từ hình học, không chép tay thành bảng. Bảng chép tay đã sai một lần: nó
 * ghi Sát trên không đụng ai cả — đúng với Sát đáy (34% hụt dưới 35%) nhưng sai
 * với Trên mặt, dải này bắt đầu ngay ở 30%. Hai khối chồng nhau 4% mà khung sửa
 * im lặng, người dùng chỉ biết khi nhìn thấy chữ trộn vào nhau ở khung xem.
 */
export function bandsOverlap(a: BandId, b: BandId) {
  const [a1, a2] = bandSpan(a);
  const [b1, b2] = bandSpan(b);
  return a1 < b2 && b1 < a2;
}

/** Bề rộng một chuỗi theo tỉ lệ khung, ở cỡ `size`. */
export const widthOf = (text: string, size: number) =>
  (baseWidth(text) / BASE_SIZE) * size;

/**
 * Bẻ dòng kiểu tham lam: nhồi vào dòng hiện tại tới khi hết chỗ.
 *
 * Đo TỪNG TIẾNG rồi cộng `WORD_GAP`, không đo cả chuỗi đã nối bằng dấu cách:
 * lúc vẽ, khoảng giữa hai tiếng là `WORD_GAP` nhân cỡ chữ chứ không phải bề rộng
 * dấu cách của font. Đo một đằng vẽ một nẻo thì khung xem và bản in ra chia dòng
 * khác nhau — mà đó là điều bảng dev này sinh ra để bắt.
 */
function wrapAt(words: string[], size: number, avail: number) {
  const width = (list: string[]) =>
    list.reduce((sum, item) => sum + widthOf(item, size), 0) +
    Math.max(0, list.length - 1) * size * WORD_GAP;
  const lines: string[] = [];
  let current: string[] = [];
  for (const word of words) {
    const next = [...current, word];
    if (current.length > 0 && width(next) > avail) {
      lines.push(current.join(" "));
      current = [word];
      continue;
    }
    current.push(word);
  }
  if (current.length > 0) lines.push(current.join(" "));
  return lines;
}

export type Fitted = {
  lines: string[];
  size: number;
  /** Không cỡ nào cho vừa trần dòng — phải tách thành nhiều cụm */
  needsSplit: boolean;
};

/**
 * Cỡ chữ LỚN NHẤT mà cụm vẫn nằm trong trần dòng.
 *
 * Dò từ trên xuống chứ không tính công thức: bẻ dòng là phép tham lam nên bề rộng
 * không phải hàm trơn của cỡ chữ — một cỡ nhỏ hơn vẫn có thể ra nhiều dòng hơn.
 *
 * `avail` BẮT BUỘC truyền, không có mặc định. Trước đây mặc định 0,9 — không dải
 * nào rộng thế (0,78 ở Trên, 0,71 ở Giữa/Dưới), nên nơi nào quên truyền là tính
 * ra ít dòng hơn thật. Bảng dev quên đúng chỗ đó và báo "LỆCH với khung xem"
 * trong khi khung xem không hề lệch — chính cái thước bị sai.
 */
export function fitGroup(text: string, avail: number): Fitted {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0)
    return { lines: [], size: MAX_SCALE, needsSplit: false };

  // Chừa 3%: phép ước theo số ký tự có lúc hụt so với font thật, mà hụt là dòng
  // chạm mép rồi bị bẻ thêm.
  const room = avail * 0.97;
  for (let size = MAX_SCALE; size >= MIN_SCALE; size -= 0.005) {
    const lines = wrapAt(words, size, room);
    if (lines.length <= MAX_LINES) return { lines, size, needsSplit: false };
  }
  return {
    lines: wrapAt(words, MIN_SCALE, room).slice(0, MAX_LINES),
    size: MIN_SCALE,
    needsSplit: true,
  };
}

/**
 * Tách câu dài thành nhiều cụm, mỗi cụm nằm trong trần dòng.
 *
 * Chia đôi rồi thử lại: chia theo TIẾNG nên không bao giờ cắt giữa một tiếng, và
 * hai nửa luôn còn nghĩa hơn là cắt phần đuôi đi.
 */
export function splitGroup(text: string, avail = 0.9, depth = 0): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || depth >= 3) return [words.join(" ")];
  if (!fitGroup(text, avail).needsSplit) return [words.join(" ")];
  const mid = Math.ceil(words.length / 2);
  return [
    ...splitGroup(words.slice(0, mid).join(" "), avail, depth + 1),
    ...splitGroup(words.slice(mid).join(" "), avail, depth + 1),
  ];
}

/** Dồn các tiếng vào tối đa `MAX_LINES` hàng — khớp `word-layout.ts` của máy chủ. */
export function packRows(words: string[]) {
  const perRow = Math.ceil(words.length / MAX_LINES);
  const rows: string[][] = [];
  for (let i = 0; i < words.length; i += perRow) {
    rows.push(words.slice(i, i + perRow));
  }
  return rows;
}

/** Cỡ chữ cho một hàng: lớn nhất mà hàng vẫn nằm trong bề rộng cho phép. */
export function fitRow(text: string, avail: number, rows: number) {
  // Chia theo số hàng để cả khối không cao quá nửa khung.
  const byHeight = MAX_SCALE * (rows > 2 ? 0.7 : rows > 1 ? 0.85 : 1);
  // Chừa 6%: ước theo số ký tự luôn hụt so với bản nghiêng nét 800, mà hàng đã bị
  // cấm bẻ dòng nên hụt là chữ chạm mép khung.
  const byWidth = (avail * 0.94) / Math.max(0.001, widthOf(text, 1));
  return Math.max(MIN_SCALE, Math.min(byHeight, byWidth));
}

/**
 * Thụt lề của một hàng theo trục CĂN — khớp `indentShare` của máy chủ.
 *
 * Tổng thụt bị chặn 11%: không chặn thì hàng cuối đẩy chữ ra ngoài khung.
 */
export function indentOf(align: AlignId, index: number, rowCount: number) {
  if (index === 0) return 0;
  if (align === "left" || align === "center" || align === "right") return 0;
  if (align === "stagger") return [0, 0.14, 0.04][index % 3];
  return Math.min(0.055, 0.11 / Math.max(1, rowCount - 1)) * index;
}

/**
 * Cách TƯ LIỆU CHÈN hiện ra — chỉ HAI kiểu.
 *
 * Bản trước có năm kiểu, mỗi kiểu 0,4 giây với biên độ 6%: đo thì đúng, xem thì
 * không thấy — dưới ngưỡng nhận ra trên điện thoại. Thà hai kiểu rõ hơn năm kiểu
 * phải căng mắt tìm.
 */
export type RevealId = "none" | "fade" | "fade-up";

export const REVEALS: Array<{ id: RevealId; label: string; note: string }> = [
  { id: "none", label: "Cắt thẳng", note: "Hiện ngay, không hiệu ứng" },
  {
    id: "fade-up",
    label: "Mờ + lên",
    note: "Mờ dần thành rõ, đồng thời trượt từ dưới lên — 0,8 giây",
  },
  { id: "fade", label: "Mờ dần", note: "Chỉ mờ thành rõ, không chuyển động" },
];

/** Khớp `REVEAL_SECONDS` và `REVEAL_RISE` của `server/render.ts`. */
export const REVEAL_SECONDS = 0.8;
export const REVEAL_RISE = 0.1;

/**
 * Cách đánh dấu CHỖ NỐI giữa hai đoạn.
 *
 * Bốn kiểu, điểm chung: **không kiểu nào ăn thời gian**. Mờ chồng (`xfade`) thì ăn —
 * hai đoạn gối nhau 0,4 giây là tổng ngắn đi 0,4 giây, mà mốc của mọi chữ, mọi tư
 * liệu và cả năm chục cụm phụ đề đều tính từ tổng độ dài các khoảng còn giữ. Thêm
 * mờ chồng mà không tính lại hết thì mọi thứ trôi dần, bảy chỗ nối là lệch gần ba
 * giây ở cuối. Nên chưa làm — và chưa làm thì không bày.
 */
export type JunctionId = "none" | "zoom-in" | "zoom-out" | "flash" | "dip";

export const JUNCTIONS: Array<{
  id: JunctionId;
  label: string;
  note: string;
}> = [
  { id: "none", label: "Cắt thẳng", note: "Chuyển ngay, không đánh dấu gì" },
  {
    id: "zoom-in",
    label: "Zoom vào",
    note: "Dồn dần vào rồi buông nhanh — cảnh cũ ập tới rồi cắt",
  },
  {
    id: "zoom-out",
    label: "Zoom ra",
    note: "Giật một nhát rồi trôi ra chậm — cảnh mới từ từ mở ra",
  },
  {
    id: "flash",
    label: "Nháy sáng",
    note: "Sáng bừng 0,12 giây rồi tắt — nhịp nhanh, hợp video ngắn",
  },
  {
    id: "dip",
    label: "Chìm đen",
    note: "Tối đi rồi sáng lại trong 0,18 giây — ngắt ý rõ hơn",
  },
];

/** Khớp bộ số của `server/render.ts`. */
export const FLASH_SECONDS = 0.12;
export const FLASH_AMOUNT = 0.7;
export const DIP_SECONDS = 0.18;

export const PUNCH_SECONDS = 0.5;
export const PUNCH_SCALE = 0.08;
/** Nửa NGẮN của một chỗ nối — khớp `PUNCH_QUICK` của `server/render.ts`. */
export const PUNCH_QUICK = 0.15;

/**
 * Nhịp hai nửa mặc định của từng kiểu: [trước đỉnh, sau đỉnh], tính bằng giây.
 * Khớp `junctionHalves` của `server/render.ts`.
 */
export function junctionHalves(kind: JunctionId): [number, number] {
  if (kind === "flash") return [FLASH_SECONDS, FLASH_SECONDS];
  if (kind === "dip") return [DIP_SECONDS, DIP_SECONDS];
  if (kind === "zoom-out") return [PUNCH_QUICK, PUNCH_SECONDS];
  return [PUNCH_SECONDS, PUNCH_QUICK];
}

/** Quãng mặc định của một hiệu ứng đặt tại `at` — đỉnh rơi đúng vào `at`. */
export function effectSpan(at: number, kind: JunctionId) {
  const [truoc, sau] = junctionHalves(kind);
  return { start: at - truoc, end: at + sau };
}

/**
 * ĐỈNH của xung bên trong một quãng — giữ nguyên tỉ lệ nhịp của kiểu, nên kéo
 * quãng dài ra thì "zoom vào" vẫn là dồn-chậm-buông-nhanh.
 * Khớp `effectPeak` của `server/render.ts`.
 */
export function effectPeak(start: number, end: number, kind: JunctionId) {
  const [truoc, sau] = junctionHalves(kind);
  return start + (end - start) * (truoc / (truoc + sau));
}

/**
 * HÌNH DÁNG khung tư liệu — bốn dáng, cùng bộ số với `shapeBox` của
 * `server/render.ts`.
 *
 * `full` đè kín khung; ba dáng còn lại là một hộp thụt 8% mỗi bên, đặt ở 13% chiều
 * cao. Bày ở màn Style mà bản in ra không có thì chọn xong lại ra dáng khác — nên
 * hai bên phải cùng một bảng số.
 */
export type ShapeId = "square" | "portrait" | "wide" | "full";

export const SHAPES: Array<{ id: ShapeId; label: string; ratio: string }> = [
  { id: "full", label: "Đè kín", ratio: "9 / 16" },
  { id: "wide", label: "Ngang", ratio: "16 / 9" },
  { id: "square", label: "Vuông", ratio: "1 / 1" },
  { id: "portrait", label: "Dọc", ratio: "3 / 4" },
];

/** Hộp của một dáng, theo TỈ LỆ khung — nơi gọi nhân với bề rộng/cao thật. */
export function shapeBox(shape: ShapeId) {
  if (shape === "full") return { x: 0, y: 0, w: 1, h: 1 };
  const w = 0.84;
  const ratio = shape === "square" ? 1 : shape === "portrait" ? 3 / 4 : 16 / 9;
  // Cao tính theo BỀ RỘNG khung rồi đổi sang tỉ lệ chiều cao (khung 9:16).
  const h = Math.min(0.74, (w / ratio) * (9 / 16));
  return { x: 0.08, y: 0.13, w, h };
}
