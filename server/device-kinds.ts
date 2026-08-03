import type { StylePack } from "./style-pack";

/**
 * VỐN TỪ THIẾT BỊ — đồ nghề mà một phong cách SỞ HỮU.
 *
 * Cùng lối `junction-kinds.ts`: bảng ĐÓNG, bộ dựng biết vẽ đúng ngần này thứ,
 * bộ dáng chỉ chọn dùng cái nào.
 *
 * ══ VÌ SAO ══
 *
 * Mười bộ dáng cũ dùng CHUNG đúng một bộ đồ nghề: dải phụ đề + màu + font. Nên
 * đổi bộ dáng thì người xem chỉ đọc ra "chữ đổi màu" — vì đúng là chỉ có thế.
 *
 * Soi 46 phong cách tham khảo thì luật của họ ngược lại: **mỗi phong cách sở
 * hữu vài thiết bị mà phong cách khác KHÔNG có**.
 *
 * · Chalk: chữ chạy sau người · viền phấn quanh người · thẻ chữ rải nghiêng
 * · Y2K: cửa sổ máy tính có thanh tiêu đề · ảnh nhân bản xếp chồng · con trỏ
 * · Focus: dải màu đặc · chữ đảo màu · khung chia đôi
 * · Lens: khung ngắm · chữ dọc ở mép · thông số phơi sáng giả
 *
 * Không bộ nào là bộ kia đổi màu. Đó là điều bảng này bắt phải đúng.
 *
 * ══ CHỖ ══
 *
 * Mỗi thiết bị chiếm một CHỖ. Hai thiết bị cùng chỗ không chạy cùng lúc được —
 * video không thể vừa phủ kín khung vừa nằm trong một ô bo góc. Nhờ khai chỗ mà
 * phép kiểm bắt được xung đột trước khi ai đó dựng ra một khung hình chồng lấn.
 */

/** Chỗ mà một thiết bị chiếm. Hai thiết bị cùng chỗ loại trừ nhau. */
export type Slot =
  /** Nền của cả trang — màu, hoặc chính khung hình video. */
  | "nen"
  /** Video xuất hiện thế nào: phủ kín, trong một hình, hay vắng mặt. */
  | "hinh"
  /** Phụ đề đứng ở đâu và mang dáng gì. */
  | "chu"
  /** Dấu nhấn trên chữ — nền khối, tô sáng, đổi font. */
  | "nhan"
  /** Hình trang trí rời, không bám chữ cũng không bám video. */
  | "trang-tri"
  /** Thứ chỉ tồn tại ở vết cắt. */
  | "noi";

/** Thứ một thiết bị CẦN mới dựng được. */
export type Needs =
  /** Không cần gì — dựng được ở mọi dự án. */
  | "khong"
  /** Cần mặt nạ người (`work/subject.mp4`, chặng `segment.py`). */
  | "mat-na-nguoi"
  /** Cần dự án có tư liệu chèn. */
  | "tu-lieu";

export type DeviceId =
  // ── nen ────────────────────────────────────────────────────────────────
  | "nen-video"
  | "nen-mau"
  // ── hinh ───────────────────────────────────────────────────────────────
  | "hinh-phu-kin"
  | "hinh-o-bo-goc"
  | "hinh-o-oval"
  | "hinh-o-vom"
  | "hinh-thu-vao"
  | "hinh-anh-dan"
  | "hinh-nguoi-cat"
  // ── chu ────────────────────────────────────────────────────────────────
  | "chu-dai"
  | "chu-the-rai"
  | "chu-khoi-lon"
  | "chu-sau-nguoi"
  | "chu-doc-mep"
  // ── nhan ───────────────────────────────────────────────────────────────
  | "nhan-doi-font"
  | "nhan-nen-khoi"
  | "nhan-to-sang"
  | "nhan-hinh-bam"
  // ── trang-tri ──────────────────────────────────────────────────────────
  | "tri-khung-mong"
  | "tri-khung-day"
  | "tri-dau-goc"
  | "tri-luoi-ba"
  | "tri-mang-mau"
  | "tri-net-tay"
  | "tri-vien-nguoi"
  // ── noi ────────────────────────────────────────────────────────────────
  | "noi-vet-quet"
  | "noi-may-quay";

export type DeviceSpec = {
  id: DeviceId;
  slot: Slot;
  label: string;
  note: string;
  needs: Needs;
  /**
   * Thiết bị này có phải thứ ai cũng dùng được không.
   *
   * `true` là NỀN CHUNG — mọi bộ dáng đều có quyền, và nó KHÔNG tính vào luật
   * "mỗi bộ phải sở hữu riêng ít nhất hai thiết bị". Không tách ra thì luật ấy
   * đếm cả `chu-dai` với `nen-video` và mọi bộ đều "sở hữu riêng" vài thứ mà
   * thực ra chẳng bộ nào riêng cái gì.
   */
  chung: boolean;
};

export const DEVICE_SPECS: DeviceSpec[] = [
  // ── NỀN ──────────────────────────────────────────────────────────────────
  { id: "nen-video", slot: "nen", label: "Nền là khung hình",
    note: "Chính video làm nền — không có màu nào để khai", needs: "khong", chung: true },
  { id: "nen-mau", slot: "nen", label: "Nền màu",
    note: "Trang có màu riêng, video nằm TRÊN nó", needs: "khong", chung: false },

  // ── HÌNH ─────────────────────────────────────────────────────────────────
  { id: "hinh-phu-kin", slot: "hinh", label: "Phủ kín khung",
    note: "Lối mặc định, và là lối duy nhất trước đợt này", needs: "khong", chung: true },
  { id: "hinh-o-bo-goc", slot: "hinh", label: "Ô bo góc",
    note: "Video thu vào chữ nhật bo góc đặt trên nền màu", needs: "khong", chung: false },
  { id: "hinh-o-oval", slot: "hinh", label: "Ô ê-líp",
    note: "Dáng ống kính — mềm hẳn so với mọi hình vuông vức", needs: "khong", chung: false },
  { id: "hinh-o-vom", slot: "hinh", label: "Ô vòm",
    note: "Nửa tròn trên, vuông dưới. Dáng cửa sổ", needs: "khong", chung: false },
  { id: "hinh-thu-vao", slot: "hinh", label: "Thu vào khung",
    note: "Video co lại chừa lề bốn phía, lề mang màu của trang", needs: "khong", chung: false },
  { id: "hinh-anh-dan", slot: "hinh", label: "Ảnh dán nghiêng",
    note: "Mảnh mép rách, hơi nghiêng, như dán tay lên trang", needs: "khong", chung: false },
  { id: "hinh-nguoi-cat", slot: "hinh", label: "Người cắt rời",
    note: "Chỉ người, bỏ hẳn căn phòng, dán lên nền tự dựng", needs: "mat-na-nguoi", chung: false },

  // ── CHỮ ──────────────────────────────────────────────────────────────────
  { id: "chu-dai", slot: "chu", label: "Dải phụ đề",
    note: "Khối chữ bám mép trên hoặc mép dưới", needs: "khong", chung: true },
  { id: "chu-the-rai", slot: "chu", label: "Thẻ rải",
    note: "Mỗi cụm một thẻ đặc, đặt lệch nhau quanh người nói", needs: "khong", chung: false },
  { id: "chu-khoi-lon", slot: "chu", label: "Khối chữ lớn",
    note: "Chữ chiếm nửa trang, làm bố cục chứ không làm phụ đề", needs: "khong", chung: false },
  { id: "chu-sau-nguoi", slot: "chu", label: "Chữ sau người",
    note: "Chữ nằm GIỮA nền và người — người che một phần", needs: "mat-na-nguoi", chung: false },
  { id: "chu-doc-mep", slot: "chu", label: "Chữ dọc mép",
    note: "Một dòng chạy dọc sát mép khung, lặp lại", needs: "khong", chung: false },

  // ── NHẤN ─────────────────────────────────────────────────────────────────
  { id: "nhan-doi-font", slot: "nhan", label: "Đổi vai chữ",
    note: "Từ nhấn vẽ bằng họ font thứ hai", needs: "khong", chung: true },
  { id: "nhan-nen-khoi", slot: "nhan", label: "Nền khối",
    note: "Mỗi tiếng nhấn có một khối màu sau lưng", needs: "khong", chung: true },
  { id: "nhan-to-sang", slot: "nhan", label: "Tô sáng",
    note: "Vệt màu chạy qua như bút dạ quang", needs: "khong", chung: false },
  { id: "nhan-hinh-bam", slot: "nhan", label: "Hình bám chữ",
    note: "Vòng khoanh hay gạch chân co theo bề rộng cụm", needs: "khong", chung: false },

  // ── TRANG TRÍ ────────────────────────────────────────────────────────────
  { id: "tri-khung-mong", slot: "trang-tri", label: "Viền mảnh",
    note: "Dấu 'có chủ ý' nhẹ nhất, không tranh với chữ", needs: "khong", chung: false },
  { id: "tri-khung-day", slot: "trang-tri", label: "Viền dày",
    note: "Đọc ra ngay ở ảnh thu nhỏ", needs: "khong", chung: false },
  { id: "tri-dau-goc", slot: "trang-tri", label: "Dấu góc",
    note: "Bốn dấu kiểu khung ngắm — chỉ ở góc nên không chạm chữ", needs: "khong", chung: false },
  { id: "tri-luoi-ba", slot: "trang-tri", label: "Lưới một phần ba",
    note: "Dấu bố cục của máy ảnh", needs: "khong", chung: false },
  { id: "tri-mang-mau", slot: "trang-tri", label: "Mảng màu",
    note: "Dải màu đặc bám một mép khung, chở chữ đảo màu", needs: "khong", chung: false },
  { id: "tri-net-tay", slot: "trang-tri", label: "Nét vẽ tay",
    note: "Ngoằn ngoèo, mặt cười, dấu tích, mây — rải vào chỗ trống", needs: "khong", chung: false },
  { id: "tri-vien-nguoi", slot: "trang-tri", label: "Viền quanh người",
    note: "Nét bám theo dáng người, nền giữ nguyên", needs: "mat-na-nguoi", chung: false },

  // ── NỐI ──────────────────────────────────────────────────────────────────
  { id: "noi-may-quay", slot: "noi", label: "Hiệu ứng máy quay",
    note: "Phóng, chớp, hoà tan — cách QUAY, không phải cách vẽ", needs: "khong", chung: true },
  { id: "noi-vet-quet", slot: "noi", label: "Vệt quét",
    note: "Dải màu chạy ngang khung, đậy đúng vết cắt", needs: "khong", chung: false },
];

const BY_ID = new Map(DEVICE_SPECS.map((spec) => [spec.id, spec]));

export function findDevice(id: string): DeviceSpec | null {
  return BY_ID.get(id as DeviceId) ?? null;
}

/** Thiết bị KHÔNG phải nền chung — chỉ những cái này mới tính là "của riêng". */
export const OWNABLE = DEVICE_SPECS.filter((spec) => !spec.chung).map((spec) => spec.id);

/**
 * Thiết bị dựng được với những gì dự án đang có.
 *
 * Thiếu điều kiện thì thiết bị BIẾN MẤT khỏi danh sách chứ không dựng ra một
 * khung hình hỏng — cùng lý lẽ với `availableScenes` trước đây.
 */
export function usableDevices(has: {
  subject: boolean;
  inserts: boolean;
}): DeviceSpec[] {
  return DEVICE_SPECS.filter(
    (spec) =>
      spec.needs === "khong" ||
      (spec.needs === "mat-na-nguoi" && has.subject) ||
      (spec.needs === "tu-lieu" && has.inserts),
  );
}

/** Hai thiết bị cùng CHỖ thì không chạy cùng lúc được. */
export function clashes(ids: readonly DeviceId[]): Array<[DeviceId, DeviceId]> {
  const out: Array<[DeviceId, DeviceId]> = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = BY_ID.get(ids[i]);
      const b = BY_ID.get(ids[j]);
      if (a && b && a.slot === b.slot) out.push([ids[i], ids[j]]);
    }
  }
  return out;
}

/**
 * SUY danh sách thiết bị từ chính khai báo của bộ dáng.
 *
 * Suy chứ không bắt khai tay, và đó là điều quan trọng nhất của tệp này: một ô
 * `devices` khai riêng là NGUỒN SỰ THẬT THỨ HAI — ai đó thêm `wrap` mà quên
 * thêm `nhan-hinh-bam` thì phép kiểm sở hữu đọc ra một bộ nghèo hơn thực tế, và
 * cách "sửa" dễ nhất lúc ấy là sửa cái ô khai chứ không phải sửa bộ dáng.
 *
 * Đọc thẳng từ các trục có sẵn thì không có gì để lệch.
 */
export function devicesOf(
  pack: Pick<
    StylePack,
    | "fonts"
    | "frame"
    | "plate"
    | "graphics"
    | "wrap"
    | "sweep"
    | "highlight"
    | "subjectEdge"
    | "behindText"
    | "doodles"
  >,
): DeviceId[] {
  const out: DeviceId[] = ["chu-dai", "noi-may-quay"];

  // Khung thu hình vừa dựng NỀN MÀU vừa quyết định video nằm đâu — một trục
  // trong catalog, hai thiết bị ở hai chỗ khác nhau.
  if (pack.frame) out.push("nen-mau", "hinh-thu-vao");
  else out.push("nen-video", "hinh-phu-kin");

  if (pack.plate) out.push("tri-mang-mau");
  if (pack.wrap) out.push("nhan-hinh-bam");
  if (pack.sweep) out.push("noi-vet-quet");
  if (pack.highlight) out.push("nhan-to-sang");
  if (pack.subjectEdge) out.push("tri-vien-nguoi");
  if (pack.behindText) out.push("chu-sau-nguoi");
  if (pack.doodles) out.push("tri-net-tay");
  if (pack.fonts.accent.file !== pack.fonts.voice.file) out.push("nhan-doi-font");

  const fromGraphic: Record<string, DeviceId> = {
    "khung-mong": "tri-khung-mong",
    "khung-day": "tri-khung-day",
    "dau-goc": "tri-dau-goc",
    "luoi-ba": "tri-luoi-ba",
  };
  for (const item of pack.graphics ?? []) {
    const id = fromGraphic[item.id];
    if (id) out.push(id);
  }
  return out;
}

/** Thiết bị mà CHỈ bộ này có, trong cả kho. Nền chung không tính. */
export function ownedOnlyBy(
  pack: Parameters<typeof devicesOf>[0],
  all: ReadonlyArray<Parameters<typeof devicesOf>[0]>,
): DeviceId[] {
  const mine = new Set(devicesOf(pack));
  const others = new Set(all.filter((other) => other !== pack).flatMap(devicesOf));
  return [...mine].filter(
    (id) => !others.has(id) && OWNABLE.includes(id as never),
  );
}
