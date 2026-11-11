import { BrandMark } from "@/components/brand";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <BrandMark className="h-4 w-5" />
          <span>© {new Date().getFullYear()} extan</span>
        </div>
        <p className="max-w-md sm:text-right">
          El dinero queda en un contrato público en la red Base. extan nunca lo custodia ni puede moverlo por su cuenta.
        </p>
      </div>
    </footer>
  );
}
