/**
 * VỐN TỪ BỐ CỤC — khung hình chia thành những Ô nào.
 *
 * Cùng lối `junction-kinds.ts`: bảng ĐÓNG, bộ dựng biết vẽ đúng ngần này bố cục,
 * bộ dáng chỉ chọn dùng cái nào và tô màu ra sao.
 *
 * ══ VÌ SAO TÁCH RA ══
 *
 * Trước đợt này video LUÔN phủ kín khung, và mọi thứ bộ dáng vẽ đều là lớp dán
 * đè lên. Đo 46 video mẫu thì thấy điều ngược lại: **video thường KHÔNG phủ kín**
 * — nó bị mặt nạ thành một hình rồi đặt lên một trang đã thiết kế, và bố cục ấy
 * ĐỔI vài lần trong một video (2–3,5 giây một lần).
 *
 * Nếu để mỗi bộ dáng tự khai "giây 4,6 thì ô nở ra" thì đó là chép mốc thời gian
 * của một video mẫu vào catalog — bộ thứ hai lại phải chép lại từ đầu. Tách bố
 * cục thành vốn từ thì bộ dáng chỉ nói *dùng những bố cục nào*, còn *đổi lúc nào*
 * là việc của bộ xếp lịch, theo luật thời gian đo được.
 *
 * ══ Ô ══
 *
 * Mỗi bố cục khai các Ô của nó. Ô là một hình chữ nhật tính theo TỈ LỆ khung
 * (0–1), kèm vai và mặt nạ tuỳ chọn. Tỉ lệ chứ không phải điểm ảnh, cùng lối
 * `SAFE` và `plate.heightShare` — đổi khổ xuất thì bố cục không phải tính lại.
 *
 * Số đo lấy từ `pulse.mp4`, đọc trên lưới 10%. Không cần khớp từng phần trăm:
 * đây là điểm khởi hành, bộ dáng chỉnh lại được.
 */

/** Ô này đựng gì. */
export type SlotRole =
  /** Video chính — người nói. Bố cục nào cũng có tối đa MỘT ô này. */
  | "chinh"
  /** Tư liệu chèn. Không có tư liệu thì ô này bỏ trống và bố cục rơi về loại khác. */
  | "phu";

/** Hình chữ nhật theo tỉ lệ khung, gốc ở góc trên-trái. */
export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Ô mang tỉ lệ nào.
 *
 * `nguon` là bám tỉ lệ video nạp vào — không cắt bỏ gì, và đó là mặc định đúng
 * cho ô CHÍNH ở những bố cục chỉ có một ô.
 *
 * Ba tỉ lệ còn lại là khai CỐ Ý, và chúng có thật: đo 45 bộ mẫu, đếm hình dạng
 * ô ở mỗi nửa giây thì ngoài toàn khung (60,6%) ra, ô **vuông chiếm 15,4%** —
 * nhiều hơn cả ô dọc 3/4 (8,6%) — còn ngang 16/9 được 7,0%. `ember` dùng cả ba
 * trong một video (vuông 51 · ngang 11 · dọc 11), `volt` và `rocket` cũng thế.
 *
 * Nên "tỉ lệ luôn bám nguồn" đúng với ô chính đứng một mình, mà sai nếu áp cho
 * mọi ô: hai ô CÙNG tỉ lệ chồng lên nhau thì đọc ra là một ô bị nhân đôi, còn
 * hai ô khác tỉ lệ thì đọc ra là hai vai khác nhau.
 */
export type SlotAspect = "nguon" | "vuong" | "ngang" | "doc";

/** Rộng/cao của mỗi tỉ lệ khai cố ý. `nguon` không có ở đây — nó hỏi nguồn. */
const ASPECT_RATIO: Record<Exclude<SlotAspect, "nguon">, number> = {
  vuong: 1,
  ngang: 16 / 9,
  doc: 3 / 4,
};

/**
 * Ô khai tỉ lệ là khai một MONG MUỐN, không phải một mệnh lệnh.
 *
 * ══ VÌ SAO ══
 *
 * Ô phụ khai `ngang` (16:9). Cả bốn tệp tư liệu của dự án thử nghiệm là
 * 720×1280, tức 9:16 — nhét dọc vào ngang thì phép thu-rồi-cắt **bỏ 68%** khung
 * hình. Đúng cái lỗi đã mắc một lần với ô chính, chỉ là lần này tệ hơn: lần
 * trước bỏ 52%.
 *
 * Bố cục không biết trước người dùng nạp gì lên, nên nó không được quyền chốt
 * cứng tỉ lệ của ô đựng thứ ấy.
 *
 * ══ LUẬT ══
 *
 * Tư liệu cho phép những hình dạng nào:
 *
 *   tư liệu DỌC   → ô được dọc hoặc vuông
 *   tư liệu NGANG → ô được ngang hoặc vuông
 *   tư liệu VUÔNG → ô được cả ba
 *
 * Vuông luôn nằm trong danh sách vì nó là hình ở giữa: mọi tỉ lệ vào ô vuông
 * đều mất phần bằng nhau ở hai đầu, không có đầu nào mất hẳn.
 *
 * Mong muốn của bố cục mà nằm trong danh sách thì dùng luôn. Không thì chọn
 * hình XA NHẤT so với ô anh em — vì hai bố cục hai-ô mới sinh ra để hai ô khác
 * hình dạng, và rơi cả hai về vuông là xoá mất chính điều đó.
 */
export function allowedAspects(mediaAspect: number): SlotAspect[] {
  if (mediaAspect < 0.9) return ["doc", "vuong"];
  if (mediaAspect > 1.15) return ["ngang", "vuong"];
  return ["doc", "vuong", "ngang"];
}

/** Chốt tỉ lệ thật của một ô, biết tư liệu nó đựng và ô anh em bên cạnh. */
export function settleAspect(
  want: SlotAspect | undefined,
  mediaAspect: number,
  siblingRatio: number | null,
): SlotAspect {
  const allowed = allowedAspects(mediaAspect);
  if (!want || want === "nguon") return "nguon";
  if (allowed.includes(want)) return want;
  if (siblingRatio === null) return allowed[0];
  // Xa nhất theo thang nhân, không theo hiệu — 0,75 với 1,0 cách 1,0 với 1,78
  // đúng bằng nhau khi nhìn bằng tỉ lệ, mà hiệu thì nói khác hẳn.
  let best = allowed[0];
  let far = -1;
  for (const id of allowed) {
    const d = Math.abs(Math.log(ASPECT_RATIO[id as Exclude<SlotAspect, "nguon">] / siblingRatio));
    if (d > far) { far = d; best = id; }
  }
  return best;
}

export type Slot = {
  role: SlotRole;
  /** Tỉ lệ ô. Thiếu thì bám nguồn. */
  aspect?: SlotAspect;
  /**
   * Ô chiếm bao nhiêu phần DIỆN TÍCH khung — không khai bề rộng và chiều cao.
   *
   * ── VÌ SAO KHÔNG KHAI HÌNH CHỮ NHẬT ──
   *
   * Bản đầu khai thẳng `w × h` chép từ `pulse.mp4`: 0,88 × 0,42, tức một ô NẰM
   * NGANG (tỉ lệ 1,18). Nguồn của người dùng là selfie DỌC (tỉ lệ 0,56). Nhét
   * dọc vào ngang thì phép thu-rồi-cắt **bỏ 52% chiều cao** — ô cắt ngang ngực,
   * chừa đầy trần nhà.
   *
   * Pulse quay bằng footage dựng riêng cho ô ngang. Chép con số mà không chép
   * điều kiện là chép hình dạng chứ không chép ý.
   *
   * Nên ô chỉ khai **to bằng bao nhiêu**, còn **tỉ lệ thì bám nguồn**. Người
   * dùng nạp video ngang thì ô tự nằm ngang; nạp dọc thì ô tự đứng. Một hằng số
   * không phục vụ được cả hai.
   */
  areaShare: number;
  /** Tâm ô đứng đâu, theo tỉ lệ khung. */
  anchor: { x: number; y: number };
  mask: string | null;
  z: number;
};

export type LayoutKindId =
  | "toan-khung"
  | "o-don"
  | "o-vuong"
  | "broll-don"
  | "broll-vuong"
  | "hai-o"
  | "vuong-ngang"
  | "ngang-vuong"
  | "o-lech"
  | "trang-chu";

export type LayoutSpec = {
  id: LayoutKindId;
  label: string;
  note: string;
  slots: Slot[];
  /** Cần tư liệu chèn mới dựng được. */
  needsInsert: boolean;
};

export const LAYOUT_SPECS: LayoutSpec[] = [
  {
    id: "toan-khung",
    label: "Toàn khung",
    note: "Video phủ kín — lối mặc định, và là lối DUY NHẤT trước đợt này",
    slots: [{ role: "chinh", areaShare: 1, anchor: { x: 0.5, y: 0.5 }, mask: null, z: 0 }],
    // Chữ đứng đâu trong khung cũng được; `text-layout.ts` lo dải trên/dưới.
    needsInsert: false,
  },
  {
    id: "o-don",
    label: "Ô đơn",
    note: "Video thu vào một ô trên nền trang, chữ nằm dưới ô",
    slots: [
      // 0,42 diện tích khung. Với nguồn dọc ra ô ~0,72×0,58, bỏ chừng 11% chiều
      // cao thay vì 52% như bản khai cứng.
      { role: "chinh", areaShare: 0.42, anchor: { x: 0.5, y: 0.42 }, mask: "o-bo-goc", z: 0 },
    ],
    needsInsert: false,
  },
  {
    id: "o-vuong",
    label: "Ô vuông",
    // Như `o-don` nhưng ô người ép VUÔNG (1:1) — chân dung vuông vắn trên nền
    // trang, cắt lấy giữa. Không cần tư liệu.
    note: "Người thu vào một ô VUÔNG (1:1) trên nền trang, chữ nằm dưới ô",
    slots: [
      { role: "chinh", aspect: "vuong", areaShare: 0.42, anchor: { x: 0.5, y: 0.42 }, mask: "o-bo-goc", z: 0 },
    ],
    needsInsert: false,
  },
  {
    id: "broll-don",
    label: "B-roll đơn",
    // Tư liệu MỘT MÌNH trên nền trang — cảnh cắt (voiceover), KHÔNG có người. Như
    // Chalk: ảnh b-roll cỡ vừa nằm trên nền phủ kín, mép xé + viền vàng (vì `phu`
    // + có mặt nạ), doodle rải quanh. Ô lớn (0,42 diện tích ~0,65 cạnh), hơi cao
    // để chừa đáy cho phụ đề.
    note: "Tư liệu b-roll một mình trên nền trang — cảnh cắt, không có người",
    slots: [
      // 0,5 diện tích (~0,71 cạnh) — LỚN như Chalk (ảnh chiếm 60-75% màn), chừa
      // nền vừa đủ cho doodle ôm góc, không để trống loãng.
      { role: "phu", areaShare: 0.5, anchor: { x: 0.5, y: 0.42 }, mask: "o-bo-goc", z: 0 },
    ],
    needsInsert: true,
  },
  {
    id: "broll-vuong",
    label: "B-roll vuông",
    // Như `broll-don` nhưng ô ép VUÔNG (1:1): thẻ tư liệu vuông vắn trên nền trang,
    // cảnh cắt không có người. Tỉ lệ nguồn bị crop lấy giữa về 1:1 (xem `SlotAspect`).
    note: "Tư liệu b-roll một mình, ô VUÔNG (1:1) — cảnh cắt, không có người",
    slots: [
      { role: "phu", aspect: "vuong", areaShare: 0.5, anchor: { x: 0.5, y: 0.42 }, mask: "o-bo-goc", z: 0 },
    ],
    needsInsert: true,
  },
  {
    id: "hai-o",
    label: "Hai ô",
    // Hai ô chồng lệch. TƯ LIỆU (b-roll) đè LÊN ô người: chỗ đè là góc dưới của
    // ô người (thân/vai), không phải mặt — b-roll nguyên vẹn, không bị người cắt.
    note: "Ô tư liệu đè lên ô người, chồng lệch; chữ đè lên cả hai",
    slots: [
      { role: "phu", areaShare: 0.3, anchor: { x: 0.62, y: 0.68 }, mask: "o-bo-goc", z: 1 },
      { role: "chinh", areaShare: 0.32, anchor: { x: 0.4, y: 0.3 }, mask: "o-bo-goc", z: 0 },
    ],
    needsInsert: true,
  },
  {
    id: "vuong-ngang",
    label: "Vuông trên, ngang dưới",
    note: "Ô người VUÔNG ở trên, tư liệu 16/9 nằm dưới — hai vai, hai hình dạng",
    slots: [
      // Hai ô KHÔNG chồng nhau và KHÔNG cùng tỉ lệ. `hai-o` cho cả hai bám nguồn
      // nên chúng ra cùng hình dạng, chồng lệch — nhìn ra là một ô bị nhân đôi.
      { role: "chinh", aspect: "vuong", areaShare: 0.3, anchor: { x: 0.5, y: 0.3 }, mask: "o-bo-goc", z: 0 },
      { role: "phu", aspect: "ngang", areaShare: 0.24, anchor: { x: 0.5, y: 0.68 }, mask: "o-bo-goc", z: 1 },
    ],
    needsInsert: true,
  },
  {
    id: "ngang-vuong",
    label: "Ngang trên, vuông dưới",
    note: "Tư liệu 16/9 ở trên, ô người VUÔNG nằm dưới — đảo vai của bố cục trên",
    slots: [
      { role: "phu", aspect: "ngang", areaShare: 0.24, anchor: { x: 0.5, y: 0.28 }, mask: "o-bo-goc", z: 1 },
      { role: "chinh", aspect: "vuong", areaShare: 0.3, anchor: { x: 0.5, y: 0.66 }, mask: "o-bo-goc", z: 0 },
    ],
    needsInsert: true,
  },
  {
    id: "o-lech",
    label: "Ô lệch",
    note: "Ô video dạt xuống dưới, chừa nửa trên cho một khối chữ lớn",
    slots: [
      { role: "chinh", areaShare: 0.4, anchor: { x: 0.5, y: 0.63 }, mask: "o-bo-goc", z: 0 },
    ],
    needsInsert: false,
  },
  {
    id: "trang-chu",
    label: "Trang chữ",
    note: "Không có video — cả khung là nền trang với chữ và hình vẽ",
    slots: [],
    needsInsert: false,
  },
];

/**
 * MỌI kiểu khung CHỌN ĐƯỢC — dùng chung cho picker và cho phép hợp lệ khi dựng.
 *
 * Kiểu khung là CẤU TRÚC, KHÔNG thuộc về một bộ dáng: `pack.layouts` chỉ là tập
 * GỢI Ý mặc định của style (để tự đặt), không phải giới hạn. Người dùng chọn được
 * mọi khung ở mọi style — treatment (viền/nền/mask) do style áp lên bất kỳ khung
 * nào. Trừ `toan-khung` (là MẶC ĐỊNH khi vắng segment, chọn qua nút "Bỏ khung").
 */
export const PICKABLE_LAYOUTS: LayoutKindId[] = LAYOUT_SPECS.filter(
  // `toan-khung` (mặc định khi vắng segment) và `trang-chu` (khung KHÔNG video,
  // chỉ chữ) là hai ca đặc biệt, không phải khung người/b-roll thường — không bày
  // trong picker chọn-khung-cho-một-khoảnh-khắc-video.
  (spec) => spec.id !== "toan-khung" && spec.id !== "trang-chu",
).map((spec) => spec.id);

const BY_ID = new Map(LAYOUT_SPECS.map((spec) => [spec.id, spec]));

/**
 * Tra một bố cục. Tên lạ rơi về `toan-khung`.
 *
 * Rơi về chứ không ném lỗi, cùng lý lẽ với `findStylePack`: một cột CSDL mang
 * tên bố cục đã bỏ thì video vẫn phải xuất được, chỉ là xuất ra lối cũ.
 */
export function findLayout(id: string | null | undefined): LayoutSpec {
  return BY_ID.get(id as LayoutKindId) ?? BY_ID.get("toan-khung")!;
}

/** Bố cục dựng được với những gì dự án đang có. */
export function usableLayouts(hasInserts: boolean): LayoutSpec[] {
  return LAYOUT_SPECS.filter((spec) => !spec.needsInsert || hasInserts);
}

/** Tỉ lệ ô ĐỰNG TƯ LIỆU (slot `phu`) của một khung; thiếu thì `nguon` (bám nguồn). */
export function insertSlotAspect(id: string | null | undefined): SlotAspect {
  return findLayout(id).slots.find((slot) => slot.role === "phu")?.aspect ?? "nguon";
}

/**
 * Khung này có ĐỰNG ĐƯỢC tư liệu tỉ lệ `mediaAspect` mà KHÔNG cắt hỏng không.
 *
 * Ô `nguon` bám tỉ lệ nguồn → hợp mọi thứ. Ô khai cứng (vuông/ngang) chỉ hợp khi
 * tỉ lệ ấy nằm trong danh sách `allowedAspects` — nhét clip dọc vào ô ngang bỏ
 * 68% khung hình (xem `allowedAspects`). Không biết tỉ lệ (null) thì đừng loại.
 */
export function layoutFitsMedia(
  id: string | null | undefined,
  mediaAspect: number | null,
): boolean {
  const aspect = insertSlotAspect(id);
  if (aspect === "nguon") return true;
  if (mediaAspect == null) return true;
  return allowedAspects(mediaAspect).includes(aspect);
}

/**
 * Đổi một Ô sang điểm ảnh — TỈ LỆ BÁM NGUỒN.
 *
 * Ô khai diện tích, tỉ lệ lấy từ video nguồn, rồi kẹp lại cho nằm gọn trong
 * khung có chừa lề. Nhờ vậy phép thu-rồi-cắt gần như không bỏ gì: ô và nguồn
 * cùng tỉ lệ thì chẳng có phần nào thừa để cắt.
 *
 * Chẵn cả hai chiều — bộ lọc video từ chối số lẻ.
 */
const SLOT_MARGIN = 0.04;
/** Mỏng hơn ngần này thì không đủ cho một khối chữ hai dòng. */
const MIN_FREE_BAND = 0.14;

export function slotPixels(
  slot: Pick<Slot, "areaShare" | "anchor" | "aspect">,
  frameWidth: number,
  frameHeight: number,
  /** Tỉ lệ nguồn (rộng/cao). Thiếu thì rơi về tỉ lệ khung. */
  sourceAspect = frameWidth / frameHeight,
): { x: number; y: number; w: number; h: number } {
  const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);
  if (slot.areaShare >= 1) {
    return { x: 0, y: 0, w: even(frameWidth), h: even(frameHeight) };
  }
  const maxW = frameWidth * (1 - SLOT_MARGIN * 2);
  const maxH = frameHeight * (1 - SLOT_MARGIN * 2);
  const area = frameWidth * frameHeight * slot.areaShare;
  const ratio =
    !slot.aspect || slot.aspect === "nguon"
      ? sourceAspect
      : ASPECT_RATIO[slot.aspect];
  let w = Math.sqrt(area * ratio);
  let h = w / ratio;
  // Kẹp theo chiều nào chạm mép trước, giữ nguyên tỉ lệ.
  const shrink = Math.min(1, maxW / w, maxH / h);
  w *= shrink;
  h *= shrink;
  // Neo là TÂM ô, rồi đẩy vào trong khung nếu neo làm nó tràn mép.
  const x = Math.min(
    frameWidth - w - frameWidth * SLOT_MARGIN,
    Math.max(frameWidth * SLOT_MARGIN, frameWidth * slot.anchor.x - w / 2),
  );
  const y = Math.min(
    frameHeight - h - frameHeight * SLOT_MARGIN,
    Math.max(frameHeight * SLOT_MARGIN, frameHeight * slot.anchor.y - h / 2),
  );
  return { x: Math.round(x), y: Math.round(y), w: even(w), h: even(h) };
}

/**
 * Dải NGANG rộng nhất mà không Ô nào chạm — chỗ đặt chữ.
 *
 * Tính từ hình học THẬT của các ô thay vì đọc một con số khai tay. Ô đổi khổ
 * theo tỉ lệ nguồn, nên một `textZone` khai cứng sẽ lệch ngay khi người dùng
 * nạp video khác tỉ lệ — và lệch kiểu ấy là chữ đè lên ô.
 */
export function freeBand(
  slots: readonly Slot[],
  frameWidth: number,
  frameHeight: number,
  sourceAspect?: number,
): Rect {
  if (slots.length === 0) return { x: 0.1, y: 0.28, w: 0.8, h: 0.44 };
  const boxes = slots.map((slot) =>
    slotPixels(slot, frameWidth, frameHeight, sourceAspect),
  );
  const top = Math.min(...boxes.map((b) => b.y));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  const above = top / frameHeight;
  const below = 1 - bottom / frameHeight;
  // Chừa 3% mép để chữ không dính sát khung.
  const pad = 0.03;
  const best = Math.max(above, below);
  /*
   * Dải trống quá mỏng thì KHÔNG có chỗ riêng cho chữ — chữ đè lên ô.
   *
   * Ca này có thật và đúng: `toan-khung` phủ kín nên không chừa gì, còn `hai-o`
   * có hai ô lấp gần hết chiều cao. Cả `pulse` lẫn `focus` đều để chữ đè lên ô
   * ở những bố cục ấy, và nó đọc được vì chữ có nền khối.
   *
   * Trả về cả khung để `text-layout.ts` dùng dải trên/dưới như cũ.
   */
  if (best < MIN_FREE_BAND) return { x: 0, y: 0, w: 1, h: 1 };
  return below >= above
    ? { x: 0.06, y: bottom / frameHeight + pad, w: 0.88, h: below - pad * 2 }
    : { x: 0.06, y: pad, w: 0.88, h: above - pad * 2 };
}
