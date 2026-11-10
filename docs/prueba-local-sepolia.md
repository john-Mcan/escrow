# Probar en localhost con Base Sepolia

Guía para revisar Hito en `http://localhost:3000` con login real (Privy), wallets reales y USDC de prueba en
**Base Sepolia**. La base de datos sigue siendo el Supabase local y los correos se escriben en la consola del servidor.

Es el camino mínimo para ver el producto como lo usaría un cliente. Para staging y producción, la guía completa es
[credenciales.md](credenciales.md).

> **¿Solo quieres retomar las pruebas?** El entorno ya está armado (contrato, cuentas y usuarios):
> [entorno-pruebas-sepolia.md](entorno-pruebas-sepolia.md).

> **Solo cuentas de prueba.** Las wallets de esta guía no deben recibir dinero real ni reutilizarse en mainnet. En
> producción, owner, árbitro y treasury son Safes multisig con hardware wallet.

Esta guía se recorrió completa el 2026-11-10. Los pasos reflejan lo que funcionó ese día.

## Resumen

| # | Qué | ¿Obligatorio? | Quién | Resultado |
|---|---|---|---|---|
| 1 | Revisar la configuración de Privy | Sí | Tú | `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET` |
| 2 | Alchemy (RPC) | Sí | Tú | `BASE_SEPOLIA_RPC_URL` |
| 3 | MetaMask con 3 cuentas de prueba | Sí | Tú | `ESCROW_OWNER`, `ESCROW_ARBITER`, `ESCROW_FEE_RECIPIENT` |
| 4 | ETH de Base Sepolia (faucet) | Sí | Tú | Gas para el deploy y las pruebas |
| 5 | Wallet de deploy (keystore de Foundry) | Sí | Claude | Firma del deploy, fuera de `.env` |
| 6 | Completar `.env` | Sí | Claude | Variables de Base Sepolia |
| 7 | Deploy del contrato | Sí | Claude | `NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS`, `ESCROW_DEPLOYMENT_BLOCK` |
| 8 | Etherscan | No | Tú + Claude | Código verificado en Basescan |
| 9 | Paymaster + smart wallets | No | Tú | Probar el depósito sin gas |
| 10 | Usuarios de prueba + USDC | Sí | Tú + Claude | Cuentas de cliente y proveedor con saldo |

**No hacen falta:** Safes (en testnet bastan cuentas normales), Supabase cloud (sigue el local) ni Resend (sin
`RESEND_API_KEY` los correos aparecen en la terminal de `pnpm dev`).

**Quién hace qué:**
- **Tú:** creas las cuentas (Privy, Alchemy, MetaMask), pides ETH y USDC en los faucets, envías una parte del ETH a la
  wallet de deploy, entras con los usuarios de prueba y haces el recorrido.
- **Claude:** crea la wallet de deploy y completa `.env`. También despliega, reparte el ETH de gas desde la wallet de
  deploy, reinicia la base local (con tu autorización), levanta la app y lee los emails del registro.
- Las direcciones públicas se pasan por el chat. Los secretos van solo en `.env`.

---

## 1. Privy: revisar la configuración

En [dashboard.privy.io](https://dashboard.privy.io), dentro de tu app (los nombres de los menús pueden variar):

1. **Login methods:** Email, Google y External wallets (MetaMask, Coinbase Wallet, Rainbow, WalletConnect).
2. **Embedded wallets → Ethereum:** creación automática para usuarios sin wallet (*users without wallets*). La app
   también lo pide desde el código (`apps/web/src/components/providers.tsx`), así que funciona aunque el dashboard lo
   tenga apagado.
3. **Domains / Allowed origins:** agrega `http://localhost:3000`. Si la lista queda vacía, Privy acepta cualquier
   origen: sirve para localhost, pero en producción hay que restringirla.
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

MetaMask es una billetera: guarda las claves de tus cuentas y te pide aprobar cada operación. Usamos la **extensión del
navegador** (Chrome o Edge). La app del celular no sirve, porque no ve el `localhost` de tu PC.

1. **Perfil dedicado:** en Chrome, ícono de perfil → **Agregar** → "Hito pruebas". Así tus wallets reales quedan
   aparte, y este perfil será también el del árbitro.
2. **Instalar:** solo desde [metamask.io](https://metamask.io) → *Download*. Te lleva a la Chrome Web Store; revisa que
   el publicador sea **metamask.io** → *Agregar a Chrome*. Para tenerla a mano: ícono de **pieza de rompecabezas** →
   **chincheta** junto a MetaMask (aparece el zorro naranja).
3. **Crear wallet:** *Crear una wallet nueva* (no importar) → contraseña → anota la **frase de recuperación** en papel.
4. **Agregar Base Sepolia a mano.** MetaMask solo muestra las redes principales. En sus redes de prueba aparece
   **"Sepolia" a secas, que es la testnet de Ethereum: no sirve**.
   1. En la pantalla de inicio, haz clic en el botón **"Todas las redes predeterminadas"** (arriba de la lista de
      monedas).
   2. Pestaña **Personalizado** → **Agregar red personalizada**. Si el campo de RPC no deja escribir, primero
      **Agregar URL de RPC**.

   | Campo | Valor |
   |---|---|
   | Nombre de la red | `Base Sepolia` |
   | URL de RPC | `https://sepolia.base.org` |
   | ID de cadena | `84532` |
   | Símbolo de moneda | `ETH` |
   | URL del explorador de bloques | `https://sepolia.basescan.org` |

   3. Elige **Base Sepolia** en ese mismo botón. MetaMask puede mostrar un valor en USD junto al ETH de prueba: es solo
      visual, el ETH de prueba no vale nada.
5. **Tres cuentas:** menú de cuentas (arriba) → **⋮** → renombrar la primera a **Hito Owner**. Luego
   **Agregar cuenta** → **Hito Árbitro**, y otra → **Hito Treasury**.
   - **Hito Owner:** administra el contrato (pausa, fee, límites) y recibe el ETH del faucet. No despliega: el deploy
     lo firma una wallet aparte (paso 5).
   - **Hito Árbitro:** firma las resoluciones de disputas desde `/arbitration`.
   - **Hito Treasury:** recibe la comisión de la plataforma.
6. **Copiar las direcciones:** haz clic en la dirección (`0x…`) bajo el nombre de cada cuenta y pégalas en el chat. Son
   públicas, y la misma dirección vale en todas las redes.

El contrato no permite que el árbitro sea cliente o proveedor de un acuerdo. Por eso cliente y proveedor serán cuentas
con email (paso 10), nunca estas.

## 4. ETH de Base Sepolia

**Faucet que funcionó (2026-11-10): [Superchain Faucet](https://console.optimism.io/faucet), 0,01 ETH cada 24 horas.**

1. En **Network**, elige **Base Sepolia** (no "Sepolia" ni "OP Sepolia").
2. **Connect Wallet** → **MetaMask** → marca solo **Hito Owner** → *Conectar*. Firmar un mensaje de inicio de sesión
   es gratis; si pidiera aprobar una transacción o un gasto, recházalo.
3. **Link Github** → autoriza en GitHub (solo pide el perfil básico).
4. **Claim.** La dirección se completa sola con la de Hito Owner y no se puede editar. Los fondos tardan unos minutos.

No hace falta verificar identidad (World ID, Coinbase Verification, Gitcoin, EAS): eso solo sube el monto a 0,1 ETH.

**Otros faucets:**

| Faucet | Resultado |
|---|---|
| [QuickNode](https://faucet.quicknode.com/base/sepolia) | Falló: "Insufficient ETH mainnet balance" (pide saldo en mainnet) |
| [Alchemy](https://www.alchemy.com/faucets/base-sepolia) | Pide 0,001 ETH en Ethereum mainnet |
| [Coinbase Developer Platform](https://portal.cdp.coinbase.com/products/faucet) | Requiere cuenta; entrega 0,0001 ETH por pedido |

**Pasar ETH a la wallet de deploy.** Cuando Claude te dé la dirección del paso 5, en MetaMask (Hito Owner) →
**Enviar** → moneda **Ethereum** con la marca **B** (Base Sepolia) → pega la dirección → **0.005** → *Continuar* →
*Confirmar*. Con eso alcanza para el deploy y para repartir gas al árbitro y a los usuarios. No hace falta enviar nada
más desde MetaMask.

**Costos medidos:** el deploy costó ≈ 0,00003 ETH, y cada transacción de usuario ≈ 0,000002 ETH.

## 5. Wallet de deploy (Claude, Git Bash)

El deploy lo firma una wallet **nueva y aparte**, creada con Foundry. Así no hay que exportar ninguna clave de
MetaMask. El contrato recibe el owner como parámetro (`Ownable(initialOwner)`), así que la wallet de deploy no conserva
ningún permiso después del deploy.

```bash
export PATH="$HOME/.foundry/bin:$PATH"
PW="$HOME/.foundry/deployer-sepolia.password"
node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("base64url"))' > "$PW"
cast wallet new deployer --unsafe-password "$(cat "$PW")"
cast wallet address --account deployer --password-file "$PW"
```

- El keystore queda cifrado en `%USERPROFILE%\.foundry\keystores\deployer`, y su contraseña aleatoria en
  `%USERPROFILE%\.foundry\deployer-sepolia.password`, fuera del repo. Con ese archivo Claude puede firmar sin prompts
  (`--password-file`).
- Guardar la contraseña junto al keystore solo es aceptable en testnet. En mainnet se despliega con hardware wallet o
  con keystore interactivo ([credenciales.md](credenciales.md)).
- Alternativa: importar la clave de Hito Owner con `cast wallet import deployer --interactive` en PowerShell. Funciona,
  pero obliga a exportar la clave privada desde MetaMask.

## 6. Completar `.env`

El deploy lee las direcciones y el RPC desde `.env`, así que este paso va **antes** del paso 7. Antes de cambiarlo,
conviene guardar una copia del entorno anterior (`cp .env .env.anvil`; los `.env.*` están en `.gitignore`).

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

- `NEXT_PUBLIC_CHAIN_ID` y la dirección del contrato se cambian juntos en el paso 7. Con `84532` y la dirección de
  Anvil, la app apuntaría a un contrato que no existe.
- No pongas comentarios al final de una línea con valor (`CLAVE=valor # comentario`): el comentario quedaría dentro del
  valor.
- El `.env` usa saltos de línea LF, así que `set -a; . ./.env; set +a` funciona en Git Bash. Si alguna herramienta lo
  deja con CRLF, Git Bash agrega un `\r` a cada valor: revísalo con `tr -cd '\r' < .env | wc -c` (debe dar 0).

## 7. Deploy en Base Sepolia (Claude, Git Bash)

```bash
cd /c/proyectos/escrow
export PATH="$HOME/.foundry/bin:$PATH"
set -a; . ./.env; set +a
cd packages/contracts
PW="$HOME/.foundry/deployer-sepolia.password"

# 1. Simulación: no envía nada; muestra direcciones, parámetros y costo estimado
forge script script/DeployMilestoneEscrow.s.sol --rpc-url base_sepolia --account deployer --password-file "$PW"

# 2. Envío
forge script script/DeployMilestoneEscrow.s.sol --rpc-url base_sepolia --account deployer --password-file "$PW" --broadcast
```

Si tienes la key de Etherscan (paso 8), agrega `--verify` al envío.

La dirección y el bloque quedan en `packages/contracts/broadcast/DeployMilestoneEscrow.s.sol/84532/run-latest.json`
(se versiona en git). Con ellos se completa `.env`:

```dotenv
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=0x...
ESCROW_DEPLOYMENT_BLOCK=<bloque>
```

**Verificar en la red.** El getter del árbitro es `defaultArbiter()`, no `arbiter()`:

```bash
for f in "owner()(address)" "defaultArbiter()(address)" "feeRecipient()(address)" "platformFeeBps()(uint256)"; do
  cast call <dirección> "$f" --rpc-url "$BASE_SEPOLIA_RPC_URL"
done
```

Después se envía gas al árbitro desde la wallet de deploy (el árbitro paga `resolveDispute`):

```bash
cast send <Hito Árbitro> --value 0.001ether --rpc-url "$BASE_SEPOLIA_RPC_URL" --account deployer --password-file "$PW"
```

**Con keystore interactivo (PowerShell):** carga el `.env` con este bloque y usa `--account deployer` sin
`--password-file`; Foundry pide la contraseña.

```powershell
Get-Content ..\..\.env | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim().Trim('"'), 'Process')
  }
}
```

## 8. (Opcional) Etherscan: código verificado

Con el código verificado, Basescan muestra el contrato legible y permite consultarlo desde la web.

1. Crea una cuenta en [etherscan.io](https://etherscan.io) → *API Keys* → *Add*. La API v2 usa la misma key para
   Base Sepolia.
2. En `.env`: `ETHERSCAN_API_KEY=<key>`.
3. Si la tienes antes del deploy, usa `--verify` en el paso 7. Si llega después, se puede verificar el contrato ya
   desplegado sin firmar nada.

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

- **Dos emails con "+":** `tucorreo+proveedor@...` y `tucorreo+cliente@...` llegan al mismo buzón, pero Privy los trata
  como cuentas distintas. Funcionó con Google Workspace (`upg.cl`), y Privy acepta emails con "+".
- **Sesiones separadas:** la sesión de Privy es por navegador.

  | Navegador | Quién | Login |
  |---|---|---|
  | Perfil "Hito pruebas" (con MetaMask) | Árbitro | Email de `ARBITRATION_ADMIN_EMAILS` + conectar Hito Árbitro |
  | Edge u otro perfil de Chrome | Proveedor | `tucorreo+proveedor@...` |
  | Ventana de incógnito (Ctrl+Shift+N) | Cliente | `tucorreo+cliente@...` |

- **Dirección de cada wallet:** al entrar con email, Privy crea una wallet embebida. La app hoy la muestra abreviada
  (anotado en la Fase 3). Claude la obtiene con la API de Privy (`GET https://auth.privy.io/api/v1/users`, con el App
  ID y el secret de `.env`); también aparece en el dashboard de Privy → **Users**. Con smart wallets activas, usa la
  dirección de la smart wallet.
- **ETH (solo sin paymaster):** Claude envía 0,001 ETH a cada wallet desde la wallet de deploy (`cast send`, paso 7).
- **USDC para el cliente:** [faucet.circle.com](https://faucet.circle.com) → USDC → red **Base Sepolia** → dirección de
  la wallet del cliente → *Send*. Entrega 20 USDC cada 2 horas y no pide cuenta. Crea acuerdos chicos (por ejemplo, 3
  hitos de 1 USDC).

## 11. Levantar la app

Con Docker Desktop corriendo:

```powershell
pnpm db:start
pnpm db:reset                    # borra todos los datos locales (p. ej. acuerdos de Anvil, red 31337)
pnpm --filter @escrow/web dev    # http://localhost:3000
```

- `db:reset` borra datos. Claude solo lo ejecuta con tu autorización explícita: el modo de permisos lo bloquea si no.
- En desarrollo, Next compila cada ruta la primera vez que se usa, y otra vez si pasa un rato sin usarse. Las primeras
  acciones tardan: el login 7-13 s y "Registrando el movimiento…" 12-23 s. Después baja a ≈ 1 s.
- Los emails aparecen en la terminal de `pnpm dev` con el prefijo `[email:dev]`, junto con los links `/pay/...`.

## 12. Recorrido de prueba

- [ ] **Proveedor:** entra con email → se crea su wallet → aparece el aviso de passkey (actívala para probar la
      biometría).
- [ ] **Proveedor:** `/dashboard/new` → acuerdo de 3 hitos con el email del cliente. La fecha de entrega estimada es
      opcional e informativa. El email de invitación aparece en la terminal de `pnpm dev`.
- [ ] **Cliente:** abre el link `/pay/...` → entra → **Depositar**. Privy abre dos ventanas: **Sign message** (el
      permit de USDC, gratis) y la confirmación de la transacción. El depósito aparece en Basescan y el acuerdo queda en
      garantía.
- [ ] **Proveedor:** **Subir entregable** (link `https://`) en el hito 1.
- [ ] **Cliente:** **Liberar fondos** en el hito 1 → el proveedor recibe el neto (0,985) y Hito Treasury la comisión
      (0,015).
- [ ] **Proveedor:** **Reembolsar hito** en el hito 2 → el cliente recupera el 100%.
- [ ] **Cliente o proveedor:** **Abrir disputa** en el hito 3. Después del diálogo hay que volver a hacer clic para
      enviar la evidencia (anotado para mejorar en la Fase 4).
- [ ] **Árbitro:** entra con el email de arbitraje → `/arbitration`.
  1. Haz clic en **"Conectar la hardware wallet del árbitro"**: es el texto centrado bajo el recuadro de la Safe y no
     parece botón.
  2. MetaMask → Hito Árbitro. Aparece **"Firmar con la wallet del árbitro conectada"**.
  3. Elige el reparto y firma. MetaMask puede ofrecer convertir la cuenta en "cuenta inteligente" y pagar el gas por
     ti (EIP-7702); la app lo registra igual.
  4. Ignora "Transacción para la Safe" y "Registrar resolución ejecutada en la Safe": son para producción.
- [ ] **Sync pendiente:** cierra la pestaña justo después de confirmar una transacción y vuelve a `/pay/...`. El
      estado debe ponerse al día solo.

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| `Variables de entorno públicas inválidas` al arrancar | Falta una variable o tiene formato inválido (App ID de 25 caracteres, direcciones `0x` + 40) |
| `block not found` o `503` en el deploy | RPC público: usa el de Alchemy (paso 2) |
| `insufficient funds` en el deploy | Falta ETH en la wallet de deploy (paso 4) |
| "Insufficient ETH mainnet balance" en un faucet | QuickNode y Alchemy piden saldo en mainnet: usa Superchain (paso 4) |
| En MetaMask solo aparece "Sepolia" | Es la testnet de Ethereum: agrega Base Sepolia a mano (paso 3) |
| El ETH llegó pero MetaMask muestra 0 | El filtro de redes no está en Base Sepolia (paso 3) |
| El cliente ve "Saldo insuficiente" | Faltan USDC o se enviaron a otra dirección (con smart wallets, la de la smart wallet) |
| La transacción falla por gas | Falta ETH en la wallet del usuario (sin paymaster) |
| `Cannot destructure property 'method' of 's.signMessage'` al depositar | Carrera entre ventanas de Privy, corregida en `e619830` con una pausa en `use-escrow-transactions.ts`. Si reaparece, sube `WALLET_MODAL_SETTLE_MS` |
| Aviso de Next "React does not recognize the `isActive` prop" | Interno de `@privy-io/react-auth`. Solo pasa en desarrollo y no rompe nada; se cierra con Esc |
| "Registrando el movimiento…" tarda 10-20 s | Compilación bajo demanda en desarrollo (paso 11) |
| No se ve "Conectar la hardware wallet del árbitro" | Es el texto centrado bajo el recuadro de la Safe (paso 12) |
| `/arbitration` no deja firmar | La wallet conectada no es Hito Árbitro o no está en Base Sepolia |
| "Este acuerdo pertenece a otra red" | Quedan datos de Anvil: `pnpm db:reset` |
| Las consultas del navegador fallan con `429`/`503` | Límite del RPC público: avísame y lo cambiamos |

## Qué compartir y qué no

- **Por el chat, sin problema:** las direcciones públicas (cuentas, wallet de deploy, contrato) y el App ID de Privy.
- **Solo en `.env`:** `PRIVY_APP_SECRET`, `BASE_SEPOLIA_RPC_URL` (incluye la key), `ETHERSCAN_API_KEY` y
  `PAYMASTER_URL`.
- **Solo en `%USERPROFILE%\.foundry\`:** el keystore y la contraseña de la wallet de deploy.
- **Con nadie:** la clave privada de MetaMask, la frase de recuperación y la contraseña de MetaMask.
