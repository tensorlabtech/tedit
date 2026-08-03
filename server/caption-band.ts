import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { BAND_ANCHOR, type Band } from "./text-layout";
import type { StylePack } from "./style-pack";

const run = promisify(execFile);

/**
 * CHỌN DẢI CHO PHỤ ĐỀ — trên hay dưới.
 *
 * Bản trước ghim cứng `"bottom"` ở chỗ gieo chữ. Đo mười dự án thật trong
 * `server/data`: cả mười đều `bottom`, tức là dải trên chưa từng được dùng dù
 * mã đã đỡ nó từ lâu (112 cụm chữ đang ở `top`, tất cả do người dùng tự kéo).
 *
 * Hai điều quyết định, theo đúng thứ tự này:
 *
 * 1. **Bộ dáng có chiếm dải nào không.** Mảng màu là đồ đạc CỐ ĐỊNH — nó ở đó
 *    suốt phim. Xếp phụ đề chồng lên nó là hai lớp tranh nhau một chỗ. Dòng
 *    tiêu đề thì không tính: nó tắt sau vài giây đầu.
 *
 * 2. **Chỗ nào ÍT ĐỘNG hơn.** Nền tĩnh thì chữ đọc dễ, mà chỗ động trong một
 *    video mặt người chính là người — nên tránh chỗ động cũng là tránh che
 *    người. Đo một bản thật: dải trên 2,83, dải dưới 9,50 — gấp 3,4 lần, vì
 *    người ngồi choán nửa dưới còn nửa trên là trần nhà với cửa sổ.
 */

/**
 * Dải trên phải TĨNH HƠN hẳn mới được chọn.
 *
 * Không lấy "bên nào nhỏ hơn thì thắng": hai bên xấp xỉ nhau thì con số thắng
 * chỉ là nhiễu của phép đo, mà đổi dải giữa hai lượt dựng cùng một video thì
 * người dùng đọc ra là máy tuỳ hứng. Dưới là chỗ người xem quen tìm phụ đề, nên
 * nó giữ vai mặc định và bên kia phải hơn rõ mới lật được.
 */
const ADVANTAGE = 0.7;

/**
 * Lấy mẫu hai khung một giây.
 *
 * Đủ để thấy người có cựa quậy hay không mà không phải giải mã cả phim. Dày hơn
 * cũng không đổi kết luận: thứ đang đo là "nửa nào có người", không phải một
 * chuyển động cụ thể nào.
 */
const SAMPLE_FPS = 2;

/** Bề rộng lúc đo. Nhỏ thôi — đang đo mảng lớn, không đo nét. */
const SAMPLE_WIDTH = 192;

/** Trần chiều cao khối chữ, khớp `MAX_BLOCK_SHARE` của `text-layout.ts`. */
const BLOCK_SHARE = 0.3;

/**
 * Vùng mà khối chữ của một dải THẬT SỰ chiếm, tính theo chiều cao khung.
 *
 * Đọc từ `BAND_ANCHOR` chứ không chép lại số: neo dải là thứ đã đổi một lần
 * (dải dưới từng neo bằng mép trên và chữ chạy ra ngoài đáy khung), và chép số
 * sang đây là hẹn một lần lệch nữa.
 */
function bandSpan(band: Band): { top: number; height: number } {
  const anchor = BAND_ANCHOR[band];
  if (anchor.edge === "top") return { top: anchor.at, height: BLOCK_SHARE };
  if (anchor.edge === "bottom") {
    return { top: anchor.at - BLOCK_SHARE, height: BLOCK_SHARE };
  }
  return { top: anchor.at - BLOCK_SHARE / 2, height: BLOCK_SHARE };
}

/**
 * Mức ĐỘNG trung bình của một dải: chênh lệch giữa hai khung liền nhau.
 *
 * `tblend=all_mode=difference` cho ra ảnh hiệu của hai khung kề, rồi
 * `signalstats` đọc độ sáng trung bình của ảnh hiệu ấy. Nền đứng yên thì ảnh
 * hiệu đen, người cựa thì nó sáng lên. Không cần thư viện nào ngoài ffmpeg vốn
 * đã có.
 */
async function motion(
  path: string,
  width: number,
  height: number,
  band: Band,
): Promise<number | null> {
  const span = bandSpan(band);
  // Cắt trước khi thu nhỏ: thu trước rồi cắt thì mép dải rơi vào giữa điểm ảnh.
  // Chiều cao chẵn — bộ lọc video từ chối số lẻ.
  const y = Math.max(0, Math.round(height * span.top));
  const h = Math.min(height - y, Math.round((height * span.height) / 2) * 2);
  if (h < 2) return null;
  try {
    const { stderr } = await run(
      "ffmpeg",
      ["-hide_banner", "-nostats", "-i", path, "-vf",
       `fps=${SAMPLE_FPS},crop=${width}:${h}:0:${y},scale=${SAMPLE_WIDTH}:-2,` +
         `tblend=all_mode=difference,signalstats,` +
         `metadata=print:key=lavfi.signalstats.YAVG`,
       "-f", "null", "-"],
      { timeout: 180_000, maxBuffer: 32 * 1024 * 1024 },
    ).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));
    const values = [...String(stderr).matchAll(/YAVG=([\d.]+)/g)].map((m) =>
      Number(m[1]),
    );
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  } catch {
    return null;
  }
}

/** Dải mà đồ đạc CỐ ĐỊNH của bộ dáng đang chiếm. `null` là không chiếm dải nào. */
function occupied(pack: Pick<StylePack, "plate">): Band | null {
  return pack.plate ? pack.plate.band : null;
}

/**
 * Dải nên đặt phụ đề. Không đo được thì trả `"bottom"` — mặc định cũ.
 */
export async function pickCaptionBand(
  basePath: string,
  width: number,
  height: number,
  pack: Pick<StylePack, "plate">,
): Promise<{ band: Band; why: string }> {
  const taken = occupied(pack);
  if (taken === "bottom") return { band: "top", why: "mảng màu của bộ dáng chiếm dải dưới" };
  if (taken === "top") return { band: "bottom", why: "mảng màu của bộ dáng chiếm dải trên" };

  const [above, below] = await Promise.all([
    motion(basePath, width, height, "top"),
    motion(basePath, width, height, "bottom"),
  ]);
  if (above === null || below === null || below <= 0) {
    return { band: "bottom", why: "không đo được độ động" };
  }
  const ratio = above / below;
  return ratio < ADVANTAGE
    ? {
        band: "top",
        why: `nửa trên tĩnh hơn (${above.toFixed(1)} so với ${below.toFixed(1)})`,
      }
    : {
        band: "bottom",
        why: `hai nửa động ngang nhau (${above.toFixed(1)} so với ${below.toFixed(1)})`,
      };
}
