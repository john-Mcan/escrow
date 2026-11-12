"use client";

import { useEffect } from "react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { figtree } from "@/lib/fonts";
import "./globals.css";

/**
 * Último recurso: falló el layout raíz, así que esta página reemplaza todo el documento, sin header ni proveedores.
 * Los botones recargan la página completa: la aplicación quedó en un estado del que no conviene confiar.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es" className={figtree.variable}>
      <head>
        <title>Algo salió mal | extan</title>
      </head>
      <body className="grid min-h-dvh place-items-center">
        <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
          <BrandMark className="h-10 w-[3.125rem]" />
          <h1 className="mt-10">Algo salió mal</h1>
          <p className="mt-3 t-lead">
            extan no pudo cargar. Los fondos en garantía no se ven afectados: están en el contrato, no aquí.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={() => window.location.reload()}>
              Recargar
            </Button>
            <Button asChild size="lg" variant="outline">
              {/* Navegación completa, sin el router de Next. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/">Ir al inicio</a>
            </Button>
          </div>
          {error.digest && <p className="mt-6 text-sm text-subtle">Código del error: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
