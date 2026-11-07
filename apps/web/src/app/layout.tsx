import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: { default: "Hito | Cobros en garantía por hitos", template: "%s | Hito" },
  description:
    "Crea un link de cobro por hitos. Tu cliente deposita USDC en garantía y liberas cada pago al entregar. Sin custodia, sin gas.",
};

export const viewport: Viewport = {
  themeColor: "#f4f6f9",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${figtree.variable} ${bricolage.variable}`}>
      <body className="min-h-dvh">
        <Providers>
          <SiteHeader />
          <main>{children}</main>
          <Toaster position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
