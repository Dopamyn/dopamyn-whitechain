# Whitechain feedback

Notes kept during ETHGlobal Mumbai, November 2026.

## What worked

- Test USDT is Tether's real `TetherTokenV2` implementation, and it is verified on the explorer. It has `permit` (EIP-2612) and `transferWithAuthorization` / `receiveWithAuthorization` (EIP-3009). Gasless checkout therefore needs no paymaster and no ERC-4337, only a relayer.
- The EIP-712 domain is the standard one (`"Tether USD"`, version `"1"`, chain 1874). It matched `DOMAIN_SEPARATOR()` on the first try.
- The explorer is Blockscout, so its standard verification API works.

## Where we got stuck

- **Two testnet RPC hosts.** `https://rpc-testnet.whitechain.io` answers `eth_chainId` with `0xa41` (2625), not 1874. The correct host is `https://rpc.testnet.whitechain.io/` (dot, not dash). The two names differ by one character, which is easy to get wrong.
- **The prize page gives no RPC URL.** It gives only an Ankr signup link. We found the URL on the docs "Connect a wallet" page.
- **The faucet page does not say which tokens it gives** or how much. It gives 0.5 WBT a day after a GitHub login. It does not give test USDT, and the USDT mint is owner only.

## What the docs were missing

- The token details for USDT: its contract address, decimals, EIP-712 domain, and which of permit and EIP-3009 it supports. We read them from the chain.
- A gasless-payment example with a relayer for EIP-3009 on Whitechain.
- How to get test USDT.
