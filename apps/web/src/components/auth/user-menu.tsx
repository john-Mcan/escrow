"use client";

import { useMfaEnrollment, usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { FingerprintIcon, LayoutListIcon, LogOutIcon, ScaleIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-me";
import { shortAddress } from "@/lib/format";

export function UserMenu() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { showMfaEnrollmentModal } = useMfaEnrollment();
  const { data: me } = useMe();
  const queryClient = useQueryClient();

  if (!ready) return <Skeleton className="h-8 w-24" />;
  if (!authenticated) {
    return (
      <Button size="lg" onClick={() => login()}>
        Ingresar
      </Button>
    );
  }

  const label = me?.displayName ?? user?.email?.address ?? shortAddress(me?.walletAddress);
  const hasPasskey = user?.mfaMethods.includes("passkey") ?? false;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="lg" className="max-w-56">
          <span className="truncate">{label || "Mi cuenta"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{me?.email ?? "Sin email"}</span>
          {me?.walletAddress && (
            <span className="amount font-normal text-muted-foreground">Wallet {shortAddress(me.walletAddress)}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutListIcon /> Mis cobros
          </Link>
        </DropdownMenuItem>
        {me?.isArbitrationAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/arbitration">
              <ScaleIcon /> Panel de arbitraje
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => void showMfaEnrollmentModal()}>
          <FingerprintIcon /> {hasPasskey ? "Administrar passkeys" : "Activar passkey"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await logout();
            queryClient.clear();
          }}
        >
          <LogOutIcon /> Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
