import { statfs, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { db } from "./db";
import { run } from "./media-tools";
import { DATA_ROOT } from "./paths";

/**
 * Máy chủ CÒN LÀM VIỆC ĐƯỢC không — khác với máy chủ còn trả lời.
 *
 * Healthcheck trước đây gọi `/`, mà đó là `index.html` tĩnh: CSDL không mở được,
 * hay `ffmpeg` biến khỏi PATH, thì container vẫn xanh và người dùng vẫn tải được
 * trang — rồi mọi thao tác đều hỏng. "Sống mà vô dụng" phải đọc ra được từ bên
 * ngoài, không thì Docker khởi động lại nhầm lúc và bỏ qua đúng lúc.
 */

/** Quá hạn này thì coi như công cụ hỏng — thà báo sớm còn hơn treo cả healthcheck. */
const TOOL_TIMEOUT_MS = 3_000;

/**
 * Đĩa đầy tới mức này là đã phải lo — nhưng CHƯA phải là hỏng.
 *
 * Ngưỡng này KHÔNG kéo `ok` xuống. Healthcheck trả lời đúng một câu: "có nên gửi
 * request vào đây không". Đĩa 86% thì câu trả lời vẫn là có — máy chủ vẫn chép
 * lời, vẫn xuất video, vẫn phục vụ được. Đánh nó thành hỏng là mời người khác
 * khởi động lại hoặc rút một máy chủ đang khoẻ ra khỏi vòng.
 *
 * Cảnh báo đi đường khác: một dòng nhật ký ở đây, và con số trên màn Cài đặt.
 * Còn thứ thật sự hỏng — không GHI được vào thư mục dữ liệu — thì vẫn kéo `ok`
 * xuống, vì lúc đó máy chủ hết làm việc được thật.
 */
const DISK_WARN_RATIO = Number(process.env.TEDDIT_DISK_WARN ?? 0.85);

/** Công cụ ngoài bắt buộc phải có. Thiếu một cái là mọi lượt dựng đều hỏng. */
const REQUIRED_TOOLS = ["ffmpeg", "ffprobe", "magick"] as const;

export type HealthReport = {
  /** Máy chủ còn làm việc được không. Chỉ cái này quyết định mã HTTP. */
  ok: boolean;
  checks: {
    db: boolean;
    tools: boolean;
    /** GHI được vào thư mục dữ liệu — không phải "còn nhiều chỗ". */
    diskWritable: boolean;
  };
  /** Phần trăm đĩa đã dùng, làm tròn. Rỗng khi không đo được. */
  diskUsedPercent: number | null;
  /** Đã qua ngưỡng cảnh báo. Là lời nhắc đi dọn, KHÔNG kéo `ok` xuống. */
  diskLow: boolean;
};

async function checkDatabase(): Promise<boolean> {
  try {
    db.prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  }
}

async function checkTools(): Promise<boolean> {
  const probes = REQUIRED_TOOLS.map(async (tool) => {
    // `magick` không có `-version` giống ffmpeg nhưng vẫn nhận nó và thoát 0.
    await run(tool, ["-version"], { timeout: TOOL_TIMEOUT_MS });
  });
  const results = await Promise.allSettled(probes);
  return results.every((result) => result.status === "fulfilled");
}

/**
 * Thư mục dữ liệu còn GHI được không, và còn bao nhiêu chỗ.
 *
 * Ghi thử một tệp rỗng chứ không chỉ đọc `statfs`: ổ còn chỗ mà gắn ở chế độ chỉ
 * đọc — chuyện thường gặp khi volume Docker hỏng — thì `statfs` vẫn vui vẻ báo
 * hàng trăm GB trống.
 */
async function checkDisk(): Promise<{
  writable: boolean;
  usedPercent: number | null;
  low: boolean;
}> {
  const probeFile = join(DATA_ROOT, ".health-probe");
  try {
    await writeFile(probeFile, "");
    await unlink(probeFile);
  } catch {
    return { writable: false, usedPercent: null, low: false };
  }

  try {
    const stats = await statfs(DATA_ROOT);
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    if (total <= 0) return { writable: true, usedPercent: null, low: false };
    const usedRatio = 1 - free / total;
    return {
      writable: true,
      usedPercent: Math.round(usedRatio * 100),
      low: usedRatio >= DISK_WARN_RATIO,
    };
  } catch {
    // Đo không được thì KHÔNG coi là hỏng: ghi được là đủ để làm việc, còn con
    // số chỉ để nhìn.
    return { writable: true, usedPercent: null, low: false };
  }
}

export async function collectHealth(): Promise<HealthReport> {
  const [database, tools, disk] = await Promise.all([
    checkDatabase(),
    checkTools(),
    checkDisk(),
  ]);

  return {
    ok: database && tools && disk.writable,
    checks: { db: database, tools, diskWritable: disk.writable },
    diskUsedPercent: disk.usedPercent,
    diskLow: disk.low,
  };
}

/**
 * Dung lượng thư mục dữ liệu, cho màn Cài đặt.
 *
 * Tách khỏi `collectHealth` vì hai chỗ dùng khác nhau: healthcheck cần một câu
 * trả lời có/không, còn màn Cài đặt cần con số để người dùng biết lúc nào phải
 * dọn.
 */
export async function diskUsage() {
  try {
    const stats = await statfs(DATA_ROOT);
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    return { totalBytes: total, freeBytes: free, usedBytes: total - free };
  } catch {
    return null;
  }
}
