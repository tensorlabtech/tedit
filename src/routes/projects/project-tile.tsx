import { FilmIcon, Trash2Icon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, type ProjectSummary } from "@/lib/api";
import { formatDuration } from "@/lib/format-duration";
import { formatMoment } from "@/lib/format-moment";

export function ProjectTile({
  project,
  onOpen,
  onDelete,
}: {
  project: ProjectSummary;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const thumbnail = project.thumb_path ? api.fileUrl(project.thumb_path) : null;

  return (
    <Card
      size="sm"
      // Cả ô là một mục bấm được, không chỉ riêng cái tên: ô càng lớn thì đích
      // bấm càng phải lớn theo, chứ không phải càng nhiều chỗ bấm hụt.
      role="button"
      tabIndex={0}
      // Tên nhóm RIÊNG cho ô, không dùng `group/card` có sẵn của `Card`: thẻ
      // bọc cả lưới cũng là một `Card`, nên rê vào bất kỳ đâu trong lưới là mọi
      // ô đều tưởng mình đang được rê tới.
      className="group/tile relative gap-0 outline-none transition-shadow hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpen();
      }}
    >
      <CardContent className="flex flex-col gap-3">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <FilmIcon className="absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
          )}
          {project.duration ? (
            <Badge variant="secondary" className="absolute bottom-2 left-2">
              {formatDuration(project.duration)}
            </Badge>
          ) : null}
        </div>

        <div className="grid gap-1">
          {/* Tên đứng cạnh MỐC TẠO, không đứng một mình: mọi dự án đều mang
              cùng một cái tên "Dự án mới", nên cái tên không phân biệt được ô
              nào với ô nào — lúc tạo mới là thứ làm được việc đó. */}
          <div className="flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate text-sm" title={project.title}>
              {project.title}
            </p>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {formatMoment(project.created_at)}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {project.status === "ready"
              ? `${project.sentence_count} câu`
              : "Chưa chép lời"}
            {project.file_count > 0 && ` · ${project.file_count} tệp`}
          </p>
        </div>
      </CardContent>

      {/* Xoá dự án là xoá luôn tệp gốc trên đĩa — hỏi lại một lần, không có
          thùng rác để lấy lại. */}
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="secondary"
              size="icon-xs"
              aria-label={`Xoá dự án ${project.title}`}
              // Nút nằm ĐÈ lên ô bấm được, nên phải chặn sự kiện nổi lên — không
              // thì bấm xoá cũng mở luôn dự án ở phía sau hộp thoại.
              onClick={(event) => event.stopPropagation()}
              // Chỉ hiện khi rê vào đúng ô này hoặc ô đang giữ tiêu điểm: một
              // lưới bày sẵn vài chục nút xoá vừa rối vừa mời gọi bấm nhầm.
              // `focus-within` chứ không `focus-visible` của riêng nút: người đi
              // bằng bàn phím dừng ở Ô trước, nút phải hiện ngay lúc đó chứ
              // không để họ Tab vào một thứ trong suốt.
              className="absolute top-6 right-6 opacity-0 transition-opacity group-hover/tile:opacity-100 group-focus-within/tile:opacity-100"
            />
          }
        >
          <Trash2Icon />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Xoá dự án này?</AlertDialogTitle>
          <AlertDialogDescription>
            Xoá luôn video và mọi chỉnh sửa. Không lấy lại được.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            {/* Nút xoá mang màu báo nguy, không mang màu chủ đạo: màu chủ đạo
                là màu của "đi tiếp", mà đây là việc không lấy lại được. */}
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
