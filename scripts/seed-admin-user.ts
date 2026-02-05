/**
 * Creates an admin user (email from ADMIN_EMAILS) with email/password so you can log in.
 * Run with the dev server up: bun run scripts/seed-admin-user.ts
 *
 * Uses the first email in ADMIN_EMAILS (e.g. admin@test.com) and a fixed dev password.
 * If the user already exists (e.g. from OAuth), sign-up will fail — use "Forgot password?"
 * on the login page to set a password, then log in.
 */

import "dotenv/config";

const ADMIN_EMAIL =
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")[0]
    ?.trim()
    .toLowerCase() || "admin@test.com";

const DEV_PASSWORD = "Admin123!";
const BASE =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_SERVER_APP_URL ||
  "http://localhost:3000";

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
    console.log("Admin user created. You can log in with:");
    console.log("  Email:", ADMIN_EMAIL);
    console.log("  Password:", DEV_PASSWORD);
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
