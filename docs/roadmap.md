# Roadmap a producción

Última actualización: 2026-11-09.

Plan de trabajo desde el estado actual hasta el lanzamiento en Base Mainnet. Cada fase cierra con una revisión antes
de pasar a la siguiente. Las casillas sirven para marcar avance.

## Resumen

| Fase | Objetivo | Depende de |
|---|---|---|
| 1 ✅ | Monorepo, contrato `MilestoneEscrow` y esquema de Supabase | — |
| 2 ✅ | `packages/shared` y `apps/web`: checkout, dashboard, arbitraje, sync on-chain y emails | 1 |
| **3** | Validación con servicios reales en Base Sepolia (localhost) | 2 |
| **4** | Marca: nombre, dominio e identidad visual + repaso de consistencia | 3 (puede empezar en paralelo) |
| **5** | Bases técnicas y staging | 3; dominio de la fase 4 |
| **6** | Sitio público, legal y cuenta de usuario | 4, 5 y frente legal |
| **7** | Producto para LatAm y cumplimiento | 5 y frente legal |
| **8** | Lanzamiento en Base Mainnet | Todas + auditoría |

Las fases 6 y 7 pueden ir en paralelo o invertirse: el on-ramp (fase 7) es el mayor hueco de producto, pero depende
de definiciones legales y de proveedores.

## Lo construido (fases 1 y 2)

- **Contrato:** escrow por hitos en USDC. La pausa solo bloquea depósitos nuevos, hay allowlist de tokens y snapshot
  de fee y árbitro por acuerdo, con límite de 5.000 USDC y 20 hitos. Tiene 55 tests (con fuzzing) y 100% de
  cobertura.
- **Base de datos:** RLS, logs append-only, checkout público sin datos sensibles e idempotencia por
  `(tx_hash, log_index)`. Tiene 39 tests pgTAP.
- **Backend:** verifica el JWT de Privy en el servidor. La reconciliación lee la transacción desde su propio RPC (no
  confía en el frontend). Incluye entregables, evidencias, listado de disputas y 7 emails con claves de idempotencia.
- **Frontend:** landing, dashboard, creación de cobros, checkout `/pay`, panel de arbitraje, 404, menú de usuario y
  aviso de passkey.
- **Seguridad base:** headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`), sin llaves
  privadas en el servidor; owner y árbitro como multisig.
- **Verificado en Anvil:** depósito, liberación, disputa, resolución y reembolso con montos exactos y sin duplicados.

---

## Frentes en paralelo (fuera del código, empezar ya)

Tienen plazos largos y sus respuestas pueden cambiar el producto.

- [ ] **Legal y regulatorio:** abogado en los países de lanzamiento. Preguntas clave:
  - ¿Un escrow no-custodio en USDC con árbitro que reparte fondos requiere registro? (Ley Fintech en México, Ley
    Fintec en Chile, marco de criptoactivos en Brasil, registro PSAV ante la CNV en Argentina, etc.)
  - ¿Qué KYC/AML aplica y desde qué monto?
  - ¿Qué entidad opera el servicio y cómo se factura la comisión?
- [ ] **Auditoría del contrato:** cotizar y reservar fecha (las firmas agendan con semanas de anticipación). El
  contrato se congela antes de auditar.
- [ ] **Entidad y facturación:** constitución o uso de una entidad existente, cuenta bancaria y emisión de
  comprobantes por la comisión.
- [ ] **Presupuesto mensual:** hosting, Supabase Pro, Privy, RPC, gas del paymaster, Resend, Sentry, dominio y
  auditoría.

## Decisiones pendientes

| Decisión | Afecta a | Fase |
|---|---|---|
| Países de lanzamiento (y si entra Brasil → portugués) | Legal, on-ramp, idiomas, marca | Antes de la 4 |
| Nombre definitivo y dominio | Staging, emails, legales, marca | 4 |
| Comisión definitiva (hoy 1,5%) y límite por acuerdo en la beta | Contrato (configurable), precios | 6–8 |
| Umbral de KYC | Onboarding, proveedor de KYC | 7 |
| Canal de soporte (email, WhatsApp, formulario) | Contacto, operación | 6 |
| Entregables como links o como archivos | Storage, seguridad | 7 |

---

## Fase 3: Validación en Base Sepolia (localhost)

**Objetivo:** probar todo con servicios reales antes de seguir construyendo.

- [ ] Credenciales y deploy según [prueba-local-sepolia.md](prueba-local-sepolia.md).
- [ ] Recorrer el flujo completo: login con email, Google y wallet; wallet embebida; passkey; crear cobro;
      depositar (permit); entregable; liberar; reembolsar; disputar; evidencia; resolver desde `/arbitration`;
      reintento de sync tras cerrar el navegador.
- [ ] Opcional: paymaster y smart wallets (depósito sin gas).
- [ ] Corregir lo que aparezca en el recorrido.
- [ ] Mostrar la dirección completa de la wallet con botón de copiar y el saldo de USDC. Hoy solo se ve abreviada, y
      el usuario necesita la dirección para recibir USDC.
- [ ] Quitar dependencias sin uso de `apps/web`: `@x402/core`, `@x402/evm` y `@x402/svm` (no se importan en ningún
      archivo).

**Cierre:** el recorrido de la guía pasa completo y los problemas encontrados quedan corregidos o anotados.

## Fase 4: Marca, nombre, dominio e identidad visual

**Objetivo:** definir la identidad antes de construir páginas públicas y aplicarla a todo lo que ya existe.

### Punto de partida

| Elemento | Hoy |
|---|---|
| Nombre | "Hito" (nombre de trabajo; wordmark en minúsculas, `hito`) |
| Tipografía | Figtree (texto) + Bricolage Grotesque (títulos), vía `next/font` |
| Paleta | "Tinta de cheque sobre papel frío": tinta `#14213d` sobre fondo `#f4f6f9` |
| Colores del dinero | `vault` azul `#2f4b8f` (en garantía), `seal` verde `#1b7356` (liberado), `caution` ámbar `#9a5b06` (disputa) |
| Logo | Provisional: tres bloques de una barra de hitos (el primero liberado) + wordmark |
| Modo oscuro | No existe (solo tema claro) |
| Assets | `public/` vacío; solo `favicon.ico`; sin imagen Open Graph ni iconos de app |
| Modal de Privy | `accentColor` `#14213d`, sin logo |
| Emails | Fuente del sistema, wordmark en texto, colores de la paleta |

### Decisiones

- [ ] **Nombre:** confirmar "Hito" o elegir otro. Validar:
  - dominio disponible;
  - búsqueda de marca registrada en los países objetivo (IMPI, INAPI, INPI, SIC…);
  - usuarios libres en redes;
  - que funcione en portugués si entra Brasil;
  - que no choque con competidores.
- [ ] **Dominio:** principal (`.com` ideal; alternativas `.app`, `.lat`, `.co`) y subdominios:
  - `staging.`;
  - uno de envío para emails (p. ej. `notificaciones.`) con SPF, DKIM y DMARC.

  Evaluar variantes defensivas.
- [ ] **Tipografía:** mantener o cambiar el par actual. Requisitos:
  - cifras tabulares para montos;
  - lectura cómoda en móvil;
  - acentos y ñ (y portugués);
  - licencia libre.
- [ ] **Color:** paleta principal y colores semánticos del dinero con contraste AA. Decidir si hay modo oscuro en el
      lanzamiento.
- [ ] **Estilo:**
  - personalidad (financiero y sobrio vs. cercano y freelance);
  - radios, sombras y densidad;
  - iconografía (hoy lucide);
  - ilustración o fotografía.
- [ ] **Logo:**
  - isotipo + wordmark en SVG, en versiones color, monocromo y sobre fondo oscuro;
  - favicon, `apple-touch-icon` e icono de app;
  - imagen Open Graph base;
  - logo para el modal de Privy y para los emails.
- [ ] **Voz y tono:** español neutro latinoamericano con tuteo (ya se usa) y un glosario fijo (hito, garantía,
      liberar, reembolso, disputa) para que la app, los emails y los textos legales digan lo mismo.

**Proceso:** preparo 2 o 3 direcciones completas (tipografía, paleta, logo y una pantalla real aplicada) en una
página para comparar. Eliges una, y la guía queda en `docs/marca.md`.

### Implementación

- [ ] Tokens en `apps/web/src/app/globals.css` (colores, radios, escala tipográfica) y fuentes en `layout.tsx`.
- [ ] Assets en `apps/web/public/` y `metadata` (iconos, imagen OG por defecto, `themeColor`).
- [ ] Componentes `Brand` y `BrandMark` con el logo final.
- [ ] Modal de Privy: logo, color de acento, tema y textos.
- [ ] Plantillas de email: encabezado con logo, colores y pie con los datos de la empresa.

### Repaso de consistencia de las superficies existentes

- [ ] Landing (`/`)
- [ ] Header y menú de usuario
- [ ] Dashboard (`/dashboard`) y creación de cobros (`/dashboard/new`)
- [ ] Checkout (`/pay/[id]`) en todos sus estados: sin fondos, en garantía, entregado, liberado, reembolsado, en
      disputa, resuelto
- [ ] Panel de arbitraje (`/arbitration`)
- [ ] 404, toasts y diálogos
- [ ] Los 7 emails transaccionales
- [ ] Accesibilidad (contraste, foco visible, lectores de pantalla) y diseño en móvil

**Cierre:** guía de marca aprobada, dominio comprado y todas las superficies existentes revisadas.

## Fase 5: Bases técnicas y staging

**Objetivo:** que el sistema sea operable, observable y resistente al abuso, con un entorno de staging público.

### Infraestructura

- [ ] **CI (GitHub Actions)** en cada PR:
  - `forge test` y `forge fmt --check`;
  - `supabase test db` (pgTAP);
  - lint, typecheck y build;
  - auditoría de dependencias.
- [ ] **Hosting** (Vercel u otro) con dominio propio y deploys de preview por PR.
- [ ] **Staging** en `staging.<dominio>` sobre Base Sepolia, con servicios propios:
  - app de Privy;
  - proyecto de Supabase (São Paulo);
  - Resend con el dominio verificado;
  - RPC con key restringida por dominio para el navegador.
- [ ] **Dependabot o Renovate** para actualizar dependencias.

### Robustez

- [ ] **Indexador de eventos:** un cron que lee los eventos del contrato desde el último bloque procesado y reutiliza
      `syncEscrowTransaction`.
  - El cursor se guarda en la base de datos y arranca en `ESCROW_DEPLOYMENT_BLOCK` (hoy definido pero sin uso).
  - Hoy la base solo se actualiza si alguien envía el `txHash`. El indexador cubre:
    - resoluciones firmadas desde la Safe sin registrar;
    - interacciones con el contrato fuera de la app;
    - navegadores que no vuelven.
- [ ] **Páginas de error:** `error.tsx`, `global-error.tsx` y `loading.tsx`, con la marca. Hoy un error de render
      muestra la pantalla genérica de Next.

### Seguridad

- [ ] **Rate limiting** (p. ej. Upstash o el WAF del hosting) en:
  - `POST /api/escrow/sync`: es pública y puede quedar hasta 60 s esperando un recibo. Además, acortar la espera
    para hashes desconocidos.
  - `POST /api/escrows`: envía la invitación a cualquier email, así que se puede usar para spam.
  - Entregables y evidencias.
- [ ] **Headers:**
  - CSP con las directivas que exigen Privy y WalletConnect;
  - HSTS;
  - `noindex` en `/dashboard`.
- [ ] **Roles de arbitraje:** guardarlos en la base de datos (hoy son una lista de emails en `.env`) y exigir passkey
      a los árbitros.
- [ ] **Runbook de incidentes:** cómo pausar el contrato desde la Safe, rotar secretos y avisar a los usuarios.
      Ensayarlo en staging.

### Observabilidad

- [ ] **Monitoreo:**
  - Sentry (frontend y API);
  - uptime;
  - alertas por syncs fallidos;
  - webhooks de Resend para rebotes y quejas.

**Cierre:** staging público con CI en verde, monitoreo activo y ensayo de pausa hecho.

## Fase 6: Sitio público, legal y cuenta de usuario

**Objetivo:** todo lo que un visitante, un cliente o un regulador espera encontrar.

### Sitio público

- [ ] **Footer global:** legales, contacto, redes y dirección del contrato.
- [ ] **Comisiones / Precios:** fee por liberación, reembolso sin comisión y cómo se calcula en una resolución.
- [ ] **Preguntas frecuentes:**
  - qué es USDC;
  - qué es una wallet y una passkey;
  - cómo pasar USDC a moneda local;
  - qué pasa si el cliente no responde;
  - cuánto tarda un pago.
- [ ] **Seguridad:** cómo funciona el modelo no-custodio, dirección verificada del contrato e informe de auditoría.
- [ ] **Contacto / soporte:** formulario con anti-bot, o email/WhatsApp según el canal elegido.
- [ ] Sobre nosotros (opcional).

### Legal

Son borradores para revisión del abogado: no se publican sin esa revisión.

- [ ] Términos y condiciones.
- [ ] Política de privacidad, según la ley de datos de cada país de lanzamiento.
- [ ] **Reglamento de disputas:**
  - plazos;
  - qué evidencia vale;
  - criterios del árbitro;
  - cómo se aplica la comisión en un reparto.
- [ ] **Aviso de riesgos:**
  - USDC lo emite Circle y puede congelarse;
  - las transacciones son irreversibles;
  - no somos banco ni custodio.
- [ ] Política de cookies, si se agrega analítica que la requiera.
- [ ] **Aceptación de términos:** casilla al crear un cobro y al depositar. Se guarda la versión y la fecha
      (migración nueva).

### Cuenta de usuario

- [ ] **Perfil y configuración:**
  - nombre visible (el API ya lo acepta, falta la pantalla);
  - email y wallet vinculados;
  - passkeys;
  - preferencias de email.
- [ ] Exportar datos y eliminar la cuenta (derechos que exigen las leyes de datos personales).

### SEO, vista previa y analítica

- [ ] Metadata por página, `robots.txt` y `sitemap.xml`.
- [ ] **Imagen OG dinámica para `/pay/[id]`:** título y monto en la vista previa del link. Este link se comparte por
      WhatsApp y la vista previa ayuda a que el cliente confíe y pague.
- [ ] **Analítica:** respetuosa de la privacidad (p. ej. Plausible o PostHog), con consentimiento si aplica.

**Cierre:** páginas publicadas en staging, textos legales revisados y aceptación de términos registrada.

## Fase 7: Producto para LatAm y cumplimiento

**Objetivo:** que alguien sin experiencia cripto pueda pagar y cobrar de punta a punta.

### Rampas de dinero

- [ ] **On-ramp para el cliente:** comprar USDC con tarjeta o transferencia dentro del checkout. Evaluar Coinbase
      Onramp, MoonPay, Transak y proveedores locales por cobertura, comisiones y KYC en cada país. Hoy un cliente sin
      USDC termina en "Saldo insuficiente".
- [ ] **Off-ramp para el proveedor:** de USDC a moneda local, con una integración o una guía con exchanges locales.

### Cumplimiento

- [ ] **Screening de sanciones** de las wallets al crear un cobro y al depositar.
- [ ] **KYC** según lo que defina el abogado (p. ej. proveedores por encima de cierto monto).

### Operación y soporte

- [ ] **Recordatorios por email (cron):**
  - entregable sin revisar;
  - cobro sin fondear;
  - disputa abierta.
- [ ] **Panel de soporte/admin:**
  - buscar acuerdos y usuarios;
  - ver la actividad;
  - reenviar emails.
- [ ] **Archivos:** subir entregables y evidencias a Supabase Storage con URLs firmadas y límites de tamaño y tipo. Hoy
      solo se aceptan links `https://`.
- [ ] **Comprobantes:** un recibo por cada pago y la facturación de la comisión según la entidad.
- [ ] **Portugués** (si entra Brasil).

**Cierre:** en staging, un cliente sin cripto paga de punta a punta y el proveedor recibe en moneda local.

## Fase 8: Lanzamiento en Base Mainnet

**Objetivo:** salir con dinero real, límites bajos y capacidad de respuesta.

### Contrato

- [ ] **Auditoría:** terminada, con hallazgos corregidos y re-testeados. Se publica el informe en la página de
      Seguridad y no se toca el contrato después.
- [ ] Considerar un programa de bug bounty.
- [ ] **Safes en Base Mainnet** (owner, árbitro y treasury) con firmantes en hardware wallet (p. ej. 2 de 3).
- [ ] **Deploy y verificación en mainnet:**
  - registrar `ESCROW_DEPLOYMENT_BLOCK`;
  - límite por acuerdo bajo para la beta (`setMaxEscrowAmount`).

### Producción

- [ ] **App de Privy de producción:** credenciales propias de Google OAuth, dominio de producción y política de MFA.
- [ ] **Servicios de producción:**
  - Supabase Pro con backups PITR;
  - paymaster de mainnet con presupuesto y límites por usuario;
  - RPC de pago si el volumen lo pide;
  - Resend con el dominio de producción.
- [ ] **Alertas on-chain** (p. ej. Tenderly): pausas, cambios de configuración y montos altos.

### Lanzamiento

- [ ] **Legal:** términos publicados y registros regulatorios completos, si aplican.
- [ ] **Beta cerrada:** pocos usuarios y límites bajos, con apertura gradual.

**Cierre:** primer acuerdo real liquidado en mainnet, con monitoreo y runbook activos.
