import { findLayout, settleAspect, slotPixels } from "../../../server/layout-kinds";
import { entryOf, PUSH_MAX, RAMP } from "../../../server/layout-render";
import type { SceneInsert } from "../../../server/scene-schedule";
import type { ScheduledScene } from "../../../server/timing";

/**
 * Hình học Ô cho khung xem trước — gọi CHÍNH `slotPixels`/`settleAspect`/`entryOf`
 * mà bản xuất dùng.
 *
 * Ô khai diện tích, tỉ lệ bám nguồn; các hàm ấy đều thuần nên gọi lại ở đây KHÔNG
 * lệch bản xuất. Đo ở đúng khổ xuất (1080×1920) rồi đổi sang phần trăm khung, để
 * phép làm tròn trùng khít bản in ra chứ không lệch vài điểm ảnh vì khác khổ.
 */
const FRAME_W = 1080;
const FRAME_H = 1920;

export type CellBox = {
  /** Vị trí và khổ ô, phần trăm khung. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Ô có bo góc (mặt nạ `o-bo-goc`) hay không. */
  masked: boolean;
};

export type SceneCells = {
  /** Ô người nói. `null` khi màn không có video (`trang-chu`). */
  main: CellBox | null;
  /**
   * Ô tư liệu. `media = null` là ô phụ CHƯA gắn tư liệu (khung 2 ô placeholder) —
   * vẫn vẽ khung ô để thấy cấu trúc, chỉ chưa có nội dung.
   */
  inserts: Array<{ box: CellBox; media: SceneInsert | null }>;
};

/** Màn đang chạy tại một giây trên dải đã cắt. `null` khi ngoài lịch. */
export function activeScene(
  schedule: readonly ScheduledScene[],
  seconds: number,
): ScheduledScene | null {
  return (
    schedule.find((scene) => seconds >= scene.start && seconds < scene.end) ?? null
  );
}

/**
 * Đường cong của một màn: 0 lúc màn mở, 1 sau `RAMP` giây.
 *
 * Thường là CHẬM DẦN `1-(1-p)³`. Riêng `broll-don` dùng easeOutBack (vọt QUÁ 1 rồi
 * dội về) để ảnh b-roll POP NẢY "thả xuống trang" — khớp `ease()` ở
 * `layout-render.ts` (server viết dạng biểu thức ffmpeg cho cùng công thức).
 */
function ease(scene: ScheduledScene, seconds: number): number {
  const p = Math.min(1, Math.max(0, (seconds - scene.start) / RAMP));
  if (scene.layout === "broll-don") {
    return 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2);
  }
  return 1 - Math.pow(1 - p, 3);
}

/**
 * Ô CHÍNH + ô PHỤ của màn tại một giây — ĐÃ tính đà đổi màn và máy quay dồn.
 *
 * Đà: mỗi ô xuất phát từ hình học màn trước (`entryOf`) rồi chậm dần vào chỗ trong
 * `RAMP` giây. Dồn: màn nghỉ có `push` phóng dần tới trần `PUSH_MAX`. Cùng công
 * thức `glide`/`pushFactor` của bản xuất, chỉ khác đầu ra: số thay vì biểu thức.
 */
export function sceneCells(
  schedule: readonly ScheduledScene[],
  sourceAspect: number | null,
  seconds: number,
  inserts: readonly SceneInsert[],
  /** `pack.scenePush?.ratePerSecond` — 0 là bộ không có trục dồn. */
  pushRate = 0,
): SceneCells {
  const scene = activeScene(schedule, seconds);
  if (!scene) return { main: null, inserts: [] };
  const spec = findLayout(scene.layout);
  const remain = 1 - ease(scene, seconds);
  const pushGrow =
    scene.push && pushRate > 0
      ? 1 + Math.min(PUSH_MAX, pushRate * (seconds - scene.start))
      : 1;

  // Đổi một ô TĨNH (điểm ảnh) sang ô ĐỘNG (phần trăm) — nội suy khổ + tâm từ màn
  // trước, rồi nhân dồn. Cùng một phép cho ô chính lẫn ô phụ.
  const animate = (
    box: { x: number; y: number; w: number; h: number },
    masked: boolean,
  ): CellBox => {
    const entry = entryOf(
      scene,
      schedule,
      box,
      FRAME_W,
      FRAME_H,
      sourceAspect ?? undefined,
    );
    const tcx = box.x + box.w / 2;
    const tcy = box.y + box.h / 2;
    const cx = tcx + (entry.cx0 - tcx) * remain;
    const cy = tcy + (entry.cy0 - tcy) * remain;
    const grow = (1 + (entry.k0 - 1) * remain) * pushGrow;
    const w = box.w * grow;
    const h = box.h * grow;
    return {
      left: ((cx - w / 2) / FRAME_W) * 100,
      top: ((cy - h / 2) / FRAME_H) * 100,
      width: (w / FRAME_W) * 100,
      height: (h / FRAME_H) * 100,
      masked,
    };
  };

  let main: CellBox | null = null;
  const cells: SceneCells["inserts"] = [];

  for (const slot of spec.slots) {
    if (slot.role === "chinh") {
      const box = slotPixels(slot, FRAME_W, FRAME_H, sourceAspect ?? undefined);
      main = animate(box, slot.mask !== null);
      continue;
    }
    // Ô PHỤ. Khung 2 ô CHƯA gắn tư liệu (`scene.insert` trống) → vẽ ô PLACEHOLDER:
    // vẫn có khung để thấy cấu trúc, chỉ chưa có nội dung. Có tư liệu thì đo ô theo
    // tỉ lệ tệp thật.
    const media = scene.insert !== undefined ? inserts[scene.insert] : null;
    if (scene.insert !== undefined && !media) continue; // an toàn
    // Tỉ lệ ô: theo tệp nếu có, không thì theo tỉ lệ khai của slot (placeholder).
    const mate = spec.slots.find((other) => other !== slot);
    const mateBox = mate
      ? slotPixels(mate, FRAME_W, FRAME_H, sourceAspect ?? undefined)
      : null;
    const settled = settleAspect(
      slot.aspect,
      media?.aspect ?? 1,
      mateBox ? mateBox.w / mateBox.h : null,
    );
    const box = slotPixels(
      { ...slot, aspect: settled },
      FRAME_W,
      FRAME_H,
      media?.aspect ?? sourceAspect ?? undefined,
    );
    cells.push({ box: animate(box, slot.mask !== null), media });
  }

  return { main, inserts: cells };
}
