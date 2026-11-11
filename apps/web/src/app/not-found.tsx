import Link from "next/link";
import { MilestoneNode } from "@/components/escrow/milestone-track";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-28 text-center">
      <MilestoneNode status="pending" className="scale-[1.75]" />
      <h1 className="mt-10">No encontramos esta página</h1>
      <p className="mt-3 t-lead">
        Si te enviaron un link de pago, revisa que esté completo o pide a quien te cobra que te lo comparta de nuevo.
      </p>
      <Button asChild size="lg" className="mt-8">
        <Link href="/">Ir al inicio</Link>
      </Button>
    </div>
  );
}
