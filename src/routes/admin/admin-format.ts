/** Định dạng số + trạng thái cho màn quản trị — gọn, tiếng Việt. */

type StatusStyle = { label: string; variant: "default" | "secondary" | "outline" };

/** Nhãn + kiểu huy hiệu cho trạng thái dự án. Trạng thái lạ → giữ nguyên chữ. */
const STATUS: Record<string, StatusStyle> = {
  ready: { label: "Xong", variant: "default" },
  draft: { label: "Nháp", variant: "secondary" },
};

export function statusOf(status: string): StatusStyle {
  return STATUS[status] ?? { label: status, variant: "outline" };
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exp);
  return `${value.toFixed(value >= 10 || exp === 0 ? 0 : 1)} ${units[exp]}`;
}

/** Giây → "m:ss" (hoặc "h:mm:ss"). */
export function formatDuration(seconds: number | null | undefined): string {
  const total = Math.round(seconds ?? 0);
  if (!total) return "—";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Mốc thời gian có thể là số (ms hoặc giây) hoặc chuỗi ISO — better-auth và bảng
 * dự án lưu khác nhau. Nhận cả ba, trả "dd/MM/yy".
 */
export function formatDate(value: number | string | null | undefined): string {
  if (value == null) return "—";
  let date: Date;
  if (typeof value === "string") {
    date = new Date(value);
  } else {
    // Dưới ~10^12 coi là giây (mốc epoch giây), còn lại là mili-giây.
    date = new Date(value < 1e12 ? value * 1000 : value);
  }
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(2)}`;
}

/** Như `formatDate` nhưng kèm giờ:phút — dùng cho mốc export "lúc nào". */
export function formatDateTime(value: number | string | null | undefined): string {
  if (value == null) return "—";
  const date =
    typeof value === "string"
      ? new Date(value)
      : new Date(value < 1e12 ? value * 1000 : value);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatDate(value)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
