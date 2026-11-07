import { addressSchema, getChain, isSupportedChainId, type SupportedChainId } from "@escrow/shared";
import { z } from "zod";

/** Variables públicas (se incrustan en el bundle del navegador). Cada una se referencia de forma explícita. */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_CHAIN_ID: z.coerce
    .number()
    .refine(isSupportedChainId, "NEXT_PUBLIC_CHAIN_ID debe ser 8453, 84532 o 31337")
    .transform((value) => value as SupportedChainId),
  NEXT_PUBLIC_BASE_RPC_URL: z.url().optional(),
  NEXT_PUBLIC_PRIVY_APP_ID: z.string().length(25, "NEXT_PUBLIC_PRIVY_APP_ID debe ser el App ID de Privy (25 caracteres)"),
  NEXT_PUBLIC_PRIVY_CLIENT_ID: z.string().optional(),
  NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS: addressSchema,
  NEXT_PUBLIC_USDC_ADDRESS: addressSchema,
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  NEXT_PUBLIC_BASE_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined,
  NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  NEXT_PUBLIC_PRIVY_CLIENT_ID: process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || undefined,
  NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS,
  NEXT_PUBLIC_USDC_ADDRESS: process.env.NEXT_PUBLIC_USDC_ADDRESS,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
});

if (!parsed.success) {
  throw new Error(`Variables de entorno públicas inválidas:\n${z.prettifyError(parsed.error)}`);
}

export const publicEnv = parsed.data;

export const appChain = getChain(publicEnv.NEXT_PUBLIC_CHAIN_ID);
export const escrowContractAddress = publicEnv.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS;
export const usdcAddress = publicEnv.NEXT_PUBLIC_USDC_ADDRESS;
