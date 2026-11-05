import hre from "hardhat";
import "dotenv/config";

async function main() {
  const usdt = process.env.USDT_ADDRESS;
  if (!usdt) throw new Error("Set USDT_ADDRESS in .env");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`WBT balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))}`);

  const qm = await hre.ethers.deployContract("QuestManager", [usdt]);
  await qm.waitForDeployment();
  const address = await qm.getAddress();
  console.log(`QuestManager: ${address}`);
  console.log(`Explorer: https://explorer.testnet.whitechain.io/address/${address}`);

  await new Promise((r) => setTimeout(r, 15_000)); // let Blockscout index the deploy tx
  try {
    await hre.run("verify:verify", { address, constructorArguments: [usdt] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.toLowerCase().includes("already verified")) {
      console.error(`Verify failed, retry: QUEST_MANAGER_ADDRESS=${address} npm run verify\n${msg}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
