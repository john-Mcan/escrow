import { z } from "zod";
import { LOCAL_CURRENCY_CODES, type RatesResponse } from "@/lib/currency";
import { ApiError, withErrorHandling } from "@/lib/server/http";

const SOURCE_URL = "https://api.coinbase.com/v2/exchange-rates?currency=USDC";
const REVALIDATE_SECONDS = 600;

const coinbaseSchema = z.object({ data: z.object({ rates: z.record(z.string(), z.string()) }) });

/** Tipo de cambio referencial de USDC a monedas locales (Coinbase, público y sin llave), cacheado 10 minutos. */
export const GET = withErrorHandling(async () => {
  const response = await fetch(SOURCE_URL, { next: { revalidate: REVALIDATE_SECONDS } }).catch(() => null);
  const parsed = response?.ok ? coinbaseSchema.safeParse(await response.json().catch(() => null)) : null;
  if (!parsed?.success) throw new ApiError(502, "rates_unavailable", "El tipo de cambio no está disponible.");

  const rates: RatesResponse["rates"] = {};
  for (const code of LOCAL_CURRENCY_CODES) {
    const value = Number(parsed.data.data.rates[code]);
    if (Number.isFinite(value) && value > 0) rates[code] = value;
  }

  return Response.json({ rates, source: "Coinbase", fetchedAt: new Date().toISOString() } satisfies RatesResponse, {
    headers: { "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=3600` },
  });
});
