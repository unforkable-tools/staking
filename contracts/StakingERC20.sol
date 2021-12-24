// SPDX-License-Identifier: NONE
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "./Distribute.sol";
import "./interfaces/IERC900.sol";

/**
 * An IERC900 staking contract
 */
contract StakingERC20 is IERC900  {
    using SafeERC20 for IERC20;

    /// @dev handle to access ERC20 token token contract to make transfers
    IERC20 private _token;
    Distribute immutable public staking_contract_eth;
    Distribute immutable public staking_contract_token;

    event ProfitToken(uint256 amount);
    event ProfitEth(uint256 amount);
    event StakeChanged(uint256 total, uint256 timestamp);

    constructor(IERC20 stake_token, IERC20 reward_token, uint256 decimals) {
        _token = stake_token;
        staking_contract_eth = new Distribute(decimals, IERC20(address(0)));
        staking_contract_token = new Distribute(decimals, reward_token);
    }

    /**
        @dev Sends ETH to the eth reward pool of the staking contract
    */
    function distribute_eth() payable external {
        staking_contract_eth.distribute{value : msg.value}(0, msg.sender);
        emit ProfitEth(msg.value);
    }

    /**
        @dev Takes token from sender and puts it in the reward pool
        @param amount Amount of token to add to rewards
    */
    function distribute(uint256 amount) external {
        staking_contract_token.distribute(amount, msg.sender);
        emit ProfitToken(amount);
    }

    /**
        @dev Sends any reward token mistakingly sent to the main contract to the reward pool
    */
    function forward() external {
        IERC20 rewardToken = IERC20(staking_contract_token.reward_token());
        uint256 balance = rewardToken.balanceOf(address(this));
        if(balance > 0) {
            rewardToken.approve(address(staking_contract_token), balance);
            staking_contract_token.distribute(balance, address(this));
            emit ProfitToken(balance);
        }
    }
    
    /**
        @dev Stakes a certain amount of tokens, this MUST transfer the given amount from the account
        @param amount Amount of ERC20 token to stake
        @param data Additional data as per the EIP900
    */
    function stake(uint256 amount, bytes calldata data) external override {
        stakeFor(msg.sender, amount, data);
    }

    /**
        @dev Stakes a certain amount of tokens, this MUST transfer the given amount from the caller
        @param account Address who will own the stake afterwards
        @param amount Amount of ERC20 token to stake
        @param data Additional data as per the EIP900
    */
    function stakeFor(address account, uint256 amount, bytes calldata data) public override {
        //transfer the ERC20 token from the account, he must have set an allowance of {amount} tokens
        _token.safeTransferFrom(msg.sender, address(this), amount);
        staking_contract_eth.stakeFor(account, amount);
        staking_contract_token.stakeFor(account, amount);
        emit Staked(account, amount, totalStakedFor(account), data);
        emit StakeChanged(staking_contract_eth.totalStaked(), block.timestamp);
    }

    /**
        @dev Unstakes a certain amount of tokens, this SHOULD return the given amount of tokens to the account, if unstaking is currently not possible the function MUST revert
        @param amount Amount of ERC20 token to remove from the stake
        @param data Additional data as per the EIP900
    */
    function unstake(uint256 amount, bytes calldata data) external override {
        staking_contract_eth.unstakeFrom(payable(msg.sender), amount);
        staking_contract_token.unstakeFrom(payable(msg.sender), amount);
        _token.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount, totalStakedFor(msg.sender), data);
        emit StakeChanged(staking_contract_eth.totalStaked(), block.timestamp);
    }

     /**
        @dev Withdraws rewards (basically unstake then restake)
        @param amount Amount of ERC20 token to remove from the stake
    */
    function withdraw(uint256 amount) external {
        staking_contract_eth.withdrawFrom(payable(msg.sender), amount);
        staking_contract_token.withdrawFrom(payable(msg.sender),amount);
    }

    /**
        @dev Returns the current total of tokens staked for an address
        @param account address owning the stake
        @return the total of staked tokens of this address
    */
    function totalStakedFor(address account) public view override returns (uint256) {
        return staking_contract_eth.totalStakedFor(account);
    }
    
    /**
        @dev Returns the current total of tokens staked
        @return the total of staked tokens
    */
    function totalStaked() external view override returns (uint256) {
        return staking_contract_eth.totalStaked();
    }

    /**
        @dev returns the total rewards stored for token and eth
    */
    function totalReward() external view returns (uint256 tokenReward, uint256 ethReward) {
        tokenReward = staking_contract_token.getTotalReward();
        ethReward = staking_contract_eth.getTotalReward();
    }

    /**
        @dev Address of the token being used by the staking interface
        @return ERC20 token token address
    */
    function token() external view override returns (address) {
        return address(_token);
    }

    /**
        @dev MUST return true if the optional history functions are implemented, otherwise false
        We dont want this
    */
    function supportsHistory() external pure override returns (bool) {
        return false;
    }

    /**
        @dev Returns how much ETH the user can withdraw currently
        @param account Address of the user to check reward for
        @return _eth the amount of ETH the account will perceive if he unstakes now
        @return __token the amount of tokens the account will perceive if he unstakes now
    */
    function getReward(address account) public view returns (uint256 _eth, uint256 __token) {
        _eth = staking_contract_eth.getReward(account);
        __token = staking_contract_token.getReward(account);
    }
}