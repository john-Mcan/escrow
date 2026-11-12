# Guía de desarrollo

Cómo correr, probar y desplegar extan en local. La visión general del proyecto está en el [README](../README.es.md)
y el diseño técnico en [arquitectura.md](arquitectura.md).

## Estructura del repositorio

```
.
├── apps/
│   └── web/                  # Next.js 15 (App Router) + Privy + wagmi/viem + Supabase + Resend
│       ├── src/app/          # Páginas y Route Handlers (/api/*)
│       ├── src/components/   # UI por dominio (escrow, auth, landing, wallet) y primitivas (ui/)
│       ├── src/hooks/        # Transacciones, sesión, moneda local
│       └── src/lib/server/   # Solo servidor: auth, sync on-chain, emails, límites, acceso a datos
├── packages/
│   ├── contracts/            # Foundry: MilestoneEscrow.sol, MockUSDC, tests y script de deploy
│   └── shared/               # ABI tipado, redes y direcciones, esquemas Zod, montos y tipos de Supabase
├── supabase/
│   ├── migrations/           # Esquema, RLS, funciones del backend y límite de solicitudes
│   └── tests/database/       # Tests pgTAP
└── docs/                     # Guías, plan y decisiones
```

## Requisitos

- Node.js 22 o superior y pnpm 10 o superior.
- [Foundry](https://getfoundry.sh) (`forge`, `cast`, `anvil`) en el `PATH`.
- Supabase CLI y Docker, para la base de datos local.

## Puesta en marcha

```bash
git clone --recurse-submodules <repo>    # o, ya clonado: git submodule update --init --recursive
pnpm install
cp .env.example .env
```

Un único `.env` en la raíz sirve a Foundry y a Next.js (`apps/web/next.config.ts` lo carga). `.env.example` explica
cada variable.

### Todo en local (Anvil + Supabase local)

```bash
pnpm db:start                                      # Supabase local (API en http://127.0.0.1:55321)
pnpm --filter @escrow/contracts anvil              # terminal 1: red local
pnpm --filter @escrow/contracts deploy:local       # terminal 2: MockUSDC + MilestoneEscrow (direcciones deterministas)
pnpm --filter @escrow/web dev                      # http://localhost:3000
```

En `.env`: `NEXT_PUBLIC_CHAIN_ID=31337`, las direcciones que imprime el deploy y las keys de `supabase status`. Sin
`RESEND_API_KEY`, los correos se escriben en la consola del servidor.

### Base Sepolia en localhost

Para probar con login real y USDC de prueba, sigue [prueba-local-sepolia.md](prueba-local-sepolia.md). El entorno de
pruebas ya armado (contrato, cuentas y cómo retomarlo) está en [entorno-pruebas-sepolia.md](entorno-pruebas-sepolia.md)
y la guía de cada cuenta externa en [credenciales.md](credenciales.md).

## Calidad

```bash
pnpm format:check                        # Prettier + forge fmt
pnpm lint                                # ESLint en apps/web y forge lint en el contrato
pnpm typecheck                           # tsc en apps/web y packages/shared
pnpm test                                # Foundry (55) + Vitest de packages/shared (27)
supabase test db                         # 47 tests pgTAP: constraints, RLS, funciones y límites
pnpm db:lint                             # plpgsql_check sobre el esquema
pnpm --filter @escrow/contracts coverage # cobertura del contrato (100 %)
pnpm --filter @escrow/contracts gas      # reporte de gas
pnpm --filter @escrow/web build          # build de producción
```

El análisis estático del contrato con Slither y cómo repetirlo están en [analisis-estatico.md](analisis-estatico.md).

Base de datos:

- `pnpm db:reset` borra la base local y vuelve a aplicar todas las migraciones;
- `supabase migration up` aplica solo las pendientes, sin borrar datos;
- `pnpm db:types` regenera `packages/shared/src/database.types.ts` después de cambiar el esquema.

## Deploy del contrato

El deploy **nunca** usa una llave privada en `.env`: firma con un keystore cifrado o con Ledger.

```bash
cd packages/contracts
cast wallet import deployer --interactive         # una sola vez
# Completar ESCROW_OWNER, ESCROW_ARBITER (Safes) y ESCROW_FEE_RECIPIENT en .env
source ../../.env
pnpm deploy:base-sepolia                          # forge script ... --account deployer --broadcast --verify
```

En Windows con `.env` en CRLF, despliega desde PowerShell como indica [prueba-local-sepolia.md](prueba-local-sepolia.md),
paso 7.

Para verificar un contrato ya desplegado (los argumentos del constructor están en
`packages/contracts/broadcast/DeployMilestoneEscrow.s.sol/<chainId>/run-latest.json`):

```bash
forge verify-contract <dirección> src/MilestoneEscrow.sol:MilestoneEscrow --chain base-sepolia \
  --constructor-args $(cast abi-encode "constructor(address,address,address,uint256,address)" <owner> <arbiter> <treasury> <feeBps> <usdc>)
# Sin API key: --verifier blockscout --verifier-url https://base-sepolia.blockscout.com/api/   o   --verifier sourcify
```

## Configuración de Privy (dashboard)

1. **Login methods:** email, Google y wallets externas (MetaMask, Coinbase Wallet, Rainbow, WalletConnect).
2. **Embedded wallets:** Ethereum, creación automática para usuarios sin wallet.
3. **Smart wallets (ERC-4337):** activarlas en Base y Base Sepolia con un paymaster (por ejemplo, Coinbase Developer
   Platform). El depósito va como `approve` + `createAndFundEscrow` en una sola UserOperation, sin gas para el
   usuario. Las wallets externas usan `permit` (EIP-2612) + depósito en una transacción.
4. **MFA:** habilitar passkey y exigir MFA en las acciones de wallet, para que Privy pida la biometría antes de firmar
   liberaciones.
5. **Allowed origins:** el dominio de la app y `http://localhost:3000` en desarrollo.

## Rutas

| Ruta | Acceso | Uso |
|---|---|---|
| `/` | Pública | Portada |
| `/pay/[id o short_code]` | Pública | Checkout: depositar, liberar, entregar, reembolsar y disputar |
| `/dashboard`, `/dashboard/new` | Sesión de Privy | Acuerdos del usuario y creación de links de cobro |
| `/arbitration` | `ARBITRATION_ADMIN_EMAILS` | Evidencias y lote `resolveDispute` para la Safe del árbitro |
| `POST /api/escrow/sync` | Pública (verificación on-chain, límite por IP) | Reconciliación idempotente |
| `/api/escrows/*`, `/api/me` | Bearer token de Privy | Creación, detalle privado, entregables y evidencias |
| `/api/checkout/[reference]`, `/api/rates` | Pública | Datos públicos del checkout y tipo de cambio |
| `GET /api/cron/keepalive` | `CRON_SECRET` | Cron diario de Vercel: mantiene activa la base y limpia contadores |

Emails (Resend): invitación al cliente, garantía depositada (proveedor y recibo al cliente), entregable listo, fondos
liberados, reembolso, disputa abierta (partes y árbitros) y disputa resuelta.
