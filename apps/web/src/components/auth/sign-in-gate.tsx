"use client";

import { usePrivy } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand";
import { ExtanLoader } from "@/components/loaders";
import { Button } from "@/components/ui/button";

/** Muestra `children` solo con sesión iniciada; si no, una invitación a ingresar. */
export function SignInGate({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const { ready, authenticated, login } = usePrivy();

  if (!ready) return <ExtanLoader className="py-24" label="Cargando tu cuenta" />;
  if (!authenticated) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
        <BrandMark className="h-10 w-[3.125rem]" />
        <h1 className="mt-8">{title}</h1>
        <p className="mt-3 t-lead">{description}</p>
        <Button size="xl" className="mt-8" onClick={() => login()}>
          Ingresar con tu email
        </Button>
        <p className="mt-4 text-sm text-subtle">También puedes usar Google o tu wallet. Si es tu primera vez, creamos tu cuenta.</p>
      </div>
    );
  }
  return <>{children}</>;
}
