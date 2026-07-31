import { useState } from "react";
import { FilmIcon } from "lucide-react";

import { MediaPickerDialog } from "@/components/media-picker-dialog";
import { pickerItemFromApiFile } from "@/components/media-picker-item";
import { Button } from "@/components/ui/button";

import { formatTime } from "./editor-data";
import type { EditorState } from "./use-editor";

/**
 * Chọn tư liệu để chèn — bằng MẶT của tệp, không bằng tên tệp.
 *
 * Trước đây đây là một danh sách thả xuống in tên tệp thô: "1784482898394_
 * 6987864449670588964_…mp4". Tên đó do TikTok / Instagram / máy ảnh đặt, nó
 * không phân biệt được gì mà còn bị cắt cụt trong khung hẹp — người dùng phải
 * chèn thử rồi nhìn dải xem có đúng cảnh mình muốn không, sai thì hoàn tác.
 *
 * Cả bộ khung — hai tab, lưới, cột xem trước — nằm ở `MediaPickerDialog`, dùng
 * chung với màn nạp tệp. Ở đây chỉ còn thứ riêng của bàn dựng: cái vạch đang
 * đứng, và việc "chèn vào đúng chỗ ấy".
 */
export function InsertPicker({
  editor,
  open: openProp,
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
  const [openState, setOpenTrong] = useState(false);
  const uncontrolled = openProp === undefined;
  const open = uncontrolled ? openState : openProp;
  const setOpen = (next: boolean) => {
    if (uncontrolled) setOpenTrong(next);
    else onOpenChange?.(next);
  };

  const library = editor.insertLibrary;

  return (
    <>
      {uncontrolled && (
        <Button
          variant="secondary"
          size="sm"
          disabled={editor.uploadingMedia}
          onClick={() => setOpen(true)}
        >
          <FilmIcon data-icon="inline-start" />
          {editor.uploadingMedia ? "Đang tải lên…" : "Chèn tư liệu"}
        </Button>
      )}

      <MediaPickerDialog
        open={open}
        onOpenChange={setOpen}
        title={`Chèn tư liệu vào ${formatTime(editor.time)}`}
        projectItems={library.map(pickerItemFromApiFile)}
        alreadyIn={library
          .map((file) => file.library_file)
          .filter((file): file is string => !!file)}
        onUse={(fileId) => editor.addInsertAtPlayhead(fileId)}
        useLabel={`Chèn vào ${formatTime(editor.time)}`}
        onTake={(files) => editor.addAssetsFromLibrary(files)}
        takeLabel="Lấy về dự án"
        onUpload={(files) => void editor.addMedia(files)}
        uploading={editor.uploadingMedia}
        // Dự án chưa có tư liệu nào thì mở thẳng vào KHO: tab dự án lúc ấy chỉ có
        // mỗi ô "Lấy tệp", còn thứ người dùng cần thì nằm ở tab bên kia.
        defaultTab={library.length === 0 ? "library" : "project"}
      />
    </>
  );
}
