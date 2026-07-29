import {
  CheckIcon,
  CropIcon,
  MicOffIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { isLandscape } from "./upload-data";
import type { UploadState } from "./use-upload";

/**
 * Các bước máy chủ đi qua khi chép lời, kèm mốc tiến độ nó báo về.
 *
 * Suy bước đang chạy từ CON SỐ tiến độ chứ không so chuỗi thông báo: đổi một
 * chữ trong câu thông báo ở máy chủ thì danh sách này đứng im, mà không ai
 * biết. Bày cả bốn bước vì một thanh trơn không trả lời được "còn bao lâu" —
 * còn bốn bước thì đọc ra ngay là mới đi được một phần tư hay sắp xong.
 */
const TRANSCRIBE_STEPS = [
  { from: 0, label: "Ghép video chính" },
  { from: 20, label: "Dựng dải ảnh" },
  { from: 30, label: "Tách tiếng" },
  { from: 45, label: "Nghe và chép lời" },
];

/**
 * Cột phải: những gì cần xem lại trước khi chạy, và việc đang chạy.
 *
 * KHÔNG bày số liệu về dự án. Từng có một dòng "2:23 · 9 cảnh nối lại" to đùng ở
 * đây, và nó nói dối hai lần: người đọc tưởng đó là khung xem video đã ghép, còn
 * con số thì chưa cắt gì nên chẳng phải độ dài thành phẩm. Thứ duy nhất đáng
 * đứng đây là thứ ĐỔI ĐƯỢC MỘT QUYẾT ĐỊNH — mà mỗi dòng đều kèm sẵn nút làm
 * được điều đó.
 *
 * Đây cũng là chỗ dành sẵn cho phần chọn phong cách và lời dặn sau này: chúng
 * chèn vào giữa hàng soát và phần trạng thái, không phải dựng lại cả trang.
 */
export function SetupCard({
  upload,
  onOpen,
  onPick,
  className,
}: {
  upload: UploadState;
  /** Mở khung xem một cảnh — câu trả lời cho dòng nhắc "cảnh quay ngang" */
  onOpen: (id: string) => void;
  /** Mở hộp chọn tệp — câu trả lời cho dòng nhắc "không nghe được lời nào" */
  onPick: () => void;
  className?: string;
}) {
  const job = upload.transcribe;
  const cropped = upload.mainFiles.filter(isLandscape);
  const failed = upload.files.filter((item) => item.status === "error");

  const blockReason = upload.uploading
    ? "Đang tải tệp lên"
    : upload.readyMainFiles.length === 0
      ? "Cần ít nhất một cảnh chính tải xong"
      : null;

  const running = job?.status === "running";
  const step = running
    ? TRANSCRIBE_STEPS.reduce(
        (found, item, index) => (job.progress >= item.from ? index : found),
        0,
      )
    : -1;

  const notes =
    cropped.length > 0 ||
    failed.length > 0 ||
    upload.transcriptStale ||
    upload.noSpeechFound;

  /**
   * Câu trạng thái — chỉ khi có việc thật sự đang xảy ra hoặc đang vướng.
   *
   * Từng có một câu mặc định *"Chép lời xong sẽ mở bàn dựng để cắt và thêm chữ"*
   * đứng đây suốt: nó tả một việc sẽ tự xảy ra, không đổi quyết định nào, và nó
   * làm cả cái thẻ tồn tại chỉ để chứa một câu như vậy.
   */
  const status =
    job?.status === "error"
      ? `Chép lời hỏng: ${job.message}`
      : upload.uploading
        ? `Đang tải ${upload.uploadingFiles.length} tệp · ${upload.uploadProgress}%`
        : running
          ? "Xong bước này là mở được bàn dựng"
          : blockReason;

  // Không có gì để nói thì KHÔNG dựng thẻ. Một thẻ trống mang tên "Thiết lập"
  // là một lời hứa suông: người đọc đi tìm cái để chỉnh và không thấy gì.
  if (!notes && !status && !running) return null;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Thiết lập</CardTitle>
      </CardHeader>

      {/* `overflow-hidden`: màn thấp thì phần trên tràn ra ngoài ô của mình và
          đè lên thứ bên dưới — xén trong ô thì cùng lắm mất một dòng nhắc. */}
      <CardContent className="flex min-h-0 flex-col gap-4 overflow-hidden lg:flex-1">
        {/* Mỗi dòng nhắc phải có một CÂU TRẢ LỜI ngay tại chỗ, không phải một
            nút giấu ở đâu đó — bằng không người dùng đọc xong vẫn đứng im. */}
        {notes && (
          <div className="grid gap-2 text-xs">
            {/* Đứng ĐẦU vì nó nặng nhất: mọi thứ dựng sau đó đều dựa vào lời,
                mà ở đây không có lời nào. Câu trả lời tại chỗ là đổi video —
                chép lại cùng một tệp câm thì vẫn ra đúng ngần ấy. */}
            {upload.noSpeechFound && (
              <div className="flex items-start gap-2">
                <MicOffIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                <span className="flex-1 text-destructive">
                  Không nghe được lời nào — video không có tiếng nói
                </span>
                <Button variant="ghost" size="xs" onClick={onPick}>
                  Thêm video
                </Button>
              </div>
            )}
            {/* Đổi mạch sau khi chép lời thì phần mới KHÔNG có lời, mà nút vẫn
                mời mở bàn dựng — sang tới nơi mới thấy một quãng không chữ nào. */}
            {upload.transcriptStale && (
              <div className="flex items-start gap-2">
                <RefreshCwIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-muted-foreground">
                  Mạch đổi sau khi chép lời, lời không còn khớp
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => void upload.startTranscribe()}
                >
                  Chép lại
                </Button>
              </div>
            )}
            {cropped.length > 0 && (
              <div className="flex items-start gap-2">
                <CropIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-muted-foreground">
                  {cropped.length} cảnh quay ngang, sẽ cắt hai bên
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onOpen(cropped[0]!.id)}
                >
                  Xem
                </Button>
              </div>
            )}
            {failed.length > 0 && (
              <div className="flex items-start gap-2">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                <span className="flex-1 text-destructive">
                  {failed.length} tệp tải hỏng
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    failed.forEach((item) => upload.retryUpload(item.id))
                  }
                >
                  Thử lại
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-2">
          {running && (
            <ul className="grid gap-1.5 text-xs">
              {TRANSCRIBE_STEPS.map((item, index) => (
                <li
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2",
                    index > step && "text-muted-foreground",
                  )}
                >
                  {index < step ? (
                    <CheckIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : index === step ? (
                    <Spinner className="size-3.5 shrink-0" />
                  ) : (
                    <span className="size-3.5 shrink-0" />
                  )}
                  {item.label}
                </li>
              ))}
            </ul>
          )}

          {(upload.uploading || running) && (
            <Progress value={running ? job.progress : upload.uploadProgress} />
          )}

          {/* Câu này là chỗ DUY NHẤT nói vì sao nút ở đầu trang chưa bấm được —
              nhãn của nút chỉ nói nó đang làm gì, không nói nó đang chờ gì. */}
          {status && (
            <p
              className={cn(
                "text-xs",
                job?.status === "error"
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {status}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
