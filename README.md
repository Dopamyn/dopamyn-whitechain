# Dopamyn campaign payouts on Whitechain

Dopamyn (https://dopamyn.ai) runs creator campaigns on X. A brand puts a USDT reward pool
into escrow, creators do tasks (post, reply, quote), Dopamyn verifies the tasks, and the
contract pays each creator. This repo moves that payout layer to Whitechain.

Status: work in progress for ETHGlobal Mumbai (Whitechain track "Continuity").

## Network

| Item | Value |
| - | - |
| Network | Whitechain Sepolia, chain ID 1874 |
| RPC | https://rpc.testnet.whitechain.io |
| Explorer | https://explorer.testnet.whitechain.io |
| USDT | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` (6 decimals) |
| QuestManager | [`0x89f2C6AD55fa6747A7b3985bC4A5aF319fe30B6E`](https://explorer.testnet.whitechain.io/address/0x89f2C6AD55fa6747A7b3985bC4A5aF319fe30B6E#code) (verified) |

## Setup

```bash
npm install
cp .env.example .env   # set PRIVATE_KEY to a throwaway key funded from the faucet
npm test
npm run deploy
```

## Before the hackathon

`contracts/QuestManager.sol` already runs Dopamyn campaigns on Base (first deploy
before the event; last change 2026-04-20). The hackathon work is listed in
"During the hackathon" below.

## During the hackathon

- Whitechain Sepolia deploy + Blockscout verification config.
- QuestManager deployed and verified on Whitechain Sepolia:
  [`0x89f2C6AD55fa6747A7b3985bC4A5aF319fe30B6E`](https://explorer.testnet.whitechain.io/address/0x89f2C6AD55fa6747A7b3985bC4A5aF319fe30B6E#code).
  USDT is the supported reward token.
- Dopamyn app: Whitechain is a campaign chain. Brands fund campaigns in USDT, and
  creators get USDT payouts from QuestManager.
