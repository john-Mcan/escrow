"use client";

import { usePrivy } from "@privy-io/react-auth";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "@/components/auth/user-menu";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const { authenticated } = usePrivy();
  const { data: me } = useMe();
  // En el link de pago el cliente solo tiene una tarea: se oculta la navegación del proveedor.
  const focused = pathname.startsWith("/pay/");
  const links = [
    { href: "/dashboard", label: "Mis acuerdos" },
    ...(me?.isArbitrationAdmin ? [{ href: "/arbitration", label: "Arbitraje" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Brand />
          {!focused && authenticated && (
            <nav className="hidden items-center gap-1 sm:flex" aria-label="Principal">
              {links.map((link) => {
                const active = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                      "after:absolute after:inset-x-3 after:-bottom-[13px] after:h-px after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 hover:after:scale-x-100",
                      active && "text-foreground after:scale-x-100",
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!focused && authenticated && pathname !== "/dashboard/new" && (
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/dashboard/new">
                <PlusIcon /> Crear link
              </Link>
            </Button>
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
