"use client";

import { computeSplit, formatUsdc } from "@escrow/shared";
import { ArrowDownIcon, ArrowRightIcon } from "lucide-react";
import { Fragment } from "react";
import { SpotlightCard } from "@/components/motion";
import { useLocalAmount } from "@/hooks/use-local-currency";

const TOTAL = 2_500_000_000n;
/** Solo para el ejemplo: la comisión real la fija el contrato y se muestra al crear el link. */
const EXAMPLE_FEE_BPS = 150;

/**
 * El recorrido del dinero en un ejemplo: el cliente paga en su moneda, queda en garantía en dólares digitales y el
 * proveedor cobra al entregar. El primer monto usa la moneda detectada del visitante.
 */
export function CurrencyFlow() {
  const local = useLocalAmount(TOTAL);
  const { payeeAmount } = computeSplit(TOTAL, EXAMPLE_FEE_BPS);

  const stops = [
    {
      label: "Tu cliente paga",
      amount: local ?? "En su moneda",
      body: "Con transferencia o tarjeta, en pesos, soles o reales. No necesita comprar cripto por su cuenta.",
    },
    {
      label: "Queda en garantía",
      amount: `${formatUsdc(TOTAL)} USDC`,
      body: "En dólares digitales: 1 USDC vale 1 dólar, así que el monto no se devalúa mientras trabajas.",
    },
    {
      label: "Tú cobras",
      amount: `${formatUsdc(payeeAmount)} USDC`,
      body: "Hito por hito, al aprobar cada entrega y después de la comisión (1,5%). Los guardas en dólares o los pasas a tu moneda.",
    },
  ];

  return (
    <SpotlightCard
      className="rounded-3xl border border-border bg-surface surface-edge"
      contentClassName="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6"
    >
      {stops.map((stop, index) => (
        <Fragment key={stop.label}>
          {index > 0 && (
            <span aria-hidden="true" className="grid place-items-center text-subtle lg:pt-8">
              <ArrowDownIcon className="size-5 lg:hidden" />
              <ArrowRightIcon className="hidden size-5 lg:block" />
            </span>
          )}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{stop.label}</p>
            <p
              className={
                index === 2
                  ? "amount text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-seal"
                  : "amount text-[1.75rem] leading-tight font-semibold tracking-[-0.03em]"
              }
            >
              {stop.amount}
            </p>
            <p className="text-[0.9375rem] text-muted-foreground">{stop.body}</p>
          </div>
        </Fragment>
      ))}
    </SpotlightCard>
  );
}
