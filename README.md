# Dopamyn campaign payouts on Whitechain

Dopamyn (https://dopamyn.ai) runs creator campaigns on X. A brand puts a USDT reward pool
into escrow, creators do tasks (post, reply, quote), Dopamyn verifies the tasks, and the
contract pays each creator. This repo moves that payout layer to Whitechain.

The repo has two parts:

- **Campaign payouts** (repo root): `QuestManager.sol` holds a brand's USDT reward pool
  and pays creators.
- **Pay per lookup** ([`pay/`](pay/README.md)): `LookupPay.sol` and a gas relayer. A user
  or an AI agent pays 0.25 USDT to find how to contact an X account. The payer pays no
  gas and pays only if a contact is found.

Status: work in progress for ETHGlobal Mumbai (Whitechain tracks "Continuity" and gasless payments).

## Network

| Item | Value |
| - | - |
| Network | Whitechain Sepolia, chain ID 1874 |
| RPC | https://rpc.testnet.whitechain.io |
| Explorer | https://explorer.testnet.whitechain.io |
| USDT | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` (6 decimals) |
| LookupPay | `TODO after deploy` (see [`pay/`](pay/README.md)) |
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

### First campaign on Whitechain (2026-11-05)

A brand launched campaign `15f8fe223e9ecfc4` from the Dopamyn app with a 10 USDT pool
(11.5 USDT with the service fee).

| Step | Transaction |
| - | - |
| Brand approves USDT for QuestManager | [`0xd41dad9e…dc64`](https://explorer.testnet.whitechain.io/tx/0xd41dad9e7c685d58d16e320e8ea29c44a35fca747f39ce720d92fb44f83cdc64) |
| `createQuest`: 11.5 USDT into escrow | [`0x82040f55…d270`](https://explorer.testnet.whitechain.io/tx/0x82040f552a990711ea056c4d4a77ef471b745813ef1e781f9769899cfbbbd270) |
