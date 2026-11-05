# Whitechain feedback

Notes kept during ETHGlobal Mumbai, November 2026.

## What worked

- Test USDT is Tether's real `TetherTokenV2` implementation, and it is verified on the explorer. It has `permit` (EIP-2612) and `transferWithAuthorization` / `receiveWithAuthorization` (EIP-3009). Gasless checkout therefore needs no paymaster and no ERC-4337, only a relayer.
- The EIP-712 domain is the standard one (`"Tether USD"`, version `"1"`, chain 1874). It matched `DOMAIN_SEPARATOR()` on the first try.
- The explorer is Blockscout, so its standard verification API works.

- **Moving an existing EVM contract took no code change.** `QuestManager.sol` from Base deployed and verified on Whitechain Sepolia as is. The Hardhat verify plugin worked against the Blockscout API (`/api`) with a custom chain entry.
- **The full campaign flow ran on the first try:** brand `approve` + `createQuest` from MetaMask through Privy, then three `sendReward` payouts from our backend worker. Gas cost was very small, and blocks came fast enough that the brand saw no wait.

## Where we got stuck

- **Two testnet RPC hosts.** `https://rpc-testnet.whitechain.io` answers `eth_chainId` with `0xa41` (2625), not 1874. The correct host is `https://rpc.testnet.whitechain.io/` (dot, not dash). The two names differ by one character, which is easy to get wrong.
- **The prize page gives no RPC URL.** It gives only an Ankr signup link. We found the URL on the docs "Connect a wallet" page.
- **The faucet page does not say which tokens it gives** or how much. It gives 0.5 WBT a day after a GitHub login. It does not give test USDT, and the USDT mint is owner only.

- **viem and Privy do not know Whitechain.** We defined the chain ourselves (id, RPC, explorer, WBT as native currency). The wallet then asked the user to add the network once.
- **Hardhat prints a warning** that per-network explorer keys are deprecated in favor of the Etherscan v2 key. Blockscout needs no key, but the docs do not show a working `customChains` block, so we wrote one by trial.

## What the docs were missing

- The token details for USDT: its contract address, decimals, EIP-712 domain, and which of permit and EIP-3009 it supports. We read them from the chain.
- A gasless-payment example with a relayer for EIP-3009 on Whitechain.
- How to get test USDT.
- A ready `viem` / `wagmi` chain object for Whitechain Sepolia (and mainnet when live) to copy into an app.
- A Hardhat `etherscan.customChains` example for the Blockscout explorer.
- The mainnet date, chain id and USDT address, so a team can plan the move from testnet.
