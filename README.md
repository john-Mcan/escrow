# Escrow por hitos en USDC (Base)

SaaS B2B/freelance de pagos en garantía **no-custodio** para Latinoamérica: el proveedor crea un acuerdo con hitos, comparte un link de checkout (`/pay/[id]`) y el cliente deposita USDC en un smart contract. Los fondos solo salen del contrato hacia el proveedor (menos el fee de plataforma), de vuelta al cliente o según el reparto de un árbitro multisig.

## Estructura

```
.
├── packages/
│   ├── contracts/          # Foundry: MilestoneEscrow.sol, MockUSDC, tests, deploy script
│   └── shared/             # (Fase 2) ABIs tipados, direcciones por chainId, esquemas Zod
├── apps/
│   └── web/                # (Fase 2) Next.js 15 + Privy + wagmi/viem + Supabase + Resend
└── supabase/
    ├── config.toml         # Stack local (puertos 553xx para no chocar con otros proyectos)
    ├── migrations/         # 0001_initial_schema.sql: tablas, índices, RLS, checkout público
    └── tests/database/     # Tests pgTAP de constraints y RLS
```

## Requisitos

- Node.js ≥ 22 y pnpm ≥ 10
- [Foundry](https://getfoundry.sh) (`forge`, `cast`, `anvil`) en el `PATH`
- Supabase CLI + Docker (solo para la base de datos local)

## Puesta en marcha

```bash
git clone --recurse-submodules <repo>    # o: git submodule update --init --recursive
pnpm install
cp .env.example .env

# Contratos
pnpm contracts:build
pnpm contracts:test                      # 55 tests (incluye fuzzing)
pnpm --filter @escrow/contracts coverage
pnpm --filter @escrow/contracts gas

# Base de datos local
pnpm db:start                            # Postgres + API en http://127.0.0.1:55321
pnpm db:reset                            # re-aplica migraciones
supabase test db                         # 30 tests pgTAP (constraints + RLS)
pnpm db:lint
```

### Deploy

El deploy **nunca** usa una llave privada en `.env`: firma con un keystore cifrado o con Ledger.

```bash
cd packages/contracts
cast wallet import deployer --interactive         # una sola vez
# Completar ESCROW_OWNER / ESCROW_ARBITER (Safes) y ESCROW_FEE_RECIPIENT en .env
source ../../.env
pnpm deploy:base-sepolia                          # forge script ... --account deployer --broadcast --verify
```

En local: `pnpm --filter @escrow/contracts anvil` y, en otra terminal, `pnpm --filter @escrow/contracts deploy:local` (despliega también `MockUSDC`).

## Smart contract: `MilestoneEscrow`

| Función | Quién | Efecto |
|---|---|---|
| `createAndFundEscrow` / `…WithPermit` | payer | Crea el escrow y deposita el total (EIP-2612 en 1 tx) |
| `releaseMilestone` | payer | Neto al payee + fee a `feeRecipient`, en la misma tx |
| `refundMilestone` | payee | 100% del hito vuelve al payer, sin fee |
| `raiseDispute` | payer o payee | Congela el hito (`Disputed`) |
| `resolveDispute` | arbiter del escrow | Reparte entre payer y payee (`payerShareBps`); fee solo sobre la porción del payee |

Decisiones de diseño:

- **Pausa = solo depósitos nuevos.** Liberar, reembolsar, disputar y resolver funcionan siempre: la plataforma no puede retener fondos.
- **Snapshot por escrow** del fee y del arbiter: cambiar la configuración no altera acuerdos ya fondeados.
- **Allowlist de tokens** (USDC) + verificación del monto recibido: protege la contabilidad si el token cobrara comisión por transferencia.
- **El arbiter nunca recibe principal**: solo puede repartir entre payer y payee. Payer y payee no pueden ser el arbiter.
- `maxEscrowAmount` (default 5.000 USDC) y máximo 20 hitos por escrow.
- Estado `Resolved` adicional para distinguir un reparto arbitral (incluido un split parcial) de `Released`/`Refunded`.
- `referenceId` (UUID de Supabase en bytes32) en `EscrowCreated` para que el backend reconcilie sin confiar en el frontend.

## Base de datos

- Privy es el proveedor de identidad. **Solo el backend (service role) escribe**, después de verificar el token de Privy o la transacción on-chain.
- `authenticated` solo lee los escrows donde participa (creador, o payer/payee por wallet o email verificado).
- `anon` no accede a tablas: el checkout público usa `get_public_checkout(uuid | short_code)`, que no expone emails ni URLs de entregables.
- `escrow_activity_logs` y `disputes_evidence` son **append-only** (sin UPDATE/DELETE, ni siquiera para el backend).
- `(tx_hash, log_index)` es la clave de idempotencia de la reconciliación on-chain.
