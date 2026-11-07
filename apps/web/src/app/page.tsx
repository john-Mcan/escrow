import { formatUsdc, type PublicCheckoutMilestone } from "@escrow/shared";
import Link from "next/link";
import { AmountBar } from "@/components/escrow/amount-bar";
import { MilestoneStatusBadge } from "@/components/escrow/status-badge";
import { Button } from "@/components/ui/button";

const SAMPLE: Pick<PublicCheckoutMilestone, "title" | "amount" | "status">[] = [
  { title: "Diseño de la tienda", amount: "600000000", status: "released" },
  { title: "Desarrollo y catálogo", amount: "1400000000", status: "delivered_review" },
  { title: "Lanzamiento y soporte", amount: "500000000", status: "funded" },
];

const STEPS = [
  {
    title: "Creas el acuerdo",
    body: "Divides el trabajo en hitos con montos y fechas. Obtienes un link para enviar por WhatsApp o email.",
  },
  {
    title: "Tu cliente deposita",
    body: "Entra con su email o Google y deposita USDC. El dinero queda bloqueado en un contrato en la red Base.",
  },
  {
    title: "Entregas y cobras",
    body: "Subes cada entregable; tu cliente lo aprueba y el pago te llega al instante, hito por hito.",
  },
];

export default function HomePage() {
  const total = SAMPLE.reduce((sum, m) => sum + BigInt(m.amount), 0n);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="grid items-center gap-12 py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:py-24">
        <div className="max-w-xl">
          <h1 className="text-4xl leading-[1.05] font-extrabold sm:text-6xl">Cobra por hitos con el dinero ya depositado.</h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Envía un link de cobro. Tu cliente deposita en garantía, tú trabajas sabiendo que el pago existe y lo recibes
            cada vez que entregas. Nadie, ni siquiera nosotros, puede quedarse con ese dinero.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-11 px-5 text-base">
              <Link href="/dashboard/new">Crear link de cobro</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-5 text-base">
              <Link href="/dashboard">Ver mis acuerdos</Link>
            </Button>
          </div>
        </div>

        <figure aria-label="Ejemplo de un link de cobro" className="rounded-2xl border bg-card p-5 shadow-[0_1px_0_var(--border),0_24px_48px_-24px_rgb(20_33_61/0.25)] sm:p-7">
          <p className="text-sm text-muted-foreground">Estudio Pampa te envió un acuerdo de pago</p>
          <p className="mt-1 font-heading text-2xl font-bold">Rediseño de tienda online</p>
          <p className="amount mt-4 font-heading text-4xl font-bold">
            {formatUsdc(total)} <span className="text-lg font-medium text-muted-foreground">USDC</span>
          </p>
          <AmountBar className="mt-5" segments={SAMPLE} />
          <ul className="mt-6 divide-y border-t">
            {SAMPLE.map((m) => (
              <li key={m.title} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.title}</p>
                  <MilestoneStatusBadge status={m.status} />
                </div>
                <p className="amount font-semibold">{formatUsdc(m.amount)}</p>
              </li>
            ))}
          </ul>
        </figure>
      </section>

      <section aria-labelledby="how-heading" className="border-t py-16">
        <h2 id="how-heading" className="text-3xl font-bold">
          Cómo funciona
        </h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="amount font-heading text-5xl font-extrabold text-vault/25" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="mt-2 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="trust-heading" className="grid gap-10 border-t py-16 lg:grid-cols-[1fr_1.4fr]">
        <h2 id="trust-heading" className="text-3xl font-bold">
          El dinero nunca pasa por nuestras cuentas
        </h2>
        <dl className="grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Contrato inteligente auditable</dt>
            <dd className="mt-1 text-muted-foreground">Cada depósito y cada pago tiene un recibo público en Basescan.</dd>
          </div>
          <div>
            <dt className="font-semibold">Reembolso sin comisión</dt>
            <dd className="mt-1 text-muted-foreground">Si un hito se cancela, el cliente recupera el 100%.</dd>
          </div>
          <div>
            <dt className="font-semibold">Disputas con árbitro</dt>
            <dd className="mt-1 text-muted-foreground">
              Un hito en disputa se congela y lo reparte un árbitro multisig, que nunca puede quedarse con los fondos.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Sin gas ni seed phrases</dt>
            <dd className="mt-1 text-muted-foreground">Entras con email o Google y confirmas los pagos con tu huella.</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
