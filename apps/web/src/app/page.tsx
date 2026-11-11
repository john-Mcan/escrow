import { ArrowDownIcon } from "lucide-react";
import Link from "next/link";
import { Disclosure } from "@/components/disclosure";
import { MilestoneNode } from "@/components/escrow/milestone-track";
import { HeroDemo } from "@/components/landing/hero-demo";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    status: "pending",
    title: "Creas el link",
    body: "Divides el trabajo en hitos con su monto. Lo compartes por WhatsApp o email en menos de un minuto.",
  },
  {
    status: "funded",
    title: "Tu cliente deposita",
    body: "Entra con su email y deposita el total una sola vez. El dinero queda en garantía: existe, pero nadie puede tocarlo.",
  },
  {
    status: "released",
    title: "Entregas y cobras",
    body: "Envías cada entrega, tu cliente la aprueba y ese pago te llega al momento. Hito por hito.",
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
          <h1 className="t-display">Cobra por hitos con el pago ya asegurado.</h1>
          <p className="mt-7 t-lead sm:text-xl sm:leading-relaxed">
            Crea un link en segundos. Tu cliente deposita una vez, el dinero queda en garantía y recibes cada parte al
            entregar. Nadie, ni siquiera nosotros, puede quedarse con ese dinero.
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
          <p className="t-lead">Tres pasos, y tu cliente no necesita saber nada de cripto.</p>
        </div>
        <ol className="mt-14 grid gap-12 sm:grid-cols-3 sm:gap-10">
          {STEPS.map((step) => (
            <li key={step.title} className="space-y-4">
              <MilestoneNode status={step.status} className="origin-left scale-125" />
              <h3 className="pt-2 text-xl">{step.title}</h3>
              <p className="text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
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
