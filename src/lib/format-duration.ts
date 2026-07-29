/**
 * `0:34`, `12:05`, `1:02:30` — bỏ giờ khi chưa tới một tiếng cho đỡ rườm.
 *
 * Ở `src/lib` chứ không ở một màn cụ thể: thời lượng hiện ở cả màn nạp tệp,
 * màn dự án lẫn bàn dựng, và ba chỗ đó phải đọc ra cùng một dạng.
 */
export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  const tail = `${String(minutes).padStart(hours ? 2 : 1, "0")}:${String(rest).padStart(2, "0")}`;
  return hours ? `${hours}:${tail}` : tail;
}
