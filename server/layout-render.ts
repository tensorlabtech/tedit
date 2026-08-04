import { findLayout, slotPixels, type LayoutKindId } from "./layout-kinds";
import { ffmpegColor, type StylePack } from "./style-pack";
import type { ScheduledScene } from "./timing";

/**
 * Dựng chuỗi lọc cho LỊCH MÀN — video vào ô, nền trang lộ ra quanh nó.
 *
 * ══ CÁCH DỰNG ══
 *
 * Bắt đầu từ NỀN TRANG chứ không từ khung hình. Rồi phủ video lên theo từng bố
 * cục, mỗi bố cục một lớp có `enable` riêng.
 *
 * Ngược lại — bắt đầu từ khung hình rồi phủ nền lên chỗ trống — thì phải khoét
 * một lỗ đúng hình cái ô, mà `overlay` không khoét được. Còn nếu vẽ nền đè lên
 * cả khung thì video biến mất.
 *
 * ══ VÌ SAO MỖI BỐ CỤC MỘT BẢN SAO ══
 *
 * Bố cục khác nhau thì ô khác khổ, khác mặt nạ — mà `scale` chỉ đổi khổ được
 * một lần cho cả luồng. Nên mỗi bố cục cần một bản video đã thu đúng khổ của
 * nó, rồi bật/tắt bằng `enable`.
 *
 * Giá phải trả: video bị thu N lần thay vì một. Đổi lại, không phải tính lại
 * mốc gì cả — mọi lớp chạy trên cùng một trục thời gian, và `enable` là thứ
 * ffmpeg làm rẻ nhất.
 *
 * Chỉ dựng bản sao cho bố cục THẬT SỰ có trong lịch. Bộ dáng khai bốn bố cục mà
 * phim ngắn chỉ dùng hai thì không dựng thừa hai luồng.
 */

export type LayoutPlan = {
  /** Các chuỗi lọc phải đẩy vào `filter_complex` trước khi ghép. */
  chains: string[];
  /**
   * Các lượt phủ, theo thứ tự. Nơi gọi nối chúng vào dòng chính.
   *
   * `x`/`y` là SỐ hoặc BIỂU THỨC: `overlay` tính lại vị trí ở từng khung hình,
   * nên ô nở dần cần mép trái lùi theo khổ hiện tại chứ không đứng một chỗ.
   */
  overlays: Array<{ label: string; x: number | string; y: number | string; enable: string }>;
  /** Nhãn của nền trang — dòng chính phải BẮT ĐẦU từ đây. */
  page: string | null;
};

/**
 * Phép cắt, dịch lên/xuống theo chỗ NGƯỜI đứng.
 *
 * Mặc định `crop` lấy giữa. Với nguồn dọc thu vào một ô thấp hơn thì "giữa" rơi
 * vào ngực, còn đầu bị xén — nên dịch khung cắt lên bằng đúng phần người lệch.
 * `clip` chặn dịch quá mép: dịch hết cỡ vẫn phải nằm trong khung đã thu.
 */
function cropExpr(box: { w: number; h: number }, shift: number): string {
  if (Math.abs(shift) < 0.005) return `crop=${box.w}:${box.h}`;
  const dy = Math.round(box.h * shift);
  // `\\,` chứ không phải `\,`: trong chuỗi mẫu của TS thì `\,` chỉ ra một dấu
  // phẩy trần, mà ffmpeg đọc dấu phẩy trần là hết bộ lọc — và lỗi hiện ra là
  // "No such filter: '0'", không hề nhắc tới phép cắt.
  const sign = dy < 0 ? "-" : "+";
  return `crop=${box.w}:${box.h}:(in_w-out_w)/2:` +
    `clip((in_h-out_h)/2${sign}${Math.abs(dy)}\\,0\\,in_h-out_h)`;
}

/** `between(...)+between(...)` — các khoảng không chồng nhau nên cộng là HOẶC. */
function windows(scenes: readonly ScheduledScene[]): string {
  return scenes
    .map((s) => `between(t\\,${s.start.toFixed(3)}\\,${s.end.toFixed(3)})`)
    .join("+");
}

/**
 * ĐỔI MÀN CÓ ĐÀ — ô nở dần vào chỗ thay vì bật ra trong một khung hình.
 *
 * ── ĐO ĐƯỢC GÌ ──
 *
 * Đo bước nhảy hình học giữa hai khung liền nhau trên bốn video: cứ chỗ nào ô
 * đổi khổ lớn thì mẫu đều rải ra nhiều khung với bước NHỎ DẦN —
 *
 *   focus  78px trong 6 khung   bước 78 · 27 · 20 · 15 · 10 · 6
 *   pulse  90px trong 3 khung   bước 90 · 65 · 24
 *   volt   79px trong 11 khung  bước 5 · 79 · 15 · 13 · 2 · 3 …
 *
 * Bản dựng của mình: cú đổi lớn nhất **98px gọn trong MỘT khung**. Đó chính là
 * chỗ "chưa mượt" — không phải màu, không phải nhịp, mà là chuyển màn không có
 * đà. Ô bật ra rồi đứng im ba giây.
 *
 * `focus` còn cho thấy hai chiều: 7·10·14·21·55 là nhanh DẦN lúc rời bố cục cũ,
 * còn 78·27·20·15·10·6 là chậm DẦN lúc vào bố cục mới. Ở đây làm nửa sau —
 * chậm dần lúc vào — vì nó là nửa người xem nhìn thấy rõ.
 *
 * ── LÀM BẰNG GÌ ──
 *
 * `scale` đọc biểu thức theo `t` khi bật `eval=frame` (chữ `t` thường; `T` viết
 * hoa là của `drawtext` và `scale` từ chối). Thử thật: ô nở đều suốt 12 khung,
 * mỗi khung 3–8px. Thử `zoompan` trên nền rgba thì đo ra **không đổi gì cả** —
 * nó nuốt mất phần trong suốt.
 *
 * Vì một lớp phủ gánh HẾT các màn cùng bố cục, biểu thức phải tự biết "màn đang
 * chạy bắt đầu lúc nào". Các khoảng không chồng nhau nên cộng lại là được.
 */
const RAMP = 0.2;
/** Chặn hai đầu hệ số xuất phát: từ toàn khung về ô nhỏ vẫn phải là một cú lướt. */
const K_MIN = 0.6;
const K_MAX = 1.8;

/** Màn này bắt đầu ở ĐÂU — hệ số so với khổ đích, và tâm cũ. */
export type SceneEntry = {
  scene: ScheduledScene;
  /** Khổ lúc t=0 chia khổ đích. 1 là không nở. */
  k0: number;
  /** Tâm ô lúc t=0, điểm ảnh. */
  cx0: number;
  cy0: number;
};

/**
 * Đường cong CHẬM DẦN của một màn: 0 lúc màn mở, 1 sau `RAMP` giây.
 *
 * `1-(1-p)³` — cùng hình dạng với bậc nhảy đo được ở `focus`
 * (78·27·20·15·10·6) và `pulse` (90·65·24): dịch nhiều nhất ở khung đầu rồi
 * nhỏ dần.
 */
function ease(s: ScheduledScene): string {
  const p = `min(1\\,(t-${s.start.toFixed(3)})/${RAMP})`;
  return `(1-pow(1-${p}\\,3))`;
}

/**
 * Nội suy một số từ giá trị LÚC MỞ MÀN về giá trị đích.
 *
 * Ngoài mọi màn thì trả về đúng giá trị đích — lớp phủ lúc ấy đang tắt, nhưng
 * `scale` vẫn chạy nên khổ phải hợp lệ.
 *
 * Viết dạng `đích + Σ trong-màn·(mở-màn − đích)·(1−đà)` chứ không viết dạng
 * `Σ trong-màn·(...)`: các khoảng màn không phủ kín trục thời gian, nên tổng
 * kiểu sau sẽ ra 0 ở khe giữa hai màn — và khổ 0 làm hỏng cả chuỗi lọc.
 */
/**
 * Màn này XUẤT PHÁT từ hình học của màn ngay trước nó.
 *
 * Bản đầu cho ô nở từ 0,82 của CHÍNH NÓ, và đo lại thì khung đầu vẫn nuốt 67%
 * cú đổi (65 trên 97px) — trong khi `pulse` chỉ nuốt 50% và `focus` 51%. Lý do:
 * quãng từ ô cũ xuống 0,82 ô mới vẫn là một cú nhảy tức thì, đà chỉ đắp vào
 * phần còn lại. Lấy đúng ô cũ làm điểm xuất phát thì không còn quãng nhảy nào.
 *
 * Màn đầu phim không có màn trước — cho nó nở từ 0,82 như cũ, vì lúc ấy thứ nó
 * rời khỏi là nền trang trống chứ không phải một ô.
 */
const FIRST_SCENE_K = 0.82;

function entryOf(
  scene: ScheduledScene,
  schedule: readonly ScheduledScene[],
  box: { x: number; y: number; w: number; h: number },
  frameWidth: number,
  frameHeight: number,
  sourceAspect?: number,
): SceneEntry {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const index = schedule.indexOf(scene);
  const prev = index > 0 ? schedule[index - 1] : null;
  if (!prev) return { scene, k0: FIRST_SCENE_K, cx0: cx, cy0: cy };
  // Ô CHÍNH của bố cục trước — đó là thứ mắt đang bám khi màn đổi. Bố cục không
  // có ô nào (`trang-chu`) thì coi như xuất phát từ giữa khung.
  const lead = findLayout(prev.layout).slots.find((s) => s.role === "chinh");
  if (!lead) return { scene, k0: FIRST_SCENE_K, cx0: frameWidth / 2, cy0: frameHeight / 2 };
  const old = slotPixels(lead, frameWidth, frameHeight, sourceAspect);
  const k0 = Math.min(K_MAX, Math.max(K_MIN, Math.sqrt((old.w * old.h) / (box.w * box.h))));
  return { scene, k0, cx0: old.x + old.w / 2, cy0: old.y + old.h / 2 };
}

function glide(entries: readonly SceneEntry[], target: number, from: (e: SceneEntry) => number): string {
  const terms = entries
    .map((e) => {
      const delta = from(e) - target;
      if (Math.abs(delta) < 0.5) return null;
      const win = `between(t\\,${e.scene.start.toFixed(3)}\\,${e.scene.end.toFixed(3)})`;
      return `${win}*${delta.toFixed(1)}*(1-${ease(e.scene)})`;
    })
    .filter((term): term is string => term !== null);
  return terms.length === 0
    ? target.toFixed(1)
    : `(${target.toFixed(1)}+${terms.join("+")})`;
}

export function layoutPlan(
  pack: Pick<StylePack, "page" | "layouts">,
  schedule: readonly ScheduledScene[],
  /** Nhãn luồng hình nguồn — nơi gọi đã `split` sẵn cho đủ số bản. */
  sources: readonly string[],
  /** Thư mục PNG. Tệp này chạy ở máy chủ nên nhận đường dẫn từ nơi gọi. */
  pngDir: string,
  frameWidth: number,
  frameHeight: number,
  /**
   * ĐƯỜNG DẪN tệp tư liệu cho ô `phu`. `null` là dự án chưa có tư liệu.
   *
   * Đường dẫn chứ không phải nhãn luồng: nạp bằng `movie=` thì không thêm một
   * `-i` nào, mà mọi nhãn `[N:v]` trong đồ thị này đánh theo SỐ TƯ LIỆU CHÈN —
   * thêm một đầu vào là dịch hết chúng đi một bậc, và lỗi ấy chỉ lộ ra ở dự án
   * CÓ tư liệu chèn.
   */
  insertPath: string | null = null,
  /**
   * Độ dài phim, giây. BẮT BUỘC khi có nền trang.
   *
   * Nguồn `color` không khai độ dài là một luồng VÔ HẠN. Mọi chỗ khác trong hệ
   * này dùng `color` làm lớp PHỦ nên luồng hình quyết định lúc dừng — ở đây nền
   * trang lại là luồng NỀN của `overlay`, nên nó quyết định, và lượt dựng chạy
   * mãi không dứt. Đo thật: treo quá năm phút cho một đoạn 10 giây.
   */
  seconds = 0,
  /**
   * Tỉ lệ video nguồn (rộng/cao). Ô bám tỉ lệ này để phép cắt không bỏ gì.
   *
   * Thiếu thì rơi về tỉ lệ khung — an toàn nhưng mất đúng cái lợi: ô ngang trên
   * nguồn dọc bỏ 52% chiều cao.
   */
  sourceAspect?: number,
  /**
   * Người đứng lệch bao nhiêu theo CHIỀU DỌC, tỉ lệ khung nguồn.
   *
   * Đo được trên một bản: đỉnh đầu ở 0,35 còn trọng tâm người ở 0,755 — cắt
   * giữa thì ô ôm đầy trần nhà và cắt ngang ngực. Dịch phép cắt lên theo số này
   * thì ô ôm mặt.
   */
  subjectShift = 0,
): LayoutPlan {
  const chains: string[] = [];
  const overlays: LayoutPlan["overlays"] = [];

  const used = [...new Set(schedule.map((s) => s.layout))] as LayoutKindId[];
  if (used.length === 0) return { chains, overlays, page: null };

  /*
   * Nền trang dựng bằng `color` chứ không bằng `drawbox` trên khung hình: dòng
   * chính phải BẮT ĐẦU từ nền, còn `drawbox` thì vẽ lên một thứ đã có.
   */
  let page: string | null = null;
  if (pack.page) {
    page = "[pgbase]";
    const span = seconds > 0 ? `:d=${seconds.toFixed(3)}` : "";
    chains.push(
      `color=c=${ffmpegColor(pack.page.tone)}:s=${frameWidth}x${frameHeight}${span}[pgcol]`,
    );
    if (pack.page.grid) {
      const g = pack.page.grid;
      chains.push(
        `movie=${pngDir}/${g.id}.png,alphaextract[pgm];` +
          `color=c=${g.tone.color}:s=${frameWidth}x${frameHeight}${span}[pgc];` +
          `[pgc][pgm]alphamerge,colorchannelmixer=aa=${g.tone.alpha.toFixed(3)}[pggrid]`,
      );
      chains.push(`[pgcol][pggrid]overlay=0:0[pgbase]`);
    } else {
      chains.push(`[pgcol]null[pgbase]`);
    }
  }

  used.forEach((id, index) => {
    const spec = findLayout(id);
    const scenes = schedule.filter((s) => s.layout === id);
    const source = sources[index];
    if (!source) return;

    if (spec.slots.length === 0) {
      // `trang-chu` — không có ô nào, nền trang tự nó là cả khung. Không phủ gì.
      return;
    }

    spec.slots.forEach((slot, at) => {
      const tagBase = `ly${index}s${at}`;
      /*
       * Ô `phu` lặp tệp tư liệu cho đủ độ dài phim.
       *
       * Tư liệu thường ngắn hơn phim nhiều (đo trong kho mẫu: 2,6–10,3 giây cho
       * một phim hai phút). Không lặp thì ô tắt ngóm giữa chừng và để lộ nền —
       * mà `enable` vẫn đang bật, nên nhìn ra là lỗi vẽ chứ không ra là hết tư
       * liệu.
       */
      const from = slot.role === "phu"
        ? (insertPath ? `movie=${insertPath}:loop=0,setpts=N/FRAME_RATE/TB[${tagBase}src];[${tagBase}src]` : null)
        : source;
      // Ô `phu` mà chưa có tư liệu thì BỎ, không dựng một ô đen: một khoảng
      // trống có viền đọc ra là lỗi vẽ, còn thiếu hẳn thì chỉ là bố cục gọn hơn.
      if (!from) return;
      const box = slotPixels(slot, frameWidth, frameHeight, sourceAspect);
      const tag = tagBase;
      const crop = cropExpr(box, slot.role === "chinh" ? subjectShift : 0);
      const fit = `scale=${box.w}:${box.h}:force_original_aspect_ratio=increase,${crop}`;
      const masked = slot.mask
        ? `movie=${pngDir}/${slot.mask}.png,alphaextract,scale=${box.w}:${box.h}[${tag}m];` +
          `${from}${fit},format=rgba[${tag}v];` +
          `[${tag}v][${tag}m]alphamerge[${tag}c]`
        : `${from}${fit}[${tag}c]`;
      /*
       * Phóng SAU khi ghép mặt nạ, không phải trước.
       *
       * Mặt nạ là một tệp PNG một khung — `t` của nó đứng yên ở 0, nên nếu cho
       * nó `eval=frame` thì nó giữ nguyên khổ trong khi video co lại, và
       * `alphamerge` từ chối hai đầu vào khác khổ. Ghép trước rồi phóng cả khối
       * rgba thì mặt nạ tự đi theo.
       *
       * Chỉ nở khi có NỀN TRANG. Không có nền thì lớp dưới là chính khung hình
       * gốc, và một ô co lại sẽ để lộ khung hình ấy quanh mép — đọc ra là lỗi
       * chồng hình chứ không ra là chuyển cảnh.
       */
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      const ramp = page !== null;
      if (ramp) {
        const entries = scenes.map((scene) => entryOf(scene, schedule, box, frameWidth, frameHeight, sourceAspect));
        const w = glide(entries, box.w, (e) => box.w * e.k0);
        const h = glide(entries, box.h, (e) => box.h * e.k0);
        chains.push(
          `${masked};[${tag}c]scale=w='2*floor((${w})/2)':h='2*floor((${h})/2)':eval=frame[${tag}]`,
        );
        overlays.push({
          label: `[${tag}]`,
          // Tâm cũng lướt: đổi bố cục là ô vừa đổi khổ vừa đổi CHỖ, và chỉ nắn
          // khổ mà để chỗ nhảy thì cú nhảy vẫn còn nguyên, chỉ nhỏ hơn.
          x: `${glide(entries, cx, (e) => e.cx0)}-w/2`,
          y: `${glide(entries, cy, (e) => e.cy0)}-h/2`,
          enable: windows(scenes),
        });
      } else {
        chains.push(`${masked};[${tag}c]null[${tag}]`);
        overlays.push({ label: `[${tag}]`, x: box.x, y: box.y, enable: windows(scenes) });
      }
    });
  });

  return { chains, overlays, page };
}

/** Bao nhiêu bản sao luồng hình cần `split` — đúng số bố cục có trong lịch. */
export function sourceCount(schedule: readonly ScheduledScene[]): number {
  return new Set(schedule.map((s) => s.layout)).size;
}
