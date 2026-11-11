"use client";

import { formatUsdc, type PublicCheckout } from "@escrow/shared";
import { FuelIcon, LockIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Address } from "viem";
import { useBalance } from "wagmi";
import { DetailRow, Disclosure } from "@/components/disclosure";
import { TxLink } from "@/components/escrow/tx-link";
import { DEPOSIT_STEPS, DEPOSIT_STEPS_SINGLE, TxProgress } from "@/components/escrow/tx-progress";
import { MarkGlyph, Spinner, WorkLine } from "@/components/loaders";
import { LocalAmount, Usdc } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiveUsdc } from "@/components/wallet/receive-usdc";
import { InsufficientBalanceError, type useEscrowTransactions } from "@/hooks/use-escrow-transactions";
import { useUsdcBalance } from "@/hooks/use-usdc-balance";
import { appChain } from "@/lib/env";
import { describeTxError } from "@/lib/tx-errors";

type Phase = "review" | "progress" | "done";

/**
 * Depósito guiado: revisar → (cargar saldo si falta) → confirmar con avance paso a paso → listo.
 * El diálogo no se puede cerrar mientras hay una operación en curso.
 */
export function DepositDialog({
  open,
  onOpenChange,
  checkout,
  tx,
  providerName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkout: PublicCheckout;
  tx: ReturnType<typeof useEscrowTransactions>;
  providerName: string;
}) {
  const [phase, setPhase] = useState<Phase>("review");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const total = BigInt(checkout.total_amount);

  const balanceQuery = useUsdcBalance(tx.sender, { watch: open && phase === "review" });
  const balance = balanceQuery.data;
  const insufficient = balance !== undefined && balance < total;

  const { data: gas } = useBalance({
    address: tx.sender as Address | undefined,
    chainId: appChain.id,
    query: { enabled: open && !!tx.sender && tx.walletKind !== "smart" },
  });
  const noGas = tx.walletKind !== "smart" && gas !== undefined && gas.value === 0n;

  // Avisa cuando llega el USDC que faltaba mientras la ventana estaba abierta.
  const wasInsufficient = useRef(false);
  useEffect(() => {
    if (insufficient) wasInsufficient.current = true;
    else if (wasInsufficient.current && balance !== undefined) {
      wasInsufficient.current = false;
      toast.success("Recibimos tu USDC. Ya puedes depositar.");
    }
  }, [balance, insufficient]);

  useEffect(() => {
    if (open) {
      setPhase("review");
      setError(null);
    }
  }, [open]);

  async function confirm() {
    setError(null);
    setPhase("progress");
    try {
      const result = await tx.fund(checkout);
      setReceipt(result.checkout.tx_hash_funded);
      setPhase("done");
    } catch (failure) {
      if (failure instanceof InsufficientBalanceError) void balanceQuery.refetch();
      setError(describeTxError(failure));
      setPhase("review");
    }
  }

  const steps = tx.walletKind === "smart" ? DEPOSIT_STEPS_SINGLE : DEPOSIT_STEPS;

  return (
    <Dialog open={open} onOpenChange={(next) => !tx.busy && onOpenChange(next)}>
      <DialogContent showCloseButton={!tx.busy} className="sm:max-w-lg">
        {phase === "progress" && <WorkLine active className="absolute inset-x-0 top-0 rounded-t-2xl" />}

        {phase === "done" ? (
          <>
            <div className="flex flex-col items-center gap-5 pt-2 text-center">
              <MarkGlyph state="done" className="h-12 w-[3.75rem]" />
              <DialogHeader className="items-center pr-0">
                <DialogTitle>Tu dinero está en garantía</DialogTitle>
                <DialogDescription className="max-w-sm">
                  {providerName} ya puede empezar. Cuando entregue cada hito te avisaremos por email para que lo revises y
                  liberes ese pago.
                </DialogDescription>
              </DialogHeader>
              {receipt && <TxLink chainId={checkout.chain_id} hash={receipt} label="Ver comprobante" className="text-sm" />}
            </div>
            <DialogFooter>
              <Button size="lg" className="w-full" onClick={() => onOpenChange(false)}>
                Ver mis hitos
              </Button>
            </DialogFooter>
          </>
        ) : phase === "progress" ? (
          <>
            <DialogHeader>
              <DialogTitle>Depositando en garantía</DialogTitle>
              <DialogDescription>No cierres esta pestaña. Te mostramos cada paso mientras avanza.</DialogDescription>
            </DialogHeader>
            <TxProgress defs={steps} step={tx.step} />
          </>
        ) : balance === undefined ? (
          <>
            <DialogHeader>
              <DialogTitle>Depositar en garantía</DialogTitle>
              <DialogDescription>Revisando el saldo de tu cuenta…</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          </>
        ) : insufficient ? (
          <>
            <DialogHeader>
              <DialogTitle>Carga USDC para depositar</DialogTitle>
              <DialogDescription>
                Tienes <span className="amount text-foreground">{formatUsdc(balance)} USDC</span> y este acuerdo necesita{" "}
                <span className="amount text-foreground">{formatUsdc(total)} USDC</span>. Envía la diferencia a tu cuenta
                y continúa aquí mismo.
              </DialogDescription>
            </DialogHeader>
            <BalanceMeter balance={balance} total={total} />
            <ReceiveUsdc address={tx.sender ?? ""} />
            <p role="status" className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Spinner className="text-primary" /> Esperando tu USDC. Esta ventana se actualiza sola.
            </p>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Depositar en garantía</DialogTitle>
              <DialogDescription>
                El dinero queda protegido en un contrato. {providerName} recibe cada parte solo cuando apruebas la entrega.
              </DialogDescription>
            </DialogHeader>

            <dl className="divide-y divide-border border-y border-border text-[0.9375rem]">
              <DetailRow label="Depositas" className="py-3">
                <Usdc amount={total} className="font-semibold" />
                <LocalAmount amount={total} className="block text-xs" />
              </DetailRow>
              <DetailRow label="Comisión para ti" className="py-3">
                Sin costo
              </DetailRow>
              <DetailRow label="Tu saldo después" className="py-3">
                <Usdc amount={balance - total} />
              </DetailRow>
            </dl>

            <p className="text-sm text-muted-foreground">
              {tx.walletKind === "smart"
                ? "Vas a confirmar una sola vez."
                : tx.walletKind === "embedded"
                  ? "Vas a confirmar dos veces: primero autorizas el monto y después confirmas el depósito."
                  : "Tu wallet te pedirá confirmar la operación (puede pedir una autorización previa)."}
            </p>

            {noGas && (
              <div className="flex gap-3 text-sm">
                <FuelIcon className="mt-0.5 size-4 shrink-0 text-caution" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-medium text-caution">Falta saldo para la tarifa de red</p>
                  <p className="text-muted-foreground">
                    Tu cuenta necesita un poco de ETH en la red Base para pagar la tarifa de la operación (centavos de
                    dólar). Envíalo a la misma dirección donde recibes USDC.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                {error}
              </p>
            )}

            <Disclosure summary="Qué pasa con mi dinero">
              <p className="text-muted-foreground">
                El monto queda en un contrato público en la red Base, no en una cuenta de extan. Solo puede salir de tres
                formas: cuando liberas un hito (va a {providerName}), cuando {providerName} cancela un hito (vuelve a ti,
                completo) o cuando un árbitro resuelve una disputa.
              </p>
            </Disclosure>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Volver
              </Button>
              <Button size="lg" onClick={confirm} disabled={tx.busy}>
                <LockIcon /> {error ? "Intentar de nuevo" : "Confirmar depósito"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Cuánto del total ya está en la cuenta. */
function BalanceMeter({ balance, total }: { balance: bigint; total: bigint }) {
  const percent = total > 0n ? Math.min(100, Number((balance * 10_000n) / total) / 100) : 0;
  return (
    <div className="space-y-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label="Saldo disponible respecto del total">
        <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <p className="flex justify-between text-sm text-muted-foreground">
        <span>Te faltan</span>
        <span className="amount font-medium text-foreground">{formatUsdc(total - balance)} USDC</span>
      </p>
    </div>
  );
}
