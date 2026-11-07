import { explorerAddressUrl, explorerTxUrl, type SupportedChainId } from "@escrow/shared";
import { ExternalLinkIcon } from "lucide-react";
import type { Address, Hex } from "viem";
import { shortAddress } from "@/lib/format";

/** Recibo auditable: link directo a Basescan (o el hash si la red no tiene explorador). */
export function TxLink({ chainId, hash, label }: { chainId: number; hash: string; label?: string }) {
  const url = explorerTxUrl(chainId as SupportedChainId, hash as Hex);
  // Redes locales sin explorador: se muestra el hash (el texto "ver en Basescan" no tendría destino).
  if (!url) return <span className="amount text-muted-foreground" title={hash}>{shortAddress(hash)}</span>;
  const text = label ?? shortAddress(hash);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-vault underline-offset-4 hover:underline"
    >
      {text}
      <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">(abre Basescan en otra pestaña)</span>
    </a>
  );
}

export function AddressLink({ chainId, address }: { chainId: number; address: string }) {
  const url = explorerAddressUrl(chainId as SupportedChainId, address as Address);
  if (!url) return <span className="amount">{shortAddress(address)}</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="amount text-vault underline-offset-4 hover:underline">
      {shortAddress(address)}
    </a>
  );
}
