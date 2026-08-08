import { FilmIcon, ImageIcon, LibraryIcon } from "lucide-react";

import { findLayout } from "../../../server/layout-kinds";
import type { ScheduledScene } from "../../../server/timing";
import { formatTimeFine, type Insert } from "./editor-data";
import { TimelineBlock } from "./timeline-block";
import type { Selection } from "./use-editor";

/** Nhãn chỉ in khi khối đủ rộng cho một chữ — cùng luật dải hiệu ứng. */
const LABEL_MIN_WIDTH = 40;

/**
 * DẢI BỐ CỤC — THƯA và liền mạch: chỉ vẽ chỗ KHÁC mặc định.
 *
 * Toàn-khung là mặc định (video phủ kín), KHÔNG vẽ ra — vắng khối = toàn-khung,
 * đúng tư duy dải Chuyển cảnh. Mỗi khối là một segment đã đặt: ô NGƯỜI (không cần
 * tư liệu) hoặc B-ROLL (một bố cục CẦN tư liệu, mang mặt tệp). Cả hai cùng một
 * hàng — b-roll không còn dải riêng với cái "lỗ".
 *
 * Không còn "máy tự / người sửa": mọi khối đều là một segment CỤ THỂ, bấm để chọn
 * rồi sửa/xoá ở khung "Đang sửa". Xoá khối → về toàn-khung.
 *
 * Chỉ hiện với bộ dáng CÓ bố cục (`page`).
 */
export function LayoutLane({
  schedule,
  inserts,
  pxPerSecond,
  selection,
  scenePreview,
  onSelectScene,
  onSelectInsert,
}: {
  schedule: readonly ScheduledScene[];
  /** B-roll ĐÃ ĐẶT (mốc xuất ra) — vẽ ngay vào chỗ của nó trên dải này. */
  inserts: readonly Insert[];
  pxPerSecond: number;
  selection: Selection;
  /**
   * Ô NGƯỜI đang bị kéo mép — mốc TẠM (mốc xuất ra) để vẽ đúng theo tay, vì
   * lịch màn là state riêng không tự đổi lúc kéo (khác b-roll). `null`/`undefined`
   * là không có ô nào đang kéo.
   */
  scenePreview?: { elementId: string; start: number; end: number } | null;
  /** Chọn một ô NGƯỜI theo MÃ ELEMENT — mở bảng sửa bố cục cho nó. */
  onSelectScene: (elementId: string) => void;
  /** Chọn một b-roll — mở bảng sửa b-roll cho nó. */
  onSelectInsert: (id: string) => void;
}) {
  if (schedule.length === 0 && inserts.length === 0) return null;

  return (
    <div className="relative h-6">
      {schedule
        // Ô NGƯỜI đọc từ lịch (segment kind='layout'). B-roll vẽ từ chính phần tử
        // đã đặt (có mặt tệp + kéo mép) ở dưới, nên bỏ ở đây. Không còn toàn-khung
        // trong lịch thưa nên không có khối nền mờ nào.
        .filter((scene) => scene.insert === undefined && scene.elementId)
        .map((scene) => {
          const label = findLayout(scene.layout).label;
          const preview =
            scenePreview?.elementId === scene.elementId ? scenePreview : null;
          const start = preview?.start ?? scene.start;
          const end = preview?.end ?? scene.end;
          const width = (end - start) * pxPerSecond;
          return (
            <TimelineBlock
              key={scene.elementId}
              blockId={scene.elementId!}
              start={start}
              end={end}
              pxPerSecond={pxPerSecond}
              tone="layout"
              active={
                selection?.kind === "scene" &&
                selection.id === scene.elementId
              }
              // Kéo mép được — nới/thu rồi re-anchor sang từ khác, y hệt b-roll.
              trimmable
              title={`Bố cục: ${label} · ${formatTimeFine(start)}–${formatTimeFine(end)}`}
              className="px-1.5"
              onSelect={() => onSelectScene(scene.elementId!)}
            >
              <span className="truncate">
                {width >= LABEL_MIN_WIDTH ? label : ""}
              </span>
            </TimelineBlock>
          );
        })}

      {/* B-ROLL — mỗi tư liệu đã đặt là một khối trên CHÍNH dải này, mang MẶT của
          tệp (không chỉ tên) vì lúc dựng câu hỏi luôn là "chỗ này đang đè ảnh
          nào". Kéo mép được; tay nắm gọt mép do dải mẹ gắn khi khối đang chọn. */}
      {inserts.map((insert) => (
        <TimelineBlock
          key={insert.id}
          blockId={insert.id}
          start={insert.start}
          end={insert.end}
          pxPerSecond={pxPerSecond}
          // CÙNG tông với ô người: b-roll không phải loại riêng — chỉ là một khung
          // CÓ tư liệu. Cái mặt tệp (thumbnail) đã đủ nói "khung này có tư liệu".
          tone="layout"
          active={selection?.kind === "insert" && selection.id === insert.id}
          trimmable
          title={
            (insert.fullName ?? insert.label) +
            (insert.fromLibrary ? " — lấy từ kho tư liệu" : "")
          }
          className="gap-1.5 pr-2"
          onSelect={() => onSelectInsert(insert.id)}
        >
          {insert.thumbUrl ? (
            <span
              className="h-full w-8 shrink-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${insert.thumbUrl})` }}
            />
          ) : (
            <span className="grid h-full w-6 shrink-0 place-items-center">
              {insert.isVideo ? (
                <FilmIcon className="size-3" />
              ) : (
                <ImageIcon className="size-3" />
              )}
            </span>
          )}
          <span className="truncate">{insert.label}</span>
          {/* Tư liệu máy TỰ LẤY TỪ KHO phải nói ra — không thì thấy một clip
              mình chưa từng thêm mà không rõ ở đâu ra. */}
          {insert.fromLibrary && (
            <LibraryIcon
              className="size-3 shrink-0 opacity-70"
              aria-label="từ kho"
            />
          )}
        </TimelineBlock>
      ))}
    </div>
  );
}
