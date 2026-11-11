import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Información opcional plegada (detalles técnicos, explicaciones). El camino principal nunca depende de abrirla.
 * Usa `<details>` nativo: accesible por teclado y lector de pantalla sin JavaScript.
 */
export function Disclosure({
  summary,
  children,
  className,
  defaultOpen,
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details className={cn("group/disclosure", className)} open={defaultOpen}>
      <summary className="flex list-none items-center justify-between gap-3 rounded-md py-1 text-sm text-muted-foreground transition-colors outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <ChevronDownIcon
          className="size-4 shrink-0 transition-transform duration-300 ease-out group-open/disclosure:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="pt-3 pb-1 text-sm">{children}</div>
    </details>
  );
}

/** Fila etiqueta / valor para listas de detalles. */
export function DetailRow({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", className)}>
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}
