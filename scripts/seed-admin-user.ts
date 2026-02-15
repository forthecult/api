/**
 * Creates an admin user (email from ADMIN_EMAILS) with email/password so you can log in.
 * Run with the dev server up: bun run scripts/seed-admin-user.ts
 *
 * Uses the first email in ADMIN_EMAILS and ADMIN_SEED_PASSWORD (or a fixed dev password
 * only when running locally with no env set). For staging/production, set ADMIN_SEED_PASSWORD
 * in your local env (never commit it); the script sends it over HTTPS to the app, which
 * hashes it before storing. Change the password in the app after first login.
 * If the user already exists, use "Forgot password?" on the login page.
 */

import "dotenv/config";

const ADMIN_EMAIL =
  (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim().toLowerCase() ||
  "admin@test.com";

const BASE =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_SERVER_APP_URL ||
  "http://localhost:3000";
// For staging/production (non-localhost), require ADMIN_SEED_PASSWORD so the secret isn't in the repo.
const isLocal =
  BASE.startsWith("http://localhost:") || BASE.startsWith("http://127.0.0.1:");
const PASSWORD =
  process.env.ADMIN_SEED_PASSWORD ?? (isLocal ? "Admin123!" : undefined);

async function main() {
  console.log("Seeding admin user:", ADMIN_EMAIL);
  console.log("Auth base URL:", BASE);

  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE,
    },
    body: JSON.stringify({
      name: "Admin",
      email: ADMIN_EMAIL,
      password: DEV_PASSWORD,
    }),
  });

  const text = await res.text();
  let body: { message?: string; code?: string } = {};
  try {
    body = JSON.parse(text) as { message?: string; code?: string };
  } catch {
    // ignore
  }

  if (res.ok) {
    console.log(
      "Admin user created. Log in with that email and the password you set.",
    );
    console.log("  Email:", ADMIN_EMAIL);
    console.log("  Change the password in the app after first login.");
    return;
  }

  if (res.status === 400 || res.status === 409 || res.status === 422) {
    const msg = body.message ?? text;
    if (
      /already exists|already registered|email.*taken|use another email/i.test(
        msg,
      ) ||
      body.code === "USER_ALREADY_EXISTS"
    ) {
      console.log(
        "A user with this email already exists. To log in with email/password:",
      );
      console.log('  1. Go to the login page and click "Forgot password?"');
      console.log("  2. Enter", ADMIN_EMAIL, "and set a new password.");
      console.log("  3. Sign in with that email and the new password.");
      console.log(
        "  Or sign in with Google/GitHub if you originally used that.",
      );
      return;
    }
  }

  if (res.status === 0 || res.status >= 500) {
    console.error(
      "Could not reach the auth API. Is the dev server running? Start it with: bun run dev",
    );
    process.exit(1);
  }

  console.error("Sign-up failed:", res.status, body.message ?? text);
  process.exit(1);
}

main();
