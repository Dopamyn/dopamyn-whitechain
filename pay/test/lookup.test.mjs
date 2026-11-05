import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import solc from "solc";
import { createPublicClient, domainSeparator, http, parseAbi, recoverTypedDataAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { USDT, receiveTypes, signPayment, usdtDomain, whitechainSepolia } from "../lib.mjs";

test("LookupPay compiles", () => {
  const input = {
    language: "Solidity",
    sources: { "LookupPay.sol": { content: readFileSync("contracts/LookupPay.sol", "utf8") } },
    settings: { outputSelection: { "*": { "*": ["evm.bytecode.object"] } } },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors || []).filter((e) => e.severity === "error");
  assert.deepEqual(errors, []);
  assert.ok(out.contracts["LookupPay.sol"].LookupPay.evm.bytecode.object.length > 100);
});

test("a signed payment recovers to the payer", async () => {
  const payer = privateKeyToAccount(generatePrivateKey());
  const to = "0x000000000000000000000000000000000000dEaD";
  const { authorization, signature } = await signPayment(payer, { to, value: "250000" });
  const message = { ...authorization, value: BigInt(authorization.value), validAfter: 0n, validBefore: BigInt(authorization.validBefore) };
  const signer = await recoverTypedDataAddress({
    domain: usdtDomain, types: receiveTypes, primaryType: "ReceiveWithAuthorization", message, signature,
  });
  assert.equal(signer, payer.address);
  assert.equal(authorization.nonce.length, 66);
});

test("our EIP-712 domain matches the token on chain", { skip: process.env.OFFLINE === "1" }, async () => {
  const reader = createPublicClient({ chain: whitechainSepolia, transport: http() });
  const onChain = await reader.readContract({
    address: USDT, abi: parseAbi(["function DOMAIN_SEPARATOR() view returns (bytes32)"]), functionName: "DOMAIN_SEPARATOR",
  });
  assert.equal(domainSeparator({ domain: usdtDomain }), onChain);
});
