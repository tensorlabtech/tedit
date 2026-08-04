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
 * Lưới ô vuông giấu mất mô tả sau một lượt bấm. Danh sách hàng ngang bày nó ra
 * ngay cạnh ảnh, và sửa được tại chỗ — thứ quan trọng nhất của bước này phải là
 * thứ dễ thấy nhất.
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
          <Button variant="outline" onClick={onPickFromLibrary}>
            <LibraryIcon />
            Từ kho
          </Button>
          <Button variant="outline" onClick={onPick}>
            <PlusIcon />
            Thêm
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto">
        {files.length === 0 ? (
          <p className="text-muted-foreground">
            Chưa có tư liệu nào. Không có cũng được — máy vẫn dựng, chỉ là không
            có gì chèn vào giữa lời nói.
          </p>
        ) : null}
        {files.map((file) => (
          <div
            key={file.id}
            data-state={file.id === selectedId ? "here" : "off"}
            className="group grid gap-2 rounded-lg border border-border p-2 data-[state=here]:ring-2 data-[state=here]:ring-primary data-[state=here]:ring-inset"
          >
            <div className="flex items-center gap-2">
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
                <span className="min-w-0 flex-1 text-sm leading-tight break-all">
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
                  onClick={() => onRemove(file.id)}
                  className="col-start-1 row-start-1 opacity-0 group-hover:opacity-100"
                >
                  <XIcon />
                </Button>
              </span>
            </div>
            {/*
              KHÔNG có ô nhập mô tả ở đây.

              `SequencePreviewCard` bên trái đã có một ô rồi, và hai ô cho cùng
              một dữ liệu thì chúng lệch nhau ngay — chụp màn thấy ô bên trái
              trống trong khi ô bên phải đã có chữ.

              Ô bên trái đúng chỗ hơn: người ta nhìn thấy video trong lúc gõ.
              Ở đây chỉ HIỆN LẠI để biết tư liệu nào đã tả, tư liệu nào chưa.
            */}
            {file.description?.trim() ? (
              <p className="text-muted-foreground text-sm">{file.description}</p>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                Chưa tả — bấm để mở rồi gõ ở khung xem trước
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
