import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

/**
 * LỜI ĐĂNG BÀI viết sẵn: ba tiêu đề, một mô tả, mấy thẻ.
 *
 * Dựng xong video mới là nửa việc. Nửa còn lại — nghĩ tiêu đề, viết mô tả, chọn
 * thẻ — là chỗ người không chuyên tắc lâu nhất, và tắc đúng lúc video đã xong
 * nên chẳng còn hứng nữa. Bản chép lời thì đã nằm sẵn trong máy.
 *
 * BA tiêu đề chứ không một: máy không biết kênh này nói với ai, nên việc của nó
 * là bày ra mấy cách vào khác nhau, còn chọn là việc của người.
 *
 * Mỗi mục có nút chép riêng, không gộp một cục: dán tiêu đề và dán mô tả là hai
 * ô khác nhau trên mọi nền tảng, gộp lại thì người dùng phải tự xoá bớt.
 */

type PostCopy = { titles: string[]; description: string; hashtags: string[] };

/** Nút chép, tự đổi chữ trong hai giây để người bấm biết là đã ăn. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [xong, setXong] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setXong(true);
        setTimeout(() => setXong(false), 2_000);
      }}
    >
      {xong ? "Đã chép" : label}
    </Button>
  );
}

export function PostCopyDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [copy, setCopy] = useState<PostCopy | null>(null);
  const [dangViet, setDangViet] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  const viet = async () => {
    setDangViet(true);
    setLoi(null);
    try {
      setCopy(await api.writePostCopy(projectId));
    } catch (error) {
      setLoi((error as Error).message);
    } finally {
      setDangViet(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Lời đăng bài</DialogTitle>
        </DialogHeader>

        {copy ? (
          <div className="grid gap-4">
            <section className="grid gap-2">
              <h3 className="text-muted-foreground text-xs">Tiêu đề — chọn một</h3>
              {copy.titles.map((title) => (
                <div
                  key={title}
                  className="flex items-center gap-2 rounded-md bg-muted px-3 py-2"
                >
                  <span className="min-w-0 flex-1 text-sm">{title}</span>
                  <CopyButton text={title} label="Chép" />
                </div>
              ))}
            </section>

            {copy.description && (
              <section className="grid gap-2">
                <h3 className="text-muted-foreground text-xs">Mô tả</h3>
                <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2">
                  <p className="min-w-0 flex-1 text-sm">{copy.description}</p>
                  <CopyButton text={copy.description} label="Chép" />
                </div>
              </section>
            )}

            {copy.hashtags.length > 0 && (
              <section className="grid gap-2">
                <h3 className="text-muted-foreground text-xs">Thẻ</h3>
                <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2">
                  <p className="min-w-0 flex-1 text-sm">
                    {copy.hashtags.map((tag) => `#${tag}`).join(" ")}
                  </p>
                  <CopyButton
                    text={copy.hashtags.map((tag) => `#${tag}`).join(" ")}
                    label="Chép"
                  />
                </div>
              </section>
            )}
          </div>
        ) : (
          <Empty>
            {dangViet ? (
              <>
                <Spinner />
                <EmptyTitle>Đang đọc lời trong video…</EmptyTitle>
                <EmptyDescription>Mất khoảng nửa phút.</EmptyDescription>
              </>
            ) : (
              <>
                <EmptyTitle>
                  {loi ? "Chưa viết được" : "Viết hộ lời đăng bài"}
                </EmptyTitle>
                <EmptyDescription>
                  {loi ??
                    "Máy đọc lời trong video rồi đề xuất ba tiêu đề, một đoạn mô tả và mấy thẻ. Sửa lại thoải mái trước khi đăng."}
                </EmptyDescription>
                <Button onClick={() => void viet()} className="mt-1">
                  {loi ? "Thử lại" : "Viết cho tôi"}
                </Button>
              </>
            )}
          </Empty>
        )}

        <DialogFooter>
          {copy && (
            <Button variant="ghost" onClick={() => void viet()} disabled={dangViet}>
              Viết lại
            </Button>
          )}
          <DialogClose render={<Button variant="ghost">Đóng</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
