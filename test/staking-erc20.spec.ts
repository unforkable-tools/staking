
import chai from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { solidity } from 'ethereum-waffle';
import { formatBytes32String } from 'ethers/lib/utils';

import { FakeERC20 } from '../typechain/FakeERC20';
import { StakingERC20 } from '../typechain/StakingERC20';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

chai.use(solidity);

const { expect } = chai;

const initialTokenBalance = BigNumber.from('0xE35FA931A000');
const initialEthBalance = BigNumber.from('0x21E19E0C9BAB2400000');

async function getInfo(stacking: StakingERC20, userAddress: string) {
  const [
    distributeEthContract,
    distributeTokenContract,
    userTotalStake,
    totalStake,
    stackingTokenContract,
    supportsHistory,
    [ userEthReward, userTokenReward, ],
  ] = await Promise.all([
    stacking.staking_contract_eth(),
    stacking.staking_contract_token(),
    stacking.totalStakedFor(userAddress),
    stacking.totalStaked(),
    stacking.token(),
    stacking.supportsHistory(),
    stacking.getReward(userAddress),
  ]);
  return {
    distributeEthContract,
    distributeTokenContract,
    userTotalStake,
    totalStake,
    stackingTokenContract,
    supportsHistory,
    userEthReward,
    userTokenReward,
  };
}


describe('StackingERC20 Contract', () => {

  let rewardToken: FakeERC20;
  let stakingToken: FakeERC20;
  let staking: StakingERC20;
  let owner: string;
  let userA: SignerWithAddress;
  let userB: SignerWithAddress;

  beforeEach(async () => {

    const [ erc20Factory, stackingFactory, accounts ] = await Promise.all([
      ethers.getContractFactory('FakeERC20'),
      ethers.getContractFactory('StakingERC20'),
      ethers.getSigners(),
    ]);

    owner = accounts[0].address;
    userA = accounts[1];
    userB = accounts[2];

    [ rewardToken, stakingToken ] = await Promise.all([
      erc20Factory.deploy('9') as Promise<FakeERC20>,
      erc20Factory.deploy('9') as Promise<FakeERC20>,
    ]);

    staking = await stackingFactory.deploy(stakingToken.address, rewardToken.address, '0') as StakingERC20;
  });

  it('Should have been deployed correctly', async () => {
    const {
      userTotalStake,
      totalStake,
      stackingTokenContract,
      supportsHistory,
      userEthReward,
      userTokenReward,
    } = await getInfo(staking, userA.address);

    expect(userTotalStake).to.be.equal(0);
    expect(totalStake).to.be.equal(0);
    expect(stackingTokenContract).to.be.equal(stakingToken.address);
    expect(supportsHistory).to.be.equal(false);
    expect(userEthReward).to.be.equal(0);
    expect(userTokenReward).to.be.equal(0);
  });

  describe('requires some amount of tokens', () => {

    beforeEach(async () => {

      const { distributeTokenContract } = await getInfo(staking, userA.address);

      await Promise.all([
        rewardToken.approve(distributeTokenContract, BigNumber.from(1_000)),
        stakingToken.approve(staking.address, BigNumber.from(1_000)),
      ]);
    });

    it('Should stakeFor some tokens', async () => {

      const beforeBalance = await stakingToken.balanceOf(owner);
      const stakingBeforeBalance = await stakingToken.balanceOf(staking.address);
      const before = await getInfo(staking, userA.address);
      
      const tx = await staking.stakeFor(userA.address, BigNumber.from(100), formatBytes32String('0'));
      
      const afterBalance = await stakingToken.balanceOf(owner);
      const stakingAfterBalance = await stakingToken.balanceOf(staking.address);
      const after = await getInfo(staking, userA.address);

      expect(beforeBalance).to.be.equal(initialTokenBalance);
      expect(afterBalance).to.be.equal(initialTokenBalance.sub(100));
      
      expect(stakingBeforeBalance).to.be.equal(0);
      expect(stakingAfterBalance).to.be.equal(100);

      expect(tx).to.have.emit(staking, 'Staked').withArgs(
        userA.address,
        BigNumber.from(100),
        BigNumber.from(100),
        formatBytes32String('0'),
      );

      expect(before.totalStake).to.be.equal(0);
      expect(after.totalStake).to.be.equal(100);

      expect(before.userTotalStake).to.be.equal(0);
      expect(after.userTotalStake).to.be.equal(100);

      expect(before.userEthReward).to.be.equal(0);
      expect(after.userEthReward).to.be.equal(0);

      expect(before.userTokenReward).to.be.equal(0);
      expect(after.userTokenReward).to.be.equal(0);
    });

    it('Should unstake some tokens', async () => {

      staking.stake(BigNumber.from(100), formatBytes32String('0'));

      const beforeBalance = await stakingToken.balanceOf(owner);
      const stakingBeforeBalance = await stakingToken.balanceOf(staking.address);
      const before = await getInfo(staking, owner);

      const tx = await staking.unstake(BigNumber.from(70), formatBytes32String('0'));

      const afterBalance = await stakingToken.balanceOf(owner);
      const stakingAfterBalance = await stakingToken.balanceOf(staking.address);
      const after = await getInfo(staking, owner);

      expect(beforeBalance).to.be.equal(initialTokenBalance.sub(100));
      expect(afterBalance).to.be.equal(initialTokenBalance.sub(30));
      
      expect(stakingBeforeBalance).to.be.equal(100);
      expect(stakingAfterBalance).to.be.equal(30);

      expect(tx).to.have.emit(staking, 'Unstaked').withArgs(
        owner,
        BigNumber.from(70),
        BigNumber.from(30),
        formatBytes32String('0'),
      );
      
      expect(before.totalStake).to.be.equal(100);
      expect(after.totalStake).to.be.equal(30);

      expect(before.userTotalStake).to.be.equal(100);
      expect(after.userTotalStake).to.be.equal(30);

      expect(before.userEthReward).to.be.equal(0);
      expect(after.userEthReward).to.be.equal(0);

      expect(before.userTokenReward).to.be.equal(0);
      expect(after.userTokenReward).to.be.equal(0);
    });


    it('Should distribute some tokens', async () => {

      await staking.stakeFor(userA.address, BigNumber.from(100), formatBytes32String('0'));

      const beforeBalance = await stakingToken.balanceOf(owner);
      const stakingBeforeBalance = await stakingToken.balanceOf(staking.address);
      const before = await getInfo(staking, userA.address);

      const tx = await staking.distribute(BigNumber.from(200));

      const afterBalance = await stakingToken.balanceOf(owner);
      const stakingAfterBalance = await stakingToken.balanceOf(staking.address);
      const after = await getInfo(staking, userA.address);

      expect(beforeBalance).to.be.equal(initialTokenBalance.sub(100));
      expect(afterBalance).to.be.equal(initialTokenBalance.sub(100));
      
      expect(stakingBeforeBalance).to.be.equal(100);
      expect(stakingAfterBalance).to.be.equal(100);

      expect(tx).to.have.emit(staking, 'ProfitToken').withArgs(
        BigNumber.from(200),
      );
      
      expect(before.totalStake).to.be.equal(100);
      expect(after.totalStake).to.be.equal(100);

      expect(before.userTotalStake).to.be.equal(100);
      expect(after.userTotalStake).to.be.equal(100);

      expect(before.userEthReward).to.be.equal(0);
      expect(after.userEthReward).to.be.equal(0);

      expect(before.userTokenReward).to.be.equal(0);
      expect(after.userTokenReward).to.be.equal(200);
    });


    it('Should distribute some eth', async () => {
      
      await staking.stakeFor(userA.address, BigNumber.from(100), formatBytes32String('0'));

      const beforeBalance = await stakingToken.balanceOf(owner);
      const stakingBeforeBalance = await stakingToken.balanceOf(staking.address);
      const before = await getInfo(staking, userA.address);
      
      const tx = await staking.distribute_eth({ value: BigNumber.from(100) });
      
      const afterBalance = await stakingToken.balanceOf(owner);
      const stakingAfterBalance = await stakingToken.balanceOf(staking.address);
      const after = await getInfo(staking, userA.address);

      expect(beforeBalance).to.be.equal(initialTokenBalance.sub(100));
      expect(afterBalance).to.be.equal(initialTokenBalance.sub(100));
      
      expect(stakingBeforeBalance).to.be.equal(100);
      expect(stakingAfterBalance).to.be.equal(100);

      expect(tx).to.have.emit(staking, 'ProfitEth').withArgs(
        BigNumber.from(100),
      );
      
      expect(before.totalStake).to.be.equal(100);
      expect(after.totalStake).to.be.equal(100);

      expect(before.userTotalStake).to.be.equal(100);
      expect(after.userTotalStake).to.be.equal(100);

      expect(before.userEthReward).to.be.equal(0);
      expect(after.userEthReward).to.be.equal(100);

      expect(before.userTokenReward).to.be.equal(0);
      expect(after.userTokenReward).to.be.equal(0);

    });

    it('Should be able to forward wrongfully sent reward tokens', async () => {

      await staking.stakeFor(userA.address, BigNumber.from(100), formatBytes32String('0'));

      await rewardToken.transfer(staking.address, BigNumber.from(200));
      const tx = await staking.forward();

      expect(tx).to.have.emit(staking, 'ProfitToken').withArgs(
        BigNumber.from(200),
      );
    });


    it('Should withdraw reward', async () => {
      
      await staking.stakeFor(userA.address, BigNumber.from(100), formatBytes32String('0'));
      await staking.distribute_eth({ value: BigNumber.from(100) });
      await staking.distribute(BigNumber.from(100));

      const beforeBalance = await stakingToken.balanceOf(owner);
      const stakingBeforeBalance = await stakingToken.balanceOf(staking.address);
      const rewardBeforeBalance = await rewardToken.balanceOf(userA.address);
      const beforeEthBalance = await userA.getBalance();
      const before = await getInfo(staking, userA.address);
      
      const tx = await staking.connect(userA).withdraw(BigNumber.from(100));
      const receipt = await tx.wait();
      
      const afterBalance = await stakingToken.balanceOf(owner);
      const stakingAfterBalance = await stakingToken.balanceOf(staking.address);
      const rewardAfterBalance = await rewardToken.balanceOf(userA.address);
      const afterEthBalance = await userA.getBalance();
      const after = await getInfo(staking, userA.address);

      expect(beforeBalance).to.be.equal(initialTokenBalance.sub(100));
      expect(afterBalance).to.be.equal(initialTokenBalance.sub(100));
      
      expect(stakingBeforeBalance).to.be.equal(100);
      expect(stakingAfterBalance).to.be.equal(100);

      expect(before.totalStake).to.be.equal(100);
      expect(after.totalStake).to.be.equal(100);

      expect(before.userTotalStake).to.be.equal(100);
      expect(after.userTotalStake).to.be.equal(100);

      expect(before.userEthReward).to.be.equal(100);
      expect(after.userEthReward).to.be.equal(0);

      expect(before.userTokenReward).to.be.equal(100);
      expect(after.userTokenReward).to.be.equal(0);

      expect(rewardBeforeBalance).to.be.equal(0);
      expect(rewardAfterBalance).to.be.equal(100);

      expect(beforeEthBalance).to.be.equal(initialEthBalance);
      expect(afterEthBalance).to.be.equal(initialEthBalance.sub(tx.gasPrice!.mul(receipt.gasUsed)).add(100));
    });
  });
});