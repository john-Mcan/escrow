# Análisis estático del contrato

Revisión de `MilestoneEscrow.sol` con [Slither](https://github.com/crytic/slither) (Trail of Bits), hecha el
2026-11-12 como parte de la [demo de portafolio](demo-portafolio.md), paso 3.

**No es una auditoría.** Slither busca patrones de riesgo conocidos; no entiende la intención del negocio ni encuentra
errores de lógica propios de este contrato. Antes de mainnet sigue pendiente la auditoría externa (Fase 8 del
[roadmap](roadmap.md)).

## Alcance

| | |
|---|---|
| Contrato | `packages/contracts/src/MilestoneEscrow.sol` (332 líneas de código) |
| Versión revisada | La desplegada: el archivo no cambia desde `ddcdc6d` (2026-11-07) |
| Despliegue | Base Sepolia, [`0xb7BABf0046fb8Bb2E3Ea0e6B75abdDEb31B9F863`](https://base-sepolia.blockscout.com/address/0xb7BABf0046fb8Bb2E3Ea0e6B75abdDEb31B9F863?tab=contract) (verificado en Blockscout y Sourcify) |
| Compilador | solc 0.8.28, optimizador con 10.000 runs, EVM `cancun` |
| Dependencias | OpenZeppelin Contracts 5.7.0: `Ownable2Step`, `Pausable`, `ReentrancyGuard`, `SafeERC20`, `SafeCast` |
| Herramienta | Slither 0.11.6, 102 detectores |

Comando, desde `packages/contracts` y con Foundry en el `PATH`:

```bash
slither . --filter-paths "lib/|test/|script/|mocks/"
```

El filtro deja fuera las dependencias, los tests, el script de deploy y `MockUSDC` (solo existe para los tests en
Anvil). Las dependencias se revisan aparte, más abajo.

## Resultado

**Cero hallazgos en `MilestoneEscrow.sol`, en todas las severidades:**

| Severidad | Hallazgos |
|---|---|
| Alta | 0 |
| Media | 0 |
| Baja | 0 |
| Informativa | 0 |
| Optimización | 0 |

Sin hallazgos que corregir ni que aceptar, el contrato desplegado se mantiene: no hace falta un deploy nuevo.

### Por qué no aparece nada

Los detectores que suelen saltar en un escrow no tienen dónde engancharse, por decisiones de diseño:

- **Reentrancia:** las cinco funciones que mueven fondos (`createAndFundEscrow`, su variante con `permit`,
  `releaseMilestone`, `refundMilestone` y `resolveDispute`) más `raiseDispute` usan `nonReentrant`. Además, el
  escrow se registra antes de cobrar el depósito y el estado del hito cambia antes de pagar
  (checks-effects-interactions).
- **Transferencias de tokens:** todas pasan por `SafeERC20`; no hay `call` de bajo nivel ni envío de ETH. El depósito
  compara el saldo antes y después, y revierte si el contrato no recibió el monto exacto.
- **Tiempo:** el contrato no compara contra `block.timestamp`. El único plazo es el `deadline` del `permit`, que
  valida USDC.
- **Aritmética:** Solidity 0.8 revierte ante overflow y el contrato no usa `unchecked`. Montos en `uint128` con
  `SafeCast`, porcentajes en puntos base (`BPS_DENOMINATOR = 10_000`) y comisión con tope
  (`MAX_PLATFORM_FEE_BPS = 500`). El reparto suma exacto, sin restos atrapados: la comisión redondea hacia abajo y
  el proveedor recibe el resto. Los dos casts a `uint16` llevan su justificación en un comentario.
- **Control de acceso:** `Ownable2Step` (el cambio de owner exige que el nuevo lo acepte) y un árbitro aparte, que
  reparte un hito en disputa pero nunca puede quedarse con los fondos.
- **`permit` que puede fallar:** se llama dentro de `try/catch`, porque alguien puede adelantarse y usar la misma firma
  (front-running). Si eso pasa, el allowance ya existe y `safeTransferFrom` decide. Es la recomendación de
  OpenZeppelin para `IERC20Permit`.
- **Assembly:** cero líneas.

## Dependencias (OpenZeppelin)

Sin el filtro, Slither informa 79 hallazgos, **todos en OpenZeppelin**. Se aceptan sin cambios: es código auditado y
ampliamente usado, y cada caso es conocido.

| Severidad | Detector | Dónde | Por qué se acepta |
|---|---|---|---|
| Alta | `incorrect-exp` | `Math.mulDiv` | `^` es un XOR intencional: semilla de la inversa modular (Newton-Raphson). No es una potencia mal escrita. |
| Media | `divide-before-multiply` (9) | `Math.mulDiv`, `Math.invMod` | División exacta por potencias de 2 dentro del algoritmo de 512 bits; no pierde precisión. |
| Baja | `missing-zero-check` | `Ownable2Step.transferOwnership` | Pasar `address(0)` cancela un traspaso pendiente: es a propósito. |
| Baja | `shadowing-local`, `timestamp` | `ERC20Permit` | Solo lo usa `MockUSDC` (tests); el plazo del `permit` es por diseño del estándar EIP-2612. |
| Informativa | `assembly` (46), `solc-version`, `pragma`, `naming-convention`, `too-many-digits`, `unindexed-event-address` | Varias | Estilo y optimizaciones propias de la librería. |
| Optimización | `constable-states` (2) | `EIP712` | Solo lo usa `MockUSDC`. |

Además, `Math`, `ERC20Permit` y `EIP712` solo entran a la compilación por `MockUSDC` (`ERC20Permit` → `EIP712` →
`Strings` → `Math`): el contrato desplegado no los incluye. Los hallazgos alta y media ni siquiera están en su
bytecode.

## Revisiones complementarias

| Revisión | Resultado |
|---|---|
| `forge lint` (linter de Foundry) | Sin avisos |
| `forge test` | 55 tests pasan, con fuzzing a 1.000 corridas (10.000 en el perfil `ci`) |
| `forge coverage` | 100 % de líneas (147), sentencias (176), ramas (27) y funciones (32) |
| Verificación del código fuente | Coincidencia exacta en Blockscout y Sourcify |

[Aderyn](https://github.com/Cyfrin/aderyn) (Cyfrin) queda pendiente como segunda opinión.

## Cómo repetirlo

1. `pip install --user slither-analyzer` (Python 3.8 o superior).
2. Con Foundry en el `PATH`, desde `packages/contracts`, el comando de arriba. Sin `--filter-paths` muestra también
   los hallazgos de OpenZeppelin.
3. Slither ejecuta `forge clean` antes de compilar: después, corre `forge build` para regenerar `out/`.

Si el contrato cambia, el análisis se repite y este informe se actualiza antes del deploy.
