# Guía de marca: extan

Última actualización: 2026-11-12. Nombre provisional: **extan** (`extan.io` está disponible, pero todavía no se
compra). Si cambia, el nombre vive en `components/brand.tsx`, `layout.tsx`, `providers.tsx` (Privy) y en las plantillas
de email.

## Idea

El isotipo son **corchetes que retienen un valor**: el dinero (el cuadro esmeralda) queda "entre corchetes" mientras
está en garantía. Es la pieza que distingue la marca y se usa con intención:

- **Isotipo y wordmark** en el header, el footer, la ventana de Privy y los emails.
- **Nodos del recorrido de hitos:** con corchetes cerrados y núcleo plateado, el dinero está retenido. Cuando el pago
  sale, los corchetes se abren y el núcleo pasa a esmeralda. Los corchetes siempre van en color de texto (o ámbar en
  disputa, gris claro si se reembolsó): el isotipo nunca baja de 7:1 de contraste; el estado lo cuentan el núcleo y la
  apertura.
- **Loader:** los corchetes se cierran sobre el valor y lo sueltan mientras algo se procesa.

Todo lo demás es sobrio: un solo color de acción, superficies planas, jerarquía tipográfica clara.

## Color

Solo hay tema oscuro. La versión clara existe únicamente para emails y documentos.

| Token | Valor | Uso |
|---|---|---|
| `background` | `#08090B` | Fondo de la app |
| `surface` / `card` | `#151719` | Paneles (resumen del checkout, listas, diálogos) |
| `raised` | `#1C1F22` | Hover de filas, bloques dentro de un menú |
| `foreground` | `#F4F5F4` | Texto principal |
| `muted-foreground` | `#A1A7AD` | Texto secundario |
| `subtle` | `#7D848B` | Metadatos y notas (≥ 4,5:1 sobre fondo y superficie) |
| `border` / `line-strong` | `#24272B` / `#34383D` | Líneas y bordes |
| `primary` | `#7DE7BB` | Esmeralda: la acción principal de cada pantalla y el dinero pagado |
| `destructive` | `#FF8A80` | Errores y acciones irreversibles |

**Colores del dinero** (tokens `vault`, `seal`, `caution`):

| Estado | Color | Marcador |
|---|---|---|
| Por depositar | contorno gris | cuadro punteado |
| En garantía | plata `#C3CAD2` | gradiente semimetalizado (`bg-metal`) |
| Pagado / resuelto | esmeralda `#7DE7BB` | cuadro esmeralda con brillo leve |
| En disputa | ámbar `#F2B661` | cuadro ámbar |
| Reembolsado | gris | cuadro gris |

**Gradientes:** solo uno, el plateado semimetalizado (`--metal`), reservado para el dinero retenido. No hay gradientes
decorativos.

## Tipografía

**Figtree** es la única familia, cargada con `next/font`. La jerarquía se marca cambiando tamaño, peso y tracking a la
vez:

| Nivel | Tamaño | Peso | Tracking | Dónde |
|---|---|---|---|---|
| Display (`t-display`, H1 de la portada) | 40–72 px | 600 | −0,045em | Portada |
| H1 | 30–40 px | 600 | −0,032em | Título de cada pantalla |
| H2 | 22 px | 600 | −0,02em | Secciones |
| H3 | 17 px | 600 | −0,01em | Subsecciones e ítems |
| Lead (`t-lead`) | 18 px | 400 | — | Bajada bajo un H1 |
| Cuerpo | 16 px | 400 | — | Texto general |
| Meta (`t-meta`) | 13 px | 400 | — | Fechas y datos secundarios |

- Montos siempre con cifras tabulares (`amount`), con la unidad "USDC" en tono secundario.
- Sin etiquetas en mayúsculas ni "eyebrows" sobre los títulos.
- Direcciones y hashes en monoespaciada, solo dentro de "Detalles técnicos".

## Forma y espacio

- Radios: 10 px en controles, 14–18 px en paneles y 24 px en la tarjeta de la portada.
- Paneles: superficie `#151719`, borde de 1 px y un filo iluminado arriba (`surface-edge`). Sin sombras pesadas.
- **Sin anidar grupos:** dentro de un panel, las secciones se separan con líneas, no con más cajas.
- **Sin chips ni pastillas:** el estado se escribe como texto con un marcador cuadrado del color del dinero.
- **Formularios:** los campos se agrupan en paneles hermanos (p. ej. "El acuerdo" y "Hitos"), nunca uno dentro de otro.
- **Avatares:** siempre con `Avatar`. Centra la inicial ópticamente: recorta el texto a la altura de las mayúsculas
  y mueve cada letra hacia un punto entre el centro de su caja y su centro de masa (75% masa en horizontal, 25% en
  vertical), medido sobre Figtree 600. Así la J o la L no parecen corridas.

## Movimiento

- **Microinteracciones (responden a la persona):**
  - el botón principal se ilumina con un halo esmeralda al pasar el cursor y se comprime al hacer clic;
  - las flechas se desplazan en los enlaces;
  - las filas del dashboard cambian de fondo y su chevron avanza;
  - los subrayados de la navegación crecen desde la izquierda;
  - el ícono de copiar cambia a un check.
- **Trabajo en curso:**
  - `ExtanLoader` (isotipo animado) para esperas de página;
  - `ProgressSteps` para operaciones con dinero (qué pasó, qué está pasando y qué falta);
  - `WorkLine`, un destello en el borde de los diálogos;
  - `Spinner` dentro de botones;
  - `Skeleton` con brillo para contenido que viene en camino.
- **Superficies vivas** (`components/motion.tsx`, tomadas del proyecto vriza):
  - `SpotlightCard`: el borde se ilumina en esmeralda y la cara apenas se aclara siguiendo al puntero (solo con mouse).
    Es un llamado suave a la acción, no un adorno: solo en la ventana y la tarjeta de ingreso y en la portada. Nunca
    en tarjetas ni paneles del dashboard;
  - `ShineBorder`: una luz recorre el borde del campo con foco;
  - `Rise`: las secciones suben 10 px y aparecen una vez al entrar en pantalla, escalonadas cada 90 ms;
  - `Reveal`: los errores abren su propio espacio, sin saltos.
  - Curva común: `--ease-out-soft` (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **Un solo momento orquestado:** en la portada, el cliente aprueba la primera entrega y ese pago sale de la garantía.
- Se respeta `prefers-reduced-motion`.

## Voz y glosario

Español neutro latinoamericano con tuteo. Se escribe desde quien usa la app, no desde cómo está construida.

| Usamos | Evitamos |
|---|---|
| link de cobro | checkout, escrow |
| garantía, en garantía | bloqueado en el contrato, custodia |
| hito | milestone, tramo |
| entrega, enviar la entrega | entregable, subir entregable |
| liberar el pago → Pagado | liberar fondos, release |
| reembolsar → Reembolsado | refund |
| disputa, árbitro | arbitraje on-chain, multisig (solo en detalles técnicos) |
| comprobante | recibo on-chain, tx hash |
| tu cuenta | wallet (salvo en "Detalles técnicos" y para usuarios cripto) |

Una acción mantiene su nombre en todo el flujo: el botón "Liberar pago" termina en el aviso "Pago liberado".

## Información técnica

El camino principal nunca depende de saber qué es un contrato inteligente. Red, contrato, direcciones, hashes y la
explicación de USDC van plegados en "Detalles técnicos" o "¿Qué es USDC?" (componente `Disclosure`).

## Moneda

Los montos se muestran en USDC y, al lado, la referencia en la moneda local: "≈ $2.460.201 CLP".

- **Moneda local:** se detecta por el idioma o la zona horaria del navegador y se puede cambiar con el selector junto
  al monto principal. La elección se recuerda.
- **Tipo de cambio:** referencial de Coinbase (`/api/rates`, con caché de 10 minutos).
- **Monedas disponibles:** CLP, MXN, COP, PEN, ARS, UYU, BRL, USD y EUR.

## Superficies externas

- **Ingreso (`components/auth/sign-in.tsx`):** ventana propia en español sobre los hooks headless de Privy
  (`useLoginWithEmail`, `useLoginWithOAuth`): email con código de 6 dígitos o Google. Fondo más oscuro y difuminado
  que el resto de los diálogos; en móvil se ancla arriba para que el teclado no tape el código.
  - El email con el código lo envía Privy, desde privy.io y en inglés. Personalizarlo es del plan enterprise.
- **Privy:**
  - su ventana queda solo para conectar una wallet externa ("¿Usas una wallet cripto? Conéctala") y para las firmas;
  - fondo `#151719`, acento esmeralda, isotipo con wordmark;
  - las firmas con wallet embebida llevan título, descripción y botón en español (`uiOptions`);
  - Privy no permite traducir el resto de su ventana ("Submit", "Continue with a wallet", "Protected by Privy").
- **Emails:**
  - fondo `#F4F5F4` y tarjeta blanca;
  - isotipo hecho con celdas (se ve aunque el cliente bloquee imágenes);
  - botón esmeralda con texto `#08090B`;
  - monto destacado bajo el título.
- **Íconos:**
  - `app/icon.svg` (favicon);
  - `app/apple-icon.tsx` (180 px);
  - `app/opengraph-image.tsx` (1200×630, Figtree).
