import { cn } from "cn"

/** Bloque de carga: un brillo tenue lo recorre para indicar que el contenido viene en camino. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-[10px] bg-raised before:absolute before:inset-0 before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/[0.05] before:to-transparent",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
