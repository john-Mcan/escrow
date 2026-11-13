import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { publicEnv } from "@/lib/env";
import { figtree } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: { default: "extan | Pagos por hitos garantizados en blockchain", template: "%s | extan" },
  description:
    "Crea un link de cobro por hitos. Tu cliente deposita en garantía y recibes cada pago al entregar. El dinero nunca pasa por nuestras manos.",
  applicationName: "extan",
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={figtree.variable}>
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <Toaster position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
