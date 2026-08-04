import { useState } from "react";
import { ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api";

/**
 * CHỐT CHÍNH TẢ — cổng thứ hai, KHÔNG hỏi lại.
 *
 * Khác `FinishCutButton`: chốt cắt là cửa một chiều (chép lời lại, mất bản cũ),
 * nên nó hỏi một câu. Chốt chính tả chỉ mở cho máy dựng nốt phần làm đẹp — đặt
 * chữ, tư liệu, hiệu ứng, nhạc — và mọi chặng ấy chạy lại được. Một câu hỏi cho
 * một việc quay lại được là phiền vô cớ.
 *
 * Không chặn khi còn chữ ngờ: chấm dưới là GỢI Ý, không phải lỗi phải sửa hết.
 * Người dùng đọc thấy ổn thì cứ đi tiếp.
 */
export function FinishTextButton({ projectId }: { projectId: string }) {
  const [sending, setSending] = useState(false);

  const go = async () => {
    setSending(true);
    try {
      await api.finishTextReview(projectId);
      toast.add({
        title: "Đang dựng nốt",
        description: "Máy đặt chữ, tư liệu, hiệu ứng và nhạc — mất vài phút.",
        type: "success",
      });
    } catch {
      toast.add({
        title: "Chưa chốt được",
        description: "Máy chủ không nhận. Thử lại sau một chút.",
        type: "error",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Button disabled={sending} onClick={() => void go()}>
      Chốt chính tả
      <ArrowRightIcon data-icon="inline-end" />
    </Button>
  );
}
