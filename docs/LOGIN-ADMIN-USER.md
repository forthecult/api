# Logging in (including admin)

## Get `admin@test.com` logged in (user already exists)

If `bun run db:seed-admin` says "A user with this email already exists", that account has no password yet. Do this:

1. Open **http://localhost:3000/auth/forgot-password** (or click "Forgot password?" on the login page).
2. Enter **admin@test.com** and submit.
3. In the **terminal where `bun run dev` is running**, find the line:  
   `[sendResetPassword] No RESEND_API_KEY - use this link to reset password: <url>`
4. Open that URL in the browser, set a new password, then go to **http://localhost:3000/login** and sign in with **admin@test.com** and that password.

After sign-in you’ll be redirected to the dashboard; the app uses a full-page redirect so the session is recognized.

## "Invalid email or password" / 401 on sign-in

Email/password sign-in only works if the user has a **credential** account (created by signing up with email + password, or by setting a password via "Forgot password?").

- **User does not exist:** Sign up first at `/signup` with that email and a password, then log in.
- **User exists but was created with Google/GitHub (or wallet):** They have no password yet. Use the steps above (Forgot password → link from server terminal in dev → set password → sign in).

## Seeding an admin user (dev)

`ADMIN_EMAILS` in `.env` (e.g. `admin@test.com`) controls who can access admin routes. To create that user with a known password:

1. Start the dev server: `bun run dev`
2. In another terminal: `bun run db:seed-admin`

This calls the sign-up API and creates the first email in `ADMIN_EMAILS` with password `Admin123!`. If that user already exists, the script tells you to use "Forgot password?" to set a password instead.

Then log in at `/login` (or `/auth/sign-in`) with that email and password.
