/**
 * Load .env + .env.local and run `psql $DATABASE_URL -f <file>`.
 * Used when package.json `psql $URL` does not receive dotenv from `bun run`.
 */
import { config } from "dotenv";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
config({ path: join(root, ".env") });
config({ path: join(root, ".env.local"), override: true });

const file = process.argv[2];
if (!file) {
  console.error("Usage: bun run scripts/run-psql-migration.ts <relative-sql-path>");
  process.exit(1);
}
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is not set (.env / .env.local).");
  process.exit(1);
}
const sqlPath = join(root, file);
console.log(`psql -f ${file} …`);
execFileSync("psql", [url, "-f", sqlPath], { stdio: "inherit" });
console.log("OK:", file);
