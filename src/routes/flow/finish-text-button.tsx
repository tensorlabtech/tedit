import { useState } from "react";
import { ArrowRightIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api";

/**
 * CHỐT CHÍNH TẢ — cổng thứ hai.
 *
 * Khác `FinishCutButton`: chốt cắt là cửa một chiều (chép lời lại, mất bản cũ),
 * nên nó hỏi một câu. Chốt chính tả chỉ mở cho máy dựng nốt phần làm đẹp, mà
 * mọi chặng ấy chạy lại được — nên KHÔNG hỏi khi đã soát sạch.
 *
 * CHỈ nhắc khi CÒN CHỖ NGỜ chưa xem: chấm dưới là gợi ý, không phải lỗi phải sửa
 * hết, nhưng bỏ qua cả loạt mà không hay là chuyện nên chặn lại một nhịp. Sạch
 * rồi thì một nút thẳng, không phiền.
 */
export function FinishTextButton({
  projectId,
  /** Số chỗ máy còn chưa chắc — >0 thì hỏi một câu trước khi chốt. */
  unsureCount,
}: {
  projectId: string;
  unsureCount: number;
}) {
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

  const label = (
    <>
      Chốt chính tả
      <ArrowRightIcon data-icon="inline-end" />
    </>
  );

  // Sạch rồi — đi thẳng.
  if (unsureCount === 0) {
    return (
      <Button disabled={sending} onClick={() => void go()}>
        {label}
      </Button>
    );
  }

  // Còn chỗ ngờ — hỏi một câu.
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button disabled={sending}>{label}</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Còn {unsureCount} chỗ chưa xem</AlertDialogTitle>
          <AlertDialogDescription>
            Máy còn chưa chắc {unsureCount} chữ. Chốt luôn cũng được — những chữ
            này vẫn dùng như máy nghe, sửa sau ở bàn dựng vẫn kịp.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Để tôi soát nốt</AlertDialogCancel>
          <AlertDialogAction onClick={() => void go()}>
            Chốt luôn
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
