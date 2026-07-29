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

export const mediaDir = (id: string) => join(projectDir(id), "media");
export const thumbDir = (id: string) => join(projectDir(id), "thumbs");
export const workDir = (id: string) => join(projectDir(id), "work");
export const outDir = (id: string) => join(projectDir(id), "out");

/**
 * Font in chữ lên video: bản NGHIÊNG là mặc định, không phải lựa chọn.
 *
 * `drawtext` không nghiêng được chữ — nó chỉ vẽ đúng những gì có trong tệp font.
 * Nên "nghiêng" phải là một tệp font khác, chứ không phải một tham số. Trước đây
 * chỗ này để bản đứng và mã dựng có một cờ `italic` không làm gì cả: trang xem thì
 * nghiêng mà video in ra đứng thẳng 100%.
 *
 * Arial Bold Italic của macOS phủ đủ dấu tiếng Việt và dựng đúng cả dấu chồng
 * tầng (`ĩ`, `ổ`, `Ữ`, `ệ`, `Ắ` — đã kiểm bằng ảnh thật). Be Vietnam Pro chỉ có
 * bản woff2 nên ffmpeg không đọc được.
 */
export const OVERLAY_FONT =
  process.env.TEDDIT_FONT ??
  "/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf";

/** Bản đứng — chỉ dùng khi có lý do rõ ràng, không dùng cho chữ overlay. */
export const OVERLAY_FONT_UPRIGHT =
  process.env.TEDDIT_FONT_UPRIGHT ??
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf";
