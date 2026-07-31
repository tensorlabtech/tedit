import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { db } from "./db";
import { readMusicTags, type MusicTags } from "./music-tags";
import { DATA_ROOT } from "./paths";

/**
 * KHO NHẠC DÙNG CHUNG — danh mục để người dùng nghe thử và chọn.
 *
 * THƯ MỤC là nguồn sự thật, không phải CSDL. Thả một tệp vào `server/data/music/`
 * là nó có mặt trong kho ngay, không cần ghi hàng nào — đó là cách kho này được
 * dựng lên từ đầu và là cách nhanh nhất để nạp hàng loạt.
 *
 * Ba nguồn mô tả chồng lên nhau, cái sau đè cái trước:
 * 1. Tên tệp — luôn có.
 * 2. `kho.json` nằm cạnh các tệp — đi kèm mấy bài tải sẵn.
 * 3. Bảng `library_tracks` — bài người dùng tự tải lên, hoặc sửa lại mô tả.
 *
 * Xếp thế này thì cả hai lối nạp đều sống: đổ hàng loạt bằng thư mục + `kho.json`,
 * hoặc tải từng bài qua giao diện.
 */

export const LIBRARY = join(DATA_ROOT, "music");
export const AUDIO = /\.(mp3|m4a|aac|wav|ogg|flac)$/i;

export type LibraryTrack = {
  file: string;
  title: string;
  tags: string[];
  /** Ba trục nhãn có kiểm soát; trường nào rỗng là chưa gán. */
  labels: MusicTags;
  seconds: number;
  /** Người dùng tự tải lên, chứ không phải bài đi kèm sẵn */
  mine: boolean;
  starred: boolean;
};

type Sidecar = {
  tracks?: Array<{
    file?: string;
    title?: string;
    tags?: string[];
    seconds?: number;
  }>;
};

/** Mô tả đi kèm mấy bài tải sẵn. Thiếu hay hỏng thì coi như không có. */
function readSidecar(): Map<
  string,
  { title: string; tags: string[]; seconds: number }
> {
  const path = join(LIBRARY, "kho.json");
  if (!existsSync(path)) return new Map();
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Sidecar;
    return new Map(
      (raw.tracks ?? [])
        .filter((track) => track.file)
        .map((track) => [
          track.file!,
          {
            title: track.title ?? track.file!,
            tags: track.tags ?? [],
            seconds: track.seconds ?? 0,
          },
        ]),
    );
  } catch {
    return new Map();
  }
}

/** Bỏ đuôi tệp — dùng làm tên hiện ra khi không có mô tả nào khác. */
const stripExtension = (name: string) => name.replace(/\.[^.]+$/, "");

export function listLibrary(viewerId: string): LibraryTrack[] {
  if (!existsSync(LIBRARY)) return [];

  const sidecar = readSidecar();
  const rows = new Map(
    (
      db
        .prepare(
          "SELECT file, title, tags, seconds, uploaded_by, energy, density, vocal FROM library_tracks",
        )
        .all() as Array<{
        file: string;
        title: string | null;
        tags: string | null;
        seconds: number | null;
        uploaded_by: string | null;
        energy: string | null;
        density: string | null;
        vocal: string | null;
      }>
    ).map((row) => [row.file, row]),
  );
  const starred = new Set(
    (
      db
        .prepare("SELECT file FROM library_stars WHERE user_id=?")
        .all(viewerId) as Array<{ file: string }>
    ).map((row) => row.file),
  );

  return (
    readdirSync(LIBRARY)
      .filter((name) => AUDIO.test(name))
      .map((file) => {
        const extra = sidecar.get(file);
        const row = rows.get(file);
        return {
          file,
          title: row?.title || extra?.title || stripExtension(file),
          tags: row?.tags
            ? row.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
            : (extra?.tags ?? []),
          labels: readMusicTags(row ?? {}),
          seconds: row?.seconds ?? extra?.seconds ?? 0,
          mine: Boolean(row?.uploaded_by),
          starred: starred.has(file),
        };
      })
      // Bài đã đánh dấu lên đầu, còn lại theo tên. Người ta đánh dấu chính là để
      // khỏi phải tìm lại lần sau.
      .sort((a, b) =>
        a.starred === b.starred
          ? a.title.localeCompare(b.title, "vi")
          : a.starred
            ? -1
            : 1,
      )
  );
}

export function setStar(viewerId: string, file: string, on: boolean) {
  if (on) {
    db.prepare(
      "INSERT OR IGNORE INTO library_stars (user_id, file, created_at) VALUES (?,?,?)",
    ).run(viewerId, file, Date.now());
  } else {
    db.prepare("DELETE FROM library_stars WHERE user_id=? AND file=?").run(
      viewerId,
      file,
    );
  }
}

export function rememberUpload(
  file: string,
  title: string,
  tags: string[],
  seconds: number,
  uploadedBy: string,
) {
  db.prepare(
    `INSERT INTO library_tracks (file, title, tags, seconds, uploaded_by, created_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(file) DO UPDATE SET title=excluded.title, tags=excluded.tags,
       seconds=excluded.seconds`,
  ).run(file, title, tags.join(", "), seconds, uploadedBy, Date.now());
}

/**
 * Tên tệp an toàn, GIỮ tên gốc hết mức có thể.
 *
 * Tên gốc là thứ người ta nhận ra bài của mình trong danh sách, nên chỉ thay đúng
 * những ký tự không đặt được trong tên tệp. Trùng tên thì nối thêm số chứ không đè
 * — đè là bài của người khác biến mất trong im lặng.
 */
export function safeName(name: string): string {
  const clean = name.replace(/[/\\:*?"<>|]/g, "-").trim() || "nhac.mp3";
  if (!existsSync(join(LIBRARY, clean))) return clean;
  const dot = clean.lastIndexOf(".");
  const base = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : "";
  for (let index = 2; index < 500; index += 1) {
    const thu = `${base} (${index})${ext}`;
    if (!existsSync(join(LIBRARY, thu))) return thu;
  }
  return `${base} (${Date.now()})${ext}`;
}
