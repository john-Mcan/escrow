"use client";

import { useMfaEnrollment, usePrivy } from "@privy-io/react-auth";
import { FingerprintIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Invita a usuarios con embedded wallet (login con email/Google) a registrar una passkey: Privy la pedirá como
 * segundo factor biométrico antes de mover dinero.
 */
export function PasskeyPrompt() {
  const { authenticated, user } = usePrivy();
  const { showMfaEnrollmentModal } = useMfaEnrollment();

  const hasEmbeddedWallet = user?.linkedAccounts.some(
    (account) => account.type === "wallet" && account.walletClientType === "privy",
  );
  if (!authenticated || !hasEmbeddedWallet || user?.mfaMethods.includes("passkey")) return null;

  return (
    <div className="flex gap-4 rounded-2xl border border-border px-5 py-4">
      <FingerprintIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 space-y-2.5">
        <div>
          <p className="font-medium">Protege tus pagos con tu huella</p>
          <p className="text-sm text-muted-foreground">
            Te la pediremos antes de mover dinero. Nadie más podrá liberar fondos desde tu cuenta.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void showMfaEnrollmentModal()}>
          Activar passkey
        </Button>
      </div>
    </div>
  );
}
