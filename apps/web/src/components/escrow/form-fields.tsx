"use client";

import { CalendarIcon, PlusIcon, XIcon } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { Reveal, ShineBorder } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";

/** Grupo de campos en una superficie propia: un título, una línea que explica para qué sirve y los campos. */
export function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const id = `panel-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="space-y-6 rounded-2xl border border-border bg-surface p-6 surface-edge sm:p-8">
      <div className="space-y-1">
        <h2 id={id}>{title}</h2>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Campo con su etiqueta, el brillo de foco de la marca y, debajo, el error o una ayuda. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="group/field relative rounded-[10px]">
        {children}
        <ShineBorder className="opacity-0 transition-opacity duration-200 group-focus-within/field:opacity-100" />
      </div>
      {error ? (
        <Reveal>
          <p className="text-sm text-destructive">{error}</p>
        </Reveal>
      ) : hint ? (
        <div className="text-sm text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

/** Botón discreto que revela un campo opcional. */
export function AddOptional({ onClick, children, icon }: { onClick: () => void; children: ReactNode; icon?: ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={onClick}>
      {icon ?? <PlusIcon />} {children}
    </Button>
  );
}

/** Hoy en la zona del navegador, como `YYYY-MM-DD` (el mínimo del calendario). */
function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * Fecha de entrega como acción secundaria: un botón que muestra la fecha ya escrita ("17 nov 2026") y abre el
 * calendario del sistema. El `<input type="date">` queda oculto bajo el botón para que el calendario se ancle ahí.
 */
export function DueDatePicker({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

  return (
    <div className="relative inline-flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={openPicker}
        className={value ? "text-foreground" : "text-muted-foreground hover:text-foreground"}
      >
        <CalendarIcon />
        {value ? (
          <span>
            Entrega estimada: <span className="font-medium">{formatDate(value)}</span>
          </span>
        ) : (
          "Fecha de entrega"
        )}
      </Button>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onChange("")}
          aria-label="Quitar la fecha de entrega"
        >
          <XIcon />
        </Button>
      )}
      <input
        ref={inputRef}
        id={id}
        type="date"
        min={todayIso()}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-3 size-px opacity-0 [color-scheme:dark]"
      />
    </div>
  );
}
