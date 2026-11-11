"use client";

import { erc20PermitAbi } from "@escrow/shared";
import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { appChain, usdcAddress } from "@/lib/env";

/** Saldo de USDC de una dirección (unidades base). `watch` lo consulta cada pocos segundos, p. ej. mientras se espera un depósito. */
export function useUsdcBalance(address: string | null | undefined, { watch = false }: { watch?: boolean } = {}) {
  return useReadContract({
    address: usdcAddress,
    abi: erc20PermitAbi,
    functionName: "balanceOf",
    args: address ? [address as Address] : undefined,
    chainId: appChain.id,
    query: { enabled: !!address, refetchInterval: watch ? 4_000 : false },
  });
}
