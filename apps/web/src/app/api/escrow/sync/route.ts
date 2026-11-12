import { type PublicCheckout, syncRequestSchema } from "@escrow/shared";
import { after } from "next/server";
import type { SyncResponse } from "@/lib/api-types";
import { deliverNotifications } from "@/lib/server/email/notifications";
import { syncEscrowTransaction } from "@/lib/server/escrow-sync";
import { getPublicCheckout } from "@/lib/server/escrows";
import { json, parseJsonBody, withErrorHandling } from "@/lib/server/http";
import { clientIpSubject, enforceRateLimit } from "@/lib/server/rate-limit";

export const maxDuration = 30;

/**
 * Reconciliación on-chain. No requiere sesión: el frontend solo aporta un `txHash` y todo lo demás se verifica
 * contra el RPC de Base (recibo exitoso, eventos del contrato, referenceId, partes y montos). Es idempotente.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const { escrowId, txHash } = await parseJsonBody(request, syncRequestSchema);
  await enforceRateLimit("sync", clientIpSubject(request));
  const { applied, notifications } = await syncEscrowTransaction(escrowId, txHash);

  if (notifications.length > 0) {
    after(() => deliverNotifications(notifications));
  }

  const checkout = (await getPublicCheckout(escrowId)) as PublicCheckout;
  return json<SyncResponse>({ checkout, applied });
});
