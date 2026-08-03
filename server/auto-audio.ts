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
  /**
   * Mức lúc KHÔNG ai nói — phân vị 10 của mức tức thời, LUFS.
   *
   * `null` khi không đủ mẫu.
   */
  nen: number | null;
  /** Mức lúc ĐANG nói — phân vị 90 của mức tức thời, LUFS. `null` như trên. */
  giong: number | null;
};

/**
 * Mức mà `ebur128` in ra cho một cửa sổ IM TUYỆT ĐỐI, chừng −120,7.
 *
 * Bỏ những cửa sổ ấy trước khi tính phân vị. Chúng không phải tiếng phòng — đó
 * là chỗ máy quay tắt hẳn, và ở đó không có gì để khử. Để lại thì một tệp có
 * nhiều đoạn tắt máy sẽ ra "nền" bằng âm vô cực, và mọi phép so sánh sau đó vô
 * nghĩa.
 *
 * Đây cũng là lý do KHÔNG dùng `astats`: trường `Noise floor` của nó ra thẳng
 * `-inf` khi tệp có dù chỉ một mẫu im tuyệt đối — đo bảy trên chín tệp thật
 * trong `server/data` đều thế.
 */
const IM_TUYET_DOI = -70;

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
      // giây là chừng 150 dòng, thừa sức nằm trong bộ đệm bên dưới. Những dòng ấy
      // KHÔNG còn là rác nữa: phép đo nền bên dưới đọc thẳng từ chúng.
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
    /*
     * Nền và giọng đọc từ CÁC DÒNG NHẬT KÝ, không đọc từ khối tóm tắt.
     *
     * `M:` là mức tức thời của một cửa sổ 400 ms. Xếp cả loạt lại rồi lấy phân
     * vị: phân vị 10 rơi vào lúc không ai nói, phân vị 90 rơi vào lúc đang nói.
     * Hiệu hai số là khoảng cách giọng–nền, và đó mới là thứ nói lên bản ghi
     * bẩn hay sạch — mức tổng thì không, một bản thu to vẫn có thể đầy tiếng ù.
     *
     * Cắt bỏ phần tóm tắt trước khi dò: nó không chứa `M:` ở bản ffmpeg hiện
     * thời, nhưng nhãn trong khối ấy vốn hay đổi giữa các bản, mà một con số lạ
     * lọt vào giữa loạt mẫu thì kéo lệch phân vị mà không lỗi ở đâu cả.
     */
    const nhatKy = raw.slice(0, Math.max(0, raw.lastIndexOf("Integrated loudness:")));
    const mucTucThoi = [...nhatKy.matchAll(/M:\s*(-?[\d.]+)/g)]
      .map((m) => Number(m[1]))
      .filter((v) => Number.isFinite(v) && v > IM_TUYET_DOI)
      .sort((a, b) => a - b);
    /*
     * Dưới ba mươi mẫu — tức chưa tới ba giây có tiếng — thì không kết luận.
     * Phân vị của một nắm mẫu là con số của riêng nắm ấy, mà quyết định dựa vào
     * nó lại tác động lên cả video.
     */
    const duMau = mucTucThoi.length >= 30;
    const phanVi = (p: number) => mucTucThoi[Math.min(mucTucThoi.length - 1, Math.floor(mucTucThoi.length * p))];
    return {
      lufs,
      peak: Number.isFinite(peak) ? peak : -1,
      nen: duMau ? phanVi(0.1) : null,
      giong: duMau ? phanVi(0.9) : null,
    };
  } catch {
    return null;
  }
}

export type CanTieng = {
  /** Số decibel cần nâng. Âm là hạ. */
  gainDb: number;
  /** Cắt tần thấp — tiếng điều hoà, gió, rung bàn. */
  locU: boolean;
  /**
   * Khử tiếng nền. `null` khi không khử.
   *
   * Hai số đi thành một cụm chứ không thành hai ô rời: `afftdn` khử theo `nrDb`
   * nhưng nó khử quanh MỨC NỀN mà ta khai, và khai sai mức thì mức khử thành vô
   * nghĩa. Đo thật trên một bản: cùng nr=12, để mặc định được 16,4 dB cách biệt,
   * khai đúng nền đo được thì lên 20,6. Tách rời hai ô là mở đường cho ai đó
   * chỉnh một ô rồi quên ô kia.
   */
  khuNhieu: { nrDb: number; nenDb: number } | null;
  lyDo: string[];
};

/**
 * Dưới ngần này decibel cách biệt giữa giọng và nền thì tai nghe ra tiếng ù.
 *
 * Bản ghi phòng thu cách nhau 30–40 dB, bản ghi điện thoại tử tế chừng 25. Đo
 * một bản thật trong `server/data`: nền −43,9 dB, giọng −30,1 dB — cách 13,8 dB,
 * và nghe rõ tiếng phòng phía sau.
 *
 * Ngưỡng đặt ở 20 chứ không ở 14: chỗ 14 kia đã là "hỏng rõ", còn thứ ta muốn
 * bắt là chỗ mới "hơi bẩn". Trên 20 thì khử nhiễu chỉ còn lấy đi phụ âm chứ
 * không lấy được gì thêm.
 */
const NGUONG_CACH_BIET = 20;

/**
 * Dưới ngần này thì KHÔNG khử — không phải vì sạch, mà vì không có giọng.
 *
 * Đo chín tệp thật: bảy tệp cách 25–35 dB (sạch), một tệp 19,3 dB (bẩn thật),
 * và một tệp 1,2 dB. Tệp cuối không phải bản ghi bẩn — cả đoạn nằm gọn trong
 * một dải 1,2 dB, tức một tiếng nền đều đều chứ không phải người nói, vì giọng
 * người thì lúc to lúc nhỏ. Đó là đoạn hình chèn không lời.
 *
 * Khử nhiễu một đoạn như thế là lấy đi thứ duy nhất nó có.
 */
const NGUONG_DAY = 6;

/**
 * Cộng thêm ngần này vào nền đo được để ra `nf` cho `afftdn`.
 *
 * `nf` của `afftdn` là NGƯỠNG chứ không phải một mức: khai đúng bằng nền đo
 * được thì bộ lọc chỉ đụng tới phần nằm hẳn dưới nền, mà phần ấy gần như không
 * có gì. Đo trên các quãng nghỉ thật giữa câu của một bản: khai đúng nền thì
 * quãng nghỉ bớt 3,1 dB; khai cao hơn mười decibel thì bớt 8,1 dB, còn dải phụ
 * âm 2,5–5 kHz chỉ mất thêm 0,3 dB.
 *
 * Không đẩy cao hơn nữa: đo tiếp ở mười lăm decibel thì tiếng nền còn dao động
 * mạnh hơn giữa các cửa sổ 50 ms — đó là tiếng "óc ách" do chính bộ lọc đẻ ra.
 */
const BU_NEN = 10;

/**
 * Mức khử cố định, KHÔNG co giãn theo độ bẩn.
 *
 * Đo bốn mức trên bản nói trên: nr=6 được +4,5 dB, nr=12 được +6,8 dB, nr=20
 * chỉ thêm 1,6 dB nữa. Đường cong phẳng dần, còn nhiễu ĐIỆN TỬ do chính bộ lọc
 * đẻ ra — tiếng "óc ách" như dưới nước — thì tăng đều. 12 là chỗ hết lãi.
 *
 * Bản càng bẩn càng khử mạnh nghe thì hợp lý, nhưng bản bẩn nhất cũng chính là
 * bản mà khử mạnh vỡ tiếng nặng nhất: nền cao nghĩa là micro ở xa, mà ở xa thì
 * phụ âm đã yếu sẵn.
 */
const KHU_NHIEU_DB = 12;

/** Dải `nf` mà `afftdn` nhận. Ngoài dải này ffmpeg bỏ cả bộ lọc. */
const NEN_MIN = -80;
const NEN_MAX = -20;

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

  /*
   * Cách biệt giọng–nền. `null` khi thiếu một trong hai số đo, và lúc ấy KHÔNG
   * khử: khử nhiễu mù là lấy đi phụ âm của một bản có thể vốn đã sạch.
   */
  const cachBiet = stats.nen !== null && stats.giong !== null ? stats.giong - stats.nen : null;
  const khuNhieu =
    cachBiet !== null && cachBiet >= NGUONG_DAY && cachBiet < NGUONG_CACH_BIET
      ? {
          nrDb: KHU_NHIEU_DB,
          nenDb: Math.max(NEN_MIN, Math.min(NEN_MAX, stats.nen! + BU_NEN)),
        }
      : null;

  const lech = DICH_LUFS - stats.lufs;
  /*
   * Mức đã đúng NHƯNG nền bẩn thì vẫn phải chạy — hai việc độc lập nhau. Trả
   * `null` ở đây là bỏ luôn phép khử của một bản thu to mà ù.
   */
  if (Math.abs(lech) < 1.5 && !khuNhieu) return null;

  const gainDb = Math.abs(lech) < 1.5 ? 0 : Math.max(-6, Math.min(12, lech));
  const lyDo: string[] = [];
  // Nói mức THẬT SỰ đã chỉnh, không nói mức lệch: hai số khác nhau khi bị chặn
  // bởi trần hay sàn, và lúc ấy dòng nhật ký báo "hạ 14 dB" trong khi máy chỉ hạ
  // 6 — người đọc đi tìm 8 dB không tồn tại.
  if (gainDb !== 0) {
    lyDo.push(
      gainDb > 0
        ? `giọng nhỏ hơn chuẩn nên đã nâng ${gainDb.toFixed(1)} dB`
        : `giọng to hơn chuẩn nên đã hạ ${Math.abs(gainDb).toFixed(1)} dB`,
    );
  }

  const locU = gainDb >= 4;
  if (locU) lyDo.push("cắt tiếng ù tần thấp của căn phòng");
  if (khuNhieu) {
    lyDo.push(`giọng chỉ hơn nền ${cachBiet!.toFixed(1)} dB nên đã khử tiếng nền`);
  }

  return { gainDb, locU, khuNhieu, lyDo };
}

/**
 * Chuỗi lọc cho luồng giọng nói.
 *
 * Thứ tự: lọc ù TRƯỚC khi nâng — nâng trước thì ù lên theo rồi mới cắt, mà cắt
 * một tiếng đã to hơn thì phải cắt sâu hơn, và cắt sâu ăn luôn phần trầm của
 * giọng nam.
 *
 * Khử nhiễu đứng ĐẦU, trước cả lọc ù. `afftdn` dựng hình nền từ chính tín hiệu
 * nó nhận; cho nó bản chưa ai đụng vào thì cái hình ấy khớp với căn phòng thật.
 * Cắt tần thấp trước rồi mới khử là bắt nó đoán nền từ một phổ đã thủng một
 * mảng, và nó bù vào chỗ thủng ấy bằng cách khử lấn sang giọng.
 *
 * `alimiter` đứng CUỐI và luôn có mặt khi nâng: đo là đo mức TRUNG BÌNH, còn
 * đỉnh của một câu nói mạnh có thể vượt xa mức ấy. Không chặn đỉnh thì chính
 * những chữ được nhấn mạnh nhất là chỗ vỡ tiếng.
 */
export function autoAudioFilter(can: CanTieng | null): string | null {
  if (!can) return null;
  const parts: string[] = [];
  if (can.khuNhieu) {
    parts.push(`afftdn=nr=${can.khuNhieu.nrDb}:nf=${can.khuNhieu.nenDb.toFixed(1)}`);
  }
  // 80 Hz: dưới ngưỡng trầm nhất của giọng người (nam khoảng 85 Hz).
  if (can.locU) parts.push("highpass=f=80");
  // Bỏ hẳn `volume` khi không đổi mức: `volume=0.00dB` vẫn là một lượt nhân
  // từng mẫu, và nó có mặt chỉ vì lượt này chạy để khử nhiễu.
  if (can.gainDb !== 0) parts.push(`volume=${can.gainDb.toFixed(2)}dB`);
  if (can.gainDb > 0) parts.push("alimiter=limit=0.95:level=disabled");
  return parts.length > 0 ? parts.join(",") : null;
}
