// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MilestoneEscrow} from "../src/MilestoneEscrow.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @notice Despliega MilestoneEscrow. Solo lee direcciones PÚBLICAS del entorno; la firma se hace con un keystore
///         cifrado (`--account <nombre>`) o con hardware wallet (`--ledger`). Nunca con una llave en `.env`.
///
/// Base Sepolia:
///   forge script script/DeployMilestoneEscrow.s.sol --rpc-url base_sepolia --account deployer --broadcast --verify
/// Anvil local (despliega también MockUSDC si USDC_ADDRESS no está definido):
///   forge script script/DeployMilestoneEscrow.s.sol --rpc-url localhost --broadcast \
///     --unlocked --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
contract DeployMilestoneEscrow is Script {
    uint256 internal constant ANVIL_CHAIN_ID = 31_337;
    address internal constant USDC_BASE_MAINNET = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external returns (MilestoneEscrow escrow, address usdc) {
        address owner = vm.envAddress("ESCROW_OWNER");
        address arbiter = vm.envAddress("ESCROW_ARBITER");
        address feeRecipient = vm.envAddress("ESCROW_FEE_RECIPIENT");
        uint256 feeBps = vm.envOr("ESCROW_PLATFORM_FEE_BPS", uint256(150));
        usdc = vm.envOr("USDC_ADDRESS", _defaultUsdc());

        vm.startBroadcast();
        if (usdc == address(0)) {
            require(block.chainid == ANVIL_CHAIN_ID, "USDC_ADDRESS requerido fuera de Anvil");
            usdc = address(new MockUSDC());
        }
        escrow = new MilestoneEscrow(owner, arbiter, feeRecipient, feeBps, usdc);
        vm.stopBroadcast();

        console.log("chainId          ", block.chainid);
        console.log("MilestoneEscrow  ", address(escrow));
        console.log("USDC             ", usdc);
        console.log("owner (Safe)     ", owner);
        console.log("arbiter (Safe)   ", arbiter);
        console.log("feeRecipient     ", feeRecipient);
        console.log("platformFeeBps   ", feeBps);
    }

    function _defaultUsdc() internal view returns (address) {
        if (block.chainid == 8453) return USDC_BASE_MAINNET;
        if (block.chainid == 84_532) return USDC_BASE_SEPOLIA;
        return address(0);
    }
}
