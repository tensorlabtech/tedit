import { ImagesIcon, StarIcon, VideoIcon } from "lucide-react";

import { MediaThumb } from "@/components/media-thumb";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ApiLibraryAsset } from "@/lib/api";
import { formatDuration } from "@/lib/format-duration";
import { cn } from "@/lib/utils";

/**
 * Một ô trong kho tư liệu — cùng khuôn với ô Dự án.
 *
 * Cố tình dựng theo `project-tile.tsx`: hai màn kho đứng cạnh nhau trong cùng một
 * thanh bên, nên ô của chúng mà khác nhau thì đọc ra như hai ứng dụng khác nhau.
 * Cùng `Card size="sm"`, cùng khung 16:9, cùng vòng sáng khi rê tới, cùng cách
 * cắt tên dài.
 *
 * KHÔNG sửa gì tại chỗ. Sửa ngay trong ô thì mỗi lần mở ra là ô cao thêm, cả hàng
 * bên cạnh bị đẩy lệch — mà tên tệp máy sinh dài tới bốn chục ký tự nên ô nào cũng
 * dễ rơi vào cảnh đó. Bấm vào ô là mở hộp xem lớn, sửa ở đấy.
 */
export function AssetTile({
  asset,
  onOpen,
  onStar,
}: {
  asset: ApiLibraryAsset;
  onOpen: () => void;
  onStar: (on: boolean) => void;
}) {
  const src = `/files/assets/${encodeURIComponent(asset.file)}`;

  return (
    <Card
      size="sm"
      role="button"
      tabIndex={0}
      className="group/tile relative gap-0 outline-none transition-shadow hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpen();
      }}
    >
      <CardContent className="flex flex-col gap-3">
        {/* Ảnh TRÀN MÉP thẻ: lề âm khớp đúng đệm thẻ (`--card-spacing`) kéo ảnh ra
            sát mép trái/phải/trên, để mép trái ảnh THẲNG với tiêu đề và ô tìm.
            Góc trên bo theo thẻ nhờ `overflow-hidden rounded-xl` của Card. */}
        <div className="relative -mx-(--card-spacing) -mt-(--card-spacing) aspect-video overflow-hidden rounded-b-xl bg-muted">
          <MediaThumb src={src} kind={asset.kind} />

          <Badge variant="secondary" className="absolute top-2 left-2 gap-1">
            {asset.kind === "image" ? (
              <ImagesIcon className="size-3" />
            ) : (
              <VideoIcon className="size-3" />
            )}
            {asset.kind === "image" ? "Ảnh" : "Video"}
          </Badge>

          {asset.kind === "video" && asset.seconds > 0 && (
            <Badge variant="secondary" className="absolute bottom-2 left-2">
              {formatDuration(asset.seconds)}
            </Badge>
          )}

          {/* Dấu sao nằm TRÊN ảnh chứ không dưới tên: nó là thứ người ta bấm
              nhiều nhất ở màn này, và để dưới thì mỗi ô lại cao thêm một dòng. */}
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label={asset.starred ? "Bỏ đánh dấu" : "Đánh dấu"}
            tooltip={asset.starred ? "Bỏ đánh dấu" : "Đánh dấu"}
            className="absolute top-2 right-2"
            onClick={(event) => {
              // Chặn lan lên thẻ, không thì bấm sao cũng mở luôn hộp xem.
              event.stopPropagation();
              onStar(!asset.starred);
            }}
          >
            <StarIcon
              className={cn(asset.starred && "fill-current text-primary")}
            />
          </Button>
        </div>

        <div className="grid gap-1">
          <p className="truncate text-sm" title={asset.title}>
            {asset.title}
          </p>
          {/* Thiếu mô tả là chuyện CÓ HẬU QUẢ: chặng ghép tư liệu bỏ qua hẳn tấm
              này. Nói ra bằng màu cảnh báo, không giấu trong một dòng xám. */}
          <p
            className={cn(
              "truncate text-xs",
              asset.description ? "text-muted-foreground" : "text-destructive",
            )}
          >
            {asset.description || "Chưa có mô tả"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
