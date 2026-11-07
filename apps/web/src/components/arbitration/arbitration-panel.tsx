"use client";

import { computeSplit, formatUsdc, milestoneEscrowAbi, txHashSchema } from "@escrow/shared";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, ExternalLinkIcon, Loader2Icon, PenLineIcon } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { type Address, encodeFunctionData, getAbiItem, type Hex } from "viem";
import { useConfig, useReadContract } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { CopyButton } from "@/components/copy-button";
import { AddressLink } from "@/components/escrow/tx-link";
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
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Sin acceso al arbitraje</h1>
        <p className="mt-2 text-muted-foreground">Tu cuenta no está habilitada como parte del equipo de arbitraje.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Disputas abiertas</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Las resoluciones se firman fuera de este servidor: desde la Safe del árbitro (Transaction Builder) o con su
          hardware wallet. Después registra el hash de la transacción para actualizar el acuerdo y avisar a las partes.
        </p>
      </div>
      {error && !(error instanceof ApiClientError && error.status === 403) && <p className="text-destructive">{error.message}</p>}
      {isPending && <Skeleton className="h-64 w-full" />}
      {data?.disputes.length === 0 && (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">No hay disputas pendientes.</p>
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

  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b bg-caution-soft/60 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">
            {dispute.title}: {dispute.milestone.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {dispute.openedAt ? `Abierta el ${formatDateTime(dispute.openedAt)}` : "Disputa abierta"}
          </p>
        </div>
        <p className="amount font-heading text-xl font-semibold">{formatUsdc(amount)} USDC</p>
      </header>

      <div className="grid gap-8 p-5 lg:grid-cols-2">
        <section className="space-y-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-muted-foreground">Cliente</dt>
            <dd>
              {dispute.payerEmail ?? "Sin email"} (<AddressLink chainId={dispute.chainId} address={dispute.payerAddress} />)
            </dd>
            <dt className="text-muted-foreground">Proveedor</dt>
            <dd>
              {dispute.payeeEmail ?? "Sin email"} (<AddressLink chainId={dispute.chainId} address={dispute.payeeAddress} />)
            </dd>
            <dt className="text-muted-foreground">Árbitro on-chain</dt>
            <dd>{arbiter ? <AddressLink chainId={dispute.chainId} address={arbiter} /> : "…"}</dd>
          </dl>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href={`/pay/${dispute.shortCode}`} className="font-medium text-vault underline-offset-4 hover:underline">
              Ver el acuerdo
            </Link>
            {dispute.milestone.deliverableUrl && (
              <a
                href={dispute.milestone.deliverableUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-vault underline-offset-4 hover:underline"
              >
                Entregable <ExternalLinkIcon className="size-3.5" />
              </a>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Evidencia ({dispute.evidence.length})</h3>
            {dispute.evidence.length === 0 && <p className="text-muted-foreground">Ninguna de las partes aportó evidencia aún.</p>}
            <ul className="space-y-2">
              {dispute.evidence.map((item) => (
                <li key={item.id} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    {item.submittedBy ?? "Participante"}, {formatDateTime(item.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-line">{item.comment}</p>
                  {item.attachmentUrl && (
                    <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-vault underline-offset-4 hover:underline">
                      Ver adjunto
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <Label htmlFor={`split-${dispute.escrowId}-${dispute.milestone.index}`}>Reparto</Label>
              <span className="amount text-sm">
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
            <dl className="divide-y rounded-lg border text-sm">
              <SplitRow label="Recibe el cliente" value={split.payerAmount} />
              <SplitRow label="Recibe el proveedor" value={split.payeeAmount} />
              <SplitRow label="Comisión (solo sobre la parte del proveedor)" value={split.fee} />
            </dl>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/50 p-3 text-sm">
            <p className="font-medium">Transacción para la Safe del árbitro</p>
            <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2">
              <dt className="text-muted-foreground">Para</dt>
              <dd className="amount truncate">{escrowContractAddress}</dd>
              <CopyButton value={escrowContractAddress} label="Copiar" />
              <dt className="text-muted-foreground">Valor</dt>
              <dd className="col-span-2">0</dd>
              <dt className="text-muted-foreground">Datos</dt>
              <dd className="amount truncate">{calldata}</dd>
              <CopyButton value={calldata} label="Copiar" />
            </dl>
            <Button type="button" variant="outline" onClick={downloadSafeBatch} className="w-full">
              <DownloadIcon /> Descargar lote para Transaction Builder
            </Button>
          </div>

          {arbiterWallet ? (
            <Button type="button" className="w-full" disabled={signing || syncing} onClick={signWithConnectedWallet}>
              {signing ? <Loader2Icon className="animate-spin" /> : <PenLineIcon />}
              Firmar con la wallet del árbitro conectada
            </Button>
          ) : (
            <Button type="button" variant="ghost" className="w-full" onClick={() => connectWallet()}>
              Conectar la hardware wallet del árbitro
            </Button>
          )}

          <form onSubmit={submitHash} className="space-y-2">
            <Label htmlFor={`hash-${dispute.escrowId}-${dispute.milestone.index}`}>Registrar resolución ejecutada en la Safe</Label>
            <div className="flex gap-2">
              <Input id={`hash-${dispute.escrowId}-${dispute.milestone.index}`} name="txHash" placeholder="0x…" className="amount" />
              <Button type="submit" variant="outline" disabled={syncing}>
                {syncing && <Loader2Icon className="animate-spin" />}
                Registrar
              </Button>
            </div>
          </form>
        </section>
      </div>
    </article>
  );
}

function SplitRow({ label, value }: { label: string; value: bigint }) {
  return (
    <div className="flex justify-between gap-4 px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="amount font-medium">{formatUsdc(value)} USDC</dd>
    </div>
  );
}
