"use client";

import {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ElementType,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/** Recorta el interior de un borde con dos máscaras compuestas: queda solo el anillo de `padding`. */
const RING_MASK: CSSProperties = {
  mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  WebkitMaskComposite: "xor",
  maskComposite: "exclude",
};

/**
 * Recorrido táctil: un foco más chico que el del mouse, para que se lea como una luz que avanza, y más intenso,
 * porque no hay un cursor encima que lo acerque a la vista.
 */
const SWEEP = cn(
  "group-data-[sweep]/spot:animate-spot-sweep group-data-[sweep]/spot:[--spot-size:220px]",
  "group-data-[sweep]/spot:[--spot-edge:rgb(125_231_187/0.95)] group-data-[sweep]/spot:[--spot-glow:rgb(125_231_187/0.08)]",
);

/**
 * Superficie cuyo borde y brillo siguen al puntero. La posición se escribe como variable CSS (sin re-render). En
 * táctil no hay puntero que seguir: la luz recorre el borde superior de izquierda a derecha cada vez que la tarjeta
 * pasa por el centro de la pantalla.
 */
export function SpotlightCard({
  children,
  className,
  contentClassName,
  size = 360,
  as: Tag = "div",
  ...props
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  size?: number;
  as?: ElementType;
} & Omit<ComponentPropsWithoutRef<"div">, "children" | "className" | "style" | "onPointerMove">) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host || !window.matchMedia("(hover: none) and (prefers-reduced-motion: no-preference)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) host.dataset.sweep = "";
      },
      // Franja central del 20 % del alto: la tarjeta se ilumina cuando el dedo la trae al centro, no al asomarse.
      { rootMargin: "-40% 0px -40% 0px" },
    );
    const finish = (event: AnimationEvent) => {
      if (event.animationName === "spot-sweep") delete host.dataset.sweep;
    };
    observer.observe(host);
    host.addEventListener("animationend", finish);
    return () => {
      observer.disconnect();
      host.removeEventListener("animationend", finish);
    };
  }, []);

  function track(event: PointerEvent<HTMLElement>) {
    const host = ref.current;
    if (!host || event.pointerType !== "mouse") return;
    const rect = host.getBoundingClientRect();
    host.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    host.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  }

  return (
    <Tag
      {...props}
      ref={ref}
      onPointerMove={track}
      style={{ "--spot-size": `${size}px` } as CSSProperties}
      className={cn("group/spot relative", className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -inset-px rounded-[inherit] p-px opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100 motion-reduce:hidden",
          SWEEP,
          "group-data-[sweep]/spot:p-[1.5px]",
        )}
        style={{
          background:
            "radial-gradient(var(--spot-size) circle at var(--spot-x, 50%) var(--spot-y, 0%), var(--spot-edge), transparent 70%)",
          ...RING_MASK,
        }}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100 motion-reduce:hidden",
          SWEEP,
        )}
        style={{
          background:
            "radial-gradient(var(--spot-size) circle at var(--spot-x, 50%) var(--spot-y, 0%), var(--spot-glow), transparent 70%)",
        }}
      />
      <div className={cn("relative h-full", contentClassName)}>{children}</div>
    </Tag>
  );
}

/**
 * Una luz que recorre el borde del padre (que necesita `relative` y radio). Se usa en el campo con foco: indica
 * dónde se está escribiendo sin cambiar el tamaño del borde.
 */
export function ShineBorder({
  className,
  duration = 6,
  width = 1.5,
}: {
  className?: string;
  duration?: number;
  width?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] will-change-[background-position] motion-safe:animate-shine motion-reduce:hidden",
        className,
      )}
      style={
        {
          "--duration": `${duration}s`,
          padding: `${width}px`,
          backgroundImage: "radial-gradient(transparent, transparent, var(--primary), transparent, transparent)",
          backgroundSize: "300% 300%",
          ...RING_MASK,
        } as CSSProperties
      }
    />
  );
}

/**
 * Aparece una sola vez al entrar en pantalla (sube 10 px y gana opacidad). Sin JavaScript o con movimiento
 * reducido se muestra directamente: el estado oculto vive en un `@media (scripting: enabled)`.
 */
export function Rise<T extends ElementType = "div">({
  as,
  delay = 0,
  className,
  style,
  ...props
}: { as?: T; delay?: number } & Omit<ComponentPropsWithoutRef<T>, "as">) {
  const Tag: ElementType = as ?? "div";
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-rise=""
      data-shown={shown ? "" : undefined}
      className={className}
      style={delay ? { ...style, "--rise-delay": `${delay}ms` } : style}
      {...props}
    />
  );
}

/** Abre su propio espacio al aparecer (sin saltos de layout): para errores y bloques que se agregan. */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid animate-reveal motion-reduce:animate-none", className)}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
