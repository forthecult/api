/**
 * When SKIP_NEXT_BUILD is set (e.g. buyback cron service), skip next build and exit 0.
 * Otherwise run the real Next.js build.
 * Lets the same repo deploy both the main app (full build) and cron-only services (deps only).
 */
import { spawnSync } from "node:child_process";

if (
  process.env.SKIP_NEXT_BUILD === "true" ||
  process.env.SKIP_NEXT_BUILD === "1"
) {
  console.log(
    "Skipping Next.js build (SKIP_NEXT_BUILD set). Deploy is deps-only (e.g. buyback cron).",
  );
  process.exit(0);
}

const r = spawnSync("bun", ["x", "next", "build", "--webpack"], {
  stdio: "inherit",
  shell: false,
});
process.exit(r.status ?? 1);
