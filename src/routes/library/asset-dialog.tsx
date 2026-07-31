import { useEffect, useState } from "react";
import { StarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ApiLibraryAsset } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Hộp xem một tư liệu: hình lớn bên trái, chỗ sửa bên phải.
 *
 * Sửa Ở ĐÂY chứ không sửa trong ô lưới. Ô lưới mà mở ra được thì nó cao thêm hai
 * dòng và đẩy lệch cả hàng bên cạnh — mà tên tệp máy sinh dài bốn chục ký tự nên
 * ô nào cũng dễ rơi vào cảnh ấy. Ở đây còn có chỗ cho video chạy thật, đủ lớn để
 * nhìn ra clip quay gì trước khi viết mô tả.
 */
export function AssetDialog({
  asset,
  open,
  onOpenChange,
  onSave,
  onStar,
}: {
  asset: ApiLibraryAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (file: string, patch: { title: string; description: string }) => void;
  onStar: (file: string, on: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Nạp lại mỗi lần đổi tư liệu: hộp này dùng chung cho mọi ô, nên giữ chữ của ô
  // trước là người dùng mở ô mới ra và thấy mô tả của ô cũ.
  useEffect(() => {
    setTitle(asset?.title ?? "");
    setDescription(asset?.description ?? "");
  }, [asset]);

  if (!asset) return null;
  const src = `/files/assets/${encodeURIComponent(asset.file)}`;
  const doi =
    title.trim() !== asset.title || description.trim() !== asset.description;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate">{asset.title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[3fr_2fr]">
          {/* KHÔNG ép 16:9 ở đây. Ứng dụng này dựng video DỌC, mà tư liệu chèn
              thì đủ hướng — ép một tỉ lệ là hình dọc nằm giữa hai mảng trống bằng
              cả nửa khung, còn hình ngang thì bị viền trên dưới. Cho hình tự quyết
              bề ngang, chỉ chặn chiều cao để hộp không cao quá màn. */}
          <div className="grid max-h-[62vh] min-h-48 place-items-center overflow-hidden rounded-lg bg-muted">
            {asset.kind === "image" ? (
              <img src={src} alt="" className="max-h-[62vh] object-contain" />
            ) : (
              // Tự chạy NGAY, và phải TẮT TIẾNG mới chạy được: trình duyệt chặn
              // autoplay có tiếng nếu trang chưa đủ "tín nhiệm", và cú bấm mở hộp
              // không phải lúc nào cũng tính là cho phép — đo thật: `paused` vẫn
              // đúng bằng `true` sau khi mở.
              //
              // Tắt tiếng ở đây không mất gì: tư liệu chèn đè lên lời người nói
              // nên tiếng của nó gần như luôn bị bỏ. Ai cần nghe thì bật lại ngay
              // trên thanh điều khiển.
              <video
                src={src}
                controls
                autoPlay
                muted
                loop
                playsInline
                className="max-h-[62vh] object-contain"
              />
            )}
          </div>

          <div className="grid content-start gap-3">
            <Field>
              <FieldLabel htmlFor="asset-title">Tên gọi</FieldLabel>
              <Input
                id="asset-title"
                className="min-w-0"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                spellCheck={false}
              />
              <FieldDescription>
                Tên máy sinh ra thì dài và không nói gì — đặt lại một cái tên
                bạn nhận ra khi tìm.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="asset-desc">Hình này vẽ gì</FieldLabel>
              <Textarea
                id="asset-desc"
                className="min-h-28 resize-none"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Ví dụ: bàn tay đang gõ bàn phím cơ trên bàn gỗ"
              />
              {/* Đỏ theo Ô ĐANG GÕ, không theo giá trị đã lưu. Bản trước đọc
                  `asset.description` nên gõ xong chữ vẫn đỏ nguyên — người dùng
                  tưởng mình vừa nhập vào chỗ máy không nhận. Lời cảnh báo phải
                  tắt ngay khi lý do của nó biến mất. */}
              <FieldDescription
                className={cn(!description.trim() && "text-destructive")}
              >
                Máy đọc đúng câu này để biết đặt tư liệu vào đoạn lời nào. Bỏ
                trống thì chặng tự ghép sẽ bỏ qua nó hoàn toàn.
              </FieldDescription>
            </Field>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => onStar(asset.file, !asset.starred)}
          >
            <StarIcon
              data-icon="inline-start"
              className={cn(asset.starred && "fill-current text-primary")}
            />
            {asset.starred ? "Bỏ đánh dấu" : "Đánh dấu"}
          </Button>
          <Button
            disabled={!doi}
            onClick={() => {
              onSave(asset.file, {
                title: title.trim() || asset.title,
                description: description.trim(),
              });
              onOpenChange(false);
            }}
          >
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
