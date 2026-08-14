import type { PointerEvent } from "react";
import { FilmIcon, ImageIcon, LibraryIcon } from "lucide-react";

import { findLayout } from "../../../server/layout-kinds";
import type { ScheduledScene } from "../../../server/timing";
import { formatTimeFine, type Insert } from "./editor-data";
import { TimelineBlock } from "./timeline-block";
import { InsertFilmstrip } from "./timeline-insert-filmstrip";
import type { InsertStrip } from "./use-insert-filmstrips";
import type { Selection } from "./use-editor";

/** Nhãn chỉ in khi khối đủ rộng cho một chữ — cùng luật dải hiệu ứng. */
const LABEL_MIN_WIDTH = 40;

/**
 * Chiều cao dải bố cục (px). Đủ thấy DẢI ẢNH đoạn clip trên khối b-roll nhưng
 * THẤP HƠN dải video chính (56px) — để hai dải không nặng ngang nhau và phân
 * biệt được bằng chiều cao.
 */
const LANE_HEIGHT = 40;

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
  strips,
  onSelectScene,
  onSelectInsert,
  onMoveInsert,
  onMoveScene,
}: {
  schedule: readonly ScheduledScene[];
  /** B-roll ĐÃ ĐẶT (mốc xuất ra) — vẽ ngay vào chỗ của nó trên dải này. */
  inserts: readonly Insert[];
  /** Dải ảnh clip theo `mediaFileId` — nền của khối b-roll (chưa có = khối trơn). */
  strips: Record<string, InsertStrip>;
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
  /** Handler KÉO DỜI b-roll (đã buộc sẵn mốc NGUỒN) — `undefined` = không dời được. */
  onMoveInsert?: (id: string) => ((event: PointerEvent) => void) | undefined;
  /** Handler KÉO DỜI khung NGƯỜI (elementId, buộc sẵn mốc nguồn). */
  onMoveScene?: (elementId: string) => ((event: PointerEvent) => void) | undefined;
}) {
  if (schedule.length === 0 && inserts.length === 0) return null;

  return (
    // Cao vừa đủ bày DẢI ẢNH clip trên khối b-roll, thấp hơn dải video chính.
    <div className="relative" style={{ height: LANE_HEIGHT }}>
      {schedule
        // Ô NGƯỜI đọc từ lịch (segment kind='layout'). B-roll vẽ từ chính phần tử
        // đã đặt (có mặt tệp + kéo mép) ở dưới, nên bỏ ở đây. Không còn toàn-khung
        // trong lịch thưa nên không có khối nền mờ nào.
        .filter((scene) => scene.insert === undefined && scene.elementId)
        .map((scene) => {
          // KHUNG MỜ (toan-khung + cờ blur) tên riêng — khớp inspector, khỏi lệch
          // "Toàn khung" ở dải mà "Khung mờ" ở bảng sửa.
          const label = scene.frameBlock?.blur
            ? "Khung mờ"
            : findLayout(scene.layout).label;
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
              onMoveStart={onMoveScene?.(scene.elementId!)}
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
          className="px-0"
          onSelect={() => onSelectInsert(insert.id)}
          onMoveStart={onMoveInsert?.(insert.id)}
        >
          {/* NỀN = DẢI ẢNH đoạn clip đang lấy (video, đã có dải). Kéo mép khối đổi
              đoạn → dải trượt theo. Ảnh chưa dựng xong hoặc là ẢNH tĩnh thì rơi về
              ảnh thu nhỏ / biểu tượng. */}
          {insert.isVideo && insert.mediaFileId && strips[insert.mediaFileId] ? (
            <InsertFilmstrip
              widthPx={(insert.end - insert.start) * pxPerSecond}
              heightPx={LANE_HEIGHT}
              mediaIn={insert.mediaIn ?? 0}
              pxPerSecond={pxPerSecond}
              strip={strips[insert.mediaFileId]}
            />
          ) : insert.thumbUrl ? (
            // B-roll ẢNH: KHÔNG kéo giãn một khung ra cả khối. Lặp ảnh ở ĐÚNG tỉ lệ
            // (cao lấp khối, ngang tự nhiên) → trông như dải ảnh, không bẹt méo.
            <span
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${insert.thumbUrl})`,
                backgroundSize: "auto 100%",
                backgroundRepeat: "repeat-x",
                backgroundPosition: "left center",
              }}
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center">
              {insert.isVideo ? (
                <FilmIcon className="size-4" />
              ) : (
                <ImageIcon className="size-4" />
              )}
            </span>
          )}
          {/* Nhãn tên tệp — dải mờ dưới chân cho đọc được trên nền ảnh. */}
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-3 pb-1 text-white">
            <span className="truncate">{insert.label}</span>
            {/* Tư liệu máy TỰ LẤY TỪ KHO phải nói ra — không thì thấy một clip
                mình chưa từng thêm mà không rõ ở đâu ra. */}
            {insert.fromLibrary && (
              <LibraryIcon
                className="size-3 shrink-0 opacity-80"
                aria-label="từ kho"
              />
            )}
          </span>
        </TimelineBlock>
      ))}
    </div>
  );
}
