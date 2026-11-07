"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import type { MeResponse } from "@/lib/api-types";
import { useApi } from "./use-api";

/**
 * Perfil sincronizado en Supabase. Se re-sincroniza cuando cambian las cuentas vinculadas en Privy
 * (p. ej. cuando se crea la smart wallet después de la embedded wallet).
 */
export function useMe() {
  const { ready, authenticated, user } = usePrivy();
  const api = useApi();
  const identityKey = [user?.smartWallet?.address, user?.wallet?.address, user?.email?.address, user?.google?.email].join("|");

  return useQuery({
    queryKey: ["me", user?.id, identityKey],
    queryFn: () => api<MeResponse>("/api/me", { method: "POST", body: "{}" }),
    enabled: ready && authenticated && !!user,
    staleTime: 5 * 60_000,
    select: (data) => data.user,
  });
}
