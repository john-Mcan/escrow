import * as React from "react";
import { cn } from "cn";

/** 16 px de letra en todos los campos: con menos, iOS hace zoom al enfocarlos. */
const fieldClasses =
  "w-full min-w-0 rounded-[10px] border border-input bg-[#101214] px-3.5 text-base text-foreground transition-[border-color,box-shadow,background-color] duration-200 outline-none placeholder:text-subtle hover:border-line-strong focus-visible:border-primary/70 focus-visible:bg-[#121416] focus-visible:ring-4 focus-visible:ring-primary/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive/70 aria-invalid:ring-4 aria-invalid:ring-destructive/10";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn("h-11 py-2 [color-scheme:dark]", fieldClasses, className)}
      {...props}
    />
  );
}

export { Input, fieldClasses };
