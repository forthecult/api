import { createAuthClient } from "better-auth/react";

import { getMainAppUrl } from "~/lib/env";

const baseURL = getMainAppUrl();

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: {
    // Required for cross-origin requests to include cookies
    credentials: "include",
  },
});

export const { signIn, signOut, useSession } = authClient;
