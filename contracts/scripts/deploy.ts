import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    (await ethers.provider.getBalance(deployer.address)).toString(),
  );
  console.log(
    "Network:",
    network.name,
    "(chainId:",
    network.config.chainId,
    ")",
  );

  // Get treasury address from env or use deployer
  const treasuryAddress =
    process.env.PAYMENT_TREASURY_ADDRESS || deployer.address;
  console.log("Treasury address:", treasuryAddress);

  // Deploy PaymentReceiverFactory
  console.log("\nDeploying PaymentReceiverFactory...");
  const PaymentReceiverFactory = await ethers.getContractFactory(
    "PaymentReceiverFactory",
  );
  const factory = await PaymentReceiverFactory.deploy(treasuryAddress);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  const implementationAddress = await factory.implementation();

  console.log("PaymentReceiverFactory deployed to:", factoryAddress);
  console.log("PaymentReceiver implementation:", implementationAddress);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    factory: factoryAddress,
    implementation: implementationAddress,
    treasury: treasuryAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentPath = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to:", deploymentPath);

  // Also update the main deployments index
  const indexPath = path.join(deploymentsDir, "index.json");
  let index: Record<string, typeof deploymentInfo> = {};
  if (fs.existsSync(indexPath)) {
    index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  }
  index[network.name] = deploymentInfo;
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  console.log("\n--- Verification Command ---");
  console.log(
    `npx hardhat verify --network ${network.name} ${factoryAddress} ${treasuryAddress}`,
  );

  return deploymentInfo;
}

main()
  .then((result) => {
    console.log("\nDeployment complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
