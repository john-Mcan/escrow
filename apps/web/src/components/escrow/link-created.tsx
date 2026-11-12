import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { ShareLink } from "@/components/escrow/share-link";
import { MarkGlyph } from "@/components/loaders";
import { Button } from "@/components/ui/button";
import type { CreateEscrowResponse } from "@/lib/api-types";

export type CreatedLink = CreateEscrowResponse & { title: string; total: bigint };

/** Cierre de la creación: el link listo para compartir y cómo lo verá el cliente. */
export function LinkCreated({ created, providerName }: { created: CreatedLink; providerName: string }) {
  return (
    <div className="mx-auto max-w-xl space-y-8 py-4">
      <div className="space-y-5">
        <MarkGlyph state="done" className="h-10 w-[3.125rem]" />
        <div className="space-y-2">
          <h1>Tu link de cobro está listo</h1>
          <p className="t-lead">
            {created.invitationSent
              ? "Ya le enviamos la invitación a tu cliente. También puedes compartirlo por donde conversan."
              : "Envíalo por donde conversas con tu cliente."}{" "}
            Te avisaremos por email cuando deposite.
          </p>
        </div>
      </div>
      <ShareLink url={created.url} title={created.title} total={created.total} providerName={providerName} />
      <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-6">
        <Button asChild variant="ghost" className="group/see -ml-4">
          <Link href={`/pay/${created.shortCode}`}>
            Ver como lo verá tu cliente
            <ArrowUpRightIcon className="transition-transform duration-200 group-hover/see:translate-x-0.5 group-hover/see:-translate-y-0.5" />
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/dashboard">Volver a mis acuerdos</Link>
        </Button>
      </div>
    </div>
  );
}
