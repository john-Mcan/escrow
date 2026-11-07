"use client";

import { formatUsdc } from "@escrow/shared";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { PasskeyPrompt } from "@/components/auth/passkey-prompt";
import { SignInGate } from "@/components/auth/sign-in-gate";
import { EscrowStatusBadge } from "@/components/escrow/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import type { EscrowListResponse } from "@/lib/api-types";
import { formatDate } from "@/lib/format";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <SignInGate title="Tus cobros en garantía" description="Ingresa para crear links de cobro y seguir tus acuerdos.">
        <EscrowList />
      </SignInGate>
    </div>
  );
}

function EscrowList() {
  const api = useApi();
  const { data: me } = useMe();
  const { data, isPending, error } = useQuery({
    queryKey: ["escrows", me?.id],
    queryFn: () => api<EscrowListResponse>("/api/escrows"),
    enabled: !!me,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Tus acuerdos</h1>
          <p className="mt-1 text-muted-foreground">Los que cobras y los que pagas, en un solo lugar.</p>
        </div>
        <Button asChild size="lg" className="h-10 px-4">
          <Link href="/dashboard/new">
            <PlusIcon /> Nuevo link de cobro
          </Link>
        </Button>
      </div>

      <PasskeyPrompt />

      {error && <p className="text-destructive">{error.message}</p>}
      {(isPending || !me) && !error && (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {data && data.escrows.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <h2 className="text-lg font-semibold">Aún no tienes acuerdos</h2>
          <p className="mx-auto mt-1 max-w-sm text-muted-foreground">
            Crea tu primer link de cobro: defines los hitos, tu cliente deposita y tú cobras al entregar.
          </p>
          <Button asChild className="mt-5">
            <Link href="/dashboard/new">Crear link de cobro</Link>
          </Button>
        </div>
      )}

      {data && data.escrows.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {data.escrows.map((escrow) => (
            <li key={escrow.id}>
              <Link
                href={`/pay/${escrow.shortCode}`}
                className="grid gap-2 px-4 py-4 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{escrow.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {escrow.role === "payee" ? "Cobras a " : "Pagas a "}
                    {escrow.counterparty ?? "cliente por confirmar"}, {formatDate(escrow.createdAt)}
                  </p>
                </div>
                <EscrowStatusBadge status={escrow.status} />
                <p className="amount text-right font-heading text-lg font-semibold">
                  {escrow.role === "payee" ? "+" : "−"}
                  {formatUsdc(escrow.totalAmount)} <span className="text-sm font-normal text-muted-foreground">USDC</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
