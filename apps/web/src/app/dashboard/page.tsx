"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { PasskeyPrompt } from "@/components/auth/passkey-prompt";
import { SignInGate } from "@/components/auth/sign-in-gate";
import { EscrowStatus } from "@/components/escrow/status";
import { MarkGlyph } from "@/components/loaders";
import { Usdc } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import type { EscrowListResponse } from "@/lib/api-types";
import { formatDate } from "@/lib/format";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
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
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-2">
          <h1>Tus acuerdos</h1>
          <p className="t-lead">Lo que cobras y lo que pagas, en un solo lugar.</p>
        </div>
        <Button asChild size="lg">
          <Link href="/dashboard/new">
            <PlusIcon /> Crear link de cobro
          </Link>
        </Button>
      </div>

      <PasskeyPrompt />

      {error && (
        <p role="alert" className="text-destructive">
          {error.message}
        </p>
      )}

      {(isPending || !me) && !error && (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface" aria-label="Cargando acuerdos">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="flex items-center justify-between gap-6 px-6 py-5">
              <div className="space-y-2">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3.5 w-36" />
              </div>
              <Skeleton className="h-5 w-24" />
            </li>
          ))}
        </ul>
      )}

      {data && data.escrows.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
          <MarkGlyph state="idle" className="h-10 w-[3.125rem]" />
          <h2 className="mt-6">Aún no tienes acuerdos</h2>
          <p className="mt-2 max-w-sm text-muted-foreground">
            Crea tu primer link de cobro: defines los hitos, tu cliente deposita y tú cobras al entregar.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link href="/dashboard/new">Crear link de cobro</Link>
          </Button>
        </div>
      )}

      {data && data.escrows.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface surface-edge">
          {data.escrows.map((escrow) => (
            <li key={escrow.id}>
              <Link
                href={`/pay/${escrow.shortCode}`}
                className="group/row grid gap-x-8 gap-y-2 px-6 py-5 transition-colors duration-200 outline-none hover:bg-raised focus-visible:bg-raised focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:grid-cols-[minmax(0,1fr)_9.5rem_auto_1rem] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{escrow.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {escrow.role === "payee" ? "Cobras a " : "Pagas a "}
                    {escrow.counterparty ?? "un cliente por confirmar"}
                    <span className="text-subtle">, {formatDate(escrow.createdAt)}</span>
                  </p>
                </div>
                <EscrowStatus status={escrow.status} />
                <Usdc
                  amount={escrow.totalAmount}
                  sign={escrow.role === "payee" ? "+" : "−"}
                  className="text-left text-lg font-semibold tracking-[-0.01em] sm:text-right"
                  unitClassName="text-sm"
                />
                <ChevronRightIcon
                  className="hidden size-4 text-subtle transition-transform duration-200 group-hover/row:translate-x-1 group-hover/row:text-foreground sm:block"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
