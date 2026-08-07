/**
 * LUẬT THỜI GIAN — đo từ video mẫu, không chọn theo cảm giác.
 *
 * ══ VÌ SAO CÓ TỆP NÀY ══
 *
 * Bóc sáu phong cách tham khảo (`plans/260803-1900-.../do-duoc.md`) thì thấy
 * một điều bất ngờ: **hình thức khác nhau hoàn toàn, thời gian gần như trùng.**
 *
 *   tuổi thọ khối chữ chính: 2,1 · 2,5 · 2,65 · 2,4 · 2,4 · 2,1–3,5 giây
 *
 * Sáu bộ, sáu diện mạo không liên quan gì nhau, mà con số này chụm quanh 2,4.
 * Nó không phải lựa chọn thẩm mỹ của từng bộ — nó là LUẬT của khổ dọc.
 *
 * Nên chỗ này ép, còn hình thức thì mở. Ép ngược lại là sai cả hai đầu: ép hình
 * thức thì mười bộ đọc ra như một; thả thời gian thì ra spam — đã đo được trên
 * chính sản phẩm này khi cho viền quanh người rải đều 30% thời lượng.
 *
 * ══ BA LỖI TỆP NÀY SINH RA ĐỂ CHẶN ══
 *
 * Cả ba đều đã xảy ra thật trong một buổi, và cả ba đều IM LẶNG — video vẫn xuất
 * ra, chỉ là nhìn sai:
 *
 * 1. Khung của bộ `Thép` mờ vào trong 0,6 giây rồi đứng im 132 giây. Nó thôi là
 *    đồ hoạ, thành hoa văn của khung hình.
 * 2. Mảng màu của bộ `Nhịp` ở lại sau khi dòng chữ trong nó đã tắt — 129 trên
 *    132 giây là một vệt màu rỗng, lại ăn mất 11% chiều cao.
 * 3. Viền quanh người bật/tắt rải khắp phim. Nhấp nháy thì mắt không kịp nhận ra
 *    đó là một quyết định, chỉ thấy màn hình cứ đổi.
 *
 * Không có phép kiểm thì lần thứ tư cũng sẽ không ai thấy.
 */

/* ── R1 · MÀN ────────────────────────────────────────────────────────────── */

/**
 * Một màn dài bao lâu — HAI dải, tuỳ chỗ trong phim.
 *
 * ── LẦN ĐO ĐẦU TÔI ĐO NHẦM LOẠI VIDEO ──
 *
 * Vòng đầu tôi rút ra "2–3,5 giây một màn" từ sáu bộ mẫu dài 8–10 giây. Số ấy
 * đúng với chính chúng, nhưng chúng là **quảng cáo cho phong cách** — nhồi mọi
 * thiết bị vào mười giây để phô. Đem nhịp ấy áp lên một video tâm sự hai phút
 * thì ra 46 màn, và nhìn không ra là dựng mà ra là bồn chồn.
 *
 * Đo lại trên bảy mẫu DÀI (22–62 giây), đếm số lần đổi lớn:
 *
 *   lumen 22,4s/lần · ember 13,8 · clarity 11,8 · core 8,8
 *   vinyl-ii 8,3 · film 7,3 · align 3,0 (bộ cắt nhanh, ngoại lệ)
 *
 * Trung vị **8,8 giây**. Gấp ba lần con số cũ.
 *
 * ── VÌ SAO VẪN GIỮ DẢI NHANH CHO ĐOẠN MỞ ──
 *
 * Mấy giây đầu là chỗ người xem quyết định ở lại hay lướt, nên phần ấy phải phô
 * ra bộ dáng có gì — cả sáu mẫu ngắn đều nổ ngay trong giây đầu tiên. Sau khi
 * họ đã ở lại thì thứ họ theo là lời nói, và màn dài ra là đúng.
 */
/**
 * Màn dài dần theo KHỐI thời gian, không phải hai dải cứng.
 *
 * Chia phim thành khối 15 giây. Khối 0 đổi màn nhanh nhất, mỗi khối sau thưa
 * hơn khối trước theo cùng một bậc:
 *
 *   độ dài màn = SCENE_BASE × (1 + khối / 2)
 *
 *   khối 0 (0–15s)   3,0s   ← tần suất x
 *   khối 1 (15–30s)  4,5s   ← 2x/3
 *   khối 2 (30–45s)  6,0s   ← x/2
 *   khối 3 (45–60s)  7,5s
 *   …                       chạm trần 15s ở khối 8 (120s trở đi)
 *
 * Hai dải cứng (nhanh 30 giây đầu rồi chậm hẳn) có một bậc nhảy nghe ra được:
 * đang 4 giây một màn bỗng thành 11. Giảm dần thì không ai chỉ ra được chỗ nào
 * đổi nhịp, mà tổng thể vẫn thưa đúng như video dài thật.
 *
 * Và nó tự hợp với MỌI độ dài: phim 20 giây thì chỉ chạm khối 0–1 nên vẫn dày,
 * phim năm phút thì phần lớn nằm ở trần 15 giây.
 */
export const SCENE_BLOCK = 15.0;
export const SCENE_BASE = 3.0;
/** Sàn và trần tuyệt đối, kể cả khi công thức cho ra số ngoài dải. */
export const SCENE_MIN = 2.5;
export const SCENE_MAX = 15.0;
/** Quá mức này là chắc chắn sai, kể cả khi có lý do riêng. */
export const SCENE_HARD_MAX = 24.0;

/** Màn bắt đầu ở giây `at` nên dài bao nhiêu. */
export function sceneLengthAt(at: number): number {
  const block = Math.floor(Math.max(0, at) / SCENE_BLOCK);
  return Math.min(SCENE_MAX, Math.max(SCENE_MIN, SCENE_BASE * (1 + block / 2)));
}
/* ── R3 · THIẾT BỊ NỔI ───────────────────────────────────────────────────── */

/**
 * Thiết bị nổi sống bao lâu rồi TẮT HẲN.
 *
 * Đây là con số chụm nhất trong cả bộ số đo. Sáu bộ: 2,1 · 2,5 · 2,65 · 2,4 ·
 * 2,4 · 2,1–3,5.
 */
export const HERO_MIN = 2.0;
export const HERO_MAX = 3.5;

/**
 * Thiết bị nổi KHÔNG sống hết màn khi màn dài.
 *
 * Màn ngoài cửa sổ mở dài 7–15 giây, mà thiết bị chỉ sống 2–3,5. Nó nổ ở đầu
 * màn rồi tắt, phần còn lại của màn là bố cục ấy đứng yên — đúng cách sáu bộ
 * mẫu làm, và đó cũng là chỗ "khoảng thở" đến một cách tự nhiên.
 */
export const HERO_AT_SCENE_START = true;

/* ── R4 · KHOẢNG THỞ ─────────────────────────────────────────────────────── */

/**
 * Giữa hai thiết bị nổi phải có ngần này giây KHÔNG CÓ GÌ.
 *
 * Bảng `chalk` chừa đúng một ô trống (0,25 giây ở nhịp lấy mẫu 8fps) giữa mạch
 * chữ "YOUTH" và mạch viền. Hai thiết bị dính liền nhau thì cái sau mất hết sức
 * nặng — mắt còn đang bận với cái trước.
 */
export const REST_MIN = 0.25;

/* ── R5 · VÀO, RA, CHUYỂN MÀN ────────────────────────────────────────────── */

/**
 * Vào nhanh hay chậm.
 *
 * Trần 1,0 giây là cho lối viết/gõ từng chữ — `lens` gõ "Aperture" mất đúng 1,0
 * giây (8 chữ × 0,125). Mọi lối khác nằm quanh 0,25.
 */
export const ENTER_MIN = 0.15;
export const ENTER_MAX = 1.0;

/** Ra thì luôn nhanh hơn vào. Không bộ nào ra quá 0,4 giây. */
export const EXIT_MIN = 0.2;
export const EXIT_MAX = 0.4;

/**
 * Chuyển màn — trần 0,4 giây.
 *
 * Sàn không có: `volt` chuyển bằng ĐÚNG MỘT KHUNG HÌNH trắng (1/24 giây), và
 * đó là cú chuyển sắc nhất trong cả sáu bộ.
 */
export const CUT_MAX = 0.4;

/* ── R6 · LỚP CHỮ ────────────────────────────────────────────────────────── */

/**
 * Một tiếng nằm trên màn bao lâu.
 *
 * Cả sáu bộ đều DỒN chữ trong một cụm rồi XOÁ giữa hai cụm — không bộ nào thay
 * từng tiếng. Nhịp quanh 0,3 giây.
 *
 * Lớp chữ chạy suốt phim và KHÔNG tính là thiết bị nổi: nó là nền của thể loại
 * này, không phải một nét thiết kế. Tính nó vào thì luật R2 chặn hết mọi thứ
 * khác.
 */
export const WORD_BEAT = 0.3;

/* ── R7 · MỞ MÀN ─────────────────────────────────────────────────────────── */

/**
 * Trong ngần này giây đầu BẮT BUỘC có một thiết bị nổi.
 *
 * Cả sáu bộ đều nổ ngay: `chalk` 0,125s · `focus` 0,375s · `lens` 0,25s ·
 * `y2k` 0,0s · `sketch` 0,0s · `volt` 0,17s.
 *
 * Đây là luật của khổ dọc chứ không phải sở thích: người xem quyết định ở lại
 * hay lướt trong mấy giây đầu, nên phần ấy phải phô ra bộ dáng có gì.
 */
export const OPENING_SECONDS = 3.0;

/* ── KIỂM ────────────────────────────────────────────────────────────────── */

/** Một màn trong lịch: khoảng thời gian, bố cục, và có thiết bị nổi hay không. */
export type ScheduledScene = {
  start: number;
  end: number;
  layout: string;
  /** Thiết bị nổi của màn này. `null` là màn nghỉ. */
  hero: string | null;
  /**
   * Thiết bị nổi sống bao lâu, tính từ đầu màn.
   *
   * Tách khỏi độ dài màn vì hai thứ khác nhau: màn ngoài đoạn mở dài 7–15 giây,
   * còn thiết bị chỉ sống 2–3,5. Nó nổ ở đầu màn rồi tắt, phần còn lại là bố cục
   * ấy đứng yên — và chính khoảng đứng yên đó là "khoảng thở" của R4.
   */
  heroSeconds?: number;
  /**
   * Màn này có MÁY QUAY DỒN VÀO không.
   *
   * Không phải màn nào cũng có: đo kho mẫu thì chỉ 1–3 trên 15–59 cặp khung có
   * phóng. Dồn ở mọi màn thì nó thôi là chuyển động và thành nền.
   */
  push?: boolean;
  /**
   * Màn này dùng TƯ LIỆU CHÈN thứ mấy, đếm từ 0. Bỏ trống là màn không có ô phụ.
   *
   * Chỉ số chứ không phải đường dẫn: bộ xếp lịch chạy được cả trên trình duyệt
   * lẫn máy chủ, mà đường dẫn tệp chỉ có nghĩa ở máy chủ.
   */
  insert?: number;
  /**
   * Mã ELEMENT của segment đã đặt — để màn hình sửa/xoá đúng phần tử.
   *
   * Bỏ trống ở màn toàn-khung lấp khoảng trống (chỉ có lúc DỰNG, không phải một
   * phần tử người dùng đặt).
   */
  elementId?: string;
};

export type Violation = { rule: string; detail: string };

/**
 * Soát một lịch màn theo bảy luật. Mảng rỗng là đạt.
 *
 * Trả về DANH SÁCH lỗi chứ không ném ở lỗi đầu tiên: sửa xong một chỗ rồi chạy
 * lại để lộ ra chỗ tiếp theo là cách chậm nhất có thể.
 */
export function checkSchedule(scenes: readonly ScheduledScene[]): Violation[] {
  const out: Violation[] = [];
  if (scenes.length === 0) return [{ rule: "R1", detail: "lịch rỗng" }];

  scenes.forEach((scene, index) => {
    const length = scene.end - scene.start;
    // Dải hợp lệ đổi theo chỗ màn đứng trong phim — xem `sceneLengthAt`.
    const want = sceneLengthAt(scene.start);
    const lo = Math.max(SCENE_MIN, want * 0.6);
    const hi = Math.min(SCENE_MAX, want * 1.6);
    if (length > SCENE_HARD_MAX) {
      out.push({
        rule: "R1",
        detail: `màn ${index} dài ${length.toFixed(2)}s, quá trần cứng ${SCENE_HARD_MAX}s`,
      });
    } else if (length < lo || length > hi) {
      out.push({
        rule: "R1",
        detail: `màn ${index} dài ${length.toFixed(2)}s, ngoài dải ${lo}–${hi}s`,
      });
    }
    if (index > 0 && scene.start < scenes[index - 1].end - 0.001) {
      out.push({ rule: "R1", detail: `màn ${index} chồng lên màn trước` });
    }
  });

  /*
   * R4 đo trên các màn CÓ thiết bị nổi liền kề nhau.
   *
   * Hai màn nổi dính nhau thì khoảng thở bằng 0 — đó chính là ca phải chặn.
   * Màn nghỉ xen giữa thì tự nó đã là khoảng thở, và nó dài hơn 0,25 giây rất
   * nhiều nên không cần đo.
   */
  for (let index = 1; index < scenes.length; index += 1) {
    const before = scenes[index - 1];
    const now = scenes[index];
    if (!before.hero || !now.hero) continue;
    const rest = now.start - before.end;
    if (rest < REST_MIN) {
      out.push({
        rule: "R4",
        detail: `màn ${index - 1} và ${index} đều có thiết bị nổi mà chỉ cách ${rest.toFixed(2)}s`,
      });
    }
  }

  scenes.forEach((scene, index) => {
    if (!scene.hero) return;
    // Không khai `heroSeconds` thì hiểu là sống hết màn — và với màn dài thì đó
    // đúng là lỗi "bật suốt" mà tệp này sinh ra để chặn.
    const life = scene.heroSeconds ?? scene.end - scene.start;
    if (life < HERO_MIN || life > HERO_MAX) {
      out.push({
        rule: "R3",
        detail: `thiết bị "${scene.hero}" ở màn ${index} sống ${life.toFixed(2)}s, ngoài dải ${HERO_MIN}–${HERO_MAX}s`,
      });
    }
  });

  const opener = scenes.find((scene) => scene.start < OPENING_SECONDS);
  if (!opener?.hero) {
    out.push({
      rule: "R7",
      detail: `không thiết bị nổi nào trong ${OPENING_SECONDS}s đầu`,
    });
  }

  return out;
}

/** Vào/ra/chuyển màn có nằm trong dải đo được không. */
export function checkMotion(motion: {
  enter?: number;
  exit?: number;
  cut?: number;
}): Violation[] {
  const out: Violation[] = [];
  if (motion.enter !== undefined && (motion.enter < ENTER_MIN || motion.enter > ENTER_MAX)) {
    out.push({ rule: "R5", detail: `vào ${motion.enter}s, ngoài ${ENTER_MIN}–${ENTER_MAX}s` });
  }
  if (motion.exit !== undefined && (motion.exit < EXIT_MIN || motion.exit > EXIT_MAX)) {
    out.push({ rule: "R5", detail: `ra ${motion.exit}s, ngoài ${EXIT_MIN}–${EXIT_MAX}s` });
  }
  if (motion.cut !== undefined && motion.cut > CUT_MAX) {
    out.push({ rule: "R5", detail: `chuyển màn ${motion.cut}s, quá trần ${CUT_MAX}s` });
  }
  return out;
}
