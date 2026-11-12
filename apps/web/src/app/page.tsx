import { ArrowDownIcon, GlobeIcon, HandshakeIcon, HardHatIcon, LayersIcon } from "lucide-react";
import Link from "next/link";
import { Disclosure } from "@/components/disclosure";
import { MilestoneNode } from "@/components/escrow/milestone-track";
import { CurrencyFlow } from "@/components/landing/currency-flow";
import { HeroDemo } from "@/components/landing/hero-demo";
import { Rise, SpotlightCard } from "@/components/motion";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    status: "pending",
    title: "Creas el link",
    body: "Divides el trabajo en hitos: etapas con su entrega y su monto. Lo compartes por WhatsApp o email en menos de un minuto.",
  },
  {
    status: "funded",
    title: "Tu cliente paga el trabajo",
    body: "Entra con su email y paga el total una sola vez, con transferencia o tarjeta. El dinero queda en garantía: existe, pero nadie puede tocarlo.",
  },
  {
    status: "released",
    title: "Entregas y cobras",
    body: "Envías cada entrega, tu cliente la aprueba y ese pago te llega al momento. Hito por hito.",
  },
] as const;

const USE_CASES = [
  {
    icon: GlobeIcon,
    title: "Freelancers con clientes en otros países",
    body: "Diseño, desarrollo, traducción o marketing. Tu cliente paga en su moneda y tú cobras en dólares digitales, sin esperar una transferencia internacional.",
    example: "Ej.: sitio web en 3 hitos",
  },
  {
    icon: LayersIcon,
    title: "Agencias y estudios con proyectos largos",
    body: "Divide un proyecto de meses en etapas. Cada entrega aprobada es un pago y dejas de financiar el trabajo de tu cliente.",
    example: "Ej.: branding y lanzamiento en 4 hitos",
  },
  {
    icon: HardHatIcon,
    title: "Obras y servicios que avanzan por etapas",
    body: "Tu cliente deposita al empezar y libera cada pago según el avance. Tú sabes que el dinero existe antes de comprar materiales.",
    example: "Ej.: remodelación en 3 hitos",
  },
  {
    icon: HandshakeIcon,
    title: "Compraventas entre desconocidos",
    body: "Con un solo hito: quien compra deposita, quien vende envía y el pago se libera cuando el producto llega como se acordó.",
    example: "Ej.: equipo usado en 1 hito",
  },
] as const;

const PROMISES = [
  {
    title: "El dinero no pasa por nuestras manos",
    body: "Queda en un contrato público que solo puede pagarte a ti o devolverlo a tu cliente. extan no puede moverlo.",
  },
  {
    title: "Reembolso completo",
    body: "Si un hito se cancela, tu cliente recupera el 100% de ese monto, sin comisiones.",
  },
  {
    title: "Desacuerdos con árbitro",
    body: "Si algo sale mal, el hito se congela y un árbitro independiente revisa lo que cuenta cada parte.",
  },
  {
    title: "Entras con tu email",
    body: "Sin claves raras ni frases de recuperación. Tu cuenta se crea al ingresar y puedes confirmar los pagos con tu huella.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="grid items-center gap-14 py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-20 lg:py-28">
        <div className="max-w-xl">
          <h1 className="text-[clamp(2.5rem,1.3rem+3.4vw,3.875rem)] leading-[1.02] tracking-[-0.045em]">
            Tu cliente deposita al empezar. <span className="text-muted-foreground">Tú cobras al entregar.</span>
          </h1>
          <p className="mt-7 t-lead sm:text-xl sm:leading-relaxed">
            Para freelancers, agencias y trabajos por encargo. Creas un link de cobro, tu cliente paga en su moneda y
            liberan los fondos según su acuerdo. Nadie, ni siquiera nosotros, puede quedarse con él.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button asChild size="xl">
              <Link href="/dashboard/new">Crear link de cobro</Link>
            </Button>
            <Button asChild size="xl" variant="ghost" className="group/how">
              <a href="#como-funciona">
                Cómo funciona
                <ArrowDownIcon className="transition-transform duration-200 group-hover/how:translate-y-0.5" />
              </a>
            </Button>
          </div>
          <p className="mt-6 text-sm text-subtle">Sin mensualidad. Pagas una pequeña comisión solo cuando cobras.</p>
        </div>
        <HeroDemo />
      </section>

      <section id="como-funciona" aria-labelledby="how-heading" className="scroll-mt-24 border-t border-border py-20 lg:py-24">
        <div className="max-w-2xl space-y-3">
          <h2 id="how-heading" className="text-[2rem] tracking-[-0.03em] sm:text-[2.5rem]">
            Cómo funciona
          </h2>
          <p className="t-lead">Tres pasos. Tu cliente paga en su moneda y no necesita saber nada de cripto.</p>
        </div>
        <ol className="mt-14 grid gap-12 sm:grid-cols-3 sm:gap-10">
          {STEPS.map((step, index) => (
            <Rise as="li" key={step.title} delay={index * 90} className="space-y-4">
              <MilestoneNode status={step.status} className="origin-left scale-125" />
              <h3 className="pt-2 text-xl">{step.title}</h3>
              <p className="text-muted-foreground">{step.body}</p>
            </Rise>
          ))}
        </ol>
      </section>

      <section aria-labelledby="currency-heading" className="border-t border-border py-20 lg:py-24">
        <div className="max-w-2xl space-y-3">
          <h2 id="currency-heading" className="text-[2rem] tracking-[-0.03em] sm:text-[2.5rem]">
            Tu cliente paga en su moneda y tú cobras en dólares
          </h2>
          <p className="t-lead">Así viaja un pago de ejemplo, con el equivalente en tu moneda según el tipo de cambio de hoy.</p>
        </div>
        <Rise className="mt-14">
          <CurrencyFlow />
        </Rise>
      </section>

      <section aria-labelledby="cases-heading" className="border-t border-border py-20 lg:py-24">
        <div className="max-w-2xl space-y-3">
          <h2 id="cases-heading" className="text-[2rem] tracking-[-0.03em] sm:text-[2.5rem]">
            Para trabajos que se pagan por partes
          </h2>
          <p className="t-lead">
            Cuando las partes no se conocen, nadie quiere pagar ni trabajar primero. Con extan, ninguno tiene que
            arriesgarse.
          </p>
        </div>
        <ul className="mt-14 grid gap-4 sm:grid-cols-2">
          {USE_CASES.map((useCase, index) => {
            const Icon = useCase.icon;
            return (
              <Rise as="li" key={useCase.title} delay={(index % 2) * 90}>
                <SpotlightCard
                  className="h-full rounded-3xl border border-border bg-surface surface-edge"
                  contentClassName="flex flex-col gap-4 p-6 sm:p-8"
                >
                  <span className="grid size-10 place-items-center rounded-xl border border-line-strong bg-raised text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="pt-1 text-xl">{useCase.title}</h3>
                  <p className="flex-1 text-muted-foreground">{useCase.body}</p>
                  <p className="t-meta">{useCase.example}</p>
                </SpotlightCard>
              </Rise>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="trust-heading" className="grid gap-12 border-t border-border py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20 lg:py-24">
        <div className="space-y-3">
          <h2 id="trust-heading" className="text-[2rem] tracking-[-0.03em] sm:text-[2.5rem]">
            Seguro para los dos lados
          </h2>
          <p className="t-lead">Quien cobra sabe que el pago existe. Quien paga sabe que no lo pierde si algo sale mal.</p>
        </div>
        <div className="space-y-10">
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {PROMISES.map((item) => (
              <div key={item.title} className="space-y-2">
                <dt className="font-semibold">{item.title}</dt>
                <dd className="text-muted-foreground">{item.body}</dd>
              </div>
            ))}
          </dl>
          <div className="border-t border-border pt-4">
            <Disclosure summary="Cómo funciona por dentro">
              <p className="max-w-prose text-muted-foreground">
                Los pagos se hacen en USDC, un dólar digital emitido por Circle (1 USDC = 1 US$), sobre la red Base. El
                dinero queda en un contrato inteligente público y verificable: cada depósito, pago y reembolso tiene un
                comprobante en Basescan. Las disputas las resuelve un árbitro que firma con una cuenta multifirma y que
                nunca puede quedarse con los fondos.
              </p>
            </Disclosure>
          </div>
        </div>
      </section>

      <section className="flex flex-col items-start gap-6 border-t border-border py-20 sm:flex-row sm:items-center sm:justify-between lg:py-24">
        <h2 className="max-w-lg text-[2rem] tracking-[-0.03em]">Crea tu primer link en menos de un minuto.</h2>
        <Button asChild size="xl">
          <Link href="/dashboard/new">Crear link de cobro</Link>
        </Button>
      </section>
    </div>
  );
}
