import {
  ArrowLeftIcon,
  ClapperboardIcon,
  CogIcon,
  ImagesIcon,
  type LucideIcon,
  PencilLineIcon,
  ScissorsIcon,
  SpellCheckIcon,
  VideoIcon,
  Wand2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

import {
  FLOW_STEPS,
  stepIndex,
  type FlowStepId,
} from "../../../server/flow-steps";

/**
 * SIDEBAR TÁM BƯỚC — bản đồ "đang ở đâu", không phải danh sách nút.
 *
 * ══ VÌ SAO ĐỔI TỪ DÒNG SANG Ô DỌC CÓ BIỂU TƯỢNG ══
 *
 * Bản trước là tám dòng chữ trải ngang, trông y như một danh sách bấm-được. Nhưng
 * bảy trong tám bước KHÔNG phải để bấm — chúng chỉ nói "còn mấy chặng nữa". Dòng
 * chữ mời bấm ở nơi phần lớn không bấm là mời hụt.
 *
 * Nay mỗi bước là một ô nhỏ: BIỂU TƯỢNG ở trên, SỐ THỨ TỰ + TÊN căn giữa ở dưới.
 * Biểu tượng đọc nhanh hơn chữ, và cả cụm trông như một cột mốc trên bản đồ —
 * người dùng liếc là biết mình đang ở đâu, không tưởng phải bấm.
 *
 * ══ CÁC TRẠNG THÁI — KHÔNG VIỀN, PHÂN CẤP BẰNG NỀN + ĐỘ ĐẬM ══
 *
 * Không ô nào có viền: chúng nằm trên mặt Card, và viền chỉ có việc khi hai mảng
 * cùng độ sáng đứng cạnh nhau. Ba tầng đọc bằng nền và độ đậm chữ:
 *
 * - Đang đứng (`here`): NỀN nhấn + chữ và biểu tượng màu nhấn. Đây là thứ DUY
 *   NHẤT cần nổi — "làm gì đó để biết đang ở đâu".
 * - Đã qua: chữ và biểu tượng XÁM (`muted-foreground`) — đọc ra "bản đồ".
 * - Chưa tới: xám và mờ thêm (`opacity-45`).
 *
 * KHÔNG bấm được: luồng MỘT CHIỀU, tiến bằng nút ở cột phải, không quay lại bước
 * cũ. Sidebar chỉ nói "đang ở đâu" — cho bấm quanh là loạn, đúng thứ vừa bỏ đi.
 * Không dấu tích, không ổ khoá: vị trí đã kể hết — trước chỗ đứng là xong, sau là
 * chưa tới.
 *
 * Máy đang chạy bước này thì biểu tượng THAY bằng con quay.
 *
 * ══ NÚT VỀ TRANG CHỦ ══
 *
 * Nằm DƯỚI CÙNG, tách khỏi mạch bước. Header cũ mang lối ra này, mà header đã bỏ
 * đi — lối về phải có chỗ đứng cố định, và chân cột là chỗ mắt tìm "thoát ra".
 */

/** Biểu tượng cho từng bước — để ở client, không nhét vào `flow-steps` (dùng chung với server). */
const STEP_ICONS: Record<FlowStepId, LucideIcon> = {
  "main-footage": VideoIcon,
  "b-roll": ImagesIcon,
  brief: PencilLineIcon,
  preparing: CogIcon,
  cut: ScissorsIcon,
  proofread: SpellCheckIcon,
  building: Wand2Icon,
  studio: ClapperboardIcon,
};

export function FlowSidebar({
  current,
  onHome,
}: {
  /** Bước đang đứng — cái được tô. Bước trước nó là đã qua, sau là chưa tới. */
  current: FlowStepId;
  onHome: () => void;
}) {
  const at = stepIndex(current);

  return (
    <Card className="lg:min-h-0">
      {/* `flex-1` cho CardContent cao HẾT Card — thiếu nó thì thân thẻ chỉ cao
          bằng nội dung, `flex-1` bên trong không có chỗ giãn, và nút Trang chủ
          dính ngay dưới bước cuối thay vì tụt xuống đáy cột. */}
      <CardContent className="flex min-h-0 flex-1 flex-col gap-1 px-2">
        {/* Mạch bước — cuộn riêng phần này để nút Trang chủ luôn ở đáy. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {FLOW_STEPS.map((step, index) => {
            const here = index === at;
            // Luồng MỘT CHIỀU: trước bước đang đứng là đã qua (đậm), sau là chưa
            // tới (mờ). Không bấm được — bản đồ, không phải nút.
            const done = index < at && !here;
            const Icon = STEP_ICONS[step.id];
            // Máy đang chạy chính bước này thì biểu tượng QUAY.
            const running = here && step.actor === "machine";

            return (
              <div
                key={step.id}
                data-state={here ? "here" : done ? "done" : "todo"}
                className="flex flex-col items-center gap-2 rounded-lg px-1.5 py-3 text-center data-[state=here]:bg-primary/10 data-[state=todo]:opacity-45"
              >
                {running ? (
                  <Spinner className="text-primary size-6" />
                ) : (
                  <Icon
                    className={
                      "size-6 " +
                      (here ? "text-primary" : "text-muted-foreground")
                    }
                  />
                )}

                <span
                  className={
                    "text-[11px] leading-tight " +
                    (here
                      ? "text-primary font-medium"
                      : "text-muted-foreground")
                  }
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Lối ra — luôn ở đáy cột, tách khỏi mạch bước bằng cả khoảng trống.
            Mũi tên "quay lại" chứ không phải nhà: đây là rời luồng dựng để trở
            về, hành động lùi ra chứ không phải một điểm đến ngang hàng. */}
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-center gap-1.5"
          onClick={onHome}
        >
          <ArrowLeftIcon className="size-4" />
          Về trang chủ
        </Button>
      </CardContent>
    </Card>
  );
}
