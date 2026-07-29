/** Ảnh xem trước dựng tại máy, kèm cỡ khung THẬT của tệp. */
export type LocalProbe = {
  /** `null` khi tệp không đọc được — hàng vẫn hiện, chỉ là hiện icon dự phòng */
  thumbnail: string | null;
  /**
   * Cỡ khung khi XEM: trình duyệt đã áp metadata xoay, nên video quay dọc bằng
   * điện thoại ra đúng chiều dọc. Máy chủ trả lại con số này lần nữa sau khi tải
   * xong, nhưng đo tại chỗ thì nhãn "khung ngang" hiện đúng ngay từ giây đầu
   * thay vì phải đợi cả tệp lên tới nơi.
   */
  width?: number;
  height?: number;
};

const UNREADABLE: LocalProbe = { thumbnail: null };

/**
 * Đọc một tệp vừa chọn: dựng ảnh xem trước và đo khung hình.
 *
 * Không bao giờ ném lỗi — người dùng thả nhầm một tệp .mp4 hỏng thì vẫn phải
 * thấy nó trong danh sách kèm icon, chứ không phải thấy màn hình trắng.
 */
export async function makeThumbnail(file: File): Promise<LocalProbe> {
  if (
    file.type.startsWith("image/") ||
    /\.(jpe?g|png|webp|heic)$/i.test(file.name)
  ) {
    return readImage(file);
  }
  return grabVideoFrame(file);
}

function readImage(file: File): Promise<LocalProbe> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () =>
      resolve({
        thumbnail: url,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(UNREADABLE);
    };
    image.src = url;
  });
}

/** Cạnh dài nhất của ảnh xem trước. Tệp gốc 4K vẽ vào ô 80px chỉ tổ tốn bộ nhớ. */
const THUMBNAIL_LONG_EDGE = 320;

/** Lấy một khung hình gần đầu video. Không lấy đúng giây 0 vì nhiều video mở đầu bằng một khung đen. */
function grabVideoFrame(file: File): Promise<LocalProbe> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const finish = (value: LocalProbe) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(value);
    };

    // Tệp hỏng có khi không bắn cả `error` lẫn `loadeddata` — không có hàng rào
    // thời gian thì lời hứa treo mãi và hàng đó không bao giờ hiện icon dự phòng.
    const timer = window.setTimeout(() => finish(UNREADABLE), 4000);

    video.muted = true;
    video.preload = "metadata";
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 4);
    };
    video.onseeked = () => {
      window.clearTimeout(timer);
      const { videoWidth: width, videoHeight: height } = video;
      const context = document.createElement("canvas").getContext("2d");
      if (!context || !width) return finish(UNREADABLE);

      // Giữ NGUYÊN tỉ lệ khung, không cắt vuông như bản trước: ô bày ảnh tự cắt
      // bằng CSS theo đúng khung 9:16 sẽ xuất ra, mà cắt vuông trước thì nó cắt
      // lần thứ hai — khung xem trước mất thêm hai bên và không còn giống thứ
      // sắp dựng ra nữa.
      const scale = Math.min(1, THUMBNAIL_LONG_EDGE / Math.max(width, height));
      const canvas = context.canvas;
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      finish({ thumbnail: canvas.toDataURL("image/jpeg", 0.7), width, height });
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      finish(UNREADABLE);
    };
    video.src = url;
  });
}
