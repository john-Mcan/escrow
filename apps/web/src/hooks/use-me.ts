"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import type { MeResponse } from "@/lib/api-types";
import { useApi } from "./use-api";

const MAX_WALLET_WAITS = 5;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Perfil sincronizado en Supabase. Se re-sincroniza cuando cambian las cuentas vinculadas en Privy
 * (p. ej. cuando se crea la smart wallet después de la embedded wallet).
 */
export function useMe() {
  const { ready, authenticated, user } = usePrivy();
  const api = useApi();
  const identityKey = [user?.smartWallet?.address, user?.wallet?.address, user?.email?.address, user?.google?.email].join("|");
  const clientHasWallet = !!(user?.wallet?.address || user?.smartWallet?.address);

  return useQuery({
    queryKey: ["me", user?.id, identityKey],
    queryFn: async () => {
      // Con una cuenta recién creada, el navegador ve la wallet un instante antes que la API de Privy que consulta el
      // servidor: se reintenta (0,5 s, 1 s, 2 s, 4 s…) hasta que el perfil la tenga.
      for (let attempt = 0; ; attempt++) {
        const data = await api<MeResponse>("/api/me", { method: "POST", body: "{}" });
        if (data.user.walletAddress || !clientHasWallet || attempt >= MAX_WALLET_WAITS) return data;
        await sleep(Math.min(500 * 2 ** attempt, 4000));
      }
    },
    enabled: ready && authenticated && !!user,
    staleTime: 5 * 60_000,
    select: (data) => data.user,
  });
}
