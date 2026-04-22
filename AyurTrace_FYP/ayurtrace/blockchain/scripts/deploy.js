const { ethers, artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🌿 Deploying HerbTrace contract...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC\n");

  // Deploy contract
  const HerbTrace = await ethers.getContractFactory("HerbTrace");
  const herbTrace = await HerbTrace.deploy();
  await herbTrace.waitForDeployment();

  const address = await herbTrace.getAddress();

  console.log("✅ HerbTrace deployed to:", address);

  console.log("\n📋 Add these to your .env files:");
  console.log(`CONTRACT_ADDRESS=${address}`);
  console.log(`VITE_CONTRACT_ADDRESS=${address}`);

  console.log("\n🔗 View on Polygonscan (Amoy):");
  console.log(`https://amoy.polygonscan.com/address/${address}`);

  // ✅ Get artifact safely using Hardhat
  const artifact = await artifacts.readArtifact("HerbTrace");

  // Save ABI to a clean location
  const abiPath = path.join(__dirname, "..", "artifacts", "HerbTrace.abi.json");
  fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));

  console.log(`\n📄 ABI saved to: ${abiPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deploy failed:", error);
    process.exit(1);
  });