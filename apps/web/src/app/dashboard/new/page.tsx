import type { Metadata } from "next";
import { SignInGate } from "@/components/auth/sign-in-gate";
import { CreateEscrowForm } from "@/components/escrow/create-escrow-form";

export const metadata: Metadata = { title: "Nuevo link de cobro" };

export default function NewEscrowPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <SignInGate title="Crea tu link de cobro" description="Ingresa con tu email o Google. Creamos tu wallet automáticamente.">
        <CreateEscrowForm />
      </SignInGate>
    </div>
  );
}
