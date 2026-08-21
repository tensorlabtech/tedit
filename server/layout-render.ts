import { findLayout, settleAspect, slotPixels, type LayoutKindId } from "./layout-kinds";
import { handmadeTiltAt } from "./handmade-tilt";
import { ffmpegColor, type FrameBlock } from "./style-pack";
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
 * Phép cắt — GIỮA cả hai chiều.
 *
 * ── VÌ SAO BỎ PHÉP DỊCH ──
 *
 * Bản trước dịch khung cắt theo `subjectShift`, tính từ dải NGANG rỗng người
 * nhất:
 *
 *   subjectShift = -max(0, 0,5 - dảiRỗngNhất/10) * 0,6
 *
 * Hai chỗ sai, và chúng cộng dồn:
 *
 * · **Sai chiều.** Đo mặt nạ người của một bản thật ở giây 60, mười dải từ trên
 *   xuống: 0 · 0 · 8 · 34 · 101 · 105 · 87 · 197 · 252 · 255. Dải rỗng nhất là
 *   dải 0, nên công thức ra −0,3 — đẩy khung cắt LÊN 30%, tức về đúng hai dải
 *   KHÔNG CÓ NGƯỜI NÀO. Nó chạy về phía chỗ trống thay vì tránh xa.
 * · **Một chiều.** `max(0, …)` khiến nó chỉ lên được, không bao giờ xuống. Dải
 *   rỗng nhất nằm dưới thì phép dịch im lặng thành 0.
 *
 * Mà cắt GIỮA lại đúng với chính số đo ấy: mặt nằm quanh dải 4–6, còn dải 7–9
 * bão hoà là thân người. Lấy trọng tâm khối người sẽ kéo xuống thân — tệ hơn cả
 * hai lối trên.
 *
 * Giờ ô đã bám tỉ lệ tư liệu nên phần bị cắt vốn đã nhỏ; giữa là chỗ an toàn
 * nhất, và là chỗ người xem đọc ra là "không lệch".
 */
function cropExpr(box: { w: number; h: number }): string {
  return `crop=${box.w}:${box.h}`;
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
export const RAMP = 0.2;
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
  if (s.layout === "broll-don") {
    // POP NẢY (easeOutBack): ảnh b-roll solo "thả" xuống trang — vọt QUÁ khổ đích
    // rồi dội về, như dán ảnh tay. Chỉ cảnh b-roll một mình; ô người vẫn chậm dần
    // êm (không nảy). 2.70158/1.70158 là hằng chuẩn của easeOutBack (~9% overshoot).
    return `(1+2.70158*pow(${p}-1\\,3)+1.70158*pow(${p}-1\\,2))`;
  }
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

export function entryOf(
  scene: ScheduledScene,
  schedule: readonly ScheduledScene[],
  box: { x: number; y: number; w: number; h: number },
  frameWidth: number,
  frameHeight: number,
  sourceAspect?: number,
): SceneEntry {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  // B-ROLL SOLO POP: xuất phát NHỎ ngay tại chỗ nó (không morph từ ô người), để
  // cùng đường cong nảy (`ease`) thành cú "thả ảnh xuống trang" — lớn bật ra rồi
  // dội về. Không lướt vị trí (tâm = đích) nên chỉ phóng, không trượt.
  if (scene.layout === "broll-don") return { scene, k0: 0.55, cx0: cx, cy0: cy };
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

/**
 * MÁY QUAY DỒN VÀO — hệ số nhân thêm, lớn dần suốt màn.
 *
 * Nhân vào chính phép phóng đang có chứ không thêm một bộ lọc nữa: `scale` với
 * `eval=frame` đã dựng lại bộ phóng ở từng khung rồi, thêm cái thứ hai là trả
 * giá ấy hai lần cho một kết quả nhân được bằng tay.
 *
 * Chặn trần: dồn 6%/giây suốt một màn 15 giây là 90%, tức mất gần nửa khung.
 * Kho mẫu không có cú dồn nào quá 12% cho cả một màn.
 */
export const PUSH_MAX = 0.12;

function pushFactor(entries: readonly SceneEntry[], defaultRate: number): string {
  // Nhịp dồn máy quay đọc theo TỪNG cảnh: mỗi cảnh mang look Ô riêng nên tốc độ
  // dồn cũng của chính nó (`scene.frameBlock.scenePush`), không phải một tốc độ
  // chung. Cảnh chưa có block → `defaultRate`. Mọi block bằng nhau thì biểu thức
  // ra y hệt bản một-tốc-độ cũ.
  const terms = entries
    .filter((e) => e.scene.push)
    .map((e) => {
      // Cùng lẽ với viền: cảnh có block thì tốc độ dồn là của CHÍNH block (null =
      // 0 = không dồn), không mượn tốc độ preset dự án; chỉ cảnh chưa có block mới
      // dùng `defaultRate`.
      const rate = e.scene.frameBlock
        ? (e.scene.frameBlock.scenePush?.ratePerSecond ?? 0)
        : defaultRate;
      if (rate <= 0) return null;
      const win = `between(t\\,${e.scene.start.toFixed(3)}\\,${e.scene.end.toFixed(3)})`;
      const grown = `min(${PUSH_MAX}\\,${rate}*(t-${e.scene.start.toFixed(3)}))`;
      return `${win}*${grown}`;
    })
    .filter((term): term is string => term !== null);
  return terms.length === 0 ? "" : `*(1+${terms.join("+")})`;
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
  /**
   * Look Ô đã đóng dấu trên element (nền/viền/dồn) — đọc thẳng từ block, không
   * còn tra bộ dáng toàn-cục. Sau khi mọi element mang block riêng, mỗi cảnh dùng
   * đúng look của nó.
   */
  frame: FrameBlock,
  schedule: readonly ScheduledScene[],
  /** Nhãn luồng hình nguồn — nơi gọi đã `split` sẵn cho đủ số bản. */
  sources: readonly string[],
  /** Thư mục PNG. Tệp này chạy ở máy chủ nên nhận đường dẫn từ nơi gọi. */
  pngDir: string,
  frameWidth: number,
  frameHeight: number,
  /**
   * ĐƯỜNG DẪN các tệp tư liệu cho ô `phu`. Rỗng là dự án chưa có tư liệu.
   *
   * Đường dẫn chứ không phải nhãn luồng: nạp bằng `movie=` thì không thêm một
   * `-i` nào, mà mọi nhãn `[N:v]` trong đồ thị này đánh theo SỐ TƯ LIỆU CHÈN —
   * thêm một đầu vào là dịch hết chúng đi một bậc, và lỗi ấy chỉ lộ ra ở dự án
   * CÓ tư liệu chèn.
   *
   * DANH SÁCH chứ không phải một tệp: bản trước chỉ lấy tệp đầu, nên cả ba bố
   * cục b-roll khác hình dạng đều đựng chung một ảnh suốt phim.
   */
  insertPaths: readonly string[] = [],
  /**
   * Tỉ lệ (rộng/cao) của từng tệp tư liệu, cùng thứ tự với `insertPaths`.
   *
   * Ô phụ đo theo số này chứ không theo tỉ lệ video CHÍNH: hai thứ khác nhau,
   * và dùng nhầm thì tư liệu dọc bị nhét vào ô ngang.
   */
  insertAspects: readonly number[] = [],
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
): LayoutPlan {
  const chains: string[] = [];
  const overlays: LayoutPlan["overlays"] = [];

  const used = [...new Set(schedule.map((s) => s.layout))] as LayoutKindId[];
  if (used.length === 0) return { chains, overlays, page: null };

  /*
   * Nền trang dựng bằng `color` chứ không bằng `drawbox` trên khung hình: dòng
   * chính phải BẮT ĐẦU từ nền, còn `drawbox` thì vẽ lên một thứ đã có.
   *
   * NỀN THEO TỪNG CẢNH: mỗi element mang look ô riêng (`frameBlock`), nên nền có
   * thể KHÁC nhau giữa các cảnh (b-roll nền vàng cạnh b-roll nền đen trong cùng
   * phim). Dựng một nền NỀN (base) rồi ĐÈ nền của cảnh nào KHÁC base lên đúng cửa
   * sổ cảnh ấy. Mọi cảnh trùng base (ca phổ biến) → không đè lớp nào → y hệt nền
   * đơn cũ.
   */
  const span = seconds > 0 ? `:d=${seconds.toFixed(3)}` : "";
  type PageCfg = NonNullable<FrameBlock["page"]>;
  /** Dựng một lớp NỀN đầy khung (màu + lưới/hạt-giấy). Trả nhãn luồng. */
  const buildPageFill = (pg: PageCfg, sfx: string): string => {
    const out = `[pgfill_${sfx}]`;
    chains.push(
      `color=c=${ffmpegColor(pg.tone)}:s=${frameWidth}x${frameHeight}${span}[pgcol_${sfx}]`,
    );
    if (pg.grid) {
      const g = pg.grid;
      chains.push(
        `movie=${pngDir}/${g.id}.png,alphaextract[pgm_${sfx}];` +
          `color=c=${g.tone.color}:s=${frameWidth}x${frameHeight}${span}[pgc_${sfx}];` +
          `[pgc_${sfx}][pgm_${sfx}]alphamerge,colorchannelmixer=aa=${g.tone.alpha.toFixed(3)}[pggrid_${sfx}]`,
      );
      chains.push(`[pgcol_${sfx}][pggrid_${sfx}]overlay=0:0${out}`);
    } else {
      // HẠT GIẤY: đốm ấm mờ rải trên nền cho trang scrapbook đỡ phẳng lì — chỉ
      // hiện rõ trên nền SÁNG (trang giấy Phấn); trên nền tối gần như vô hình.
      // Dùng đúng cơ chế lưới (overlay đơn-khung) nên an toàn với độ dài phim.
      chains.push(
        `movie=${pngDir}/../../masks/paper-grain.png,alphaextract[ppm_${sfx}];` +
          `color=c=#8A7A4E:s=${frameWidth}x${frameHeight}${span}[ppc_${sfx}];` +
          `[ppc_${sfx}][ppm_${sfx}]alphamerge,colorchannelmixer=aa=0.28[pptex_${sfx}];` +
          `[pgcol_${sfx}][pptex_${sfx}]overlay=0:0${out}`,
      );
    }
    return out;
  };
  /** Hai nền GIỐNG nhau (màu + lưới) → không cần đè lớp riêng. */
  const samePage = (a: PageCfg, b: PageCfg): boolean =>
    a.tone.color === b.tone.color &&
    a.tone.alpha === b.tone.alpha &&
    ((!a.grid && !b.grid) ||
      (!!a.grid &&
        !!b.grid &&
        a.grid.id === b.grid.id &&
        a.grid.tone.color === b.grid.tone.color &&
        a.grid.tone.alpha === b.grid.tone.alpha));

  let page: string | null = null;
  if (frame.page) {
    const basePage = frame.page;
    page = buildPageFill(basePage, "base");
    // Đè nền RIÊNG cho cảnh nào có look ô khác base — bật đúng cửa sổ cảnh.
    schedule.forEach((scene, i) => {
      const sp = scene.frameBlock?.page;
      if (!sp || samePage(sp, basePage)) return;
      const fill = buildPageFill(sp, `ov${i}`);
      const next = `[pgov${i}]`;
      chains.push(`${page}${fill}overlay=0:0:enable='${windows([scene])}'${next}`);
      page = next;
    });
  }

  let sourceIdx = 0;
  used.forEach((id, index) => {
    /*
     * KHÔNG áp `LayoutOptions` ở đây, và đó là giới hạn có ý thức của đường vẽ này.
     *
     * Chỗ này gom mọi cảnh CÙNG một mã bố cục vào một nhánh lọc dùng chung, nên
     * hai cảnh cùng mã mà khác tuỳ chọn (một ô vuông, một ô ngang) sẽ không tách
     * ra được — muốn đúng thì phải gom theo "mã + tuỳ chọn", tức dựng lại cả cách
     * chia nhánh.
     *
     * Không làm vì bản xuất thật đã do Remotion dựng (`renderMedia`); đường ffmpeg
     * này còn lại cho `dev-render-frame` và phép kiểm hình học. Ghi ra đây để lần
     * sau ai đọc còn biết nó CỐ Ý thiếu, không phải bị quên.
     */
    const spec = findLayout(id);
    const scenes = schedule.filter((s) => s.layout === id);
    // CHỈ layout có ô NGƯỜI (`chinh`) mới tiêu thụ một luồng video gốc (`lysrc`);
    // layout chỉ b-roll (`broll-don`) dùng tệp CHÈN nên KHÔNG lấy `lysrc`. Cấp
    // nhầm thì `split` thừa một nhánh không nối và ffmpeg từ chối cả graph. Đếm
    // theo bộ đếm RIÊNG (không phải `index`) để khớp đúng số nhánh `split`.
    const hasChinh = spec.slots.some((sl) => sl.role === "chinh");
    const source = hasChinh ? (sources[sourceIdx++] ?? null) : null;
    if (hasChinh && !source) return;

    if (spec.slots.length === 0) {
      // `trang-chu` — không có ô nào, nền trang tự nó là cả khung. Không phủ gì.
      return;
    }

    // Vẽ theo Z: ô z thấp nằm DƯỚI, z cao vẽ SAU nên nằm TRÊN. B-roll (`phu`) khai
    // z cao hơn ô người nên đè lên — chỗ đè là thân/vai người, b-roll không bị cắt.
    [...spec.slots]
      .sort((a, b) => a.z - b.z)
      .forEach((slot, at) => {
      /*
       * Ô `phu` dựng MỘT LỚP CHO MỖI TƯ LIỆU, không một lớp cho cả bố cục.
       *
       * `movie=` nạp một tệp cố định, còn tệp thì đổi theo màn — nên muốn mỗi
       * lần chèn một tư liệu khác thì phải có bấy nhiêu lớp, mỗi lớp bật ở đúng
       * những màn dùng tệp ấy. Đây cũng là lối đã dùng cho bố cục: bật/tắt bằng
       * `enable` rẻ hơn mọi cách chuyển nguồn giữa chừng.
       */
      type EdgeCfg = FrameBlock["subjectEdge"];
      const edgeKey = (e: EdgeCfg): string =>
        e ? `${e.tone.color}/${e.tone.alpha}/${e.steps}` : "none";
      const groups: Array<{
        scenes: ScheduledScene[];
        path: string | null;
        suffix: string;
        which: number;
        edge: EdgeCfg;
      }> =
        slot.role === "phu"
          ? // CHỈ màn CÓ tư liệu (`insert` xác định) mới dựng ô phụ. Gom theo (TƯ
            // LIỆU × VIỀN): hai cảnh cùng tệp NHƯNG khác màu viền (look ô riêng của
            // từng cảnh) phải ra HAI lớp cell — viền nướng trong cell nên phải bấy
            // nhiêu cell mới có bấy nhiêu màu. Cảnh trùng cả hai → chung một cell.
            (() => {
              const combos = new Map<
                string,
                { which: number; edge: EdgeCfg; scenes: ScheduledScene[] }
              >();
              for (const s of scenes) {
                if (s.insert === undefined) continue;
                const which = s.insert as number;
                // Look ô đi THEO block: cảnh đã có `frameBlock` thì đọc thẳng
                // `subjectEdge` của nó — kể cả `null` (khung không viền, vd Nhịp
                // đen) phải ra KHÔNG viền, KHÔNG được mượn lại viền của preset gốc
                // dự án. Chỉ cảnh CHƯA đóng dấu block mới rơi về `frame` nền.
                const edge = (s.frameBlock ?? frame).subjectEdge;
                const key = `${which}|${edgeKey(edge)}`;
                const g = combos.get(key);
                if (g) g.scenes.push(s);
                else combos.set(key, { which, edge, scenes: [s] });
              }
              // Xếp theo `which` (rồi thứ tự gặp) — cùng thứ tự lớp với bản một-viền
              // cũ khi mọi viền BẰNG NHAU, nên đầu ra không đổi ở ca phổ biến.
              return [...combos.values()]
                .sort((a, b) => a.which - b.which)
                .map((g, eIdx) => ({
                  scenes: g.scenes,
                  // Chỉ số ngoài mảng thì QUAY VÒNG về 0, không ra ô trống lặng lẽ.
                  path: insertPaths[g.which % Math.max(1, insertPaths.length)] ?? null,
                  suffix: `i${g.which}e${eIdx}`,
                  which: g.which,
                  edge: g.edge,
                }));
            })()
          : [{ scenes, path: null, suffix: "", which: 0, edge: frame.subjectEdge }];

      groups.forEach((group) =>
        buildSlot(slot, at, group.scenes, group.path, group.suffix, group.which, group.edge),
      );
    });

    function buildSlot(
      slot: (typeof spec.slots)[number],
      at: number,
      scenes: readonly ScheduledScene[],
      insertPath: string | null,
      suffix: string,
      which: number,
      /** Viền của CHÍNH nhóm cảnh này — look ô đi theo block từng cảnh, không chung. */
      edgeCfg: FrameBlock["subjectEdge"],
    ) {
      const tagBase = `ly${index}s${at}${suffix}`;
      /*
       * Ô `phu` lặp tệp tư liệu cho đủ độ dài phim.
       *
       * Tư liệu thường ngắn hơn phim nhiều (đo trong kho mẫu: 2,6–10,3 giây cho
       * một phim hai phút). Không lặp thì ô tắt ngóm giữa chừng và để lộ nền —
       * mà `enable` vẫn đang bật, nên nhìn ra là lỗi vẽ chứ không ra là hết tư
       * liệu.
       *
       * ẢNH TĨNH đi đường riêng — KHÔNG qua `movie=...loop=0` (lặp vô hạn).
       *
       * `loop=0` của bộ lọc `movie` là "lặp vô hạn", không phải "không lặp" —
       * và với một tệp CHỈ MỘT khung, mỗi vòng lặp là ffmpeg NẠP LẠI tệp từ đầu
       * (mở lại, giải mã lại), không phải phát lại một khung đã có sẵn. Đo
       * thật: một ô phụ mang một tệp JPG duy nhất, ghép cùng bốn ô người, biến
       * một lượt lọc 5 giây từ 1,7 giây thành hơn 90 giây không xong — trong
       * khi BA ô phụ mang MP4 (nhiều khung, một vòng lặp không phải nạp lại
       * liên tục) vẫn chạy ở 2,6 giây. Ảnh tĩnh mới là thủ phạm, không phải số
       * lượng ô hay độ phức tạp biểu thức.
       *
       * Sửa bằng đúng cách `buildBase` đã dùng để kéo dài một luồng ngắn
       * (`tpad=stop_mode=clone`, dòng ~226): giải mã tệp ảnh MỘT LẦN
       * (`loop=1`), rồi NHÂN BẢN khung đã giải mã cho đủ độ dài phim — không
       * đọc lại tệp thêm lần nào.
       */
      const isStillInsert = insertPath !== null && /\.(jpe?g|png|webp|heic)$/i.test(insertPath);
      const from = slot.role === "phu"
        ? (insertPath
            ? isStillInsert
              ? `movie=${insertPath}:loop=1,tpad=stop_mode=clone:stop_duration=${(seconds > 0 ? seconds : 60).toFixed(3)},setpts=N/FRAME_RATE/TB[${tagBase}src];[${tagBase}src]`
              : `movie=${insertPath}:loop=0,setpts=N/FRAME_RATE/TB[${tagBase}src];[${tagBase}src]`
            : null)
        : source;
      // Ô `phu` mà chưa có tư liệu thì BỎ, không dựng một ô đen: một khoảng
      // trống có viền đọc ra là lỗi vẽ, còn thiếu hẳn thì chỉ là bố cục gọn hơn.
      if (!from) return;
      /*
       * Ô phụ đo theo TƯ LIỆU, ô chính đo theo VIDEO CHÍNH.
       *
       * Và tỉ lệ khai của ô phụ chỉ là mong muốn: tư liệu dọc thì ô ngang không
       * dựng được mà không bỏ mất 68% khung hình, nên `settleAspect` chốt lại
       * theo thứ tư liệu thật sự có.
       */
      const media = slot.role === "phu"
        ? (insertAspects[which] ?? sourceAspect ?? frameWidth / frameHeight)
        : (sourceAspect ?? frameWidth / frameHeight);
      let use = slot;
      if (slot.role === "phu") {
        const mate = spec.slots.find((o) => o !== slot);
        const mateBox = mate
          ? slotPixels(mate, frameWidth, frameHeight, sourceAspect)
          : null;
        use = { ...slot, aspect: settleAspect(slot.aspect, media, mateBox ? mateBox.w / mateBox.h : null) };
      }
      const box = slotPixels(use, frameWidth, frameHeight, media);
      const tag = tagBase;
      const crop = cropExpr(box);
      const fit = `scale=${box.w}:${box.h}:force_original_aspect_ratio=increase,${crop}`;
      /*
       * VIỀN VÀNG QUANH Ô B-ROLL — nướng vào chính lớp cutout, không overlay riêng.
       *
       * Chalk viền nguệch ngoạc quanh TƯ LIỆU CHÈN (ảnh/video), không quanh người.
       * Dựng viền từ CHÍNH mặt nạ ô: co mặt nạ vào trong rồi trừ đi → một vòng
       * bám mép trong, tô màu viền. Vì viền dán lên `[tag]c` (cùng khổ ô) rồi mới
       * qua bước phóng/đặt chung, nó tự đi theo ô lúc đổi bố cục — không phải dựng
       * một lớp phủ thứ hai bám theo `glide`.
       */
      const edge = slot.role === "phu" && slot.mask ? edgeCfg : null;
      const bw = edge ? Math.max(6, Math.round(Math.min(box.w, box.h) * 0.022)) : 0;
      const erode = Array.from({ length: bw }, () => "erosion").join(",");
      // MÉP RÁCH cho ảnh b-roll: dùng mặt nạ mép hạt/xé `o-rach` (thay bo tròn
      // gọn), nên cả ảnh LẪN viền vàng (dựng từ chính mặt nạ này) đều rách như
      // ảnh cắt dán tay của Chalk. Ô người giữ bo tròn thường. `o-rach` để ngoài
      // `assets/graphics` (không dựng từ svg) nên `check:graphics` không soi.
      const maskFile = edge
        ? `${pngDir}/../../masks/o-rach.png`
        : `${pngDir}/${slot.mask}.png`;
      // NGHIÊNG như ảnh polaroid DÁN LỆCH TAY — MỌI ô có mặt nạ nổi TRÊN NỀN TRANG
      // đều nghiêng + rung, kể cả khung MỘT ô b-roll nổi (`broll-don`): nó là một
      // tấm ảnh dán tay nên phải "thở" như các ô khác. Toàn-khung KHÔNG nghiêng vì
      // phủ kín (mask null, không nổi trên nền). Xoay với nền TRONG SUỐT + nở khung
      // (`ow/oh`) để không xén góc.
      const wantTilt = !!slot.mask && page !== null;
      const tiltRad = wantTilt
        ? ((handmadeTiltAt(at) * Math.PI) / 180).toFixed(4)
        : "0";
      const endTag = wantTilt ? `[${tag}flat]` : `[${tag}c]`;
      const tilt = wantTilt
        ? `;[${tag}flat]rotate=${tiltRad}:c=black@0:` +
          `ow=rotw(${tiltRad}):oh=roth(${tiltRad})[${tag}c]`
        : "";
      const masked = slot.mask
        ? edge
          ? `movie=${maskFile},alphaextract,scale=${box.w}:${box.h},split[${tag}mc][${tag}me];` +
            `${from}${fit},format=rgba[${tag}v];` +
            `[${tag}v][${tag}mc]alphamerge[${tag}base];` +
            `[${tag}me]split[${tag}mA][${tag}mB];` +
            `[${tag}mB]${erode}[${tag}thin];` +
            `[${tag}mA][${tag}thin]blend=all_mode=subtract,format=gray[${tag}ring];` +
            `color=c=${edge.tone.color}:s=${box.w}x${box.h}[${tag}rc];` +
            `[${tag}rc][${tag}ring]alphamerge,colorchannelmixer=aa=${edge.tone.alpha.toFixed(3)}[${tag}bd];` +
            `[${tag}base][${tag}bd]overlay=0:0${endTag}` +
            tilt
          : `movie=${pngDir}/${slot.mask}.png,alphaextract,scale=${box.w}:${box.h}[${tag}m];` +
            `${from}${fit},format=rgba[${tag}v];` +
            `[${tag}v][${tag}m]alphamerge${endTag}` +
            tilt
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
        const push = pushFactor(entries, frame.scenePush?.ratePerSecond ?? 0);
        /*
         * TĨNH khi khổ không đổi theo `t` — `glide` trả về đúng một con số (không
         * `between(...)`) khi mọi màn của ô này đã ở đúng khổ đích ngay từ đầu
         * (không màn nào lệch quá 0,5px), và không có máy quay dồn vào. Lúc đó
         * `eval=frame` chỉ là dựng lại đúng MỘT con số ấy ở từng khung — không
         * sai, nhưng trả giá cho một việc không đổi.
         *
         * Không tự suy "hằng số" từ việc thiếu ramp nói chung: một ô len lỏi
         * giữa nhiều màn có ô khác cỡ vẫn cần `eval=frame` thật, và đoán nhầm ở
         * đây ra một ô đứng khựng đúng lúc cảnh đổi.
         */
        const isConstant = !w.includes("between(") && !h.includes("between(") && push === "";
        chains.push(
          `${masked};[${tag}c]scale=w='2*floor((${w})${push}/2)':` +
            `h='2*floor((${h})${push}/2)':eval=${isConstant ? "init" : "frame"}[${tag}]`,
        );
        // RUNG STOP-MOTION cho ảnh scrapbook: ảnh dán tay không đứng ĐƠ — nó khẽ
        // GIẬT theo BẬC thời gian (`floor(t*6)`/`floor(t*5)` ≈ 5-6 bậc/s) như phim
        // tĩnh vật, các ảnh lệch pha nên rung độc lập. Chỉ ô NGHIÊNG (wantTilt = ô
        // có mặt nạ nổi trên nền, kể cả b-roll đơn). Biên độ CỰC nhỏ (~0.16% cạnh) —
        // chỉ khẽ "thở" chứ không rung thấy rõ.
        const jit = wantTilt ? Math.max(1, Math.round(Math.min(box.w, box.h) * 0.0016)) : 0;
        const jx = wantTilt ? `+${jit}*sin(floor(t*6)*1.7+${at})` : "";
        const jy = wantTilt ? `+${jit}*sin(floor(t*5)*2.3+${(at * 1.9).toFixed(1)})` : "";
        overlays.push({
          label: `[${tag}]`,
          // Tâm cũng lướt: đổi bố cục là ô vừa đổi khổ vừa đổi CHỖ, và chỉ nắn
          // khổ mà để chỗ nhảy thì cú nhảy vẫn còn nguyên, chỉ nhỏ hơn.
          x: `${glide(entries, cx, (e) => e.cx0)}${jx}-w/2`,
          y: `${glide(entries, cy, (e) => e.cy0)}${jy}-h/2`,
          enable: windows(scenes),
        });
      } else {
        chains.push(`${masked};[${tag}c]null[${tag}]`);
        overlays.push({ label: `[${tag}]`, x: box.x, y: box.y, enable: windows(scenes) });
      }
    }
  });

  return { chains, overlays, page };
}

/** Bao nhiêu bản sao luồng hình cần `split` — đúng số bố cục có trong lịch. */
export function sourceCount(schedule: readonly ScheduledScene[]): number {
  // Đếm số layout KHÁC NHAU CÓ ô người — chỉ chúng cần một luồng video gốc. Layout
  // chỉ b-roll (`broll-don`) dùng tệp chèn, không lấy luồng gốc; đếm cả nó thì
  // `split` thừa nhánh không nối.
  return new Set(
    schedule
      .filter((s) => findLayout(s.layout).slots.some((sl) => sl.role === "chinh"))
      .map((s) => s.layout),
  ).size;
}
