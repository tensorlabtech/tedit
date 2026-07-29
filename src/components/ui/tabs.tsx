"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className,
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-10 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
        // Tab TRÔNG NHƯ TIÊU ĐỀ: hai tiêu đề đứng cạnh nhau, cái không mở thì
        // mờ. Dùng khi tab nằm trong `CardHeader` — ở đó một hàng tab kẻ gạch
        // chân đọc ra là hai thứ (một tiêu đề thẻ + một hàng tab) trong khi
        // thực chất chỉ có một: tên của cái đang xem.
        // `min-h-10` khớp `CardTitle`: tab này ĐỨNG THAY tiêu đề thẻ, nên mốc
        // chữ của nó phải trùng mốc chữ của những thẻ bên cạnh.
        title: "h-auto min-h-10 gap-4 rounded-none bg-transparent p-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-0.5 text-sm font-normal whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        // Kiểu tiêu đề: cùng cỡ chữ, cùng nét với `CardTitle` — khác nhau chỉ ở
        // độ mờ, để mắt đọc ra "đang xem cái này, còn kia bấm được".
        "group-data-[variant=title]/tabs-list:h-auto group-data-[variant=title]/tabs-list:flex-none group-data-[variant=title]/tabs-list:rounded-none group-data-[variant=title]/tabs-list:bg-transparent group-data-[variant=title]/tabs-list:px-0 group-data-[variant=title]/tabs-list:py-0 group-data-[variant=title]/tabs-list:font-heading group-data-[variant=title]/tabs-list:text-base group-data-[variant=title]/tabs-list:leading-snug group-data-[variant=title]/tabs-list:font-medium group-data-[variant=title]/tabs-list:text-muted-foreground/60 group-data-[variant=title]/tabs-list:data-active:bg-transparent group-data-[variant=title]/tabs-list:data-active:text-foreground dark:group-data-[variant=title]/tabs-list:data-active:border-transparent dark:group-data-[variant=title]/tabs-list:data-active:bg-transparent",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
