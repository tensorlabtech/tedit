import {
  CropIcon,
  FileVideoIcon,
  GripVerticalIcon,
  ImageIcon,
  TriangleAlertIcon,
  VolumeOffIcon,
} from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import { MediaTileMenu } from "./media-tile-menu";
import {
  aspectRatioOf,
  formatDuration,
  isLandscape,
  isVideo,
  shortName,
  type MediaFile,
  type MediaRole,
} from "./upload-data";
import { useHoverScrub } from "./use-hover-scrub";

/**
 * Chữ đặt TRÊN khung hình: chữ trắng có bóng, không phải huy hiệu nền xám.
 *
 * Huy hiệu là một VẬT — nó chiếm chỗ, có mép, và mắt đọc ra "một nút gì đó".
 * Số thứ tự và thời lượng chỉ là ghi chú trên ảnh, nên chúng nên nhẹ như phụ đề
 * phim: bóng đổ lo phần đọc được trên nền sáng, còn lại để hình thở.
 */
const ON_IMAGE = "text-white [text-shadow:0_1px_4px_rgb(0_0_0/0.75)]";

type Props = {
  file: MediaFile;
  /** Số thứ tự trong mạch video. Bỏ trống với tư liệu chèn — chúng không có mạch. */
  index?: number;
  /**
   * Số cảnh HIỆN RA trên ô. Khác `index` ở chỗ nó bỏ qua những ô tải hỏng: ô
   * hỏng không lên tới máy chủ nên nó không có trong video, mà vẫn chiếm một số
   * thì cảnh 3 bị gọi là cảnh 4 suốt từ đó về sau.
   */
  sceneNumber?: number;
  count?: number;
  /** Tệp gốc trong bộ nhớ trình duyệt — có nó thì rê chuột ngang qua ô là tua qua video */
  source?: File;
  /**
   * Khung ô. Cảnh chính cắt theo 9:16 vì đó ĐÚNG là khung sẽ xuất ra — nhìn ô là
   * biết ngay video ngang sẽ mất hai bên. Tư liệu chèn giữ NGUYÊN tỉ lệ gốc: nó
   * dán đè lên một góc màn chứ không chiếm cả khung, nên cắt nó về một khuôn
   * chung là bịa ra một khung hình không có thật.
   */
  shape: "portrait" | "natural";
  /** Ô đang nằm trong khung xem trước */
  selected?: boolean;
  moveTo: MediaRole;
  onOpen: () => void;
  onReorder?: (direction: -1 | 1) => void;
  onMove: () => void;
  onRemove: () => void;
  onCancel: () => void;
  onRetry: () => void;
  /** Bộ thuộc tính kéo cho tay nắm; bỏ trống thì ô không đổi chỗ được */
  handleProps?: React.HTMLAttributes<HTMLElement>;
  dragging?: boolean;
} & React.ComponentProps<"div">;

export function MediaTile({
  file,
  index,
  sceneNumber,
  count = 0,
  source,
  shape,
  selected,
  moveTo,
  onOpen,
  onReorder,
  onMove,
  onRemove,
  onCancel,
  onRetry,
  handleProps,
  dragging,
  className,
  ...rest
}: Props) {
  const label = shortName(file.name);
  // Chỉ CẢNH CHÍNH mới bị cắt: nó phải vừa khung 9:16 của video xuất ra. Tư
  // liệu chèn dán đè lên một góc màn và giữ nguyên tỉ lệ, nên gắn dấu ✂ lên nó
  // là doạ người dùng bằng một chuyện không xảy ra.
  const willCrop = isLandscape(file) && shape === "portrait";
  const silent = isVideo(file.name) && file.hasAudio === false;
  const uploading = file.status === "uploading";
  const failed = file.status === "error";
  const caption = failed ? (file.error ?? "Tải hỏng") : file.name;

  const {
    url: scrubUrl,
    at: scrubAt,
    videoRef,
    areaProps,
  } = useHoverScrub(source, isVideo(file.name) && !uploading, file.remoteUrl);

  return (
    <div
      data-tile
      data-file-status={file.status}
      className={cn("group/tile relative", dragging && "opacity-60", className)}
      {...rest}
    >
      {/* Ô giữ tỉ lệ gốc: đặt CHIỀU CAO rồi để bề rộng tự suy ra từ tỉ lệ — cả
          hàng cùng một mốc trên và một mốc dưới, chỉ khác bề ngang. Chiều cao đi
          theo chiều cao màn để màn thấp không bị kho tư liệu ăn hết chỗ. */}
      <div
        className={cn(
          "relative overflow-hidden rounded-lg bg-muted",
          shape === "portrait"
            ? "aspect-[9/16]"
            : "h-[clamp(6rem,15vh,10rem)] w-auto",
        )}
        style={
          shape === "natural" ? { aspectRatio: aspectRatioOf(file) } : undefined
        }
        {...areaProps}
      >
        {file.thumbnail ? (
          <img src={file.thumbnail} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            {isVideo(file.name) ? <FileVideoIcon /> : <ImageIcon />}
          </div>
        )}

        {scrubUrl && (
          <video
            ref={videoRef}
            src={scrubUrl}
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 size-full object-cover"
          />
        )}

        {/* Tiến độ nằm TRONG ô ảnh, trên nền đã làm mờ — không đè lên tên tệp
            hay lên ô bên cạnh như bản trước, và ô không đổi cỡ lúc tải xong. */}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/75 text-xs tabular-nums">
            {file.progress}%
            <Progress
              value={file.progress}
              className="absolute inset-x-2 bottom-2"
            />
          </div>
        )}

        {failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 text-destructive">
            <TriangleAlertIcon />
          </div>
        )}

        {typeof sceneNumber === "number" && (
          <span
            className={cn(
              "absolute top-1.5 left-2 text-sm font-medium tabular-nums",
              ON_IMAGE,
            )}
          >
            {sceneNumber}
          </span>
        )}

        {/* Thời lượng nằm trên ảnh chứ không xuống dòng chú thích: dòng đó chỉ
            đủ chỗ cho MỘT thứ, mà tên tệp mới là thứ nhận dạng được ô.
            Chỉ VIDEO mới có thời lượng — ffprobe trả 0,04 giây cho tệp ảnh, đủ
            để lọt qua phép kiểm rỗng và in ra một dòng "0:00" vô nghĩa. */}
        {isVideo(file.name) && file.duration ? (
          <span
            className={cn(
              "absolute right-2 bottom-1.5 text-xs tabular-nums",
              ON_IMAGE,
            )}
          >
            {formatDuration(file.duration)}
          </span>
        ) : null}

        {/* Dấu ✂ chỉ có nghĩa với CẢNH CHÍNH: cảnh chính cắt về khung 9:16 nên
            video ngang mất hai bên thật. Tư liệu chèn dán đè lên một góc màn và
            giữ nguyên tỉ lệ — gắn ✂ lên nó là doạ người dùng bằng một chuyện
            không xảy ra. Dấu "không có tiếng" thì ngược lại, đúng ở cả hai cột. */}
        {(willCrop || silent) && !uploading && !failed && (
          <span
            className={cn(
              "absolute bottom-1.5 left-2 [&_svg]:drop-shadow-[0_1px_3px_rgb(0_0_0/0.75)]",
              ON_IMAGE,
            )}
            title={
              willCrop ? "Khung ngang — sẽ cắt hai bên" : "Video không có tiếng"
            }
          >
            {willCrop ? (
              <CropIcon className="size-3.5" />
            ) : (
              <VolumeOffIcon className="size-3.5" />
            )}
          </span>
        )}

        {/* Vạch chỗ đang tua: rê tay mà hình đổi nhưng không có gì nói mình đang
            đứng ở đâu trong cảnh thì tua thành đoán. */}
        {scrubUrl && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-primary/30">
            <span
              className="block h-full bg-primary"
              style={{ width: `${scrubAt * 100}%` }}
            />
          </span>
        )}

        {/* Mép ô là lớp phủ tuyệt đối, không phải `ring`: ô nằm trong vùng cuộn
            nên viền vẽ ra ngoài bị gọt mất một cạnh, còn `inset-ring` thì nằm
            DƯỚI ảnh nên biến mất sạch trên ô có ảnh phủ kín.
            Ô đang xem đổi màu chính viền này — cả mạch chạy tới đâu thì viền
            chạy theo tới đó, nên nhìn dải là biết khung bên phải đang ở đâu. */}
        <span
          className={cn(
            "pointer-events-none absolute inset-0 rounded-lg border",
            selected ? "border-2 border-primary" : "border-border",
          )}
        />

        {/* Cả ô ảnh là MỘT việc — xem cảnh này: rê để tua nhanh, bấm để mở khung
            lớn. Nút phủ kín thay vì bọc cả ô trong `button` vì trong nút không
            đặt được thanh tiến độ và mấy dòng ghi chú. */}
        <button
          type="button"
          onClick={onOpen}
          title={file.name}
          aria-label={`Xem ${label}`}
          className="absolute inset-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        />
      </div>

      <MediaTileMenu
        file={file}
        label={label}
        index={index}
        count={count}
        moveTo={moveTo}
        onReorder={onReorder}
        onMove={onMove}
        onRemove={onRemove}
        onCancel={onCancel}
        onRetry={onRetry}
      />

      {/* Dòng tên KIÊM tay nắm kéo — ba việc của ô nằm ở ba chỗ không chồng
          nhau: thân ô xem, dòng tên kéo, góc trên phải mở bảng thao tác. */}
      {handleProps ? (
        <div
          {...handleProps}
          title={caption}
          className={cn(
            // `select-none`: kéo bắt đầu từ chính dòng chữ này, mà chữ bôi đen
            // được thì cú kéo hụt để lại một vệt xanh trên tên tệp.
            // `w-0 min-w-full`: dòng tên KHÔNG góp vào bề rộng của ô (ô rộng
            // đúng bằng tấm ảnh) nhưng vẫn giãn hết bề rộng đó để cắt đuôi.
            "mt-1 flex w-0 min-w-full cursor-grab items-center gap-0.5 rounded text-xs outline-none select-none focus-visible:ring-2 focus-visible:ring-ring",
            failed ? "text-destructive" : "text-muted-foreground",
          )}
        >
          <GripVerticalIcon className="size-3 shrink-0 opacity-40 transition-opacity group-hover/tile:opacity-100" />
          <span className="truncate">{caption}</span>
        </div>
      ) : (
        <p
          className={cn(
            "mt-1 w-0 min-w-full truncate text-xs",
            failed ? "text-destructive" : "text-muted-foreground",
          )}
          title={caption}
        >
          {caption}
        </p>
      )}
    </div>
  );
}
