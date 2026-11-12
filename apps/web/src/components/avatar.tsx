import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
} as const;

/**
 * Corrección óptica por letra de Figtree 600, en em: `[x, y]`. Centrar la caja de la letra no basta (la J, con su
 * peso a la derecha, parece corrida aunque su caja esté al centro), así que cada letra se mueve hacia un punto entre
 * el centro de su caja y su centro de masa: 75% masa en horizontal y 25% en vertical. Medido en el navegador sobre
 * los píxeles de cada glifo; las letras que no aparecen ya quedan centradas (< 0,004 em).
 */
const OPTICAL_OFFSET: Record<string, [number, number]> = {
  A: [0.001, -0.01], C: [0.025, -0.002], D: [0.005, -0.002], E: [0.029, -0.002], F: [0.027, 0.016],
  G: [0.002, -0.005], J: [-0.037, -0.026], K: [0.017, -0.001], L: [0.038, -0.024], M: [0.001, 0.007],
  P: [0.007, 0.015], Q: [-0.013, -0.019], R: [0.005, 0.004], S: [-0.004, -0.003], T: [0.001, 0.025],
  U: [0.001, -0.014], Y: [0.001, 0.015], "1": [-0.012, 0.009], "3": [-0.032, -0.002], "4": [-0.012, -0.005],
  "5": [-0.007, -0.005], "6": [0.007, -0.005], "7": [-0.012, 0.02], "9": [-0.005, 0.002],
};

/**
 * Inicial de una persona en un círculo, centrada ópticamente. `text-box` recorta la caja del texto a la altura de
 * las mayúsculas (Figtree tiene más espacio arriba que abajo) y `OPTICAL_OFFSET` compensa la forma de cada letra.
 * Las letras con tilde usan la corrección de su letra base: el acento sobresale, pero el cuerpo queda centrado.
 */
export function Avatar({ name, size = "md", className }: { name: string; size?: keyof typeof SIZES; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const base = initial.normalize("NFD").charAt(0);
  const [x, y] = OPTICAL_OFFSET[base] ?? [0, 0];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-line-strong bg-raised leading-none font-semibold select-none",
        SIZES[size],
        className,
      )}
    >
      <span className="[text-box:trim-both_cap_alphabetic]" style={x || y ? { transform: `translate(${x}em, ${y}em)` } : undefined}>
        {initial}
      </span>
    </span>
  );
}
