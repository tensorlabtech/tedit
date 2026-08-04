/**
 * KIỂM Ô VÀ CHUYỂN MÀN. Chạy:
 *
 *   npm run check:slots
 *
 * Hai thứ được canh ở đây, và cả hai đều là lỗi ĐÃ MẮC chứ không phải lỗi tưởng
 * tượng:
 *
 * 1. **Ô ra đúng hình dạng.** Bản đầu khai thẳng `w × h` chép từ một video mẫu
 *    quay ngang, rồi áp lên nguồn dọc — ô bỏ 52% chiều cao mà không phép kiểm
 *    nào đỏ. Giờ ô khai *diện tích + tỉ lệ*, nên phải soát: tỉ lệ `nguon` bám
 *    nguồn, ba tỉ lệ khai cố ý thì KHÔNG bám, và không ô nào tràn khung.
 *
 * 2. **Chuyển màn có đà.** Đo bước nhảy hình học trên bốn video: mẫu rải cú đổi
 *    ra 3–11 khung với bước nhỏ dần, còn bản dựng của mình nhảy 98px gọn trong
 *    MỘT khung. Nên chuỗi lọc phải chứa phép phóng theo `t`, và quãng đà phải
 *    nằm trong dải đo được.
 *
 * Phần cuối cố tình PHÁ để chắc phép kiểm bắt được — một phép kiểm không bao
 * giờ đỏ thì không kiểm gì cả.
 */
import {
  LAYOUT_SPECS,
  findLayout,
  freeBand,
  settleAspect,
  slotPixels,
  type LayoutKindId,
  type Slot,
} from "../../server/layout-kinds";
import { layoutPlan } from "../../server/layout-render";
import type { ScheduledScene } from "../../server/timing";

/** Bộ dáng tối thiểu cho phép kiểm — chỉ ba trục `layoutPlan` thật sự đọc. */
const PACK = {
  page: { tone: { color: "#000", alpha: 1 }, grid: null },
  layouts: [] as LayoutKindId[],
  scenePush: null,
};

const W = 1080;
const H = 1920;
/** Nguồn selfie dọc — đúng thứ người dùng nạp vào, và là ca làm lộ lỗi cũ. */
const DOC = 1080 / 1920;

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  đạt   ${label}`);
  } else {
    failed += 1;
    console.log(`  TRƯỢT ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\nÔ nằm gọn trong khung và đúng diện tích khai");
for (const spec of LAYOUT_SPECS) {
  for (const [i, slot] of spec.slots.entries()) {
    const box = slotPixels(slot, W, H, DOC);
    const inside =
      box.x >= 0 && box.y >= 0 && box.x + box.w <= W && box.y + box.h <= H;
    check(`"${spec.label}" ô ${i} nằm trong khung`, inside, JSON.stringify(box));
    if (slot.areaShare < 1) {
      // Ô bị KẸP lại khi neo đẩy nó ra mép, nên diện tích thật chỉ được PHÉP
      // nhỏ hơn khai, không được lớn hơn.
      const share = (box.w * box.h) / (W * H);
      check(
        `"${spec.label}" ô ${i} không phình quá diện tích khai`,
        share <= slot.areaShare + 0.005,
        `khai ${slot.areaShare} ra ${share.toFixed(3)}`,
      );
    }
  }
}

console.log("\nTỉ lệ ô: `nguon` bám nguồn, khai cố ý thì KHÔNG");
const ratios: Record<string, number> = { vuong: 1, ngang: 16 / 9, doc: 3 / 4 };
for (const spec of LAYOUT_SPECS) {
  for (const [i, slot] of spec.slots.entries()) {
    if (slot.areaShare >= 1) continue;
    const box = slotPixels(slot, W, H, DOC);
    const got = box.w / box.h;
    const want = !slot.aspect || slot.aspect === "nguon" ? DOC : ratios[slot.aspect];
    check(
      `"${spec.label}" ô ${i} ra tỉ lệ ${slot.aspect ?? "nguon"}`,
      Math.abs(got - want) < 0.02,
      `mong ${want.toFixed(3)} ra ${got.toFixed(3)}`,
    );
  }
}

console.log("\nBố cục hai ô: hai ô KHÁC hình dạng và không nuốt nhau");
for (const spec of LAYOUT_SPECS) {
  if (spec.slots.length < 2) continue;
  const boxes = spec.slots.map((s) => slotPixels(s, W, H, DOC));
  const shapes = boxes.map((b) => b.w / b.h);
  /*
   * `hai-o` để CẢ HAI ô bám nguồn nên chúng ra cùng hình dạng — đó là bố cục
   * "chồng lệch", và nó đúng ý đồ. Hai bố cục mới thì phải khác nhau, không thì
   * chúng chỉ là `hai-o` đổi chỗ.
   */
  const declared = spec.slots.filter((s) => s.aspect && s.aspect !== "nguon");
  if (declared.length === spec.slots.length) {
    check(
      `"${spec.label}" hai ô khác hình dạng`,
      Math.abs(shapes[0] - shapes[1]) > 0.2,
      shapes.map((s) => s.toFixed(2)).join(" vs "),
    );
    // Không chồng nhau: bố cục khai tỉ lệ là bố cục xếp cạnh, không xếp đè.
    const [a, b] = boxes;
    const overlap =
      Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    check(`"${spec.label}" hai ô không chồng nhau`, overlap === 0, `${overlap}px²`);
  }
  const covered = boxes.reduce((sum, b) => sum + b.w * b.h, 0) / (W * H);
  check(`"${spec.label}" chừa lại nền trang`, covered < 0.85, `phủ ${covered.toFixed(2)}`);
}

console.log("\nDải chữ suy ra từ hình học thật");
for (const spec of LAYOUT_SPECS) {
  const band = freeBand(spec.slots, W, H, DOC);
  const full = band.h >= 0.99;
  const boxes = spec.slots.map((s) => slotPixels(s, W, H, DOC));
  if (!full && boxes.length > 0) {
    // Dải riêng thì KHÔNG được đè lên ô nào.
    const y0 = band.y * H;
    const y1 = (band.y + band.h) * H;
    const hit = boxes.some((b) => b.y < y1 && b.y + b.h > y0);
    check(`"${spec.label}" dải chữ riêng không đè ô`, !hit);
  } else {
    check(`"${spec.label}" không đủ chỗ riêng → chữ đè lên ô`, full || boxes.length === 0);
  }
}

console.log("\nChuyển màn CÓ ĐÀ, không nhảy một khung");
const scenes: ScheduledScene[] = [
  { start: 0, end: 3.5, layout: "o-don", hero: "chu-khoi", heroSeconds: 2.5 },
  { start: 3.5, end: 7.0, layout: "toan-khung", hero: null },
];
const withPage = layoutPlan(
  PACK,
  scenes,
  ["[a]", "[b]"],
  "/png",
  W,
  H,
  [],
  [],
  7,
  DOC,
);
const all = withPage.chains.join(";");
check("có phép phóng theo từng khung", all.includes("eval=frame"), all.slice(0, 120));
check(
  "quãng đà nằm trong dải đo được (0,10–0,20s)",
  /\/0\.(1[0-9]|20)\b/.test(all) || all.includes("/0.2)"),
  all.match(/min\(1[^)]*\)/)?.[0] ?? "không thấy",
);
check(
  "ô nở quanh TÂM, không quanh mép trái",
  withPage.overlays.every((o) => String(o.x).includes("-w/2")),
  JSON.stringify(withPage.overlays.map((o) => o.x)),
);
/*
 * Màn thứ hai phải XUẤT PHÁT từ ô của màn thứ nhất.
 *
 * Nở từ 0,82 của chính nó thì khung đầu vẫn nuốt 67% cú đổi — đo được trên bản
 * dựng thật, trong khi `pulse` nuốt 50%. Khác nhau nằm ở quãng từ ô CŨ xuống
 * 0,82 ô mới: nó vẫn là một cú nhảy tức thì.
 *
 * `toan-khung` ở đây là màn thứ hai, đi sau một `o-don` nhỏ hơn hẳn — nên cả
 * khổ lẫn tâm của nó đều phải mang một số hạng nội suy, không được là hằng số.
 */
const full = withPage.chains.find((c) => c.includes("ly1s0]scale") || c.includes("[ly1s0c]"));
check(
  "màn sau xuất phát từ ô của màn trước (khổ)",
  !!full && /between\(t\\,3\.500/.test(full),
  full?.slice(-160) ?? "không thấy chuỗi",
);
const secondY = String(withPage.overlays[1]?.y ?? "");
check(
  "màn sau xuất phát từ ô của màn trước (tâm)",
  secondY.includes("between(t"),
  secondY.slice(0, 120),
);
/*
 * Thử phá: lịch chỉ có MỘT màn thì không có màn trước, nên không được có số
 * hạng nội suy tâm — ô nở tại chỗ từ nền trang trống.
 */
const lone = layoutPlan(
  PACK,
  [scenes[0]], ["[a]"], "/png", W, H, [], [], 4, DOC,
);
check(
  "màn đầu phim nở tại chỗ, không lướt từ đâu cả",
  !String(lone.overlays[0]?.x ?? "").includes("between(t"),
  String(lone.overlays[0]?.x ?? ""),
);
/*
 * Không có nền trang thì KHÔNG nở.
 *
 * Lớp dưới lúc ấy là chính khung hình gốc, nên một ô toàn khung co lại 82% sẽ
 * để lộ khung hình ấy quanh mép — đọc ra là lỗi chồng hình, không ra là chuyển
 * cảnh.
 */
const noPage = layoutPlan(
  { ...PACK, page: null }, scenes, ["[a]", "[b]"], "/png", W, H, [], [], 7, DOC,
);
check(
  "không nền trang thì KHÔNG nở",
  !noPage.chains.join(";").includes("eval=frame"),
);

/*
 * ══ MỖI LẦN CHÈN MỘT TƯ LIỆU KHÁC ══
 *
 * Bản trước đọc `LIMIT 1` từ CSDL nên cả phim dùng chung một ảnh. Dự án thử
 * nghiệm có BỐN tệp, dùng đúng một — và vì bố cục vẫn đổi hình dạng đều đặn,
 * lỗi này đọc ra là "b-roll hơi lặp" chứ không đọc ra là "hệ thống bỏ quên ba
 * tệp".
 */
console.log("\nTư liệu chèn xoay vòng, không dùng mãi một tệp");
const brollScenes: ScheduledScene[] = [
  { start: 0, end: 3.5, layout: "hai-o", hero: "a", heroSeconds: 2.5, insert: 0 },
  { start: 3.5, end: 7.0, layout: "hai-o", hero: null, insert: 1 },
  { start: 7.0, end: 10.5, layout: "hai-o", hero: "b", heroSeconds: 2.5, insert: 2 },
];
const rotated = layoutPlan(
  PACK,
  brollScenes, ["[a]"], "/png", W, H,
  ["/tu-lieu/mot.mp4", "/tu-lieu/hai.mp4", "/tu-lieu/ba.mp4"],
  [DOC, DOC, DOC],
  11, DOC,
);
const graph = rotated.chains.join(";");
for (const name of ["mot", "hai", "ba"]) {
  check(`tệp "${name}" có trong chuỗi lọc`, graph.includes(`/tu-lieu/${name}.mp4`));
}
check(
  "mỗi tệp một lớp phủ riêng, bật ở đúng màn của nó",
  rotated.overlays.filter((o) => o.enable.split("+").length === 1).length >= 3,
  rotated.overlays.map((o) => o.enable).join(" | ").slice(0, 140),
);
/*
 * Thử phá: chỉ có MỘT tệp thì ba màn phải cùng dùng nó — chia dư quay vòng về
 * 0. Không có phép này thì một lỗi chỉ số ngoài mảng sẽ ra ô trống lặng lẽ.
 */
const lonely = layoutPlan(
  PACK,
  brollScenes, ["[a]"], "/png", W, H, ["/tu-lieu/mot.mp4"], [DOC], 11, DOC,
);
check(
  "một tệp thì cả ba màn vẫn có ô phụ",
  lonely.chains.join(";").split("/tu-lieu/mot.mp4").length - 1 === 3,
  `${lonely.chains.join(";").split("/tu-lieu/mot.mp4").length - 1} lớp`,
);

/*
 * ══ MÁY QUAY DỒN VÀO ══
 *
 * Đo kho mẫu: core 10 %/giây · focus 10 · pulse 6 · ember 4 · volt 2 · rocket 0.
 * Nhưng chỉ 1–3 trên 15–59 cặp khung có phóng — nên nó phải bật ở MỘT SỐ màn,
 * không phải mọi màn. Dồn khắp nơi thì nó thôi là chuyển động và thành nền.
 */
console.log("\nMáy quay dồn vào: có, nhưng không ở mọi màn");
const pushScenes: ScheduledScene[] = [
  { start: 0, end: 4.0, layout: "toan-khung", hero: "a", heroSeconds: 2.5 },
  { start: 4.0, end: 8.0, layout: "toan-khung", hero: null, push: true },
  { start: 8.0, end: 12.0, layout: "toan-khung", hero: "b", heroSeconds: 2.5 },
];
const pushed = layoutPlan(
  { ...PACK, scenePush: { ratePerSecond: 0.06, share: 0.3 } },
  pushScenes, ["[a]"], "/png", W, H, [], [], 12, DOC,
);
const pchain = pushed.chains.join(";");
check("có số hạng dồn khi bộ dáng khai", pchain.includes("min(0.12"), pchain.slice(-120));
check(
  "chỉ màn CÓ cờ mới dồn",
  (pchain.match(/min\(0\.12/g) ?? []).length === 2, // một cho khổ, một cho chiều cao
  `${(pchain.match(/min\(0\.12/g) ?? []).length} số hạng`,
);
const noPush = layoutPlan(
  { ...PACK, scenePush: null }, pushScenes, ["[a]"], "/png", W, H, [], [], 12, DOC,
);
check(
  "bộ dáng không khai thì KHÔNG có số hạng dồn",
  !noPush.chains.join(";").includes("min(0.12"),
);
/*
 * Trần 12%: dồn 6%/giây suốt một màn 15 giây là 90%, tức mất gần nửa khung —
 * không mẫu nào làm thế. Chặn ở tầng biểu thức chứ không ở tầng xếp lịch, vì
 * độ dài màn do luật thời gian quyết chứ không do trục này.
 */
const longPush = layoutPlan(
  { ...PACK, scenePush: { ratePerSecond: 0.06, share: 1 } },
  [{ start: 0, end: 15.0, layout: "toan-khung", hero: null, push: true }],
  ["[a]"], "/png", W, H, [], [], 15, DOC,
);
check("màn dài vẫn bị chặn ở trần", longPush.chains.join(";").includes("min(0.12"));

/*
 * ══ Ô PHỤ BÁM TỈ LỆ TƯ LIỆU, KHÔNG BÁM TỈ LỆ KHAI ══
 *
 * Ô phụ khai `ngang` (16:9), còn cả bốn tệp tư liệu của dự án thử nghiệm là
 * 720×1280 (dọc 9:16) — nhét dọc vào ngang bỏ mất **68%** khung hình. Cùng loại
 * lỗi đã mắc với ô chính, chỉ tệ hơn: lần trước bỏ 52%.
 *
 * Tỉ lệ khai của bố cục là MONG MUỐN. Tư liệu quyết định danh sách hình dạng
 * dựng được, và mong muốn nằm ngoài danh sách thì phải nhường.
 */
console.log("\nÔ phụ bám tỉ lệ TƯ LIỆU");
const DOC_MEDIA = 9 / 16;
const NGANG_MEDIA = 16 / 9;
for (const spec of LAYOUT_SPECS) {
  const phu = spec.slots.find((s) => s.role === "phu");
  const chinh = spec.slots.find((s) => s.role === "chinh");
  if (!phu || !chinh) continue;
  const mateRatio = (() => {
    const b = slotPixels(chinh, W, H, DOC);
    return b.w / b.h;
  })();
  for (const [name, media] of [["dọc 9:16", DOC_MEDIA], ["ngang 16:9", NGANG_MEDIA], ["vuông", 1]] as const) {
    const settled = settleAspect(phu.aspect, media, mateRatio);
    const box = slotPixels({ ...phu, aspect: settled }, W, H, media);
    const kept = Math.min(box.w / box.h, media) / Math.max(box.w / box.h, media);
    check(
      `"${spec.label}" ô phụ với tư liệu ${name} → ${settled}, giữ ${(kept * 100).toFixed(0)}%`,
      kept >= 0.55,
      `bỏ ${((1 - kept) * 100).toFixed(0)}% khung tư liệu`,
    );
  }
}
/*
 * Hai ô vẫn phải KHÁC hình dạng sau khi nhường.
 *
 * Rơi cả hai về vuông là xoá mất chính điều hai bố cục ấy sinh ra để làm — nên
 * khi mong muốn không dựng được, chọn hình XA NHẤT so với ô anh em.
 */
for (const id of ["vuong-ngang", "ngang-vuong"] as const) {
  const spec = findLayout(id);
  const chinh = spec.slots.find((s) => s.role === "chinh")!;
  const phu = spec.slots.find((s) => s.role === "phu")!;
  const a = slotPixels(chinh, W, H, DOC);
  const settled = settleAspect(phu.aspect, DOC_MEDIA, a.w / a.h);
  const b = slotPixels({ ...phu, aspect: settled }, W, H, DOC_MEDIA);
  check(
    `"${spec.label}" hai ô vẫn khác hình dạng với tư liệu dọc`,
    Math.abs(a.w / a.h - b.w / b.h) > 0.2,
    `${(a.w / a.h).toFixed(2)} vs ${(b.w / b.h).toFixed(2)}`,
  );
}

/*
 * ══ CẮT GIỮA, KHÔNG DỊCH ══
 *
 * Phép dịch cũ chạy VỀ PHÍA dải rỗng người nhất thay vì tránh xa, và `max(0,…)`
 * khiến nó chỉ lên được chứ không bao giờ xuống. Đo mặt nạ một bản thật ở giây
 * 60, mười dải từ trên xuống: 0 · 0 · 8 · 34 · 101 · 105 · 87 · 197 · 252 · 255
 * — dải rỗng nhất là dải 0, và công thức đẩy khung cắt lên đúng chỗ ấy.
 */
console.log("\nPhép cắt lấy GIỮA");
const centred = layoutPlan(
  PACK,
  [{ start: 0, end: 4, layout: "vuong-ngang", hero: "a", heroSeconds: 2.5, insert: 0 }],
  ["[a]"], "/png", W, H, ["/tu-lieu/mot.mp4"], [DOC_MEDIA], 4, DOC,
);
const crops = centred.chains.join(";").match(/crop=[^,\]]*/g) ?? [];
check(`có phép cắt (${crops.length} chỗ)`, crops.length > 0);
check(
  "không chỗ cắt nào mang số dịch",
  crops.every((c) => /^crop=\d+:\d+$/.test(c)),
  crops.filter((c) => !/^crop=\d+:\d+$/.test(c)).join(" · "),
);

console.log("\nPhép kiểm BẮT được lỗi (thử phá)");
const broken: Array<[string, Slot, boolean]> = [
  // Khai tỉ lệ ngang mà ra tỉ lệ nguồn dọc → phép so tỉ lệ phải đỏ.
  ["ô ngang lại ra dọc", { role: "phu", aspect: "ngang", areaShare: 0.24, anchor: { x: 0.5, y: 0.5 }, mask: null, z: 0 }, true],
  // Diện tích 0,9 với neo giữa → phải bị kẹp lại, không tràn khung.
  ["ô quá to bị kẹp trong khung", { role: "chinh", areaShare: 0.9, anchor: { x: 0.5, y: 0.5 }, mask: null, z: 0 }, false],
];
for (const [name, slot, wantsRatio] of broken) {
  const box = slotPixels(slot, W, H, DOC);
  if (wantsRatio) {
    check(`bắt được "${name}"`, Math.abs(box.w / box.h - DOC) > 0.2, `${(box.w / box.h).toFixed(2)}`);
  } else {
    check(
      `bắt được "${name}"`,
      box.x >= 0 && box.y >= 0 && box.x + box.w <= W && box.y + box.h <= H,
      JSON.stringify(box),
    );
  }
}
// Bố cục lạ phải rơi về `toan-khung` chứ không ném lỗi.
check("tên bố cục lạ rơi về toàn khung", findLayout("khong-co-that").id === "toan-khung");

console.log(`\n${passed} đạt, ${failed} trượt`);
process.exit(failed === 0 ? 0 : 1);
