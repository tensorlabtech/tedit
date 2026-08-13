import type { PointerEvent } from "react";
import { Music2Icon } from "lucide-react";

import { formatTime, type MusicTrack } from "./editor-data";
import { TimelineBlock } from "./timeline-block";
import type { Selection } from "./use-editor";

/**
 * Dải NHẠC NỀN.
 *
 * Trước đây nhạc chỉ là một dòng chữ trong thanh công cụ: nó phủ nguyên video mà
 * không có chỗ nào trên dải để nhìn thấy, nên "nhạc bắt đầu từ đâu" là câu hỏi
 * không trả lời được. Giờ nó là một khối như mọi lớp khác — kéo hai đầu để đặt
 * khoảng, chọn nó để chỉnh âm lượng ở khung bên phải.
 */
export function MusicLane({
  tracks,
  pxPerSecond,
  selection,
  onSelect,
  onMove,
}: {
  tracks: MusicTrack[];
  pxPerSecond: number;
  selection: Selection;
  onSelect: (id: string) => void;
  /** KÉO DỜI nhạc (đã buộc mốc nguồn) — `undefined` = không dời. */
  onMove?: (id: string) => ((event: PointerEvent) => void) | undefined;
}) {
  if (tracks.length === 0) return null;
  return (
    <div className="relative h-6">
      {tracks.map((track) => (
        <TimelineBlock
          key={track.id}
          blockId={track.id}
          start={track.start}
          end={track.end}
          pxPerSecond={pxPerSecond}
          tone="music"
          active={selection?.kind === "music" && selection.id === track.id}
          trimmable
          title={`${track.name} · ${formatTime(track.start)} → ${formatTime(track.end)}`}
          className="gap-1.5 px-2"
          onSelect={() => onSelect(track.id)}
          onMoveStart={onMove?.(track.id)}
        >
          <Music2Icon className="size-3 shrink-0" />
          <span className="truncate">{track.name}</span>
          {/* Âm lượng đọc được ngay trên khối: nó là thứ hay phải chỉnh nhất ở
              một bài nhạc nền, mà mở khung bên phải mới thấy thì không so được
              hai bài với nhau. */}
          <span className="shrink-0 tabular-nums opacity-70">
            {Math.round(track.volume * 100)}%
          </span>
        </TimelineBlock>
      ))}
    </div>
  );
}
