import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";
import { ApiClientError } from "@/hooks/use-api";
import { InsufficientBalanceError } from "@/hooks/use-escrow-transactions";

/** Errores personalizados de MilestoneEscrow.sol traducidos a lenguaje de usuario. */
const CONTRACT_ERRORS: Record<string, string> = {
  EnforcedPause: "Los depósitos nuevos están pausados temporalmente. Los fondos existentes no se ven afectados.",
  EscrowAmountExceedsMax: "El total supera el máximo permitido por acuerdo.",
  TokenNotAllowed: "Este token no está habilitado para depósitos.",
  InvalidPayee: "La wallet del proveedor no es válida para este acuerdo.",
  PayerCannotBeArbiter: "Esta wallet no puede depositar en el acuerdo.",
  InvalidMilestoneStatus: "El hito cambió de estado. Recarga la página.",
  CallerNotPayer: "Solo la wallet que depositó puede liberar este hito.",
  CallerNotPayee: "Solo la wallet del proveedor puede reembolsar este hito.",
  CallerNotParticipant: "Solo el cliente o el proveedor pueden abrir una disputa.",
  CallerNotArbiter: "Solo el árbitro de este acuerdo puede resolver la disputa.",
  ERC20InsufficientAllowance: "Falta autorizar el gasto de USDC. Intenta de nuevo.",
  ERC20InsufficientBalance: "No tienes saldo suficiente de USDC.",
};

export function describeTxError(error: unknown): string {
  if (error instanceof InsufficientBalanceError || error instanceof ApiClientError) return error.message;

  if (error instanceof BaseError) {
    if (error.walk((e) => e instanceof UserRejectedRequestError))
      return "Cancelaste la confirmación. No se movió dinero.";
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) {
      return CONTRACT_ERRORS[revert.data.errorName] ?? `El contrato rechazó la operación (${revert.data.errorName}).`;
    }
    return error.shortMessage;
  }

  if (error instanceof Error) {
    if (/reject|denied|cancel|closed|exited/i.test(error.message))
      return "Cancelaste la operación. No se movió dinero.";
    return error.message;
  }
  return "Ocurrió un error inesperado. Intenta de nuevo.";
}

/** Etiqueta corta de cada etapa, para botones y avisos de avance. */
export const TX_STEP_LABELS = {
  idle: "",
  preparing: "Preparando…",
  authorizing: "Autoriza el monto…",
  signing: "Confirma en la ventana…",
  confirming: "Confirmando en la red…",
  syncing: "Actualizando el acuerdo…",
} as const;
