import { createAuthClient } from "better-auth/react";
import { getMainAppUrl } from "~/lib/env";

const baseURL = getMainAppUrl();

export const authClient = createAuthClient({
  baseURL,
});

export const { signIn, signOut, useSession } = authClient;
