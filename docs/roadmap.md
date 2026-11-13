# Roadmap a producción

Última actualización: 2026-11-12.

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
  `(tx_hash, log_index)`. Tiene 47 tests pgTAP.
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

- [x] Credenciales y deploy según [prueba-local-sepolia.md](prueba-local-sepolia.md). `MilestoneEscrow` en
      [`0xb7BABf0046fb8Bb2E3Ea0e6B75abdDEb31B9F863`](https://sepolia.basescan.org/address/0xb7BABf0046fb8Bb2E3Ea0e6B75abdDEb31B9F863)
      (bloque 57096254, 2026-11-10).
- [ ] Recorrer el flujo completo: login con email, Google y wallet; wallet embebida; passkey; crear cobro;
      depositar (permit); entregable; liberar; reembolsar; disputar; evidencia; resolver desde `/arbitration`;
      reintento de sync tras cerrar el navegador.
  - [x] 2026-11-10, acuerdo `GUr8C48BFZ` (3 hitos de 1 USDC): login con email y wallet embebida, crear cobro,
        depositar con permit, entregable, liberar, reembolsar, disputar con evidencia y resolver desde
        `/arbitration` con MetaMask. Saldos on-chain cuadrados: el contrato quedó en 0 y la comisión llegó a
        Treasury. MetaMask envió la resolución como transacción EIP-7702 con gas pagado por su relayer, y el sync la
        reconcilió igual porque lee los eventos del contrato.
  - [ ] Login con Google y con wallet externa, passkey y reintento de sync tras cerrar el navegador.
- [ ] Opcional: paymaster y smart wallets (depósito sin gas).
- [ ] Corregir lo que aparezca en el recorrido.
  - [x] Depósito con wallet embebida: la ventana de firma de Privy fallaba (`Cannot destructure property 'method'
        of 's.signMessage'`) si la transacción se pedía antes de que terminara de cerrarse. Se agregó una pausa
        entre el permit y el depósito en `use-escrow-transactions.ts`.
- [x] Mostrar la dirección completa de la wallet con botón de copiar y el saldo de USDC. Hoy solo se ve abreviada, y
      el usuario necesita la dirección para recibir USDC. Hecho en la pasada de la Fase 4 (2026-11-11): el menú de
      cuenta muestra el saldo (con equivalente local) y "Recibir USDC" abre la dirección completa con QR; el depósito
      muestra lo mismo cuando falta saldo y espera la llegada del USDC.
- [x] Quitar dependencias sin uso de `apps/web`: `@x402/core`, `@x402/evm` y `@x402/svm` (no se importan en ningún
      archivo). Hecho el 2026-11-12; siguen en el lockfile como dependencias opcionales de Privy y Coinbase.

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

**Pasada del 2026-11-11:** nombre provisional **extan**, tema oscuro, Figtree, isotipo de corchetes y una revisión
de UX de todas las superficies. La guía quedó en [marca.md](marca.md).

### Decisiones

- [x] **Nombre:** **extan**, decidido el 2026-11-12 (reemplaza a "Hito"). `extan.io` está disponible y falta
      comprarlo. Antes de producción conviene validar:
  - dominio disponible;
  - búsqueda de marca registrada en los países objetivo (IMPI, INAPI, INPI, SIC…);
  - usuarios libres en redes;
  - que funcione en portugués si entra Brasil;
  - que no choque con competidores.
- [ ] **Dominio:** principal (`.com` ideal; alternativas `.app`, `.lat`, `.co`) y subdominios:
  - `staging.`;
  - uno de envío para emails (p. ej. `notificaciones.`) con SPF, DKIM y DMARC.

  Evaluar variantes defensivas.
- [x] **Tipografía:** Figtree como única familia. Requisitos:
  - cifras tabulares para montos;
  - lectura cómoda en móvil;
  - acentos y ñ (y portugués);
  - licencia libre.
- [x] **Color:** paleta principal y colores semánticos del dinero con contraste AA. Solo tema oscuro (fondo
      `#08090B`, superficie `#151719`, texto `#F4F5F4`, esmeralda `#7DE7BB`); versión clara solo para emails.
- [x] **Estilo:**
  - personalidad (financiero y sobrio vs. cercano y freelance);
  - radios, sombras y densidad;
  - iconografía (hoy lucide);
  - ilustración o fotografía.
- [x] **Logo:** isotipo de corchetes (provisto por el usuario, recreado en SVG).
  - isotipo + wordmark en SVG, en versiones color, monocromo y sobre fondo oscuro;
  - favicon, `apple-touch-icon` e icono de app;
  - imagen Open Graph base;
  - logo para el modal de Privy y para los emails.
- [x] **Voz y tono:** español neutro latinoamericano con tuteo (ya se usa) y un glosario fijo (hito, garantía,
      liberar, reembolso, disputa) para que la app, los emails y los textos legales digan lo mismo. Glosario en
      [marca.md](marca.md#voz-y-glosario).

**Proceso:** preparo 2 o 3 direcciones completas (tipografía, paleta, logo y una pantalla real aplicada) en una
página para comparar. Eliges una, y la guía queda en `docs/marca.md`.

### Implementación

- [x] Tokens en `apps/web/src/app/globals.css` (colores, radios, escala tipográfica) y fuentes en `layout.tsx`.
- [x] Assets y `metadata`: `app/icon.svg`, `app/apple-icon.tsx`, `app/opengraph-image.tsx` y `themeColor`.
- [x] Componentes `Brand` y `BrandMark` con el logo final (y `MarkGlyph` animado para los loaders).
- [x] Modal de Privy: logo, color de acento, tema y textos. La firma del permit hoy muestra el EIP-712 crudo, en
      inglés ("Sign message") y con las direcciones cortadas: usar `useSignTypedData` de Privy con `uiOptions`
      (título, descripción y botón en español que expliquen "autorizas depositar X USDC en garantía").
  - Con wallet embebida, el permit y las transacciones pasan por `useSignTypedData` / `useSendTransaction` de Privy
    con `uiOptions` en español. **Volver a probar el depósito en Base Sepolia** (cambió la forma de firmar).
  - Privy no permite traducir el resto de su ventana de login ("Submit", "Continue with a wallet").
- [ ] Plantillas de email: encabezado con logo, colores y pie con los datos de la empresa. Logo y colores listos;
      faltan los datos de la empresa.

### Repaso de consistencia de las superficies existentes

- [x] Landing (`/`)
- [x] Header y menú de usuario
- [x] Dashboard (`/dashboard`) y creación de cobros (`/dashboard/new`)
- [x] Checkout (`/pay/[id]`) en todos sus estados: sin fondos, en garantía, entregado, liberado, reembolsado, en
      disputa, resuelto
- [x] Panel de arbitraje (`/arbitration`)
- [x] 404, toasts y diálogos
- [x] Los 7 emails transaccionales
- [ ] Accesibilidad (contraste, foco visible, lectores de pantalla) y diseño en móvil. Contraste AA en los tokens,
      foco visible, `prefers-reduced-motion` y móvil revisados; falta una pasada con lector de pantalla.

### Hallazgos del recorrido en Base Sepolia (Fase 3, 2026-11-10)

Notas del primer recorrido real (cliente y proveedor con wallet embebida de Privy) para la pasada de pulido UI/UX.

- [x] **Carga del checkout (`/pay/[id]`):** al recargar, nuestra información queda varios segundos en estado de
      carga ("procesando") y recién después aparecen las acciones del hito (p. ej. "Liberar fondos"). Las acciones
      esperan a que Privy esté listo y a `/api/me`.
  - En desarrollo parte de la demora es la compilación bajo demanda de Next: `/api/me` tardó 7 s y el sync 12-18 s,
    pero el mismo sync repetido directo tarda 0,4-1 s. Medir con `next build && next start` antes de optimizar.
  - Mostrar el estado del acuerdo de inmediato (datos públicos), con un skeleton solo en la zona de acciones mientras
    se identifica al usuario.
- [x] **Ventanas de Privy:** salen en inglés ("Sign message", "Sign and continue", "Transaction complete"), muestran
      datos técnicos (EIP-712, hex, direcciones cortadas) y tapan la información de nuestro sitio mientras el usuario
      decide.
  - Pasar `uiOptions` en español (título, descripción y botón) en cada firma y transacción: permit, depósito,
    liberar, reembolsar y disputar. Ver también el punto del modal de Privy en *Implementación*.
  - Revisar si Privy permite cambiar el idioma de su modal.
  - Que nuestro resumen (monto, quién recibe, comisión) se vea antes de abrir la ventana de Privy, en todas las
    acciones. "Liberar fondos" ya lo hace; el depósito no.
  - Evaluar ocultar las ventanas de Privy con nuestra propia confirmación (`showWalletUIs: false`). Requiere apagar
    "enforce wallet UIs" en el dashboard de Privy y cuidar que la passkey siga pidiéndose al mover dinero.
    **Pendiente:** por ahora se mantienen las ventanas de Privy, con textos en español y nuestro resumen antes.
- [ ] **Overlay de errores de Next en desarrollo:** al depositar y al liberar aparece la advertencia de React
      "React does not recognize the `isActive` prop on a DOM element". Viene de componentes internos de `@privy-io/react-auth` 3.51.3, no de
      nuestro código. Solo pasa en desarrollo; revisar al actualizar Privy.
- [x] **Flujo de disputa:** hoy son pasos separados e innecesarios: "Abrir disputa" → confirmar el resumen → firmar en
      Privy → el diálogo se cierra con "Disputa abierta. Aporta tu evidencia." → hay que volver a hacer clic para
      abrir el formulario de evidencia y enviarlo. Unificarlo en un solo flujo:
  - Pedir la versión de los hechos (y el enlace opcional) en el mismo diálogo de "Abrir disputa", antes de firmar.
  - Firmar en Privy y, cuando la disputa quede confirmada on-chain, enviar la evidencia automáticamente (la API la
    acepta solo con el hito en disputa). Alternativa mínima: dejar el diálogo abierto con el formulario de evidencia
    después de firmar.
  - Conservar el texto si la transacción falla o se rechaza, para no reescribirlo.
  - El primer envío de evidencia tardó 23 s en desarrollo (compilación de la ruta): revisar el indicador de carga.
- [x] **Panel de arbitraje (`/arbitration`):** "Conectar la hardware wallet del árbitro" es un botón `ghost` que se ve
      como texto suelto, y en la prueba no se reconoció como botón. Además queda por debajo del recuadro de la Safe,
      que es lo que más destaca.
  - Dar jerarquía clara entre los dos caminos: firmar con la wallet conectada y ejecutar desde la Safe (copiar
    datos, lote para Transaction Builder y registrar el hash).
  - "Hardware wallet" confunde cuando el árbitro usa MetaMask: usar "Conectar la wallet del árbitro".
- [x] **Decisión de producto:** hoy el cliente puede "Liberar fondos" antes de que el proveedor suba el entregable (el
      contrato lo permite). Decidir si el botón se muestra siempre o se destaca recién con el entregable. Resuelto en
      la pasada: antes de la entrega es un botón secundario; con la entrega pasa a ser la acción principal.

### Revisión de QA del front (2026-11-12)

- [x] **Avatar:** la inicial quedaba ~1 px por encima del centro (las métricas de Figtree dejan más espacio arriba).
      Componente `Avatar` compartido con `text-box: trim-both cap alphabetic`; usado en el menú, el checkout y la
      portada.
- [x] **Isotipo siempre visible:** los corchetes de los estados pendiente, pagado y reembolsado usaban `#34383d`
      (contraste 1,7:1 sobre el fondo). Ahora van en texto (≥ 7:1) y el estado lo cuentan el núcleo y la apertura.
      Lo mismo en el `MarkGlyph` en reposo (pasos del depósito, estados vacíos).
- [x] **H1 de la portada:** "Cobra por hitos con el pago ya asegurado" sonaba técnico. Ahora: "Tu cliente deposita al
      empezar. Tú cobras al entregar.", y la bajada abre nombrando a quién sirve (freelancers, agencias y trabajos por
      encargo).
- [x] **"Cómo funciona":** el paso 2 dice que el cliente paga en su moneda. Se agregó el recorrido del dinero (paga en su
      moneda → queda en garantía en USDC → cobras) con el monto en la moneda detectada del visitante, y una sección
      de casos de uso (freelancers con clientes en otros países, agencias, obras por etapas y compraventas).
- [x] **Formulario de nuevo link:** los campos quedan en dos paneles, "El acuerdo" (trabajo, descripción, tu nombre y el
      email del cliente) y "Hitos". Bajo cada monto aparece el equivalente en tu moneda y el botón para agregar
      hitos ocupa todo el ancho.
- [x] **Hitos del checkout:** filas en una sola superficie (como el ejemplo de la portada), monto en USDC con su
      equivalente local, y sin datos repetidos en los hitos cerrados. El comprobante va en la línea de estado, la
      fecha estimada solo se muestra en hitos abiertos y se quitaron las frases que repetían el estado.
- [x] **Movimiento tomado de vriza:** `SpotlightCard` (borde y brillo que siguen al puntero), `ShineBorder` (luz
      que recorre el campo con foco), `Rise` (aparición al entrar en pantalla) y `Reveal` (errores que abren su
      espacio), en `components/motion.tsx`. La pantalla de ingreso pasó a ser una tarjeta con entrada escalonada.
- [ ] **Texto vs. producto:** la portada promete que el cliente paga "con transferencia o tarjeta, en su moneda". Hoy
      solo se paga con USDC. Es intencional: el on-ramp (Fase 7) tiene que estar resuelto antes de salir a producción.

**QA visual cerrado el 2026-11-12.** Quedan abiertas las pruebas del ingreso nuevo que se listan abajo.

#### Segunda revisión (2026-11-12)

- [x] **Avatar con centrado óptico:** la J seguía viéndose a la derecha (su caja está centrada, pero su peso no).
      Cada letra se corrige hacia un punto entre su caja y su centro de masa, medido en el navegador sobre Figtree.
- [x] **Textos de la portada:** bajada nueva, paso 2 "Tu cliente paga el trabajo" y el recorrido del dinero como
      sección propia ("Tu cliente paga en su moneda y tú cobras en dólares"), con su propio H2.
- [x] **Efecto de cursor (`SpotlightCard`):** solo en el ingreso y en la portada; se quitó de los paneles del
      formulario.
- [x] **Detalle y fecha de cada hito:** el detalle se abre a todo el ancho con una ayuda, y la fecha es un botón que
      muestra "Entrega estimada: 15 dic 2026" y abre el calendario del sistema (se quita con una ×).
- [x] **`.env`:** remitente de los emails `extan <…>` (antes "Hito"); `.env.example` también. Las variables `ESCROW_*`
      se mantienen: nombran el contrato `MilestoneEscrow` y las lee el script de deploy.
- [x] **Ingreso propio en español:** ventana de extan (email con código o Google) sobre los hooks headless de Privy,
      con el fondo más oscuro y anclada arriba en móvil. La ventana de Privy queda solo para conectar una wallet
      externa y para las firmas. Si el cliente toca "Depositar" sin sesión, al ingresar se abre el depósito (también
      después de volver de Google).
- [ ] **Probar el ingreso nuevo en Base Sepolia:**
  - [x] email con código y usuario nuevo (2026-11-12): Privy le creó la wallet embebida
        `0x46e6…3f02` y quedó en el perfil;
  - [ ] Google;
  - [ ] wallet externa;
  - [ ] "Depositar" sin sesión.
- [x] **Bug: perfil sin wallet tras crear la cuenta.** El navegador ve la wallet nueva un instante antes que la API
      de Privy que consulta el servidor; si la sincronización llegaba en ese momento, el perfil quedaba sin wallet
      para siempre (le pasó a una cuenta de prueba el 2026-11-11) y no podía crear links. Ahora `useMe` reintenta
      mientras el navegador ve una wallet que el perfil no tiene, y el servidor vuelve a leer de Privy cualquier
      perfil sin wallet.
- [x] **Formato de números:** USDC y CLP con el formato chileno, punto de miles y coma decimal (`2.500,00 USDC`,
      `$2.480.484 CLP`; CLP sin centavos). Al escribir montos, el punto es separador de miles: "2.500" ya no se lee
      como 2,5 y lo ambiguo se rechaza con una indicación.

#### Portada en teléfonos reales (2026-11-13)

Revisión hecha con la primera versión publicada en Vercel, en un Android y en un iPhone Pro Max.

- [x] **H1 y bajada:** "Pagos por hitos garantizados en blockchain." y una sola bajada para móvil y escritorio: "Un
      link de cobro para freelancers y agencias: tu cliente paga al empezar y tú cobras al entregar." El hero ya no
      promete "paga en su moneda" mientras no haya on-ramp; esa promesa sigue más abajo. README e imágenes al día.
- [x] **Proporciones en teléfonos grandes:** en un iPhone Pro Max todo se veía más chico. Se probó escalar la
      interfaz completa con el ancho (16 a 18 px de base) y se descartó: se veía apretada y tosca. Queda el tamaño
      fijo, que deja más aire en pantallas grandes.
- [x] **"Cómo funciona":** sobre el mar, el botón lleva un borde más visible.
- [x] **`SpotlightCard` en táctil:** sin mouse, la luz recorre el borde superior de izquierda a derecha cuando la
      tarjeta pasa por el centro de la pantalla.
- [x] **Mar del hero borroso en teléfonos:** el canvas se dibujaba como máximo a 1,5× y el navegador lo estiraba en
      pantallas 3×. Ahora usa la densidad nativa (hasta 3×) y baja la resolución si el equipo no sostiene unos 40
      cuadros por segundo. En escritorio sigue en 1,5×.
- [x] **Ingreso centrado en móvil:** los pasos de email y código quedan al centro de la pantalla (antes, anclados arriba).
- [x] **Campos a 16 px en todo el sitio:** con menos, iOS hace zoom al enfocarlos. Cambió la base compartida de
      `Input`/`Textarea` (15 px), el hash de arbitraje (13 px) y el selector de fecha oculto.
- [x] **Bug: cuentas nuevas sin wallet en la demo publicada.** El saldo del menú quedaba cargando sin fin. Con un ingreso
      propio, Privy no aplica `createOnLogin`, y en su dashboard la creación automática está en "off" (las cuentas de
      prueba anteriores sí recibieron wallet). Ahora la app crea la wallet embebida apenas detecta una sesión sin
      wallet, y Privy crea encima la smart wallet. Mientras tanto, el menú dice "Preparando tu wallet…".

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
- [ ] **Demo de portafolio** en `demo.extan.io` sobre Base Sepolia: plan paso a paso en
      [demo-portafolio.md](demo-portafolio.md). Adelanta parte de esta fase (hosting, servicios en la nube, límite de
      solicitudes, páginas de error) y el gas patrocinado de la Fase 3.
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
- [x] **Páginas de error:** `error.tsx`, `global-error.tsx` y `loading.tsx`, con la marca (2026-11-12).

### Seguridad

- [x] **Rate limiting** (2026-11-12): contadores por ventana fija en Postgres (`0003_rate_limits.sql`), sin
      servicios extra. Límites en [demo-portafolio.md](demo-portafolio.md), paso 4:
  - `POST /api/escrow/sync`: pública, se cuenta por IP. La espera del recibo bajó de 30 s a 10 s.
  - `POST /api/escrows`: envía la invitación a cualquier email, así que se puede usar para spam.
  - Entregables y evidencias.
  - Antes de mainnet, evaluar sumar el WAF del hosting para tráfico masivo por IP.
- [x] **Análisis estático del contrato** con Slither (2026-11-12): cero hallazgos en `MilestoneEscrow.sol`. Informe en
      [analisis-estatico.md](analisis-estatico.md). Repetirlo si el contrato cambia.
- [ ] **Contrato verificado** en los exploradores: Blockscout y Sourcify listos (2026-11-12); falta Basescan.
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
