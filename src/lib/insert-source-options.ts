import type { ApiSettings } from "@/lib/api";

/**
 * Ba nấc "máy được lấy tư liệu ở đâu", kèm chữ hiện lên.
 *
 * Để chung một chỗ vì có HAI ô chọn cùng nói về nó — một ở trang Cài đặt (quyết
 * giá trị mặc định lúc tạo dự án), một ở màn nạp tệp (quyết cho riêng dự án đang
 * mở). Hai ô mà tự gõ chữ riêng thì lệch nhau ngay ở lần sửa thứ hai, và người
 * dùng đọc ra như hai cài đặt khác nhau.
 *
 * Đây cũng là danh sách `items` mà `Select` cần để hiện NHÃN thay vì hiện thẳng
 * giá trị thô — không có nó thì ô chọn in ra chữ "library".
 */
export const INSERT_SOURCE_LABELS: Record<ApiSettings["insertSource"], string> =
  {
    project: "Chỉ tư liệu của dự án",
    starred: "Thêm tư liệu có sao",
    library: "Cả kho tư liệu",
  };
