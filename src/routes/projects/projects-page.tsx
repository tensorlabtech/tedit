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
import { EmptyState } from "@/components/empty-state";
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
    // MỘT thẻ, không phải thẻ tiêu đề cộng thẻ nội dung.
    //
    // Thanh bên đã nói đang ở mục nào và đang đăng nhập bằng ai, nên một thẻ riêng
    // chỉ để nhắc lại tên màn là một tầng thừa — nó ăn chiều cao của đúng thứ người
    // ta vào đây để xem. Tiêu đề giờ nằm ở đầu thẻ chứa lưới.
    <Card className="h-full min-h-0">
      <CardHeader>
        <CardTitle>Dự án</CardTitle>
        <CardAction>
          <Button onClick={() => navigate("/upload")}>
            <PlusIcon data-icon="inline-start" />
            Dự án mới
          </Button>
        </CardAction>
      </CardHeader>

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
                {error} — dự án của bạn vẫn còn nguyên, chỉ là chưa gọi được máy
                chủ.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="secondary" onClick={load}>
                Thử lại
              </Button>
            </EmptyContent>
          </Empty>
        ) : !projects ? (
          <EmptyState loading title="Đang lấy danh sách dự án" />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<VideoIcon />}
            title="Chưa có dự án nào"
            description="Thả video quay dọc vào là máy tự chép lời, rồi bạn sửa theo lời thay vì theo giây."
            action={
              <Button onClick={() => navigate("/upload")}>
                <PlusIcon data-icon="inline-start" />
                Dự án mới
              </Button>
            }
          />
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
  );
}
