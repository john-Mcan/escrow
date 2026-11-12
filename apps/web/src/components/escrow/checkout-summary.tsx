"use client";

import { formatBps, milestoneEscrowAbi, type PublicCheckout } from "@escrow/shared";
import { usePrivy } from "@privy-io/react-auth";
import { LockIcon, ReceiptTextIcon, ScaleIcon, ShieldCheckIcon, Undo2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { useSignIn } from "@/components/auth/sign-in";
import { DetailRow, Disclosure } from "@/components/disclosure";
import { DepositDialog } from "@/components/escrow/deposit-dialog";
import { ShareLink } from "@/components/escrow/share-link";
import { EscrowStatus } from "@/components/escrow/status";
import { AddressLink, TxLink } from "@/components/escrow/tx-link";
import { LocalAmountPicker, Usdc } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { useEscrowTransactions } from "@/hooks/use-escrow-transactions";
import { useMe } from "@/hooks/use-me";
import { appChain, escrowContractAddress, publicEnv } from "@/lib/env";
import { CHAIN_LABELS } from "@/lib/format";
import type { ViewerRole } from "./milestone-actions";

const GUARANTEES = [
  { icon: ShieldCheckIcon, text: "Tu dinero queda protegido hasta que apruebas cada entrega." },
  { icon: Undo2Icon, text: "Si un hito se cancela, recuperas el 100%." },
  { icon: ScaleIcon, text: "Si no llegan a un acuerdo, decide un árbitro independiente." },
  { icon: ReceiptTextIcon, text: "Pagas exactamente este monto: sin comisiones para ti." },
];

/** Panel lateral del link de pago (estilo checkout): monto, una sola acción principal y los detalles plegados. */
export function CheckoutSummary({
  checkout,
  role,
  tx,
  identityPending,
  providerName,
}: {
  checkout: PublicCheckout;
  role: ViewerRole;
  tx: ReturnType<typeof useEscrowTransactions>;
  identityPending: boolean;
  providerName: string;
}) {
  const { ready, authenticated } = usePrivy();
  const signIn = useSignIn();
  const { data: me } = useMe();
  const [depositOpen, setDepositOpen] = useState(false);
  const [wantsDeposit, setWantsDeposit] = useState(false);
  const total = BigInt(checkout.total_amount);
  const isDraft = checkout.status === "draft";
  const shareUrl = `${publicEnv.NEXT_PUBLIC_APP_URL}/pay/${checkout.short_code}`;

  // Antes del depósito se muestra el fee vigente on-chain; después, el fijado (snapshot) en el escrow.
  const { data: currentFeeBps } = useReadContract({
    address: escrowContractAddress,
    abi: milestoneEscrowAbi,
    functionName: "platformFeeBps",
    chainId: appChain.id,
    query: { enabled: checkout.platform_fee_bps === null },
  });
  const feeBps = checkout.platform_fee_bps ?? (currentFeeBps !== undefined ? Number(currentFeeBps) : null);

  // Quien tocó "Depositar" sin sesión continúa directo al depósito al terminar de ingresar. La intención también
  // queda en sessionStorage: el ingreso con Google sale de la página y vuelve recargándola.
  const intentKey = `extan:deposit-after-sign-in:${checkout.id}`;
  useEffect(() => {
    try {
      if (sessionStorage.getItem(intentKey)) setWantsDeposit(true);
    } catch {
      // Sin almacenamiento: solo se recuerda dentro de la pestaña actual.
    }
  }, [intentKey]);

  useEffect(() => {
    if (!wantsDeposit || !authenticated || !me) return;
    setWantsDeposit(false);
    try {
      sessionStorage.removeItem(intentKey);
    } catch {
      // Ídem.
    }
    if (role !== "payee") setDepositOpen(true);
  }, [authenticated, intentKey, me, role, wantsDeposit]);

  function startDeposit() {
    if (!authenticated) {
      setWantsDeposit(true);
      try {
        sessionStorage.setItem(intentKey, "1");
      } catch {
        // Ídem.
      }
      signIn({
        title: "Ingresa para depositar",
        description: "Con tu email, sin contraseña. Si es tu primera vez, creamos tu cuenta al instante.",
      });
      return;
    }
    setDepositOpen(true);
  }

  const totals = { held: 0n, paid: 0n, refunded: 0n, disputed: 0n };
  for (const m of checkout.milestones) {
    const amount = BigInt(m.amount);
    if (m.status === "funded" || m.status === "delivered_review") totals.held += amount;
    else if (m.status === "released" || m.status === "resolved") totals.paid += amount;
    else if (m.status === "refunded") totals.refunded += amount;
    else if (m.status === "disputed") totals.disputed += amount;
  }

  return (
    <section aria-labelledby="summary-heading" className="rounded-2xl border border-border bg-surface surface-edge">
      <div className="space-y-1 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="summary-heading" className="text-sm font-medium tracking-normal text-muted-foreground">
            {isDraft ? "Total a depositar" : "Total del acuerdo"}
          </h2>
          {!isDraft && <EscrowStatus status={checkout.status} />}
        </div>
        <Usdc amount={total} className="block text-[2.5rem] leading-tight font-semibold tracking-[-0.035em]" unitClassName="text-lg tracking-normal" />
        <LocalAmountPicker amount={total} />
      </div>

      <div className="border-t border-border p-6">
        {isDraft && identityPending ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : isDraft && role === "payee" ? (
          <div className="space-y-4">
            <div>
              <h3>Tu link está listo para compartir</h3>
              <p className="mt-1 text-sm text-muted-foreground">Te avisaremos por email cuando tu cliente deposite.</p>
            </div>
            <ShareLink url={shareUrl} title={checkout.title} total={total} providerName={me?.displayName} />
          </div>
        ) : isDraft ? (
          <div className="space-y-5">
            <div className="space-y-3">
              <Button size="xl" className="w-full" onClick={startDeposit} disabled={!ready}>
                <LockIcon /> Depositar en garantía
              </Button>
              {!authenticated && (
                <p className="text-center text-sm text-muted-foreground">
                  Entras con tu email. Si es tu primera vez, creamos tu cuenta.
                </p>
              )}
            </div>
            <ul className="space-y-3">
              {GUARANTEES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3 text-sm text-muted-foreground">
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <dl className="text-[0.9375rem]">
            {totals.held > 0n && (
              <DetailRow label="En garantía">
                <Usdc amount={totals.held} />
              </DetailRow>
            )}
            {totals.paid > 0n && (
              <DetailRow label="Pagado">
                <Usdc amount={totals.paid} />
              </DetailRow>
            )}
            {totals.disputed > 0n && (
              <DetailRow label="En disputa">
                <Usdc amount={totals.disputed} className="text-caution" />
              </DetailRow>
            )}
            {totals.refunded > 0n && (
              <DetailRow label="Reembolsado">
                <Usdc amount={totals.refunded} />
              </DetailRow>
            )}
          </dl>
        )}
      </div>

      <div className="space-y-1 border-t border-border px-6 py-4">
        <Disclosure summary="¿Qué es USDC?">
          <p className="text-muted-foreground">
            Es un dólar digital: 1 USDC equivale a 1 dólar estadounidense. Lo emite Circle, una empresa regulada en
            Estados Unidos. El monto en tu moneda es solo una referencia; el pago se hace en USDC.
          </p>
        </Disclosure>
        <Disclosure summary="Detalles técnicos">
          <dl>
            <DetailRow label="Red">{CHAIN_LABELS[checkout.chain_id] ?? appChain.name}</DetailRow>
            <DetailRow label="Contrato de garantía">
              <AddressLink chainId={checkout.chain_id} address={checkout.contract_address ?? escrowContractAddress} />
            </DetailRow>
            <DetailRow label="Proveedor">
              <AddressLink chainId={checkout.chain_id} address={checkout.payee_address} />
            </DetailRow>
            {checkout.payer_address && (
              <DetailRow label="Cliente">
                <AddressLink chainId={checkout.chain_id} address={checkout.payer_address} />
              </DetailRow>
            )}
            {checkout.tx_hash_funded && (
              <DetailRow label="Comprobante del depósito">
                <TxLink chainId={checkout.chain_id} hash={checkout.tx_hash_funded} />
              </DetailRow>
            )}
            <DetailRow label="Comisión de extan">
              {feeBps !== null ? `${formatBps(feeBps)} de lo que recibe el proveedor` : "Se descuenta al liberar"}
            </DetailRow>
          </dl>
        </Disclosure>
      </div>

      {/* Sigue montado tras el depósito (el acuerdo ya no es borrador) para mostrar la confirmación final. */}
      {(isDraft || depositOpen) && role !== "payee" && (
        <DepositDialog open={depositOpen} onOpenChange={setDepositOpen} checkout={checkout} tx={tx} providerName={providerName} />
      )}
    </section>
  );
}
