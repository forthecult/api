import { passkeyClient } from "@better-auth/passkey/client";
import { emailOTPClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// baseURL must match the browser origin for credentialed fetches, or the browser
// blocks CORS when NEXT_PUBLIC_APP_URL points at a different host (e.g. Railway
// URL while users open the custom domain).
function canonicalizeAppBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  const withProto = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, "")}`;
  try {
    const u = new URL(withProto);
    return `${u.protocol}//${u.host}`;
  } catch {
    return withProto.replace(/\/+$/, "");
  }
}

function getBaseUrl(): string {
  const fromEnv =
    typeof process.env.NEXT_PUBLIC_APP_URL === "string" &&
    process.env.NEXT_PUBLIC_APP_URL.length > 0
      ? process.env.NEXT_PUBLIC_APP_URL.trim()
      : "";

  if (typeof window !== "undefined") {
    const pageOrigin = window.location.origin;
    if (!fromEnv) return pageOrigin;
    const envOrigin = canonicalizeAppBaseUrl(fromEnv);
    try {
      const envHost = new URL(envOrigin).hostname;
      const pageHost = window.location.hostname;
      const isLocal =
        pageHost === "localhost" ||
        pageHost === "127.0.0.1" ||
        pageHost.endsWith(".localhost");
      if (!isLocal && envHost !== pageHost) return pageOrigin;
    } catch {
      return pageOrigin;
    }
    return envOrigin;
  }

  if (!fromEnv) return "";
  return canonicalizeAppBaseUrl(fromEnv);
}

const baseURL = getBaseUrl();

export const authClient = createAuthClient({
  baseURL: baseURL || undefined,
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect: () => {
        // Redirect to the two-factor page
        window.location.href = "/auth/two-factor";
      },
    }),
    emailOTPClient(),
    passkeyClient(),
  ],
});

// Auth methods
export const {
  requestPasswordReset,
  resetPassword,
  signIn,
  signOut,
  signUp,
  updateUser,
  useSession,
} = authClient;

/**
 * List all accounts (auth methods) linked to the current user.
 * Returns providers like "credential", "solana", "ethereum", "google", etc.
 */
export const listUserAccounts = async () => {
  try {
    // better-auth client method for listing user accounts
    const response = await authClient.listAccounts();
    return response;
  } catch (error) {
    console.error("Error listing user accounts:", error);
    return { data: [], error: { message: "Failed to list accounts" } };
  }
};

// Two-factor methods
export const twoFactor = authClient.twoFactor;

// Hook to get current user data and loading state
// !! Returns only raw (static) data, use getCurrentUserOrRedirect for data from db
export const useCurrentUser = () => {
  const { data, isPending, refetch } = useSession();
  return {
    isPending,
    refetch,
    session: data?.session,
    user: data?.user,
  };
};

/** Refetch the current session (call after auth state changes externally, e.g., wallet signup) */
export const refetchSession = authClient.getSession;

// Hook similar to getCurrentUserOrRedirect for client-side use
// !! Returns only raw (static) data, use getCurrentUserOrRedirect for data from db
export const useCurrentUserOrRedirect = (
  forbiddenUrl = "/login",
  okUrl = "",
  ignoreForbidden = false,
) => {
  const { data, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    // only perform redirects after loading is complete and router is ready
    if (!isPending && router) {
      // if no user is found
      if (!data?.user) {
        // redirect to forbidden url unless explicitly ignored
        if (!ignoreForbidden) {
          router.push(forbiddenUrl);
        }
        // if ignoreforbidden is true, we do nothing and let the hook return the null user
      } else if (okUrl) {
        // if user is found and an okurl is provided, redirect there
        // Use window.location.href for cross-origin redirects (e.g., http://localhost:3001)
        // router.push only works for same-origin navigation
        if (okUrl.startsWith("http://") || okUrl.startsWith("https://")) {
          window.location.href = okUrl;
        } else {
          router.push(okUrl);
        }
      }
    }
    // depend on loading state, user data, router instance, and redirect urls
  }, [isPending, data?.user, router, forbiddenUrl, okUrl, ignoreForbidden]);

  return {
    isPending,
    session: data?.session,
    user: data?.user,
  };
};

// !! currently not used in the app
/**
 * returns the raw session object from better-auth client.
 * this is a direct wrapper around authclient.getsession and returns the same shape.
 *
 * use this when you require advanced session access patterns, e.g.:
 * - you need to fetch the session manually (e.g., with swr, react query, or custom logic).
 * - you need to access the session data directly without using the usesession hook.
 * - you want more control than the usesession hook provides.
 *
 * @example
 * const { data, error } = await useRawSession();
 */
// export const useRawSession = authClient.getSession;
