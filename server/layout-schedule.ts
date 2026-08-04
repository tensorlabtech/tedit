import { findLayout, usableLayouts, type LayoutKindId } from "./layout-kinds";
import {
  HERO_MAX,
  OPENING_SECONDS,
  SCENE_MAX,
  SCENE_MIN,
  sceneLengthAt,
  type ScheduledScene,
} from "./timing";

/**
 * XẾP LỊCH MÀN — chia phim thành các màn và gán bố cục cho từng màn.
 *
 * ══ VÌ SAO KHÔNG HỎI MÔ HÌNH ══
 *
 * Dây chuyền đã có bảy chặng gọi mô hình. Thêm một nữa là thêm thời gian chờ,
 * thêm một chỗ hỏng, và thêm một nguồn dao động giữa hai lượt dựng cùng dữ liệu.
 *
 * Mà việc này không cần mô hình: luật thời gian đã đo xong (2–3,5 giây một màn),
 * còn chỗ ĐẶT ranh giới thì đã có sẵn hai nguồn tốt hơn một lời đoán —
 *
 * · **mép cụm chữ** — chỗ người nói dứt một ý. Đổi bố cục giữa câu thì người xem
 *   đọc ra là lỗi; đổi đúng chỗ dứt ý thì đọc ra là dựng.
 * · **vết cắt** — chỗ hình vốn đã đổi. Đổi bố cục ở đó là miễn phí về thị giác.
 *
 * Cùng lý lẽ với `auto-trim-silence.ts`: đã có mốc thật thì một phép trừ đủ,
 * thêm mô hình chỉ tốn tiền và cho kết quả dao động.
 *
 * ══ LUẬT XẾP ══
 *
 * 1. Ranh giới nắn về mép cụm chữ gần nhất (rồi tới vết cắt) trong bán kính hẹp.
 * 2. Bố cục **xoay vòng** trong danh sách bộ dáng khai, không lặp lại liền nhau.
 * 3. Màn NỔI và màn NGHỈ xen kẽ — hai màn nổi liền nhau vi phạm R4.
 * 4. Màn đầu luôn NỔI (R7).
 */

export type SceneWish = {
  /** Bố cục bộ dáng cho phép, theo thứ tự ưu tiên. */
  layouts: LayoutKindId[];
  /** Thiết bị nổi bộ dáng có, xoay vòng qua các màn nổi. */
  heroes: string[];
  /** Bao nhiêu phần các màn có máy quay dồn vào. `0` là bộ không có trục này. */
  pushShare?: number;
};

/**
 * Chọn bố cục theo NỘI DUNG, không xoay vòng.
 *
 * Xoay vòng đều tăm tắp thì bố cục chỉ đổi cho khác, không nói điều gì. Người
 * dựng thật đổi bố cục ở chỗ nội dung đổi — và ta có sẵn hai tín hiệu:
 *
 * · **mật độ từ nhấn** — đoạn nhiều từ nhấn là đoạn mang tin. Cho nó
 *   `toan-khung`: thân mật nhất, không có gì chen giữa người xem và người nói.
 * · **có tư liệu chèn đáng dùng** — cho `hai-o`.
 *
 * Còn lại là đoạn thường, dùng bố cục trang trí (`o-don`, `o-lech`) xoay vòng.
 */
/**
 * Mỗi HỌ bố cục một bộ đếm riêng.
 *
 * ── VÌ SAO KHÔNG DÙNG CHUNG MỘT SỐ THỨ TỰ MÀN ──
 *
 * Bản đầu xoay vòng bằng chính số thứ tự màn. Mà màn có tư liệu rơi vào những
 * chỗ `sốMàn % 3 == 2`, còn bộ đếm thì tăng ở MỌI màn — nên `sốĐếm % 3` luôn
 * bằng 2, và họ ba bố cục hai ô chỉ có đúng cái thứ ba được dùng.
 *
 * Đo trên bản dựng thật: `ngang-vuong` chạy 6,5 giây, `vuong-ngang` **0 giây**.
 * Lỗi im lặng — mã chạy đúng, phép kiểm xanh, chỉ có một bố cục không bao giờ
 * lên hình. Bộ đếm riêng cho mỗi họ thì nhịp lấy mẫu của họ này không cắt vào
 * vòng xoay của họ kia.
 */
type Turns = { insert: number; plain: number };

function pickLayout(
  allowed: readonly LayoutKindId[],
  keywordDensity: number,
  wantsInsert: boolean,
  turns: Turns,
): LayoutKindId {
  const has = (id: LayoutKindId) => allowed.includes(id);
  // Ngưỡng 0,6: đo trên bản thật thì 50% cụm có nhấn, nên "dày" là trên mức ấy.
  if (keywordDensity >= 0.6 && has("toan-khung")) return "toan-khung";
  /*
   * Đoạn có tư liệu thì XOAY VÒNG trong họ bố cục hai ô, không đóng đinh một
   * cái. Ba bố cục hai ô khác nhau ở HÌNH DẠNG ô, mà hình dạng là thứ người xem
   * nhớ — dùng mãi một cái thì mọi lần chèn tư liệu trông y hệt nhau.
   */
  const twoSlot = allowed.filter((id) => findLayout(id).needsInsert);
  if (wantsInsert && twoSlot.length > 0) {
    return twoSlot[turns.insert++ % twoSlot.length];
  }
  const rest = allowed.filter(
    (id) => id !== "toan-khung" && !findLayout(id).needsInsert,
  );
  if (rest.length > 0) return rest[turns.plain++ % rest.length];
  return allowed[turns.plain++ % allowed.length];
}

/**
 * Nắn một mốc về ranh giới tự nhiên gần nhất.
 *
 * Ưu tiên mép cụm chữ hơn vết cắt: vết cắt là chỗ hình đổi, nhưng mép cụm mới là
 * chỗ Ý đổi — và người xem theo ý, không theo hình.
 *
 * Bán kính hẹp (0,6 giây) vì nắn xa hơn là dời hẳn màn đi chỗ khác, và lúc ấy
 * luật độ dài màn vỡ mà không ai biết vì sao.
 */
function snap(at: number, marks: readonly number[], radius = 0.6): number {
  let best = at;
  let gap = radius;
  for (const mark of marks) {
    const d = Math.abs(mark - at);
    if (d < gap) {
      gap = d;
      best = mark;
    }
  }
  return best;
}

/**
 * Chia `total` giây thành các màn, gán bố cục và thiết bị nổi.
 *
 * Trả về lịch đã chấp hành R1/R4/R7. `checkSchedule` vẫn soát lại ở phép kiểm —
 * hàm này CỐ làm đúng, phép kiểm mới là thứ bảo đảm nó đúng.
 */
export function scheduleScenes(
  total: number,
  wish: SceneWish,
  marks: {
    /** Mốc dứt cụm chữ, trên trục phim đã cắt. */
    phrases: readonly number[];
    /** Mốc các vết cắt, trên trục phim đã cắt. */
    cuts: readonly number[];
    /** Mốc các cụm CÓ từ nhấn — dùng để đo đoạn nào mang tin. */
    keywords?: readonly number[];
  },
  /**
   * Có bao nhiêu tư liệu chèn. `0` là chưa có — họ bố cục hai ô biến mất.
   *
   * SỐ LƯỢNG chứ không phải cờ đúng/sai: mỗi lần chèn phải lấy một tư liệu
   * khác. Bản trước chỉ đọc tệp đầu (`LIMIT 1`) nên cả ba bố cục b-roll khác
   * hình dạng đều đựng chung một ảnh — vừa làm ba khung khác nhau xong thì nội
   * dung trong khung vẫn y hệt.
   */
  insertCount: number | boolean,
): ScheduledScene[] {
  const inserts = typeof insertCount === "number" ? insertCount : insertCount ? 1 : 0;
  const hasInserts = inserts > 0;
  const allowed = usableLayouts(hasInserts).map((spec) => spec.id);
  const layouts = wish.layouts.filter((id) => allowed.includes(id));
  if (layouts.length === 0 || total < SCENE_MIN) return [];

  const snapMarks = [...marks.phrases, ...marks.cuts].sort((a, b) => a - b);
  const out: ScheduledScene[] = [];
  /*
   * Màn DÀI dần: dày ở đoạn mở, thưa ra về sau.
   *
   * Đo bảy mẫu dài (22–62 giây): trung vị 8,8 giây một lần đổi. Mà cả sáu mẫu
   * NGẮN đều nổ ngay giây đầu — vì mấy giây đầu là chỗ người xem quyết định ở
   * lại hay lướt. Hai điều ấy không mâu thuẫn, chúng nói về hai đoạn khác nhau
   * của cùng một phim.
   */
  let cursor = 0;
  /*
   * `share` đổi thành "cứ mấy màn một lần" — 0,3 ra một trong ba.
   *
   * Chia đều theo chu kỳ chứ không rút thăm: hai lượt dựng cùng dữ liệu phải ra
   * cùng một video, cùng lý lẽ với chỗ không gọi mô hình để xếp lịch.
   */
  const pushEvery = wish.pushShare && wish.pushShare > 0
    ? Math.max(2, Math.round(1 / wish.pushShare))
    : 0;
  const turns: Turns = { insert: 0, plain: 0 };
  let heroAt = 0;
  let insertAt = 0;
  let sceneAt = 0;

  while (cursor < total - SCENE_MIN) {
    const want = sceneLengthAt(cursor);
    const lo = Math.max(SCENE_MIN, want * 0.6);
    const hi = Math.min(SCENE_MAX, want * 1.6);

    let end = snap(cursor + want, snapMarks);
    if (end - cursor < lo || end - cursor > hi) end = cursor + want;
    if (end > total) end = total;
    if (end - cursor < lo) break;

    /*
     * Thiết bị nổi ở màn CHẴN, màn lẻ nghỉ.
     *
     * Không phải mọi màn đều nổi: R4 đòi khoảng thở, mà với màn dài thì khoảng
     * thở tự nhiên chính là phần sau của màn — thiết bị tắt rồi bố cục đứng yên.
     * Xen kẽ thêm một tầng nữa cho chắc, và cũng để mắt có chỗ nghỉ hẳn.
     */
    const wantsHero = sceneAt % 2 === 0 && wish.heroes.length > 0;
    /*
     * Mật độ từ nhấn của MÀN NÀY = số cụm có nhấn trên số cụm dứt trong màn.
     * Không có cụm nào thì coi như 0 — màn im lặng không phải màn quan trọng.
     */
    const inScene = marks.phrases.filter((at) => at >= cursor && at < end).length;
    const hot = (marks.keywords ?? []).filter((at) => at >= cursor && at < end).length;
    const density = inScene > 0 ? hot / inScene : 0;
    const layout = pickLayout(layouts, density, sceneAt % 3 === 2, turns);

    out.push({
      start: cursor,
      end,
      layout,
      hero: wantsHero ? wish.heroes[heroAt++ % wish.heroes.length] : null,
      // Thiết bị sống 2–3,5 giây rồi tắt, kể cả khi màn dài 15 giây.
      heroSeconds: wantsHero ? Math.min(HERO_MAX, end - cursor) : undefined,
      /*
       * Mỗi lần chèn một tư liệu khác, xoay vòng theo THỨ TỰ MÀN CÓ CHÈN.
       *
       * Bộ đếm riêng, cùng lý lẽ với vòng xoay bố cục: đếm theo mọi màn thì nhịp
       * lấy mẫu của họ này cắt vào vòng xoay của họ kia và có tư liệu không bao
       * giờ được dùng.
       */
      insert: findLayout(layout).needsInsert ? insertAt++ % inserts : undefined,
      /*
       * Máy quay dồn vào ở màn NGHỈ, không ở màn nổi.
       *
       * Màn nổi đã có một thiết bị đang nói; chồng thêm chuyển động thì hai thứ
       * tranh nhau và không cái nào đọc ra. Màn nghỉ thì ngược lại — nó đang
       * đứng yên hoàn toàn, và một cú dồn chậm là thứ duy nhất xảy ra ở đó.
       */
      push: !wantsHero && pushEvery > 0 && sceneAt % pushEvery === 1,
    });

    cursor = end;
    sceneAt += 1;
  }

  // R7: màn đầu bắt buộc nổi. Vòng lặp bắt đầu bằng `heroTurn = true` nên chỉ
  // hụt khi bộ dáng không khai thiết bị nổi nào — lúc ấy báo ra chứ không giấu.
  if (out.length > 0 && !out[0].hero && wish.heroes.length > 0) {
    out[0].hero = wish.heroes[0];
  }
  return out;
}

/** Bố cục đang chạy tại một giây. `null` khi ngoài lịch. */
export function layoutAt(schedule: readonly ScheduledScene[], at: number) {
  const scene = schedule.find((item) => at >= item.start && at < item.end);
  return scene ? findLayout(scene.layout) : null;
}

/** Màn đầu có nổ trong `OPENING_SECONDS` giây đầu không — dùng cho phép kiểm. */
export function opensStrong(schedule: readonly ScheduledScene[]): boolean {
  return schedule.some((scene) => scene.start < OPENING_SECONDS && scene.hero !== null);
}
