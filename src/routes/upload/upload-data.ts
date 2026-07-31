export { formatDuration } from "@/lib/format-duration";

export type MediaRole = "main" | "insert";

export type UploadStatus = "queued" | "uploading" | "done" | "error";

export type MediaFile = {
  id: string;
  name: string;
  size: number;
  /** Ảnh xem trước; `undefined` khi chưa dựng xong hoặc tệp không đọc được */
  thumbnail?: string;
  role: MediaRole;
  status: UploadStatus;
  /** 0–100, chỉ có nghĩa khi đang tải */
  progress: number;
  /** Lý do bị từ chối hoặc tải hỏng, hiện nguyên văn cho người dùng */
  error?: string;
  /** Id do máy chủ cấp sau khi tải xong — chưa có nghĩa là chưa lên tới nơi */
  serverId?: string;
  /**
   * Đường phát từ máy chủ, dùng khi tệp gốc KHÔNG còn trong bộ nhớ trình duyệt.
   *
   * Mở lại `/upload/:projectId` (tải lại trang, hay quay về từ bàn dựng) thì
   * mọi `File` đã mất theo phiên cũ, nhưng video vẫn nằm trên đĩa máy chủ —
   * không có đường này thì các ô khôi phục lại thành ảnh tĩnh không xem được.
   */
  remoteUrl?: string;
  duration?: number;
  /** Máy chủ đo được sau khi tải xong; `undefined` là chưa biết, không phải "không có" */
  hasAudio?: boolean;
  width?: number;
  height?: number;
  /**
   * Nội dung tư liệu chèn. Rỗng nghĩa là để MÁY đọc — chặng đọc tư liệu chỉ chạm
   * tệp nào cột này còn trống, nên viết vào đây là thắng luôn máy.
   */
  description?: string;
  /** Tên tệp trong kho mà ô này chép ra — dùng để đánh dấu "đã có" ở hộp chọn */
  libraryFile?: string;
  /**
   * Ảnh hay video, do MÁY CHỦ chốt theo đuôi đường dẫn thật trên đĩa.
   *
   * Chỉ có ở tệp lấy về từ máy chủ. Với tệp vừa thả từ máy thì suy bằng `isVideo`
   * trên tên tệp là đủ — tên ấy còn nguyên đuôi. Nhưng tệp đã lưu thì `name` là
   * chữ người dùng đặt (tệp lấy từ kho mang luôn tiêu đề), nên đoán bằng đuôi sẽ
   * vẽ một clip thành tấm ảnh.
   */
  kind?: "image" | "video";
};

export const VIDEO_EXTENSIONS = [
  "mp4",
  "mov",
  "m4v",
  "webm",
  "mkv",
  "avi",
] as const;

export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic"] as const;

/** 2GB — trên mức này trình duyệt tải một lượt là không đáng tin. */
export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

export function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function isVideo(name: string) {
  return (VIDEO_EXTENSIONS as readonly string[]).includes(extensionOf(name));
}

export function isImage(name: string) {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(extensionOf(name));
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/**
 * Tên rút gọn để nhét vào nhãn nút.
 *
 * Tên tệp từ điện thoại dài trăm ký tự; đọc nguyên tên trong một câu lệnh
 * ("Gỡ …") thì cả bảng chú giải lẫn trình đọc màn hình đều thành vô nghĩa.
 * Giữ đầu và đuôi vì phần phân biệt các tệp thường nằm ở hai đầu.
 */
/**
 * Tên tệp KHÔNG có phần mở rộng, để hiện dưới ô.
 *
 * Ô hẹp tới 79px, mà `.mp4` chiếm gần một nửa số ký tự của "main-1.mp4" — cắt nó
 * đi thì tên vừa trọn thay vì thành "main-1.m…". Phần mở rộng cũng không nói gì
 * cho người đang nhìn chính khung hình của tệp đó.
 */
/**
 * Tên gợi ý cho một dự án mới: "Dự án 30/7".
 *
 * Đặt sẵn cho ai không muốn gõ, mà vẫn phân biệt được nhau trên danh sách — trước
 * đây mọi dự án đều mang đúng chữ "Dự án mới" và cái tên không nhận dạng nổi ô nào.
 *
 * Vẫn tính là TÊN MẶC ĐỊNH: `isDefaultTitle` nhận ra nó, và đoạn mồi từ vựng cho máy
 * nghe bỏ qua nó — "Video tên là Dự án 30/7" không giúp máy nghe đúng chữ nào.
 */
export function suggestedTitle(now = new Date()) {
  return `Dự án ${now.getDate()}/${now.getMonth() + 1}`;
}

/** Tên do máy đặt, chưa qua tay người dùng. */
export function isDefaultTitle(title: string) {
  return title === "Dự án mới" || /^Dự án \d{1,2}\/\d{1,2}$/.test(title.trim());
}

export function baseName(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function shortName(name: string, limit = 28) {
  if (name.length <= limit) return name;
  const head = Math.ceil((limit - 1) / 2);
  return `${name.slice(0, head)}…${name.slice(-(limit - 1 - head))}`;
}

/**
 * Khung ngang sẽ bị cắt hai bên khi đưa về 9:16 — người dùng cần biết TRƯỚC khi
 * dựng, không phải lúc xem video đã xuất.
 */
export function isLandscape(file: MediaFile) {
  return Boolean(file.width && file.height && file.width > file.height);
}

/**
 * Tỉ lệ khung thật của tệp, để ô bày đúng hình dáng nó có.
 *
 * Chưa đo xong thì lấy 9:16 với video và 1:1 với ảnh — đoán gần đúng còn hơn để
 * ô cao 0px rồi giật một nhát khi số đo về.
 */
export function aspectRatioOf(file: MediaFile) {
  if (file.width && file.height) return file.width / file.height;
  return isVideo(file.name) ? 9 / 16 : 1;
}

/**
 * Tệp này có làm được video chính không, kèm lý do nếu không.
 *
 * Video chính là phần CÓ lời nói và cả bản chép lời dựng từ đó, nên tệp câm bị
 * loại. Kiểm ở client đúng bằng luật của máy chủ — không thì UI hiện tệp ở cột
 * này trong khi máy chủ đã xếp nó sang cột kia.
 */
export function mainRoleRejection(file: MediaFile): string | null {
  if (!isVideo(file.name)) return "Ảnh không làm được video chính";
  if (file.hasAudio === false) return "Video không có tiếng";
  return null;
}

/**
 * Vì sao từ chối tệp này — trả về `null` nếu nhận được.
 *
 * Thứ tự kiểm có chủ ý: định dạng trước, rồi rỗng, rồi kích thước. Người dùng
 * kéo nhầm một tệp .zip thì cần nghe "không phải video", không phải "quá nặng".
 */
export function rejectionReason(name: string, size: number): string | null {
  if (!isVideo(name) && !isImage(name)) {
    const extension = extensionOf(name);
    return extension
      ? `Không nhận đuôi .${extension}`
      : "Tệp không có đuôi, không đoán được định dạng";
  }
  if (size === 0) return "Tệp rỗng";
  if (size > MAX_FILE_SIZE) return `Nặng quá ${formatBytes(MAX_FILE_SIZE)}`;
  return null;
}
