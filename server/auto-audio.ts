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
export async function measureAudio(path: string): Promise<TiengStats | null> {
  try {
    const { stderr } = await run(
      "ffmpeg",
      // KHÔNG đặt `framelog=quiet`: ffmpeg 5.1 (bản Debian 12 trên máy chủ) chỉ
      // nhận `info` và `verbose`, nên `quiet` làm cả bộ lọc không chạy — và nó
      // không chạy một cách IM LẶNG. Số đo ra 0,0 LUFS, tức "to hơn chuẩn 14 dB",
      // nên mọi video trên máy chủ đều bị hạ tiếng một cách vô cớ. Máy phát triển
      // dùng ffmpeg mới hơn nên không bao giờ lộ ra.
      //
      // Bỏ tham số ấy thì ebur128 in thêm một dòng mỗi phần mười giây — mười lăm
      // giây là chừng 150 dòng, thừa sức nằm trong bộ đệm bên dưới.
      ["-hide_banner", "-nostats", "-t", "15", "-i", path,
       "-af", "ebur128=peak=true", "-f", "null", "-"],
      { timeout: 90_000, maxBuffer: 8 * 1024 * 1024 },
    ).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));

    const raw = String(stderr);
    /*
     * Đọc từ khối TÓM TẮT ở cuối, không đọc từ cả chuỗi.
     *
     * Không cắt lấy phần tóm tắt thì `I:` khớp ngay dòng frame log đầu tiên — đó
     * là số đo tức thời của một phần mười giây đầu video, thường là quãng im
     * trước khi người ta kịp nói.
     */
    const summary = raw.slice(raw.lastIndexOf("Integrated loudness:"));
    const soSau = (label: string) => {
      const m = new RegExp(`${label}:\\s*(-?[\\d.]+)`).exec(summary);
      return m ? Number(m[1]) : Number.NaN;
    };
    const lufs = soSau("I");
    if (!Number.isFinite(lufs)) return null;
    /*
     * Đúng 0,0 LUFS là dấu hiệu ĐO HỎNG, không phải một bản ghi to.
     *
     * Giọng nói thật không bao giờ chạm mức ấy — 0 LUFS là biên độ đầy khung,
     * tức đã vỡ tiếng từ lâu. Con số này ra khi bộ lọc không chạy được, và nếu
     * tin nó thì máy hạ tiếng hết cỡ trên một bản vốn đã nhỏ.
     */
    if (lufs === 0) return null;
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
export function levelAudio(stats: TiengStats | null): CanTieng | null {
  if (!stats) return null;
  const lech = DICH_LUFS - stats.lufs;
  if (Math.abs(lech) < 1.5) return null;

  const gainDb = Math.max(-6, Math.min(12, lech));
  const lyDo: string[] = [];
  // Nói mức THẬT SỰ đã chỉnh, không nói mức lệch: hai số khác nhau khi bị chặn
  // bởi trần hay sàn, và lúc ấy dòng nhật ký báo "hạ 14 dB" trong khi máy chỉ hạ
  // 6 — người đọc đi tìm 8 dB không tồn tại.
  lyDo.push(
    gainDb > 0
      ? `giọng nhỏ hơn chuẩn nên đã nâng ${gainDb.toFixed(1)} dB`
      : `giọng to hơn chuẩn nên đã hạ ${Math.abs(gainDb).toFixed(1)} dB`,
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
