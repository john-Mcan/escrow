// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title MilestoneEscrow
/// @notice Escrow no-custodio de pagos por hitos en stablecoins (USDC, 6 decimales) sobre Base.
/// @dev Garantías de diseño:
///      - Los fondos solo salen del contrato hacia `payer`, `payee` o `feeRecipient` (el fee). Ni el owner ni el
///        arbiter pueden enviarse el principal a sí mismos.
///      - `pause()` solo bloquea depósitos nuevos: liberar, reembolsar, disputar y resolver funcionan siempre, de modo
///        que la plataforma nunca puede retener fondos de usuarios.
///      - El fee y el arbiter quedan fijados (snapshot) al crear cada escrow; cambios de configuración posteriores
///        solo afectan a escrows nuevos.
///      - Solo tokens en allowlist (USDC). `maxEscrowAmount` se expresa en unidades del token (6 decimales).
contract MilestoneEscrow is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Tipos
    // ---------------------------------------------------------------------

    /// @dev `Pending` es el valor por defecto (hito inexistente). En el flujo actual todos los hitos se fondean
    ///      atómicamente al crear el escrow. `Resolved` es el estado final tras un arbitraje.
    enum MilestoneStatus {
        Pending,
        Funded,
        Released,
        Refunded,
        Disputed,
        Resolved
    }

    /// @dev Empaquetado: slot 0 = payer + feeBps + milestoneCount; slots 1-3 = payee, arbiter, token.
    struct Escrow {
        address payer;
        uint16 feeBps;
        uint16 milestoneCount;
        address payee;
        address arbiter;
        address token;
    }

    /// @dev Un único slot por hito. `maxEscrowAmount` está acotado a uint128, por lo que el cast es seguro.
    struct Milestone {
        uint128 amount;
        MilestoneStatus status;
    }

    // ---------------------------------------------------------------------
    // Constantes y configuración
    // ---------------------------------------------------------------------

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_PLATFORM_FEE_BPS = 500;
    uint256 public constant MAX_MILESTONES = 20;
    uint256 public constant DEFAULT_MAX_ESCROW_AMOUNT = 5000 * 1e6;

    uint256 public platformFeeBps;
    address public feeRecipient;
    uint256 public maxEscrowAmount;
    /// @notice Arbiter (Safe multisig / hardware wallet) asignado a los escrows creados a partir de ahora.
    address public defaultArbiter;
    /// @notice Cantidad de escrows creados. Los ids empiezan en 1 (0 = inexistente).
    uint256 public escrowCount;

    mapping(address token => bool allowed) public isTokenAllowed;
    mapping(uint256 escrowId => Escrow) private _escrows;
    mapping(uint256 escrowId => mapping(uint256 milestoneIndex => Milestone)) private _milestones;

    // ---------------------------------------------------------------------
    // Eventos
    // ---------------------------------------------------------------------

    /// @param referenceId Referencia off-chain (UUID del escrow en Supabase codificado en bytes32). No es única
    ///        on-chain: el backend verifica que partes, token y montos coincidan con el registro off-chain.
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed payer,
        address indexed payee,
        address arbiter,
        address token,
        bytes32 referenceId,
        uint256 totalAmount,
        uint16 feeBps,
        uint256[] milestoneAmounts
    );
    event MilestoneReleased(
        uint256 indexed escrowId, uint256 indexed milestoneIndex, uint256 amount, uint256 payeeAmount, uint256 fee
    );
    event MilestoneRefunded(uint256 indexed escrowId, uint256 indexed milestoneIndex, uint256 amount);
    event DisputeRaised(uint256 indexed escrowId, uint256 indexed milestoneIndex, address indexed raisedBy);
    event DisputeResolved(
        uint256 indexed escrowId,
        uint256 indexed milestoneIndex,
        address indexed arbiter,
        uint256 payerShareBps,
        uint256 payerAmount,
        uint256 payeeAmount,
        uint256 fee
    );

    event PlatformFeeUpdated(uint256 previousFeeBps, uint256 newFeeBps);
    event FeeRecipientUpdated(address indexed previousRecipient, address indexed newRecipient);
    event MaxEscrowAmountUpdated(uint256 previousAmount, uint256 newAmount);
    event DefaultArbiterUpdated(address indexed previousArbiter, address indexed newArbiter);
    event TokenAllowlistUpdated(address indexed token, bool allowed);

    // ---------------------------------------------------------------------
    // Errores
    // ---------------------------------------------------------------------

    error ZeroAddress();
    error TokenNotAllowed(address token);
    error InvalidPayee(address payee);
    error PayerCannotBeArbiter(address payer);
    error InvalidMilestoneCount(uint256 count);
    error ZeroMilestoneAmount(uint256 milestoneIndex);
    error EscrowAmountExceedsMax(uint256 totalAmount, uint256 maxAmount);
    error UnexpectedAmountReceived(uint256 expected, uint256 received);
    error EscrowNotFound(uint256 escrowId);
    error MilestoneNotFound(uint256 escrowId, uint256 milestoneIndex);
    error InvalidMilestoneStatus(uint256 escrowId, uint256 milestoneIndex, MilestoneStatus status);
    error CallerNotPayer(address caller);
    error CallerNotPayee(address caller);
    error CallerNotParticipant(address caller);
    error CallerNotArbiter(address caller);
    error InvalidShareBps(uint256 payerShareBps);
    error FeeTooHigh(uint256 feeBps, uint256 maxFeeBps);
    error InvalidMaxEscrowAmount(uint256 amount);

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /// @param initialOwner Owner de la configuración (debe ser una Safe multisig).
    /// @param initialArbiter Arbiter por defecto para disputas (Safe multisig / hardware wallet, nunca una hot wallet).
    /// @param initialFeeRecipient Treasury que recibe el fee de plataforma.
    /// @param initialFeeBps Fee de plataforma en basis points (máx. 500 = 5%).
    /// @param initialToken Token habilitado inicialmente (USDC de la red).
    constructor(
        address initialOwner,
        address initialArbiter,
        address initialFeeRecipient,
        uint256 initialFeeBps,
        address initialToken
    ) Ownable(initialOwner) {
        _setDefaultArbiter(initialArbiter);
        _setFeeRecipient(initialFeeRecipient);
        _setPlatformFeeBps(initialFeeBps);
        _setMaxEscrowAmount(DEFAULT_MAX_ESCROW_AMOUNT);
        _setTokenAllowed(initialToken, true);
    }

    // ---------------------------------------------------------------------
    // Creación y fondeo
    // ---------------------------------------------------------------------

    /// @notice Crea un escrow con N hitos y deposita el total desde `msg.sender` (payer). Requiere `approve` previo
    ///         (o un batch approve + create desde una smart account ERC-4337).
    /// @return escrowId Id on-chain del escrow creado.
    function createAndFundEscrow(address payee, address token, uint256[] calldata amounts, bytes32 referenceId)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 escrowId)
    {
        uint256 totalAmount;
        (escrowId, totalAmount) = _createEscrow(payee, token, amounts, referenceId);
        _pullFunds(token, totalAmount);
    }

    /// @notice Igual que {createAndFundEscrow} pero autoriza el gasto con una firma EIP-2612 en la misma transacción.
    /// @dev Si alguien adelanta (front-run) la firma de `permit`, la llamada interna falla pero el allowance ya existe,
    ///      por lo que se ignora el error y `safeTransferFrom` decide. Ver OZ IERC20Permit "Security Considerations".
    function createAndFundEscrowWithPermit(
        address payee,
        address token,
        uint256[] calldata amounts,
        bytes32 referenceId,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused returns (uint256 escrowId) {
        uint256 totalAmount;
        (escrowId, totalAmount) = _createEscrow(payee, token, amounts, referenceId);
        try IERC20Permit(token).permit(msg.sender, address(this), totalAmount, deadline, v, r, s) {} catch {}
        _pullFunds(token, totalAmount);
    }

    // ---------------------------------------------------------------------
    // Liquidación
    // ---------------------------------------------------------------------

    /// @notice El payer libera un hito fondeado: el payee recibe el monto neto y `feeRecipient` el fee.
    function releaseMilestone(uint256 escrowId, uint256 milestoneIndex) external nonReentrant {
        Escrow storage escrow = _getEscrow(escrowId);
        if (msg.sender != escrow.payer) revert CallerNotPayer(msg.sender);
        Milestone storage milestone = _getMilestone(escrow, escrowId, milestoneIndex, MilestoneStatus.Funded);

        uint256 amount = milestone.amount;
        milestone.status = MilestoneStatus.Released;
        (, uint256 payeeAmount, uint256 fee) = _computeSplit(amount, escrow.feeBps, 0);

        emit MilestoneReleased(escrowId, milestoneIndex, amount, payeeAmount, fee);
        _payout(escrow, 0, payeeAmount, fee);
    }

    /// @notice El payee cancela un hito fondeado y devuelve el 100% al payer, sin fee.
    function refundMilestone(uint256 escrowId, uint256 milestoneIndex) external nonReentrant {
        Escrow storage escrow = _getEscrow(escrowId);
        if (msg.sender != escrow.payee) revert CallerNotPayee(msg.sender);
        Milestone storage milestone = _getMilestone(escrow, escrowId, milestoneIndex, MilestoneStatus.Funded);

        uint256 amount = milestone.amount;
        milestone.status = MilestoneStatus.Refunded;

        emit MilestoneRefunded(escrowId, milestoneIndex, amount);
        _payout(escrow, amount, 0, 0);
    }

    /// @notice Payer o payee congelan un hito fondeado. A partir de aquí solo el arbiter puede liquidarlo.
    function raiseDispute(uint256 escrowId, uint256 milestoneIndex) external nonReentrant {
        Escrow storage escrow = _getEscrow(escrowId);
        if (msg.sender != escrow.payer && msg.sender != escrow.payee) revert CallerNotParticipant(msg.sender);
        Milestone storage milestone = _getMilestone(escrow, escrowId, milestoneIndex, MilestoneStatus.Funded);

        milestone.status = MilestoneStatus.Disputed;

        emit DisputeRaised(escrowId, milestoneIndex, msg.sender);
    }

    /// @notice El arbiter del escrow reparte un hito en disputa entre payer y payee.
    /// @param payerShareBps Porción para el payer (0 = todo al payee, 10_000 = reembolso total). El fee solo se
    ///        aplica, de forma proporcional, sobre la porción del payee.
    function resolveDispute(uint256 escrowId, uint256 milestoneIndex, uint256 payerShareBps) external nonReentrant {
        Escrow storage escrow = _getEscrow(escrowId);
        if (msg.sender != escrow.arbiter) revert CallerNotArbiter(msg.sender);
        if (payerShareBps > BPS_DENOMINATOR) revert InvalidShareBps(payerShareBps);
        Milestone storage milestone = _getMilestone(escrow, escrowId, milestoneIndex, MilestoneStatus.Disputed);

        uint256 amount = milestone.amount;
        milestone.status = MilestoneStatus.Resolved;
        (uint256 payerAmount, uint256 payeeAmount, uint256 fee) = _computeSplit(amount, escrow.feeBps, payerShareBps);

        emit DisputeResolved(escrowId, milestoneIndex, msg.sender, payerShareBps, payerAmount, payeeAmount, fee);
        _payout(escrow, payerAmount, payeeAmount, fee);
    }

    // ---------------------------------------------------------------------
    // Administración (owner = Safe multisig)
    // ---------------------------------------------------------------------

    /// @notice Circuit breaker: bloquea la creación de escrows nuevos. No afecta a la liquidación.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Solo aplica a escrows nuevos (los existentes conservan su fee).
    function setPlatformFeeBps(uint256 newFeeBps) external onlyOwner {
        _setPlatformFeeBps(newFeeBps);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        _setFeeRecipient(newRecipient);
    }

    function setMaxEscrowAmount(uint256 newMaxAmount) external onlyOwner {
        _setMaxEscrowAmount(newMaxAmount);
    }

    /// @notice Solo aplica a escrows nuevos (los existentes conservan su arbiter).
    function setDefaultArbiter(address newArbiter) external onlyOwner {
        _setDefaultArbiter(newArbiter);
    }

    /// @notice Deshabilitar un token solo impide escrows nuevos; los existentes se liquidan con normalidad.
    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        _setTokenAllowed(token, allowed);
    }

    // ---------------------------------------------------------------------
    // Lecturas
    // ---------------------------------------------------------------------

    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return _getEscrow(escrowId);
    }

    function getMilestone(uint256 escrowId, uint256 milestoneIndex) external view returns (Milestone memory) {
        Escrow storage escrow = _getEscrow(escrowId);
        if (milestoneIndex >= escrow.milestoneCount) revert MilestoneNotFound(escrowId, milestoneIndex);
        return _milestones[escrowId][milestoneIndex];
    }

    function getMilestones(uint256 escrowId) external view returns (Milestone[] memory milestones) {
        uint256 count = _getEscrow(escrowId).milestoneCount;
        milestones = new Milestone[](count);
        mapping(uint256 => Milestone) storage stored = _milestones[escrowId];
        for (uint256 i; i < count; ++i) {
            milestones[i] = stored[i];
        }
    }

    /// @notice Simula el reparto de un hito con el fee fijado en el escrow (`payerShareBps = 0` equivale a liberar).
    function previewSettlement(uint256 escrowId, uint256 milestoneIndex, uint256 payerShareBps)
        external
        view
        returns (uint256 payerAmount, uint256 payeeAmount, uint256 fee)
    {
        if (payerShareBps > BPS_DENOMINATOR) revert InvalidShareBps(payerShareBps);
        Escrow storage escrow = _getEscrow(escrowId);
        if (milestoneIndex >= escrow.milestoneCount) revert MilestoneNotFound(escrowId, milestoneIndex);
        return _computeSplit(_milestones[escrowId][milestoneIndex].amount, escrow.feeBps, payerShareBps);
    }

    // ---------------------------------------------------------------------
    // Internas
    // ---------------------------------------------------------------------

    /// @dev Checks + effects de la creación. La transferencia de fondos (interaction) la hace el llamador.
    function _createEscrow(address payee, address token, uint256[] calldata amounts, bytes32 referenceId)
        private
        returns (uint256 escrowId, uint256 totalAmount)
    {
        address arbiter = _validateCreation(payee, token, amounts.length);

        escrowId = ++escrowCount;
        totalAmount = _storeMilestones(escrowId, amounts);

        _escrows[escrowId] = Escrow({
            payer: msg.sender,
            // casting to 'uint16' is safe because platformFeeBps <= MAX_PLATFORM_FEE_BPS (500)
            // forge-lint: disable-next-line(unsafe-typecast)
            feeBps: uint16(platformFeeBps),
            // casting to 'uint16' is safe because _validateCreation enforces length <= MAX_MILESTONES (20)
            // forge-lint: disable-next-line(unsafe-typecast)
            milestoneCount: uint16(amounts.length),
            payee: payee,
            arbiter: arbiter,
            token: token
        });

        _emitEscrowCreated(escrowId, referenceId, totalAmount, amounts);
    }

    function _validateCreation(address payee, address token, uint256 milestoneCount)
        private
        view
        returns (address arbiter)
    {
        if (!isTokenAllowed[token]) revert TokenNotAllowed(token);
        arbiter = defaultArbiter;
        if (payee == address(0) || payee == msg.sender || payee == arbiter || payee == address(this)) {
            revert InvalidPayee(payee);
        }
        if (msg.sender == arbiter) revert PayerCannotBeArbiter(msg.sender);
        if (milestoneCount == 0 || milestoneCount > MAX_MILESTONES) revert InvalidMilestoneCount(milestoneCount);
    }

    function _storeMilestones(uint256 escrowId, uint256[] calldata amounts) private returns (uint256 totalAmount) {
        mapping(uint256 => Milestone) storage milestones = _milestones[escrowId];
        uint256 count = amounts.length;
        for (uint256 i; i < count; ++i) {
            uint256 amount = amounts[i];
            // Cada hito debe validarse individualmente; el loop está acotado por MAX_MILESTONES.
            // forge-lint: disable-next-line(require-revert-in-loop)
            if (amount == 0) revert ZeroMilestoneAmount(i);
            totalAmount += amount;
            milestones[i] = Milestone({amount: SafeCast.toUint128(amount), status: MilestoneStatus.Funded});
        }
        uint256 maxAmount = maxEscrowAmount;
        if (totalAmount > maxAmount) revert EscrowAmountExceedsMax(totalAmount, maxAmount);
    }

    /// @dev Separado para no exceder la profundidad de stack del codegen legacy.
    function _emitEscrowCreated(uint256 escrowId, bytes32 referenceId, uint256 totalAmount, uint256[] calldata amounts)
        private
    {
        Escrow storage escrow = _escrows[escrowId];
        emit EscrowCreated(
            escrowId,
            escrow.payer,
            escrow.payee,
            escrow.arbiter,
            escrow.token,
            referenceId,
            totalAmount,
            escrow.feeBps,
            amounts
        );
    }

    /// @dev Exige que el contrato reciba exactamente `amount` (protege la contabilidad si el token, que es
    ///      upgradeable en el caso de USDC, llegara a cobrar comisión por transferencia).
    function _pullFunds(address token, uint256 amount) private {
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (received != amount) revert UnexpectedAmountReceived(amount, received);
    }

    function _payout(Escrow storage escrow, uint256 payerAmount, uint256 payeeAmount, uint256 fee) private {
        IERC20 token = IERC20(escrow.token);
        if (payerAmount != 0) token.safeTransfer(escrow.payer, payerAmount);
        if (payeeAmount != 0) token.safeTransfer(escrow.payee, payeeAmount);
        if (fee != 0) token.safeTransfer(feeRecipient, fee);
    }

    /// @dev Redondeos a favor de los usuarios: el fee redondea hacia abajo y el payee recibe el resto exacto, por
    ///      lo que payerAmount + payeeAmount + fee == amount siempre (sin polvo atrapado en el contrato).
    function _computeSplit(uint256 amount, uint256 feeBps, uint256 payerShareBps)
        private
        pure
        returns (uint256 payerAmount, uint256 payeeAmount, uint256 fee)
    {
        payerAmount = (amount * payerShareBps) / BPS_DENOMINATOR;
        uint256 payeeGross = amount - payerAmount;
        fee = (payeeGross * feeBps) / BPS_DENOMINATOR;
        payeeAmount = payeeGross - fee;
    }

    function _getEscrow(uint256 escrowId) private view returns (Escrow storage escrow) {
        escrow = _escrows[escrowId];
        if (escrow.payer == address(0)) revert EscrowNotFound(escrowId);
    }

    function _getMilestone(Escrow storage escrow, uint256 escrowId, uint256 milestoneIndex, MilestoneStatus expected)
        private
        view
        returns (Milestone storage milestone)
    {
        if (milestoneIndex >= escrow.milestoneCount) revert MilestoneNotFound(escrowId, milestoneIndex);
        milestone = _milestones[escrowId][milestoneIndex];
        if (milestone.status != expected) revert InvalidMilestoneStatus(escrowId, milestoneIndex, milestone.status);
    }

    function _setPlatformFeeBps(uint256 newFeeBps) private {
        if (newFeeBps > MAX_PLATFORM_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_PLATFORM_FEE_BPS);
        emit PlatformFeeUpdated(platformFeeBps, newFeeBps);
        platformFeeBps = newFeeBps;
    }

    function _setFeeRecipient(address newRecipient) private {
        if (newRecipient == address(0)) revert ZeroAddress();
        emit FeeRecipientUpdated(feeRecipient, newRecipient);
        feeRecipient = newRecipient;
    }

    function _setMaxEscrowAmount(uint256 newMaxAmount) private {
        if (newMaxAmount == 0 || newMaxAmount > type(uint128).max) revert InvalidMaxEscrowAmount(newMaxAmount);
        emit MaxEscrowAmountUpdated(maxEscrowAmount, newMaxAmount);
        maxEscrowAmount = newMaxAmount;
    }

    function _setDefaultArbiter(address newArbiter) private {
        if (newArbiter == address(0)) revert ZeroAddress();
        emit DefaultArbiterUpdated(defaultArbiter, newArbiter);
        defaultArbiter = newArbiter;
    }

    function _setTokenAllowed(address token, bool allowed) private {
        if (token == address(0)) revert ZeroAddress();
        isTokenAllowed[token] = allowed;
        emit TokenAllowlistUpdated(token, allowed);
    }
}
