import { type Hex, pad } from "viem";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BYTES32_UUID_PATTERN = /^0x0{32}[0-9a-f]{32}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * UUID del escrow en Supabase -> `referenceId` (bytes32) del evento EscrowCreated.
 * Los 16 bytes del UUID se alinean a la derecha (equivale a `bytes32(uint256(uuid))` en Solidity).
 */
export function uuidToBytes32(uuid: string): Hex {
  if (!isUuid(uuid)) throw new Error(`UUID inválido: "${uuid}"`);
  return pad(`0x${uuid.replace(/-/g, "").toLowerCase()}`, { size: 32 });
}

/** Inversa de {@link uuidToBytes32}. Devuelve null si el bytes32 no codifica un UUID. */
export function bytes32ToUuid(reference: Hex): string | null {
  if (!BYTES32_UUID_PATTERN.test(reference)) return null;
  const hex = reference.slice(-32).toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
