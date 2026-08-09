import { copyFile, rename, unlink } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import { db, newId } from "./db";
import { makeThumbnail, probe, type ProbeResult } from "./media-tools";
import { ensureProjectDirs, mediaDir, thumbDir } from "./paths";
import { IMAGE, VIDEO } from "./routes/media-formats";

/**
 * Nhận MỘT tệp đã nằm sẵn trên đĩa vào một dự án: đo, dựng ảnh thu nhỏ, ghi hàng.
 *
 * Tách khỏi `routes/files-routes.ts` vì giờ có HAI đường đưa tệp vào cùng một
 * chỗ: multipart một phát (công cụ ngoài, và các bản cũ của màn nạp tệp) và tus
 * cắt mảnh (màn nạp tệp hiện tại). Chép đoạn này sang đường thứ hai là có hai
 * bản luật "tệp thế nào thì bị chối" để lệch nhau — mà lệch ở đây nghĩa là cùng
 * một tệp vào được đường này, hỏng ở đường kia, và không ai biết vì sao.
 *
 * Điểm chung của cả hai đường: lúc gọi tới đây thì BYTE ĐÃ NẰM TRÊN ĐĨA. Nên
 * hàm này không biết gì về HTTP, và thử được mà không cần dựng máy chủ.
 */

export type IntakeResult =
  | { ok: true; row: Record<string, unknown>; warnings: string[] }
  | { ok: false; reason: string };

/**
 * Tệp này có được một dự án nhận không — chỉ xét TÊN, chưa mở tệp ra.
 *
 * Xuất ra để hai đường vào chối được SỚM, trước khi hứng vài trăm MB xuống đĩa
 * rồi mới nói không. Luật vẫn nằm đúng một chỗ; đây chỉ là cùng một luật hỏi
 * sớm hơn một nhịp.
 */
export const isAcceptedMedia = (name: string) =>
  VIDEO.test(name) || IMAGE.test(name);

/**
 * @param stagedPath Tệp tạm. Hàm này DỜI nó vào thư mục dự án khi nhận, và XOÁ
 * khi chối — gọi xong thì đường dẫn này không còn nữa, dù kết quả thế nào. Bên
 * gọi không phải dọn.
 * @param order Chỗ người dùng xếp. Bỏ trống thì rơi về `MAX+1` của vai tương ứng.
 */
export async function intakeMediaFile(options: {
  projectId: string;
  stagedPath: string;
  originalName: string;
  order?: number | null;
  /**
   * Vai người dùng ĐỊNH cho tệp. Chỉ chiều khi khả thi: video chính phải CÓ
   * tiếng, nên "main" mà tệp câm (hoặc là ảnh) thì rơi về "insert". Bỏ trống thì
   * để máy tự đoán theo "video có tiếng → cảnh chính".
   *
   * Có mặt vì đường thêm tư liệu Ở BÀN DỰNG luôn là chèn (b-roll), mà nếu để máy
   * tự đoán thì một clip stock có tiếng lại thành cảnh chính — lặng lẽ phá bản
   * chép lời và biến mất khỏi danh sách b-roll.
   */
  intendedRole?: "main" | "insert" | null;
  /** Cỡ thật đo được lúc nhận. Không suy từ `stat` để hai đường cùng một con số. */
  bytes: number;
}): Promise<IntakeResult> {
  const { projectId, stagedPath, order = null, intendedRole = null, bytes } =
    options;
  const name = basename(options.originalName || "khong-ten");
  const isVideo = VIDEO.test(name);
  const isImage = IMAGE.test(name);

  const drop = async (reason: string): Promise<IntakeResult> => {
    await unlink(stagedPath).catch(() => {});
    return { ok: false, reason };
  };

  if (!isVideo && !isImage) return drop("Không nhận định dạng này");

  ensureProjectDirs(projectId);
  const fileId = newId("f");
  const target = join(mediaDir(projectId), `${fileId}${extname(name)}`);

  /*
   * DỜI chứ không chép: tệp tạm và thư mục dự án cùng nằm dưới `DATA_ROOT` nên
   * `rename` chỉ là một thao tác trên bảng thư mục, không đọc lại vài trăm MB.
   *
   * Vẫn có nhánh chép phòng khi hai chỗ rơi vào hai thiết bị khác nhau — gắn
   * riêng một ổ cho thư mục tạm là chuyện người vận hành làm được mà mã không
   * hay biết, và lúc đó `rename` ném `EXDEV` chứ không tự lo liệu.
   */
  try {
    await rename(stagedPath, target);
  } catch {
    try {
      await copyFile(stagedPath, target);
      await unlink(stagedPath).catch(() => {});
    } catch {
      return drop("Không ghi được tệp vào dự án");
    }
  }

  // Khai đúng kiểu `ProbeResult`: để suy kiểu từ giá trị mặc định thì `info` chỉ
  // còn bốn trường, và `info.warnings` phía dưới luôn là `undefined` — cảnh báo
  // "tệp mất tiếng" / "nhịp khung thay đổi" không bao giờ tới người dùng.
  let info: ProbeResult = {
    duration: 0,
    width: null,
    height: null,
    hasAudio: false,
    videoCodec: null,
    audioCodec: null,
    rotation: 0,
    variableFrameRate: false,
    warnings: [],
  };
  try {
    info = await probe(target);
  } catch {
    await unlink(target).catch(() => {});
    return { ok: false, reason: "Tệp hỏng, không đọc được" };
  }

  // ffprobe KHÔNG ném lỗi cho mọi tệp hỏng: ném vào nó 200KB byte ngẫu nhiên đặt
  // đuôi `.mp4` thì nó vẫn đoán ra một luồng 352×288 dài 0 giây và trả về bình
  // thường. Tệp đó đi tiếp thì thành một ô trông như dùng được, và chỗ vỡ dời
  // tới tận lúc dựng — sau khi người dùng đã đợi vài phút chép lời.
  if (!info.width || !info.height || (isVideo && !info.duration)) {
    await unlink(target).catch(() => {});
    return { ok: false, reason: "Tệp hỏng, không đọc được" };
  }

  let thumb: string | null = join(thumbDir(projectId), `${fileId}.jpg`);
  try {
    await makeThumbnail(target, thumb, isImage ? 0 : 0.5);
  } catch {
    thumb = null;
  }

  // "video có tiếng → cảnh chính" là phỏng đoán khi không ai nói rõ. Video chính
  // là phần CÓ lời nói (bản chép dựng từ đó), nên "main" luôn đòi có tiếng: ý
  // định "main" cho tệp câm là bất khả thi, rơi về chèn.
  const canBeMain = isVideo && info.hasAudio;
  const role =
    intendedRole === "insert"
      ? "insert"
      : intendedRole === "main"
        ? canBeMain
          ? "main"
          : "insert"
        : canBeMain
          ? "main"
          : "insert";
  // Số của người dùng dùng chung cho CẢ HAI vai, nên trong một vai nó có thể
  // nhảy cóc (0, 2, 5…). Không sao: mọi chỗ đọc đều `ORDER BY position` chứ
  // không đòi số liền nhau.
  const position =
    order ??
    (
      db
        .prepare(
          "SELECT COALESCE(MAX(position),-1) AS p FROM media_files WHERE project_id=? AND role=?",
        )
        .get(projectId, role) as { p: number }
    ).p + 1;

  db.prepare(
    `INSERT INTO media_files (id, project_id, name, size, role, position, duration, width, height, has_audio, stored_path, thumb_path)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    fileId,
    projectId,
    name,
    bytes,
    role,
    position,
    info.duration,
    info.width,
    info.height,
    info.hasAudio ? 1 : 0,
    target,
    thumb,
  );

  const row = db
    .prepare("SELECT * FROM media_files WHERE id=?")
    .get(fileId) as Record<string, unknown>;

  return { ok: true, row, warnings: info.warnings };
}
