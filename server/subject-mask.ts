import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { workDir } from "./paths";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, "seg", "segment.py");
const PYLIBS = join(here, "seg", "pylibs");
const VENV_PY = join(here, "seg", "venv", "bin", "python3");

/**
 * MẶT NẠ NGƯỜI — tách người khỏi nền, một lần cho cả video.
 *
 * Kết quả là một video xám nằm cạnh `base.mp4`: trắng là người, đen là nền. Bốn
 * thiết bị của bộ dáng đọc nó — chữ chạy sau người, viền quanh người, người cắt
 * rời, và phép chọn chỗ đặt chữ.
 *
 * ── VÌ SAO LÀ MỘT CHẶNG RIÊNG, KHÔNG TÍNH LÚC DỰNG ──
 *
 * Đo trên video 133 giây: 4.776 khung, 58 giây. Tính lại ở mỗi lượt xuất thì
 * người dùng chờ thêm ngần ấy MỖI LẦN họ đổi một chữ. Mặt nạ chỉ phụ thuộc vào
 * `base.mp4`, mà `base.mp4` chỉ đổi khi người dùng thay tệp quay — nên tính một
 * lần rồi để đó là đúng hình dạng của việc này.
 *
 * ── VÌ SAO KHÔNG BẮT BUỘC ──
 *
 * Máy chủ có thể chưa cài thư viện, hoặc video không có người nào. Cả hai đều
 * không phải lỗi — chỉ là bộ dáng nào cần mặt nạ thì rơi về lối không có. Nên
 * mọi hàm ở đây trả `null` thay vì ném.
 */

/** Đường tới mặt nạ của dự án. Không hứa nó tồn tại. */
export function subjectPath(projectId: string): string {
  return join(workDir(projectId), "subject.mp4");
}

/** Dự án này đã có mặt nạ chưa. */
export function hasSubject(projectId: string): boolean {
  return existsSync(subjectPath(projectId));
}

/**
 * Dựng mặt nạ. Trả số khung dựng được, hoặc `null` khi không chạy được.
 *
 * Nuốt lỗi có chủ ý: thiếu `mediapipe` là chuyện thường ở máy chưa cài, và một
 * chặng phụ làm hỏng cả lượt dựng thì tệ hơn nhiều so với một bộ dáng thiếu vài
 * thiết bị.
 */
export async function buildSubjectMask(
  projectId: string,
  basePath: string,
): Promise<{ frames: number; width: number; height: number } | null> {
  if (!existsSync(SCRIPT)) return null;
  const python = existsSync(VENV_PY) ? VENV_PY : "python3";
  try {
    const { stdout } = await run(python, [SCRIPT, basePath, subjectPath(projectId)], {
      env: { ...process.env, PYTHONPATH: PYLIBS },
      // Video dài gấp ba bản đo cũng chỉ chừng ba phút; mười phút là trần rộng.
      timeout: 600_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const line = stdout.trim().split("\n").at(-1) ?? "";
    const parsed = JSON.parse(line) as {
      frames: number;
      width: number;
      height: number;
    };
    return parsed.frames > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Dải nào của khung ÍT người nhất — chỗ đặt chữ lớn mà không bị che.
 *
 * Chalk đặt "YOUTH" trên đầu vì trên đó là trời. Đó không phải một con số khai
 * tay được: người ngồi cao hay thấp trong khung là chuyện của từng bản quay.
 * Đọc thẳng từ mặt nạ thì thiết bị tự tìm chỗ.
 *
 * Lấy MỘT khung ở giữa phim chứ không quét cả video: người nói ngồi yên gần như
 * suốt, và một phép đo đủ để chọn dải. Quét cả phim là bốn nghìn lượt giải mã
 * cho một quyết định có năm khả năng.
 */
export async function emptiestBand(
  projectId: string,
  atSecond: number,
  bands = 5,
): Promise<{ index: number; share: number; total: number } | null> {
  if (!hasSubject(projectId)) return null;
  try {
    /*
     * `cropdetect` không dùng được ở đây — nó tìm mép đen của cả khung, còn ta
     * cần biết TỪNG DẢI đục bao nhiêu. `crop` + `signalstats` cho đúng số ấy,
     * và một lượt ffmpeg cho mỗi dải vẫn rẻ vì chỉ đọc một khung.
     */
    const shares: number[] = [];
    for (let index = 0; index < bands; index += 1) {
      const { stderr } = await run(
        "ffmpeg",
        ["-hide_banner", "-nostats", "-ss", String(atSecond), "-i", subjectPath(projectId),
         "-frames:v", "1",
         "-vf", `crop=iw:ih/${bands}:0:ih*${index}/${bands},signalstats,` +
                `metadata=print:key=lavfi.signalstats.YAVG`,
         "-f", "null", "-"],
        { timeout: 30_000 },
      ).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));
      const match = /YAVG=([\d.]+)/.exec(String(stderr));
      shares.push(match ? Number(match[1]) / 255 : 1);
    }
    let best = 0;
    for (let index = 1; index < shares.length; index += 1) {
      if (shares[index] < shares[best]) best = index;
    }
    return { index: best, share: shares[best], total: bands };
  } catch {
    return null;
  }
}
