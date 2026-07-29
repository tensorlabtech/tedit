import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { AddMediaTile } from "./add-media-tile";
import { MediaTile } from "./media-tile";
import type { MediaFile } from "./upload-data";
import { useFileDrop } from "./use-file-drop";

/**
 * Kho tư liệu chèn — ảnh và video câm để đè lên lời nói.
 *
 * Nằm dưới mạch chính và thấp hơn: nó KHÔNG bắt buộc, mà chỗ đặt từng miếng lại
 * chọn ở bàn dựng theo câu chữ. Nhưng ô phải đủ to để NHÌN RA nội dung — đây là
 * kho ảnh, không phải danh sách tên tệp.
 *
 * Ô giữ nguyên tỉ lệ gốc và không đánh số: chúng không có thứ tự, và cắt tất cả
 * về một khuôn là bịa ra một khung hình không có thật.
 */
export function InsertMediaCard({
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
  className?: string;
}) {
  const { over, dropProps } = useFileDrop(onDropFiles);

  return (
    <Card
      className={cn(className, over && "ring-primary")}
      data-role-drop="insert"
      {...dropProps}
    >
      <CardHeader>
        <CardTitle>Tư liệu chèn</CardTitle>
        {files.length > 0 && (
          <CardAction>
            <Button variant="secondary" size="sm" onClick={onPick}>
              <PlusIcon />
              Thêm tư liệu
            </Button>
          </CardAction>
        )}
      </CardHeader>
      {/* Cao vừa hai hàng ô rồi cuộn: kho tư liệu phình ra ăn hết chỗ của mạch
          chính thì màn này nói sai thứ tự quan trọng. */}
      <CardContent className="grid gap-3">
        {/* Câu này nằm ở THÂN thẻ, không nhét xuống dưới tiêu đề: tiêu đề chỉ là
            tên (luật của `CardTitle`), còn ghi chú thì thuộc về thân. Nó trả lời
            câu "cái này để làm gì" một lần cho cả kho, thay vì một dòng gợi ý
            đứng lẫn trong hàng ô và biến mất ngay khi có tệp đầu tiên. */}
        <p className="text-xs text-muted-foreground">
          Ảnh/Video đè lên trên dòng thời gian chính
        </p>
        <ScrollArea
          className="max-h-60"
          scrollbar={false}
          viewportClassName="scroll-fade-b"
        >
          {/* Căn theo mép TRÊN. Mọi khung ảnh ở đây cao bằng nhau, nên căn trên
              là mép trên lẫn mép dưới của ảnh đều thẳng hàng. Căn theo đáy thì ô
              "Thêm" — thứ duy nhất không có dòng tên bên dưới — tụt xuống đúng
              bằng chiều cao dòng tên và trông như bị lệch. */}
          <div className="flex flex-wrap items-start gap-2 pb-6">
            {files.map((file) => (
              <MediaTile
                key={file.id}
                file={file}
                source={sourceOf(file.id)}
                shape="natural"
                moveTo="main"
                selected={file.id === selectedId}
                onOpen={() => onOpen(file.id)}
                onMove={() => onMove(file.id)}
                onRemove={() => onRemove(file.id)}
                onCancel={() => onCancel(file.id)}
                onRetry={() => onRetry(file.id)}
              />
            ))}
            <AddMediaTile
              label="Thêm"
              onClick={onPick}
              className="h-[clamp(6rem,15vh,10rem)] w-[clamp(6rem,15vh,10rem)]"
            />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
