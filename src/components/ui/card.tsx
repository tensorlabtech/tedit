import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Khoảng cách giữa các tầng của thẻ (`--card-gap`) TÁCH khỏi đệm trong
 * (`--card-spacing`).
 *
 * Trước đây cả hai dùng chung một biến `--spacing(5)` = 20px, nên đầu thẻ cách thân
 * thẻ đúng bằng đệm lề — đọc ra như một khoảng hở, nhất là ở thẻ chỉ có một dòng
 * tiêu đề. Đệm lề vẫn cần 20px để chữ không dính mép; khoảng cách giữa tiêu đề và
 * thân thì 8px là đủ để mắt tách hai tầng.
 */
/**
 * MÉP THẺ KHÔNG CÓ VIỀN.
 *
 * Mặt thẻ và nền trang cách nhau 8% độ sáng, mà viền chỉ có việc khi hai thứ
 * CÙNG độ sáng đứng cạnh nhau — nên ở đây nó không còn gì để làm.
 *
 * Viền quanh thẻ từng là thứ gánh việc tách khối, vì nền trang và mặt thẻ trước
 * đây chỉ chênh 2,5%: cả màn đọc ra một mảng trắng liền và không ai thấy đây là
 * lưới bento nhiều khối.
 */
function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-gap) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground [--card-gap:--spacing(4)] [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-center gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-(--card-spacing)",
        "not-last:border-b not-last:border-border not-last:pb-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-sm leading-snug font-medium",
        // Tiêu đề CHỈ LÀ TÊN — không ghi chú, không phụ đề, không số liệu. Số
        // liệu thuộc về thân thẻ, hoặc huy hiệu ở góc phải nếu thẻ không có thân.
        //
        // Cao bằng ĐÚNG MỘT DÒNG CHỮ, dù đầu thẻ có nút hay không.
        //
        // Đầu thẻ mà cao theo thứ nằm bên phải thì ba thẻ cạnh nhau — một có
        // nút, một có huy hiệu, một trống — là ba mốc chữ lệch nhau, trong khi
        // chúng đang nói những việc ngang hàng.
        //
        // Cách cũ chặn sàn ở 40px, tức chiều cao một cái nút. Mốc chữ đứng yên
        // thật, nhưng một dòng chữ cao 19px phải chiếm chỗ của 40px, nhân với
        // hàng chục thẻ trong lưới bento.
        //
        // Nay đảo lại: thay vì NÂNG SÀN của chữ lên bằng cái nút, thì HẠ TRẦN
        // của nút xuống dưới dòng chữ — xem lề âm ở `CardAction`.
        "flex items-center",
        className,
      )}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        // Góc này thường chứa nhiều thứ cùng lúc (ghi chú + huy hiệu + nút).
        // Không có flex thì chúng xếp theo dòng chữ và dính sát nhau.
        //
        // `self-center` chứ không `self-start`: tiêu đề đã cao bằng một nút, nên
        // thứ thấp hơn (huy hiệu, nút nhỏ) phải căn giữa theo nó — ghim lên đỉnh
        // là nó treo lơ lửng cao hơn dòng chữ.
        // Lề âm cho nút tràn vào đệm thẻ, nên nó KHÔNG đẩy đầu thẻ cao lên.
        // Đệm thẻ 16px thừa sức chứa 8px tràn mỗi bên.
        //
        // Ràng buộc kèm theo: nút trong đầu thẻ cao TỐI ĐA 32px. Lớn hơn thì
        // phần vượt lại đẩy đầu thẻ, và mốc chữ lệch đúng như trước.
        "col-start-2 row-start-1 -my-2 flex items-center gap-2 self-center justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        // `gap-2` cho khớp `ItemActions` — thiếu nó thì footer có hai thứ trở lên
        // là chúng dính sát nhau, và mọi nơi gọi phải tự thêm `gap` lấy lệ.
        //
        // `flex-wrap`: bốn cái nút không vừa một hàng ở cột hẹp thì phải xuống
        // dòng, chứ không phải bị cắt cụt ở mép thẻ — nút bị xén mất nửa chữ đọc
        // ra như lỗi vẽ, mà thứ mất đi lại đúng là hành động huỷ hoại nhất.
        "flex flex-wrap items-center gap-2 rounded-b-xl border-t p-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardContent };
