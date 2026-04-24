/**
 * CI guard: every state-changing Next.js route handler under src/app/api must
 * either verify the CSRF origin or opt into a documented bypass.
 *
 * A route is considered covered if any of the following apply:
 *   - It imports verifyCsrfOrigin() from ~/lib/csrf.
 *   - It imports getAdminAuth (admin-api-auth routes verify origin as part of
 *     the admin auth flow for sessions and use constant-time API-key checks
 *     for bots).
 *   - It lives under src/app/api/webhooks/ or handles a provider callback and
 *     verifies an HMAC signature (Stripe, PayPal, Resend, Printify, BTCPay,
 *     Telegram, Slack, Discord).
 *   - It lives under src/app/api/auth/ (Better Auth handles CSRF internally
 *     via signed state + same-site cookies).
 *   - It is explicitly allow-listed in scripts/csrf-allowlist.txt with a
 *     one-line justification.
 *
 * SOC 2: CC6.1 (logical access controls — CSRF is the browser-side leg of the
 * session-auth threat model).
 *
 * Usage:
 *   bun run scripts/verify-csrf-origin.ts
 *
 * CI wiring: called from .github/workflows/ci.yml; exits non-zero on gap.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const WEBAPP_ROOT = join(import.meta.dir, "..");
const API_ROOT = join(WEBAPP_ROOT, "src/app/api");
const ALLOWLIST_PATH = join(import.meta.dir, "csrf-allowlist.txt");

const MUTATION_EXPORT_RE =
  /export\s+(?:async\s+)?(?:function|const)\s+(POST|PUT|PATCH|DELETE)\b/;

const COVERAGE_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "verifyCsrfOrigin", re: /verifyCsrfOrigin\s*\(/ },
  { label: "getAdminAuth", re: /getAdminAuth\s*\(/ },
  { label: "stripe signature", re: /stripe.*webhooks\.constructEvent/is },
  { label: "paypal signature", re: /verifyPaypalWebhookSignature/ },
  { label: "printify signature", re: /constantTimeStringEqual/ },
  { label: "resend signature", re: /resendWebhookSecret|svix\.verify/i },
  { label: "btcpay signature", re: /verifyBtcPaySignature/ },
  { label: "telegram secret", re: /TELEGRAM_WEBHOOK_SECRET/ },
  { label: "slack signature", re: /verifySlackSignature/ },
  { label: "discord signature", re: /discordSignature|ed25519/i },
  { label: "uploadthing", re: /createUploadthing|createRouteHandler/i },
  { label: "next-auth/better-auth internal", re: /auth\.handler|toNextJsHandler/ },
];

const PROVIDER_BYPASS_DIRS = [
  "src/app/api/webhooks",
  "src/app/api/auth",
  "src/app/api/membership/paypal-webhook",
  "src/app/api/payments/stripe/webhook",
];

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (e.isFile() && e.name === "route.ts") {
      out.push(full);
    }
  }
  return out;
}

async function loadAllowlist(): Promise<Set<string>> {
  try {
    const raw = await readFile(ALLOWLIST_PATH, "utf8");
    return new Set(
      raw
        .split("\n")
        .map((line) => line.replace(/#.*/, "").trim())
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

function isProviderBypass(relPath: string): boolean {
  return PROVIDER_BYPASS_DIRS.some((d) =>
    relPath.startsWith(d.replace(/\\/g, "/")),
  );
}

function coverageHit(source: string): null | string {
  for (const { label, re } of COVERAGE_PATTERNS) {
    if (re.test(source)) return label;
  }
  return null;
}

async function main(): Promise<void> {
  const files = await walk(API_ROOT);
  const allowlist = await loadAllowlist();

  const gaps: Array<{ file: string; mutations: string[] }> = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const rel = relative(WEBAPP_ROOT, file).split("\\").join("/");

    const mutations = new Set<string>();
    for (const line of source.split("\n")) {
      const m = line.match(MUTATION_EXPORT_RE);
      if (m) mutations.add(m[1]);
    }

    if (mutations.size === 0) continue;
    if (isProviderBypass(rel)) continue;
    if (allowlist.has(rel)) continue;
    if (coverageHit(source)) continue;

    gaps.push({ file: rel, mutations: [...mutations].sort() });
  }

  if (gaps.length === 0) {
    console.log(
      `[verify-csrf-origin] OK — checked ${files.length} route.ts files, no CSRF gaps.`,
    );
    return;
  }

  console.error(
    `[verify-csrf-origin] FAIL — ${gaps.length} route(s) with state-changing handlers missing CSRF coverage:`,
  );
  for (const gap of gaps) {
    console.error(`  ${gap.file} — exports ${gap.mutations.join(", ")}`);
  }
  console.error(
    "\nFix options (pick one):",
    "\n  1. Call verifyCsrfOrigin(request.headers) before the handler's work.",
    "\n  2. Gate with getAdminAuth (for admin-only routes).",
    "\n  3. If it's a webhook, verify the provider signature (and ensure the",
    "\n     route lives under src/app/api/webhooks/).",
    "\n  4. As a last resort, add the path to scripts/csrf-allowlist.txt with",
    "\n     a one-line justification.",
  );
  process.exit(1);
}

await main();
