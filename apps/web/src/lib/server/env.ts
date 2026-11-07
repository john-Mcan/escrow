import "server-only";
import { z } from "zod";
import { publicEnv } from "@/lib/env";

const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1, "Falta SUPABASE_SECRET_KEY"),
  PRIVY_APP_SECRET: z.string().min(1, "Falta PRIVY_APP_SECRET"),
  /** Opcional: clave pública de verificación de Privy (si no, se usa el JWKS del app). */
  PRIVY_VERIFICATION_KEY: z.string().optional(),
  BASE_MAINNET_RPC_URL: z.url().optional(),
  BASE_SEPOLIA_RPC_URL: z.url().optional(),
  ANVIL_RPC_URL: z.url().default("http://127.0.0.1:8545"),
  /** Sin key los correos se escriben en el log del servidor (desarrollo). */
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Hito <onboarding@resend.dev>"),
  EMAIL_REPLY_TO: z.email().optional(),
  /** Emails (separados por coma) con acceso al panel de arbitraje. */
  ARBITRATION_ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & typeof publicEnv & { RPC_URL: string };

let cached: ServerEnv | undefined;

/** Se valida al primer uso (no en build) para que `next build` no requiera secretos. */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse({
    ...process.env,
    PRIVY_VERIFICATION_KEY: process.env.PRIVY_VERIFICATION_KEY || undefined,
    BASE_MAINNET_RPC_URL: process.env.BASE_MAINNET_RPC_URL || undefined,
    BASE_SEPOLIA_RPC_URL: process.env.BASE_SEPOLIA_RPC_URL || undefined,
    ANVIL_RPC_URL: process.env.ANVIL_RPC_URL || undefined,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Variables de entorno de servidor inválidas:\n${z.prettifyError(parsed.error)}`);
  }

  const rpcByChain = {
    8453: parsed.data.BASE_MAINNET_RPC_URL,
    84532: parsed.data.BASE_SEPOLIA_RPC_URL,
    31337: parsed.data.ANVIL_RPC_URL,
  } as const;
  const rpcUrl = rpcByChain[publicEnv.NEXT_PUBLIC_CHAIN_ID];
  if (!rpcUrl) {
    throw new Error(`Falta el RPC de servidor para la red ${publicEnv.NEXT_PUBLIC_CHAIN_ID}`);
  }

  cached = { ...parsed.data, ...publicEnv, RPC_URL: rpcUrl };
  return cached;
}
