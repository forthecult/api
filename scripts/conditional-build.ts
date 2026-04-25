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

function runNextBuild(args: string[]) {
  const result = spawnSync("bun", args, {
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return result;
}

if (forceWebpack) {
  console.log(
    "NEXT_BUILD_FORCE_WEBPACK enabled. Using webpack fallback build path.",
  );
  const forcedWebpackResult = runNextBuild(["x", "next", "build", "--webpack"]);
  process.exit(forcedWebpackResult.status ?? 1);
}

const defaultBuildResult = runNextBuild(["x", "next", "build"]);
if (defaultBuildResult.status === 0) {
  process.exit(0);
}

const buildOutput = `${defaultBuildResult.stdout ?? ""}\n${defaultBuildResult.stderr ?? ""}`;
const isTurboWebpackMismatch =
  buildOutput.includes("using Turbopack, with a `webpack` config") ||
  buildOutput.includes("using Turbopack, with a webpack config");
const isGeneralTurbopackBuildFailure =
  buildOutput.includes("Turbopack build failed") ||
  buildOutput.includes("Build error occurred");

if (!isTurboWebpackMismatch && !isGeneralTurbopackBuildFailure) {
  process.exit(defaultBuildResult.status ?? 1);
}

console.warn(
  "Detected Turbopack build incompatibility. Retrying build with --webpack.",
);
const webpackFallbackResult = runNextBuild(["x", "next", "build", "--webpack"]);
process.exit(webpackFallbackResult.status ?? defaultBuildResult.status ?? 1);
