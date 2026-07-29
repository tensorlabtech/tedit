/**
 * `14:30`, `Hôm qua`, `28/07`, `28/07/2025` — mốc thời gian đủ để PHÂN BIỆT.
 *
 * Dự án không đặt tên được nên bảy ô đều mang chữ "Dự án mới"; thứ duy nhất
 * tách chúng ra là lúc tạo. Vì vậy ưu tiên độ chính xác ở gần (hôm nay hiện
 * giờ phút) và độ gọn ở xa (năm khác mới hiện năm).
 */
export function formatMoment(ms: number, now = Date.now()) {
  const at = new Date(ms);
  const today = new Date(now);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(at, today)) {
    return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(at, yesterday)) return "Hôm qua";

  const day = `${String(at.getDate()).padStart(2, "0")}/${String(at.getMonth() + 1).padStart(2, "0")}`;
  return at.getFullYear() === today.getFullYear()
    ? day
    : `${day}/${at.getFullYear()}`;
}
