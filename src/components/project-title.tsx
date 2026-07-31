import { useState } from "react";
import { Settings2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Tên dự án — đọc tại chỗ, sửa trong một hộp thoại. Dùng ở CẢ HAI màn có tên dự
 * án trên đầu trang: bàn dựng và màn nạp tệp.
 *
 * Máy chủ nhận tên lúc tạo nhưng màn nạp tệp đặt cứng "Dự án mới", nên danh
 * sách thành mười ô trùng tên và không ô nào nhận ra được. Cửa sửa phải nằm
 * đúng nơi cái tên hiện ra, không phải trong một trang cài đặt nào khác.
 *
 * Hộp thoại chứ không phải ô nhập ngay tại chỗ: đổi tên là việc làm một lần rồi
 * quay lại dựng, không phải vòng lặp sửa-xem-lại như bảng sửa chữ (đặc tả §8 chỉ
 * cấm modal cho vòng lặp đó). Đầu trang cũng vì thế mà không đổi chiều cao khi
 * bấm sửa.
 */
export function ProjectTitle({
  title,
  onRename,
}: {
  title: string;
  /**
   * Bỏ trống thì chỉ HIỆN tên, không có nút sửa.
   *
   * Màn nạp tệp có sẵn ô "Tên dự án" trong khối Dự án, nên một cái nút sửa nữa ở
   * đầu trang là hai đường tới cùng một giá trị — và người dùng phải đoán hai ô đó
   * có phải một hay không. Bàn dựng thì ngược lại: ở đó không có khối nào để đặt
   * ô, nên hộp thoại là đường duy nhất.
   */
  onRename?: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(title);

  const save = () => {
    setOpen(false);
    const clean = draft.trim();
    if (clean !== title) onRename?.(clean);
  };

  if (!onRename) {
    return <CardTitle className="truncate">{title || "Dự án"}</CardTitle>;
  }

  return (
    // MỘT phần tử, không phải hai anh em rời: đầu thẻ là lưới hai cột (tên |
    // hành động), thả thêm một cái nút vào đó là góc hành động bị đẩy xuống hàng.
    <div className="group/title flex min-w-0 items-center gap-1">
      <CardTitle className="truncate">{title || "Dự án"}</CardTitle>
      <Dialog
        open={open}
        onOpenChange={(next: boolean) => {
          // Mở ra là mồi bằng tên ĐANG dùng, không giữ bản nháp của lần trước:
          // mở rồi đóng không lưu rồi mở lại mà thấy chữ cũ là hộp thoại đang
          // nói dối về trạng thái thật.
          if (next) setDraft(title);
          setOpen(next);
        }}
      >
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Đổi tên dự án"
              // Mờ sẵn chứ KHÔNG ẩn hẳn: ẩn thì không ai biết cái tên sửa được,
              // mà đây đúng là thứ người dùng phải biết — mọi dự án sinh ra đều
              // mang chung một cái tên. Rê vào thì rõ hẳn lên.
              className="opacity-50 transition-opacity group-hover/title:opacity-100 focus-visible:opacity-100"
            />
          }
        >
          <Settings2Icon />
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Đổi tên dự án</DialogTitle>
          </DialogHeader>
          <Field className="px-5">
            <FieldLabel htmlFor="project-title">Tên dự án</FieldLabel>
            <Input
              id="project-title"
              // Mở ra là con trỏ vào sẵn và chữ cũ được bôi đen: đổi tên gần như
              // luôn là VIẾT LẠI, không phải sửa một chữ cái giữa dòng.
              //
              // Bôi đen ở `onFocus`, KHÔNG ở `ref`: ô này là ô có kiểm soát nên
              // mỗi ký tự gõ vào là một lần dựng lại, mà `ref` thì chạy theo mỗi
              // lần dựng — chữ vừa gõ lại bị bôi đen và ký tự sau xoá sạch nó.
              // Gõ "Sinh nhật 29" ra đúng một chữ "9".
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
              value={draft}
              placeholder="Dự án mới"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") save();
              }}
            />
          </Field>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary">Huỷ</Button>} />
            <Button onClick={save}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
