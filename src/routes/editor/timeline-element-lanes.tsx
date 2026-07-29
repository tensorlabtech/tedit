import { FilmIcon, ImageIcon, TypeIcon } from "lucide-react";

import type { Insert, TextElement } from "./editor-data";
import { TimelineBlock } from "./timeline-block";
import type { Selection } from "./use-editor";

/**
 * Dải CHỮ ĐÈ — chữ người dùng đặt lên khung hình.
 *
 * Trước đây chữ không có mặt nào trên dải: đặt xong thì chỉ còn thấy nó trong
 * khung xem đúng một hai giây, muốn sửa phải mò trong danh sách "Cần bạn xem".
 * Nó chiếm thời gian như mọi lớp khác nên phải có chỗ đứng như mọi lớp khác.
 */
export function TextLane({
  elements,
  pxPerSecond,
  selection,
  onSelect,
  overlay,
}: {
  elements: TextElement[];
  pxPerSecond: number;
  selection: Selection;
  onSelect: (id: string) => void;
  /** Vẽ đè lên dải phim thay vì đứng thành một dải riêng */
  overlay?: boolean;
}) {
  if (elements.length === 0) return null;
  return (
    <div className={overlay ? "relative h-4" : "relative h-6"}>
      {elements
        .filter((element) => element.end > element.start)
        .map((element) => (
          <TimelineBlock
            key={element.id}
            blockId={element.id}
            start={element.start}
            end={element.end}
            pxPerSecond={pxPerSecond}
            tone="text"
            active={selection?.kind === "text" && selection.id === element.id}
            title={element.content}
            className={
              overlay
                ? "gap-1 rounded-b-none px-1.5 text-[11px] leading-4"
                : "gap-1 px-2"
            }
            onSelect={() => onSelect(element.id)}
          >
            {!overlay && <TypeIcon className="size-3 shrink-0" />}
            <span className="truncate">{element.content}</span>
          </TimelineBlock>
        ))}
    </div>
  );
}

/**
 * Lớp CHỮ TỰ DO — tiêu đề, con số, nhãn. Neo theo giờ, không theo lời.
 *
 * Phải là một lớp RIÊNG, không dùng chung với chữ chép lời đang vẽ đè lên phim.
 * Hai thứ có thể chiếm cùng một khoảng thời gian, mà hai khối cùng một hàng thì
 * đè lên nhau — và chính cái dải lẽ ra để THẤY va chạm lại đi giấu nó.
 *
 * Nằm trên cùng vì nó là lớp trên cùng của khung hình. Rỗng thì không vẽ gì cả,
 * nên ai không dùng chữ tự do sẽ không phải trả một hàng trống.
 */
export function FreeTextLane({
  elements,
  pxPerSecond,
  selection,
  onSelect,
}: {
  elements: TextElement[];
  pxPerSecond: number;
  selection: Selection;
  onSelect: (id: string) => void;
}) {
  if (elements.length === 0) return null;
  return (
    <div className="relative h-6">
      {elements.map((element) => (
        <TimelineBlock
          key={element.id}
          blockId={element.id}
          start={element.start}
          end={element.end}
          pxPerSecond={pxPerSecond}
          tone="text"
          active={selection?.kind === "text" && selection.id === element.id}
          trimmable
          title={element.content || "Chữ chưa có nội dung"}
          className="gap-1 px-2"
          onSelect={() => onSelect(element.id)}
        >
          <TypeIcon className="size-3 shrink-0" />
          {/* Chữ rỗng vẫn phải ĐỌC RA LÀ MỘT KHỐI: đặt xong mà chưa gõ gì thì
              khối trống trơn nhìn như lỗi vẽ, không ai biết bấm vào đâu. */}
          <span
            className={element.content ? "truncate" : "truncate opacity-60"}
          >
            {element.content || "chữ trống"}
          </span>
        </TimelineBlock>
      ))}
    </div>
  );
}

/**
 * Dải TƯ LIỆU CHÈN.
 *
 * Khối mang MẶT của tệp chứ không chỉ mang tên: một dòng "Video 2" không nói
 * được đang chèn cái gì, mà lúc dựng câu hỏi luôn là "chỗ này đang đè ảnh nào".
 */
export function InsertLane({
  inserts,
  pxPerSecond,
  selection,
  onSelect,
}: {
  inserts: Insert[];
  pxPerSecond: number;
  selection: Selection;
  onSelect: (id: string) => void;
}) {
  if (inserts.length === 0) return null;
  return (
    <div className="relative h-6">
      {inserts.map((insert) => (
        <TimelineBlock
          key={insert.id}
          blockId={insert.id}
          start={insert.start}
          end={insert.end}
          pxPerSecond={pxPerSecond}
          tone="insert"
          active={selection?.kind === "insert" && selection.id === insert.id}
          trimmable
          // Nhãn trên dải đã rút ngắn (xem `shortMediaLabel`); tên tệp đầy đủ
          // vẫn phải xem được ở đâu đó, không thì không biết đang chèn tệp nào.
          title={insert.fullName ?? insert.label}
          className="gap-1.5 pr-2"
          onSelect={() => onSelect(insert.id)}
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
        </TimelineBlock>
      ))}
    </div>
  );
}
