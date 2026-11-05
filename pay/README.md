# Pay per lookup (`pay/`)

Pay-per-lookup in USDT on Whitechain. The payer pays no gas and sees no crypto steps.

[Dopamyn](https://dopamyn.ai) Contact Finder finds how to reach a person from their X account: email, Telegram, LinkedIn, website. It searches the web on demand. Each lookup costs **0.25 USDT**, and the payer pays **only if a contact is found**. This folder holds the public, onchain part: the `LookupPay` contract and the gas relayer. The Dopamyn API and web app are closed source and appear below as one box.

**Why onchain stablecoin settlement:** a card cannot charge $0.25, because the card fee alone is about $0.30. A card also needs an account and a sign-up. Here, a browser wallet or an AI agent signs a payment in USDT. The payment settles in seconds and the receipt is a public transaction. The payer needs no account with us and no WBT.

- Network: Whitechain Sepolia, chain ID 1874
- USDT: `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` (Tether `TetherTokenV2`, 6 decimals, EIP-2612 and EIP-3009)
- LookupPay: [`0xE96fd8A2f6F07233A3148F172405234a34f46d2e`](https://explorer.testnet.whitechain.io/address/0xe96fd8a2f6f07233a3148f172405234a34f46d2e#code) (verified)
- First real USDT payment: [`0x063e767e…f2c8`](https://explorer.testnet.whitechain.io/tx/0x063e767edd6a0c2c3d2d55dd3da5ed9fe33b6c76fe38e9cbdd446bb6e7a8f2c8). The payer wallet `0xA845…B372` holds 0 WBT. It signed 0.25 USDT, and the relayer `0x1261…38b4` sent the transaction and paid the gas.

## How it works

```
 Payer (browser wallet / AI agent)          Dopamyn API (closed)                 Relayer (this repo)        Whitechain
 ─────────────────────────────────          ────────────────────                 ───────────────────        ──────────
 1. signs ReceiveWithAuthorization ──────▶  2. POST /contact-finder/lookups
    (EIP-712, no gas, no popup)                checks amount + window ─────────▶ 3. /verify: signature,
                                                                                    balance, nonce unused,
                                               4. web search for the person          price, window
                                               5. contact found? ───── yes ────▶ 6. /settle: simulate,
                                                  no → nothing is charged            then LookupPay.pay() ──▶ USDT payer → LookupPay
                                               7. shows the contacts + receipt ◀── tx hash                     relayer pays WBT gas
```

1. The payer signs an EIP-3009 `ReceiveWithAuthorization` for 0.25 USDT to the `LookupPay` contract. Signing costs nothing. In the web app, the browser wallet signs with no popup.
2. The API checks the amount and that the authorization is valid for at least 10 more minutes. Then the relayer runs `/verify`.
3. The API searches for the person's contacts.
4. If a contact is found, the relayer runs `/settle`. It simulates `LookupPay.pay()`, sends it, and pays the WBT gas. `pay()` calls `receiveWithAuthorization` on USDT, and the USDT moves from the payer to the contract. If no contact is found, the authorization expires unused and nothing moves.

## Gas, WBT and drain protection (Track 3 questions)

**How the business pays gas.** The relayer key holds WBT and sends every `pay()` transaction. The payer only signs. The price includes the gas. The first `pay()` used 108,731 gas, which cost 0.00054 WBT.

**How the relayer gets WBT.** On testnet it gets WBT from the faucet. `GET /health` returns the WBT balance and a `low` flag below `LOW_WBT`. On mainnet, the plan is to swap part of the USDT in `LookupPay` to WBT on a Whitechain DEX and top up the relayer. That swap is not built.

**What stops someone from draining it.**
- **The relayer calls one function on one contract.** It cannot send WBT or call anything else.
- **No gas is spent on a payment that fails.** Before every transaction, the relayer checks the signature, the price, the payer's USDT balance, that the nonce is unused, and the time window. Then it simulates the call with `eth_call`.
- **No one can make the relayer's transaction revert.** `pay()` uses `receiveWithAuthorization`, which only the receiving contract can call. A signed payment copied from the mempool cannot be settled on the token directly, so it cannot make the relayer's transaction revert.
- **Signed payments are short-lived and single-use.** The window is at most 1 hour (`MAX_WINDOW_SECONDS`), and the token refuses a nonce twice.
- **Limits.**
  - Only callers with the `RELAYER_API_KEY` can use the relayer.
  - Each payer wallet can have one payment in progress.
  - The relayer sends at most `MAX_TX_PER_DAY` transactions a day.
  - The API allows one running lookup per user and 30 lookups a day.
- **The hot wallet holds little.** It holds only a small amount of WBT. The USDT collects in the contract, and only the owner can withdraw it.

## Setup

```bash
cd pay
npm install
cp .env.example .env   # wallet keys default to PRIVATE_KEY in ../.env
npm test               # compiles the contract, checks signing and the token's EIP-712 domain on chain
```

Deploy and verify `LookupPay` (the deployer needs WBT from the faucet):

```bash
node --env-file=../.env --env-file=.env scripts/deploy.mjs
```

Run the relayer (its key needs WBT), then pay once from a wallet that holds USDT and no WBT:

```bash
node --env-file=../.env --env-file=.env relayer/server.mjs
node --env-file=../.env --env-file=.env scripts/pay.mjs
```

## Files

| File | What it does |
|---|---|
| `contracts/LookupPay.sol` | `pay()` settles a signed USDT authorization to the contract and emits `Paid(nonce, payer, value)`. The owner can call `setPrice` and `withdraw`. |
| `relayer/server.mjs` | `POST /verify`, `POST /settle`, `GET /health`. Holds the WBT key. |
| `lib.mjs` | Chain, token domain, ABIs, and `signPayment()` for scripts and agents. |
| `scripts/deploy.mjs` | Compiles with solc-js, deploys, and verifies on the explorer. |
| `scripts/pay.mjs` | Runs one payment end to end, without the Dopamyn API. |

## Current limits

- **The browser wallet is a key in `localStorage`.** It is for testnet only. For real funds, an embedded wallet (for example Privy) or Dopamyn credits replaces it.
- **The payer funds the wallet with USDT once.** That top-up is the one crypto step.
- **The relayer keeps its limits in memory.** Run one relayer, or move the counters to Redis.
- **There is no automatic WBT top-up.** An alert flag shows a low balance. Someone tops up by hand.
- **There is no refund path.** Payment happens only after a contact is found, so a refund case comes only from a wrong contact.
- **Next step: agents through the Dopamyn MCP.** They will pay through the same relayer with x402. This is not built.
