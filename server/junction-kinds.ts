/**
 * VỐN TỪ CHUYỂN CẢNH — một khai báo cho cả hai đường vẽ.
 *
 * Trước đây bốn kiểu nằm rải ở ba nơi: `JunctionId` và `junctionHalves` ở
 * `server/render.ts`, bản sao của chúng ở `src/dev/overlays/overlay-model.ts`,
 * và phép áp CSS viết tay trong `preview-panel.tsx`. Thêm một kiểu là sửa ba
 * chỗ, mà quên một chỗ thì xem một đằng xuất một nẻo — đúng lỗi mà
 * `scripts/overlay-parity/` sinh ra để bắt.
 *
 * Nay mỗi kiểu khai MỘT lần ở đây, nói nó lái những biến hình nào. Máy chủ dịch
 * bảng ấy ra chuỗi lọc ffmpeg, trang xem dịch ra `transform` và `filter` của
 * CSS. Thêm kiểu mới chỉ là thêm một dòng.
 *
 * ══ HAI HỌ KIỂU, HAI CÁCH DỰNG ══
 *
 * **Họ MỘT LUỒNG (`drive`)** — bóp méo khuôn hình tại vết cắt: phóng, dịch,
 * xoay, sáng, màu, nhoè, tối viền. Chạy sau khi đã ghép, trên một khung hình
 * duy nhất. Dùng được ở MỌI chỗ nối, không đòi hỏi gì.
 *
 * **Họ HAI LUỒNG (`cross`)** — chuyển cảnh thật giữa hai cảnh: hoà tan, lau,
 * trượt chồng, vỡ hạt. Cần hai đoạn cùng hiện một lúc, nên phải dựng NGAY LÚC
 * GHÉP chứ không áp sau.
 *
 * ── Vì sao trước đây họ hai luồng bị coi là không làm được ──
 *
 * Cả hệ đứng trên phép "mốc ra = tổng độ dài các khoảng còn giữ": mốc từng chữ,
 * từng tư liệu, cả năm chục cụm phụ đề. Mà `xfade` làm hai đoạn gối lên nhau nên
 * tổng NGẮN ĐI — bảy chỗ nối là lệch gần ba giây ở cuối, phụ đề rơi sang câu
 * khác.
 *
 * Lối ra: MƯỢN ĐỆM TỪ CHÍNH QUÃNG VỪA BỊ CẮT BỎ. Kéo mỗi đoạn dài thêm nửa thời
 * lượng chuyển cảnh về phía quãng bỏ, rồi cho chúng gối nhau đúng chừng ấy —
 * phần thêm vào bằng đúng phần bị nuốt, tổng không đổi một phần nghìn giây. Đo
 * thật: ghép thẳng ra 10,000000 giây, hoà tan cũng ra 10,000000 giây.
 *
 * Phần mượn nằm trong quãng ĐÃ BỎ, tức quãng lặng — không có lời nào ở đó nên
 * không mất chữ nào.
 *
 * Điều kiện duy nhất: quãng bỏ phải đủ dài. Đo trên 98 chỗ nối thật, quãng bỏ
 * trung vị 2,36 giây và 76% chỗ nối mượn được. Chỗ nối cắt sát (người dùng cắt
 * thẳng, không bỏ gì) thì không mượn được — nó rơi về họ một luồng.
 */

/**
 * Những biến hình một kiểu có thể lái, mỗi cái là HỆ SỐ nhân với xung 0..1.
 *
 * Đơn vị chọn sao cho `1` là "mức chuẩn của trục đó", rồi bộ dáng nhân thêm
 * `intensity.punchScale` / `flashAmount` — nhờ vậy bộ "nhịp nhanh" và bộ "nhịp
 * êm" dùng chung một vốn từ mà ra hai cảm giác khác nhau.
 */
export type JunctionDrive = {
  /** Phóng to. 1 = đúng mức `intensity.punchScale` của bộ dáng. */
  zoom?: number;
  /** Sáng lên (+) hay tối đi (−). 1 = đúng mức `intensity.flashAmount`. */
  sang?: number;
  /** Bão hoà màu. 1 = gấp đôi, −1 = xám hẳn. */
  bhoa?: number;
  /** Xoay, tính bằng ĐỘ ở đỉnh xung. */
  xoay?: number;
  /** Dịch ngang, theo phần trăm bề rộng khung. */
  dichX?: number;
  /** Dịch dọc, theo phần trăm chiều cao khung. */
  dichY?: number;
  /** Nhoè, tính bằng pixel ở đỉnh xung (trên khung 1080 bề ngang). */
  nhoe?: number;
  /** Tối bốn góc. 1 = mức vừa phải. */
  vien?: number;
  /** Lệch sắc, tính bằng ĐỘ trên vòng màu. */
  sac?: number;
  /** Tương phản. 1 = mạnh thêm một nấc rõ rệt. */
  tuongPhan?: number;
};

/**
 * Nhóm CẢM GIÁC, không phải nhóm kỹ thuật.
 *
 * Người dùng mở danh sách này để tìm "cắt cho nó gắt" hay "chuyển cho nó êm".
 * Hai kiểu cùng dùng `scale` có thể nằm khác nhóm, còn hai kiểu khác hẳn về
 * bộ lọc lại đứng chung.
 */
export type JunctionGroup = "manh" | "vua" | "em";

export const JUNCTION_GROUPS: Array<{ id: JunctionGroup; label: string }> = [
  { id: "manh", label: "Gắt" },
  { id: "vua", label: "Vừa" },
  { id: "em", label: "Êm" },
];

export type JunctionSpec = {
  id: string;
  label: string;
  group: JunctionGroup;
  /** Một câu nói kiểu này CẢM GIÁC ra sao — không phải nó làm gì về kỹ thuật. */
  note: string;
  /**
   * Nhịp hai nửa, tính bằng giây: `[trước đỉnh, sau đỉnh]`.
   *
   * Đây là thứ tách "zoom vào" khỏi "zoom ra" — cùng một phép phóng, khác nhau
   * ở chỗ dồn chậm rồi buông nhanh, hay giật một nhát rồi trôi ra.
   */
  halves: [number, number];
  drive: JunctionDrive;
  /**
   * Tên phép chuyển cảnh của `xfade` — có giá trị nghĩa là kiểu HAI LUỒNG.
   *
   * Kiểu có `cross` được dựng lúc ghép và KHÔNG áp thêm `drive` nào: chồng một
   * cú phóng lên một cú hoà tan thì hai thứ giành nhau, và cái nhìn thấy chỉ là
   * hình vừa mờ vừa giật.
   */
  cross?: string;
};

/**
 * Thời lượng một chuyển cảnh hai luồng.
 *
 * Nửa giây: ngắn hơn thì hoà tan chưa kịp đọc ra là hoà tan, dài hơn thì ở một
 * video nói liên tục nó thành lê thê. Cũng là mức đệm phải mượn — mỗi bên
 * một phần tư giây.
 */
export const CROSS_SECONDS = 0.5;

/** Nửa dài của một cú phóng — đủ để thấy là dồn dần, chưa thành lê thê. */
const CHAM = 0.5;
/** Nửa ngắn — đủ thấy là một cú giật, chưa thành một cú lắc. */
const NHANH = 0.15;
/** Nháy sáng phải RẤT ngắn: 0,12 giây là thấy được mà chưa thành nhức mắt. */
export const FLASH_SECONDS = 0.12;
/** Chìm đen dài hơn nháy sáng một chút, không thì đọc ra như lỗi khung. */
export const DIP_SECONDS = 0.18;

/**
 * Bảng kiểu, xếp theo NHÓM CẢM GIÁC chứ không theo phép biến hình.
 *
 * Người dùng mở danh sách này để tìm "cắt cho nó gắt" hay "chuyển cho nó êm",
 * không phải để tìm một hàm ffmpeg. Nên hai kiểu cùng dùng `scale` có thể nằm
 * xa nhau, còn hai kiểu khác hẳn về kỹ thuật lại đứng cạnh nhau.
 */
export const JUNCTION_SPECS: JunctionSpec[] = [
  {
    id: "none",
    group: "vua",
    label: "Cắt thẳng",
    note: "Chuyển ngay, không đánh dấu gì",
    halves: [0, 0],
    drive: {},
  },

  // ── Phóng ────────────────────────────────────────────────────────────────
  {
    id: "zoom-in",
    group: "vua",
    label: "Zoom vào",
    note: "Dồn dần vào rồi buông nhanh — cảnh cũ ập tới rồi cắt",
    halves: [CHAM, NHANH],
    drive: { zoom: 1 },
  },
  {
    id: "zoom-out",
    group: "em",
    label: "Zoom ra",
    note: "Giật một nhát rồi trôi ra chậm — cảnh mới từ từ mở ra",
    halves: [NHANH, CHAM],
    drive: { zoom: 1 },
  },
  {
    id: "punch",
    group: "manh",
    label: "Giật nảy",
    note: "Một cú nảy rất ngắn, đối xứng — nhấn mà không kéo dài",
    halves: [0.09, 0.09],
    drive: { zoom: 1.8 },
  },
  {
    id: "zoom-blur",
    group: "manh",
    label: "Zoom nhoè",
    note: "Phóng vào kèm nhoè — cú nhấn mạnh nhất trong bộ",
    halves: [CHAM, NHANH],
    drive: { zoom: 1.3, nhoe: 6 },
  },

  // ── Sáng tối ─────────────────────────────────────────────────────────────
  {
    id: "flash",
    group: "vua",
    label: "Nháy sáng",
    note: "Sáng bừng rồi tắt — nhịp nhanh, hợp video ngắn",
    halves: [FLASH_SECONDS, FLASH_SECONDS],
    drive: { sang: 1 },
  },
  {
    id: "dip",
    group: "em",
    label: "Chìm đen",
    note: "Tối đi rồi sáng lại — ngắt ý rõ hơn nháy sáng",
    halves: [DIP_SECONDS, DIP_SECONDS],
    drive: { sang: -1 },
  },
  {
    id: "defocus",
    group: "em",
    label: "Nhoè mềm",
    // Rack-focus cao cấp: HÌNH mờ nét rồi nét lại, KHÔNG zoom — kiểu Prism Pro
    // gốc "blur video chính đưa chữ vào giữa". Envelope RỘNG (nửa giây mỗi bên)
    // để mờ được GIỮ một nhịp chứ không loé qua; chữ nổi hẳn trong lúc hình chìm.
    note: "Mờ nét mềm rồi nét lại — không zoom, chữ nổi trong lúc hình chìm",
    halves: [CHAM, CHAM],
    drive: { nhoe: 14 },
  },
  {
    id: "flash-hard",
    group: "manh",
    label: "Loé gắt",
    note: "Sáng và đanh cùng lúc — cú nhấn của nhịp nhạc mạnh",
    halves: [FLASH_SECONDS, FLASH_SECONDS],
    drive: { sang: 1.1, tuongPhan: 1 },
  },
  {
    id: "vignette",
    group: "em",
    label: "Tối viền",
    note: "Bốn góc sụp tối rồi mở ra — dồn mắt vào giữa khung",
    halves: [0.22, 0.22],
    drive: { vien: 1 },
  },

  // ── Quét, rung, nghiêng ──────────────────────────────────────────────────
  {
    id: "whip-left",
    group: "manh",
    label: "Quét trái",
    note: "Khung lia sang trái một nhát — như máy quay hất đi",
    halves: [0.1, 0.1],
    // Phóng nhẹ để phần dịch không lôi mép đen vào khung.
    drive: { dichX: -7, zoom: 0.5 },
  },
  {
    id: "whip-right",
    group: "manh",
    label: "Quét phải",
    note: "Khung lia sang phải một nhát",
    halves: [0.1, 0.1],
    drive: { dichX: 7, zoom: 0.5 },
  },
  {
    id: "whip-up",
    group: "manh",
    label: "Hất lên",
    note: "Khung hất lên rồi về — hợp lúc đổi ý đột ngột",
    halves: [0.1, 0.1],
    drive: { dichY: -7, zoom: 0.5 },
  },
  {
    id: "shake",
    group: "vua",
    label: "Rung",
    note: "Khung rung một nhịp — nhấn mà không đổi khuôn hình",
    halves: [0.14, 0.14],
    drive: { dichX: 3.5, dichY: -2.5, zoom: 0.4 },
  },
  {
    id: "tilt",
    group: "vua",
    label: "Nghiêng",
    note: "Khung nghiêng rồi thẳng lại — chệch nhịp một chút cho có duyên",
    halves: [0.18, 0.18],
    // Xoay lộ bốn góc, nên phải phóng bù — 1,5° cần khoảng 3%.
    drive: { xoay: 1.5, zoom: 0.55 },
  },

  // ── Cả một đoạn ──────────────────────────────────────────────────────────
  //
  // Ba kiểu trên đây đều là cú NHẤN: quãng vài phần mười giây, đặt đúng vết
  // cắt. Hai kiểu dưới đây trải trên CẢ MỘT ĐOẠN — phóng dần lên rồi hạ về,
  // hoặc trôi ngang suốt câu nói.
  //
  // Không cần cơ chế mới: xung vốn là hình tam giác, nên chỉ việc cho hai nửa
  // dài ra là nó thành một cú đẩy chậm. Người dùng kéo quãng dài thêm nữa thì
  // cả hai nửa giãn theo cùng tỉ lệ.
  //
  // Phóng mạnh hơn cú nhấn (2,2 so với 1) vì đổi CHẬM thì mắt không bắt được:
  // cùng 8% mà rải trên bốn giây thì đọc ra là không có gì.
  {
    id: "push-in",
    group: "em",
    label: "Đẩy vào",
    note: "Phóng dần suốt cả đoạn rồi hạ về — dồn dần vào người nói",
    halves: [2.2, 2.2],
    drive: { zoom: 2.2 },
  },
  {
    id: "drift",
    group: "em",
    label: "Trôi ngang",
    note: "Khung trôi chậm sang ngang — làm một cảnh đứng yên đỡ tĩnh",
    halves: [2.6, 2.6],
    drive: { dichX: 5, zoom: 1.4 },
  },

  // ── Màu ──────────────────────────────────────────────────────────────────
  {
    id: "saturate",
    group: "vua",
    label: "Rực màu",
    note: "Màu bừng lên rồi về — nhấn mà không đụng tới sáng tối",
    halves: [0.2, 0.2],
    drive: { bhoa: 1 },
  },
  {
    id: "desaturate",
    group: "em",
    label: "Nhạt màu",
    note: "Xám đi một nhịp rồi có màu lại — hợp lúc hạ giọng",
    halves: [0.22, 0.22],
    drive: { bhoa: -1 },
  },
  {
    id: "hue-shift",
    group: "em",
    label: "Lệch sắc",
    note: "Màu trượt sắc một nhát — cú nhiễu nhẹ, đừng dùng nhiều",
    halves: [0.1, 0.1],
    drive: { sac: 28 },
  },

  /*
   * ══ CHUYỂN CẢNH THẬT — hai cảnh cùng hiện một lúc ══
   *
   * Khác hẳn mọi kiểu bên trên: chúng không bóp méo một khung hình, chúng cho
   * cảnh cũ và cảnh mới gặp nhau. Đây là thứ mắt đọc ra ngay là "phim", còn cả
   * mười tám kiểu kia rốt cuộc đều là một ý tưởng — nhấn vào chỗ cắt.
   *
   * `halves` vẫn khai đủ vì trang xem và bàn dựng đọc nó để vẽ quãng trên dải;
   * còn `drive` để rỗng vì phép biến hình nằm ở `xfade`, không ở bộ lọc rời.
   *
   * Chỉ dùng được ở chỗ nối có quãng bỏ đủ dài để mượn đệm. Chỗ nào không đủ,
   * `pipeline.ts` tự đổi sang kiểu một luồng cùng nhóm cảm giác.
   */

  // ── Gắt: cắt phá, hợp nhịp nhanh ──────────────────────────────────────────
  {
    id: "cross-pixel",
    group: "manh",
    label: "Vỡ hạt",
    note: "Hình rã thành ô vuông rồi kết lại — cú phá mạnh nhất, dùng dè",
    halves: [0.25, 0.25],
    drive: {},
    cross: "pixelize",
  },
  {
    id: "cross-slice",
    group: "manh",
    label: "Xé sọc",
    note: "Hình xé thành dải rồi trượt sang cảnh mới — gắt kiểu kỹ thuật số",
    halves: [0.25, 0.25],
    drive: {},
    cross: "vuslice",
  },
  {
    id: "cross-wind",
    group: "manh",
    label: "Thổi bay",
    note: "Cảnh cũ bị thổi tan sang ngang — mạnh mà vẫn có hướng",
    halves: [0.25, 0.25],
    drive: {},
    cross: "hrwind",
  },

  // ── Vừa: chuyển ý, đổi cảnh ───────────────────────────────────────────────
  {
    id: "cross-slide-left",
    group: "vua",
    label: "Trượt trái",
    note: "Cảnh mới đẩy cảnh cũ sang trái — như lật sang trang sau",
    halves: [0.25, 0.25],
    drive: {},
    cross: "slideleft",
  },
  {
    id: "cross-slide-right",
    group: "vua",
    label: "Trượt phải",
    note: "Cảnh mới đẩy cảnh cũ sang phải — dùng khi quay lại ý trước",
    halves: [0.25, 0.25],
    drive: {},
    cross: "slideright",
  },
  {
    id: "cross-wipe",
    group: "vua",
    label: "Lau ngang",
    note: "Một mép chạy ngang qua khung, để lại cảnh mới",
    halves: [0.25, 0.25],
    drive: {},
    cross: "wipeleft",
  },
  {
    id: "cross-radial",
    group: "vua",
    label: "Quét kim",
    note: "Quét vòng quanh tâm như kim đồng hồ — hợp lúc sang mốc thời gian khác",
    halves: [0.25, 0.25],
    drive: {},
    cross: "radial",
  },
  {
    id: "cross-blur",
    group: "vua",
    label: "Nhoè sang",
    note: "Hai cảnh nhoè ngang rồi rõ lại — như máy quay lia quá nhanh",
    halves: [0.25, 0.25],
    drive: {},
    cross: "hblur",
  },

  // ── Êm: chuyển đoạn, hạ nhịp ──────────────────────────────────────────────
  {
    id: "cross-fade",
    group: "em",
    label: "Hoà tan",
    note: "Cảnh cũ mờ dần thành cảnh mới — cách chuyển êm nhất, dùng được ở đâu cũng hợp",
    halves: [0.25, 0.25],
    drive: {},
    cross: "fade",
  },
  {
    id: "cross-black",
    group: "em",
    label: "Qua đen",
    note: "Chìm hẳn vào đen rồi mở ra — dấu chấm hết một chương",
    halves: [0.25, 0.25],
    drive: {},
    cross: "fadeblack",
  },
  {
    id: "cross-gray",
    group: "em",
    label: "Qua xám",
    note: "Bạc màu rồi có màu lại — hợp lúc lùi về kể chuyện cũ",
    halves: [0.25, 0.25],
    drive: {},
    cross: "fadegrays",
  },
  {
    id: "cross-circle",
    group: "em",
    label: "Mở vòng",
    note: "Cảnh mới nở ra từ giữa khung — êm mà vẫn có chuyện xảy ra",
    halves: [0.25, 0.25],
    drive: {},
    cross: "circleopen",
  },
  {
    id: "cross-smooth",
    group: "em",
    label: "Lau mềm",
    note: "Mép lau nhoè chứ không sắc — nhẹ hơn lau ngang một bậc",
    halves: [0.25, 0.25],
    drive: {},
    cross: "smoothleft",
  },
];

export type JunctionId = (typeof JUNCTION_SPECS)[number]["id"];

const BY_ID = new Map(JUNCTION_SPECS.map((spec) => [spec.id, spec]));

export function findJunction(id: string | null | undefined): JunctionSpec {
  return BY_ID.get(id ?? "none") ?? JUNCTION_SPECS[0];
}

/**
 * Đọc giá trị cũ trong CSDL.
 *
 * `in`/`out`/`1` là tên của bản đầu tiên, còn nằm trong dự án của người dùng.
 */
export function normalizeJunction(
  value: string | number | null | undefined,
): JunctionId {
  if (value === "in" || value === 1 || value === "1") return "zoom-in";
  if (value === "out") return "zoom-out";
  const id = typeof value === "string" ? value : "";
  return BY_ID.has(id) ? id : "none";
}

/**
 * Cross (hai luồng) → kiểu MỘT LUỒNG gần nghĩa nhất, để THẤY được ở preview.
 *
 * Preview chưa dựng được chuyển-cảnh-thật, nên các kiểu `cross` chỉ hiện lúc XUẤT
 * — người dùng chọn mà preview trống. Bảng này quy mỗi cross về một kiểu có
 * `drive` CÙNG CẢM GIÁC (nhóm/hướng/tông): "Qua đen"→"Chìm đen", "Qua xám"→"Nhạt
 * màu", "Trượt trái"→"Quét trái"… Dùng khi DỌN dữ liệu cũ đã lỡ gắn cross (picker
 * nay đã ẩn cross nên không phát sinh mới). Kiểu không-cross trả về chính nó.
 */
export const CROSS_TO_VISIBLE: Record<string, JunctionId> = {
  "cross-pixel": "zoom-blur",
  "cross-slice": "whip-left",
  "cross-wind": "whip-left",
  "cross-slide-left": "whip-left",
  "cross-slide-right": "whip-right",
  "cross-wipe": "whip-left",
  "cross-radial": "tilt",
  "cross-blur": "defocus",
  "cross-fade": "defocus",
  "cross-black": "dip",
  "cross-gray": "desaturate",
  "cross-circle": "zoom-out",
  "cross-smooth": "defocus",
};

/** Chỗ nối CHUYỂN ĐỘNG phải đủ dài để THẤY — dưới mức này thì nới lên. */
const MIN_MOTION_SECONDS = 2.5;
/** Trục CHUYỂN ĐỘNG/NHOÈ (nới được). Sáng/màu/tương-phản là xung ngắn, chừa. */
const MOTION_KEYS = ["zoom", "dichX", "dichY", "xoay", "nhoe", "vien"] as const;

export function junctionHalves(kind: string): [number, number] {
  const spec = findJunction(kind);
  const raw: [number, number] =
    spec.halves[0] + spec.halves[1] > 0 ? spec.halves : [CHAM, NHANH];
  // Nháy sáng / chìm đen / rực màu... là XUNG NGẮN — kéo 2s thành nhức mắt hoặc
  // đổi màu cả cảnh, nên GIỮ NGUYÊN. Chỉ chỗ nối có chuyển động/nhoè mới nới cho
  // đủ thấy (0,18s "giật nảy" trước đây chớp một cái là hết, không ai kịp thấy).
  const drive = spec.drive as Record<string, number>;
  const hasMotion = MOTION_KEYS.some((k) => (drive[k] ?? 0) !== 0);
  const sum = raw[0] + raw[1];
  if (!hasMotion || sum >= MIN_MOTION_SECONDS) return raw;
  const k = MIN_MOTION_SECONDS / sum; // nới ĐỀU, giữ dáng nửa dài/nửa ngắn
  return [raw[0] * k, raw[1] * k];
}
