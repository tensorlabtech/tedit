import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlugZapIcon, PlusIcon, VideoIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { api, type ProjectSummary } from "@/lib/api";

import { ProjectTile } from "./project-tile";

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  /**
   * Máy chủ không trả lời là một chuyện KHÁC HẲN "chưa có dự án nào".
   *
   * Trước đây lỗi mạng cũng rơi vào nhánh danh sách rỗng: người vừa dựng bảy
   * dự án mở máy lên thấy "Chưa có dự án nào" và tưởng mất sạch, trong khi dữ
   * liệu vẫn nằm nguyên trên đĩa. Lời báo sai kiểu này còn tệ hơn im lặng.
   */
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setProjects(null);
    api
      .listProjects()
      .then(setProjects)
      .catch((cause: Error) =>
        setError(cause.message || "Máy chủ không trả lời"),
      );
  };

  useEffect(load, []);

  const remove = async (id: string) => {
    await api.deleteProject(id);
    setProjects((current) => (current ?? []).filter((item) => item.id !== id));
  };

  return (
    <div className="grid h-svh grid-rows-[auto_1fr] gap-2 overflow-hidden bg-background p-2 text-foreground">
      <Card>
        <CardHeader>
          <CardTitle>Dự án của bạn</CardTitle>
          <CardAction>
            <Button onClick={() => navigate("/upload")}>
              <PlusIcon data-icon="inline-start" />
              Dự án mới
            </Button>
          </CardAction>
        </CardHeader>
      </Card>

      <Card className="min-h-0">
        {/* `flex flex-col`: `CardContent` mặc định là khối thường nên ô rỗng
            căn giữa bằng `flex-1` sẽ dính lên sát mép trên nếu thiếu. */}
        <CardContent className="flex min-h-0 flex-1 flex-col">
          {error ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PlugZapIcon />
                </EmptyMedia>
                <EmptyTitle>Không lấy được danh sách dự án</EmptyTitle>
                <EmptyDescription>
                  {error} — dự án của bạn vẫn còn nguyên, chỉ là chưa gọi được
                  máy chủ.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="secondary" onClick={load}>
                  Thử lại
                </Button>
              </EmptyContent>
            </Empty>
          ) : !projects ? (
            <Empty>
              <Spinner />
              <EmptyTitle>Đang lấy danh sách</EmptyTitle>
            </Empty>
          ) : projects.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <VideoIcon />
                </EmptyMedia>
                <EmptyTitle>Chưa có dự án nào</EmptyTitle>
                <EmptyDescription>
                  Thả video quay dọc vào là máy tự chép lời, rồi bạn sửa theo
                  lời thay vì theo giây.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => navigate("/upload")}>
                  <PlusIcon data-icon="inline-start" />
                  Dự án mới
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            // Cuộn không bày thanh: mép dưới mờ dần đã nói "còn nữa" rồi.
            //
            // Đệm chừa chỗ cho vòng tiêu điểm — nó vẽ ra NGOÀI hộp thẻ nên sát
            // mép vùng cuộn là bị cắt mất. Trước đây để `p-0.5` (2px) trong khi
            // cả hệ vẽ `focus-visible:ring-3` (3px): đúng ý, thiếu một pixel, và
            // thiếu một pixel thì vẫn cụt. Giờ khớp đúng bề dày ring.
            //
            // Vùng cuộn này TỰ VIẾT TAY nên không hưởng bản sửa ở `ScrollArea`.
            <div className="no-scrollbar scroll-fade-b min-h-0 flex-1 overflow-y-auto p-[3px]">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
                {projects.map((project) => (
                  <ProjectTile
                    key={project.id}
                    project={project}
                    onOpen={() => navigate(`/editor/${project.id}`)}
                    onDelete={() => remove(project.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
