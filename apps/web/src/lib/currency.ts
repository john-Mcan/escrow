/** Monedas de referencia para mostrar el equivalente local de un monto en USDC. Solo informativo. */
export const LOCAL_CURRENCIES = {
  CLP: { name: "Peso chileno", locale: "es-CL", digits: 0 },
  MXN: { name: "Peso mexicano", locale: "es-MX", digits: 2 },
  COP: { name: "Peso colombiano", locale: "es-CO", digits: 0 },
  PEN: { name: "Sol peruano", locale: "es-PE", digits: 2 },
  ARS: { name: "Peso argentino", locale: "es-AR", digits: 0 },
  UYU: { name: "Peso uruguayo", locale: "es-UY", digits: 0 },
  BRL: { name: "Real brasileño", locale: "pt-BR", digits: 2 },
  USD: { name: "Dólar estadounidense", locale: "en-US", digits: 2 },
  EUR: { name: "Euro", locale: "es-ES", digits: 2 },
} as const;

export type LocalCurrencyCode = keyof typeof LOCAL_CURRENCIES;

export const LOCAL_CURRENCY_CODES = Object.keys(LOCAL_CURRENCIES) as LocalCurrencyCode[];

export function isLocalCurrency(value: unknown): value is LocalCurrencyCode {
  return typeof value === "string" && value in LOCAL_CURRENCIES;
}

export interface RatesResponse {
  /** Unidades de cada moneda por 1 USDC. */
  rates: Partial<Record<LocalCurrencyCode, number>>;
  source: string;
  fetchedAt: string;
}

const REGION_CURRENCY: Record<string, LocalCurrencyCode> = {
  CL: "CLP",
  MX: "MXN",
  CO: "COP",
  PE: "PEN",
  AR: "ARS",
  UY: "UYU",
  BR: "BRL",
  ES: "EUR",
};

const TIMEZONE_CURRENCY: [RegExp, LocalCurrencyCode][] = [
  [/^America\/(Santiago|Punta_Arenas)$|^Chile\//, "CLP"],
  [
    /^America\/(Mexico_City|Monterrey|Merida|Cancun|Chihuahua|Hermosillo|Mazatlan|Tijuana|Bahia_Banderas|Matamoros|Ojinaga)$/,
    "MXN",
  ],
  [/^America\/Bogota$/, "COP"],
  [/^America\/Lima$/, "PEN"],
  [/^America\/(Argentina\/|Buenos_Aires$)/, "ARS"],
  [/^America\/Montevideo$/, "UYU"],
  [/^America\/(Sao_Paulo|Fortaleza|Recife|Bahia|Belem|Manaus|Cuiaba|Porto_Velho|Maceio|Araguaina)$/, "BRL"],
];

/** Moneda probable del visitante: primero la región del idioma del navegador, después su zona horaria. */
export function detectLocalCurrency(): LocalCurrencyCode | null {
  if (typeof navigator !== "undefined") {
    for (const language of navigator.languages ?? [navigator.language]) {
      const region = language.split("-")[1]?.toUpperCase();
      if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
    }
  }
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    for (const [pattern, code] of TIMEZONE_CURRENCY) if (pattern.test(zone)) return code;
  } catch {
    // Sin zona horaria disponible: no se adivina.
  }
  return null;
}

/** `amount` en unidades base de USDC (6 decimales). Devuelve p. ej. "$141.300 CLP". */
export function formatLocalAmount(amount: bigint | string, code: LocalCurrencyCode, rate: number): string {
  const { locale, digits } = LOCAL_CURRENCIES[code];
  const value = (Number(BigInt(amount)) / 1_000_000) * rate;
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return `${formatted} ${code}`;
}
