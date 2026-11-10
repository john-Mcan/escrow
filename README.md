# Escrow por hitos en USDC (Base)

SaaS B2B/freelance de pagos en garantía **no-custodio** para Latinoamérica: el proveedor crea un acuerdo con hitos, comparte un link de checkout (`/pay/[id]`) y el cliente deposita USDC en un smart contract. Los fondos solo salen del contrato hacia el proveedor (menos el fee de plataforma), de vuelta al cliente o según el reparto de un árbitro multisig.

## Estructura

```
.
├── packages/
│   ├── contracts/          # Foundry: MilestoneEscrow.sol, MockUSDC, tests, deploy script
│   └── shared/             # ABIs tipados, chains/direcciones, esquemas Zod, montos/fees, tipos de Supabase
├── apps/
│   └── web/                # Next.js 15 + Privy + wagmi/viem + Supabase + Resend
└── supabase/
    ├── config.toml         # Stack local (puertos 553xx para no chocar con otros proyectos)
    ├── migrations/         # 0001 esquema + RLS + checkout público; 0002 funciones transaccionales del backend
    └── tests/database/     # Tests pgTAP de constraints, RLS y funciones
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
supabase test db                         # 39 tests pgTAP (constraints, RLS y funciones)
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

## App web (`apps/web`)

### Correr todo en local (Anvil + Supabase local)

```bash
pnpm db:start                                      # Supabase local
pnpm --filter @escrow/contracts anvil              # terminal 1: red local
pnpm --filter @escrow/contracts deploy:local       # terminal 2: MockUSDC + MilestoneEscrow (direcciones deterministas)
pnpm --filter @escrow/web dev                      # http://localhost:3000
```

En `.env`: `NEXT_PUBLIC_CHAIN_ID=31337`, las direcciones que imprime el deploy y las keys de `supabase status`. Sin `RESEND_API_KEY` los correos se escriben en la consola del servidor.

Para probar en localhost con login real y USDC de prueba en Base Sepolia (lo mínimo), sigue
[docs/prueba-local-sepolia.md](docs/prueba-local-sepolia.md). El entorno de pruebas ya armado (contrato, cuentas y
usuarios, y cómo retomarlo) está en [docs/entorno-pruebas-sepolia.md](docs/entorno-pruebas-sepolia.md). La guía
completa de cuentas para staging y producción está en
[docs/credenciales.md](docs/credenciales.md), y el plan hasta mainnet en [docs/roadmap.md](docs/roadmap.md).

### Configuración de Privy (dashboard)

1. **Login methods:** Email, Google y External wallets (MetaMask, Coinbase Wallet, Rainbow, WalletConnect).
2. **Embedded wallets:** Ethereum, creación automática para usuarios sin wallet.
3. **Smart wallets (ERC-4337):** activarlas en Base y Base Sepolia con un paymaster (p. ej. Coinbase Developer Platform). El depósito queda en `approve + createAndFundEscrow` dentro de una sola UserOperation, sin gas para el usuario. Las wallets externas usan `permit` (EIP-2612) + depósito en una transacción.
4. **MFA:** habilitar *passkey* y exigir MFA para acciones de wallet, así Privy pide la biometría antes de firmar liberaciones.
5. **Allowed origins:** el dominio de la app (y `http://localhost:3000` en desarrollo).

### Consistencia on-chain / off-chain

- El frontend nunca marca nada como pagado: después de cada transacción solo envía el `txHash` a `POST /api/escrow/sync`.
- El backend lee el recibo desde **su** RPC, decodifica los eventos de `MilestoneEscrow` y valida `referenceId` (UUID del acuerdo), payee, token y el monto de cada hito antes de escribir en Supabase.
- `(tx_hash, log_index)` es único en `escrow_activity_logs`: repetir el sync no duplica registros ni correos (Resend recibe además claves de idempotencia).
- Si el navegador se cierra entre la confirmación y el sync, la vista `/pay` reintenta el sync pendiente al volver.

### Rutas

| Ruta | Acceso | Uso |
|---|---|---|
| `/pay/[id o short_code]` | pública | Checkout: depositar, liberar, subir entregable, reembolsar, disputar |
| `/dashboard`, `/dashboard/new` | sesión Privy | Acuerdos del usuario y creación de links de cobro |
| `/arbitration` | `ARBITRATION_ADMIN_EMAILS` | Evidencias y transacción `resolveDispute` para la Safe del árbitro (lote de Transaction Builder) |
| `POST /api/escrow/sync` | pública (verificación on-chain) | Reconciliación idempotente |
| `/api/escrows/*`, `/api/me` | Bearer token de Privy | Creación, detalle privado, entregables y evidencias |

Emails (Resend): invitación al cliente, garantía depositada (proveedor + recibo al cliente), entregable listo, fondos liberados, reembolso, disputa abierta (partes + árbitros) y disputa resuelta.

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
