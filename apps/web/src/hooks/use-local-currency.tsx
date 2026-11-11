"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { detectLocalCurrency, formatLocalAmount, isLocalCurrency, type LocalCurrencyCode, type RatesResponse } from "@/lib/currency";
import { apiFetch } from "./use-api";

const STORAGE_KEY = "extan:currency";
const NONE = "none";

interface LocalCurrencyState {
  currency: LocalCurrencyCode | null;
  setCurrency: (code: LocalCurrencyCode | null) => void;
  rate: number | null;
  rates: RatesResponse | undefined;
}

const LocalCurrencyContext = createContext<LocalCurrencyState | null>(null);

function readStored(): LocalCurrencyCode | typeof NONE | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === NONE || isLocalCurrency(value) ? value : null;
  } catch {
    return null;
  }
}

/** Moneda de referencia del visitante: detectada por idioma o zona horaria, y elegible a mano (se recuerda). */
export function LocalCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<LocalCurrencyCode | null>(null);

  useEffect(() => {
    const stored = readStored();
    setCurrencyState(stored === NONE ? null : (stored ?? detectLocalCurrency()));
  }, []);

  const setCurrency = useCallback((code: LocalCurrencyCode | null) => {
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code ?? NONE);
    } catch {
      // Sin almacenamiento: la elección dura lo que dure la pestaña.
    }
  }, []);

  const { data: rates } = useQuery({
    queryKey: ["rates"],
    queryFn: () => apiFetch<RatesResponse>("/api/rates"),
    enabled: currency !== null,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const value = useMemo<LocalCurrencyState>(
    () => ({ currency, setCurrency, rate: currency ? (rates?.rates[currency] ?? null) : null, rates }),
    [currency, rates, setCurrency],
  );

  return <LocalCurrencyContext.Provider value={value}>{children}</LocalCurrencyContext.Provider>;
}

export function useLocalCurrency(): LocalCurrencyState {
  const context = useContext(LocalCurrencyContext);
  if (!context) throw new Error("useLocalCurrency requiere LocalCurrencyProvider");
  return context;
}

/** Equivalente local de un monto en unidades base de USDC, o `null` si no hay moneda elegida o tipo de cambio. */
export function useLocalAmount(amount: bigint | string | null | undefined): string | null {
  const { currency, rate } = useLocalCurrency();
  if (amount === null || amount === undefined || !currency || !rate) return null;
  return formatLocalAmount(amount, currency, rate);
}
