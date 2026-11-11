"use client";

import { TriangleAlertIcon } from "lucide-react";
import QRCode from "react-qr-code";
import { CopyButton } from "@/components/copy-button";
import { appChain } from "@/lib/env";

const TESTNET_IDS = new Set([84532, 31337]);

/**
 * Cómo cargar USDC a la cuenta: dirección completa, QR para escanear desde el teléfono y la advertencia de red.
 * Es el puente mientras no exista la compra con transferencia o tarjeta dentro de extan.
 */
export function ReceiveUsdc({ address }: { address: string }) {
  const testnet = TESTNET_IDS.has(appChain.id);
  return (
    <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
      <div className="justify-self-center rounded-xl bg-[#f4f5f4] p-3 sm:justify-self-start">
        <QRCode value={address} size={128} bgColor="#f4f5f4" fgColor="#08090b" title="Código QR de tu dirección" />
      </div>
      <div className="min-w-0 space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Tu dirección para recibir USDC</p>
          <p className="mt-1 font-mono text-[0.8125rem] leading-relaxed break-all text-foreground">{address}</p>
        </div>
        <CopyButton value={address} label="Copiar dirección" size="sm" />
      </div>
      <p className="flex gap-2.5 text-sm text-muted-foreground sm:col-span-2">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-caution" aria-hidden="true" />
        <span>
          Envía solo <strong className="font-medium text-foreground">USDC</strong> por la red{" "}
          <strong className="font-medium text-foreground">{testnet ? "Base Sepolia" : "Base"}</strong>. Si tu exchange te
          pide elegir red, elige esa; otras redes o monedas no llegarán a tu cuenta.
        </span>
      </p>
      {testnet && (
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Estás en la red de prueba: consigue USDC de prueba gratis en{" "}
          <a
            className="font-medium text-primary underline-offset-4 hover:underline"
            href="https://faucet.circle.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            faucet.circle.com
          </a>
          .
        </p>
      )}
    </div>
  );
}
