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
import { useFileDrop } from "@/lib/use-file-drop";
import { cn } from "@/lib/utils";

import { AddMediaTile } from "./add-media-tile";
import { SortableMediaTile } from "./sortable-media-tile";
import type { MediaFile } from "./upload-data";

/** Kéo phải đi được 5px mới tính là kéo — không thì cú BẤM xem cảnh nào cũng hụt. */
const DRAG_THRESHOLD = 5;

/**
 * Mạch chính — thứ tự các cảnh trong video sẽ xuất ra.
 *
 * Đây là XƯƠNG SỐNG của màn này, nên nó chiếm phần lớn màn chứ không nép ở đáy:
 * lúc chưa có bản chép lời thì thứ tự cảnh là thứ duy nhất người dùng đang quyết
 * định. Ô xếp trái sang phải rồi xuống dòng — đọc theo đúng lối đọc chữ.
 */
/**
 * Bề rộng một ô cảnh, suy ra từ CHIỀU CAO vùng cuộn.
 *
 * Dải cuộn ngang nên chiều cao là thứ cố định: ô cao trọn vùng, trừ dòng tên rồi
 * nhân 0.5625 để ra bề rộng 9:16.
 *
 * `1.25rem` là chiều cao ĐO ĐƯỢC của dòng tên: `mt-1` (4px) cộng một dòng `text-xs`
 * (16px). Từng trừ 3.25rem — 2.75rem cho dòng tên và 0.5rem chừa vệt mờ ở mép dưới
 * — cả hai đều là số của thời dải còn cuộn DỌC: dòng tên không cao tới thế, còn vệt
 * mờ giờ nằm ở mép ngang. Thừa 32px đó đọc ra thành một khoảng trống dưới mỗi thẻ.
 *
 * Không còn phải chia bề rộng cho số cảnh như hồi xuống dòng — chính phép chia đó
 * làm thêm một cảnh là mọi ô nhỏ đi, và ở màn cao thì "vừa một hàng" tự trói ô
 * xuống 134px trong khi có chỗ cho 227px.
 */
const TILE_WIDTH = "w-[calc((100cqh-1.25rem)*0.5625)]";

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
            <Button variant="secondary" onClick={onPick}>
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
              <Button variant="secondary" onClick={onPick}>
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
            orientation="horizontal"
            scrollbar={false}
            // `@container`: ô đo mình theo CHIỀU CAO CỦA VÙNG CUỘN NÀY, không
            // theo chiều cao màn. Đo theo `vh` thì ở màn 720px một hàng ô cao
            // hơn cả vùng chứa nó — dòng tên bị xén ngang giữa chữ ngay lần
            // đầu mở, dù chỉ có đúng một hàng và chẳng có gì để cuộn tới.
            // `scroll-fade-r`, không phải `-b`: dải cuộn NGANG nên mép cụt nằm ở
            // bên phải, không ở dưới. Vệt mờ dưới vừa chỉ sai hướng vừa đòi chừa
            // 8px đáy — 8px đó nằm trong khoảng trống dưới thẻ. Và không dùng `-x`
            // vì nó mờ cả mép trái, làm ô đầu dải nhạt đi vô cớ.
            viewportClassName="scroll-fade-r [container-type:size]"
          >
            {/* `pb-6` chừa đúng chỗ cho vệt mờ ở mép dưới. Thiếu nó thì vệt mờ
                phủ lên dòng tên của hàng cuối và tên tệp đọc ra nhờ nhờ. */}
            {/* `DndContext` bọc NGOÀI hàng ô, không nằm trong nó: nó cắm thêm hai
                phần tử phụ (một rộng 0px, một rộng 1px, để đọc cho trình đọc màn
                hình). Nằm trong hàng thì chúng cũng là hai flex item và ăn hai
                khoảng cách 8px — đủ để đẩy ô "Thêm" xuống hàng dưới. */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              {/* MỘT hàng, cuộn NGANG — không xuống dòng. `w-max` để hàng dài
                  hơn khung thay vì bị bó lại và tự xuống dòng.

                  Xuống dòng thì ô phải chia bề rộng cho số cảnh, nên thêm một cảnh
                  là MỌI ô nhỏ đi, và số hàng còn đổi theo chiều cao khối. Cuộn ngang
                  thì ô cao đúng bằng chỗ có, bề rộng suy ra từ 9:16 — thêm cảnh chỉ
                  làm dải dài thêm, đúng như một mạch phim vốn dài ra. */}
              <div className="flex w-max items-start gap-2">
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
                      className={TILE_WIDTH}
                      onOpen={() => onOpen(file.id)}
                      onReorder={(direction) => onReorder(file.id, direction)}
                      onMove={() => onMove(file.id)}
                      onRemove={() => onRemove(file.id)}
                      onCancel={() => onCancel(file.id)}
                      onRetry={() => onRetry(file.id)}
                    />
                  ))}
                </SortableContext>
                <AddMediaTile
                  label="Thêm"
                  onClick={onPick}
                  className={cn("aspect-[9/16]", TILE_WIDTH)}
                />
              </div>
            </DndContext>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
