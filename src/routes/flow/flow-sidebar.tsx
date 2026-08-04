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
  reached,
  onPick,
}: {
  /** Bước đang XEM — cái được tô. */
  current: FlowStepId;
  /**
   * Bước MÁY đã tới — mốc quyết định bấm được hay không.
   *
   * Tách khỏi `current` vì hai thứ khác nhau: bản đầu lấy `current` làm mốc,
   * nên vừa bấm về bước 1 là bước 2 thành "chưa tới" và không bấm lại được.
   */
  reached: FlowStepId;
  onPick: (id: FlowStepId) => void;
}) {
  const at = stepIndex(current);
  const far = stepIndex(reached);
  const door = stepIndex(ONE_WAY_AFTER);

  return (
    /*
     * Bọc trong MỘT Card để cột trái phủ kín chiều cao.
     *
     * Trước đây tám thẻ rời nhau, hết thẻ thứ tám là 361px nền trơn — đo được
     * ở 1440×900. `CLAUDE.md` dặn mọi thứ nằm trong một Card hoặc một thẻ trông
     * cân bằng với Card.
     */
    <Card className="lg:min-h-0">
      <CardContent className="grid content-start gap-1 overflow-y-auto">
        {FLOW_STEPS.map((step, index) => {
          const done = index < far;
          const here = index === at;
          const locked = far > door && index <= door;
          // Bấm được mọi bước máy ĐÃ TỚI, kể cả đi tới lại sau khi lùi.
          const openable = index <= far && !locked && index !== at;

          return (
            <div
              key={step.id}
              data-state={here ? "here" : done ? "done" : "todo"}
              onClick={() => openable && onPick(step.id)}
              className={
                "flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 data-[state=here]:ring-2 data-[state=here]:ring-primary data-[state=here]:ring-inset data-[state=todo]:opacity-45" +
                (openable ? " cursor-pointer" : "")
              }
            >
              <span className="text-muted-foreground w-3 shrink-0 tabular-nums text-xs">
                {index + 1}
              </span>
              <span className="flex-1 text-sm">{step.label}</span>
              {/* Dấu tích màu NHẤN: nó là tin vui duy nhất trên cột này, và
                  màu xám thì nó chìm nghỉm giữa bảy dòng xám khác. */}
              {done ? <CheckIcon className="text-primary size-4" /> : null}
              {locked ? (
                <LockIcon className="text-muted-foreground size-4" />
              ) : null}
              {here && step.actor === "machine" ? (
                <span className="text-muted-foreground text-xs">máy</span>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
