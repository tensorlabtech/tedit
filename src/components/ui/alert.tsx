import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg px-4 py-3 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-muted text-card-foreground",
        destructive:
          "bg-destructive/12 text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
        /**
         * Hai biến thể CÓ MÀU — nền nhạt, viền và icon cùng sắc.
         *
         * `default` là thẻ trắng viền xám: nó trông y như một Card, nên một câu quan
         * trọng đặt trong đó vẫn đọc ra như phần chú thích ở chân trang. Có màu thì
         * mắt bắt được ngay đây là lời nhắn, không phải một khối nội dung nữa.
         *
         * Không thêm màu vào `default`: nhiều chỗ đang dùng nó đúng như một khối
         * trung tính, đổi nền ở đó là nhuộm cả những nơi không xin.
         */
        info: "bg-primary/14 text-foreground *:data-[slot=alert-description]:text-foreground/75 *:[svg]:text-primary",
        success:
          "bg-success/14 text-foreground *:data-[slot=alert-description]:text-foreground/75 *:[svg]:text-success",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className,
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
