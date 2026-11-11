"use client";

import { formatUsdc } from "@escrow/shared";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocalAmount, useLocalCurrency } from "@/hooks/use-local-currency";
import { LOCAL_CURRENCIES, LOCAL_CURRENCY_CODES } from "@/lib/currency";
import { cn } from "@/lib/utils";

/** Monto en USDC con la unidad en un tono secundario. */
export function Usdc({
  amount,
  className,
  unitClassName,
  sign,
}: {
  amount: bigint | string;
  className?: string;
  unitClassName?: string;
  sign?: "+" | "−";
}) {
  return (
    <span className={cn("amount whitespace-nowrap", className)}>
      {sign}
      {formatUsdc(amount)} <span className={cn("font-normal text-muted-foreground", unitClassName)}>USDC</span>
    </span>
  );
}

/** "≈ $141.300 CLP": referencia en la moneda del visitante. No se muestra si no hay moneda o tipo de cambio. */
export function LocalAmount({ amount, className }: { amount: bigint | string; className?: string }) {
  const local = useLocalAmount(amount);
  if (!local) return null;
  return <span className={cn("amount text-muted-foreground", className)}>≈ {local}</span>;
}

/** Equivalente local con selector de moneda. Va junto al monto principal de una pantalla. */
export function LocalAmountPicker({ amount, className }: { amount: bigint | string; className?: string }) {
  const { currency, setCurrency } = useLocalCurrency();
  const local = useLocalAmount(amount);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group/picker -mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-white/[0.05] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-expanded:text-foreground",
          className,
        )}
      >
        <span className="amount">{local ? `≈ ${local}` : currency ? "Calculando…" : "Ver en tu moneda"}</span>
        <ChevronDownIcon
          className="size-3.5 transition-transform duration-200 group-aria-expanded/picker:rotate-180"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Moneda de referencia</DropdownMenuLabel>
        <p className="px-2.5 pb-2 text-xs text-subtle">Solo informativa. Siempre se paga en USDC.</p>
        {LOCAL_CURRENCY_CODES.map((code) => (
          <DropdownMenuItem key={code} onSelect={() => setCurrency(code)}>
            <span className="w-9 font-medium text-foreground">{code}</span>
            <span className="flex-1">{LOCAL_CURRENCIES[code].name}</span>
            {currency === code && <CheckIcon className="text-primary" aria-label="Seleccionada" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setCurrency(null)}>
          <span className="flex-1">No mostrar equivalencia</span>
          {currency === null && <CheckIcon className="text-primary" aria-label="Seleccionada" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
