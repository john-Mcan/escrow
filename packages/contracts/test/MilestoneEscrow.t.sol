// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {MilestoneEscrow} from "../src/MilestoneEscrow.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {ReentrantERC20, FeeOnTransferERC20} from "./mocks/MaliciousTokens.sol";

contract MilestoneEscrowTest is Test {
    MilestoneEscrow internal escrow;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal arbiter = makeAddr("arbiter");
    address internal treasury = makeAddr("treasury");
    address internal payee = makeAddr("payee");
    address internal stranger = makeAddr("stranger");
    address internal payer;
    uint256 internal payerPk;

    uint256 internal constant FEE_BPS = 150; // 1.5%
    uint256 internal constant MAX_ESCROW = 5000e6;
    uint256 internal constant PAYER_BALANCE = 10_000e6;
    uint256 internal constant M0 = 1000e6;
    uint256 internal constant M1 = 1500e6;
    uint256 internal constant M2 = 500e6;
    uint256 internal constant TOTAL = M0 + M1 + M2;
    bytes32 internal constant REF = bytes32(uint256(0x7f1c2a90e4b34d0c9f8a1b2c3d4e5f60));
    bytes32 internal constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function setUp() public {
        (payer, payerPk) = makeAddrAndKey("payer");
        usdc = new MockUSDC();
        escrow = new MilestoneEscrow(owner, arbiter, treasury, FEE_BPS, address(usdc));

        usdc.mint(payer, PAYER_BALANCE);
        vm.prank(payer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    function _amounts(uint256 a) internal pure returns (uint256[] memory arr) {
        arr = new uint256[](1);
        arr[0] = a;
    }

    function _amounts(uint256 a, uint256 b) internal pure returns (uint256[] memory arr) {
        arr = new uint256[](2);
        arr[0] = a;
        arr[1] = b;
    }

    function _amounts(uint256 a, uint256 b, uint256 c) internal pure returns (uint256[] memory arr) {
        arr = new uint256[](3);
        arr[0] = a;
        arr[1] = b;
        arr[2] = c;
    }

    function _create(uint256[] memory amounts) internal returns (uint256 escrowId) {
        vm.prank(payer);
        escrowId = escrow.createAndFundEscrow(payee, address(usdc), amounts, REF);
    }

    function _createDefault() internal returns (uint256) {
        return _create(_amounts(M0, M1, M2));
    }

    function _status(uint256 escrowId, uint256 index) internal view returns (MilestoneEscrow.MilestoneStatus) {
        return escrow.getMilestone(escrowId, index).status;
    }

    function _dispute(uint256 escrowId, uint256 index) internal {
        vm.prank(payer);
        escrow.raiseDispute(escrowId, index);
    }

    function _signPermit(uint256 pk, address holder, uint256 value, uint256 deadline)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, holder, address(escrow), value, usdc.nonces(holder), deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(pk, digest);
    }

    function _expectInvalidStatus(uint256 escrowId, uint256 index, MilestoneEscrow.MilestoneStatus status) internal {
        vm.expectRevert(
            abi.encodeWithSelector(MilestoneEscrow.InvalidMilestoneStatus.selector, escrowId, index, status)
        );
    }

    // =====================================================================
    // Constructor / configuración inicial
    // =====================================================================

    function test_constructor_initializesConfig() public view {
        assertEq(escrow.owner(), owner);
        assertEq(escrow.defaultArbiter(), arbiter);
        assertEq(escrow.feeRecipient(), treasury);
        assertEq(escrow.platformFeeBps(), FEE_BPS);
        assertEq(escrow.maxEscrowAmount(), MAX_ESCROW);
        assertEq(escrow.maxEscrowAmount(), escrow.DEFAULT_MAX_ESCROW_AMOUNT());
        assertTrue(escrow.isTokenAllowed(address(usdc)));
        assertEq(escrow.escrowCount(), 0);
        assertFalse(escrow.paused());
    }

    function test_RevertWhen_constructorConfigInvalid() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new MilestoneEscrow(address(0), arbiter, treasury, FEE_BPS, address(usdc));

        vm.expectRevert(MilestoneEscrow.ZeroAddress.selector);
        new MilestoneEscrow(owner, address(0), treasury, FEE_BPS, address(usdc));

        vm.expectRevert(MilestoneEscrow.ZeroAddress.selector);
        new MilestoneEscrow(owner, arbiter, address(0), FEE_BPS, address(usdc));

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.FeeTooHigh.selector, 501, 500));
        new MilestoneEscrow(owner, arbiter, treasury, 501, address(usdc));

        vm.expectRevert(MilestoneEscrow.ZeroAddress.selector);
        new MilestoneEscrow(owner, arbiter, treasury, FEE_BPS, address(0));
    }

    // =====================================================================
    // Creación y fondeo
    // =====================================================================

    function test_createAndFundEscrow_locksFundsAndStoresMilestones() public {
        uint256 escrowId = _createDefault();

        assertEq(escrowId, 1);
        assertEq(escrow.escrowCount(), 1);
        assertEq(usdc.balanceOf(address(escrow)), TOTAL);
        assertEq(usdc.balanceOf(payer), PAYER_BALANCE - TOTAL);

        MilestoneEscrow.Escrow memory e = escrow.getEscrow(escrowId);
        assertEq(e.payer, payer);
        assertEq(e.payee, payee);
        assertEq(e.arbiter, arbiter);
        assertEq(e.token, address(usdc));
        assertEq(e.feeBps, FEE_BPS);
        assertEq(e.milestoneCount, 3);

        MilestoneEscrow.Milestone[] memory milestones = escrow.getMilestones(escrowId);
        assertEq(milestones.length, 3);
        assertEq(milestones[0].amount, M0);
        assertEq(milestones[1].amount, M1);
        assertEq(milestones[2].amount, M2);
        for (uint256 i; i < milestones.length; ++i) {
            assertEq(uint8(milestones[i].status), uint8(MilestoneEscrow.MilestoneStatus.Funded));
        }
    }

    function test_createAndFundEscrow_emitsEscrowCreated() public {
        uint256[] memory amounts = _amounts(M0, M1, M2);

        vm.expectEmit(true, true, true, true, address(escrow));
        emit MilestoneEscrow.EscrowCreated(
            1, payer, payee, arbiter, address(usdc), REF, TOTAL, uint16(FEE_BPS), amounts
        );
        _create(amounts);
    }

    function test_createAndFundEscrow_assignsSequentialIds() public {
        assertEq(_create(_amounts(100e6)), 1);
        assertEq(_create(_amounts(100e6)), 2);
        assertEq(_create(_amounts(100e6)), 3);
        assertEq(escrow.escrowCount(), 3);
    }

    function test_createAndFundEscrow_acceptsExactlyMaxEscrowAmount() public {
        uint256 escrowId = _create(_amounts(4000e6, 1000e6));
        assertEq(usdc.balanceOf(address(escrow)), MAX_ESCROW);
        assertEq(escrow.getEscrow(escrowId).milestoneCount, 2);
    }

    function test_RevertWhen_totalExceedsMaxEscrowAmount() public {
        uint256[] memory amounts = _amounts(4000e6, 1000e6 + 1);
        vm.expectRevert(
            abi.encodeWithSelector(MilestoneEscrow.EscrowAmountExceedsMax.selector, MAX_ESCROW + 1, MAX_ESCROW)
        );
        vm.prank(payer);
        escrow.createAndFundEscrow(payee, address(usdc), amounts, REF);
    }

    function test_RevertWhen_totalExceedsUpdatedMaxEscrowAmount() public {
        vm.prank(owner);
        escrow.setMaxEscrowAmount(1000e6);

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.EscrowAmountExceedsMax.selector, 1000e6 + 1, 1000e6));
        vm.prank(payer);
        escrow.createAndFundEscrow(payee, address(usdc), _amounts(1000e6 + 1), REF);

        // Al subir el límite el mismo monto se acepta.
        vm.prank(owner);
        escrow.setMaxEscrowAmount(10_000e6);
        _create(_amounts(6000e6, 1000e6 + 1));
    }

    function test_RevertWhen_paused() public {
        vm.prank(owner);
        escrow.pause();

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(payer);
        escrow.createAndFundEscrow(payee, address(usdc), _amounts(M0), REF);

        (uint8 v, bytes32 r, bytes32 s) = _signPermit(payerPk, payer, M0, block.timestamp + 1 hours);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(payer);
        escrow.createAndFundEscrowWithPermit(
            payee, address(usdc), _amounts(M0), REF, block.timestamp + 1 hours, v, r, s
        );

        vm.prank(owner);
        escrow.unpause();
        _create(_amounts(M0));
    }

    function test_RevertWhen_tokenNotAllowed() public {
        MockUSDC other = new MockUSDC();
        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.TokenNotAllowed.selector, address(other)));
        vm.prank(payer);
        escrow.createAndFundEscrow(payee, address(other), _amounts(M0), REF);
    }

    function test_RevertWhen_payeeInvalid() public {
        address[4] memory invalid = [address(0), payer, arbiter, address(escrow)];
        for (uint256 i; i < invalid.length; ++i) {
            vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.InvalidPayee.selector, invalid[i]));
            vm.prank(payer);
            escrow.createAndFundEscrow(invalid[i], address(usdc), _amounts(M0), REF);
        }
    }

    function test_RevertWhen_payerIsArbiter() public {
        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.PayerCannotBeArbiter.selector, arbiter));
        vm.prank(arbiter);
        escrow.createAndFundEscrow(payee, address(usdc), _amounts(M0), REF);
    }

    function test_RevertWhen_milestoneCountInvalid() public {
        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.InvalidMilestoneCount.selector, 0));
        vm.prank(payer);
        escrow.createAndFundEscrow(payee, address(usdc), new uint256[](0), REF);

        uint256[] memory tooMany = new uint256[](21);
        for (uint256 i; i < tooMany.length; ++i) {
            tooMany[i] = 1e6;
        }
        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.InvalidMilestoneCount.selector, 21));
        vm.prank(payer);
        escrow.createAndFundEscrow(payee, address(usdc), tooMany, REF);
    }

    function test_createAndFundEscrow_acceptsMaxMilestones() public {
        uint256[] memory amounts = new uint256[](20);
        for (uint256 i; i < amounts.length; ++i) {
            amounts[i] = 100e6;
        }
        uint256 escrowId = _create(amounts);
        assertEq(escrow.getMilestones(escrowId).length, 20);
    }

    function test_RevertWhen_milestoneAmountIsZero() public {
        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.ZeroMilestoneAmount.selector, 1));
        vm.prank(payer);
        escrow.createAndFundEscrow(payee, address(usdc), _amounts(M0, 0), REF);
    }

    function test_RevertWhen_allowanceMissing() public {
        usdc.mint(stranger, M0);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(escrow), 0, M0)
        );
        vm.prank(stranger);
        escrow.createAndFundEscrow(payee, address(usdc), _amounts(M0), REF);
    }

    function test_RevertWhen_tokenChargesTransferFee() public {
        FeeOnTransferERC20 feeToken = new FeeOnTransferERC20();
        vm.prank(owner);
        escrow.setTokenAllowed(address(feeToken), true);
        feeToken.mint(payer, M0);
        vm.prank(payer);
        feeToken.approve(address(escrow), M0);

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.UnexpectedAmountReceived.selector, M0, M0 - M0 / 100));
        vm.prank(payer);
        escrow.createAndFundEscrow(payee, address(feeToken), _amounts(M0), REF);
    }

    // =====================================================================
    // Fondeo con permit (EIP-2612) en una sola transacción
    // =====================================================================

    function test_createAndFundEscrowWithPermit_fundsInSingleTransaction() public {
        vm.prank(payer);
        usdc.approve(address(escrow), 0);

        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(payerPk, payer, TOTAL, deadline);

        vm.prank(payer);
        uint256 escrowId =
            escrow.createAndFundEscrowWithPermit(payee, address(usdc), _amounts(M0, M1, M2), REF, deadline, v, r, s);

        assertEq(escrowId, 1);
        assertEq(usdc.balanceOf(address(escrow)), TOTAL);
        assertEq(usdc.allowance(payer, address(escrow)), 0);
        assertEq(usdc.nonces(payer), 1);
    }

    function test_createAndFundEscrowWithPermit_survivesPermitFrontRun() public {
        vm.prank(payer);
        usdc.approve(address(escrow), 0);

        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(payerPk, payer, M0, deadline);

        // Un tercero observa el mempool y consume la firma antes que el payer.
        vm.prank(stranger);
        usdc.permit(payer, address(escrow), M0, deadline, v, r, s);

        vm.prank(payer);
        escrow.createAndFundEscrowWithPermit(payee, address(usdc), _amounts(M0), REF, deadline, v, r, s);
        assertEq(usdc.balanceOf(address(escrow)), M0);
    }

    function test_RevertWhen_permitSignedByWrongKey() public {
        vm.prank(payer);
        usdc.approve(address(escrow), 0);

        (, uint256 strangerPk) = makeAddrAndKey("stranger");
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(strangerPk, payer, M0, deadline);

        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(escrow), 0, M0)
        );
        vm.prank(payer);
        escrow.createAndFundEscrowWithPermit(payee, address(usdc), _amounts(M0), REF, deadline, v, r, s);
    }

    // =====================================================================
    // Liberación (camino feliz)
    // =====================================================================

    function test_releaseMilestone_paysNetToPayeeAndFeeToTreasury() public {
        uint256 escrowId = _createDefault();
        uint256 expectedFee = 15e6; // 1.5% de 1.000 USDC
        uint256 expectedNet = 985e6;

        vm.expectEmit(true, true, true, true, address(escrow));
        emit MilestoneEscrow.MilestoneReleased(escrowId, 0, M0, expectedNet, expectedFee);
        vm.prank(payer);
        escrow.releaseMilestone(escrowId, 0);

        assertEq(usdc.balanceOf(payee), expectedNet);
        assertEq(usdc.balanceOf(treasury), expectedFee);
        assertEq(usdc.balanceOf(address(escrow)), TOTAL - M0);
        assertEq(uint8(_status(escrowId, 0)), uint8(MilestoneEscrow.MilestoneStatus.Released));
        assertEq(uint8(_status(escrowId, 1)), uint8(MilestoneEscrow.MilestoneStatus.Funded));
    }

    function test_releaseMilestone_feeRoundsDownInFavorOfPayee() public {
        uint256 escrowId = _create(_amounts(333_333)); // 0.333333 USDC
        vm.prank(payer);
        escrow.releaseMilestone(escrowId, 0);

        // 333_333 * 150 / 10_000 = 4_999.995 -> 4_999
        assertEq(usdc.balanceOf(treasury), 4999);
        assertEq(usdc.balanceOf(payee), 328_334);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_releaseMilestone_usesFeeSnapshotFromCreation() public {
        uint256 oldEscrow = _create(_amounts(M0));
        vm.prank(owner);
        escrow.setPlatformFeeBps(500);
        uint256 newEscrow = _create(_amounts(M0));

        vm.startPrank(payer);
        escrow.releaseMilestone(oldEscrow, 0);
        assertEq(usdc.balanceOf(treasury), 15e6); // 1.5% fijado al crear
        escrow.releaseMilestone(newEscrow, 0);
        vm.stopPrank();

        assertEq(usdc.balanceOf(treasury), 15e6 + 50e6); // 5% para el escrow nuevo
        assertEq(usdc.balanceOf(payee), 985e6 + 950e6);
    }

    function test_releaseMilestone_withZeroFee() public {
        vm.prank(owner);
        escrow.setPlatformFeeBps(0);
        uint256 escrowId = _create(_amounts(M0));

        vm.prank(payer);
        escrow.releaseMilestone(escrowId, 0);
        assertEq(usdc.balanceOf(payee), M0);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_releaseAllMilestones_emptiesContract() public {
        uint256 escrowId = _createDefault();
        vm.startPrank(payer);
        escrow.releaseMilestone(escrowId, 0);
        escrow.releaseMilestone(escrowId, 1);
        escrow.releaseMilestone(escrowId, 2);
        vm.stopPrank();

        uint256 totalFee = (TOTAL * FEE_BPS) / 10_000; // 45 USDC
        assertEq(usdc.balanceOf(treasury), totalFee);
        assertEq(usdc.balanceOf(payee), TOTAL - totalFee);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_RevertWhen_releaseCalledByNonPayer() public {
        uint256 escrowId = _createDefault();
        address[4] memory callers = [payee, arbiter, owner, stranger];
        for (uint256 i; i < callers.length; ++i) {
            vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.CallerNotPayer.selector, callers[i]));
            vm.prank(callers[i]);
            escrow.releaseMilestone(escrowId, 0);
        }
    }

    function test_RevertWhen_releaseCalledTwice() public {
        uint256 escrowId = _createDefault();
        vm.prank(payer);
        escrow.releaseMilestone(escrowId, 0);

        _expectInvalidStatus(escrowId, 0, MilestoneEscrow.MilestoneStatus.Released);
        vm.prank(payer);
        escrow.releaseMilestone(escrowId, 0);
    }

    function test_RevertWhen_escrowOrMilestoneDoesNotExist() public {
        uint256 escrowId = _createDefault();

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.EscrowNotFound.selector, 99));
        vm.prank(payer);
        escrow.releaseMilestone(99, 0);

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.MilestoneNotFound.selector, escrowId, 3));
        vm.prank(payer);
        escrow.releaseMilestone(escrowId, 3);

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.EscrowNotFound.selector, 0));
        escrow.getEscrow(0);

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.MilestoneNotFound.selector, escrowId, 3));
        escrow.getMilestone(escrowId, 3);

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.EscrowNotFound.selector, 99));
        escrow.getMilestones(99);
    }

    // =====================================================================
    // Reembolso
    // =====================================================================

    function test_refundMilestone_returnsFullAmountWithoutFee() public {
        uint256 escrowId = _createDefault();

        vm.expectEmit(true, true, true, true, address(escrow));
        emit MilestoneEscrow.MilestoneRefunded(escrowId, 1, M1);
        vm.prank(payee);
        escrow.refundMilestone(escrowId, 1);

        assertEq(usdc.balanceOf(payer), PAYER_BALANCE - TOTAL + M1);
        assertEq(usdc.balanceOf(treasury), 0);
        assertEq(usdc.balanceOf(payee), 0);
        assertEq(usdc.balanceOf(address(escrow)), TOTAL - M1);
        assertEq(uint8(_status(escrowId, 1)), uint8(MilestoneEscrow.MilestoneStatus.Refunded));
    }

    function test_RevertWhen_refundCalledByNonPayee() public {
        uint256 escrowId = _createDefault();
        address[4] memory callers = [payer, arbiter, owner, stranger];
        for (uint256 i; i < callers.length; ++i) {
            vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.CallerNotPayee.selector, callers[i]));
            vm.prank(callers[i]);
            escrow.refundMilestone(escrowId, 0);
        }
    }

    function test_RevertWhen_refundAfterRelease() public {
        uint256 escrowId = _createDefault();
        vm.prank(payer);
        escrow.releaseMilestone(escrowId, 0);

        _expectInvalidStatus(escrowId, 0, MilestoneEscrow.MilestoneStatus.Released);
        vm.prank(payee);
        escrow.refundMilestone(escrowId, 0);
    }

    // =====================================================================
    // Disputas
    // =====================================================================

    function test_raiseDispute_byPayer() public {
        uint256 escrowId = _createDefault();

        vm.expectEmit(true, true, true, true, address(escrow));
        emit MilestoneEscrow.DisputeRaised(escrowId, 0, payer);
        vm.prank(payer);
        escrow.raiseDispute(escrowId, 0);

        assertEq(uint8(_status(escrowId, 0)), uint8(MilestoneEscrow.MilestoneStatus.Disputed));
        assertEq(usdc.balanceOf(address(escrow)), TOTAL);
    }

    function test_raiseDispute_byPayee() public {
        uint256 escrowId = _createDefault();

        vm.expectEmit(true, true, true, true, address(escrow));
        emit MilestoneEscrow.DisputeRaised(escrowId, 2, payee);
        vm.prank(payee);
        escrow.raiseDispute(escrowId, 2);

        assertEq(uint8(_status(escrowId, 2)), uint8(MilestoneEscrow.MilestoneStatus.Disputed));
    }

    function test_RevertWhen_raiseDisputeByOutsider() public {
        uint256 escrowId = _createDefault();
        address[3] memory callers = [arbiter, owner, stranger];
        for (uint256 i; i < callers.length; ++i) {
            vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.CallerNotParticipant.selector, callers[i]));
            vm.prank(callers[i]);
            escrow.raiseDispute(escrowId, 0);
        }
    }

    function test_RevertWhen_raiseDisputeOnSettledOrDisputedMilestone() public {
        uint256 escrowId = _createDefault();
        vm.prank(payer);
        escrow.releaseMilestone(escrowId, 0);
        _expectInvalidStatus(escrowId, 0, MilestoneEscrow.MilestoneStatus.Released);
        vm.prank(payee);
        escrow.raiseDispute(escrowId, 0);

        _dispute(escrowId, 1);
        _expectInvalidStatus(escrowId, 1, MilestoneEscrow.MilestoneStatus.Disputed);
        vm.prank(payee);
        escrow.raiseDispute(escrowId, 1);
    }

    function test_disputedMilestoneIsFrozenForParties() public {
        uint256 escrowId = _createDefault();
        _dispute(escrowId, 0);

        _expectInvalidStatus(escrowId, 0, MilestoneEscrow.MilestoneStatus.Disputed);
        vm.prank(payer);
        escrow.releaseMilestone(escrowId, 0);

        _expectInvalidStatus(escrowId, 0, MilestoneEscrow.MilestoneStatus.Disputed);
        vm.prank(payee);
        escrow.refundMilestone(escrowId, 0);

        // Los demás hitos siguen operando con normalidad.
        vm.prank(payer);
        escrow.releaseMilestone(escrowId, 1);
    }

    // =====================================================================
    // Resolución por árbitro
    // =====================================================================

    function test_resolveDispute_splitsWithProportionalFee() public {
        uint256 escrowId = _createDefault();
        _dispute(escrowId, 0);
        uint256 payerBefore = usdc.balanceOf(payer);

        // 40% al payer (400 USDC); 600 USDC al payee menos 1.5% (9 USDC).
        vm.expectEmit(true, true, true, true, address(escrow));
        emit MilestoneEscrow.DisputeResolved(escrowId, 0, arbiter, 4000, 400e6, 591e6, 9e6);
        vm.prank(arbiter);
        escrow.resolveDispute(escrowId, 0, 4000);

        assertEq(usdc.balanceOf(payer) - payerBefore, 400e6);
        assertEq(usdc.balanceOf(payee), 591e6);
        assertEq(usdc.balanceOf(treasury), 9e6);
        assertEq(usdc.balanceOf(arbiter), 0);
        assertEq(usdc.balanceOf(address(escrow)), TOTAL - M0);
        assertEq(uint8(_status(escrowId, 0)), uint8(MilestoneEscrow.MilestoneStatus.Resolved));
    }

    function test_resolveDispute_fullRefundChargesNoFee() public {
        uint256 escrowId = _createDefault();
        _dispute(escrowId, 0);
        uint256 payerBefore = usdc.balanceOf(payer);

        vm.prank(arbiter);
        escrow.resolveDispute(escrowId, 0, 10_000);

        assertEq(usdc.balanceOf(payer) - payerBefore, M0);
        assertEq(usdc.balanceOf(payee), 0);
        assertEq(usdc.balanceOf(treasury), 0);
        assertEq(usdc.balanceOf(arbiter), 0);
    }

    function test_resolveDispute_fullPayoutMatchesRelease() public {
        uint256 escrowId = _createDefault();
        _dispute(escrowId, 0);

        vm.prank(arbiter);
        escrow.resolveDispute(escrowId, 0, 0);

        assertEq(usdc.balanceOf(payee), 985e6);
        assertEq(usdc.balanceOf(treasury), 15e6);
        assertEq(usdc.balanceOf(arbiter), 0);
    }

    function test_RevertWhen_resolveCalledByNonArbiter() public {
        uint256 escrowId = _createDefault();
        _dispute(escrowId, 0);
        address[4] memory callers = [owner, payer, payee, stranger];
        for (uint256 i; i < callers.length; ++i) {
            vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.CallerNotArbiter.selector, callers[i]));
            vm.prank(callers[i]);
            escrow.resolveDispute(escrowId, 0, 5000);
        }
    }

    function test_RevertWhen_resolveWithInvalidShare() public {
        uint256 escrowId = _createDefault();
        _dispute(escrowId, 0);

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.InvalidShareBps.selector, 10_001));
        vm.prank(arbiter);
        escrow.resolveDispute(escrowId, 0, 10_001);
    }

    function test_RevertWhen_resolveMilestoneNotDisputed() public {
        uint256 escrowId = _createDefault();

        _expectInvalidStatus(escrowId, 0, MilestoneEscrow.MilestoneStatus.Funded);
        vm.prank(arbiter);
        escrow.resolveDispute(escrowId, 0, 5000);

        _dispute(escrowId, 0);
        vm.prank(arbiter);
        escrow.resolveDispute(escrowId, 0, 5000);

        _expectInvalidStatus(escrowId, 0, MilestoneEscrow.MilestoneStatus.Resolved);
        vm.prank(arbiter);
        escrow.resolveDispute(escrowId, 0, 5000);
    }

    function test_resolveDispute_usesArbiterSnapshotFromCreation() public {
        uint256 oldEscrow = _createDefault();
        address newArbiter = makeAddr("newArbiter");
        vm.prank(owner);
        escrow.setDefaultArbiter(newArbiter);
        uint256 newEscrow = _createDefault();

        _dispute(oldEscrow, 0);
        _dispute(newEscrow, 0);

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.CallerNotArbiter.selector, newArbiter));
        vm.prank(newArbiter);
        escrow.resolveDispute(oldEscrow, 0, 0);

        vm.prank(arbiter);
        escrow.resolveDispute(oldEscrow, 0, 0);

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.CallerNotArbiter.selector, arbiter));
        vm.prank(arbiter);
        escrow.resolveDispute(newEscrow, 0, 0);

        vm.prank(newArbiter);
        escrow.resolveDispute(newEscrow, 0, 0);
    }

    // =====================================================================
    // Guardrails operacionales
    // =====================================================================

    function test_settlementWorksWhilePaused() public {
        uint256 escrowId = _createDefault();
        vm.prank(owner);
        escrow.pause();

        vm.prank(payer);
        escrow.releaseMilestone(escrowId, 0);
        vm.prank(payee);
        escrow.refundMilestone(escrowId, 1);
        _dispute(escrowId, 2);
        vm.prank(arbiter);
        escrow.resolveDispute(escrowId, 2, 5000);

        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_disallowedTokenStillSettlesExistingEscrows() public {
        uint256 escrowId = _createDefault();
        vm.prank(owner);
        escrow.setTokenAllowed(address(usdc), false);

        vm.prank(payer);
        escrow.releaseMilestone(escrowId, 0);
        assertEq(usdc.balanceOf(payee), 985e6);

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.TokenNotAllowed.selector, address(usdc)));
        vm.prank(payer);
        escrow.createAndFundEscrow(payee, address(usdc), _amounts(M0), REF);
    }

    function test_RevertWhen_tokenReentersDuringPayout() public {
        ReentrantERC20 evil = new ReentrantERC20();
        vm.prank(owner);
        escrow.setTokenAllowed(address(evil), true);
        evil.mint(payer, TOTAL);
        vm.startPrank(payer);
        evil.approve(address(escrow), TOTAL);
        uint256 escrowId = escrow.createAndFundEscrow(payee, address(evil), _amounts(M0, M1), REF);
        vm.stopPrank();

        evil.arm(address(escrow), abi.encodeCall(MilestoneEscrow.releaseMilestone, (escrowId, 1)));

        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        vm.prank(payer);
        escrow.releaseMilestone(escrowId, 0);
    }

    function test_RevertWhen_tokenReentersDuringFunding() public {
        ReentrantERC20 evil = new ReentrantERC20();
        vm.prank(owner);
        escrow.setTokenAllowed(address(evil), true);
        evil.mint(payer, TOTAL);
        vm.prank(payer);
        evil.approve(address(escrow), TOTAL);

        evil.arm(
            address(escrow),
            abi.encodeCall(MilestoneEscrow.createAndFundEscrow, (payee, address(evil), _amounts(M1), REF))
        );

        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        vm.prank(payer);
        escrow.createAndFundEscrow(payee, address(evil), _amounts(M0), REF);
    }

    // =====================================================================
    // Administración
    // =====================================================================

    function test_RevertWhen_nonOwnerCallsAdmin() public {
        bytes[7] memory calls = [
            abi.encodeCall(MilestoneEscrow.pause, ()),
            abi.encodeCall(MilestoneEscrow.unpause, ()),
            abi.encodeCall(MilestoneEscrow.setPlatformFeeBps, (100)),
            abi.encodeCall(MilestoneEscrow.setFeeRecipient, (stranger)),
            abi.encodeCall(MilestoneEscrow.setMaxEscrowAmount, (1e6)),
            abi.encodeCall(MilestoneEscrow.setDefaultArbiter, (stranger)),
            abi.encodeCall(MilestoneEscrow.setTokenAllowed, (stranger, true))
        ];
        address[3] memory callers = [arbiter, payer, stranger];
        for (uint256 c; c < callers.length; ++c) {
            for (uint256 i; i < calls.length; ++i) {
                vm.prank(callers[c]);
                (bool ok, bytes memory err) = address(escrow).call(calls[i]);
                assertFalse(ok);
                assertEq(err, abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, callers[c]));
            }
        }
    }

    function test_ownerSettersUpdateConfigAndEmit() public {
        address newTreasury = makeAddr("newTreasury");
        address newArbiter = makeAddr("newArbiter");
        vm.startPrank(owner);

        vm.expectEmit(address(escrow));
        emit MilestoneEscrow.PlatformFeeUpdated(FEE_BPS, 500);
        escrow.setPlatformFeeBps(500);

        vm.expectEmit(address(escrow));
        emit MilestoneEscrow.FeeRecipientUpdated(treasury, newTreasury);
        escrow.setFeeRecipient(newTreasury);

        vm.expectEmit(address(escrow));
        emit MilestoneEscrow.MaxEscrowAmountUpdated(MAX_ESCROW, 20_000e6);
        escrow.setMaxEscrowAmount(20_000e6);

        vm.expectEmit(address(escrow));
        emit MilestoneEscrow.DefaultArbiterUpdated(arbiter, newArbiter);
        escrow.setDefaultArbiter(newArbiter);

        vm.expectEmit(address(escrow));
        emit MilestoneEscrow.TokenAllowlistUpdated(stranger, true);
        escrow.setTokenAllowed(stranger, true);
        vm.stopPrank();

        assertEq(escrow.platformFeeBps(), 500);
        assertEq(escrow.feeRecipient(), newTreasury);
        assertEq(escrow.maxEscrowAmount(), 20_000e6);
        assertEq(escrow.defaultArbiter(), newArbiter);
        assertTrue(escrow.isTokenAllowed(stranger));
    }

    function test_RevertWhen_ownerSetsInvalidConfig() public {
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.FeeTooHigh.selector, 501, 500));
        escrow.setPlatformFeeBps(501);

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.InvalidMaxEscrowAmount.selector, 0));
        escrow.setMaxEscrowAmount(0);

        uint256 tooLarge = uint256(type(uint128).max) + 1;
        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.InvalidMaxEscrowAmount.selector, tooLarge));
        escrow.setMaxEscrowAmount(tooLarge);

        vm.expectRevert(MilestoneEscrow.ZeroAddress.selector);
        escrow.setFeeRecipient(address(0));

        vm.expectRevert(MilestoneEscrow.ZeroAddress.selector);
        escrow.setDefaultArbiter(address(0));

        vm.expectRevert(MilestoneEscrow.ZeroAddress.selector);
        escrow.setTokenAllowed(address(0), true);
        vm.stopPrank();
    }

    function test_feesGoToCurrentFeeRecipient() public {
        uint256 escrowId = _createDefault();
        address newTreasury = makeAddr("newTreasury");
        vm.prank(owner);
        escrow.setFeeRecipient(newTreasury);

        vm.prank(payer);
        escrow.releaseMilestone(escrowId, 0);
        assertEq(usdc.balanceOf(newTreasury), 15e6);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_ownershipTransferRequiresAcceptance() public {
        address newOwner = makeAddr("newOwner");
        vm.prank(owner);
        escrow.transferOwnership(newOwner);
        assertEq(escrow.owner(), owner);
        assertEq(escrow.pendingOwner(), newOwner);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        escrow.acceptOwnership();

        vm.prank(newOwner);
        escrow.acceptOwnership();
        assertEq(escrow.owner(), newOwner);
    }

    // =====================================================================
    // Lecturas
    // =====================================================================

    function test_previewSettlement_matchesResolution() public {
        uint256 escrowId = _createDefault();
        (uint256 payerAmount, uint256 payeeAmount, uint256 fee) = escrow.previewSettlement(escrowId, 1, 2500);
        assertEq(payerAmount, 375e6);
        assertEq(payeeAmount, 1_108_125_000); // 1125 USDC brutos - 1.5%
        assertEq(fee, 16_875_000);

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.InvalidShareBps.selector, 10_001));
        escrow.previewSettlement(escrowId, 1, 10_001);

        vm.expectRevert(abi.encodeWithSelector(MilestoneEscrow.MilestoneNotFound.selector, escrowId, 3));
        escrow.previewSettlement(escrowId, 3, 0);
    }

    // =====================================================================
    // Fuzzing
    // =====================================================================

    function testFuzz_resolveDispute_conservesValue(uint256 amount, uint256 payerShareBps, uint256 feeBps) public {
        amount = bound(amount, 1, MAX_ESCROW);
        payerShareBps = bound(payerShareBps, 0, 10_000);
        feeBps = bound(feeBps, 0, 500);

        vm.prank(owner);
        escrow.setPlatformFeeBps(feeBps);
        uint256 escrowId = _create(_amounts(amount));
        _dispute(escrowId, 0);

        uint256 payerBefore = usdc.balanceOf(payer);
        vm.prank(arbiter);
        escrow.resolveDispute(escrowId, 0, payerShareBps);

        uint256 payerGot = usdc.balanceOf(payer) - payerBefore;
        uint256 payeeGot = usdc.balanceOf(payee);
        uint256 feeGot = usdc.balanceOf(treasury);

        assertEq(payerGot + payeeGot + feeGot, amount, "valor no conservado");
        assertEq(payerGot, (amount * payerShareBps) / 10_000);
        assertEq(feeGot, ((amount - payerGot) * feeBps) / 10_000);
        assertLe(feeGot, (amount * 500) / 10_000, "fee excede el 5%");
        assertEq(usdc.balanceOf(arbiter), 0, "el arbiter recibio fondos");
        assertEq(usdc.balanceOf(address(escrow)), 0, "polvo atrapado");
    }

    function testFuzz_release_accountsForEveryUnit(uint256 a, uint256 b) public {
        a = bound(a, 1, MAX_ESCROW / 2);
        b = bound(b, 1, MAX_ESCROW / 2);
        uint256 escrowId = _create(_amounts(a, b));

        vm.startPrank(payer);
        escrow.releaseMilestone(escrowId, 0);
        escrow.releaseMilestone(escrowId, 1);
        vm.stopPrank();

        uint256 expectedFee = (a * FEE_BPS) / 10_000 + (b * FEE_BPS) / 10_000;
        assertEq(usdc.balanceOf(treasury), expectedFee);
        assertEq(usdc.balanceOf(payee), a + b - expectedFee);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }
}
