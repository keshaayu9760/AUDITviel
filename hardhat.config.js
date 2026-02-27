/**
 * AuditViel — Polygon Amoy | Auditable Zero-Knowledge Verification Layer
 * 
 * Hardhat configuration for contract compilation, testing, and deployment.
 * Supports Polygon Amoy Testnet and localhost networks.
 */

require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const deployerKey = process.env.DEPLOYER_PRIVATE_KEY
  ? process.env.DEPLOYER_PRIVATE_KEY.replace(/\s+/g, "").replace(/^0x/i, "")
  : undefined;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Enable IR-based code generation to avoid "Stack too deep" errors
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    amoy: {
      url: process.env.RPC_URL || "https://rpc-amoy.polygon.technology",
      chainId: Number(process.env.CHAIN_ID) || 80002,
      accounts: deployerKey ? [`0x${deployerKey}`] : []
    },
    mainnet: {
      url: process.env.RPC_URL || "https://polygon-rpc.com",
      chainId: Number(process.env.CHAIN_ID) || 137,
      accounts: deployerKey ? [`0x${deployerKey}`] : []
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./tests",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
