import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDuration, type MediaFile } from "../upload/upload-data";

/**
 * DẢI PHIM DỌC — danh sách cảnh chính, xếp đứng bên cạnh ô xem trước.
 *
 * ══ VÌ SAO KHÔNG DÙNG `MainTimelineCard` ══
 *
 * Thẻ ấy xếp NGANG, và ở `/upload` nó đúng: nó nằm dưới cùng, chạy hết bề
 * ngang trang. Bê sang đây thì đo được sáu ô chiếm 370px trong một thẻ rộng
 * 1176 — phí 800px, mà tên tệp lại bị cắt còn "mai…", vô nghĩa.
 *
 * Cùng lúc ô xem trước phí 79% bề ngang: video dọc 250px nằm giữa khung 1176.
 *
 * Hai chỗ phí ấy cộng lại thành một cách xếp: **xem trước bên trái, dải phim
 * dựng đứng bên phải**. Video rộng ra, danh sách dùng chiều cao thay vì chiều
 * ngang, và tên tệp hiện đủ.
 *
 * Viết riêng chứ không sửa `MainTimelineCard` cho xoay được: một thẻ hai chiều
 * là hai bố cục nhét vào một tệp, và mọi lần sửa sau đều phải nghĩ cho cả hai.
 * Bước này làm đúng việc của bước này.
 */

export function SceneStrip({
  files,
  selectedId,
  onOpen,
  onPick,
  onRemove,
  onReorderTo,
}: {
  files: MediaFile[];
  selectedId: string | null;
  onOpen: (id: string) => void;
  onPick: () => void;
  onRemove: (id: string) => void;
  onReorderTo: (id: string, index: number) => void;
}) {
  /*
   * Cùng cấu hình cảm biến với `MainTimelineCard`: ngưỡng 4px để một cú BẤM
   * không bị hiểu nhầm thành cú kéo, và bàn phím kéo được cho người không dùng
   * chuột. Khác đúng một chỗ — `verticalListSortingStrategy` thay cho lưới.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const to = files.findIndex((item) => item.id === over.id);
    if (to >= 0) onReorderTo(String(active.id), to);
  };

  return (
    <Card className="lg:min-h-0">
      <CardHeader>
        <CardTitle>Mạch chính</CardTitle>
        <CardAction>
          {/* Nút CÓ NỀN: `ghost` trên nền thẻ trông như chữ, không ra nút. */}
          <Button variant="secondary" size="sm" onClick={onPick}>
            <PlusIcon />
            Thêm
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext
            items={files.map((file) => file.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-1">
              {files.map((file, index) => (
                <StripRow
                  key={file.id}
                  file={file}
                  index={index}
                  selected={file.id === selectedId}
                  onOpen={onOpen}
                  onRemove={onRemove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}

/** Một hàng kéo được. Tách riêng vì `useSortable` phải gọi trong component con. */
function StripRow({
  file,
  index,
  selected,
  onOpen,
  onRemove,
}: {
  file: MediaFile;
  index: number;
  selected: boolean;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: file.id });
  return (
    <>
      {[file].map(() => (
        <div
          key={file.id}
          ref={setNodeRef}
          style={{ transform: CSS.Transform.toString(transform), transition }}
          data-state={selected ? "here" : "off"}
          className={
            "group flex items-center gap-2 rounded-lg border border-border p-2 data-[state=here]:ring-2 data-[state=here]:ring-primary data-[state=here]:ring-inset" +
            (isDragging ? " opacity-50" : "")
          }
        >
            {/*
              Icon BẤM ĐƯỢC thì phải là `Button`, không phải svg trần.
              Bọc trong `Button` mới có vùng bấm đủ rộng, có trạng thái rê
              chuột, và tự nhận luật chỉnh cỡ icon của design system
              (`[&_svg:not([class*='size-'])]:size-4`) — luật ấy chỉ chạy bên
              trong `Button`, nên svg trần bị lucide vẽ 24px và lấn át chữ.
            */}
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Kéo để đổi thứ tự"
              className="cursor-grab"
              {...attributes}
              {...listeners}
            >
              <GripVerticalIcon />
            </Button>
            <span className="text-muted-foreground w-4 shrink-0 tabular-nums text-xs">
              {index + 1}
            </span>
            {/* Cả mảng ảnh + tên là một nút mở xem trước — vùng bấm lớn, và
                người dùng không phải nhắm vào một dòng chữ mảnh. */}
            <button
              type="button"
              onClick={() => onOpen(file.id)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
            >
              <span className="bg-muted h-11 w-8 shrink-0 overflow-hidden rounded-md">
                {file.thumbnail ? (
                  <img
                    src={file.thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </span>
              {/* Tên XUỐNG DÒNG chứ không cắt: cắt còn "mai…" thì sáu cảnh
                  nhìn giống hệt nhau. `break-all` vì tên tệp thường không có
                  khoảng trắng để ngắt. */}
              <span className="min-w-0 flex-1 text-sm leading-tight break-all">
                {file.name}
              </span>
            </button>
            {/*
              Rê chuột thì nút GỠ thế chỗ thời lượng, không nằm cạnh nó.
              Nằm cạnh thì lúc không rê chuột có một khoảng trống bên phải mà
              không ai biết vì đâu — thời lượng trông như bị đẩy lệch.
              Cùng một ô, hai trạng thái: đọc thì thấy thời lượng, định làm gì
              thì thấy nút.
            */}
            <span className="grid shrink-0 place-items-center">
              <span className="text-muted-foreground col-start-1 row-start-1 tabular-nums text-xs group-hover:invisible">
                {file.duration ? formatDuration(file.duration) : ""}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Gỡ ${file.name}`}
                onClick={() => onRemove(file.id)}
                className="col-start-1 row-start-1 opacity-0 group-hover:opacity-100"
              >
                <XIcon />
              </Button>
            </span>
        </div>
      ))}
    </>
  );
}
