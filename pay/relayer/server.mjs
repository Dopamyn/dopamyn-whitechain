// Gas relayer for LookupPay. It takes a payer's signed USDT authorization,
// checks it, and submits LookupPay.pay() with its own WBT. Two calls:
//   POST /verify  - all checks, no transaction (the API calls this before it does the work)
//   POST /settle  - the same checks, then the transaction (after the work succeeds)
//   GET  /health  - relayer address, WBT balance, transactions today
// Every POST needs header `x-relayer-key: $RELAYER_API_KEY`.
import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import {
  createPublicClient, createWalletClient, formatEther, getAddress, http as viemHttp,
  isAddress, isHex, parseEther, parseSignature, verifyTypedData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EXPLORER_URL, USDT, envKey, lookupPayAbi, receiveTypes, usdtAbi, usdtDomain, whitechainSepolia } from "../lib.mjs";

const env = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`missing env ${name}`);
  return value;
};

const PORT = Number(env("PORT", "8787"));
const API_KEY = env("RELAYER_API_KEY");
const CONTRACT = getAddress(env("LOOKUP_PAY_ADDRESS"));
const MAX_TX_PER_DAY = Number(env("MAX_TX_PER_DAY", "500"));
const MAX_WINDOW_SECONDS = Number(env("MAX_WINDOW_SECONDS", "3600"));
const MIN_SECONDS_LEFT = 60; // time we need to get the transaction mined
const LOW_WBT = parseEther(env("LOW_WBT", "0.05"));

const account = privateKeyToAccount(envKey("RELAYER_PRIVATE_KEY"));
const reader = createPublicClient({ chain: whitechainSepolia, transport: viemHttp() });
const writer = createWalletClient({ account, chain: whitechainSepolia, transport: viemHttp() });

// ponytail: in-memory counters, reset on restart; move to Redis if we run more than one relayer.
const inFlight = new Set();
let day = new Date().toISOString().slice(0, 10);
let txToday = 0;

class Rejected extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function parseBody({ authorization: a, signature }) {
  if (!a || !isHex(signature) || !isAddress(a.from) || !isAddress(a.to) || !isHex(a.nonce) || a.nonce.length !== 66) {
    throw new Rejected(400, "bad authorization or signature");
  }
  try {
    return {
      from: getAddress(a.from), to: getAddress(a.to), nonce: a.nonce,
      value: BigInt(a.value), validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore),
      signature,
    };
  } catch {
    throw new Rejected(400, "bad number in authorization");
  }
}

/** Every check that can fail before we spend gas. Throws Rejected. */
async function check(p) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (p.to !== CONTRACT) throw new Rejected(400, "payment is not to the LookupPay contract");
  if (p.validAfter > now) throw new Rejected(400, "authorization is not valid yet");
  if (p.validBefore < now + BigInt(MIN_SECONDS_LEFT)) throw new Rejected(400, "authorization expires too soon");
  if (p.validBefore > now + BigInt(MAX_WINDOW_SECONDS)) throw new Rejected(400, "authorization window is too long");

  const message = { from: p.from, to: p.to, value: p.value, validAfter: p.validAfter, validBefore: p.validBefore, nonce: p.nonce };
  const signedByPayer = await verifyTypedData({
    address: p.from, domain: usdtDomain, types: receiveTypes,
    primaryType: "ReceiveWithAuthorization", message, signature: p.signature,
  });
  if (!signedByPayer) throw new Rejected(400, "signature is not from the payer");

  const [price, balance, used] = await Promise.all([
    reader.readContract({ address: CONTRACT, abi: lookupPayAbi, functionName: "price" }),
    reader.readContract({ address: USDT, abi: usdtAbi, functionName: "balanceOf", args: [p.from] }),
    reader.readContract({ address: USDT, abi: usdtAbi, functionName: "authorizationState", args: [p.from, p.nonce] }),
  ]);
  if (p.value < price) throw new Rejected(402, "payment is below the price");
  if (used) throw new Rejected(409, "this payment was already used");
  if (balance < p.value) throw new Rejected(402, "not enough USDT in the payer wallet");
}

function payArgs(p) {
  const { r, s, v, yParity } = parseSignature(p.signature);
  return [p.from, p.value, p.validAfter, p.validBefore, p.nonce, Number(v ?? BigInt(yParity + 27)), r, s];
}

async function settle(p) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; txToday = 0; }
  if (txToday >= MAX_TX_PER_DAY) throw new Rejected(429, "relayer daily limit reached");
  if (inFlight.has(p.from)) throw new Rejected(409, "a payment from this wallet is in progress");
  inFlight.add(p.from);
  try {
    await check(p);
    // eth_call first: a payment that would revert costs us nothing.
    const { request } = await reader.simulateContract({
      account, address: CONTRACT, abi: lookupPayAbi, functionName: "pay", args: payArgs(p),
    });
    const hash = await writer.writeContract(request);
    txToday += 1;
    const receipt = await reader.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (receipt.status !== "success") throw new Rejected(502, `transaction reverted: ${hash}`);
    return { tx_hash: hash, explorer_url: `${EXPLORER_URL}/tx/${hash}`, payer: p.from, value: p.value.toString() };
  } finally {
    inFlight.delete(p.from);
  }
}

async function health() {
  const wbt = await reader.getBalance({ address: account.address });
  return { relayer: account.address, contract: CONTRACT, wbt: formatEther(wbt), low: wbt < LOW_WBT, tx_today: txToday };
}

function authorized(req) {
  const given = Buffer.from(String(req.headers["x-relayer-key"] || ""));
  const want = Buffer.from(API_KEY);
  return given.length === want.length && timingSafeEqual(given, want);
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new Rejected(413, "body too large");
  }
  try { return JSON.parse(raw || "{}"); } catch { throw new Rejected(400, "body is not JSON"); }
}

const server = http.createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  try {
    if (req.method === "GET" && req.url === "/health") return send(200, await health());
    if (req.method !== "POST" || !["/verify", "/settle"].includes(req.url)) return send(404, { error: "not found" });
    if (!authorized(req)) return send(401, { error: "bad relayer key" });
    const payment = parseBody(await readJson(req));
    if (req.url === "/verify") {
      await check(payment);
      return send(200, { ok: true, payer: payment.from, value: payment.value.toString() });
    }
    return send(200, await settle(payment));
  } catch (err) {
    if (err instanceof Rejected) return send(err.status, { error: err.message });
    console.error(err);
    return send(502, { error: err.shortMessage || "relayer error" });
  }
});

server.listen(PORT, () => console.log(`relayer ${account.address} on :${PORT}, contract ${CONTRACT}`));
