import { CheckIcon, LockIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  FLOW_STEPS,
  ONE_WAY_AFTER,
  stepIndex,
  type FlowStepId,
} from "../../../server/flow-steps";

/**
 * SIDEBAR TÁM BƯỚC — bản đồ, không phải nhật ký.
 *
 * ══ VÌ SAO KHÔNG BÀY MƯỜI BỐN CHẶNG MÁY ══
 *
 * Màn chờ cũ liệt kê cả mười bốn chặng của `STEP_PLAN`. Nó đúng với máy nhưng
 * sai với người: người dùng cần biết "đang ở đâu, còn mấy chặng", không cần
 * biết máy vừa xong lượt chọn từ khoá hay lượt đặt tư liệu.
 *
 * Mười bốn chặng ấy gộp vào đúng hai dòng ở đây. Chi tiết vẫn hiện — nhưng ở
 * BÊN PHẢI, lúc bước ấy đang chạy, tức đúng lúc người ta muốn nhìn.
 *
 * ══ MỘT VẠCH, KHÔNG PHẢI TÁM CÁI KHOÁ ══
 *
 * Chỉ một chỗ thật sự không quay lại được: qua `cat-doan` là chép lời lại, bản
 * chép cũ mất hẳn. Vẽ đúng một vạch ở đó, kèm lý do đọc được.
 *
 * Khoá cả tám bước là chặt hơn dữ liệu đòi hỏi, và người dùng va vào cái khoá
 * vô cớ đầu tiên là mất tin vào cả cái sidebar. Một cái khoá có lý do thì họ
 * chấp nhận.
 */

const GROUP_LABELS: Record<string, string> = {
  "nap-vao": "Nạp vào",
  soat: "Soát",
  chinh: "Chỉnh",
};

export function FlowSidebar({
  current,
  onPick,
}: {
  current: FlowStepId;
  /** Bấm một bước đã qua. Bước chưa tới thì không gọi. */
  onPick: (id: FlowStepId) => void;
}) {
  const at = stepIndex(current);
  const door = stepIndex(ONE_WAY_AFTER);

  return (
    <Card className="lg:min-h-0">
      <CardContent className="grid gap-1 overflow-y-auto">
        {FLOW_STEPS.map((step, index) => {
          const done = index < at;
          const here = index === at;
          // Bước sau cửa thì không về được bước trước cửa — xem `canGoBack`.
          const locked = at > door && index <= door;
          const openable = done && !locked;
          const startsGroup =
            index === 0 || FLOW_STEPS[index - 1].group !== step.group;

          return (
            <div key={step.id} className="grid gap-1">
              {startsGroup ? (
                <p className="text-muted-foreground mt-2 text-xs uppercase first:mt-0">
                  {GROUP_LABELS[step.group]}
                </p>
              ) : null}

              {/* Vạch cửa một chiều, kèm LÝ DO. Một vạch không nói gì thì đọc
                  ra là phần mềm cứng nhắc; nói ra thì đọc ra là cảnh báo. */}
              {index === door + 1 ? (
                <div className="text-muted-foreground flex items-center gap-2 py-1 text-xs">
                  <span className="bg-border h-px flex-1" />
                  <LockIcon data-icon="inline-start" />
                  qua đây là chép lời lại
                  <span className="bg-border h-px flex-1" />
                </div>
              ) : null}

              <button
                type="button"
                disabled={!openable}
                onClick={() => openable && onPick(step.id)}
                data-state={here ? "here" : done ? "done" : "todo"}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left disabled:cursor-default data-[state=here]:border-ring data-[state=todo]:opacity-50"
              >
                <span className="text-muted-foreground tabular-nums text-xs">
                  {index + 1}
                </span>
                <span className="flex-1">{step.label}</span>
                {/* Ai đang làm — người xem biết ngay là đợi hay tới lượt mình. */}
                {done ? <CheckIcon data-icon="inline-end" /> : null}
                {here && step.actor === "may" ? (
                  <span className="text-muted-foreground text-xs">máy</span>
                ) : null}
              </button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
