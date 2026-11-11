import Link from "next/link";
import { cn } from "@/lib/utils";

/** Trazos del isotipo (viewBox 40×32): dos corchetes que retienen un valor. Compartidos con el loader. */
export const MARK_LEFT_BRACKET = "M10.4 5.4H8.6A2.5 2.5 0 0 0 6.1 7.9V24.1A2.5 2.5 0 0 0 8.6 26.6H10.4";
export const MARK_RIGHT_BRACKET = "M29.6 5.4H31.4A2.5 2.5 0 0 1 33.9 7.9V24.1A2.5 2.5 0 0 1 31.4 26.6H29.6";
export const MARK_CORE = { x: 15.8, y: 11.8, size: 8.4, radius: 2.1 };

/**
 * Isotipo: el dinero (cuadro esmeralda) entre corchetes, es decir, retenido en garantía.
 * `tone="light"` es la versión para fondos claros (emails y documentos).
 */
export function BrandMark({ className, tone = "dark", title }: { className?: string; tone?: "dark" | "light"; title?: string }) {
  const bracket = tone === "dark" ? "#f4f5f4" : "#08090b";
  const core = tone === "dark" ? "#7de7bb" : "#1fa774";
  return (
    <svg
      viewBox="0 0 40 32"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cn("h-6 w-[1.875rem]", className)}
    >
      {title && <title>{title}</title>}
      <path d={MARK_LEFT_BRACKET} fill="none" stroke={bracket} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d={MARK_RIGHT_BRACKET} fill="none" stroke={bracket} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x={MARK_CORE.x} y={MARK_CORE.y} width={MARK_CORE.size} height={MARK_CORE.size} rx={MARK_CORE.radius} fill={core} />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="extan, ir al inicio"
      className={cn(
        "group/brand inline-flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background",
        className,
      )}
    >
      <BrandMark className="transition-transform duration-300 ease-out group-hover/brand:scale-[1.06]" />
      <span className="text-[1.3rem] leading-none font-semibold tracking-[-0.04em]">extan</span>
    </Link>
  );
}
