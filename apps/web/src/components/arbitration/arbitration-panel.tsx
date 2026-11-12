"use client";

import { computeSplit, milestoneEscrowAbi, txHashSchema } from "@escrow/shared";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, ExternalLinkIcon, PenLineIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { type Address, encodeFunctionData, getAbiItem, type Hex } from "viem";
import { useConfig, useReadContract } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { CopyButton } from "@/components/copy-button";
import { DetailRow, Disclosure } from "@/components/disclosure";
import { StatusText } from "@/components/escrow/status";
import { AddressLink } from "@/components/escrow/tx-link";
import { MarkGlyph, Spinner, WorkLine } from "@/components/loaders";
import { Usdc } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { ApiClientError, useApi } from "@/hooks/use-api";
import { syncTransaction } from "@/hooks/use-escrow-transactions";
import { useMe } from "@/hooks/use-me";
import type { DisputeItem, DisputesResponse } from "@/lib/api-types";
import { appChain, escrowContractAddress } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { describeTxError } from "@/lib/tx-errors";

export function ArbitrationPanel() {
  const api = useApi();
  const { data: me } = useMe();
  const { data, isPending, error } = useQuery({
    queryKey: ["disputes", me?.id],
    queryFn: () => api<DisputesResponse>("/api/arbitration/disputes"),
    enabled: !!me,
    retry: false,
  });

  if (error instanceof ApiClientError && error.status === 403) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1>Sin acceso al arbitraje</h1>
        <p className="mt-3 t-lead">Tu cuenta no está habilitada como parte del equipo de arbitraje.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="max-w-2xl space-y-3">
        <h1>Disputas abiertas</h1>
        <p className="t-lead">Revisa lo que cuenta cada parte, decide el reparto y firma la resolución.</p>
        <Disclosure summary="Cómo se firman las resoluciones">
          <p className="text-muted-foreground">
            La resolución se firma fuera de este servidor: con la wallet del árbitro conectada aquí, o desde la Safe del
            árbitro (Transaction Builder). Si la ejecutas en la Safe, registra después el hash de la transacción para
            actualizar el acuerdo y avisar a las partes.
          </p>
        </Disclosure>
      </div>
      {error && !(error instanceof ApiClientError && error.status === 403) && (
        <p role="alert" className="text-destructive">
          {error.message}
        </p>
      )}
      {isPending && <Skeleton className="h-96 w-full rounded-2xl" />}
      {data?.disputes.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
          <MarkGlyph state="idle" className="h-10 w-[3.125rem]" />
          <h2 className="mt-6">No hay disputas pendientes</h2>
          <p className="mt-2 text-muted-foreground">Cuando alguien abra una, te llegará un email y aparecerá aquí.</p>
        </div>
      )}
      {data?.disputes.map((dispute) => (
        <DisputeCard key={`${dispute.escrowId}-${dispute.milestone.index}`} dispute={dispute} />
      ))}
    </div>
  );
}

function DisputeCard({ dispute }: { dispute: DisputeItem }) {
  const config = useConfig();
  const queryClient = useQueryClient();
  const { connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const [payerPercent, setPayerPercent] = useState(50);
  const [signing, setSigning] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const payerShareBps = payerPercent * 100;
  const amount = BigInt(dispute.milestone.amount);
  const split = computeSplit(amount, dispute.platformFeeBps, payerShareBps);
  const onchainEscrowId = BigInt(dispute.onchainEscrowId);

  const { data: onchainEscrow } = useReadContract({
    address: escrowContractAddress,
    abi: milestoneEscrowAbi,
    functionName: "getEscrow",
    args: [onchainEscrowId],
    chainId: appChain.id,
  });
  const arbiter = onchainEscrow?.arbiter;
  const arbiterWallet = arbiter ? wallets.find((w) => w.address.toLowerCase() === arbiter.toLowerCase()) : undefined;

  const args = [onchainEscrowId, BigInt(dispute.milestone.index), BigInt(payerShareBps)] as const;
  const calldata = encodeFunctionData({ abi: milestoneEscrowAbi, functionName: "resolveDispute", args });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["disputes"] });
  }

  async function registerTx(hash: Hex) {
    setSyncing(true);
    try {
      await syncTransaction(dispute.escrowId, hash);
      toast.success("Resolución registrada. Avisamos a las partes por email.");
      await refresh();
    } catch (error) {
      toast.error(describeTxError(error));
    } finally {
      setSyncing(false);
    }
  }

  async function signWithConnectedWallet() {
    if (!arbiterWallet || !arbiter) return;
    setSigning(true);
    try {
      await setActiveWallet(arbiterWallet);
      const hash = await writeContract(config, {
        account: arbiter as Address,
        address: escrowContractAddress,
        abi: milestoneEscrowAbi,
        functionName: "resolveDispute",
        args,
        chainId: appChain.id,
      });
      await waitForTransactionReceipt(config, { hash, chainId: appChain.id });
      await registerTx(hash);
    } catch (error) {
      toast.error(describeTxError(error));
    } finally {
      setSigning(false);
    }
  }

  function downloadSafeBatch() {
    const method = getAbiItem({ abi: milestoneEscrowAbi, name: "resolveDispute" });
    const batch = {
      version: "1.0",
      chainId: String(dispute.chainId),
      createdAt: Date.now(),
      meta: {
        name: `Resolver disputa: ${dispute.title} (hito ${dispute.milestone.index + 1})`,
        description: `${payerPercent}% al cliente y ${100 - payerPercent}% al proveedor`,
        createdFromSafeAddress: arbiter ?? "",
      },
      transactions: [
        {
          to: escrowContractAddress,
          value: "0",
          data: null,
          contractMethod: { inputs: method.inputs, name: method.name, payable: false },
          contractInputsValues: {
            escrowId: dispute.onchainEscrowId,
            milestoneIndex: String(dispute.milestone.index),
            payerShareBps: String(payerShareBps),
          },
        },
      ],
    };
    const blob = new Blob([JSON.stringify(batch, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `resolver-disputa-${dispute.shortCode}-hito-${dispute.milestone.index + 1}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function submitHash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = txHashSchema.safeParse(new FormData(event.currentTarget).get("txHash"));
    if (!parsed.success) {
      toast.error("Ingresa un hash de transacción válido (0x + 64 caracteres).");
      return;
    }
    await registerTx(parsed.data);
  }

  const busy = signing || syncing;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface surface-edge">
      <WorkLine active={busy} />
      <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3 px-6 pt-6 pb-5 sm:px-8">
        <div className="min-w-0 space-y-1.5">
          <h2>{dispute.title}</h2>
          <p className="text-muted-foreground">
            Hito en disputa: <span className="text-foreground">{dispute.milestone.title}</span>
          </p>
          <p className="t-meta">
            {dispute.openedAt ? `Abierta el ${formatDateTime(dispute.openedAt)}` : "Disputa abierta"}
          </p>
        </div>
        <div className="space-y-1 text-right">
          <Usdc amount={amount} className="block text-2xl font-semibold tracking-[-0.02em]" unitClassName="text-sm" />
          <StatusText tone="caution">Congelado</StatusText>
        </div>
      </header>

      <div className="grid gap-10 border-t border-border px-6 py-7 sm:px-8 lg:grid-cols-2 lg:gap-14">
        <section className="min-w-0 space-y-8">
          <div className="space-y-3">
            <h3>Las partes</h3>
            <dl className="text-sm">
              <DetailRow label="Cliente">
                <span className="text-foreground">{dispute.payerEmail ?? "Sin email"}</span>{" "}
                <AddressLink chainId={dispute.chainId} address={dispute.payerAddress} />
              </DetailRow>
              <DetailRow label="Proveedor">
                <span className="text-foreground">{dispute.payeeEmail ?? "Sin email"}</span>{" "}
                <AddressLink chainId={dispute.chainId} address={dispute.payeeAddress} />
              </DetailRow>
              <DetailRow label="Árbitro del acuerdo">
                {arbiter ? (
                  <AddressLink chainId={dispute.chainId} address={arbiter} />
                ) : (
                  <Skeleton className="ml-auto h-4 w-24" />
                )}
              </DetailRow>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/pay/${dispute.shortCode}`}>Ver el acuerdo</Link>
              </Button>
              {dispute.milestone.deliverableUrl && (
                <Button asChild variant="outline" size="sm">
                  <a href={dispute.milestone.deliverableUrl} target="_blank" rel="noopener noreferrer">
                    Ver la entrega <ExternalLinkIcon />
                  </a>
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3>Lo que cuenta cada parte ({dispute.evidence.length})</h3>
            {dispute.evidence.length === 0 && (
              <p className="text-sm text-muted-foreground">Ninguna de las partes envió su versión aún.</p>
            )}
            <ul className="space-y-5">
              {dispute.evidence.map((item) => (
                <li key={item.id} className="border-l-2 border-caution/50 pl-4 text-sm">
                  <p className="t-meta">
                    {item.submittedBy ?? "Participante"}, {formatDateTime(item.createdAt)}
                  </p>
                  <p className="mt-1 text-[0.9375rem] whitespace-pre-line">{item.comment}</p>
                  {item.attachmentUrl && (
                    <a
                      href={item.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Ver adjunto <ExternalLinkIcon className="size-3.5" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="min-w-0 space-y-8">
          <div className="space-y-5">
            <div className="flex items-baseline justify-between gap-4">
              <h3>
                <Label
                  htmlFor={`split-${dispute.escrowId}-${dispute.milestone.index}`}
                  className="text-[1.0625rem] font-semibold"
                >
                  Decide el reparto
                </Label>
              </h3>
              <span className="amount text-sm text-muted-foreground">
                {payerPercent}% cliente / {100 - payerPercent}% proveedor
              </span>
            </div>
            <Slider
              id={`split-${dispute.escrowId}-${dispute.milestone.index}`}
              min={0}
              max={100}
              step={1}
              value={[payerPercent]}
              onValueChange={([value]) => setPayerPercent(value ?? 0)}
            />
            <dl className="divide-y divide-border border-y border-border text-[0.9375rem]">
              <DetailRow label="Recibe el cliente" className="py-2.5">
                <Usdc amount={split.payerAmount} className="font-medium" />
              </DetailRow>
              <DetailRow label="Recibe el proveedor" className="py-2.5">
                <Usdc amount={split.payeeAmount} className="font-medium" />
              </DetailRow>
              <DetailRow label="Comisión (solo sobre la parte del proveedor)" className="py-2.5">
                <Usdc amount={split.fee} className="font-medium" />
              </DetailRow>
            </dl>
          </div>

          <div className="space-y-3">
            <h3>Firmar la resolución</h3>
            {arbiterWallet ? (
              <Button type="button" size="lg" className="w-full" disabled={busy} onClick={signWithConnectedWallet}>
                {signing ? <Spinner /> : <PenLineIcon />}
                {signing ? "Firmando y confirmando…" : `Firmar reparto ${payerPercent} / ${100 - payerPercent}`}
              </Button>
            ) : (
              <Button type="button" size="lg" className="w-full" onClick={() => connectWallet()}>
                <WalletIcon /> Conectar la wallet del árbitro
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              {arbiterWallet
                ? "Tu wallet te pedirá confirmar. Al terminar avisamos a las partes por email."
                : "Conecta la wallet registrada como árbitro de este acuerdo (MetaMask, hardware wallet u otra)."}
            </p>
          </div>

          <Disclosure summary="Ejecutar desde la Safe del árbitro">
            <div className="space-y-5">
              <dl className="space-y-3">
                <div className="space-y-1.5">
                  <dt className="text-muted-foreground">Para (contrato)</dt>
                  <dd className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem]">{escrowContractAddress}</code>
                    <CopyButton value={escrowContractAddress} size="sm" />
                  </dd>
                </div>
                <div className="space-y-1.5">
                  <dt className="text-muted-foreground">Datos (valor: 0)</dt>
                  <dd className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem]">{calldata}</code>
                    <CopyButton value={calldata} size="sm" />
                  </dd>
                </div>
              </dl>
              <Button type="button" variant="outline" size="sm" onClick={downloadSafeBatch}>
                <DownloadIcon /> Descargar lote para Transaction Builder
              </Button>
              <form onSubmit={submitHash} className="space-y-2 border-t border-border pt-5">
                <Label htmlFor={`hash-${dispute.escrowId}-${dispute.milestone.index}`}>
                  Registrar la transacción ejecutada
                </Label>
                <div className="flex gap-2">
                  <Input
                    id={`hash-${dispute.escrowId}-${dispute.milestone.index}`}
                    name="txHash"
                    placeholder="0x…"
                    className="font-mono text-[0.8125rem]"
                  />
                  <Button type="submit" variant="outline" disabled={syncing}>
                    {syncing && <Spinner />}
                    Registrar
                  </Button>
                </div>
              </form>
            </div>
          </Disclosure>
        </section>
      </div>
    </article>
  );
}
