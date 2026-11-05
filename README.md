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
| LookupPay | [`0xE96fd8A2f6F07233A3148F172405234a34f46d2e`](https://explorer.testnet.whitechain.io/address/0xe96fd8a2f6f07233a3148f172405234a34f46d2e#code) (verified, see [`pay/`](pay/README.md)) |
| QuestManager | [`0x89f2C6AD55fa6747A7b3985bC4A5aF319fe30B6E`](https://explorer.testnet.whitechain.io/address/0x89f2C6AD55fa6747A7b3985bC4A5aF319fe30B6E#code) (verified) |

## Why onchain stablecoin settlement

A brand pays creators in many countries, often 100+ creators for one campaign, and each one gets a few dollars.
A bank or card rail cannot do this: per-payout fees eat a 1 USDT reward, cross-border payouts take days,
and many creators have no bank account the brand can pay. The escrow contract also lets the creator check
that the brand put the full pool in before they do the work, and the brand can take back the unpaid part
after the deadline. A normal payment rail cannot show that.

## Architecture

```
Brand wallet ──approve + createQuest──▶ QuestManager (escrow, Whitechain)
                                            │
Dopamyn web app (closed source)             │ sendReward(questId, creator, amount)
  brand: picks Whitechain + USDT, funds     │   from the owner wallet, creator pays no gas
  creator: does the X task, clicks verify   │
             │                              ▼
             ▼                         creator wallet (USDT)
Dopamyn backend (closed source)
  checks the X task → queues a reward job → reward worker calls sendReward
  service fee → sendReward to the Dopamyn treasury (skipClaimedCheck = true)
```

Only the contracts are in this repo. The Dopamyn web app and backend are closed source. They
read the QuestManager address and the allowed reward tokens from a `chains` table, so a new chain
is a config row plus a small code change.

## Setup

```bash
npm install
cp .env.example .env   # set PRIVATE_KEY to a throwaway key funded from the faucet
npm test
npm run deploy
```

## Before the hackathon

`contracts/QuestManager.sol` already runs Dopamyn campaigns with real brands and creators:

- Source: [Dopamyn/dopamyn-base-contract](https://github.com/Dopamyn/dopamyn-base-contract),
  last contract change [`8ed3ba7`](https://github.com/Dopamyn/dopamyn-base-contract/commit/8ed3ba7) on 2026-04-20.
- Base mainnet: [`0xED65670AE7B220f072c94fBaBF116Fb40B1F35a9`](https://basescan.org/address/0xED65670AE7B220f072c94fBaBF116Fb40B1F35a9).
- Arbitrum: [`0xBE7ca2995406C26ebecb82392826b5e8D1141DA7`](https://arbiscan.io/address/0xBE7ca2995406C26ebecb82392826b5e8D1141DA7).

The contract code in this repo is the same as on Base. The hackathon work is the Whitechain deploy
and the Dopamyn app integration, listed in "During the hackathon" below.

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
| `sendReward`: 1.5 USDT service fee to the Dopamyn treasury | [`0x942092b3…1b11`](https://explorer.testnet.whitechain.io/tx/0x942092b34ab6697f7daed68921a875149ea5efdd45884d48c7cf014e30b21b11) |
| `sendReward`: 1 USDT to creator 1 after the follow was checked | [`0xd8d77a45…88d7`](https://explorer.testnet.whitechain.io/tx/0xd8d77a45fc779ba0c7ffa1e3744d44012f9bfb95da298e40f54eb89e096988d7) |
| `sendReward`: 1 USDT to creator 2 after the follow was checked | [`0xf47d1258…aa99`](https://explorer.testnet.whitechain.io/tx/0xf47d1258b29d3ef2f7124434b1058822d86a638fc8e9f06998aba950f9d0aa99) |

The Dopamyn backend sends each `sendReward` from the contract owner wallet. The creator pays no gas. 8 USDT stays in escrow for the next 8 creators.

## Current limitations

- Whitechain Sepolia only. Dopamyn turns on Whitechain in production when Whitechain mainnet is live.
- The owner wallet sends every payout, so Dopamyn must keep WBT in it for gas.
- One owner key controls payouts for all campaigns. A multisig or role split is not done yet.
- A brand must hold a little WBT to fund a campaign (`approve` + `createQuest`). A permit-based
  createQuest (USDT supports EIP-2612) would remove this step.
- Refunds (`cancelQuest`, `claimRemainingReward`) exist in the contract but were not run on Whitechain yet.
