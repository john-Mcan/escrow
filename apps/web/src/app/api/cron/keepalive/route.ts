import { getServerEnv } from "@/lib/server/env";
import { ApiError, assertDbOk, json, withErrorHandling } from "@/lib/server/http";
import { getSupabaseAdmin } from "@/lib/server/supabase";

/** Los contadores más largos son diarios: dos días de margen bastan para no borrar una ventana vigente. */
const RATE_LIMIT_RETENTION_MS = 2 * 86_400_000;

/**
 * Cron diario de Vercel (`vercel.json`). Mantiene activo el proyecto de Supabase, que en el plan gratuito se pausa
 * tras 7 días sin actividad, y aprovecha la visita para borrar los contadores vencidos del límite de solicitudes.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const { CRON_SECRET } = getServerEnv();
  if (CRON_SECRET && request.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    throw new ApiError(401, "unauthorized", "No autorizado.");
  }

  const cutoff = new Date(Date.now() - RATE_LIMIT_RETENTION_MS).toISOString();
  const supabase = getSupabaseAdmin();
  assertDbOk(await supabase.from("rate_limits").delete().lt("window_start", cutoff), "prune rate limits");
  assertDbOk(await supabase.from("users").select("id", { head: true, count: "exact" }), "keepalive query");

  return json({ ok: true });
});
