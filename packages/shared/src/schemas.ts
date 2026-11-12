import type { Address, Hex } from "viem";
import { z } from "zod";
import { DEFAULT_MAX_ESCROW_AMOUNT, MAX_MILESTONES } from "./constants";
import { formatUsdc, parseUsdc, USDC_INPUT_HINT, USDC_INPUT_PATTERN } from "./money";

// -----------------------------------------------------------------------------
// Primitivas
// -----------------------------------------------------------------------------

export const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Dirección inválida")
  .transform((value) => value.toLowerCase() as Address);

export const txHashSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "Hash de transacción inválido")
  .transform((value) => value.toLowerCase() as Hex);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ error: "Email inválido" }));

export const httpsUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .pipe(z.url({ protocol: /^https$/, error: "Usa un enlace https://" }));

/** Monto en USDC escrito por una persona ("2.500,50" o "2500,50") -> bigint en unidades base. */
export const usdcAmountSchema = z
  .string()
  .trim()
  .regex(USDC_INPUT_PATTERN, USDC_INPUT_HINT)
  .transform((value) => parseUsdc(value))
  .refine((value) => value > 0n, "El monto debe ser mayor a 0");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

// -----------------------------------------------------------------------------
// Creación de escrow (dashboard del proveedor)
// -----------------------------------------------------------------------------

export const milestoneInputSchema = z.object({
  title: z.string().trim().min(1, "Ponle un nombre al hito").max(140),
  description: optionalText(5000),
  amount: usdcAmountSchema,
  dueDate: z.iso.date({ error: "Fecha inválida" }).optional(),
});

export const createEscrowSchema = z
  .object({
    title: z.string().trim().min(1, "Ponle un título al acuerdo").max(140),
    description: optionalText(5000),
    payerEmail: emailSchema.optional(),
    milestones: z
      .array(milestoneInputSchema)
      .min(1, "Agrega al menos un hito")
      .max(MAX_MILESTONES, `Máximo ${MAX_MILESTONES} hitos`),
  })
  .superRefine((value, ctx) => {
    const total = value.milestones.reduce((sum, milestone) => sum + milestone.amount, 0n);
    if (total > DEFAULT_MAX_ESCROW_AMOUNT) {
      ctx.addIssue({
        code: "custom",
        path: ["milestones"],
        message: `El total (${formatUsdc(total)} USDC) supera el máximo por acuerdo de ${formatUsdc(DEFAULT_MAX_ESCROW_AMOUNT)} USDC`,
      });
    }
  });

export type CreateEscrowInput = z.input<typeof createEscrowSchema>;
export type CreateEscrowData = z.output<typeof createEscrowSchema>;

// -----------------------------------------------------------------------------
// Acciones
// -----------------------------------------------------------------------------

export const syncRequestSchema = z.object({
  escrowId: z.uuid(),
  txHash: txHashSchema,
});
export type SyncRequest = z.input<typeof syncRequestSchema>;

export const deliverableSchema = z.object({
  url: httpsUrlSchema,
  notes: optionalText(5000),
});
export type DeliverableInput = z.input<typeof deliverableSchema>;

export const evidenceSchema = z.object({
  milestoneIndex: z.number().int().min(0).max(MAX_MILESTONES - 1),
  comment: z.string().trim().min(1, "Describe lo ocurrido").max(5000),
  attachmentUrl: httpsUrlSchema.optional(),
});
export type EvidenceInput = z.input<typeof evidenceSchema>;

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});
