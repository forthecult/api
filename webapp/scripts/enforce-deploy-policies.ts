import { readFileSync } from "node:fs";

const workflowFiles = [
  ".github/workflows/seed-staging.yml",
  ".github/workflows/shared-env-migrations.yml",
  ".github/workflows/staging-smoke-post-deploy.yml",
];

for (const file of workflowFiles) {
  const content = readFileSync(file, "utf8");
  if (/\bdb:push\b/.test(content)) {
    console.error(
      `Policy violation: ${file} references db:push. Shared environments must use reviewed migrations.`,
    );
    process.exit(1);
  }
}

console.log("Deploy policy checks passed.");
