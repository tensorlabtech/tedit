/**
 * KIỂM HÌNH HỌC BỐ CỤC Ở KHUNG XEM TRƯỚC. Chạy:
 *
 *   npm run check:scene-preview
 *
 * Khung xem trước dựng bố cục cảnh bằng `sceneCells` (màn hình), còn bản xuất dựng
 * bằng `slotPixels`/`settleAspect`/`entryOf` (ffmpeg). Cả hai gọi CÙNG các hàm
 * thuần, nên hình học phải trùng — phép kiểm này canh đúng điều đó, và bắt những
 * lệch im lặng có thật:
 *
 * 1. **Ô HỘI TỤ.** Đà đổi màn phải chạy hết sau `RAMP` giây: quá mốc ấy, ô của
 *    `sceneCells` phải bằng đúng ô tĩnh `slotPixels` — nếu công thức `ease` sai
 *    thì ô đứng lệch mãi mà không ai thấy.
 * 2. **Ô CÓ ĐÀ.** Ngay đầu màn (trừ màn đầu phim), ô phải KHÁC ô đích — nếu quên
 *    nối `entryOf` thì ô bật ra đứng im, đúng lỗi cả hệ này chống.
 * 3. **Ô PHỤ ĐO THEO TƯ LIỆU.** `settleAspect` phải chốt tỉ lệ ô phụ theo tư
 *    liệu thật, không theo video chính — sai thì tư liệu dọc nhét vào ô ngang.
 * 4. **KHỔ + %.** `FRAME_W/H` và phép đổi sang phần trăm hai bên phải khớp.
 *
 * Phần cuối cố tình PHÁ để chắc phép kiểm bắt được.
 */
import {
  findLayout,
  settleAspect,
  slotPixels,
} from "../../server/layout-kinds";
import type { ScheduledScene } from "../../server/timing";
import type { SceneInsert } from "../../server/scene-schedule";
import {
  sceneCells,
  type CellBox,
} from "../../src/routes/editor/scene-layout-geometry";

const FRAME_W = 1080;
const FRAME_H = 1920;

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  đạt   ${name}`);
  } else {
    failed += 1;
    console.log(`  TRƯỢT ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Ô tĩnh (nguồn sự thật) của một slot, đổi sang phần trăm khung. */
function staticBox(
  slot: Parameters<typeof slotPixels>[0],
  mediaAspect: number,
): CellBox {
  const box = slotPixels(slot, FRAME_W, FRAME_H, mediaAspect);
  return {
    left: (box.x / FRAME_W) * 100,
    top: (box.y / FRAME_H) * 100,
    width: (box.w / FRAME_W) * 100,
    height: (box.h / FRAME_H) * 100,
    masked: false,
  };
}

function near(a: number, b: number, tol = 0.05) {
  return Math.abs(a - b) <= tol;
}
function boxNear(a: CellBox, b: CellBox, tol = 0.05) {
  return (
    near(a.left, b.left, tol) &&
    near(a.top, b.top, tol) &&
    near(a.width, b.width, tol) &&
    near(a.height, b.height, tol)
  );
}

// Nguồn dọc 9:16, một tệp tư liệu NGANG — để đo đúng chỗ `settleAspect` phải chốt.
const SOURCE_ASPECT = 720 / 1280;
const INSERTS: SceneInsert[] = [{ id: "a", aspect: 1280 / 720, isVideo: true }];

const SCHEDULE: ScheduledScene[] = [
  { start: 0, end: 3, layout: "o-don", hero: "doi-bo-cuc", heroSeconds: 3 },
  { start: 3, end: 6, layout: "vuong-ngang", hero: null, insert: 0 },
  { start: 6, end: 9, layout: "toan-khung", hero: "doi-bo-cuc", heroSeconds: 3 },
];

const RAMP = 0.2;

for (const scene of SCHEDULE) {
  const spec = findLayout(scene.layout);
  // ── 1. Ô hội tụ sau RAMP ──
  const settled = sceneCells(
    SCHEDULE,
    SOURCE_ASPECT,
    scene.start + RAMP + 0.1,
    INSERTS,
    0,
  );
  const chinh = spec.slots.find((s) => s.role === "chinh");
  if (chinh) {
    const want = staticBox(chinh, SOURCE_ASPECT);
    check(
      `[${scene.layout}] ô chính hội tụ về ô tĩnh sau RAMP`,
      !!settled.main && boxNear(settled.main, want),
      settled.main
        ? `xem ${settled.main.width.toFixed(2)}% vs xuất ${want.width.toFixed(2)}%`
        : "không có ô chính",
    );
  }

  // ── 3. Ô phụ đo theo tư liệu ──
  const phu = spec.slots.find((s) => s.role === "phu");
  if (phu) {
    const mate = spec.slots.find((s) => s !== phu)!;
    const mateBox = slotPixels(mate, FRAME_W, FRAME_H, SOURCE_ASPECT);
    const settledAspect = settleAspect(
      phu.aspect,
      INSERTS[0].aspect,
      mateBox.w / mateBox.h,
    );
    const want = staticBox(
      { ...phu, aspect: settledAspect },
      INSERTS[0].aspect,
    );
    check(
      `[${scene.layout}] ô phụ chốt tỉ lệ theo tư liệu (settleAspect)`,
      settled.inserts.length === 1 && boxNear(settled.inserts[0].box, want),
      settled.inserts[0]
        ? `xem ${settled.inserts[0].box.width.toFixed(2)}% vs xuất ${want.width.toFixed(2)}%`
        : "không có ô phụ",
    );
  }
}

// ── 2. Ô CÓ ĐÀ: đầu màn thứ hai phải khác ô đích ──
{
  const scene = SCHEDULE[1];
  const spec = findLayout(scene.layout);
  const chinh = spec.slots.find((s) => s.role === "chinh")!;
  const target = staticBox(chinh, SOURCE_ASPECT);
  const atOpen = sceneCells(SCHEDULE, SOURCE_ASPECT, scene.start, INSERTS, 0);
  check(
    "ô chính có ĐÀ ở đầu màn (khác ô đích lúc t=start)",
    !!atOpen.main && !boxNear(atOpen.main, target, 0.5),
    atOpen.main
      ? `mở ${atOpen.main.width.toFixed(2)}% vs đích ${target.width.toFixed(2)}%`
      : "không có ô chính",
  );
}

// ── PHÁ có chủ ý: hụt một khung khác thì phải LỆCH ──
{
  const spec = findLayout("o-don");
  const chinh = spec.slots.find((s) => s.role === "chinh")!;
  const wrong = staticBox(chinh, 1); // đo bằng tỉ lệ khung, không phải nguồn dọc
  const settled = sceneCells(SCHEDULE, SOURCE_ASPECT, 0.4, INSERTS, 0);
  check(
    "phép kiểm BẮT được lệch tỉ lệ nguồn (phá có chủ ý)",
    !!settled.main && !boxNear(settled.main, wrong),
  );
}

console.log(`\n${passed} đạt, ${failed} trượt`);
if (failed > 0) process.exit(1);
