import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[16rem_1fr]">
      <FlowSidebar current={at} onPick={(id) => setViewing(id)} />

      <Card className="lg:min-h-0">
        <CardHeader>
          <CardTitle>{step.label}</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">
          {/*
            Bên phải CHƯA có nội dung riêng cho từng bước — đang dựng dần. Trong
            lúc đó dẫn sang hai trang cũ chứ không bày một ô trống: một khung
            rỗng nói với người dùng rằng sản phẩm hỏng, còn một đường dẫn thì
            nói rằng chỗ này chưa xong.
          */}
          <div className="grid gap-2">
            <p className="text-muted-foreground">
              {step.actor === "machine"
                ? "Máy đang làm, chưa tới lượt bạn."
                : "Tới lượt bạn."}
            </p>
            <button
              type="button"
              className="cursor-pointer underline"
              onClick={() =>
                navigate(
                  step.actor === "machine"
                    ? `/pipeline/${projectId}`
                    : `/editor/${projectId}`,
                )
              }
            >
              {step.actor === "machine" ? "Xem tiến độ chi tiết" : "Mở bàn dựng"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
