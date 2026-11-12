# Entorno de pruebas en Base Sepolia

Registro del entorno que quedó armado el **2026-11-10**, para retomar las pruebas sin repetir la configuración. Para
armarlo desde cero, la guía es [prueba-local-sepolia.md](prueba-local-sepolia.md).

> **Solo testnet.** Ninguna de estas cuentas debe recibir dinero real ni reutilizarse en mainnet.

## Retomar en 3 pasos

1. Abre **Docker Desktop** y espera a que diga *Engine running*.
2. En la raíz del repo:
   ```powershell
   pnpm db:start                    # Supabase local del proyecto escrow (API en 55321); conserva los datos
   pnpm --filter @escrow/web dev    # http://localhost:3000
   ```
3. Abre las tres sesiones de navegador (ver [Usuarios de prueba](#usuarios-de-prueba-privy)). Si la sesión de Privy
   expiró, vuelve a entrar con el mismo email: la wallet es la misma.

`.env` ya apunta a Base Sepolia y el contrato está desplegado: no hay que configurar ni desplegar nada.

## Contrato

| Dato | Valor |
|---|---|
| Red | Base Sepolia (chain ID `84532`) |
| `MilestoneEscrow` | [`0xb7BABf0046fb8Bb2E3Ea0e6B75abdDEb31B9F863`](https://sepolia.basescan.org/address/0xb7BABf0046fb8Bb2E3Ea0e6B75abdDEb31B9F863) |
| Bloque de deploy | `57096254` |
| USDC (Circle) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Comisión | 150 bps (1,5%), solo sobre lo que recibe el proveedor |
| Registro del deploy | `packages/contracts/broadcast/DeployMilestoneEscrow.s.sol/84532/run-latest.json` |

## Cuentas de MetaMask

En el perfil de Chrome **"Hito pruebas"**, con la red **Base Sepolia** agregada a mano.

| Cuenta | Dirección | Rol | Saldo (2026-11-10) |
|---|---|---|---|
| Hito Owner | `0xCBEBA7fD9825e69d94139b2582e477Cf30Dd6abe` | Owner del contrato (pausa, fee, límites) y reserva de ETH | 0,005 ETH |
| Hito Árbitro | `0xC08BA8E11C298EC8c33d044474abC1c0ACa14c8A` | Arbiter: resuelve disputas desde `/arbitration` | 0,001 ETH |
| Hito Treasury | `0x3694cefc7ac6aD5C76011368b4B71aEF91CEC581` | Recibe la comisión | 0,0285 USDC |

Desde la primera resolución, Hito Árbitro es una "cuenta inteligente" de MetaMask (EIP-7702), y MetaMask le pagó el
gas. La app lo maneja igual.

## Wallet de deploy (Foundry)

| Dato | Valor |
|---|---|
| Dirección | `0x98C152Dadf3D5129F02aE5E4671497dCcD66E51b` |
| Keystore | `%USERPROFILE%\.foundry\keystores\deployer` |
| Contraseña | `%USERPROFILE%\.foundry\deployer-sepolia.password` (fuera del repo) |
| Saldo (2026-11-10) | ≈ 0,00198 ETH |

La creó Claude con `cast wallet new` para desplegar y repartir ETH de gas. No tiene permisos sobre el contrato.

## Usuarios de prueba (Privy)

| Rol | Login | Wallet | Saldo (2026-11-10) | Navegador sugerido |
|---|---|---|---|---|
| Proveedor | `<tu-email>+proveedor@…` | `0xCCD9534412af6f21B3608870ce665e190aE028aA` (embebida) | 1,8715 USDC · ≈ 0,001 ETH | Edge u otro perfil de Chrome |
| Cliente | `<tu-email>+cliente@…` | `0x0880093F0BE970815D8e22d7DCA8e69f8443203B` (embebida) | 18,10 USDC · ≈ 0,001 ETH | Ventana de incógnito |
| Árbitro | `<tu-email>` (`ARBITRATION_ADMIN_EMAILS`) | Firma con Hito Árbitro de MetaMask | — | Perfil "Hito pruebas" |

Los tres son alias `+` del mismo correo, así que todos los códigos de login llegan a un solo buzón.

## Acuerdos creados

| Link | Detalle | Estado |
|---|---|---|
| [`/pay/GUr8C48BFZ`](http://localhost:3000/pay/GUr8C48BFZ) | "Trabajo de prueba 1": 3 hitos de 1 USDC, id on-chain `1` | Completado: hito 1 liberado, hito 2 reembolsado y hito 3 resuelto en disputa (10% cliente / 90% proveedor) |

## Dónde están los secretos

- **`.env`** (raíz, fuera de git): App ID y secret de Privy, RPC de Alchemy, keys de Supabase local, direcciones del
  contrato y de las cuentas, y `ARBITRATION_ADMIN_EMAILS`.
- **`.env.anvil`** (fuera de git): copia del entorno Anvil (31337) anterior. Para volver a Anvil, cópialo sobre `.env`
  y sigue [desarrollo.md](desarrollo.md).
- **Keystore y contraseña del deployer:** `%USERPROFILE%\.foundry\`.
- **Frase de recuperación de MetaMask:** solo la tienes tú. No va en ningún archivo.

## Recargar saldo

- **ETH de gas para el árbitro o los usuarios:** se envía desde la wallet de deploy (comando abajo). Si esa wallet se
  queda corta, pide ETH al faucet Superchain para Hito Owner y envía una parte al deployer
  ([guía, paso 4](prueba-local-sepolia.md#4-eth-de-base-sepolia)).
- **USDC para el cliente:** [faucet.circle.com](https://faucet.circle.com) → USDC → **Base Sepolia** → dirección del
  cliente. Entrega 20 USDC cada 2 horas, sin cuenta.

## Comandos útiles (Git Bash, desde la raíz)

```bash
export PATH="$HOME/.foundry/bin:$PATH"
RPC=$(grep -E '^BASE_SEPOLIA_RPC_URL=' .env | cut -d= -f2-)
PW="$HOME/.foundry/deployer-sepolia.password"
USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Saldo de ETH y de USDC (el USDC usa 6 decimales)
cast balance <dirección> --rpc-url "$RPC" --ether
cast to-unit $(cast call $USDC "balanceOf(address)(uint256)" <dirección> --rpc-url "$RPC" | awk '{print $1}') 6

# Enviar ETH de gas desde la wallet de deploy
cast send <dirección> --value 0.001ether --rpc-url "$RPC" --account deployer --password-file "$PW"

# Usuarios de Privy con sus wallets (usa el App ID y el secret de .env)
APP=$(grep -E '^NEXT_PUBLIC_PRIVY_APP_ID=' .env | cut -d= -f2-)
SEC=$(grep -E '^PRIVY_APP_SECRET=' .env | cut -d= -f2-)
curl -s -u "$APP:$SEC" -H "privy-app-id: $APP" "https://auth.privy.io/api/v1/users?limit=100"

# Estado de los acuerdos en la base local
docker exec supabase_db_escrow psql -U postgres -c "select short_code, status from escrows;"
```

En desarrollo, los emails no se envían: aparecen en la terminal de `pnpm dev` con el prefijo `[email:dev]`, junto con
los links (`/pay/...`).

## Pendiente de probar

Según la Fase 3 del [roadmap](roadmap.md):

- [ ] Login con **Google** y con **wallet externa** (MetaMask como usuario, no como árbitro).
- [ ] **Passkey**: el aviso "Protege tus pagos" y la confirmación biométrica al mover dinero.
- [ ] **Reintento de sync:** crear un acuerdo nuevo de 1 hito, cerrar la pestaña justo después de confirmar el depósito
      y volver a `/pay/...`. El estado debe ponerse al día solo.
