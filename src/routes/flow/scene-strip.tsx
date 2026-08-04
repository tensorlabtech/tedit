import { GripVerticalIcon, PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, type MediaFile } from "../upload/upload-data";

/**
 * DẢI PHIM DỌC — danh sách cảnh chính, xếp đứng bên cạnh ô xem trước.
 *
 * ══ VÌ SAO KHÔNG DÙNG `MainTimelineCard` ══
 *
 * Thẻ ấy xếp NGANG, và ở `/upload` nó đúng: nó nằm dưới cùng, chạy hết bề
 * ngang trang. Bê sang đây thì đo được sáu ô chiếm 370px trong một thẻ rộng
 * 1176 — phí 800px, mà tên tệp lại bị cắt còn "mai…", vô nghĩa.
 *
 * Cùng lúc ô xem trước phí 79% bề ngang: video dọc 250px nằm giữa khung 1176.
 *
 * Hai chỗ phí ấy cộng lại thành một cách xếp: **xem trước bên trái, dải phim
 * dựng đứng bên phải**. Video rộng ra, danh sách dùng chiều cao thay vì chiều
 * ngang, và tên tệp hiện đủ.
 *
 * Viết riêng chứ không sửa `MainTimelineCard` cho xoay được: một thẻ hai chiều
 * là hai bố cục nhét vào một tệp, và mọi lần sửa sau đều phải nghĩ cho cả hai.
 * Bước này làm đúng việc của bước này.
 */

export function SceneStrip({
  files,
  selectedId,
  onOpen,
  onPick,
  onRemove,
}: {
  files: MediaFile[];
  selectedId: string | null;
  onOpen: (id: string) => void;
  onPick: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card className="lg:min-h-0">
      <CardHeader>
        <CardTitle>Mạch chính</CardTitle>
      </CardHeader>
      <CardContent className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto">
        {files.map((file, index) => (
          <button
            key={file.id}
            type="button"
            onClick={() => onOpen(file.id)}
            data-state={file.id === selectedId ? "here" : "off"}
            className="group flex cursor-pointer items-center gap-2 rounded-md border border-border p-1 text-left data-[state=here]:ring-2 data-[state=here]:ring-primary data-[state=here]:ring-inset"
          >
            {/* Tay nắm để đó cho biết kéo được — phép kéo thật chưa nối, và
                thà nhìn ra là chưa xong còn hơn kéo mà không có gì xảy ra. */}
            <GripVerticalIcon className="text-muted-foreground shrink-0" />
            <span className="text-muted-foreground w-4 shrink-0 tabular-nums text-xs">
              {index + 1}
            </span>
            <span className="bg-muted h-10 w-7 shrink-0 overflow-hidden rounded-sm">
              {file.thumbnail ? (
                <img
                  src={file.thumbnail}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </span>
            {/* Tên hiện ĐỦ hai dòng: cắt còn "mai…" thì sáu ô nhìn giống hệt
                nhau, và người dùng không phân biệt được cảnh nào với cảnh nào. */}
            <span className="min-w-0 flex-1 text-sm leading-tight break-words">
              {file.name}
            </span>
            <span className="text-muted-foreground shrink-0 tabular-nums text-xs">
              {file.duration ? formatDuration(file.duration) : ""}
            </span>
            <XIcon
              className="text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(file.id);
              }}
            />
          </button>
        ))}
        <Button variant="ghost" onClick={onPick} className="justify-start">
          <PlusIcon data-icon="inline-start" />
          Thêm video
        </Button>
      </CardContent>
    </Card>
  );
}
