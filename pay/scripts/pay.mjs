// End-to-end check without the Dopamyn API: sign a 0.25 USDT payment from a
// payer key that holds USDT and no WBT, then let the relayer verify and settle it.
//   PAYER_PRIVATE_KEY=0x... RELAYER_URL=http://localhost:8787 RELAYER_API_KEY=... \
//   LOOKUP_PAY_ADDRESS=0x... node scripts/pay.mjs
import { privateKeyToAccount } from "viem/accounts";
import { signPayment } from "../lib.mjs";

const relayer = process.env.RELAYER_URL || "http://localhost:8787";
const headers = { "content-type": "application/json", "x-relayer-key": process.env.RELAYER_API_KEY };
const payer = privateKeyToAccount(process.env.PAYER_PRIVATE_KEY);
const body = JSON.stringify(await signPayment(payer, {
  to: process.env.LOOKUP_PAY_ADDRESS,
  value: process.env.PRICE_UNITS || "250000",
}));

for (const step of ["verify", "settle"]) {
  const res = await fetch(`${relayer}/${step}`, { method: "POST", headers, body });
  const out = await res.json();
  console.log(step, res.status, out);
  if (!res.ok) process.exit(1);
}
