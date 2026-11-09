# Credenciales y cuentas necesarias

Guía para pasar del entorno local (Anvil) a **Base Sepolia** con usuarios reales. Cada paso indica qué variable de
`.env` completa. Los nombres de menús de los dashboards pueden variar levemente según la versión de cada servicio.

> Para una primera prueba en localhost (sin Safes, Supabase cloud ni Resend) usa la versión mínima:
> [prueba-local-sepolia.md](prueba-local-sepolia.md). En Windows, despliega desde PowerShell con el bloque de su
> paso 7: si tu `.env` tiene saltos de línea CRLF, `source ../../.env` en Git Bash deja un `\r` al final de cada valor.

> **Seguridad:** los secretos (`PRIVY_APP_SECRET`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, URLs de RPC con API key)
> van solo en el `.env` local o en las variables de entorno del hosting. No se pegan en chats, issues ni commits.
> Las direcciones públicas y el `NEXT_PUBLIC_PRIVY_APP_ID` no son secretos.

## Resumen

| # | Servicio | Variables | Costo en testnet |
|---|---|---|---|
| 1 | Safe (multisig) | `ESCROW_OWNER`, `ESCROW_ARBITER`, `ESCROW_FEE_RECIPIENT` | Gratis (gas de prueba) |
| 2 | Alchemy (RPC) | `BASE_SEPOLIA_RPC_URL`, `BASE_MAINNET_RPC_URL`, `NEXT_PUBLIC_BASE_RPC_URL` | Plan gratuito |
| 3 | Etherscan | `ETHERSCAN_API_KEY` | Gratis |
| 4 | Wallet de deploy + faucets | keystore `deployer` (fuera de `.env`) | Gratis |
| 5 | Deploy del contrato | `NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS`, `NEXT_PUBLIC_USDC_ADDRESS`, `NEXT_PUBLIC_CHAIN_ID` | Gas de prueba |
| 6 | Coinbase Developer Platform (paymaster) | URL que se pega en Privy | Créditos gratuitos en testnet |
| 7 | Privy | `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET` (+ opcionales) | Plan gratuito |
| 8 | Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Plan gratuito |
| 9 | Resend | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Plan gratuito |
| 10 | App | `NEXT_PUBLIC_APP_URL`, `ARBITRATION_ADMIN_EMAILS` | — |

El orden importa: el paymaster (6) necesita la dirección del contrato (5), y el contrato necesita las Safes (1).

---

## 1. Safes multisig (owner, árbitro y treasury)

El contrato nunca debe administrarse ni arbitrarse desde una wallet del servidor.

1. Entra a [app.safe.global](https://app.safe.global) y conecta una wallet (idealmente hardware: Ledger/Trezor).
2. Crea **tres Safes en Base Sepolia** (se pueden repetir firmantes, por ejemplo 2 de 3):
   - **Owner:** administra fee, límite por acuerdo, pausa y allowlist de tokens.
   - **Árbitro:** firma `resolveDispute` desde el panel `/arbitration`.
   - **Treasury:** recibe la comisión de la plataforma (puede ser una Safe o una wallet de la empresa).
3. Copia las direcciones en `.env`:
   ```
   ESCROW_OWNER=0x...
   ESCROW_ARBITER=0x...
   ESCROW_FEE_RECIPIENT=0x...
   ESCROW_PLATFORM_FEE_BPS=150
   ```

## 2. RPC de Base (Alchemy)

1. Crea una cuenta en [alchemy.com](https://www.alchemy.com) y una app con las redes **Base Sepolia** y **Base Mainnet**.
2. Copia los endpoints HTTPS:
   ```
   BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/<key>
   BASE_MAINNET_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key>
   ```
3. Para el navegador usa el RPC público (`https://sepolia.base.org`) o una segunda key restringida por dominio en
   Alchemy (allowlist de origen):
   ```
   NEXT_PUBLIC_BASE_RPC_URL=https://sepolia.base.org
   ```

QuickNode o el nodo de Coinbase Developer Platform sirven igual.

## 3. Etherscan (verificación del contrato)

1. Crea una cuenta en [etherscan.io](https://etherscan.io) y una API key (la API v2 usa la misma key para Basescan).
2. `ETHERSCAN_API_KEY=<key>`

## 4. Wallet de deploy y fondos de prueba

1. Crea una wallet nueva solo para desplegar y guárdala cifrada (pide una contraseña; no queda en `.env`):
   ```bash
   cast wallet new                              # genera la llave
   cast wallet import deployer --interactive    # la guarda cifrada en ~/.foundry/keystores
   ```
   Alternativa: usar un Ledger con `--ledger` en lugar de `--account deployer`.
2. Consigue ETH de Base Sepolia para gas en un faucet (por ejemplo el de Coinbase Developer Platform o el de Alchemy).
3. Para probar depósitos, consigue **USDC de prueba** en [faucet.circle.com](https://faucet.circle.com) (red Base Sepolia).

## 5. Deploy de MilestoneEscrow en Base Sepolia

Con los pasos 1 a 4 completos:

```bash
cd packages/contracts
set -a; source ../../.env; set +a
pnpm deploy:base-sepolia        # forge script ... --account deployer --broadcast --verify
```

El script usa el USDC de Circle en Base Sepolia (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). Copia la dirección
que imprime:

```
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=0x...       # la que imprime el deploy
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

## 6. Paymaster para gas patrocinado (Coinbase Developer Platform)

1. Entra a [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) y crea un proyecto.
2. En **Paymaster**, selecciona **Base Sepolia** y copia la URL del endpoint (paymaster + bundler).
3. Configura una **allowlist de contratos** para patrocinar solo lo que usa la app:
   - USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`): `approve`.
   - MilestoneEscrow (tu dirección): `createAndFundEscrow`, `releaseMilestone`, `refundMilestone`, `raiseDispute`.
4. Define límites de gasto por usuario y global para evitar abusos.
5. Guarda la URL; se pega en Privy en el paso 7 (en `.env` queda solo como referencia: `PAYMASTER_URL=`).

## 7. Privy (login, wallets embebidas, passkeys y smart wallets)

1. Crea una cuenta en [dashboard.privy.io](https://dashboard.privy.io) y una app nueva.
2. En la configuración de la app copia:
   ```
   NEXT_PUBLIC_PRIVY_APP_ID=<25 caracteres>
   PRIVY_APP_SECRET=<secret>
   ```
   Opcionales: `NEXT_PUBLIC_PRIVY_CLIENT_ID` (si usas app clients por entorno) y `PRIVY_VERIFICATION_KEY` (clave pública
   para verificar tokens; sin ella se usa el JWKS del app).
3. **Métodos de login:** Email, Google y wallets externas (MetaMask, Coinbase Wallet, Rainbow, WalletConnect). Para
   WalletConnect/Rainbow puede pedirte un project ID de [Reown](https://cloud.reown.com).
4. **Embedded wallets (Ethereum):** creación automática al hacer login para usuarios sin wallet.
5. **Smart wallets:** actívalas, elige el tipo (Coinbase Smart Wallet funciona bien en Base) y para **Base Sepolia**
   pega la URL del paymaster/bundler del paso 6.
6. **MFA:** habilita **passkey** como método y exige MFA para las acciones de wallet; así se pide biometría antes de
   firmar liberaciones de dinero.
7. **Dominios permitidos:** `http://localhost:3000` y el dominio de producción.

## 8. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (región sugerida: South America, São Paulo).
2. En **Project Settings → API Keys** copia:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_...
   ```
3. Aplica las migraciones al proyecto remoto:
   ```bash
   supabase login
   supabase link --project-ref <ref>
   supabase db push
   ```

## 9. Resend (emails transaccionales)

1. Crea una cuenta en [resend.com](https://resend.com) y una API key con permiso de envío:
   `RESEND_API_KEY=re_...`
2. En **Domains**, agrega tu dominio y carga en tu DNS los registros que te indica (SPF y DKIM; DMARC recomendado).
3. Cuando el dominio quede verificado:
   ```
   EMAIL_FROM="Hito <pagos@tu-dominio.com>"
   EMAIL_REPLY_TO=soporte@tu-dominio.com
   ```
   Sin dominio verificado, `onboarding@resend.dev` solo entrega a la dirección de tu cuenta de Resend. Sin
   `RESEND_API_KEY`, la app escribe los correos en la consola del servidor.

## 10. Variables de la app

```
NEXT_PUBLIC_APP_URL=http://localhost:3000        # en producción, el dominio real
ARBITRATION_ADMIN_EMAILS=tu-email@empresa.com    # cuentas con acceso a /arbitration
```

---

## Checklist final

- [ ] `.env` completo (compáralo con `.env.example`).
- [ ] `pnpm --filter @escrow/web dev` arranca sin errores de variables.
- [ ] Login con email crea una wallet y aparece el aviso de passkey.
- [ ] Crear un link de cobro desde `/dashboard/new` y recibir la invitación por email.
- [ ] Con otra cuenta (y USDC de [faucet.circle.com](https://faucet.circle.com)), depositar desde `/pay/...` sin pagar gas.
- [ ] Subir entregable, liberar, disputar y resolver desde `/arbitration` con la Safe del árbitro.
