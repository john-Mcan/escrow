import { createConfig } from "@privy-io/wagmi";
import { http, type Transport } from "wagmi";
import { appChain, publicEnv } from "@/lib/env";

export const wagmiConfig = createConfig({
  chains: [appChain],
  // Una sola red activa por despliegue (NEXT_PUBLIC_CHAIN_ID).
  transports: { [appChain.id]: http(publicEnv.NEXT_PUBLIC_BASE_RPC_URL) } as Record<typeof appChain.id, Transport>,
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
