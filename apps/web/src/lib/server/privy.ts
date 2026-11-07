import "server-only";
import { PrivyClient } from "@privy-io/node";
import { getServerEnv } from "./env";

let client: PrivyClient | undefined;

export function getPrivy(): PrivyClient {
  if (!client) {
    const env = getServerEnv();
    client = new PrivyClient({
      appId: env.NEXT_PUBLIC_PRIVY_APP_ID,
      appSecret: env.PRIVY_APP_SECRET,
      jwtVerificationKey: env.PRIVY_VERIFICATION_KEY,
    });
  }
  return client;
}

type PrivyUser = Awaited<ReturnType<ReturnType<PrivyClient["users"]>["_get"]>>;

export interface PrivyIdentity {
  did: string;
  email: string | null;
  walletAddress: string | null;
  displayName: string | null;
}

/**
 * Extrae la identidad que usa la app. Prioridad de wallet:
 * smart account (ERC-4337, gas patrocinado) > embedded wallet de Privy > primera wallet externa.
 */
export function toIdentity(user: PrivyUser): PrivyIdentity {
  let email: string | null = null;
  let googleName: string | null = null;
  let smartWallet: string | null = null;
  let embeddedWallet: string | null = null;
  let externalWallet: string | null = null;

  for (const account of user.linked_accounts) {
    switch (account.type) {
      case "email":
        email ??= account.address;
        break;
      case "google_oauth":
        email ??= account.email;
        googleName ??= account.name ?? null;
        break;
      case "smart_wallet":
        smartWallet ??= account.address;
        break;
      case "wallet":
        if (account.chain_type !== "ethereum") break;
        if ("connector_type" in account && account.connector_type === "embedded") embeddedWallet ??= account.address;
        else externalWallet ??= account.address;
        break;
    }
  }

  const normalizedEmail = email?.trim().toLowerCase() ?? null;
  return {
    did: user.id,
    email: normalizedEmail,
    walletAddress: (smartWallet ?? embeddedWallet ?? externalWallet)?.toLowerCase() ?? null,
    displayName: googleName ?? normalizedEmail?.split("@")[0] ?? null,
  };
}
