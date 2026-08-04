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
 * ══ BỎ NHÃN NHÓM VÀ VẠCH KHOÁ ══
 *
 * Bản đầu có ba nhãn nhóm ("NẠP VÀO", "SOÁT", "CHỈNH") và một vạch kèm chữ
 * "qua đây là chép lời lại". Chụp màn ra thì cả bốn thứ ấy là nhiễu: tám dòng
 * đánh số 1–8 đã đọc được thứ tự rồi, còn nhãn nhóm chỉ chen vào giữa và đẩy
 * các bước xa nhau.
 *
 * Cửa một chiều vẫn còn — nó nằm trong `canGoBack`, và người dùng thấy nó qua
 * việc bước cũ KHÔNG bấm được nữa. Một dòng chữ giải thích trước khi ai đó cần
 * là dạy bài trước khi có câu hỏi.
 */


export function FlowSidebar({
  current,
  onPick,
}: {
  current: FlowStepId;
  /** Bấm một bước đã qua. Bước chưa tới hoặc đã khoá thì không gọi. */
  onPick: (id: FlowStepId) => void;
}) {
  const at = stepIndex(current);
  const door = stepIndex(ONE_WAY_AFTER);

  return (
    <div className="grid content-start gap-2 lg:min-h-0 lg:overflow-y-auto">
      {FLOW_STEPS.map((step, index) => {
        const done = index < at;
        const here = index === at;
        // Bước sau cửa thì không về được bước trước cửa — xem `canGoBack`.
        const locked = at > door && index <= door;
        const openable = done && !locked;

        return (
          <Card
            key={step.id}
            data-state={here ? "here" : done ? "done" : "todo"}
            onClick={() => openable && onPick(step.id)}
            /*
             * Dùng `ring` chứ không `border`: thẻ Card đã có `border` riêng và
             * nó thắng, nên bước đang đứng không được tô gì cả — chụp màn mới
             * thấy. `ring-inset` để vòng sáng không bị lưới ngoài cắt mất,
             * đúng điều `CLAUDE.md` dặn về viền và ring.
             */
            className={
              "data-[state=here]:ring-2 data-[state=here]:ring-primary data-[state=here]:ring-inset data-[state=todo]:opacity-45" +
              (openable ? " cursor-pointer" : "")
            }
          >
            <CardContent className="flex items-center gap-3">
              <span className="text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <span className="flex-1">{step.label}</span>
              {/* Ai đang làm — nhìn một cái là biết đợi hay tới lượt mình. */}
              {done ? <CheckIcon /> : null}
              {locked ? <LockIcon /> : null}
              {here && step.actor === "machine" ? (
                <span className="text-muted-foreground text-xs">máy</span>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
