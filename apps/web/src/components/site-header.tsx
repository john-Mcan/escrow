"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "@/components/auth/user-menu";
import { Brand } from "@/components/brand";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const { data: me } = useMe();
  const links = [
    { href: "/dashboard", label: "Mis cobros" },
    ...(me?.isArbitrationAdmin ? [{ href: "/arbitration", label: "Arbitraje" }] : []),
  ];

  return (
    <header className="border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Brand />
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Principal">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  pathname.startsWith(link.href) && "text-foreground font-medium",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
