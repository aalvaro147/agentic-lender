require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
    },
  },
  networks: {
    localhost: {
      url: process.env.EVM_RPC_URL || "http://127.0.0.1:8545",
      chainId: Number(process.env.EVM_CHAIN_ID || 31337),
    },
  },
};
