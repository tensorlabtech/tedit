import { useEffect, useRef, useState } from "react";
import { FilmIcon, PlusIcon, UploadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { formatTime } from "./editor-data";
import { InsertPreview } from "./insert-picker-preview";
import { InsertTile } from "./insert-picker-tile";
import type { EditorState } from "./use-editor";

/**
 * Chọn tư liệu để chèn — bằng MẶT của tệp, không bằng tên tệp.
 *
 * Trước đây đây là một danh sách thả xuống in tên tệp thô: "1784482898394_
 * 6987864449670588964_…mp4". Tên đó do TikTok / Instagram / máy ảnh đặt, nó
 * không phân biệt được gì mà còn bị cắt cụt trong khung hẹp — người dùng phải
 * chèn thử rồi nhìn dải xem có đúng cảnh mình muốn không, sai thì hoàn tác.
 *
 * Cảnh thì phải NHÌN mới biết. Lưới ảnh trả lời ngay câu hỏi duy nhất người ta
 * đang hỏi: "cái nào là cảnh tôi cần". Chọn một cái thì xem to ở cột bên.
 *
 * Hai cột chứ không phải trên–dưới: tư liệu ở đây là video DỌC, xếp khung xem
 * trước xuống dưới lưới thì nó ăn hết chiều cao bảng còn bảng thì dài quá màn.
 * Đặt sang bên là dùng chiều ngang — thứ đang thừa.
 */
export function InsertPicker({
  editor,
  open: openNgoai,
  onOpenChange,
}: {
  editor: EditorState;
  /**
   * Điều khiển từ NGOÀI — bảng `+` trên vạch chạy mở nó bằng một mục danh sách,
   * mà mục danh sách thì không làm nút mở hộp thoại được (bảng đóng lại trước
   * khi hộp kịp mở). Bỏ trống thì hộp tự giữ trạng thái và tự vẽ nút bấm.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openTrong, setOpenTrong] = useState(false);
  const tuGiu = openNgoai === undefined;
  const open = tuGiu ? openTrong : openNgoai;
  const setOpen = (next: boolean) => {
    if (tuGiu) setOpenTrong(next);
    else onOpenChange?.(next);
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const library = editor.insertLibrary;
  const selected = library.find((file) => file.id === selectedId);

  // Tệp vừa tải lên thì chọn sẵn — người ta lấy tệp từ máy là để chèn NÓ, không
  // phải để nhìn nó nằm trong lưới.
  const before = useRef(library.length);
  useEffect(() => {
    if (library.length > before.current) {
      setSelectedId(library[library.length - 1]?.id ?? null);
    }
    before.current = library.length;
  }, [library]);

  const insertAt = async (fileId: string) => {
    setOpen(false);
    await editor.addInsertAtPlayhead(fileId);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {tuGiu && (
        <DialogTrigger
          render={
            <Button
              variant="secondary"
              size="sm"
              disabled={editor.uploadingMedia}
            >
              <FilmIcon data-icon="inline-start" />
              {editor.uploadingMedia ? "Đang tải lên…" : "Chèn tư liệu"}
            </Button>
          }
        />
      )}
      <DialogContent
        className="sm:max-w-3xl"
        // Thả tệp thẳng vào bảng. Bắt ở đây chứ không chỉ ở nút: người kéo tệp
        // từ Finder sang thì cả bảng là đích họ nhắm tới, không phải một nút nhỏ.
        onDragEnter={(event) => {
          event.preventDefault();
          depth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          depth.current = 0;
          setDragging(false);
          const files = Array.from(event.dataTransfer?.files ?? []);
          if (files.length > 0) void editor.addMedia(files);
        }}
      >
        <DialogHeader>
          <DialogTitle>Chèn tư liệu vào {formatTime(editor.time)}</DialogTitle>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept="video/*,image/*"
          hidden
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            if (picked.length > 0) void editor.addMedia(picked);
            event.target.value = "";
          }}
        />

        {library.length === 0 && !editor.uploadingMedia ? (
          <Empty>
            <EmptyTitle>Chưa có tư liệu nào</EmptyTitle>
            <EmptyDescription>
              Ảnh và video không có tiếng, để đè lên lời nói ở đoạn bạn chọn
            </EmptyDescription>
            <Button onClick={() => inputRef.current?.click()}>
              <PlusIcon data-icon="inline-start" />
              Lấy tệp từ máy…
            </Button>
          </Empty>
        ) : (
          // Cột phải rộng cố định: khung xem trước là 9:16, cho nó co theo bảng
          // thì mỗi lần đổi bề rộng cửa sổ là chiều cao cả bảng nhảy theo.
          <div className="grid gap-4 sm:grid-cols-[1fr_13rem]">
            {/* Không `scroll-fade-b` ở đây: nó che mờ 1.5rem cuối vùng cuộn —
                đúng chỗ đó là hàng ảnh dưới cùng, nên trông như ảnh bị lẹm mất
                một dải. Che mờ chỉ hợp khi mép cắt ngang thân CHỮ. */}
            <ScrollArea className="max-h-[27rem]">
              <div className="grid grid-cols-3 gap-2 pr-3 sm:grid-cols-4">
                {library.map((file) => (
                  <InsertTile
                    key={file.id}
                    file={file}
                    active={file.id === selectedId}
                    onSelect={() => setSelectedId(file.id)}
                    onInsertNow={() => void insertAt(file.id)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className={cn(
                    "flex aspect-[9/16] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground",
                    "hover:border-primary/50 hover:bg-accent/50",
                    dragging && "border-primary bg-primary/10 text-foreground",
                  )}
                >
                  {editor.uploadingMedia ? (
                    <Spinner />
                  ) : (
                    <UploadIcon className="size-4" />
                  )}
                  {editor.uploadingMedia ? "Đang tải…" : "Lấy tệp"}
                </button>
              </div>
            </ScrollArea>

            {selected ? (
              <InsertPreview file={selected} />
            ) : (
              // Chỗ này để trống chứ không xoá đi: xoá thì lưới giãn ra chiếm
              // cả cột phải, chọn một tệp lại co lại — cả bảng nhảy một cái.
              <div className="grid aspect-[9/16] place-items-center rounded-lg bg-muted/50 p-3 text-center text-xs text-muted-foreground">
                Bấm một tệp để xem trước
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            disabled={!selected}
            onClick={() => selected && void insertAt(selected.id)}
          >
            Chèn vào {formatTime(editor.time)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
