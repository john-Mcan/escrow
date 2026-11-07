import { formatUsdc } from "@escrow/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CheckoutView } from "@/components/escrow/checkout-view";
import { getPublicCheckout } from "@/lib/server/escrows";

type Props = { params: Promise<{ escrowId: string }> };

const loadCheckout = cache((reference: string) => getPublicCheckout(reference));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { escrowId } = await params;
  const checkout = await loadCheckout(escrowId);
  if (!checkout) return { title: "Link de pago no encontrado" };
  const provider = checkout.provider_display_name ?? "Un proveedor";
  return {
    title: checkout.title,
    description: `${provider} te cobra ${formatUsdc(checkout.total_amount)} USDC en garantía, liberados por hitos.`,
    robots: { index: false, follow: false },
  };
}

export default async function PayPage({ params }: Props) {
  const { escrowId } = await params;
  const checkout = await loadCheckout(escrowId);
  if (!checkout) notFound();
  return <CheckoutView initial={checkout} />;
}
