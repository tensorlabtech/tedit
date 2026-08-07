import { LibraryIcon, PlusIcon, XIcon } from "lucide-react";

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
 * DANH SÁCH TƯ LIỆU CHÈN — xem và SỬA MÔ TẢ ngay tại chỗ.
 *
 * ══ VÌ SAO KHÔNG DÙNG `InsertMediaCard` ══
 *
 * Thẻ ấy là một lưới ô vuông to. Ở `/upload` nó đúng — chỗ ấy chỉ cần nạp tệp
 * vào. Nhưng ở bước này việc chính KHÔNG phải nạp, mà là **mô tả**: chính mô tả
 * đi vào `ai-broll-place` để máy biết đặt tư liệu nào vào chỗ nào trong lời
 * nói. Tư liệu không mô tả thì máy đặt mò.
 *
 * Danh sách hàng ngang gọn để LƯỚT nhanh cả mớ tư liệu; bấm một hàng thì khung
 * xem trước bên trái mở tư liệu đó ra kèm ô nhập mô tả (mô tả sửa ở đó, không
 * lặp lại sang đây — hai chỗ cùng một điều là hai chỗ để lệch nhau).
 *
 * Cùng hình dạng hai cột với bước cảnh chính: xem trước trái, danh sách phải.
 * Người dùng học một bố cục, dùng cho cả hai bước.
 */

export function BRollList({
  files,
  selectedId,
  onOpen,
  onPick,
  onPickFromLibrary,
  onRemove,
}: {
  files: MediaFile[];
  selectedId: string | null;
  onOpen: (id: string) => void;
  onPick: () => void;
  onPickFromLibrary: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card className="lg:min-h-0">
      <CardHeader>
        <CardTitle>Tư liệu chèn</CardTitle>
        {/* Cùng kiểu nút với `InsertMediaCard` ở /upload: `outline`, có icon.
            `ghost` làm chúng trông như chữ thường, không ra nút. */}
        <CardAction className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onPickFromLibrary}>
            <LibraryIcon />
            Từ kho
          </Button>
          <Button variant="secondary" size="sm" onClick={onPick}>
            <PlusIcon />
            Thêm
          </Button>
        </CardAction>
      </CardHeader>
      {/* `grid-cols-[minmax(0,1fr)]` — KHÔNG để cột ngầm `auto`. Cột `auto` nở tới
          MAX-CONTENT của hàng (tên tệp `nowrap` đầy đủ), vượt bề ngang card, tràn
          ra ngoài và `truncate` thành vô dụng vì cột đã nở rồi. Khai một cột
          minmax(0,1fr) thì cột LẤP đúng bề ngang card, hàng bị bó lại, `truncate`
          của tên mới ăn và thời lượng giữ được chỗ. */}
      <CardContent className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] content-start gap-2 overflow-y-auto">
        {files.length === 0 ? (
          <p className="text-muted-foreground">
            Chưa có tư liệu nào. Không có cũng được — máy vẫn dựng, chỉ là không
            có gì chèn vào giữa lời nói.
          </p>
        ) : null}
        {files.map((file) => (
          // Hàng là FLEX thẳng, KHÔNG bọc thêm lớp `grid` bên ngoài: lớp grid
          // đó là một grid-item có `min-width:auto`, cắt đứt chuỗi `min-w-0` nên
          // `truncate` của tên tệp mất tác dụng — tên dài tràn khỏi card, đẩy
          // thời lượng ra ngoài. Ưu tiên là: thời lượng/nút gỡ (`shrink-0`) luôn
          // giữ chỗ, tên (`min-w-0 flex-1`) co lại còn bao nhiêu ăn bấy nhiêu.
          <div
            key={file.id}
            data-state={file.id === selectedId ? "here" : "off"}
            className="group flex items-center gap-2 rounded-lg border border-border p-3 data-[state=here]:ring-2 data-[state=here]:ring-primary data-[state=here]:ring-inset"
          >
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
              {/* `truncate` (một dòng + "…") thay vì `break-all`: tên tệp mạng
                  xã hội dài cả trăm ký tự vỡ thành ba dòng, đội cao cả hàng và
                  đẩy lệch mọi thẻ dưới. Tên đầy đủ vẫn còn ở `title`/aria. */}
              <span
                title={file.name}
                className="min-w-0 flex-1 truncate text-sm leading-tight"
              >
                {file.name}
              </span>
            </button>
            {/* Rê chuột thì nút gỡ thế chỗ thời lượng — cùng một ô, hai trạng
                thái, nên không có khoảng trống lơ lửng lúc không rê. */}
            <span className="grid shrink-0 place-items-center">
              <span className="text-muted-foreground col-start-1 row-start-1 tabular-nums text-xs group-hover:invisible">
                {file.duration ? formatDuration(file.duration) : ""}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Gỡ ${file.name}`}
                // Tooltip NGẮN, không lấy mặc-định-từ-aria-label. Nút X nằm ở cột
                // 34rem ngoài cùng bên phải; để tooltip là nguyên tên tệp thì
                // overlay portal ra sát mép phải, đẩy rộng document → hiện
                // scrollbar ngang lúc rê chuột. Tên đã hiện ngay trên hàng rồi.
                tooltip="Gỡ tư liệu"
                onClick={() => onRemove(file.id)}
                className="col-start-1 row-start-1 opacity-0 group-hover:opacity-100"
              >
                <XIcon />
              </Button>
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
