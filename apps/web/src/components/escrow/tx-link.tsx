import { explorerAddressUrl, explorerTxUrl, type SupportedChainId } from "@escrow/shared";
import { ArrowUpRightIcon } from "lucide-react";
import type { Address, Hex } from "viem";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

const LINK =
  "group/tx inline-flex items-center gap-0.5 font-medium text-foreground underline decoration-line-strong underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/60";

/** Comprobante público en Basescan (o el hash si la red no tiene explorador). */
export function TxLink({ chainId, hash, label, className }: { chainId: number; hash: string; label?: string; className?: string }) {
  const url = explorerTxUrl(chainId as SupportedChainId, hash as Hex);
  // Redes locales sin explorador: se muestra el hash (el texto del enlace no tendría destino).
  if (!url) return <span className="font-mono text-[0.8125rem] text-muted-foreground" title={hash}>{shortAddress(hash)}</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cn(LINK, className)}>
      {label ?? <span className="font-mono text-[0.8125rem]">{shortAddress(hash)}</span>}
      <ArrowUpRightIcon
        className="size-3.5 transition-transform duration-200 group-hover/tx:translate-x-0.5 group-hover/tx:-translate-y-0.5"
        aria-hidden="true"
      />
      <span className="sr-only">(abre Basescan en otra pestaña)</span>
    </a>
  );
}

export function AddressLink({ chainId, address }: { chainId: number; address: string }) {
  const url = explorerAddressUrl(chainId as SupportedChainId, address as Address);
  const text = <span className="font-mono text-[0.8125rem]">{shortAddress(address)}</span>;
  if (!url) return <span title={address}>{text}</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={address} className={LINK}>
      {text}
      <ArrowUpRightIcon
        className="size-3.5 transition-transform duration-200 group-hover/tx:translate-x-0.5 group-hover/tx:-translate-y-0.5"
        aria-hidden="true"
      />
    </a>
  );
}
