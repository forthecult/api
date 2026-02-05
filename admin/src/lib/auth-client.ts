import { createAuthClient } from "better-auth/react";

const baseURL =
  typeof process.env.NEXT_PUBLIC_MAIN_APP_URL === "string"
    ? process.env.NEXT_PUBLIC_MAIN_APP_URL
    : "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL,
});

export const { signIn, signOut, useSession } = authClient;
