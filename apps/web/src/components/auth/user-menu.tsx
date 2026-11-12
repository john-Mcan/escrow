"use client";

import { useMfaEnrollment, usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, FingerprintIcon, LayoutListIcon, LogOutIcon, QrCodeIcon, ScaleIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useSignIn } from "@/components/auth/sign-in";
import { Avatar } from "@/components/avatar";
import { LocalAmount, Usdc } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiveUsdc } from "@/components/wallet/receive-usdc";
import { useMe } from "@/hooks/use-me";
import { useUsdcBalance } from "@/hooks/use-usdc-balance";
import { shortAddress } from "@/lib/format";

export function UserMenu() {
  const { ready, authenticated, logout, user } = usePrivy();
  const signIn = useSignIn();
  const { showMfaEnrollmentModal } = useMfaEnrollment();
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const balance = useUsdcBalance(me?.walletAddress);

  if (!ready) return <Skeleton className="h-9 w-28" />;
  if (!authenticated) {
    return (
      <Button variant="outline" size="sm" onClick={() => signIn()}>
        Ingresar
      </Button>
    );
  }

  const email = me?.email ?? user?.email?.address ?? null;
  const label = me?.displayName || email || shortAddress(me?.walletAddress) || "Mi cuenta";
  const hasPasskey = user?.mfaMethods.includes("passkey") ?? false;

  return (
    <>
      <DropdownMenu onOpenChange={(open) => open && void balance.refetch()}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="group/menu h-9 gap-2 pr-2 pl-1 text-foreground">
            <Avatar name={label} size="sm" />
            <span className="hidden max-w-40 truncate sm:inline">{label}</span>
            <ChevronDownIcon className="text-muted-foreground transition-transform duration-200 group-aria-expanded/menu:rotate-180" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <div className="px-2.5 pt-2 pb-3">
            <p className="truncate font-medium">{label}</p>
            {email && email !== label && <p className="truncate text-sm text-muted-foreground">{email}</p>}
          </div>
          <div className="mx-1 mb-1.5 rounded-lg bg-raised px-3 py-3">
            <p className="text-xs text-muted-foreground">Saldo disponible</p>
            {balance.data !== undefined ? (
              <>
                <Usdc amount={balance.data} className="mt-0.5 block text-lg font-semibold" unitClassName="text-sm" />
                <LocalAmount amount={balance.data} className="text-xs" />
              </>
            ) : (
              <Skeleton className="mt-1.5 h-6 w-28" />
            )}
          </div>
          {me?.walletAddress && (
            <DropdownMenuItem onSelect={() => setReceiveOpen(true)}>
              <QrCodeIcon /> Recibir USDC
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href="/dashboard">
              <LayoutListIcon /> Mis acuerdos
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

      {me?.walletAddress && (
        <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Recibir USDC</DialogTitle>
              <DialogDescription>
                Usa esta dirección para cargar saldo desde un exchange o desde otra wallet. Llega en menos de un minuto.
              </DialogDescription>
            </DialogHeader>
            <ReceiveUsdc address={me.walletAddress} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
