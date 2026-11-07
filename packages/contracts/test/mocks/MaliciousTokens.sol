// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Token que, una vez armado, re-entra en `target` con `payload` durante cualquier transferencia.
contract ReentrantERC20 is ERC20 {
    address public target;
    bytes public payload;
    bool private _reentering;

    constructor() ERC20("Reentrant Token", "REENT") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(address target_, bytes calldata payload_) external {
        target = target_;
        payload = payload_;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (target == address(0) || _reentering) return;
        _reentering = true;
        (bool ok, bytes memory returndata) = target.call(payload);
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(returndata, 0x20), mload(returndata))
            }
        }
        _reentering = false;
    }
}

/// @notice Token que quema 1% de cada transferencia (simula un token con fee-on-transfer).
contract FeeOnTransferERC20 is ERC20 {
    constructor() ERC20("Fee Token", "FEE") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) return super._update(from, to, value);
        uint256 burned = value / 100;
        super._update(from, address(0), burned);
        super._update(from, to, value - burned);
    }
}
