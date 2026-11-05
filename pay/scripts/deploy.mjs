// Compile LookupPay with solc-js, deploy it to Whitechain Sepolia, and verify
// it on the Blockscout explorer.
//   DEPLOYER_PRIVATE_KEY=0x... PRICE_UNITS=250000 node scripts/deploy.mjs
import { readFileSync } from "node:fs";
import solc from "solc";
import { createPublicClient, createWalletClient, encodeAbiParameters, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EXPLORER_URL, USDT, envKey, whitechainSepolia } from "../lib.mjs";

const SOURCE = "contracts/LookupPay.sol";
const price = BigInt(process.env.PRICE_UNITS || "250000"); // 0.25 USDT, 6 decimals

const input = {
  language: "Solidity",
  sources: { [SOURCE]: { content: readFileSync(SOURCE, "utf8") } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "cancun",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors || []).filter((e) => e.severity === "error");
if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
const { abi, evm } = output.contracts[SOURCE].LookupPay;

const account = privateKeyToAccount(envKey("DEPLOYER_PRIVATE_KEY"));
const reader = createPublicClient({ chain: whitechainSepolia, transport: http() });
const writer = createWalletClient({ account, chain: whitechainSepolia, transport: http() });

const hash = await writer.deployContract({ abi, bytecode: `0x${evm.bytecode.object}`, args: [USDT, price] });
const receipt = await reader.waitForTransactionReceipt({ hash });
const address = receipt.contractAddress;
console.log(`LookupPay deployed: ${address}\n  tx ${EXPLORER_URL}/tx/${hash}`);

// Blockscout wants the full compiler name, for example v0.8.24+commit.e11b9ed9.
const compiler = `v${solc.version().replace(/\.Emscripten.*$/, "")}`;
const form = new FormData();
form.append("compiler_version", compiler);
form.append("license_type", "mit");
form.append("contract_name", `${SOURCE}:LookupPay`);
form.append("autodetect_constructor_args", "false");
form.append("constructor_args", encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [USDT, price]).slice(2));
form.append("files[0]", new Blob([JSON.stringify(input)], { type: "application/json" }), "input.json");

// The explorer needs a few seconds to index the new contract.
await new Promise((resolve) => setTimeout(resolve, 15_000));
const res = await fetch(`${EXPLORER_URL}/api/v2/smart-contracts/${address}/verification/via/standard-input`, {
  method: "POST",
  body: form,
});
console.log(`verify: ${res.status} ${await res.text()}`);
console.log(`check: ${EXPLORER_URL}/address/${address}?tab=contract`);
