import { formatUnits, parseUnits } from "viem";
import { BPS_DENOMINATOR, USDC_DECIMALS } from "./constants";

/** Montos ingresados por usuarios: sin separador de miles, decimal con punto o coma, hasta 6 decimales. */
export const USDC_INPUT_PATTERN = /^\d{1,9}(?:[.,]\d{1,6})?$/;

const groupFormatter = new Intl.NumberFormat("es-419", { useGrouping: true });

/** "1500,5" -> 1_500_500_000n. Lanza si el formato no es válido. */
export function parseUsdc(input: string): bigint {
  const normalized = input.trim();
  if (!USDC_INPUT_PATTERN.test(normalized)) {
    throw new Error(`Monto USDC inválido: "${input}"`);
  }
  return parseUnits(normalized.replace(",", "."), USDC_DECIMALS);
}

/**
 * 1_500_500_000n -> "1,500.50". Formatea sobre strings (sin pasar por Number) para no perder precisión.
 * Muestra al menos 2 decimales y hasta 6 si el monto los tiene.
 */
export function formatUsdc(amount: bigint | string): string {
  const value = typeof amount === "string" ? BigInt(amount) : amount;
  const negative = value < 0n;
  const [integerPart = "0", fractionPart = ""] = formatUnits(negative ? -value : value, USDC_DECIMALS).split(".");
  const fraction = fractionPart.replace(/0+$/, "").padEnd(2, "0");
  return `${negative ? "-" : ""}${groupFormatter.format(BigInt(integerPart))}.${fraction}`;
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
  return `${(bps / 100).toLocaleString("es-419", { maximumFractionDigits: 2 })}%`;
}
