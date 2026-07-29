import { CheckIcon, FilmIcon, ImageIcon } from "lucide-react";

import { api, type ApiFile } from "@/lib/api";
import { cn } from "@/lib/utils";

import { formatTime, isVideoName } from "./editor-data";

/**
 * Một ô trong lưới tư liệu.
 *
 * Ô theo khung 9:16 vì ảnh thu nhỏ máy chủ dựng ra CŨNG là 9:16 (xem
 * `makeThumbnail`). Trước đây ô là 16:9 nên mỗi ảnh bị cắt hai lần ngược chiều
 * nhau — còn lại một lát ngang mỏng ở giữa, nhìn ô nào cũng không ra cảnh gì.
 *
 * Trong ô chỉ có ảnh và thời lượng. Tên tệp để dành cho khung xem trước: tên do
 * TikTok / máy ảnh đặt, in lên đây thì mỗi ô mất một góc tư cho một chuỗi không
 * phân biệt được gì.
 */
export function InsertTile({
  file,
  active,
  onSelect,
  onInsertNow,
}: {
  file: ApiFile;
  active: boolean;
  onSelect: () => void;
  onInsertNow: () => void;
}) {
  const video = isVideoName(file.name);
  // Ảnh thu nhỏ do máy chủ dựng sẵn. Với ẢNH thì lấy thẳng tệp gốc khi chưa có —
  // tệp tải lên bằng bản cũ không có ảnh thu nhỏ nào để mà lấy.
  const thumbnail = file.thumb_path
    ? api.fileUrl(file.thumb_path)
    : video
      ? undefined
      : api.mediaUrl(file.id);

  return (
    <button
      type="button"
      onClick={onSelect}
      // Bấm đúp là chèn luôn: người đã biết mình cần cái nào thì không phải đi
      // thêm một vòng xuống nút ở chân bảng.
      onDoubleClick={onInsertNow}
      title={file.name}
      className="group/tile relative aspect-[9/16] overflow-hidden rounded-lg bg-muted text-left"
    >
      {thumbnail ? (
        <img src={thumbnail} alt="" className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-muted-foreground">
          <FilmIcon className="size-5" />
        </span>
      )}
      {/* Viền là một LỚP PHỦ, không phải viền của chính cái nút.
          · Viền ngoài (`ring-*`) bị vùng cuộn gọt mất một cạnh khi ô nằm sát mép.
          · Viền trong (`inset-ring`) thì bị chính tấm ảnh đè lên — `box-shadow:
            inset` vẽ DƯỚI nội dung, mà ảnh phủ kín ô.
          Một lớp phủ tuyệt đối nằm sau ảnh trong thứ tự vẽ nên hiện lên trên nó,
          mà vẫn nằm gọn trong hộp của ô nên không ai cắt được. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] border transition-colors",
          active ? "border-2 border-primary" : "border-border/60",
        )}
      />
      {/* Dấu tích: trên một tấm ảnh nhiều chi tiết, một đường viền 2px vẫn có thể
          lẫn vào cảnh. Dấu tích thì không lẫn vào đâu được, và nó nói đúng cái
          người dùng đang hỏi — "cái nào đang chọn". */}
      {active && (
        <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon className="size-3" />
        </span>
      )}
      {/* Loại tệp ở góc trên, thời lượng ở góc dưới: hai mẩu nhỏ đặt vào hai chỗ
          ảnh ít nội dung nhất, thay cho dải nhãn cũ chạy hết bề ngang ô. */}
      <span className="absolute top-1 left-1 grid size-5 place-items-center rounded bg-black/55 text-white">
        {video ? (
          <FilmIcon className="size-3" />
        ) : (
          <ImageIcon className="size-3" />
        )}
      </span>
      {file.duration ? (
        <span className="absolute right-1 bottom-1 rounded bg-black/55 px-1 text-[11px] text-white tabular-nums">
          {formatTime(file.duration)}
        </span>
      ) : null}
    </button>
  );
}
