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
import { api, type ApiSegment } from "@/lib/api";

/** Suy ba con số hiển thị (số chỗ bỏ, giây bỏ, giây còn) từ một tập đoạn thô. */
function summariseCut(rows: ApiSegment[]) {
  const cuts = rows.filter((row) => row.removed === 1);
  const seconds = cuts.reduce(
    (sum, row) => sum + (row.end_sec - row.start_sec),
    0,
  );
  const total = rows.at(-1)?.end_sec ?? 0;
  return { cuts: cuts.length, seconds, kept: Math.max(0, total - seconds) };
}

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
 *
 * ══ SỐ HIỂN THỊ PHẢI TƯƠI, KHÔNG PHẢI SỐ VỌNG TỪ POLL ══
 *
 * `cuts`/`seconds`/`kept` truyền vào từ `flow-page` đọc qua vòng poll `getProject`
 * mỗi 1,5 giây — mở hộp thoại này NGAY SAU một cú sửa trên dải thì số cũ còn kịp
 * hiện ra, lệch với cái người dùng vừa thấy trên dải. Máy chủ vẫn nướng đúng bản
 * MỚI NHẤT lúc bấm "Chốt" (không đọc lại số này), nên đây chỉ là lệch hiển thị —
 * nhưng lệch ở đúng cửa không-quay-lại thì vẫn phải sửa. Mở hộp thoại là lấy lại
 * `listSegments` — trạng thái THẬT trên máy chủ — thay vì tin vào prop có thể cũ.
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
  // `null` = chưa lấy lại số tươi (đang mở, đang tải, hoặc lần tải trước hỏng);
  // lúc đó vẫn bày tạm số từ prop để hộp thoại không trống trong lúc chờ.
  const [live, setLive] = useState<ReturnType<typeof summariseCut> | null>(
    null,
  );

  const refreshLive = async () => {
    try {
      setLive(summariseCut(await api.listSegments(projectId)));
    } catch {
      // Tải lại hỏng thì thôi, cứ bày tạm số cũ từ prop — không chặn việc xem
      // hộp thoại, chỉ là số có thể hơi cũ.
      setLive(null);
    }
  };

  const shown = live ?? { cuts, seconds, kept };

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
    <AlertDialog
      onOpenChange={(open) => {
        if (open) void refreshLive();
      }}
    >
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
            Bỏ {shown.cuts} chỗ · {clock(shown.seconds)}. Video còn{" "}
            {clock(shown.kept)}.
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
