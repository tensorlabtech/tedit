import { db } from "./db";

/** Người đang gọi. Chỉ cần mã để so chủ sở hữu; email để ghi nhật ký và báo lỗi. */
export type Viewer = { id: string; email: string };

/**
 * Lỗi có kèm mã HTTP. Fastify đọc `statusCode` nên chỉ cần ném là ra đúng mã,
 * không phải chuyền `reply` xuống từng hàm kiểm.
 */
export class AccessError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** Bảng tra: từ mã của một hàng bất kỳ về chủ của dự án chứa nó. */
const OWNER_OF = {
  project: "SELECT owner_id AS owner FROM projects WHERE id = ?",
  file: "SELECT p.owner_id AS owner FROM media_files x JOIN projects p ON p.id = x.project_id WHERE x.id = ?",
  music:
    "SELECT p.owner_id AS owner FROM music_tracks x JOIN projects p ON p.id = x.project_id WHERE x.id = ?",
  sentence:
    "SELECT p.owner_id AS owner FROM sentences x JOIN projects p ON p.id = x.project_id WHERE x.id = ?",
  word: "SELECT p.owner_id AS owner FROM words x JOIN projects p ON p.id = x.project_id WHERE x.id = ?",
  element:
    "SELECT p.owner_id AS owner FROM elements x JOIN projects p ON p.id = x.project_id WHERE x.id = ?",
  segment:
    "SELECT p.owner_id AS owner FROM segments x JOIN projects p ON p.id = x.project_id WHERE x.id = ?",
} as const;

export type OwnedKind = keyof typeof OWNER_OF;

/**
 * Hàng này có thuộc người đang gọi không. Không thì ném 404.
 *
 * TRẢ 404 CHỨ KHÔNG 403, kể cả khi hàng có thật mà của người khác. 403 là câu trả
 * lời "có hàng này nhưng anh không được xem" — đủ để người ngoài dò xem mã nào tồn
 * tại. 404 thì hai trường hợp "không có" và "không phải của anh" nhìn từ ngoài
 * giống nhau hoàn toàn.
 *
 * Dự án chưa có chủ (`owner_id` NULL) cũng rơi vào đây: NULL không bằng mã của ai
 * cả, nên dữ liệu cũ vô hình với mọi người thay vì thuộc về người đầu tiên gõ
 * đúng đường dẫn.
 */
export function assertOwnerIs(
  viewer: Viewer,
  kind: OwnedKind,
  id: string,
): void {
  const row = db.prepare(OWNER_OF[kind]).get(id) as
    { owner: string | null } | undefined;
  if (!row || row.owner !== viewer.id) {
    throw new AccessError(404, "Không tìm thấy");
  }
}

/**
 * Mã trên ĐƯỜNG DẪN có thuộc người đang gọi không.
 *
 * Kiểm ở một chỗ chứ không rắc phép kiểm vào từng route: ba mươi tám route là ba
 * mươi tám lần có thể quên, và quên ở đây không gây lỗi nào nhìn thấy được — cửa
 * cứ mở, cho tới hôm có người đi qua. Đặt ở cổng thì route thêm về sau mặc định
 * đã bị khoá, và muốn đọc lại xem ai được xem gì thì chỉ phải đọc một bảng.
 *
 * Đoạn thứ hai của mọi đường dẫn dạng này đều là một mã. Đường dẫn không có mã —
 * `/api/projects` lúc tạo và lúc liệt kê, `/api/layout` — không khớp mẫu nào nên
 * đi qua; chúng tự lọc theo người gọi.
 */
const URL_OWNER_RULES: Array<[RegExp, OwnedKind]> = [
  [/^\/api\/projects\/([^/]+)/, "project"],
  [/^\/api\/files\/([^/]+)/, "file"],
  [/^\/api\/music\/([^/]+)/, "music"],
  [/^\/api\/words\/([^/]+)/, "word"],
  [/^\/api\/sentences\/([^/]+)/, "sentence"],
  [/^\/api\/segments\/([^/]+)/, "segment"],
  [/^\/api\/elements\/([^/]+)/, "element"],
];

export function assertOwnsUrlTarget(viewer: Viewer, path: string): void {
  for (const [pattern, kind] of URL_OWNER_RULES) {
    const match = pattern.exec(path);
    if (!match) continue;
    assertOwnerIs(viewer, kind, decodeURIComponent(match[1]));
    return;
  }
}

/** Bảng chứa `project_id` của những hàng bị NHẮC TỚI trong thân request. */
const PROJECT_OF = {
  file: "SELECT project_id FROM media_files WHERE id = ?",
  word: "SELECT project_id FROM words WHERE id = ?",
  sentence: "SELECT project_id FROM sentences WHERE id = ?",
} as const;

/**
 * Hàng được NHẮC TỚI trong thân request có thuộc đúng dự án đang sửa không.
 *
 * Cổng chặn chỉ đọc được mã trên đường dẫn, mà vài route còn nhận mã trong thân:
 * `mediaFileId` lúc thêm tư liệu chèn, `fromWordId`/`toWordId` lúc neo chữ,
 * `sentenceId` lúc gieo chữ. Thiếu phép kiểm này thì đính được tệp của người khác
 * vào dự án của mình, và tới lúc xuất video thì nội dung đó bị in thẳng vào bản
 * thành phẩm — dữ liệu ra khỏi tay chủ nó mà không route nào báo lỗi.
 *
 * So theo DỰ ÁN chứ không theo người: cùng một người vẫn không được lấy tệp của
 * dự án A đính sang dự án B. Đó không còn là chuyện phân quyền mà là chuyện dữ
 * liệu phải nhất quán — mọi thứ trong một dự án phải cùng một trục thời gian.
 */
export function assertInProject(
  projectId: string,
  kind: keyof typeof PROJECT_OF,
  id: string | null | undefined,
): void {
  if (!id) return;
  const row = db.prepare(PROJECT_OF[kind]).get(id) as
    { project_id: string } | undefined;
  if (!row || row.project_id !== projectId) {
    throw new AccessError(404, "Không tìm thấy");
  }
}

/**
 * Khoá `/files/` — nơi phơi thẳng ổ đĩa ra ngoài.
 *
 * `fastifyStatic` cắm vào `DATA_ROOT` nên mọi tệp dưới đó tải được bằng một dòng
 * URL: bản ghi thô người dùng tải lên, bản dựng dở, và cả video đã xuất. Trước
 * khi có hàm này thì biết mã dự án là tải được hết, không cần đăng nhập.
 *
 * Đường dẫn hợp lệ chỉ có một dạng: `/files/projects/<mã dự án>/...`. Mọi dạng
 * khác — kể cả đường dẫn có `..` hay trỏ ra ngoài thư mục dự án — đều chối. Chối
 * trước rồi mới cho qua, để thư mục lạ nào mọc thêm dưới `DATA_ROOT` về sau cũng
 * không tự nhiên thành công khai.
 */
export function assertOwnsFilePath(viewer: Viewer, path: string): void {
  if (path.includes("..")) throw new AccessError(404, "Không tìm thấy");

  // KHO NHẠC và KHO TƯ LIỆU dùng chung: mọi người đã qua cổng đều xem/nghe thử
  // được, vì đó chính là ý nghĩa của một cái kho chung. Không ai "sở hữu" thứ trong
  // đó để mà kiểm.
  //
  // Vẫn phải có phiên hợp lệ — `authGuard` đã chặn trước khi tới đây — nên đây là
  // "ai đăng nhập cũng nghe được", không phải "ai cũng tải được". Và chỉ đúng một
  // thư mục này, chứ không nới cho mọi thứ ngoài `projects/`.
  if (/^\/files\/(music|assets)\/[^/]+$/.test(path)) return;

  const match = /^\/files\/projects\/([^/]+)\//.exec(path);
  if (!match) throw new AccessError(404, "Không tìm thấy");

  assertOwnerIs(viewer, "project", decodeURIComponent(match[1]));
}
