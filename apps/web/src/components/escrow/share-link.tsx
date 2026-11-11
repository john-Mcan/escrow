"use client";

import { formatUsdc } from "@escrow/shared";
import { MailIcon, Share2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.96L2 22l5.2-1.5A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.08.89.9-3-.2-.31a8.2 8.2 0 1 1 6.88 3.75Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.55.12-.16.25-.63.8-.78.97-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-3.32-2.9c-.25-.43.25-.4.72-1.33.08-.16.04-.3-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3 2.73 2.73 0 0 0-.85 2.03 4.74 4.74 0 0 0 1 2.52 10.85 10.85 0 0 0 4.16 3.68c1.55.67 2.16.73 2.93.61.48-.07 1.46-.6 1.67-1.17.2-.58.2-1.07.14-1.17-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

/** Link de cobro listo para compartir: copiar, WhatsApp, email o el menú de compartir del teléfono. */
export function ShareLink({
  url,
  title,
  total,
  providerName,
}: {
  url: string;
  title: string;
  total: string | bigint;
  providerName?: string | null;
}) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  const pitch = `${providerName ? `${providerName} te envía` : "Te envío"} un link de pago en garantía para "${title}" (${formatUsdc(total)} USDC). El dinero queda protegido hasta que apruebes cada entrega.`;
  const message = `${pitch} ${url}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const mailUrl = `mailto:?subject=${encodeURIComponent(`Link de pago: ${title}`)}&body=${encodeURIComponent(message)}`;

  return (
    <div className="space-y-3">
      <div className="flex min-w-0 items-center gap-2 rounded-[10px] border border-input bg-[#101214] py-1 pr-1 pl-3.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-foreground" title={url}>
          {url.replace(/^https?:\/\//, "")}
        </span>
        <CopyButton value={url} label="Copiar link" size="sm" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon /> WhatsApp
          </a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={mailUrl}>
            <MailIcon /> Email
          </a>
        </Button>
        {canShare && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigator.share({ title, text: pitch, url }).catch(() => undefined)}
          >
            <Share2Icon /> Más opciones
          </Button>
        )}
      </div>
    </div>
  );
}
