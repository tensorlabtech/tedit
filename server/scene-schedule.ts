import { existsSync } from "node:fs";
import { join } from "node:path";

import { scheduleScenes } from "./layout-schedule";
import { buildPlacedSegments } from "./layout-segments";
import {
  type LayoutKindId,
  PICKABLE_LAYOUTS,
  findLayout,
} from "./layout-kinds";
import { probe } from "./media-tools";
import { workDir } from "./paths";
import { VIDEO } from "./routes/media-formats";
import { keptRanges, topKeyword } from "./pipeline";
import { behindPhrase } from "./style-pack";
import { readStylePack } from "./style-pack-store";
import { emptiestBand, subjectPath } from "./subject-mask";
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
export type LayoutChoice = {
  id: LayoutKindId;
  label: string;
  /** Khung GỢI Ý của style hiện tại (để picker nhóm lên đầu). Không phải giới hạn. */
  suggested: boolean;
};

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
  /**
   * Câu chữ-NỀN (sau người) — chỉ bộ dáng có `behindText` (Phấn) mới có. Đưa ra
   * frontend để khung xem VẼ ĐƯỢC (trước đây chỉ hiện ở bản xuất vì content tính
   * server-side). `null` khi bộ dáng không khai chữ-nền.
   */
  behindLine: string | null;
  /** Dải (chỉ số) ít người nhất để đặt chữ-nền — khớp `emptiestBand` ở bản xuất. */
  behindBand: number;
};

const EMPTY: SceneScheduleResult = {
  schedule: [],
  sourceAspect: null,
  inserts: [],
  hasSubject: false,
  allowedLayouts: [],
  behindLine: null,
  behindBand: 0,
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

  // Dựng theo MỌI khung (tôn trọng lựa chọn tay), mặc định theo GỢI Ý của style.
  const { segments, media } = buildPlacedSegments(
    projectId,
    kept,
    PICKABLE_LAYOUTS,
    pack.layouts,
  );

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
  // MỌI khung chọn được (không lọc theo style) — style chỉ ĐÁNH DẤU gợi ý để
  // picker nhóm lên đầu, không cấm. `toan-khung` là mặc định (nút "Bỏ khung").
  const allowedLayouts: LayoutChoice[] = PICKABLE_LAYOUTS.map((id) => ({
    id,
    label: findLayout(id).label,
    suggested: pack.layouts.includes(id),
  }));

  const sourceAspect =
    baseInfo.width && baseInfo.height ? baseInfo.width / baseInfo.height : null;

  // Chữ-nền: chỉ bộ dáng có `behindText` (Phấn). Dải đặt lấy từ mặt nạ như bản
  // xuất; thiếu mặt nạ thì về dải 0 (vẫn hiện được, chỉ không né người tối ưu).
  const behindLine = pack.behindText
    ? behindPhrase(topKeyword(projectId))
    : null;
  const behindBand = behindLine
    ? ((await emptiestBand(projectId, baseInfo.duration / 2).catch(() => null))
        ?.index ?? 0)
    : 0;

  return {
    schedule,
    sourceAspect,
    inserts,
    hasSubject: existsSync(subjectPath(projectId)),
    allowedLayouts,
    behindLine,
    behindBand,
  };
}
