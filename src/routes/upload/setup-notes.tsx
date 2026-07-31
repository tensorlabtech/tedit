import {
  CropIcon,
  MicOffIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { isLandscape } from "./upload-data";
import type { UploadState } from "./use-upload";

/**
 * Một dòng soát: icon, câu nói ra vấn đề, và NÚT GIẢI QUYẾT nó ngay tại chỗ.
 *
 * Ba phần đều bắt buộc. Một dòng nhắc không có nút thì người dùng đọc xong vẫn
 * đứng im, còn nút thì không được giấu ở chỗ khác — lúc ấy câu nhắc thành một
 * lời trỏ tới thứ không có mặt.
 */
function SetupNote({
  icon,
  tone = "muted",
  action,
  onAction,
  children,
}: {
  icon: ReactNode;
  /** `bad` cho việc đã hỏng thật, `muted` cho việc chỉ cần biết */
  tone?: "bad" | "muted";
  action: string;
  onAction: () => void;
  children: ReactNode;
}) {
  const color = tone === "bad" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 shrink-0 ${color}`}>{icon}</span>
      <span className={`flex-1 ${color}`}>{children}</span>
      <Button variant="ghost" size="xs" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}

/**
 * Có gì phải soát không — thẻ Thiết lập hỏi câu này để biết mình có lý do tồn
 * tại. Để chính tệp này trả lời, chứ không suy từ bên ngoài: thêm một dòng soát
 * mà quên sửa điều kiện của thẻ thì dòng đó không bao giờ hiện.
 */
export function hasSetupNotes(upload: UploadState) {
  return (
    upload.mainFiles.some(isLandscape) ||
    upload.files.some((item) => item.status === "error") ||
    upload.transcriptStale ||
    upload.briefStale ||
    upload.noSpeechFound
  );
}

/**
 * Những gì cần xem lại trước khi chạy — xếp theo mức NẶNG, nặng nhất lên đầu.
 *
 * Trả `null` khi không có gì để soát, để thẻ Thiết lập không phải tự đoán.
 */
export function SetupNotes({
  upload,
  onOpen,
  onPick,
}: {
  upload: UploadState;
  /** Mở khung xem một cảnh — câu trả lời cho dòng "cảnh quay ngang" */
  onOpen: (id: string) => void;
  /** Mở hộp chọn tệp — câu trả lời cho dòng "không nghe được lời nào" */
  onPick: () => void;
}) {
  const cropped = upload.mainFiles.filter(isLandscape);
  const failed = upload.files.filter((item) => item.status === "error");
  if (!hasSetupNotes(upload)) return null;

  return (
    <div className="grid gap-2 text-xs">
      {/* Đứng ĐẦU vì nó nặng nhất: mọi thứ dựng sau đó đều dựa vào lời, mà ở đây
          không có lời nào. Câu trả lời tại chỗ là đổi video — chép lại cùng một
          tệp câm thì vẫn ra đúng ngần ấy. */}
      {upload.noSpeechFound && (
        <SetupNote
          icon={<MicOffIcon className="size-3.5" />}
          tone="bad"
          action="Thêm video"
          onAction={onPick}
        >
          Không nghe được lời nào — video không có tiếng nói
        </SetupNote>
      )}
      {/* Đổi mạch sau khi chép lời thì phần mới KHÔNG có lời, mà nút vẫn mời mở
          bàn dựng — sang tới nơi mới thấy một quãng không chữ nào. */}
      {upload.transcriptStale && (
        <SetupNote
          icon={<RefreshCwIcon className="size-3.5" />}
          action="Chép lại"
          onAction={() => void upload.startTranscribe()}
        >
          Mạch đổi sau khi chép lời, lời không còn khớp
        </SetupNote>
      )}
      {/* Sửa lời dặn xong thì bản chép cũ vẫn còn nguyên chỗ nghe sai. Không nói
          ra thì người ta gõ đúng tên công ty vào rồi mở bàn dựng và thấy y nguyên
          cái tên viết sai — công gõ thành công cốc.

          Nhường chỗ khi mạch cũng đổi: hai dòng dùng chung một nút chỉ bắt người
          đọc phải chọn giữa hai thứ giống nhau. */}
      {upload.briefStale && !upload.transcriptStale && (
        <SetupNote
          icon={<RefreshCwIcon className="size-3.5" />}
          action="Chép lại"
          onAction={() => void upload.startTranscribe()}
        >
          Lời dặn vừa sửa, bản chép cũ chưa biết
        </SetupNote>
      )}
      {cropped.length > 0 && (
        <SetupNote
          icon={<CropIcon className="size-3.5" />}
          action="Xem"
          onAction={() => onOpen(cropped[0]!.id)}
        >
          {cropped.length} cảnh quay ngang, sẽ cắt hai bên
        </SetupNote>
      )}
      {failed.length > 0 && (
        <SetupNote
          icon={<TriangleAlertIcon className="size-3.5" />}
          tone="bad"
          action="Thử lại"
          onAction={() => failed.forEach((item) => upload.retryUpload(item.id))}
        >
          {failed.length} tệp tải hỏng
        </SetupNote>
      )}
    </div>
  );
}
