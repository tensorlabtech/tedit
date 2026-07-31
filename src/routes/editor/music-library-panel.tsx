import { MusicLibraryBrowser } from "./music-library-browser";
import { useMusicLibrary } from "./use-music-library";
import type { EditorState } from "./use-editor";

/**
 * Tab KHO NHẠC ở bàn dựng — nối phần duyệt kho vào dự án đang mở.
 *
 * Kho dùng CHUNG cho mọi dự án, nên "thêm vào kho" khác hẳn "đặt vào dự án": bài
 * thêm vào kho thì mọi lượt dựng về sau đều chọn được, kể cả chặng tự chọn nhạc.
 *
 * Giữ nút tải lên trong hàng công cụ: tab này không có dòng tiêu đề riêng để mà
 * đặt nút ra ngoài như trang Thư viện nhạc.
 */
export function MusicLibraryPanel({
  editor,
  open,
}: {
  editor: EditorState;
  open: boolean;
}) {
  const kho = useMusicLibrary(open);
  return (
    <MusicLibraryBrowser
      kho={kho}
      onPick={(file) => void editor.addMusicFromLibrary(file)}
    />
  );
}
