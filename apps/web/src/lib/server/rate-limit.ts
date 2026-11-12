import "server-only";
import { createHmac } from "node:crypto";
import { getServerEnv } from "./env";
import { ApiError, assertDb } from "./http";
import { getSupabaseAdmin } from "./supabase";

const HOUR = 3_600;
const DAY = 86_400;

interface Rule {
  limit: number;
  windowSeconds: number;
}

/**
 * Límites por acción. Protegen el envío de emails a cualquier dirección (crear un link invita al cliente) y las
 * escrituras; la reconciliación es pública, así que se cuenta por IP.
 */
const RULES = {
  create_escrow: [
    { limit: 10, windowSeconds: HOUR },
    { limit: 30, windowSeconds: DAY },
  ],
  deliverable: [{ limit: 20, windowSeconds: HOUR }],
  evidence: [{ limit: 20, windowSeconds: HOUR }],
  sync: [{ limit: 60, windowSeconds: HOUR }],
} satisfies Record<string, Rule[]>;

type Action = keyof typeof RULES;

const MESSAGES: Record<Action, string> = {
  create_escrow: "Creaste muchos links seguidos.",
  deliverable: "Enviaste muchos entregables seguidos.",
  evidence: "Enviaste mucha evidencia seguida.",
  sync: "Recibimos muchas solicitudes desde tu conexión.",
};

/**
 * Cuenta el intento y lanza un 429 si `subject` (cuenta o IP) superó alguno de los límites de la acción. Los
 * contadores viven en Postgres (`consume_rate_limit`): sirven en serverless sin servicios extra.
 */
export async function enforceRateLimit(action: Action, subject: string): Promise<void> {
  for (const { limit, windowSeconds } of RULES[action]) {
    const retryAfter = assertDb(
      await getSupabaseAdmin().rpc("consume_rate_limit", {
        p_key: `${action}:${windowSeconds}:${subject}`,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      }),
      `rate limit ${action}`,
    );
    if (retryAfter > 0) {
      throw new ApiError(
        429,
        "rate_limited",
        `${MESSAGES[action]} Vuelve a intentarlo en ${formatWait(retryAfter)}.`,
        { retryAfter },
        { "Retry-After": String(retryAfter) },
      );
    }
  }
}

/** Sujeto para rutas sin sesión: la IP del cliente, como HMAC para no guardarla en claro. */
export function clientIpSubject(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return `ip:${createHmac("sha256", getServerEnv().SUPABASE_SECRET_KEY).update(ip).digest("hex").slice(0, 32)}`;
}

function formatWait(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 90) return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
  const hours = Math.round(minutes / 60);
  return `${hours} horas`;
}
