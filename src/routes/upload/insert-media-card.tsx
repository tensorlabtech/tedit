import { LibraryIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApiSettings } from "@/lib/api";
import { INSERT_SOURCE_LABELS } from "@/lib/insert-source-options";
import { useFileDrop } from "@/lib/use-file-drop";
import { cn } from "@/lib/utils";

import { AddMediaTile } from "./add-media-tile";
import { MediaTile } from "./media-tile";
import type { MediaFile } from "./upload-data";

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
/**
 * Bề rộng ô "Thêm" của kho chèn — suy từ chiều cao vùng cuộn như ô mạch chính.
 *
 * Ô tư liệu thật giữ tỉ lệ GỐC nên bề rộng mỗi ô một khác; ô "Thêm" không có ảnh
 * nào để giữ tỉ lệ theo, nên nó lấy dáng dọc 9:16 cho khớp hàng.
 */
const TILE_ADD_WIDTH = "w-[calc((100cqh-1.25rem)*0.5625)]";

export function InsertMediaCard({
  files,
  sourceOf,
  onOpen,
  onPick,
  onPickFromLibrary,
  onDropFiles,
  onRemove,
  onMove,
  onCancel,
  onRetry,
  selectedId,
  insertSource,
  onInsertSourceChange,
  className,
}: {
  files: MediaFile[];
  sourceOf: (id: string) => File | undefined;
  onOpen: (id: string) => void;
  onPick: () => void;
  /** Mở hộp chọn từ kho dùng chung */
  onPickFromLibrary: () => void;
  onDropFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onMove: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  /** Ô đang nằm trong khung xem trước */
  selectedId: string | null;
  /** Máy được lấy tư liệu ở đâu; `null` khi chưa nạp xong dự án */
  insertSource: ApiSettings["insertSource"] | null;
  onInsertSourceChange: (next: ApiSettings["insertSource"]) => void;
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
        <CardAction className="flex items-center gap-2">
          {/* Ô chọn NGUỒN đứng ngay đây chứ không nằm ở trang Cài đặt: nó nói về
              đúng cái kho ngay dưới nó, và mỗi video một khác — video này toàn
              cảnh quay sẵn thì mở cả kho, video sau chỉ dùng mấy tệp vừa nạp.
              Cài đặt chỉ quyết giá trị MẶC ĐỊNH lúc tạo dự án. */}
          {insertSource && (
            <Select
              // `items` để ô hiện NHÃN chứ không hiện giá trị thô: thiếu nó thì
              // trên nút đọc ra đúng chữ "library".
              items={INSERT_SOURCE_LABELS}
              value={insertSource}
              onValueChange={(value) =>
                onInsertSourceChange(value as ApiSettings["insertSource"])
              }
            >
              {/* Ô này không có nhãn nhìn thấy được — chỗ trên tiêu đề thẻ chỉ
                  đủ cho một hàng. Nên nhãn phải nằm ở `aria-label`, không thì
                  trình đọc màn hình chỉ đọc ra "hộp chọn". */}
              <SelectTrigger
                size="sm"
                className="w-52"
                aria-label="Máy được lấy tư liệu ở đâu"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INSERT_SOURCE_LABELS).map(([value, nhan]) => (
                  <SelectItem key={value} value={value}>
                    {nhan}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Hai đường vào, luôn hiện cả hai. "Từ kho" không nấp trong menu của
              nút kia: kho tư liệu là thứ người dùng phải BIẾT là có, mà một mục
              trong menu thả xuống thì chỉ ai đi mở ra mới thấy. */}
          <Button variant="outline" onClick={onPickFromLibrary}>
            <LibraryIcon />
            Từ kho
          </Button>
          {files.length > 0 && (
            <Button variant="secondary" onClick={onPick}>
              <PlusIcon />
              Thêm tư liệu
            </Button>
          )}
        </CardAction>
      </CardHeader>
      {/* Cao trọn cột rồi cuộn trong lòng mình.

          Trước là `max-h-60` cố định, vì thẻ này từng nằm DƯỚI mạch chính trong
          cùng một cột và phải tự kìm lại để không ăn hết chỗ của nó. Giờ hai thẻ
          đứng cạnh nhau nên chỗ không còn tranh nhau nữa. */}
      <CardContent className="flex min-h-0 flex-col gap-2 lg:flex-1">
        {/* Câu này nằm ở THÂN thẻ, không nhét xuống dưới tiêu đề: tiêu đề chỉ là
            tên (luật của `CardTitle`), còn ghi chú thì thuộc về thân.

            Chỉ hiện khi kho còn RỖNG. Đặc tả từng chốt giữ nó cả khi đã có tệp, để
            nó không thành một dòng gợi ý biến mất ngay khi có tệp đầu tiên — nhưng
            phép đo sau đó cho một dữ kiện mới: cột trái cao 473px ở cửa sổ 577px,
            mạch chính cần 297px, nên hàng dưới chỉ được 168px và dòng này là 32px
            trong số đó. Khi đã có tệp thì mấy tấm ảnh đã tự nói kho này chứa gì. */}
        {files.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Ảnh/Video đè lên trên dòng thời gian chính
          </p>
        )}
        <ScrollArea
          className="min-h-0 flex-1"
          orientation="horizontal"
          scrollbar={false}
          // `scroll-fade-r` cho dải cuộn NGANG — chỉ mờ mép phải, phía "còn nữa".
          // `size` để ô đo mình theo chiều cao vùng cuộn này, y như ô mạch chính.
          viewportClassName="scroll-fade-r [container-type:size]"
        >
          {/* Căn theo mép TRÊN. Mọi khung ảnh ở đây cao bằng nhau, nên căn trên
              là mép trên lẫn mép dưới của ảnh đều thẳng hàng. Căn theo đáy thì ô
              "Thêm" — thứ duy nhất không có dòng tên bên dưới — tụt xuống đúng
              bằng chiều cao dòng tên và trông như bị lệch. */}
          {/* Một hàng, cuộn ngang — cùng nếp với mạch chính. */}
          <div className="flex w-max items-start gap-2">
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
            {/* Ô "Thêm" mở MENU hai đường, không phải hộp chọn tệp thẳng: ở
                tiêu đề thẻ hai đường là hai cái nút đứng cạnh nhau, nhưng ở cuối
                dải chỉ có chỗ cho một ô. Nếu ô này lẳng lặng mở hộp chọn tệp thì
                nó với nút "Từ kho" trên kia trông giống nhau mà làm khác nhau —
                và ai kéo tới cuối dải sẽ tưởng ở đây không lấy được từ kho. */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <AddMediaTile
                    label="Thêm"
                    // Cùng dáng dọc với ô tư liệu, KHÔNG vuông: vuông thì nó
                    // rộng bằng chính chiều cao mình — đo trong cột hẹp, ô
                    // "Thêm" 141px rộng đứng cạnh ô tư liệu 68px và đẩy chính
                    // nó xuống hàng dưới.
                    className={cn("aspect-[9/16]", TILE_ADD_WIDTH)}
                  />
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onPick}>
                  <PlusIcon />
                  Lấy tệp từ máy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onPickFromLibrary}>
                  <LibraryIcon />
                  Chọn từ kho tư liệu
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
