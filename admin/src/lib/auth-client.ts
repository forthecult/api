import { createAuthClient } from "better-auth/react";

import { getAuthClientBaseUrl } from "~/lib/env";

export const authClient = createAuthClient({
  baseURL: getAuthClientBaseUrl(),
  fetchOptions: {
    credentials: "include",
  },
});

export const { signIn, signOut, useSession } = authClient;
