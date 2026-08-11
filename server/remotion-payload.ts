import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";

import { buildPlacedSegments } from "./layout-segments";
import { scheduleScenes } from "./layout-schedule";
import { PICKABLE_LAYOUTS } from "./layout-kinds";
import { probe } from "./media-tools";
import { workDir } from "./paths";
import { keptRanges } from "./pipeline";
import { blocksFromPack, type FrameBlock } from "./style-pack";
import { readStylePack } from "./style-pack-store";
import { stampBlocksFromPack } from "./stamp-blocks";
import { subjectPath } from "./subject-mask";

/**
 * CẦU DỮ LIỆU cho Remotion — một máy vẽ.
 *
 * Trả ĐÚNG lịch màn + tư liệu mà bản xuất ffmpeg dùng (`buildPlacedSegments` →
 * `scheduleScenes`, cùng nguồn `pipeline.ts`), đóng gói thành JSON + copy media vào
 * `public/remotion/<id>/` để Remotion (headless Chrome) đọc bằng `staticFile`. Nhờ
 * ăn cùng nguồn với export/preview, composition Remotion KHÔNG phải là "máy vẽ thứ
 * ba" — nó là chính cây render preview, chỉ khác nơi chạy.
 */

export type RemotionScene = {
  start: number;
  end: number;
  layout: string;
  /** Chỉ số tư liệu chèn cho ô phụ; null nếu màn không có b-roll. */
  insert: number | null;
  frameBlock: FrameBlock | null;
};

export type RemotionPayload = {
  fps: number;
  width: number;
  height: number;
  seconds: number;
  sourceAspect: number | null;
  /** URL (tương đối `public/`) video người đã dựng. */
  personUrl: string;
  /** Mặt nạ tách người (trắng=người), null nếu chưa có. */
  maskUrl: string | null;
  /** Nền trang gốc của bộ dáng (mỗi cảnh có thể đè bằng `frameBlock.page`). */
  basePage: FrameBlock["page"];
  scenes: RemotionScene[];
  inserts: Array<{ url: string; aspect: number }>;
};

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;

export async function buildRemotionPayload(
  projectId: string,
): Promise<RemotionPayload | null> {
  const pack = readStylePack(projectId);
  if (pack.layouts.length === 0) return null;

  // Element mang block look của chính nó — đóng dấu trước khi đọc (cùng cổng với
  // preview/export).
  stampBlocksFromPack(projectId);

  const base = join(workDir(projectId), "base.mp4");
  if (!existsSync(base)) return null;
  const baseInfo = await probe(base).catch(() => null);
  if (!baseInfo) return null;

  const kept = keptRanges(projectId, baseInfo.duration);
  const keptTotal = kept.reduce((sum, r) => sum + (r.end - r.start), 0);

  const { segments, media } = buildPlacedSegments(
    projectId,
    kept,
    PICKABLE_LAYOUTS,
    pack.layouts,
  );
  const schedule = scheduleScenes(keptTotal, segments);

  // Thư mục tĩnh cho Remotion đọc. Copy một lần mỗi lần dựng payload.
  const outDir = join(process.cwd(), "public", "remotion", projectId);
  mkdirSync(outDir, { recursive: true });
  const rel = (name: string) => `remotion/${projectId}/${name}`;

  // Người: dùng base.mp4 (cắt tối thiểu ở dự án thử; bản production sẽ cắt đúng
  // theo `kept`). Mặt nạ: cut-mask nếu có, không thì subject gốc.
  copyFileSync(base, join(outDir, "person.mp4"));
  const personUrl = rel("person.mp4");

  const cutMask = join(workDir(projectId), "cut-mask.mp4");
  const rawMask = subjectPath(projectId);
  let maskUrl: string | null = null;
  if (existsSync(cutMask)) {
    copyFileSync(cutMask, join(outDir, "mask.mp4"));
    maskUrl = rel("mask.mp4");
  } else if (existsSync(rawMask)) {
    copyFileSync(rawMask, join(outDir, "mask.mp4"));
    maskUrl = rel("mask.mp4");
  }

  const inserts = await Promise.all(
    media.map(async (item, i) => {
      const ext = extname(item.path) || ".mp4";
      const name = `insert-${i}${ext}`;
      copyFileSync(item.path, join(outDir, name));
      const info = await probe(item.path).catch(() => null);
      const aspect =
        info?.width && info?.height ? info.width / info.height : 1;
      return { url: rel(name), aspect };
    }),
  );

  return {
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
    seconds: keptTotal,
    sourceAspect:
      baseInfo.width && baseInfo.height ? baseInfo.width / baseInfo.height : null,
    personUrl,
    maskUrl,
    basePage: blocksFromPack(pack).frame.page,
    scenes: schedule.map((s) => ({
      start: s.start,
      end: s.end,
      layout: s.layout,
      insert: s.insert ?? null,
      frameBlock: s.frameBlock ?? null,
    })),
    inserts,
  };
}
