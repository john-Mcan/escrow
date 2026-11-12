"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { SignInProvider } from "@/components/auth/sign-in";
import { MARK_CORE, MARK_LEFT_BRACKET, MARK_RIGHT_BRACKET } from "@/components/brand";
import { LocalCurrencyProvider } from "@/hooks/use-local-currency";
import { appChain, publicEnv } from "@/lib/env";
import { wagmiConfig } from "@/lib/wagmi";

/**
 * Isotipo + nombre para la ventana de Privy. Privy solo acepta un `<svg>` o `<img>` directo (no un componente) y
 * lo dibuja dentro de nuestra página, así que el texto usa Figtree.
 */
const PRIVY_LOGO = (
  <svg viewBox="0 0 132 32" width="132" height="32" role="img" aria-label="extan">
    <path d={MARK_LEFT_BRACKET} fill="none" stroke="#f4f5f4" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d={MARK_RIGHT_BRACKET} fill="none" stroke="#f4f5f4" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    <rect x={MARK_CORE.x} y={MARK_CORE.y} width={MARK_CORE.size} height={MARK_CORE.size} rx={MARK_CORE.radius} fill="#7de7bb" />
    <text
      x="47"
      y="23.5"
      fill="#f4f5f4"
      style={{ fontFamily: "var(--font-figtree), sans-serif", fontSize: 25, fontWeight: 600, letterSpacing: "-0.04em" }}
    >
      extan
    </text>
  </svg>
);

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
        // Email y Google entran por nuestra ventana (`SignInProvider`); la de Privy queda solo para wallets.
        loginMethods: ["email", "google", "wallet"],
        appearance: {
          theme: "#151719",
          accentColor: "#7DE7BB",
          logo: PRIVY_LOGO,
          landingHeader: "Ingresa o crea tu cuenta",
          loginMessage: "Con tu email o Google. Si es tu primera vez, creamos tu cuenta al instante.",
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
          <WagmiProvider config={wagmiConfig}>
            <LocalCurrencyProvider>
              <SignInProvider>{children}</SignInProvider>
            </LocalCurrencyProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </SmartWalletsProvider>
    </PrivyProvider>
  );
}
