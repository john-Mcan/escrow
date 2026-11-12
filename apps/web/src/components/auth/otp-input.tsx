"use client";

import { type Ref, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Código de N dígitos con casillas. Debajo hay un único `<input>` transparente que recibe el teclado, el pegado y el
 * autocompletado del sistema (`one-time-code`); las casillas solo dibujan su valor.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  invalid,
  errorCount = 0,
  inputRef,
  "aria-describedby": describedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  /** Sube con cada código rechazado: dispara la sacudida aunque el error anterior siga visible. */
  errorCount?: number;
  inputRef?: Ref<HTMLInputElement>;
  "aria-describedby"?: string;
}) {
  const [focused, setFocused] = useState(false);
  const boxesRef = useRef<HTMLDivElement>(null);
  const active = Math.min(value.length, length - 1);

  // Un código incorrecto: un "no" breve con la cabeza.
  useEffect(() => {
    if (!errorCount || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    boxesRef.current?.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(5px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }],
      { duration: 360, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
  }, [errorCount]);

  return (
    <div ref={boxesRef} className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        disabled={disabled}
        aria-label={`Código de ${length} dígitos`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="absolute inset-0 z-10 w-full cursor-text text-base text-transparent caret-transparent opacity-0 outline-none selection:bg-transparent disabled:cursor-not-allowed"
      />
      <div aria-hidden="true" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
        {Array.from({ length }, (_, index) => {
          const digit = value[index];
          const current = focused && !disabled && index === active && value.length < length + 1;
          return (
            <div
              key={index}
              className={cn(
                "relative grid h-14 place-items-center rounded-xl border bg-[#101214] text-2xl font-semibold amount transition-[border-color,box-shadow,opacity] duration-200",
                invalid ? "border-destructive/70" : current ? "border-primary/70 ring-4 ring-primary/10" : digit ? "border-line-strong" : "border-input",
                disabled && "opacity-60",
              )}
            >
              {digit ? (
                <span key={digit} className="motion-safe:animate-rise">
                  {digit}
                </span>
              ) : (
                current && <span className="h-6 w-px animate-caret-blink bg-primary" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
