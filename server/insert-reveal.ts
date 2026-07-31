import type { RevealId } from "./style-pack";

/**
 * CÁCH TƯ LIỆU CHÈN HIỆN RA — một khai báo cho cả hai đường vẽ.
 *
 * Ba kiểu đầu (`none`, `fade`, `fade-up`) đều là biến thể của MỜ DẦN, nên kho
 * cũ thiếu hẳn nhóm chuyển động thật: đổi kiểu mà video vẫn đọc ra như nhau.
 * Hai kiểu mới lấp đúng chỗ đó — một kiểu đi ngang, một kiểu không đi đâu cả mà
 * bật ra.
 *
 * Nhưng thêm kiểu vào kho **không** tự làm video đa dạng: kho 5 kiểu mà AI luôn
 * chọn 2 cái thì vẫn giống nhau như trước. Thứ tạo khác biệt là LUẬT CHỌN và
 * NHỊP — đó là phần bộ dáng gánh (`effectBias`, `rhythm`).
 */

/** Thời gian một lần hiện ra. Khớp giữa ffmpeg và CSS. */
export const REVEAL_SECONDS = 0.8;
/** Quãng trượt DỌC của `fade-up`, theo chiều cao khung. */
export const REVEAL_RISE = 0.1;
/** Quãng trượt NGANG của `slide`, theo bề rộng hộp tư liệu. */
export const SLIDE_SHIFT = 0.12;
/**
 * `pop` = GIỮ rồi BẬT.
 *
 * Không phải một kiểu mờ nhanh: nó đứng hẳn ngoài khung suốt `POP_HOLD` giây
 * rồi vào trong `POP_SNAP` giây. Chính quãng đứng im ấy làm cú bật đọc ra như
 * một nhịp, chứ nếu vào ngay từ giây 0 thì nó chỉ là `none` hơi mờ.
 */
export const POP_HOLD = 0.25;
export const POP_SNAP = 0.08;

export const REVEALS: Array<{ id: RevealId; label: string; note: string }> = [
  { id: "none", label: "Cắt thẳng", note: "Hiện ngay, không hiệu ứng" },
  {
    id: "fade-up",
    label: "Mờ + lên",
    note: "Mờ dần thành rõ, đồng thời trượt từ dưới lên — 0,8 giây",
  },
  { id: "fade", label: "Mờ dần", note: "Chỉ mờ thành rõ, không chuyển động" },
  {
    id: "slide",
    label: "Trượt vào",
    note: "Rõ ngay nhưng đi vào từ mép trái — chuyển động thật, không phải mờ",
  },
  {
    id: "pop",
    label: "Giữ rồi bật",
    note: "Chờ một nhịp rồi hiện phắt ra — nhấn mạnh hơn mọi kiểu mờ",
  },
];

/**
 * Style CSS của một lần hiện ra tại thời điểm `elapsed` giây kể từ lúc bắt đầu.
 *
 * Một hàm cho cả khung xem trong bàn dựng lẫn ô mẫu ở trang tra cứu. Trước đây
 * hai chỗ chép nhau bằng tay, nên thêm một kiểu là phải nhớ sửa hai chỗ — và
 * chỗ quên sẽ im lặng vẽ ra kiểu cũ.
 *
 * `boxHeightShare` là chiều cao hộp tư liệu theo tỉ lệ khung: `translateY` của
 * CSS tính theo chiều cao CHÍNH THẺ, còn `REVEAL_RISE` tính theo chiều cao
 * KHUNG — thiếu phép chia này thì tư liệu nhỏ trượt xa gấp mấy lần bản xuất.
 */
export function revealCss(
  reveal: RevealId,
  elapsed: number,
  boxHeightShare = 1,
  // Kiểu trả về khai bằng bản ghi thuần chứ không dùng `React.CSSProperties`:
  // tệp này bị máy chủ import, mà cấu hình kiểu của máy chủ không có React.
): { opacity?: number; transform?: string } {
  if (reveal === "none") return {};
  if (reveal === "pop") {
    // Đứng ngoài suốt quãng giữ, rồi vào phắt. Không có trạng thái giữa.
    const p = Math.min(1, Math.max(0, (elapsed - POP_HOLD) / POP_SNAP));
    return { opacity: p };
  }
  const p = Math.min(1, Math.max(0, elapsed / REVEAL_SECONDS));
  // Nới chậm (1-p)³: vào nhanh rồi dừng êm mới ra chuyển động, còn tuyến tính
  // đọc ra như bị kéo bằng tay.
  const rest = (1 - p) ** 3;
  if (reveal === "fade") return { opacity: p };
  if (reveal === "slide") {
    // Rõ ngay từ đầu — cái đọc được ở kiểu này là CHUYỂN ĐỘNG, không phải độ mờ.
    return { transform: `translateX(${-SLIDE_SHIFT * 100 * rest}%)` };
  }
  return {
    opacity: p,
    transform: `translateY(${(REVEAL_RISE * 100 * rest) / boxHeightShare}%)`,
  };
}
