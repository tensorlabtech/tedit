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
 * CHỐT BẢN CẮT — cửa một chiều, nên hỏi trước một câu.
 *
 * ══ VÌ SAO PHẢI HỎI ══
 *
 * Bấm xong thì `commit-cut` nướng lát cắt vào chính tệp phim rồi CHÉP LỜI LẠI
 * trên tệp mới. Từ đó chỉ còn một trục thời gian — đó là cả điểm của cổng này —
 * nhưng cũng có nghĩa mọi mốc từ cũ không còn tồn tại, và không có đường lùi.
 *
 * Cả luồng này chỉ có ĐÚNG một cửa không quay lại được. Một câu hỏi cho một cửa
 * như thế là cân; hỏi ở mọi nút mới là phiền.
 *
 * ══ VÌ SAO NÓI RÕ SỐ ══
 *
 * Câu hỏi ghi thẳng bỏ bao nhiêu chỗ và mất bao nhiêu giây. "Bạn chắc chưa?" thì
 * không ai trả lời được — người dùng vừa nhìn dải xong, cái họ cần xác nhận là
 * CON SỐ, không phải quyết tâm.
 */
export function FinishCutButton({
  projectId,
  cuts,
  seconds,
  kept,
}: {
  projectId: string;
  cuts: number;
  /** Tổng số giây sẽ bỏ. */
  seconds: number;
  /** Số giây còn lại sau khi cắt — thứ người dùng thật sự quan tâm. */
  kept: number;
}) {
  const [sending, setSending] = useState(false);

  const go = async () => {
    setSending(true);
    try {
      await api.finishCutReview(projectId);
      toast.add({
        title: "Đang chốt bản cắt",
        description: "Máy cắt lại tệp rồi chép lời một lượt nữa — mất vài phút.",
        type: "success",
      });
    } catch {
      // Hỏng thì NÓI. Nuốt lỗi ở đây là người dùng ngồi đợi một việc chưa chạy.
      toast.add({
        title: "Chưa chốt được",
        description: "Máy chủ không nhận. Thử lại sau một chút.",
        type: "error",
      });
    } finally {
      setSending(false);
    }
  };

  const clock = (value: number) =>
    `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, "0")}`;

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button disabled={sending}>
            Chốt bản cắt
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Chốt bản cắt?</AlertDialogTitle>
          <AlertDialogDescription>
            Bỏ {cuts} chỗ · {clock(seconds)}. Video còn {clock(kept)}.
            <br />
            Máy sẽ cắt lại tệp rồi chép lời một lượt nữa. Sau đó{" "}
            <strong>không quay lại sửa chỗ cắt được nữa</strong> — bước sau chỉ
            soát chính tả.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Để tôi xem lại</AlertDialogCancel>
          <AlertDialogAction onClick={() => void go()}>
            Chốt, đi tiếp
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
