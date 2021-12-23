// SPDX-License-Identifier: NONE
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FakeERC20 is ERC20 {

    uint8 dec;

    constructor(uint8 decimals_) ERC20("fake", "fake") {
        dec = decimals_;
        _mint(msg.sender, 250000 * 10**(decimals()));
    }

    function mint(uint256 amount, address to) external {
        _mint(to, amount);
    }

    /**
     * @return amount of decimals of rStable
    */
    function decimals() public view virtual override returns (uint8) {
        return dec;
    }
}