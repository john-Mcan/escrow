import { getPublicCheckout } from "@/lib/server/escrows";
import { ApiError, json, withErrorHandling } from "@/lib/server/http";

/** Proyección pública del link de cobro (sin emails ni entregables). La vista /pay la consulta periódicamente. */
export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ reference: string }> }) => {
  const { reference } = await params;
  const checkout = await getPublicCheckout(reference);
  if (!checkout) throw new ApiError(404, "escrow_not_found", "Este link de pago no existe.");
  return json(checkout);
});
