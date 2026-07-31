import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { db, newId } from "./db";
import { makeThumbnail, probe } from "./media-tools";
import { DATA_ROOT, ensureProjectDirs, mediaDir, thumbDir } from "./paths";

/**
 * KHO TƯ LIỆU DÙNG CHUNG — ảnh và video chèn (b-roll) cho mọi dự án.
 *
 * Cùng khuôn với kho nhạc (`music-library.ts`): thư mục là nguồn sự thật, bảng chỉ
 * ghi thêm những gì thư mục không tự nói được. Thả tệp vào `server/data/assets/`
 * là nó có mặt ngay.
 *
 * Khác kho nhạc một điểm quan trọng: ở đây có CHỐNG TRÙNG. Tư liệu hay bị tải lại
 * nhiều lần — cùng một tấm ảnh gửi qua Zalo rồi tải lại thì tên đổi mà nội dung y
 * hệt. Trùng thì kho phình ra, và tệ hơn là chặng ghép tư liệu nhìn thấy hai bản
 * của cùng một hình rồi đặt cả hai vào hai chỗ khác nhau trong video.
 */

export const ASSETS = join(DATA_ROOT, "assets");
export const IMAGE = /\.(jpe?g|png|webp|heic|gif)$/i;
export const VIDEO = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;

export type LibraryAsset = {
  file: string;
  title: string;
  kind: "image" | "video";
  tags: string[];
  /** Mô tả cho AI đọc — cùng vai với `media_files.description` của tư liệu trong dự án */
  description: string;
  seconds: number;
  bytes: number;
  mine: boolean;
  starred: boolean;
};

/**
 * Vân tay NỘI DUNG của một tệp.
 *
 * Băm cả tệp chứ không lấy mẫu vài đoạn: tư liệu thường vài MB, băm hết mất vài
 * chục mili giây, mà lấy mẫu thì hai video khác nhau cùng phần đầu sẽ đụng nhau —
 * và đó đúng là hình dạng của mấy tệp xuất từ cùng một máy quay.
 */
export function fingerprint(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export const kindOf = (name: string): "image" | "video" | null =>
  IMAGE.test(name) ? "image" : VIDEO.test(name) ? "video" : null;

/** Tệp đã có trong kho với đúng nội dung này chưa. */
export function findDuplicate(hash: string): string | null {
  const row = db
    .prepare("SELECT file FROM library_assets WHERE hash=?")
    .get(hash) as { file: string } | undefined;
  // Hàng còn mà tệp đã bị xoá tay thì không tính là trùng — không thì người dùng
  // không bao giờ tải lại được thứ họ vừa lỡ xoá.
  if (row && existsSync(join(ASSETS, row.file))) return row.file;
  return null;
}

export function listAssets(viewerId: string): LibraryAsset[] {
  if (!existsSync(ASSETS)) return [];

  const rows = new Map(
    (
      db
        .prepare(
          "SELECT file, title, tags, description, seconds, uploaded_by FROM library_assets",
        )
        .all() as Array<{
        file: string;
        title: string | null;
        tags: string | null;
        description: string | null;
        seconds: number | null;
        uploaded_by: string | null;
      }>
    ).map((row) => [row.file, row]),
  );
  const starred = new Set(
    (
      db
        .prepare("SELECT file FROM library_asset_stars WHERE user_id=?")
        .all(viewerId) as Array<{ file: string }>
    ).map((row) => row.file),
  );

  return readdirSync(ASSETS)
    .filter((name) => kindOf(name))
    .map((file) => {
      const row = rows.get(file);
      let bytes = 0;
      try {
        bytes = statSync(join(ASSETS, file)).size;
      } catch {
        /* tệp vừa bị xoá giữa chừng — cứ để 0 */
      }
      return {
        file,
        title: row?.title || file.replace(/\.[^.]+$/, ""),
        kind: kindOf(file)!,
        tags: row?.tags
          ? row.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
        description: row?.description ?? "",
        seconds: row?.seconds ?? 0,
        bytes,
        mine: Boolean(row?.uploaded_by),
        starred: starred.has(file),
      };
    })
    .sort((a, b) =>
      a.starred === b.starred
        ? a.title.localeCompare(b.title, "vi")
        : a.starred
          ? -1
          : 1,
    );
}

export function rememberAsset(entry: {
  file: string;
  title: string;
  tags: string[];
  description: string;
  seconds: number;
  hash: string;
  uploadedBy: string;
}) {
  db.prepare(
    `INSERT INTO library_assets (file, title, tags, description, seconds, hash, uploaded_by, created_at)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(file) DO UPDATE SET title=excluded.title, tags=excluded.tags,
       description=excluded.description, seconds=excluded.seconds, hash=excluded.hash`,
  ).run(
    entry.file,
    entry.title,
    entry.tags.join(", "),
    entry.description,
    entry.seconds,
    entry.hash,
    entry.uploadedBy,
    Date.now(),
  );
}

export function updateAsset(
  file: string,
  patch: { title?: string; tags?: string[]; description?: string },
) {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.title !== undefined) {
    sets.push("title=?");
    values.push(patch.title.slice(0, 160));
  }
  if (patch.tags !== undefined) {
    sets.push("tags=?");
    values.push(patch.tags.join(", "));
  }
  if (patch.description !== undefined) {
    sets.push("description=?");
    values.push(patch.description.slice(0, 600));
  }
  if (sets.length === 0) return;
  // Tệp thả tay vào thư mục chưa có hàng nào — chèn trước rồi mới sửa, không thì
  // sửa mô tả cho nó là một lệnh không đụng vào hàng nào và im lặng trôi qua.
  db.prepare(
    "INSERT OR IGNORE INTO library_assets (file, created_at) VALUES (?,?)",
  ).run(file, Date.now());
  db.prepare(`UPDATE library_assets SET ${sets.join(", ")} WHERE file=?`).run(
    ...values,
    file,
  );
}

export function setAssetStar(viewerId: string, file: string, on: boolean) {
  if (on) {
    db.prepare(
      "INSERT OR IGNORE INTO library_asset_stars (user_id, file, created_at) VALUES (?,?,?)",
    ).run(viewerId, file, Date.now());
  } else {
    db.prepare(
      "DELETE FROM library_asset_stars WHERE user_id=? AND file=?",
    ).run(viewerId, file);
  }
}

/** Tên tệp an toàn, giữ tên gốc; trùng tên thì nối số chứ không đè. */
export function safeAssetName(name: string): string {
  const clean = name.replace(/[/\\:*?"<>|]/g, "-").trim() || "tu-lieu";
  if (!existsSync(join(ASSETS, clean))) return clean;
  const dot = clean.lastIndexOf(".");
  const base = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : "";
  for (let index = 2; index < 500; index += 1) {
    const thu = `${base} (${index})${ext}`;
    if (!existsSync(join(ASSETS, thu))) return thu;
  }
  return `${base} (${Date.now()})${ext}`;
}

/**
 * Ứng viên cho chặng tự ghép tư liệu, lấy từ KHO dùng chung.
 *
 * Chỉ tệp CÓ MÔ TẢ: máy chọn chỗ đặt bằng cách khớp mô tả với lời, nên tệp trống
 * mô tả thì nó không có gì để khớp — đưa vào chỉ tổ làm dài lời nhắc.
 *
 * Có TRẦN. Kho vài trăm tệp đổ hết vào một lời nhắc thì vừa đắt vừa chọn tệ hơn:
 * mô hình đọc hai trăm dòng mô tả na ná nhau sẽ bắt đầu khớp bừa. Ưu tiên tệp
 * người dùng đã đánh dấu, rồi tới tệp mới thêm.
 */
export function libraryCandidates(
  viewerId: string,
  scope: "starred" | "library",
  limit = 60,
): Array<{ file: string; title: string; description: string }> {
  const rows = db
    .prepare(
      `SELECT a.file, a.title, a.description,
              (SELECT 1 FROM library_asset_stars s
                WHERE s.file = a.file AND s.user_id = ?) AS sao
         FROM library_assets a
        WHERE a.description IS NOT NULL AND a.description <> ''
        ORDER BY sao DESC, a.created_at DESC`,
    )
    .all(viewerId) as Array<{
    file: string;
    title: string | null;
    description: string;
    sao: number | null;
  }>;

  return rows
    .filter((row) => (scope === "starred" ? row.sao : true))
    .filter((row) => existsSync(join(ASSETS, row.file)))
    .slice(0, limit)
    .map((row) => ({
      file: row.file,
      title: row.title || row.file,
      description: row.description,
    }));
}

/**
 * CHÉP một tư liệu từ kho vào dự án, trả về hàng `media_files` vừa tạo.
 *
 * Chép chứ không trỏ chung vào tệp trong kho: xoá dự án là xoá cả thư mục của nó,
 * mà trỏ chung thì cú xoá ấy rút mất tệp khỏi kho và mọi dự án khác đang dùng nó
 * cùng gãy.
 *
 * Mang theo cả MÔ TẢ đã viết trong kho — mô tả viết một lần thì đừng bắt máy đọc
 * lại tấm ảnh ấy ở mọi dự án.
 */
export async function copyIntoProject(projectId: string, file: string) {
  const kind = kindOf(file);
  const source = join(ASSETS, file);
  if (!kind || !existsSync(source)) return null;

  ensureProjectDirs(projectId);
  const fileId = newId("f");
  const target = join(mediaDir(projectId), `${fileId}${extname(file)}`);
  await copyFile(source, target);

  const info = await probe(target).catch(() => null);
  let thumb: string | null = join(thumbDir(projectId), `${fileId}.jpg`);
  try {
    await makeThumbnail(target, thumb, kind === "image" ? 0 : 0.5);
  } catch {
    thumb = null;
  }

  const position =
    (
      db
        .prepare(
          "SELECT COALESCE(MAX(position),-1) AS p FROM media_files WHERE project_id=? AND role='insert'",
        )
        .get(projectId) as { p: number }
    ).p + 1;

  const meta = db
    .prepare("SELECT title, description FROM library_assets WHERE file=?")
    .get(file) as
    { title: string | null; description: string | null } | undefined;

  db.prepare(
    `INSERT INTO media_files (id, project_id, name, size, role, position, duration, width, height, has_audio, stored_path, thumb_path, description, from_library, library_file)
     VALUES (?,?,?,?,'insert',?,?,?,?,?,?,?,?,1,?)`,
  ).run(
    fileId,
    projectId,
    // Tên GIỮ ĐUÔI tệp, kể cả khi lấy tiêu đề người dùng đặt: giao diện đoán
    // ảnh-hay-video bằng đuôi của `name`, nên "Gõ bàn phím cận cảnh" trần trụi
    // sẽ bị vẽ như một tấm ảnh — khung xem trước dựng thẻ `<img>` cho một tệp
    // video và ra ô hỏng.
    meta?.title ? `${meta.title}${extname(file)}` : file,
    statSync(target).size,
    position,
    kind === "video" ? (info?.duration ?? 0) : 0,
    info?.width ?? null,
    info?.height ?? null,
    info?.hasAudio ? 1 : 0,
    target,
    thumb,
    meta?.description || null,
    file,
  );

  return db.prepare("SELECT * FROM media_files WHERE id=?").get(fileId) as
    Record<string, unknown> | undefined;
}
