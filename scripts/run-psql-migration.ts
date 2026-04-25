/**
 * Controlled SQL migration runner for shared environments.
 *
 * Features:
 * - Loads .env + .env.local
 * - Fail-fast (`ON_ERROR_STOP=1`)
 * - Single transaction across one or more files (`-1`)
 * - Optional advisory lock to prevent concurrent migration runs
 * - Explicit shared-env confirmation (`--env=staging|production --yes`)
 */
import { config } from "dotenv";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
config({ path: join(root, ".env") });
config({ path: join(root, ".env.local"), override: true });

const args = process.argv.slice(2);
const sqlFiles: string[] = [];
let targetEnv: null | string = null;
let confirmed = false;
let dryRun = false;
let advisoryLockKey = "724011";

for (const arg of args) {
  if (arg.startsWith("--env=")) {
    targetEnv = arg.slice("--env=".length).trim().toLowerCase();
  } else if (arg === "--yes") {
    confirmed = true;
  } else if (arg === "--dry-run") {
    dryRun = true;
  } else if (arg.startsWith("--lock-key=")) {
    advisoryLockKey = arg.slice("--lock-key=".length).trim();
  } else if (!arg.startsWith("--")) {
    sqlFiles.push(arg);
  }
}

if (sqlFiles.length === 0) {
  console.error(
    "Usage: bun run scripts/run-psql-migration.ts <relative-sql-path...> [--env=staging|production|local] [--yes] [--dry-run] [--lock-key=724011]",
  );
  process.exit(1);
}

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is not set (.env / .env.local).");
  process.exit(1);
}

const sharedEnvs = new Set(["staging", "production"]);
if (targetEnv != null && sharedEnvs.has(targetEnv) && !confirmed) {
  console.error(
    `Refusing to run against shared environment '${targetEnv}' without --yes.`,
  );
  process.exit(1);
}

const sqlPaths = sqlFiles.map((file) => join(root, file));
const commandPreview = [
  "psql",
  "<DATABASE_URL>",
  "-v",
  "ON_ERROR_STOP=1",
  "-1",
  ...sqlPaths.flatMap((p) => ["-f", p]),
].join(" ");

console.log(`Target env: ${targetEnv ?? "unspecified"}`);
console.log(`Migrations: ${sqlFiles.join(", ")}`);
console.log(`Plan: ${commandPreview}`);

if (dryRun) {
  console.log("Dry run complete. No SQL executed.");
  process.exit(0);
}

// Prevent concurrent migration runs in shared envs.
execFileSync(
  "psql",
  [url, "-v", "ON_ERROR_STOP=1", "-c", `SELECT pg_advisory_lock(${advisoryLockKey});`],
  { stdio: "inherit" },
);

try {
  execFileSync(
    "psql",
    [
      url,
      "-v",
      "ON_ERROR_STOP=1",
      "-1",
      ...sqlPaths.flatMap((path) => ["-f", path]),
    ],
    { stdio: "inherit" },
  );
  console.log("Migration run completed successfully.");
} finally {
  execFileSync(
    "psql",
    [url, "-v", "ON_ERROR_STOP=1", "-c", `SELECT pg_advisory_unlock(${advisoryLockKey});`],
    { stdio: "inherit" },
  );
}
