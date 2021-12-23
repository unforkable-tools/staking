import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'

export default{
  solidity: {
    version: "0.8.0",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  defaultNetwork: "hardhat",
   networks: {
      //  hardhat: {},
   },
   typechain: {
    outDir: "typechain/",
    target: "ethers-v5",
  },
};
