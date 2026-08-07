import { existsSync } from "node:fs";
import { join } from "node:path";

import { scheduleScenes } from "./layout-schedule";
import { buildPlacedSegments } from "./layout-segments";
import { type LayoutKindId, findLayout } from "./layout-kinds";
import { probe } from "./media-tools";
import { workDir } from "./paths";
import { VIDEO } from "./routes/media-formats";
import { keptRanges } from "./pipeline";
import { readStylePack } from "./style-pack-store";
import { subjectPath } from "./subject-mask";
import type { ScheduledScene } from "./timing";

/**
 * LỊCH MÀN cho khung xem trước — cùng đường tính với bản xuất.
 *
 * Lịch màn nay THƯA: chỉ gồm các segment ĐÃ ĐẶT (b-roll + ô người), đọc từ cùng
 * một nguồn `buildPlacedSegments` mà `pipeline.ts` dùng lúc xuất. Khoảng trống =
 * toàn-khung (mặc định), không sinh màn. Màn hình chỉ đổi lịch ấy sang hình học
 * bằng `slotPixels` (hàm thuần) rồi vẽ.
 */
/** Một tệp tư liệu cho ô `phu`, theo thứ tự `scene.insert` tra vào. */
export type SceneInsert = {
  /** ID tệp — màn hình dựng URL bằng `api.mediaUrl(id)`. */
  id: string;
  /** Tỉ lệ (rộng/cao) của tệp — ô phu đo theo số này, không theo video chính. */
  aspect: number;
  isVideo: boolean;
};

/** Một bố cục chọn được ở picker — mã + nhãn tiếng Việt. */
export type LayoutChoice = { id: LayoutKindId; label: string };

export type SceneScheduleResult = {
  schedule: ScheduledScene[];
  /** Tỉ lệ (rộng/cao) video chính. `null` khi chưa dựng được. */
  sourceAspect: number | null;
  /** Tệp tư liệu cho ô `phu`, cùng thứ tự `scene.insert` tra vào. */
  inserts: SceneInsert[];
  /** Dự án đã tách nền người chưa — dùng cho chữ-sau-người / viền-người. */
  hasSubject: boolean;
  /** MỌI bố cục bộ dáng khai (cả b-roll) — modal chọn hiện đủ, b-roll thì đòi tư liệu. */
  allowedLayouts: LayoutChoice[];
};

const EMPTY: SceneScheduleResult = {
  schedule: [],
  sourceAspect: null,
  inserts: [],
  hasSubject: false,
  allowedLayouts: [],
};

export async function buildSceneSchedule(
  projectId: string,
): Promise<SceneScheduleResult> {
  const pack = readStylePack(projectId);
  // Bộ dáng không khai bố cục thì không có lịch — màn hình giữ nguyên video phủ kín.
  if (pack.layouts.length === 0) return EMPTY;

  const base = join(workDir(projectId), "base.mp4");
  if (!existsSync(base)) return EMPTY;
  const baseInfo = await probe(base).catch(() => null);
  if (!baseInfo) return EMPTY;

  const kept = keptRanges(projectId, baseInfo.duration);
  const keptTotal = kept.reduce(
    (sum, range) => sum + (range.end - range.start),
    0,
  );

  const { segments, media } = buildPlacedSegments(projectId, kept, pack.layouts);

  const inserts: SceneInsert[] = await Promise.all(
    media.map(async (item) => {
      const info = await probe(item.path).catch(() => null);
      return {
        id: item.mediaId,
        aspect: info?.width && info?.height ? info.width / info.height : 1,
        isVideo: VIDEO.test(item.name),
      };
    }),
  );

  const schedule = scheduleScenes(keptTotal, segments);

  // Picker hiện MỌI bố cục bộ dáng khai (cả b-roll) TRỪ toàn-khung — toàn-khung là
  // MẶC ĐỊNH (vắng segment), chọn qua nút "Bỏ khung", không phải một mục ngang hàng.
  //
  // Tên bố cục để GỌN trên thẻ; phong cách hiện MỘT lần ở nhãn khối (thẻ nào cũng
  // gắn "Nhịp đen ·" thì phần phân biệt bị đẩy ra ngoài, đọc không ra cái nào khác
  // cái nào). Cùng một "Ô lệch" khác look giữa hai bộ dáng, nhưng picker chỉ đứng
  // trong MỘT bộ, nên tên bộ ở đây là thừa lặp.
  const allowedLayouts: LayoutChoice[] = pack.layouts
    .filter((id) => id !== "toan-khung")
    .map((id) => ({ id, label: findLayout(id).label }));

  const sourceAspect =
    baseInfo.width && baseInfo.height ? baseInfo.width / baseInfo.height : null;

  return {
    schedule,
    sourceAspect,
    inserts,
    hasSubject: existsSync(subjectPath(projectId)),
    allowedLayouts,
  };
}
