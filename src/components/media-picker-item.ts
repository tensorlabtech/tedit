import { api, type ApiFile } from "@/lib/api";

/**
 * Một tệp trong hộp chọn tư liệu — DẠNG CHUNG cho cả hai nguồn.
 *
 * Hộp chọn kéo tệp về từ hai chỗ khác hẳn nhau: `media_files` của dự án (có mã,
 * có ảnh thu nhỏ máy chủ dựng sẵn) và kho dùng chung (chỉ có tên tệp, xem thẳng
 * tệp gốc). Nếu lưới và khung xem trước phải biết mình đang vẽ loại nào thì mỗi
 * chỗ mọc thêm một nhánh `if`, và hai tab sẽ trôi khỏi nhau ngay ở lần sửa sau.
 *
 * Nên chỗ nào lấy tệp về thì chỗ đó nắn sẵn về dạng này; lưới chỉ vẽ.
 */
export type PickerItem = {
  /** Khoá duy nhất trong tab — mã tệp của dự án, hoặc tên tệp trong kho */
  key: string;
  /** Ảnh đại diện trong lưới; bỏ trống thì lưới vẽ biểu tượng thay */
  thumbUrl?: string;
  /**
   * `thumbUrl` là ẢNH hay là chính tệp VIDEO — khác với `isVideo` của tệp gốc.
   *
   * Tư liệu của dự án có ảnh thu nhỏ do máy chủ dựng sẵn, nên dù tệp là video thì
   * ảnh đại diện vẫn là một tấm JPG. Còn kho dùng chung chưa có ảnh thu nhỏ nào:
   * ô phải xem thẳng tệp gốc, mà một tệp .mp4 nhét vào thẻ `<img>` thì ra ô trắng.
   */
  thumbKind: "image" | "video";
  /** Tệp thật để xem to ở cột phải */
  previewUrl: string;
  name: string;
  isVideo: boolean;
  seconds: number;
  width?: number;
  height?: number;
  starred?: boolean;
  /**
   * Lời nhắc trên ô:
   * · `already` — kho: tệp này đã có trong dự án rồi.
   * · `no-description` — kho: chưa viết mô tả nên chặng tự ghép sẽ bỏ qua.
   */
  note?: "already" | "no-description";
  /** Chuỗi để ô tìm soi vào — gộp sẵn tên và mô tả */
  search: string;
};

/** Nắn một tệp của dự án (`media_files`) về dạng lưới đọc được. */
export function pickerItemFromApiFile(file: ApiFile): PickerItem {
  const isVideo = file.kind === "video";
  return {
    key: file.id,
    // Với ẢNH thì lấy thẳng tệp gốc khi chưa có ảnh thu nhỏ — tệp tải lên bằng
    // bản cũ không có ảnh thu nhỏ nào để mà lấy. Với VIDEO thì đành chịu: tải cả
    // tệp 200MB về chỉ để lấy một khung cho ô 90px là quá đắt.
    thumbUrl: file.thumb_path
      ? api.fileUrl(file.thumb_path)
      : isVideo
        ? undefined
        : api.mediaUrl(file.id),
    // Ảnh thu nhỏ máy chủ dựng LUÔN là JPG; chỉ khi không có nó và tệp gốc là
    // ảnh thì ô mới xem thẳng tệp gốc — vẫn là ảnh.
    thumbKind: "image",
    previewUrl: api.mediaUrl(file.id),
    name: file.name,
    isVideo,
    seconds: file.duration ?? 0,
    width: file.width ?? undefined,
    height: file.height ?? undefined,
    search: `${file.name} ${file.description ?? ""}`.toLowerCase(),
  };
}
