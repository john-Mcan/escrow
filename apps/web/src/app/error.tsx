"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { MilestoneNode } from "@/components/escrow/milestone-track";
import { Spinner } from "@/components/loaders";
import { Button } from "@/components/ui/button";

/** Error de render en cualquier página: el header y el footer siguen en pie. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  // `refresh` vuelve a pedir los Server Components; `reset` vuelve a montar la página.
  const retry = () =>
    startRetry(() => {
      router.refresh();
      reset();
    });

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-28 text-center">
      <MilestoneNode status="disputed" className="scale-[1.75]" />
      <h1 className="mt-10">Algo salió mal</h1>
      <p className="mt-3 t-lead">
        No pudimos mostrar esta página. Los fondos en garantía no se ven afectados: están en el contrato, no aquí.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={retry} disabled={retrying}>
          {retrying && <Spinner />}
          Reintentar
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
      {error.digest && <p className="mt-6 text-sm text-subtle">Código del error: {error.digest}</p>}
    </div>
  );
}
