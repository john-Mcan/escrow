import type { Metadata } from "next";
import { ArbitrationPanel } from "@/components/arbitration/arbitration-panel";
import { SignInGate } from "@/components/auth/sign-in-gate";

export const metadata: Metadata = { title: "Arbitraje", robots: { index: false, follow: false } };

export default function ArbitrationPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      <SignInGate title="Panel de arbitraje" description="Ingresa con la cuenta del equipo de arbitraje.">
        <ArbitrationPanel />
      </SignInGate>
    </div>
  );
}
