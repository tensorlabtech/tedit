import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * TỰ CÂN TIẾNG — cùng lối với `auto-grade.ts`, nhưng cho giọng nói.
 *
 * Đo một tệp thật trong `server/data`: −23,4 LUFS. Chuẩn mà TikTok, YouTube,
 * Instagram đều quy về là −14 LUFS. Thiếu chín decibel nghĩa là người xem phải
 * vặn to lên, rồi video sau của người khác đập vào tai họ.
 *
 * Nền tảng CÓ tự chuẩn hoá khi nhận video — nhưng chúng chỉ kéo mức tổng, mà
 * kéo một bản đã nhỏ thì kéo lên cả tiếng ù và tiếng nền. Cân trước, và cân
 * kèm lọc, thì thứ được kéo lên là giọng chứ không phải căn phòng.
 *
 * ── VÌ SAO KHÔNG DÙNG THẲNG `loudnorm` ──
 *
 * `loudnorm` một lượt phải vừa đo vừa sửa nên nó chạy sau một cửa sổ trượt: đoạn
 * to thì nó hạ, hạ chưa kịp thì đoạn sau đã nhỏ, và tiếng phập phồng theo. Với
 * giọng nói — vốn lúc to lúc nhỏ theo câu — cái phập phồng ấy nghe rõ.
 *
 * Đo trước rồi nhân một hệ số CỐ ĐỊNH thì không có chuyện đó: động lực học của
 * giọng giữ nguyên, chỉ cả bản dịch lên. Giá phải trả là thêm một lượt quét,
 * mà lượt ấy rẻ hơn nhiều so với một lượt dựng.
 */

export type TiengStats = {
  /** Độ to tích hợp, LUFS. Càng âm càng nhỏ. */
  lufs: number;
  /** Đỉnh thật, dBTP. Trên 0 là đã vỡ tiếng. */
  peak: number;
};

/** Đích của mọi nền tảng mạng xã hội. */
const DICH_LUFS = -14;

/**
 * Đo mười lăm giây đầu.
 *
 * Đủ để biết giọng to hay nhỏ. Quét cả tệp chính xác hơn nhưng một quyết định
 * chỉ có một con số thì không đáng bắt người dùng chờ thêm.
 */
export async function doTieng(path: string): Promise<TiengStats | null> {
  try {
    const { stderr } = await run(
      "ffmpeg",
      ["-hide_banner", "-nostats", "-t", "15", "-i", path,
       "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"],
      { timeout: 90_000, maxBuffer: 8 * 1024 * 1024 },
    ).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));

    const raw = String(stderr);
    const soSau = (nhan: string) => {
      const m = new RegExp(`${nhan}:\\s*(-?[\\d.]+)`).exec(raw);
      return m ? Number(m[1]) : Number.NaN;
    };
    const lufs = soSau("I");
    if (!Number.isFinite(lufs)) return null;
    const peak = soSau("Peak");
    return { lufs, peak: Number.isFinite(peak) ? peak : -1 };
  } catch {
    return null;
  }
}

export type CanTieng = {
  /** Số decibel cần nâng. Âm là hạ. */
  gainDb: number;
  /** Cắt tần thấp — tiếng điều hoà, gió, rung bàn. */
  locU: boolean;
  lyDo: string[];
};

/**
 * Từ số đo ra bộ chỉnh, và biết khi nào NÊN IM.
 *
 * · **Lệch dưới 1,5 dB thì không đụng.** Tai không nghe ra, mà mỗi lần chạm
 *   vào tiếng là một lần lấy mẫu lại.
 *
 * · **Trần +12 dB.** Nâng mạnh hơn thì thứ to lên là tiếng ù của căn phòng chứ
 *   không phải giọng — bản gốc quá nhỏ nghĩa là micro ở xa, và ở xa thì tỉ lệ
 *   giọng trên nền vốn đã xấu.
 *
 * · **Sàn −6 dB.** Bản nào to quá thì hạ, nhưng hạ sâu thì nghi là đo nhầm
 *   (nhạc nền lọt vào lượt đo chẳng hạn) nên không hạ quá tay.
 *
 * `locU` bật khi phải nâng nhiều: tiếng ù tần thấp luôn có sẵn trong phòng, và
 * nó lên theo đúng số decibel ta vừa nâng.
 */
export function canTieng(stats: TiengStats | null): CanTieng | null {
  if (!stats) return null;
  const lech = DICH_LUFS - stats.lufs;
  if (Math.abs(lech) < 1.5) return null;

  const gainDb = Math.max(-6, Math.min(12, lech));
  const lyDo: string[] = [];
  lyDo.push(
    gainDb > 0
      ? `giọng nhỏ hơn chuẩn ${Math.abs(lech).toFixed(0)} dB nên đã nâng lên`
      : `giọng to hơn chuẩn ${Math.abs(lech).toFixed(0)} dB nên đã hạ xuống`,
  );

  const locU = gainDb >= 4;
  if (locU) lyDo.push("cắt tiếng ù tần thấp của căn phòng");

  return { gainDb, locU, lyDo };
}

/**
 * Chuỗi lọc cho luồng giọng nói.
 *
 * Thứ tự: lọc ù TRƯỚC khi nâng — nâng trước thì ù lên theo rồi mới cắt, mà cắt
 * một tiếng đã to hơn thì phải cắt sâu hơn, và cắt sâu ăn luôn phần trầm của
 * giọng nam.
 *
 * `alimiter` đứng CUỐI và luôn có mặt khi nâng: đo là đo mức TRUNG BÌNH, còn
 * đỉnh của một câu nói mạnh có thể vượt xa mức ấy. Không chặn đỉnh thì chính
 * những chữ được nhấn mạnh nhất là chỗ vỡ tiếng.
 */
export function autoAudioFilter(can: CanTieng | null): string | null {
  if (!can) return null;
  const parts: string[] = [];
  // 80 Hz: dưới ngưỡng trầm nhất của giọng người (nam khoảng 85 Hz).
  if (can.locU) parts.push("highpass=f=80");
  parts.push(`volume=${can.gainDb.toFixed(2)}dB`);
  if (can.gainDb > 0) parts.push("alimiter=limit=0.95:level=disabled");
  return parts.join(",");
}
