import {
  FolderIcon,
  ImagesIcon,
  MusicIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

export type MenuItem = {
  to: string;
  label: string;
  icon: typeof FolderIcon;
  /** Chưa dựng — màn chỉ có ô "đang làm". */
  mocked?: boolean;
};

/**
 * Danh mục của thanh bên. Khai ở MỘT chỗ vì thanh bên và bảng đường dẫn đều đọc
 * nó — để mỗi bên tự liệt kê thì thêm một mục là hai lần sửa, mà quên bên đường
 * dẫn thì bấm vào mục mới ra trang trắng.
 *
 * Đường dẫn viết tiếng Anh theo quy ước của dự án, nhãn hiện ra thì tiếng Việt.
 */
export const MENU: MenuItem[] = [
  { to: "/", label: "Dự án", icon: FolderIcon },
  // "TƯ LIỆU", không phải "Tài liệu": đây là kho ảnh và video chèn (b-roll), chứ
  // không phải chỗ chứa văn bản. Nhãn cũ đọc ra một thứ hoàn toàn khác, và đường
  // dẫn `/documents` cũng nói sai như thế.
  { to: "/assets", label: "Tư liệu", icon: ImagesIcon },
  { to: "/music", label: "Thư viện nhạc", icon: MusicIcon },
  {
    to: "/settings",
    label: "Cài đặt",
    icon: SlidersHorizontalIcon,
  },
];
