import * as React from "react";

import { cn } from "@/lib/utils";

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
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-border [--card-spacing:--spacing(5)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(4)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
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
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        // Tiêu đề CHỈ LÀ TÊN — không ghi chú, không phụ đề, không số liệu. Số
        // liệu thuộc về thân thẻ, hoặc huy hiệu ở góc phải nếu thẻ không có thân.
        //
        // Cao ĐÚNG BẰNG MỘT NÚT, dù đầu thẻ có nút hay không.
        //
        // Không có nó thì đầu thẻ cao theo thứ nằm bên phải: thẻ có nút cao 40px,
        // thẻ chỉ có huy hiệu cao 24px, thẻ trống cao 20px — ba thẻ đứng cạnh
        // nhau là ba mốc chữ lệch nhau, mà chúng đang nói những việc ngang hàng.
        // Chặn sàn ở đây thì mốc chữ đứng yên, còn nút thì thêm bớt lúc nào cũng
        // được.
        "flex min-h-10 items-center group-data-[size=sm]/card:min-h-8",
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
        "col-start-2 row-start-1 flex items-center gap-2 self-center justify-self-end",
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
        "flex items-center gap-2 rounded-b-xl border-t p-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardContent };
