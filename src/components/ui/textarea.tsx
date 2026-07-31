import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-lg bg-input px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground hover:bg-accent focus:bg-accent-active focus-visible:bg-accent-active disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-60 aria-invalid:bg-destructive/15 aria-invalid:text-destructive md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
