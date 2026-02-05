/**
 * Export ABIs from compiled contracts to the main app's src/lib folder
 */

const fs = require("fs");
const path = require("path");

const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts");
const OUTPUT_DIR = path.join(__dirname, "..", "..", "src", "lib", "contracts");

const CONTRACTS_TO_EXPORT = ["PaymentReceiverFactory", "PaymentReceiver"];

function main() {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const abis = {};

  for (const contractName of CONTRACTS_TO_EXPORT) {
    const artifactPath = path.join(
      ARTIFACTS_DIR,
      `${contractName}.sol`,
      `${contractName}.json`,
    );

    if (!fs.existsSync(artifactPath)) {
      console.error(`Artifact not found: ${artifactPath}`);
      console.error("Run 'bun run compile' first");
      process.exit(1);
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    abis[contractName] = artifact.abi;

    // Also save individual ABI file
    const abiPath = path.join(OUTPUT_DIR, `${contractName}.abi.json`);
    fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
    console.log(`Exported: ${abiPath}`);
  }

  // Create a combined TypeScript module with all ABIs
  const tsContent = `// Auto-generated - do not edit manually
// Run 'cd contracts && bun run export-abi' to regenerate

export const PaymentReceiverFactoryABI = ${JSON.stringify(abis.PaymentReceiverFactory, null, 2)} as const;

export const PaymentReceiverABI = ${JSON.stringify(abis.PaymentReceiver, null, 2)} as const;
`;

  const tsPath = path.join(OUTPUT_DIR, "abis.ts");
  fs.writeFileSync(tsPath, tsContent);
  console.log(`Exported: ${tsPath}`);

  // Load and export deployments
  const deploymentsPath = path.join(
    __dirname,
    "..",
    "deployments",
    "index.json",
  );
  if (fs.existsSync(deploymentsPath)) {
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

    const deploymentsTs = `// Auto-generated - do not edit manually
// Run deployment scripts to update

export const FACTORY_DEPLOYMENTS: Record<number, { factory: string; implementation: string }> = ${JSON.stringify(
      Object.fromEntries(
        Object.entries(deployments).map(([network, info]) => [
          info.chainId,
          { factory: info.factory, implementation: info.implementation },
        ]),
      ),
      null,
      2,
    )};
`;

    const deploymentsTsPath = path.join(OUTPUT_DIR, "deployments.ts");
    fs.writeFileSync(deploymentsTsPath, deploymentsTs);
    console.log(`Exported: ${deploymentsTsPath}`);
  }

  console.log("\nABI export complete!");
}

main();
