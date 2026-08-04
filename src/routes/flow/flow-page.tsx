import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

import {
  FLOW_STEPS,
  currentStep,
  stepIndex,
  type FlowStepId,
} from "../../../server/flow-steps";
import { FlowSidebar } from "./flow-sidebar";

/**
 * MỘT MÀN, NHIỀU BƯỚC — sidebar trái, nội dung phải.
 *
 * ══ VÌ SAO GỘP LẠI MỘT MÀN ══
 *
 * Trước đây luồng đi qua HAI trang: `/pipeline` chờ máy, `/editor` sửa. Mỗi lần
 * máy dừng chờ người là một chuyến đi qua lại, và tôi đã làm hỏng đúng chỗ ấy
 * hai lần — một lần bày bảng chỉ-đọc ngoài màn chờ, một lần để nút chốt sai chỗ.
 *
 * Một màn thì không còn chuyến đi nào. Bên phải đổi nội dung, sidebar nói đang
 * ở đâu. Người dùng không bao giờ "rời" chỗ đang làm.
 *
 * ══ MỖI BƯỚC MỘT MÀN RIÊNG, KHÔNG DÙNG CHUNG ══
 *
 * Nội dung từng bước làm ĐÚNG việc của bước ấy, không dựng component chung cho
 * nhiều bước. Bàn dựng hiện tại 11.236 dòng đúng vì một màn phải gánh cắt, dựng
 * chữ, phong cách, b-roll và dòng thời gian cùng lúc — mỗi trục thêm vào nhân
 * với mọi trục đã có.
 *
 * Chép hai danh sách bản chép ra hai bước tốn vài trăm dòng. Một danh sách hai
 * chế độ tốn một mê cung điều kiện mà rồi không ai dám sửa.
 */

/** Trạng thái tối thiểu để suy ra bước — xem `currentStep`. */
type Snapshot = {
  hasMain: boolean;
  hasBrief: boolean;
  awaiting: string | null;
  settled: boolean;
  started: boolean;
};

const TRONG: Snapshot = {
  hasMain: false,
  hasBrief: false,
  awaiting: null,
  settled: false,
  started: false,
};

export function FlowPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [snap, setSnap] = useState<Snapshot>(TRONG);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  /**
   * Bước người dùng ĐANG XEM — khác bước máy đang ở.
   *
   * Bấm về một bước đã qua thì chỉ đổi cái đang xem, không kéo lùi mạch. `null`
   * là bám theo máy, và đó là mặc định: người dùng mở trang ra phải thấy đúng
   * chỗ cần họ, không phải chỗ họ xem lần trước.
   */
  const [viewing, setViewing] = useState<FlowStepId | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    const pull = async () => {
      try {
        const data = await api.getProject(projectId);
        if (!alive) return;
        setTitle(data.project.title);
        setSnap({
          hasMain: data.files.some((file) => file.role === "main"),
          hasBrief: Boolean(data.project.profile?.trim()),
          awaiting: data.pipeline?.awaiting ?? null,
          settled: data.pipeline?.settled ?? false,
          started: (data.pipeline?.steps.length ?? 0) > 0,
        });
      } finally {
        if (alive) setLoading(false);
      }
    };
    void pull();
    // Hỏi lại đều đặn: bước máy đổi mà không có ai báo, nên trang phải tự nhìn.
    const timer = setInterval(() => void pull(), 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [projectId]);

  const machineAt = currentStep(snap);
  const at = viewing ?? machineAt;
  const step = FLOW_STEPS[stepIndex(at)];

  if (loading) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center">
        <Spinner />
      </div>
    );
  }

  return (
    /*
     * Phủ KÍN màn, cùng lối `pipeline-page`.
     *
     * Bản đầu để `flex-1` trong một khung không có chiều cao, nên cả trang co
     * lại còn một phần ba màn và hai phần ba dưới là nền đen trơn. `CLAUDE.md`
     * ghi rõ mọi trang đều dạng bento phủ kín — tôi phạm chính quy tắc của dự
     * án, và ảnh chụp lộ ra ngay.
     */
    <div className="grid min-h-svh gap-2 bg-background p-2 text-foreground lg:h-svh lg:grid-rows-[auto_1fr] lg:overflow-hidden">
      {/* Hàng tiêu đề: tên dự án và ĐƯỜNG RA. Thiếu nó thì trang là ngõ cụt —
          lối về duy nhất là nút lùi trình duyệt. */}
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardAction>
            <Button variant="ghost" onClick={() => navigate("/")}>
              Trở về
            </Button>
            {/* Việc chính của bước là một NÚT, không phải chữ gạch chân trôi
                giữa khung. Bước của máy thì không có nút — chờ là chờ. */}
            {step.actor === "user" ? (
              <Button onClick={() => navigate(`/editor/${projectId}`)}>
                Mở bàn dựng
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            ) : null}
          </CardAction>
        </CardHeader>
      </Card>

      <div className="grid gap-2 lg:min-h-0 lg:grid-cols-[17rem_1fr]">
        <FlowSidebar current={at} onPick={(id) => setViewing(id)} />

        <Card className="lg:min-h-0">
          <CardHeader>
            <CardTitle>{step.label}</CardTitle>
          </CardHeader>
          <CardContent className="grid min-h-0 flex-1 place-items-center">
            {/*
              Nội dung riêng từng bước CHƯA dựng. Nói thẳng ra thế, ở giữa
              khung — một ô trống với chữ trôi ở góc thì người dùng đọc ra là
              sản phẩm hỏng, còn một dòng ở giữa nói "chưa xong" thì đọc ra
              đúng như nó là.
            */}
            <Empty>
              <EmptyTitle>
                {step.actor === "machine"
                  ? "Máy đang làm"
                  : "Màn của bước này chưa dựng"}
              </EmptyTitle>
              <EmptyDescription>
                {step.actor === "machine"
                  ? "Chưa tới lượt bạn — cứ đóng trang cũng được."
                  : "Tạm thời làm việc này ở bàn dựng."}
              </EmptyDescription>
            </Empty>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
