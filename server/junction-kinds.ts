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
 * ══ HAI RÀNG BUỘC KHÔNG NÉ ĐƯỢC ══
 *
 * 1. **Không kiểu nào được ăn thời gian.** Cả hệ đứng trên phép "mốc ra = tổng
 *    độ dài các khoảng còn giữ": mốc từng chữ, từng tư liệu, cả năm chục cụm
 *    phụ đề. Mờ chồng (`xfade`) làm hai đoạn gối nhau nên tổng ngắn đi — bảy
 *    chỗ nối là lệch gần ba giây ở cuối, tức phụ đề rơi sang câu khác.
 *
 * 2. **Hiệu ứng chạy trên MỘT luồng đã ghép.** Nên không làm được thứ cần hai
 *    đoạn cùng hiện: hoà tan, trượt chồng, lật trang. Mọi kiểu ở đây đều là
 *    phép biến hình trên một khung hình duy nhất.
 *
 * Trong hai ràng buộc ấy vẫn còn rất nhiều chỗ: phóng, dịch, xoay, sáng, màu,
 * nhoè, tối viền — và nhịp hai nửa dài ngắn khác nhau.
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
};

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

export function junctionHalves(kind: string): [number, number] {
  const spec = findJunction(kind);
  return spec.halves[0] + spec.halves[1] > 0 ? spec.halves : [CHAM, NHANH];
}
