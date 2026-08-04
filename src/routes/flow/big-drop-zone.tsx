import { LibraryIcon, UploadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useFileDrop } from "@/lib/use-file-drop";

/**
 * VÙNG THẢ TO — chiếm cả ô phải khi chưa có tệp nào.
 *
 * ══ VÌ SAO ══
 *
 * Lúc rỗng, bố cục hai cột không nói được gì: khung xem trước trống trơn, danh
 * sách trống trơn, và việc duy nhất người dùng làm được — nạp tệp — nấp trong
 * một nút nhỏ ở góc thẻ bên phải.
 *
 * Màn rỗng nên bày ĐÚNG MỘT việc, to bằng cả khung. Không có gì để xem thì
 * không cần khung xem; không có gì trong danh sách thì không cần danh sách.
 */
export function BigDropZone({
  title,
  hint,
  onFiles,
  onPick,
  onPickFromLibrary,
}: {
  title: string;
  hint: string;
  onFiles: (files: File[]) => void;
  onPick: () => void;
  /** Chỉ tư liệu chèn mới có kho. Thiếu thì không vẽ nút. */
  onPickFromLibrary?: () => void;
}) {
  const { over, dropProps } = useFileDrop(onFiles);

  return (
    <Card
      // `Card` gợi mép bằng `ring`, nên đổi màu lúc rê tệp phải đổi đúng thứ
      // đang vẽ ra mép đó — cùng lối `MainTimelineCard`.
      className={cn("lg:h-full lg:min-h-0", over && "ring-primary")}
      {...dropProps}
    >
      <CardContent className="grid min-h-0 flex-1 place-items-center">
        <div className="grid max-w-lg justify-items-center gap-3 text-center">
          <UploadIcon className="text-muted-foreground size-8" />
          <p className="text-lg">{title}</p>
          <p className="text-muted-foreground">{hint}</p>
          <div className="flex items-center gap-2">
            <Button onClick={onPick}>Chọn tệp</Button>
            {onPickFromLibrary ? (
              <Button variant="secondary" onClick={onPickFromLibrary}>
                <LibraryIcon />
                Từ kho
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
