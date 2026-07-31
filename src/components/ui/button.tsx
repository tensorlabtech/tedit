import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-normal whitespace-nowrap transition-all outline-none select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/80 focus-visible:bg-primary/80",
        // KHÔNG CÒN VIỀN — tên giữ nguyên để 47 nơi gọi khỏi phải sửa, nhưng
        // hiện thực là một mảng nấc 2. Viền chỉ có việc khi hai thứ cùng độ
        // sáng đứng cạnh nhau, mà nút luôn nằm trên mặt thẻ nên nó luôn có nền
        // để dùng.
        //
        // Nút nền nấc 2 KHÔNG lẫn với ô nhập dù cùng màu: nút ôm sát chữ và
        // chữ căn giữa, ô nhập kéo hết bề ngang và chữ căn trái.
        outline:
          "bg-muted hover:bg-accent focus-visible:bg-accent-active aria-expanded:bg-accent-active",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent focus-visible:bg-accent-active aria-expanded:bg-accent-active",
        ghost:
          "hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground aria-expanded:bg-accent-active aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-[min(var(--radius-md),12px)] px-3 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-10",
        "icon-xs":
          "size-7 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  tooltip,
  tooltipSide = "top",
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    // Nhãn tooltip. Mặc định lấy từ aria-label khi nút chỉ có icon;
    // truyền false để tắt (ví dụ khi nơi gọi đã tự bọc Tooltip)
    tooltip?: string | false;
    // Phía hiện chú thích. Mặc định phía trên vì phần lớn nút nằm trên một
    // hàng ngang; hàng nút XẾP DỌC thì phải đổi sang "right"/"left", không thì
    // chú thích của nút này che mất nút ngay trên nó.
    tooltipSide?: "top" | "right" | "bottom" | "left";
  }) {
  const button = (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );

  // Nút chỉ có icon thì luôn phải có tooltip, dựng thẳng từ nhãn trợ năng
  const isIconOnly = typeof size === "string" && size.startsWith("icon");
  const label = typeof tooltip === "string" ? tooltip : props["aria-label"];

  if (tooltip === false || !isIconOnly || !label) {
    return button;
  }

  return (
    <Tooltip>
      {/* Chú thích cũng là TÊN của nút, không chỉ là chữ hiện lúc rê chuột.
          Nút chỉ có icon mà thiếu `aria-label` thì trình đọc màn hình đọc ra một
          cái nút không tên. Nơi gọi truyền `tooltip` là đã nói tên rồi — lấy
          luôn, đừng bắt viết hai lần rồi có ngày hai chỗ lệch nhau. */}
      <TooltipTrigger
        render={button}
        aria-label={props["aria-label"] ?? label}
      />
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
}

export { Button, buttonVariants };
