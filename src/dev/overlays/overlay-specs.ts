/**
 * Bộ số quyết định mọi thẩm mỹ khi dựng — chép nguyên từ repo cũ
 * (`packages/core/src/style/video-style.ts` và `text-overlay-schema.ts`).
 *
 * Chép SỐ chứ không chép code: bản cũ dựng bằng Remotion (React trong video),
 * bản này in bằng ffmpeg. Cùng bộ số thì hai bên ra cùng thẩm mỹ, mà không phải
 * mang cả một engine sang.
 */

export type SubtitleStyleSpec = {
  /** Tâm dòng phụ đề, tỉ lệ tính từ ĐỈNH khung (0..1) */
  positionFromTop: number;
  /** Cỡ chữ theo bề rộng khung: fontSize = frameWidth × fontScale */
  fontScale: number;
  fontWeight: number;
  textColor: string;
  /** Nền mờ sau chữ để đọc rõ trên mọi cảnh */
  scrimColor: string;
  /** Màu nhấn từ khoá — đúng MỘT màu */
  accentColor: string;
  fadeSeconds: number;
};

export type VideoStyle = {
  id: string;
  name: string;
  note: string;
  subtitle: SubtitleStyleSpec;
  zoom: { scale: number; durationMs: number };
  musicLevel: number;
};

export const MINIMALISM: VideoStyle = {
  id: "minimalism",
  name: "Minimalism",
  note:
    "Phụ đề ở 78% chiều cao — bảy phần mười vẫn rơi vào khoảng ngực người nói. " +
    "Zoom 1.08: 1.03 dưới ngưỡng thấy được trên điện thoại, 1.08 cảm nhận được mà chưa thành cú giật.",
  subtitle: {
    positionFromTop: 0.78,
    fontScale: 0.05,
    fontWeight: 700,
    textColor: "#ffffff",
    scrimColor: "rgba(0, 0, 0, 0.75)",
    accentColor: "#ffd700",
    fadeSeconds: 0.3,
  },
  zoom: { scale: 1.08, durationMs: 300 },
  musicLevel: 0.18,
};

/**
 * Bốn vai trò dòng — TRẦN cỡ, không phải cỡ cố định.
 *
 * Số thật do phép đo suy ra từ độ dài chuỗi và bề rộng còn lại; đây chỉ nói dòng
 * này được phép to đến đâu. Chép từ `text-overlay-roles.ts` của bản cũ.
 *
 * Vì sao mọi vai đều TO: trần đã nâng ba lần. Bản đầu lấy tỉ lệ đo trong bản mẫu
 * tiếng Anh, và lần nào trên khung thật cũng ra nhỏ hơn hẳn cảm giác khi nhìn bản
 * mẫu — vì cùng một ý thì tiếng Việt dài hơn, mà chữ tự co theo độ dài.
 *
 * KHÔNG có cờ `italic` cho từng vai: `drawtext` của ffmpeg không nghiêng được chữ,
 * nghiêng nằm trong chính tệp font, nên mọi vai đều nghiêng — có cờ chỉ để nó nói
 * dối.
 *
 * `lineHeight` KHÔNG được dưới 1: tiếng Việt có dấu chồng dấu (`Ắ`, `Ữ`, `ệ`),
 * dưới 1 là dấu vượt ra ngoài hộp dòng và bị cắt cụt. Lỗi này không có ở tiếng
 * Anh nên rất dễ lọt nếu chỉ thử bằng chữ mẫu tiếng Anh.
 */
export const LINE_ROLES = [
  {
    id: "hero",
    label: "hero",
    scale: 0.3,
    weight: 800,
    note: "Từ khoá — to đến mức tràn mép",
  },
  {
    id: "major",
    label: "major",
    scale: 0.19,
    weight: 800,
    note: "Ý chính",
  },
  {
    id: "minor",
    label: "minor",
    scale: 0.135,
    weight: 800,
    note: "Ý phụ, bổ nghĩa",
  },
  {
    id: "label",
    label: "label",
    scale: 0.085,
    weight: 800,
    upper: true,
    note: "Nhãn — chữ hoa, giãn ký tự",
  },
] as const;

/**
 * Màu của hệ Oversize — chỉ ba mức trắng, không có màu nào khác.
 *
 * Ánh kim đã BỎ: phép xén dải theo hình chữ ăn mất phần trên của dấu chồng tầng
 * ở bản nghiêng khổ lớn ("nghĩ" → "nghî"). Chữ trắng phẳng đọc luôn đúng.
 */
export const OVERSIZE_COLORS = {
  /** Từ nối, chữ đứng — trắng phẳng, cố ý để nó lùi lại */
  plain: "#ffffff",
  /** Dòng chính — trắng HƠI ĐỤC: trắng tinh ở khổ lớn đọc ra như mảng đèn dán lên cảnh */
  plainSoft: "rgba(255, 255, 255, 0.9)",
  /** Phần chưa tới lượt — xám bạc, đọc được nhưng không tranh nhìn */
  dim: "rgba(214, 219, 224, 0.72)",
} as const;

/**
 * Cách xếp các DÒNG của một cụm — cùng phép bẻ dòng, chỉ khác toạ độ ngang.
 *
 * Cùng một họ với bố cục theo TIẾNG (`creative-layouts.tsx`): với người dùng đều
 * là một câu hỏi "cụm này xếp thế nào", nên bày chung một chỗ. Bày thành hai mục
 * riêng thì đọc ra như hai hệ khác nhau, mà `center` với `so-le` chỉ khác nhau ở
 * chỗ đơn vị được xếp là dòng hay là tiếng.
 *
 * Bậc thang bị chặn tổng thụt 11% để không đẩy chữ ra ngoài.
 */
export const LAYOUTS = [
  { id: "center", label: "center", note: "Mọi dòng căn giữa — mặc định" },
  { id: "flush", label: "flush", note: "Mọi dòng thẳng lề trái" },
  { id: "right", label: "right", note: "Mọi dòng thẳng lề phải" },
  { id: "stair-right", label: "stair-right", note: "Bậc thang sang phải" },
  { id: "stair-left", label: "stair-left", note: "Bậc thang sang trái" },
  { id: "split", label: "split", note: "Dòng lẻ thụt, dòng chẵn thẳng" },
] as const;

/**
 * Ba chỗ đặt khối chữ — ĐÚNG ba chỗ máy chủ dựng được (`BAND_ANCHOR` bên
 * `server/text-layout.ts`).
 *
 * Trước đây chỗ này liệt bảy chỗ neo (`top-left`, `mid-right`…) mà máy chủ không
 * có cái nào: trang xem hứa bảy vị trí, bản in ra chỉ làm được bốn dải. Căn ngang
 * không thuộc vào đây — nó là việc của bố cục (`center`/`flush`/`right`).
 */
export const BANDS = [
  { id: "top", edge: "top", at: 0.12, note: "Sát trên, chừa mép cho tay che" },
  { id: "upper", edge: "top", at: 0.3, note: "Trên mặt người nói" },
  { id: "lower", edge: "bottom", at: 0.68, note: "Dưới mặt, mọc lên" },
  { id: "bottom", edge: "bottom", at: 0.8, note: "Sát đáy dải an toàn" },
] as const;

/** Hình dáng khung tư liệu chèn. */
export const INSERT_SHAPES = [
  { id: "square", label: "square", ratio: "1 / 1", note: "Ảnh chụp, sản phẩm" },
  {
    id: "portrait",
    label: "portrait",
    ratio: "3 / 4",
    note: "Ảnh dọc, chân dung",
  },
  { id: "wide", label: "wide", ratio: "16 / 9", note: "Ảnh chụp màn hình" },
  { id: "full", label: "full", ratio: "9 / 16", note: "Đè kín khung" },
] as const;

/** Cách tư liệu hiện ra. Bản mới chưa dựng cái nào — đây là bảng để đối chiếu. */
export const REVEALS = [
  { id: "zoom", note: "Phóng nhẹ từ 1.04 về 1.00" },
  { id: "wipe", note: "Quét từ một mép" },
  { id: "slide", note: "Trượt vào từ ngoài khung" },
  { id: "blur", note: "Từ mờ sang nét" },
  { id: "iris", note: "Mở từ tâm ra" },
  { id: "ken", note: "Ken Burns — trôi chậm suốt thời lượng" },
] as const;

export const SAMPLE_TEXT = {
  hero: "30 tuổi",
  major: "Mình nghĩ 30 tuổi",
  minor: "Nhưng giờ nhìn lại",
  label: "Tập 4",
};

/** Cụm để thử luật "nghiêng đậm cho từ khoá, đứng cho từ nối". */
export const MIXED_WEIGHT = [
  { text: "Mình", keyword: false },
  { text: "nghĩ", keyword: true },
  { text: "30 tuổi", keyword: true },
  { text: "là", keyword: false },
  { text: "lớn lắm", keyword: true },
] as const;
