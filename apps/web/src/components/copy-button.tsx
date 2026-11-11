"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label = "Copiar",
  copiedLabel = "Copiado",
  className,
  variant = "outline",
  size,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(copied && "border-primary/40 text-primary", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          toast.error("No pudimos copiar. Selecciona el texto y cópialo a mano.");
        }
      }}
    >
      <span className="relative size-4" aria-hidden="true">
        <CopyIcon className={cn("absolute inset-0 transition-all duration-200", copied ? "scale-50 opacity-0" : "scale-100 opacity-100")} />
        <CheckIcon className={cn("absolute inset-0 transition-all duration-200", copied ? "scale-100 opacity-100" : "scale-50 opacity-0")} />
      </span>
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </Button>
  );
}
