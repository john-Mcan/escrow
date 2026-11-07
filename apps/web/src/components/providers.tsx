"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { appChain, publicEnv } from "@/lib/env";
import { wagmiConfig } from "@/lib/wagmi";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false } } }),
  );

  return (
    <PrivyProvider
      appId={publicEnv.NEXT_PUBLIC_PRIVY_APP_ID}
      clientId={publicEnv.NEXT_PUBLIC_PRIVY_CLIENT_ID}
      config={{
        // Web2.5: email/Google crean una embedded wallet invisible; usuarios cripto conectan su wallet.
        loginMethods: ["email", "google", "wallet"],
        appearance: {
          theme: "light",
          accentColor: "#14213d",
          landingHeader: "Ingresa a Hito",
          loginMessage: "Con tu email, Google o tu wallet",
          showWalletLoginFirst: false,
          walletList: ["metamask", "coinbase_wallet", "rainbow", "wallet_connect"],
        },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        // Passkeys como 2FA: se exigen al firmar (configurar "MFA para acciones de wallet" en el dashboard de Privy).
        mfa: { noPromptOnMfaRequired: false },
        defaultChain: appChain,
        supportedChains: [appChain],
      }}
    >
      {/* Smart wallets (ERC-4337) + paymaster configurados en el dashboard de Privy: gas patrocinado. */}
      <SmartWalletsProvider>
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
        </QueryClientProvider>
      </SmartWalletsProvider>
    </PrivyProvider>
  );
}
