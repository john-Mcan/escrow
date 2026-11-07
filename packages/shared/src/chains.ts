import type { Address, Hex } from "viem";
import { base, baseSepolia, foundry } from "viem/chains";

export const SUPPORTED_CHAINS = {
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
  [foundry.id]: foundry,
} as const;

export type SupportedChainId = keyof typeof SUPPORTED_CHAINS;

export const SUPPORTED_CHAIN_IDS = [base.id, baseSepolia.id, foundry.id] as const;

export function isSupportedChainId(chainId: number): chainId is SupportedChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
}

export function getChain(chainId: SupportedChainId) {
  return SUPPORTED_CHAINS[chainId];
}

/** USDC nativo de Circle. En Anvil se usa el MockUSDC desplegado por el script (dirección por variable de entorno). */
export const USDC_ADDRESSES: Partial<Record<SupportedChainId, Address>> = {
  [base.id]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  [baseSepolia.id]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

const EXPLORER_URLS: Record<SupportedChainId, string | null> = {
  [base.id]: "https://basescan.org",
  [baseSepolia.id]: "https://sepolia.basescan.org",
  [foundry.id]: null,
};

/** Link al recibo auditable en Basescan (null en redes locales sin explorador). */
export function explorerTxUrl(chainId: SupportedChainId, txHash: Hex): string | null {
  const explorer = EXPLORER_URLS[chainId];
  return explorer ? `${explorer}/tx/${txHash}` : null;
}

export function explorerAddressUrl(chainId: SupportedChainId, address: Address): string | null {
  const explorer = EXPLORER_URLS[chainId];
  return explorer ? `${explorer}/address/${address}` : null;
}
