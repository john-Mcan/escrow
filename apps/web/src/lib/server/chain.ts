import "server-only";
import { getChain } from "@escrow/shared";
import { createPublicClient, http, type PublicClient } from "viem";
import { getServerEnv } from "./env";

let client: PublicClient | undefined;

/** Cliente de lectura contra el RPC privado del servidor (nunca el que envía el navegador). */
export function getPublicClient(): PublicClient {
  if (!client) {
    const env = getServerEnv();
    client = createPublicClient({
      chain: getChain(env.NEXT_PUBLIC_CHAIN_ID),
      transport: http(env.RPC_URL, { retryCount: 2, timeout: 20_000 }),
    }) as PublicClient;
  }
  return client;
}
