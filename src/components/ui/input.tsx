import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      /**
       * Ô NHẬP LÀ MỘT MẢNG, KHÔNG PHẢI MỘT CÁI KHUNG.
       *
       * Nền nấc 2 thay cho viền, và ĐANG GÕ = LÊN NẤC chứ không mọc thêm vòng
       * sáng: vòng sáng lúc focus là cùng một thứ với viền, chỉ dày hơn và có
       * màu — nó vẽ lại đúng cái khung vừa bỏ đi.
       *
       * Nấc 4 cao hơn hover (nấc 3) một nấc nên "đang trỏ vào" và "đang gõ" vẫn
       * tách được nhau.
       *
       * Vòng sáng vẫn giữ ở `focus-visible` cho người đi bằng bàn phím: bấm
       * chuột thì không thấy, Tab tới mới hiện. Không có nó thì Tab qua các ô là
       * đi trong bóng tối.
       *
       * Báo lỗi cũng chuyển sang nền: nền pha sắc destructive + chữ cùng sắc,
       * cùng cách với lời nhắn.
       */
      className={cn(
        "h-10 w-full min-w-0 rounded-lg bg-input px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-normal file:text-foreground placeholder:text-muted-foreground hover:bg-accent focus:bg-accent-active focus-visible:bg-accent-active focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-60 aria-invalid:bg-destructive/15 aria-invalid:text-destructive md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
