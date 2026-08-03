import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Gốc dữ liệu: đổi được qua biến môi trường để chạy nhiều bản song song. */
export const DATA_ROOT = resolve(
  process.env.TEDDIT_DATA_ROOT ?? join(here, "data"),
);

export const DB_PATH = join(DATA_ROOT, "teddit.db");

export function projectDir(projectId: string) {
  return join(DATA_ROOT, "projects", projectId);
}

export function ensureProjectDirs(projectId: string) {
  const base = projectDir(projectId);
  for (const sub of ["media", "thumbs", "work", "out"]) {
    mkdirSync(join(base, sub), { recursive: true });
  }
  return base;
}

/**
 * Nơi các MẢNH của một lượt tải lên nằm chờ, trước khi đủ để thành một tệp.
 *
 * Ngoài `projects/` chứ không nằm trong thư mục dự án: mảnh dở dang chưa thuộc
 * về dự án nào cả — chưa có hàng nào trong CSDL trỏ tới nó, và người dùng có thể
 * bỏ ngang. Để lẫn vào `work/` thì nó thành thứ mọi phép dọn theo dự án phải học
 * cách bỏ qua, mà quên một chỗ là xoá nhầm một lượt tải đang chạy.
 *
 * `/files/` không phơi thư mục này ra: `assertOwnsFilePath` chỉ cho qua
 * `projects/`, `music/` và `assets/`, còn lại chối thẳng.
 */
export const uploadsDir = () => join(DATA_ROOT, "uploads");

export const mediaDir = (id: string) => join(projectDir(id), "media");
export const thumbDir = (id: string) => join(projectDir(id), "thumbs");
export const workDir = (id: string) => join(projectDir(id), "work");
export const outDir = (id: string) => join(projectDir(id), "out");

/** Gốc dự án — bộ dáng khai font bằng đường dẫn tương đối so với chỗ này. */
export const PROJECT_ROOT = resolve(join(here, ".."));

/** Font đóng gói theo repo — cùng tệp trên mọi máy, không mượn của hệ điều hành. */
export const FONTS_DIR = join(PROJECT_ROOT, "assets", "fonts");

/**
 * Kho PNG đồ hoạ đã dựng. Đi theo repo y như font, vì `rsvg-convert` chỉ có
 * lúc phát triển — xem `scripts/graphics/render-svg-to-png.mjs`.
 */
export const GRAPHICS_DIR = join(PROJECT_ROOT, "assets", "graphics", "png");

export const fontFile = (name: string) => join(FONTS_DIR, name);

/**
 * Đổi đường dẫn font của một bộ dáng thành đường dẫn tuyệt đối.
 *
 * `TEDDIT_FONT` đè lên MỌI bộ dáng chứ không riêng bộ nào: nó là cửa thoát cho
 * trường hợp máy chủ cần một tệp font khác hẳn (bản Arial cũ chẳng hạn), và cửa
 * thoát mà chỉ mở cho một bộ dáng thì không phải cửa thoát.
 */
export const resolvePackFont = (relativePath: string) =>
  process.env.TEDDIT_FONT ?? join(PROJECT_ROOT, relativePath);

/*
 * Không còn hằng `OVERLAY_FONT` ở đây nữa: font là một trục của BỘ DÁNG
 * (`server/style-pack.ts` → `font.file`), không phải một hằng số toàn cục.
 *
 * `drawtext` không nghiêng được chữ — nó chỉ vẽ đúng những gì có trong tệp font.
 * Nên "nghiêng" là một tệp font khác chứ không phải một tham số; bộ dáng khai
 * `font.italic` để trang xem biết mà đặt `font-style` cho khớp.
 *
 * Trước đây mặc định trỏ vào `Arial Bold Italic` của macOS. Tệp đó KHÔNG phát
 * hành kèm phần mềm được và máy chủ Linux không có nó — nên mọi lượt xuất video
 * trên máy chủ đều lỗi. Xem `reports/font-audit.md`.
 */
