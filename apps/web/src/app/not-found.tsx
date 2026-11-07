import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">No encontramos esta página</h1>
      <p className="mt-3 text-muted-foreground">
        Si te enviaron un link de pago, revisa que esté completo o pide a quien te cobra que lo comparta de nuevo.
      </p>
      <Button asChild size="lg" className="mt-8 h-10 px-5">
        <Link href="/">Ir al inicio</Link>
      </Button>
    </div>
  );
}
