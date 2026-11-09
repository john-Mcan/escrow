# Probar en localhost con Base Sepolia

Guía para revisar Hito en `http://localhost:3000` con login real (Privy), wallets reales y USDC de prueba en
**Base Sepolia**. La base de datos sigue siendo el Supabase local y los correos se escriben en la consola del servidor.

Es el camino mínimo para ver el producto como lo usaría un cliente. Para staging y producción, la guía completa es
[credenciales.md](credenciales.md).

> **Solo cuentas de prueba.** Las wallets de esta guía no deben recibir dinero real ni reutilizarse en mainnet. En
> producción, owner, árbitro y treasury son Safes multisig con hardware wallet.

## Resumen

| # | Qué | ¿Obligatorio? | Resultado |
|---|---|---|---|
| 1 | Revisar la configuración de Privy | Sí (ya tienes las keys) | `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET` |
| 2 | Alchemy (RPC) | Sí | `BASE_SEPOLIA_RPC_URL` |
| 3 | MetaMask con 3 cuentas de prueba | Sí | `ESCROW_OWNER`, `ESCROW_ARBITER`, `ESCROW_FEE_RECIPIENT` |
| 4 | ETH de Base Sepolia (faucet) | Sí | Gas para el deploy y las pruebas |
| 5 | Keystore de Foundry `deployer` | Sí | Firma del deploy (fuera de `.env`) |
| 6 | Completar `.env` | Sí | Variables de Base Sepolia |
| 7 | Deploy del contrato | Sí | `NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS`, `ESCROW_DEPLOYMENT_BLOCK` |
| 8 | Etherscan | No | Código verificado en Basescan |
| 9 | Paymaster + smart wallets | No | Probar el depósito sin gas |
| 10 | Usuarios de prueba + USDC | Sí | Cuentas de cliente y proveedor con saldo |

**No hacen falta:** Safes (en testnet bastan cuentas normales), Supabase cloud (sigue el local) ni Resend (sin
`RESEND_API_KEY` los correos aparecen en la terminal de `pnpm dev`).

**Quién hace qué:** tú creas las cuentas y firmas el deploy (pide la contraseña del keystore). Las direcciones
públicas me las puedes pasar por el chat y yo completo `.env`, reinicio la base local, levanto la app y te acompaño
en el recorrido. Los secretos van solo en `.env`.

---

## 1. Privy: revisar la configuración

En [dashboard.privy.io](https://dashboard.privy.io), dentro de tu app (los nombres de los menús pueden variar):

1. **Login methods:** Email, Google y External wallets (MetaMask, Coinbase Wallet, Rainbow, WalletConnect).
2. **Embedded wallets → Ethereum:** creación automática para usuarios sin wallet (*users without wallets*).
3. **Domains / Allowed origins:** agrega `http://localhost:3000`.
4. **Smart wallets:** déjalas **apagadas** por ahora. Si quieres probar el gas patrocinado, sigue el paso 9 *antes*
   de crear usuarios de prueba.
5. **MFA:** habilita *passkey* para ver el aviso de passkey y la confirmación biométrica (opcional en esta prueba).
6. En `.env`:
   ```dotenv
   NEXT_PUBLIC_PRIVY_APP_ID=<25 caracteres>
   PRIVY_APP_SECRET=<secret>
   ```

En desarrollo, el login con Google funciona con las credenciales de OAuth de Privy. Para producción conviene
configurar las tuyas.

## 2. Alchemy: RPC de Base Sepolia

El RPC público `https://sepolia.base.org` **no sirve para desplegar**: `forge script` consulta el estado por hash de
bloque y los nodos públicos responden `block not found` o `503`. Lo comprobé el 2026-11-09.

1. Crea una cuenta gratuita en [alchemy.com](https://www.alchemy.com).
2. **Create new app** → en las redes, activa **Base → Base Sepolia** (y Base Mainnet si quieres dejarla lista).
3. Copia el endpoint HTTPS de Base Sepolia:
   ```dotenv
   BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/<key>
   ```
   La URL incluye tu API key: trátala como secreto.

El navegador sigue usando el RPC público (`NEXT_PUBLIC_BASE_RPC_URL=https://sepolia.base.org`). Para localhost
alcanza, porque el navegador hace pocas consultas.

> **Sin cuenta:** el gateway público de Tenderly (`https://base-sepolia.gateway.tenderly.co`) completó una
> simulación del deploy el 2026-11-09. Sirve como plan B, pero los endpoints públicos tienen límites y pueden fallar
> sin aviso.

## 3. MetaMask: tres cuentas de prueba

1. Usa MetaMask en un perfil de navegador **dedicado a pruebas** (o crea una wallet nueva solo para esto).
2. Agrega la red Base Sepolia (*Configuración → Redes → Agregar red manualmente*), si no aparece entre las de prueba:

   | Campo | Valor |
   |---|---|
   | Nombre | Base Sepolia |
   | URL de RPC | `https://sepolia.base.org` |
   | Chain ID | `84532` |
   | Símbolo | `ETH` |
   | Explorador | `https://sepolia.basescan.org` |

3. Crea tres cuentas (*Agregar cuenta*) y renómbralas:
   - **Hito Owner:** despliega el contrato y lo administra (pausa, fee, límites). Será también la wallet de deploy.
   - **Hito Árbitro:** firma las resoluciones de disputas desde `/arbitration`.
   - **Hito Treasury:** recibe la comisión de la plataforma. Podría ser Owner, pero separada se ve claramente cuándo
     llega el fee.
4. Copia las tres direcciones. Son públicas: me las puedes pasar por el chat.

El contrato no permite que el árbitro sea cliente o proveedor de un acuerdo. Por eso cliente y proveedor serán cuentas
con email (paso 10), nunca estas.

## 4. ETH de Base Sepolia

Pide ETH de prueba para **Hito Owner** en alguno de estos faucets. Sus requisitos cambian seguido: si uno pide
iniciar sesión o tener saldo en mainnet, prueba con otro.

- Coinbase Developer Platform: [portal.cdp.coinbase.com/products/faucet](https://portal.cdp.coinbase.com/products/faucet)
  (la misma cuenta sirve para el paso 9)
- Superchain Faucet: [console.optimism.io/faucet](https://console.optimism.io/faucet)
- Alchemy: [alchemy.com/faucets/base-sepolia](https://www.alchemy.com/faucets/base-sepolia)

**¿Cuánto?** La simulación del deploy estimó **≈ 0,0001 ETH**. Cada transacción de prueba cuesta bastante menos. Con
0,001 ETH alcanza para todo; si el faucet entrega poco, pide varias veces.

Después, desde MetaMask, envía una parte a **Hito Árbitro** para que pueda pagar el gas de `resolveDispute`.

## 5. Keystore de deploy (PowerShell)

El deploy firma con la llave de Hito Owner guardada **cifrada** por Foundry. Nunca va en `.env`, en el chat ni en
ningún archivo del repo. Usa **PowerShell**: los prompts de clave y contraseña de Foundry funcionan bien en la consola
de Windows.

1. En MetaMask, en Hito Owner: *⋮ → Detalles de la cuenta → Mostrar clave privada*. Cópiala.
2. En PowerShell:
   ```powershell
   $env:Path = "$HOME\.foundry\bin;$env:Path"
   cast wallet import deployer --interactive
   ```
   Pega la clave privada cuando la pida (no se ve al escribir) y elige una contraseña. Queda en
   `%USERPROFILE%\.foundry\keystores\deployer`.
3. Comprueba que es la cuenta correcta (pide la contraseña):
   ```powershell
   cast wallet address --account deployer
   ```
   Debe mostrar la dirección de Hito Owner.

## 6. Completar `.env`

El deploy lee las direcciones y el RPC desde `.env`, así que este paso va **antes** del paso 7. Puedes hacerlo tú o
pasarme las direcciones. Los valores de Supabase local se mantienen como están.

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_BASE_RPC_URL=https://sepolia.base.org
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/<key>
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Hito Owner, Hito Árbitro y Hito Treasury
ESCROW_OWNER=0x...
ESCROW_ARBITER=0x...
ESCROW_FEE_RECIPIENT=0x...
ESCROW_PLATFORM_FEE_BPS=150

NEXT_PUBLIC_PRIVY_APP_ID=...
PRIVY_APP_SECRET=...

# Email con el que entrarás a /arbitration
ARBITRATION_ADMIN_EMAILS=tu-email@ejemplo.com
```

No pongas comentarios al final de una línea con valor (`CLAVE=valor # comentario`): el comentario quedaría dentro del
valor.

## 7. Deploy en Base Sepolia (PowerShell)

```powershell
cd C:\proyectos\escrow\packages\contracts
$env:Path = "$HOME\.foundry\bin;$env:Path"

# Carga el .env de la raíz en esta terminal (Foundry solo lee el .env de packages/contracts)
Get-Content ..\..\.env | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim().Trim('"'), 'Process')
  }
}

forge script script/DeployMilestoneEscrow.s.sol --rpc-url base_sepolia --account deployer --broadcast
```

Foundry pide la contraseña del keystore y al final imprime la dirección de `MilestoneEscrow` y el bloque de la
transacción. Si tienes la key de Etherscan (paso 8), agrega `--verify` al final del comando.

Avísame cuando termine: leo la dirección y el bloque de
`packages/contracts/broadcast/DeployMilestoneEscrow.s.sol/84532/run-latest.json` y completo:

```dotenv
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=0x...
ESCROW_DEPLOYMENT_BLOCK=<bloque>
```

El contrato se puede ver en `https://sepolia.basescan.org/address/<dirección>`.

## 8. (Opcional) Etherscan: código verificado

Con el código verificado, Basescan muestra el contrato legible y permite consultarlo desde la web.

1. Crea una cuenta en [etherscan.io](https://etherscan.io) → *API Keys* → *Add*. La API v2 usa la misma key para
   Base Sepolia.
2. En `.env`: `ETHERSCAN_API_KEY=<key>`.
3. Si la tienes antes del deploy, usa `--verify` en el paso 7. Si llega después, avísame y verifico el contrato ya
   desplegado (no requiere firmar nada).

## 9. (Opcional) Gas patrocinado: paymaster y smart wallets

Sin este paso todo funciona igual, pero las wallets de cliente y proveedor necesitan un poco de ETH (paso 10).

**Decídelo antes de crear usuarios:** al activar smart wallets cambia la dirección de cada usuario (pasa a ser la de
su smart wallet). Si lo activas después, hay que reiniciar la base local (`pnpm db:reset`) y volver a cargar USDC en
la nueva dirección.

1. En [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) crea un proyecto y entra a **Paymaster**.
2. Elige **Base Sepolia** y copia el endpoint (sirve como bundler y paymaster). Incluye tu key: es secreto.
3. Activa el paymaster y agrega a la allowlist de contratos:
   - USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`: `approve`.
   - Tu `MilestoneEscrow` (paso 7): `createAndFundEscrow`, `releaseMilestone`, `refundMilestone`, `raiseDispute`.
4. Opcional: límites de gasto por usuario y globales.
5. En Privy → **Smart wallets**: actívalas, elige **Coinbase Smart Wallet** y, para Base Sepolia, pega el endpoint
   como URL de bundler y de paymaster.
6. En `.env`, como referencia (la app no lo lee): `PAYMASTER_URL=<endpoint>`.

## 10. Usuarios de prueba y USDC

Hacen falta dos identidades, **proveedor** (crea el cobro y recibe) y **cliente** (deposita), además de la tuya como
árbitro.

- **Dos emails:** con Gmail, `tucorreo+proveedor@gmail.com` y `tucorreo+cliente@gmail.com` llegan al mismo buzón, pero
  Privy los trata como cuentas distintas.
- **Sesiones separadas:** la sesión de Privy es por navegador. Distribución sugerida:

  | Perfil de navegador | Quién | Login |
  |---|---|---|
  | El que tiene MetaMask | Árbitro | Email de `ARBITRATION_ADMIN_EMAILS` + conectar Hito Árbitro |
  | Segundo perfil | Proveedor | `tucorreo+proveedor@...` |
  | Ventana privada | Cliente | `tucorreo+cliente@...` |

- **Dirección de cada wallet:** al entrar con email, Privy crea una wallet embebida. La app hoy la muestra abreviada
  (está anotado para la Fase 3). Para copiarla completa: dashboard de Privy → **Users** → el usuario → wallets. Con
  smart wallets activas, usa la dirección de la smart wallet.
- **USDC para el cliente:** [faucet.circle.com](https://faucet.circle.com) → red **Base Sepolia** → dirección de la wallet
  del cliente. El faucet tiene límite de frecuencia, así que crea acuerdos chicos (por ejemplo, 3 hitos de 1 USDC).
- **ETH (solo sin paymaster):** desde MetaMask (Hito Owner) envía un poco a las wallets de cliente y proveedor.

## 11. Levantar la app

Lo hago yo cuando `.env` esté completo. Si prefieres hacerlo tú (Docker Desktop debe estar corriendo):

```powershell
pnpm db:start
pnpm db:reset                    # borra los acuerdos de prueba de Anvil (red 31337)
pnpm --filter @escrow/web dev    # http://localhost:3000
```

## 12. Recorrido de prueba

- [ ] **Proveedor:** entra con email → se crea su wallet → aparece el aviso de passkey (actívala para probar la
      biometría).
- [ ] **Proveedor:** `/dashboard/new` → acuerdo de 3 hitos con el email del cliente → el email de invitación aparece
      en la terminal de `pnpm dev`.
- [ ] **Cliente:** abre el link `/pay/...` → entra → deposita (firma y confirma). El depósito aparece en Basescan y el
      acuerdo queda en garantía.
- [ ] **Proveedor:** sube un entregable (link `https://`) en el hito 1.
- [ ] **Cliente:** libera el hito 1 → el proveedor recibe el neto y Hito Treasury la comisión (1,5%).
- [ ] **Proveedor:** reembolsa el hito 2 → el cliente recupera el 100%.
- [ ] **Cliente o proveedor:** abre una disputa en el hito 3 y aporta evidencia.
- [ ] **Árbitro:** entra con el email de arbitraje → `/arbitration` → conecta MetaMask con Hito Árbitro → elige el
      reparto y firma. Ambas partes ven el resultado.
- [ ] **Sync pendiente:** cierra la pestaña justo después de confirmar una transacción y vuelve a `/pay/...`. El
      estado debe ponerse al día solo.

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| `Variables de entorno públicas inválidas` al arrancar | Falta una variable o tiene formato inválido (App ID de 25 caracteres, direcciones `0x` + 40) |
| `block not found` o `503` en el deploy | RPC público: usa el de Alchemy (paso 2) |
| `insufficient funds` en el deploy | Falta ETH en Hito Owner (paso 4) |
| El cliente ve "Saldo insuficiente" | Faltan USDC o se enviaron a otra dirección (con smart wallets, la de la smart wallet) |
| La transacción falla por gas | Falta ETH en la wallet del usuario (sin paymaster) |
| `/arbitration` no deja firmar | La wallet conectada no es Hito Árbitro o no está en Base Sepolia |
| "Este acuerdo pertenece a otra red" | Quedan datos de Anvil: `pnpm db:reset` |
| Las consultas del navegador fallan con `429`/`503` | Límite del RPC público: avísame y lo cambiamos |

## Qué compartir y qué no

- **Por el chat, sin problema:** las tres direcciones públicas, la dirección del contrato y el App ID de Privy.
- **Solo en `.env`:** `PRIVY_APP_SECRET`, `BASE_SEPOLIA_RPC_URL` (incluye la key), `ETHERSCAN_API_KEY` y
  `PAYMASTER_URL`.
- **Con nadie:** la clave privada de MetaMask, la frase semilla y la contraseña del keystore.
