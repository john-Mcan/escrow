"use client";

import { useMfaEnrollment, usePrivy } from "@privy-io/react-auth";
import { FingerprintIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Invita a usuarios con embedded wallet (login con email/Google) a registrar una passkey: Privy la pedirá como
 * segundo factor biométrico antes de firmar liberaciones de dinero.
 */
export function PasskeyPrompt() {
  const { authenticated, user } = usePrivy();
  const { showMfaEnrollmentModal } = useMfaEnrollment();

  const hasEmbeddedWallet = user?.linkedAccounts.some((account) => account.type === "wallet" && account.walletClientType === "privy");
  if (!authenticated || !hasEmbeddedWallet || user?.mfaMethods.includes("passkey")) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-vault/20 bg-vault-soft p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <FingerprintIcon className="mt-0.5 size-5 shrink-0 text-vault" aria-hidden="true" />
        <div>
          <p className="font-medium">Protege tus pagos con una passkey</p>
          <p className="text-sm text-muted-foreground">
            Te pediremos tu huella o Face ID antes de mover dinero. Nadie más podrá liberar fondos desde tu cuenta.
          </p>
        </div>
      </div>
      <Button variant="outline" onClick={() => void showMfaEnrollmentModal()} className="shrink-0">
        Activar passkey
      </Button>
    </div>
  );
}
