# Demo pública para portafolio (`demo.extan.io`)

Plan para publicar extan en `https://demo.extan.io` sobre **Base Sepolia** (USDC de prueba), como pieza de portafolio
de desarrollo web3. Usa el contrato que ya está desplegado y planes gratuitos: solo el dominio tiene costo.

**No incluye** lo que exige el dinero real (Fase 8 del [roadmap](roadmap.md)): auditoría, entidad que factura la
comisión, on-ramp, textos legales, Safes multisig ni mainnet. En testnet, owner, árbitro y treasury siguen siendo las
cuentas MetaMask de prueba.

**Sin aviso de demo:** el subdominio ya lo dice y el sitio no se registra en Search Console.

Guías relacionadas: [credenciales.md](credenciales.md) (detalle de cada servicio),
[prueba-local-sepolia.md](prueba-local-sepolia.md) (paso 9, paymaster) y
[entorno-pruebas-sepolia.md](entorno-pruebas-sepolia.md) (direcciones y cuentas de prueba).

## Resumen

| # | Paso | Quién | Depende de | Resultado |
|---|---|---|---|---|
| 1 | Comprar `extan.io` | Tú | — | Dominio y acceso a su DNS |
| 2 | Verificar el contrato en Basescan | Tú (API key) + Claude | — | Código del contrato legible en Basescan |
| 3 | Análisis estático con Slither | Claude | — | `docs/analisis-estatico.md` |
| 4 | Cambios de código para la demo | Claude | — | Límite de solicitudes, páginas de error, keepalive, build OK |
| 5 | Supabase en la nube | Tú (proyecto) + Claude (migraciones) | — | Base de datos de la demo |
| 6 | Gas patrocinado (paymaster y smart wallets) | Tú (dashboards) | — | Depositar sin tener ETH |
| 7 | Resend con dominio verificado | Tú | 1 | Emails a cualquier destinatario |
| 8 | Alchemy y Privy para el dominio | Tú | 1 | RPC del navegador y login en el dominio |
| 9 | Vercel y `demo.extan.io` | Tú (proyecto) + Claude (variables) | 1, 4, 5, 7, 8 | App publicada |
| 10 | Recorrido completo en la URL pública | Tú + Claude | 6, 9 | Checklist en verde |
| 11 | README como caso de estudio | Claude | 2, 3, 10 | Portada del repositorio |

Los pasos 2, 3 y 4 no dependen del dominio. **Avance al 2026-11-12:** 3 y 4 listos; del 2 falta solo Basescan, que
espera tu API key.

**Cuentas que necesitas.** Ya tienes Privy, Alchemy, MetaMask y GitHub. Faltan:
- un registrador de dominio (sugerido: Cloudflare Registrar, que vende `.io` a precio de costo y deja el DNS en el
  mismo panel);
- [Etherscan](https://etherscan.io), [Supabase](https://supabase.com),
  [Coinbase Developer Platform](https://portal.cdp.coinbase.com), [Resend](https://resend.com) y
  [Vercel](https://vercel.com) (entra con GitHub). Todas gratis.

**Secretos:** nunca por el chat. Los pegas tú en Vercel o en `.env`. Las direcciones públicas sí pueden ir por el chat.

---

## 1. Dominio (Tú)

1. Compra `extan.io`. Si el registrador ofrece privacidad de WHOIS, actívala.
2. Deja el DNS en el registrador. Ahí se crean después:
   - el registro de `demo.extan.io` que apunta a Vercel (paso 9);
   - los registros de envío de Resend (paso 7).
3. Avísame cuando esté listo.

## 2. Contrato verificado en Basescan

Verificado, cualquiera puede leer el código de `0xb7BABf0046fb8Bb2E3Ea0e6B75abdDEb31B9F863` en el explorador: es de
lo que más suma en un portafolio web3.

- [x] **Blockscout y Sourcify** (2026-11-12, coincidencia exacta): `forge verify-contract` con los argumentos del
      constructor del deploy (`packages/contracts/broadcast/DeployMilestoneEscrow.s.sol/84532/run-latest.json`).
      [Ver en Blockscout](https://base-sepolia.blockscout.com/address/0xb7BABf0046fb8Bb2E3Ea0e6B75abdDEb31B9F863?tab=contract).
- [ ] **Basescan:**
  1. **Tú:** en [etherscan.io](https://etherscan.io) crea una cuenta y una API key (con la API v2 la misma key sirve
     para Basescan). Agrégala tú a `.env` en la raíz: `ETHERSCAN_API_KEY=<key>`.
  2. **Claude:** el mismo `forge verify-contract`, con `--chain base-sepolia` y la key.
  3. **Resultado:** la pestaña *Contract* de Basescan muestra el código con el check de verificado. El link va al
     README.

## 3. Análisis estático con Slither (Claude) ✓

**Hecho el 2026-11-12:** cero hallazgos en `MilestoneEscrow.sol`, en todas las severidades. Los 79 que aparecen sin
filtro son de OpenZeppelin y están explicados. El contrato desplegado se mantiene. Informe:
[analisis-estatico.md](analisis-estatico.md).

[Slither](https://github.com/crytic/slither) (Trail of Bits) revisa el contrato en busca de patrones de riesgo
conocidos: reentrancia, llamadas externas, control de acceso, variables sin usar, etc. No reemplaza una auditoría: es
el primer filtro, y gratis. Python 3.13 ya está instalado en esta máquina.

1. `pip install slither-analyzer` y `slither packages/contracts`, con Foundry en el `PATH`.
2. Cada hallazgo queda en `docs/analisis-estatico.md`, como corregido o como aceptado con su razón. Muchos son
   informativos o falsos positivos, y explicarlos también muestra criterio.
3. Si un hallazgo obliga a cambiar el contrato, lo decidimos juntos antes: se corrige con tests, y la demo necesita
   un deploy nuevo, verificarlo otra vez (paso 2) y actualizar la dirección en las variables.
4. Opcional: [Aderyn](https://github.com/Cyfrin/aderyn) (Cyfrin) como segunda opinión. Pendiente: instalarlo
   requiere tu permiso (`npx @cyfrin/aderyn` o `cyfrinup`).

## 4. Cambios de código para la demo (Claude) ✓

Hecho el 2026-11-12:

- **Límite de solicitudes** (migración `0003_rate_limits.sql`): un contador por ventana fija en Postgres
  (`consume_rate_limit`), sin servicios extra. Al pasarse responde 429 con un mensaje en español y el header
  `Retry-After`. Las reglas viven en `apps/web/src/lib/server/rate-limit.ts`:

  | Ruta | Límite | Por |
  |---|---|---|
  | `POST /api/escrows` (crea el link y envía la invitación) | 10 por hora y 30 por día | Cuenta |
  | Entregables | 20 por hora | Cuenta |
  | Evidencias | 20 por hora | Cuenta |
  | `POST /api/escrow/sync` (pública) | 60 por hora | IP, guardada como HMAC |

  Además, el sync espera el recibo como máximo 10 s (antes 30 s, con la función abierta hasta 60 s): el frontend ya
  lo esperó en su RPC, así que aquí solo cubre el desfase entre nodos.
- **Páginas de error con la marca:** `error.tsx` (reintentar o volver al inicio), `global-error.tsx` (si falla el
  layout) y `loading.tsx`.
- **Keepalive de Supabase:** el plan gratuito pausa el proyecto tras 7 días sin actividad. Un cron diario de Vercel
  (`apps/web/vercel.json`, 12:00 UTC) llama a `/api/cron/keepalive`, que consulta la base y borra los contadores
  vencidos. Con `CRON_SECRET` definida, la ruta exige `Authorization: Bearer <CRON_SECRET>`, que Vercel envía solo.
- **Build de producción:** `pnpm --filter @escrow/web build` pasa.
- **Limpieza:** `@x402/core`, `@x402/evm` y `@x402/svm` salieron de `package.json`. Siguen en el lockfile como
  dependencias opcionales de Privy y del SDK de Coinbase, que pnpm instala solo.
- Typecheck, lint, 55 tests de Foundry, 27 de `@escrow/shared` y 47 pgTAP pasan.

## 5. Supabase en la nube

1. **Tú:** crea un proyecto `extan-demo` en el plan Free, región South America (São Paulo). Guarda la contraseña de la
   base en tu gestor de contraseñas.
2. **Tú:** en *Project Settings → API Keys* están la URL, la publishable key y la secret key. Van a Vercel en el paso
   9, no al chat.
3. **Claude:** aplica las migraciones (`supabase link --project-ref <ref>` y `supabase db push`). El login de la CLI
   es interactivo: lo corres tú con `! pnpm exec supabase login`.
4. La base nueva parte vacía: las cuentas se crean solas al ingresar. Son tres migraciones; la tercera es la del
   límite de solicitudes (paso 4).

## 6. Gas patrocinado: paymaster y smart wallets (Tú)

Sin este paso, un visitante con cuenta nueva no tiene ETH para el gas y no puede depositar.

**El código ya está listo.** `use-escrow-transactions.ts` envía `approve` y el depósito en una sola operación con gas
patrocinado, y el servidor usa la dirección de la smart wallet del usuario. Falta configurarlo y probarlo (quedó como
opcional en la Fase 3).

1. **Coinbase Developer Platform:** paymaster en Base Sepolia con su allowlist de contratos, como indica
   [credenciales.md](credenciales.md), sección 6. Funciones: `approve` en USDC; `createAndFundEscrow`,
   `releaseMilestone`, `refundMilestone` y `raiseDispute` en el contrato. Define también un límite de gasto por
   usuario.
2. **Privy → Smart wallets:** actívalas, elige **Coinbase Smart Wallet** y, en Base Sepolia, pega el endpoint del paso
   anterior como URL de bundler y de paymaster.
3. **Antes de publicar:** al activar las smart wallets cambia la dirección de cada usuario (pasa a ser la de su smart
   wallet). En la base nueva no hay usuarios, así que no afecta. Quien entre con MetaMask u otra wallet externa sigue
   pagando su propio gas.
4. Se prueba en el paso 10. Si falla, lo depuro.

Privy también tiene patrocinio nativo (`sponsor: true`, con EIP-7702) para las wallets embebidas. No lo recomiendo
mientras este camino funcione: exige su modo de ejecución TEE, cobra una comisión por el servicio y cambiaría la forma
en que USDC valida la firma del `permit`.

## 7. Resend con dominio verificado (Tú)

1. En [resend.com](https://resend.com), crea una API key con permiso de envío.
2. En **Domains**, agrega `notificaciones.extan.io`. Un subdominio de envío protege la reputación del dominio
   principal.
3. Copia en tu DNS los registros que te muestra (SPF/MX y DKIM) y presiona *Verify*. Recomendado: DMARC con un TXT en
   `_dmarc.extan.io` y valor `v=DMARC1; p=none;`.
4. Valores para Vercel:
   ```dotenv
   RESEND_API_KEY=re_...
   EMAIL_FROM="extan <hola@notificaciones.extan.io>"
   EMAIL_REPLY_TO=<tu email>
   ```

El plan gratuito permite 3.000 emails al mes y 100 al día: sobra para una demo, y el límite del paso 4 lo protege.

## 8. Alchemy y Privy para el dominio (Tú)

- **Alchemy:** crea una app nueva, `extan demo` (Base Sepolia). En la seguridad de su key, restringe el dominio a
  `demo.extan.io`. Su URL va en `NEXT_PUBLIC_BASE_RPC_URL`: la ve el navegador, por eso va restringida. La URL actual
  del servidor sigue como `BASE_SEPOLIA_RPC_URL` (secreta).
- **Privy:** en *Domains / Allowed origins*, agrega `https://demo.extan.io` y mantén `http://localhost:3000`. Para la
  demo sirven las credenciales de Google por defecto de Privy; los métodos de login quedan como hoy.

## 9. Vercel y `demo.extan.io`

1. **Tú:** en [vercel.com](https://vercel.com), entra con GitHub, *Add New → Project* e importa `john-Mcan/escrow`
   (Vercel pide acceso al repositorio aunque sea privado).
2. Configuración del proyecto:
   - **Root Directory:** `apps/web`;
   - **Framework:** Next.js;
   - **Node.js:** 22.x;
   - instalación y build por defecto: detecta pnpm por el lockfile de la raíz.
3. Carga las variables de la tabla de abajo en *Settings → Environment Variables* (entorno Production).
4. Haz el deploy. Luego, en *Settings → Domains*, agrega `demo.extan.io`. Vercel te muestra un registro CNAME para
   crearlo en tu DNS. Si el DNS está en Cloudflare, déjalo sin proxy (nube gris).
5. El plan Hobby es gratis para uso no comercial: un portafolio entra ahí.

**Las variables `NEXT_PUBLIC_*` se fijan al compilar:** si cambias una, hay que volver a desplegar.

### Variables de entorno en Vercel

| Variable | Valor | Origen | Secreta |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://demo.extan.io` | — | No |
| `NEXT_PUBLIC_CHAIN_ID` | `84532` | Base Sepolia | No |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS` | `0xb7BABf0046fb8Bb2E3Ea0e6B75abdDEb31B9F863` | Deploy del 2026-11-10 | No |
| `ESCROW_DEPLOYMENT_BLOCK` | `57096254` | Ídem (aún sin uso; queda para el indexador) | No |
| `NEXT_PUBLIC_USDC_ADDRESS` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | USDC de Circle en Base Sepolia | No |
| `NEXT_PUBLIC_BASE_RPC_URL` | URL de Alchemy restringida al dominio | Paso 8 | No (restringida) |
| `BASE_SEPOLIA_RPC_URL` | URL de Alchemy del servidor | Tu `.env` actual | Sí |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Igual que en `.env` | Privy | No |
| `PRIVY_APP_SECRET` | Igual que en `.env` | Privy | Sí |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Paso 5 | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | Paso 5 | No |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` | Paso 5 | Sí |
| `RESEND_API_KEY` | `re_...` | Paso 7 | Sí |
| `EMAIL_FROM` | `extan <hola@notificaciones.extan.io>` | Paso 7 | No |
| `EMAIL_REPLY_TO` | Tu email | — | No |
| `ARBITRATION_ADMIN_EMAILS` | Tu email | Acceso a `/arbitration` | No |
| `CRON_SECRET` | Texto aleatorio de 32+ caracteres (por ejemplo, de tu gestor de contraseñas) | Protege el cron del paso 4 | Sí |

**No van en Vercel:** `ANVIL_RPC_URL`, `BASE_MAINNET_RPC_URL`, `ETHERSCAN_API_KEY`, `ESCROW_OWNER`, `ESCROW_ARBITER`,
`ESCROW_FEE_RECIPIENT` y `ESCROW_PLATFORM_FEE_BPS` (solo los usan el deploy y la verificación), ni `PAYMASTER_URL` (se
configura en Privy).

## 10. Recorrido en la URL pública (Tú + Claude)

- [ ] La portada carga bien en escritorio y en el teléfono.
- [ ] Ingreso con email (código): crea la cuenta y su smart wallet.
- [ ] Ingreso con Google.
- [ ] Ingreso con wallet externa (MetaMask).
- [ ] Crear un link y recibir la invitación en otro correo, fuera de spam.
- [ ] Con la cuenta del cliente: *Recibir USDC*, pedir USDC en [faucet.circle.com](https://faucet.circle.com) y
      depositar **sin ETH**, con una sola confirmación.
- [ ] "Depositar" sin sesión: al ingresar, se abre el depósito.
- [ ] Entregable, liberar un hito y reembolsar otro.
- [ ] Disputa con evidencia y resolución desde `/arbitration` con la MetaMask del árbitro.
- [ ] Llegan los emails de cada evento.
- [ ] El límite de solicitudes responde con su mensaje al pasarse.
- [ ] Una ruta inexistente y un error muestran las páginas con la marca.

Este recorrido también cierra las pruebas de ingreso pendientes de la Fase 4 (Google, wallet externa y depositar sin
sesión).

## 11. README como caso de estudio (Claude)

**Adelantado el 2026-11-12:** `README.md` en inglés y `README.es.md` en español, con capturas de localhost
(`docs/images/`), diagrama, decisiones técnicas, calidad y licencia. Las instrucciones de desarrollo pasaron a
[desarrollo.md](desarrollo.md) y el diseño a [arquitectura.md](arquitectura.md). Al terminar el paso 10 falta:

- el link a la demo (hoy dice "pronto") y la sección *Cómo probar la demo*;
- opcional: un GIF corto del depósito.

Contenido planificado:

- **Qué es y qué problema resuelve**, en un párrafo, con links a la demo, al contrato verificado y al informe de
  análisis estático.
- **Capturas** de escritorio y teléfono, y opcionalmente un GIF corto del depósito.
- **Arquitectura:** diagrama del navegador (Privy, wagmi), la API de Next, Supabase, el contrato en Base y el RPC
  propio con el que se reconcilia.
- **Decisiones técnicas:**
  - modelo no-custodio;
  - `permit` EIP-2612 frente a smart wallet con gas patrocinado;
  - el servidor lee el recibo desde su propio RPC y no confía en el frontend;
  - idempotencia por `(tx_hash, log_index)` y RLS;
  - un árbitro multisig que reparte pero nunca puede quedarse con los fondos.
- **Calidad:** 55 tests de Foundry con fuzzing y 100 % de cobertura, 47 tests pgTAP y el análisis de Slither.
- **Cómo probar la demo:** ingresar con email, *Recibir USDC* y [faucet.circle.com](https://faucet.circle.com) (20
  USDC cada 2 horas), crear un link para otro correo y depositar sin ETH.
- **Qué falta para producción:** auditoría, legal y on-ramp. Decirlo muestra criterio.

## Opcionales que suman al portafolio

- **CI con GitHub Actions** (Fase 5): `forge test`, pgTAP, lint, typecheck y build en cada push, con la insignia verde
  en el README.
- **Acuerdo de ejemplo:** un `/pay/...` con hitos en distintos estados, enlazado desde el README, para ver el checkout
  sin crear cuenta.
- **Repositorio público:** hoy es privado. Antes de abrirlo:
  - ~~reemplazar los emails personales de las guías de prueba~~ (hecho el 2026-11-12; siguen en el historial de
    git y en el autor de los commits);
  - ~~licencia~~: todos los derechos reservados, con el contrato en MIT (`LICENSE`, 2026-11-12);
  - revisar el historial completo con [gitleaks](https://github.com/gitleaks/gitleaks) para confirmar que nunca se
    subió un secreto.
- **`noindex`**, si más adelante no quieres que la demo aparezca en buscadores.

## Costos

- **Dominio `.io`:** depende del registrador; orientativamente, entre 30 y 60 USD al año.
- **Sin costo:** Vercel Hobby, Supabase Free, Resend Free, Alchemy Free, Etherscan y Coinbase Developer Platform en
  testnet (créditos gratuitos).
