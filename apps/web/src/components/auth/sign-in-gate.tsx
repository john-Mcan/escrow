"use client";

import { usePrivy } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Muestra `children` solo con sesión iniciada; si no, una invitación a ingresar. */
export function SignInGate({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const { ready, authenticated, login } = usePrivy();

  if (!ready) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (!authenticated) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
        <Button size="lg" className="mt-6 h-10 px-5" onClick={() => login()}>
          Ingresar con email, Google o wallet
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
