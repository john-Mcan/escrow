"use client";

import { usePrivy } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { useSignIn } from "@/components/auth/sign-in";
import { BrandMark } from "@/components/brand";
import { ExtanLoader } from "@/components/loaders";
import { SpotlightCard } from "@/components/motion";
import { Button } from "@/components/ui/button";

/** Muestra `children` solo con sesión iniciada; si no, una invitación a ingresar. */
export function SignInGate({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { ready, authenticated } = usePrivy();
  const signIn = useSignIn();

  if (!ready) return <ExtanLoader className="py-24" label="Cargando tu cuenta" />;
  if (!authenticated) {
    return (
      <div className="mx-auto max-w-md py-12 sm:py-20">
        <SpotlightCard
          className="rounded-3xl border border-border bg-surface surface-edge motion-safe:animate-rise"
          contentClassName="flex flex-col items-center p-8 text-center sm:p-10"
        >
          <div className="flex flex-col items-center motion-safe:animate-rise">
            <BrandMark className="h-10 w-[3.125rem]" />
            <h1 className="mt-7">{title}</h1>
            <p className="mt-3 text-muted-foreground">{description}</p>
          </div>
          <div className="mt-8 flex w-full flex-col items-center motion-safe:animate-rise motion-safe:[animation-delay:90ms]">
            <Button size="xl" className="w-full" onClick={() => signIn()}>
              Ingresar con tu email
            </Button>
            <p className="mt-4 text-sm text-subtle">
              También puedes usar Google o tu wallet. Si es tu primera vez, creamos tu cuenta.
            </p>
          </div>
        </SpotlightCard>
      </div>
    );
  }
  return <>{children}</>;
}
