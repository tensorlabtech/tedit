import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { FilmIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { AddMediaTile } from "./add-media-tile";
import { SortableMediaTile } from "./sortable-media-tile";
import type { MediaFile } from "./upload-data";
import { useFileDrop } from "./use-file-drop";

/** Kéo phải đi được 5px mới tính là kéo — không thì cú BẤM xem cảnh nào cũng hụt. */
const DRAG_THRESHOLD = 5;

/**
 * Mạch chính — thứ tự các cảnh trong video sẽ xuất ra.
 *
 * Đây là XƯƠNG SỐNG của màn này, nên nó chiếm phần lớn màn chứ không nép ở đáy:
 * lúc chưa có bản chép lời thì thứ tự cảnh là thứ duy nhất người dùng đang quyết
 * định. Ô xếp trái sang phải rồi xuống dòng — đọc theo đúng lối đọc chữ.
 */
export function MainTimelineCard({
  files,
  sourceOf,
  onOpen,
  onPick,
  onDropFiles,
  onRemove,
  onMove,
  onCancel,
  onRetry,
  selectedId,
  onReorder,
  onReorderTo,
  className,
}: {
  files: MediaFile[];
  sourceOf: (id: string) => File | undefined;
  onOpen: (id: string) => void;
  onPick: () => void;
  onDropFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onMove: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  /** Ô đang nằm trong khung xem trước */
  selectedId: string | null;
  onReorder: (id: string, direction: -1 | 1) => void;
  onReorderTo: (id: string, index: number) => void;
  className?: string;
}) {
  const { over, dropProps } = useFileDrop(onDropFiles);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_THRESHOLD },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Số cảnh đánh theo những ô THẬT SỰ vào được video: ô tải hỏng bị máy chủ trả
  // lại nên nó không có mặt trong thành phẩm, mà vẫn giữ một số thì mọi cảnh
  // sau nó bị gọi sai tên cho tới hết dải.
  const sceneNumbers = new Map<string, number>();
  let scene = 0;
  for (const file of files) {
    if (file.status === "error") continue;
    scene += 1;
    sceneNumbers.set(file.id, scene);
  }

  const handleDragEnd = ({ active, over: target }: DragEndEvent) => {
    if (!target || active.id === target.id) return;
    const to = files.findIndex((item) => item.id === target.id);
    if (to >= 0) onReorderTo(String(active.id), to);
  };

  return (
    <Card
      // `Card` gợi mép bằng `ring`, không bằng `border` — đổi màu viền phải đổi
      // đúng thứ đang vẽ ra mép đó.
      className={cn(className, over && "ring-primary")}
      data-role-drop="main"
      {...dropProps}
    >
      <CardHeader>
        <CardTitle>Mạch chính</CardTitle>
        {/* Nút thêm chỉ có khi dải đã có gì: lúc rỗng thì giữa thẻ đã là một
            vùng thả to đùng kèm nút, thêm một nút nữa ở góc chỉ là hai cửa cho
            một việc. Số cảnh và tổng thời lượng đã gỡ — dải tự đếm được bằng
            mắt, còn độ dài thật thì phải cắt xong ở bàn dựng mới biết. */}
        {files.length > 0 && (
          <CardAction>
            <Button variant="secondary" size="sm" onClick={onPick}>
              <PlusIcon />
              Thêm video
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex min-h-48 flex-col lg:min-h-0 lg:flex-1">
        {files.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FilmIcon />
              </EmptyMedia>
              <EmptyTitle>Chưa có cảnh nào</EmptyTitle>
              <EmptyDescription>
                Video có tiếng nói vào đây, ghép theo đúng thứ tự bạn xếp.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="secondary" size="sm" onClick={onPick}>
                <PlusIcon />
                Chọn video
              </Button>
              <span className="text-xs text-muted-foreground">
                hoặc kéo tệp thả vào đây
              </span>
            </EmptyContent>
          </Empty>
        ) : (
          <ScrollArea
            className="h-full"
            scrollbar={false}
            // `@container`: ô đo mình theo CHIỀU CAO CỦA VÙNG CUỘN NÀY, không
            // theo chiều cao màn. Đo theo `vh` thì ở màn 720px một hàng ô cao
            // hơn cả vùng chứa nó — dòng tên bị xén ngang giữa chữ ngay lần
            // đầu mở, dù chỉ có đúng một hàng và chẳng có gì để cuộn tới.
            viewportClassName="scroll-fade-b [container-type:size]"
          >
            {/* `pb-6` chừa đúng chỗ cho vệt mờ ở mép dưới. Thiếu nó thì vệt mờ
                phủ lên dòng tên của hàng cuối và tên tệp đọc ra nhờ nhờ. */}
            <div className="flex flex-wrap items-start gap-2 pb-6">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={files.map((item) => item.id)}
                  strategy={rectSortingStrategy}
                >
                  {files.map((file, index) => (
                    <SortableMediaTile
                      key={file.id}
                      file={file}
                      index={index}
                      sceneNumber={sceneNumbers.get(file.id)}
                      count={files.length}
                      source={sourceOf(file.id)}
                      shape="portrait"
                      moveTo="insert"
                      selected={file.id === selectedId}
                      className="w-[clamp(6rem,calc((100cqh-2.75rem)*0.5625),12rem)]"
                      onOpen={() => onOpen(file.id)}
                      onReorder={(direction) => onReorder(file.id, direction)}
                      onMove={() => onMove(file.id)}
                      onRemove={() => onRemove(file.id)}
                      onCancel={() => onCancel(file.id)}
                      onRetry={() => onRetry(file.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <AddMediaTile
                label="Thêm"
                onClick={onPick}
                className="aspect-[9/16] w-[clamp(6rem,calc((100cqh-2.75rem)*0.5625),12rem)]"
              />
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
