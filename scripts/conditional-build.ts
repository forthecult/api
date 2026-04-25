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

const forceWebpack =
  process.env.NEXT_BUILD_FORCE_WEBPACK === "1" ||
  process.env.NEXT_BUILD_FORCE_WEBPACK === "true";

const nextBuildArgs = ["x", "next", "build"];
if (forceWebpack) {
  console.log(
    "NEXT_BUILD_FORCE_WEBPACK enabled. Using webpack fallback build path.",
  );
  nextBuildArgs.push("--webpack");
}

const r = spawnSync("bun", nextBuildArgs, {
  stdio: "inherit",
  shell: false,
});
process.exit(r.status ?? 1);
