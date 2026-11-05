import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";
import "dotenv/config";

const config: HardhatUserConfig = {
  // Same compiler settings as the Base deployment, so the bytecode matches.
  solidity: {
    version: "0.8.26",
    settings: { optimizer: { enabled: false, runs: 200 }, evmVersion: "cancun" },
  },
  networks: {
    whitechainSepolia: {
      url: process.env.WHITECHAIN_SEPOLIA_RPC_URL || "https://rpc.testnet.whitechain.io",
      chainId: 1874,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  // Blockscout needs no API key; hardhat-verify still wants a non-empty string.
  etherscan: {
    apiKey: { whitechainSepolia: "blockscout" },
    customChains: [
      {
        network: "whitechainSepolia",
        chainId: 1874,
        urls: {
          apiURL: "https://explorer.testnet.whitechain.io/api",
          browserURL: "https://explorer.testnet.whitechain.io",
        },
      },
    ],
  },
  sourcify: { enabled: false },
};

export default config;
