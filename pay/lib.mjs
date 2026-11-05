// Chain, token and contract constants shared by the relayer and the scripts.
import { defineChain, parseAbi } from "viem";

export const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.whitechain.io";
export const EXPLORER_URL = "https://explorer.testnet.whitechain.io";

export const whitechainSepolia = defineChain({
  id: 1874,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WhiteBIT Coin", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Whitechain Explorer", url: EXPLORER_URL } },
  testnet: true,
});

// Tether's TetherTokenV2 on Whitechain Sepolia (6 decimals, EIP-2612 + EIP-3009).
export const USDT = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";

// Checked against the token's DOMAIN_SEPARATOR() on chain.
export const usdtDomain = { name: "Tether USD", version: "1", chainId: 1874, verifyingContract: USDT };

export const receiveTypes = {
  ReceiveWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

export const usdtAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
]);

export const lookupPayAbi = parseAbi([
  "function price() view returns (uint256)",
  "function pay(address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "event Paid(bytes32 indexed nonce, address indexed payer, uint256 value)",
  "error BelowPrice()",
]);

/** Sign a USDT payment to `to` (the LookupPay contract). Used by scripts/pay.mjs. */
export async function signPayment(account, { to, value, windowSeconds = 900 }) {
  const nonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;
  const authorization = {
    from: account.address,
    to,
    value: BigInt(value),
    validAfter: 0n,
    validBefore: BigInt(Math.floor(Date.now() / 1000) + windowSeconds),
    nonce,
  };
  const signature = await account.signTypedData({
    domain: usdtDomain,
    types: receiveTypes,
    primaryType: "ReceiveWithAuthorization",
    message: authorization,
  });
  // JSON form: numbers as decimal strings.
  const json = Object.fromEntries(Object.entries(authorization).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v]));
  return { authorization: json, signature };
}

/** A wallet key from env. Falls back to PRIVATE_KEY, the repo's deployer key in ../.env. */
export function envKey(name) {
  const key = process.env[name] || process.env.PRIVATE_KEY;
  if (!key) throw new Error(`missing env ${name} (or PRIVATE_KEY)`);
  return key.startsWith("0x") ? key : `0x${key}`;
}
