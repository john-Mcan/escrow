"use client";

import { formatBps, formatUsdc, milestoneEscrowAbi, type PublicCheckout } from "@escrow/shared";
import { usePrivy } from "@privy-io/react-auth";
import { Loader2Icon, LockIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { useReadContract } from "wagmi";
import { CopyButton } from "@/components/copy-button";
import { EscrowStatusBadge } from "@/components/escrow/status-badge";
import { AddressLink, TxLink } from "@/components/escrow/tx-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { useEscrowTransactions } from "@/hooks/use-escrow-transactions";
import { appChain, escrowContractAddress, publicEnv } from "@/lib/env";
import { CHAIN_LABELS } from "@/lib/format";
import { describeTxError, TX_STEP_LABELS } from "@/lib/tx-errors";
import type { ViewerRole } from "./milestone-actions";

const TESTNET_IDS = new Set([84532, 31337]);

export function FundPanel({
  checkout,
  role,
  tx,
}: {
  checkout: PublicCheckout;
  role: ViewerRole;
  tx: ReturnType<typeof useEscrowTransactions>;
}) {
  const { authenticated, login } = usePrivy();
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

  async function deposit() {
    if (!authenticated) {
      login();
      return;
    }
    try {
      await tx.fund(checkout);
      toast.success("Depósito confirmado. El dinero quedó en garantía.");
    } catch (error) {
      toast.error(describeTxError(error));
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="font-heading text-base">Resumen</CardTitle>
          <EscrowStatusBadge status={checkout.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-sm text-muted-foreground">{isDraft ? "Total a depositar" : "Total del acuerdo"}</p>
          <p className="amount font-heading text-4xl font-bold tracking-tight">
            {formatUsdc(total)} <span className="text-lg font-medium text-muted-foreground">USDC</span>
          </p>
        </div>

        {isDraft && role !== "payee" && (
          <div className="space-y-3">
            <Button size="lg" className="h-11 w-full text-base" disabled={tx.busy} onClick={deposit}>
              {tx.busy ? <Loader2Icon className="animate-spin" /> : <LockIcon />}
              {tx.busy ? TX_STEP_LABELS[tx.step] : authenticated ? `Depositar ${formatUsdc(total)} USDC en garantía` : "Ingresar para depositar"}
            </Button>
            <p className="flex gap-2 text-sm text-muted-foreground">
              <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-seal" aria-hidden="true" />
              El dinero queda bloqueado en un contrato inteligente. Tú decides cuándo liberar cada hito.
            </p>
            {authenticated && tx.usesSmartWallet && <p className="text-sm text-muted-foreground">No pagas gas: la red lo cubre por ti.</p>}
            {TESTNET_IDS.has(checkout.chain_id) && (
              <p className="text-sm text-muted-foreground">
                Red de prueba: consigue USDC de prueba en{" "}
                <a className="text-vault underline-offset-4 hover:underline" href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">
                  faucet.circle.com
                </a>
                .
              </p>
            )}
          </div>
        )}

        {isDraft && role === "payee" && (
          <div className="space-y-3">
            <p className="text-sm">Este es tu link de cobro. Compártelo con tu cliente para que deposite la garantía.</p>
            <div className="flex gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-2.5 py-2 text-sm">{shareUrl}</code>
              <CopyButton value={shareUrl} />
            </div>
          </div>
        )}

        <Separator />

        <dl className="space-y-2.5 text-sm">
          <Row label="Comisión de la plataforma">
            {feeBps !== null ? `${formatBps(feeBps)} sobre lo liberado` : "Se descuenta al liberar"}
          </Row>
          <Row label="Red">{CHAIN_LABELS[checkout.chain_id] ?? appChain.name}</Row>
          <Row label="Contrato">
            <AddressLink chainId={checkout.chain_id} address={checkout.contract_address ?? escrowContractAddress} />
          </Row>
          {checkout.payer_address && (
            <Row label="Cliente">
              <AddressLink chainId={checkout.chain_id} address={checkout.payer_address} />
            </Row>
          )}
          <Row label="Proveedor">
            <AddressLink chainId={checkout.chain_id} address={checkout.payee_address} />
          </Row>
          {checkout.tx_hash_funded && (
            <Row label="Depósito">
              <TxLink chainId={checkout.chain_id} hash={checkout.tx_hash_funded} label="ver recibo" />
            </Row>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
