import Link from "next/link";
import { cn } from "@/lib/utils";

/** Marca: tres tramos de una barra de hitos, el primero ya liberado. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 12" aria-hidden="true" className={cn("h-3 w-7", className)}>
      <rect x="0" y="2" width="8" height="8" rx="2" className="fill-seal" />
      <rect x="10" y="2" width="8" height="8" rx="2" className="fill-vault" />
      <rect x="20" y="2" width="8" height="8" rx="2" className="fill-none stroke-vault" strokeWidth="1.5" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50", className)}>
      <BrandMark />
      <span className="font-heading text-xl font-extrabold tracking-tight">hito</span>
    </Link>
  );
}
