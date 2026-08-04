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
  slotPixels,
  type Slot,
} from "../../server/layout-kinds";
import { layoutPlan } from "../../server/layout-render";
import type { ScheduledScene } from "../../server/timing";

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
  { page: { tone: { color: "#000", alpha: 1 }, grid: null }, layouts: [] },
  scenes,
  ["[a]", "[b]"],
  "/png",
  W,
  H,
  null,
  7,
  DOC,
  0,
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
  { page: { tone: { color: "#000", alpha: 1 }, grid: null }, layouts: [] },
  [scenes[0]], ["[a]"], "/png", W, H, null, 4, DOC, 0,
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
  { page: null, layouts: [] }, scenes, ["[a]", "[b]"], "/png", W, H, null, 7, DOC, 0,
);
check(
  "không nền trang thì KHÔNG nở",
  !noPage.chains.join(";").includes("eval=frame"),
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
