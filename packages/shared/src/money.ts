import { formatUnits, parseUnits } from "viem";
import { BPS_DENOMINATOR, USDC_DECIMALS } from "./constants";

/**
 * Formato chileno de los montos: punto para los miles y coma para los decimales ("2.500,50").
 *
 * Al escribir, el punto solo se acepta como separador de miles (en grupos de 3) y la coma como decimal, hasta 6
 * decimales. Así "2.500" es dos mil quinientos y no 2,5; lo que sería ambiguo ("2.5", "1500.50") se rechaza.
 */
export const USDC_INPUT_PATTERN = /^(?:\d{1,9}|\d{1,3}(?:\.\d{3}){1,2})(?:,\d{1,6})?$/;

export const USDC_INPUT_HINT = "Usa punto para los miles y coma para los decimales, p. ej. 2.500,50";

const groupFormatter = new Intl.NumberFormat("es-CL", { useGrouping: true });

/** "1.500,5" o "1500,5" -> 1_500_500_000n. Lanza si el formato no es válido. */
export function parseUsdc(input: string): bigint {
  const normalized = input.trim();
  if (!USDC_INPUT_PATTERN.test(normalized)) {
    throw new Error(`Monto USDC inválido: "${input}"`);
  }
  return parseUnits(normalized.replaceAll(".", "").replace(",", "."), USDC_DECIMALS);
}

/**
 * 1_500_500_000n -> "1.500,50". Formatea sobre strings (sin pasar por Number) para no perder precisión.
 * Muestra al menos 2 decimales y hasta 6 si el monto los tiene.
 */
export function formatUsdc(amount: bigint | string): string {
  const value = typeof amount === "string" ? BigInt(amount) : amount;
  const negative = value < 0n;
  const [integerPart = "0", fractionPart = ""] = formatUnits(negative ? -value : value, USDC_DECIMALS).split(".");
  const fraction = fractionPart.replace(/0+$/, "").padEnd(2, "0");
  return `${negative ? "-" : ""}${groupFormatter.format(BigInt(integerPart))},${fraction}`;
}

/** Reparto de un hito idéntico a `MilestoneEscrow._computeSplit` (mismos redondeos). */
export function computeSplit(amount: bigint, feeBps: number | bigint, payerShareBps: number | bigint = 0n) {
  const fee = BigInt(feeBps);
  const share = BigInt(payerShareBps);
  if (amount < 0n) throw new Error("amount debe ser >= 0");
  if (share < 0n || share > BPS_DENOMINATOR) throw new Error("payerShareBps fuera de rango");
  if (fee < 0n || fee > BPS_DENOMINATOR) throw new Error("feeBps fuera de rango");

  const payerAmount = (amount * share) / BPS_DENOMINATOR;
  const payeeGross = amount - payerAmount;
  const feeAmount = (payeeGross * fee) / BPS_DENOMINATOR;
  return { payerAmount, payeeAmount: payeeGross - feeAmount, fee: feeAmount };
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toLocaleString("es-CL", { maximumFractionDigits: 2 })}%`;
}
