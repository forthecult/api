// note: run `bun db:auth` to generate the `users.ts`
// schema after making breaking changes to this file

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { UserDbType } from "~/lib/auth-types";

import { SYSTEM_CONFIG } from "~/app";
import { ethereumAuthPlugin } from "~/lib/auth-ethereum-plugin";
import { solanaAuthPlugin } from "~/lib/auth-solana-plugin";
import { telegramAuthPlugin } from "~/lib/auth-telegram-plugin";
import { db } from "~/db";
import { sendResetPasswordEmail } from "~/lib/send-reset-password";
import {
  createUserNotification,
  userWantsTransactionalWebsite,
} from "~/lib/create-user-notification";
import { getNotificationTemplate } from "~/lib/notification-templates";
import { sendWelcomeEmail } from "~/lib/send-welcome-email";
import {
  accountTable,
  sessionTable,
  twoFactorTable,
  userTable,
  verificationTable,
} from "~/db/schema";

/** Ensure URL has a protocol so Better Auth and redirects don't throw Invalid URL (e.g. Railway env without https://). */
function ensureAbsoluteUrl(value: string | undefined): string | undefined {
  if (!value || typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

interface GitHubProfile {
  [key: string]: unknown;
  email?: string;
  name?: string;
}

interface GoogleProfile {
  [key: string]: unknown;
  email?: string;
  family_name?: string;
  given_name?: string;
}

interface SocialProviderConfig {
  [key: string]: unknown;
  clientId: string;
  clientSecret: string;
  mapProfileToUser: (
    profile: GitHubProfile | GoogleProfile,
  ) => Record<string, unknown>;
  redirectURI?: string;
  scope: string[];
}

const hasGithubCredentials =
  process.env.AUTH_GITHUB_ID &&
  process.env.AUTH_GITHUB_SECRET &&
  process.env.AUTH_GITHUB_ID.length > 0 &&
  process.env.AUTH_GITHUB_SECRET.length > 0;

const hasGoogleCredentials =
  process.env.AUTH_GOOGLE_ID &&
  process.env.AUTH_GOOGLE_SECRET &&
  process.env.AUTH_GOOGLE_ID.length > 0 &&
  process.env.AUTH_GOOGLE_SECRET.length > 0;

// Build social providers configuration
const socialProviders: Record<string, SocialProviderConfig> = {};

if (hasGithubCredentials) {
  socialProviders.github = {
    clientId: process.env.AUTH_GITHUB_ID ?? "",
    clientSecret: process.env.AUTH_GITHUB_SECRET ?? "",
    mapProfileToUser: (profile: GitHubProfile) => {
      let firstName = "";
      let lastName = "";
      if (profile.name) {
        const nameParts = profile.name.split(" ");
        firstName = nameParts[0];
        lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
      }
      return {
        age: null,
        firstName,
        lastName,
      };
    },
    scope: ["user:email", "read:user"],
  };
}

if (hasGoogleCredentials) {
  socialProviders.google = {
    clientId: process.env.AUTH_GOOGLE_ID ?? "",
    clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
    mapProfileToUser: (profile: GoogleProfile) => {
      return {
        age: null,
        firstName: profile.given_name ?? "",
        lastName: profile.family_name ?? "",
      };
    },
    scope: ["openid", "email", "profile"],
  };
}

export const auth = betterAuth({
  account: {
    accountLinking: {
      allowDifferentEmails: false,
      enabled: true,
      trustedProviders: ["solana", "ethereum", ...Object.keys(socialProviders)],
    },
  },
  // Links in emails (e.g. password reset) must use the public URL users can open, not the internal server URL.
  // Prefer NEXT_PUBLIC_APP_URL so Railway (NEXT_SERVER_APP_URL=http://localhost:PORT) still gets correct links.
  baseURL: (() => {
    if (process.env.NODE_ENV === "development")
      return "http://localhost:3000";
    const publicUrl = ensureAbsoluteUrl(process.env.NEXT_PUBLIC_APP_URL);
    if (publicUrl) return publicUrl;
    if (typeof process.env.VERCEL_URL === "string" && process.env.VERCEL_URL)
      return `https://${process.env.VERCEL_URL}`;
    const server = ensureAbsoluteUrl(process.env.NEXT_SERVER_APP_URL);
    return server ?? undefined;
  })(),

  // Trusted origins for CORS/auth - use explicit allowlist for security (never throw)
  trustedOrigins: () => {
    try {
      const origins: string[] = [];

      if (process.env.NODE_ENV === "development") {
        origins.push(
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "http://localhost:3001",
          "http://127.0.0.1:3001",
        );
      }

      const appUrl = ensureAbsoluteUrl(process.env.NEXT_PUBLIC_APP_URL) ?? "";
      const adminUrl =
        ensureAbsoluteUrl(process.env.NEXT_PUBLIC_ADMIN_APP_URL) ?? "";
      const serverUrl = ensureAbsoluteUrl(process.env.NEXT_SERVER_APP_URL) ?? "";
      if (appUrl) origins.push(appUrl);
      if (adminUrl) origins.push(adminUrl);
      if (serverUrl && serverUrl !== appUrl) origins.push(serverUrl);

      if (
        typeof process.env.VERCEL_URL === "string" &&
        process.env.VERCEL_URL.length > 0
      ) {
        origins.push(`https://${process.env.VERCEL_URL}`);
      }

      return origins.filter(Boolean);
    } catch (e) {
      console.error("[auth] trustedOrigins error:", e);
      return process.env.NODE_ENV === "development"
        ? [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
          ]
        : [];
    }
  },

  // Email/password sign-in needs credential account; enable when db.query rels work, else get 401
  experimental: {
    joins: true,
  },

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      account: accountTable,
      session: sessionTable,
      twoFactor: twoFactorTable,
      user: userTable,
      verification: verificationTable,
    },
  }),

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes; reduces DB lookups on getSession
    },
  },

  // Cross-subdomain cookie sharing for admin app on different subdomain
  // In production, both apps should be on same parent domain (e.g., forthecult.store and admin.forthecult.store)
  // For Railway staging with different subdomains, we need sameSite: "none" with secure: true
  advanced: {
    crossSubDomainCookies: {
      enabled: !!process.env.NEXT_PUBLIC_ADMIN_APP_URL,
      // For same parent domain (e.g., .forthecult.store), set domain here
      // For Railway staging with different domains, this won't help - use sameSite: "none" instead
      domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    },
    defaultCookieAttributes: {
      // For cross-origin admin app, we need sameSite: "none" (requires secure: true / HTTPS)
      // Only enable this when admin app is on a different origin
      ...(process.env.NEXT_PUBLIC_ADMIN_APP_URL &&
        !process.env.NEXT_PUBLIC_ADMIN_APP_URL.includes("localhost") && {
          sameSite: "none" as const,
          secure: true,
        }),
    },
  },

  emailAndPassword: {
    enabled: true,
    // Auto sign-in after signup so user doesn't have to enter credentials twice
    autoSignIn: true,
    sendResetPassword: async ({ user, url }, _request) => {
      void sendResetPasswordEmail({ to: user.email, url, user });
    },
  },

  // Local: no email verification. Staging/prod: add emailVerification (e.g. Resend) when you need it.
  ...(process.env.NODE_ENV === "development" && {
    emailVerification: {
      sendOnSignUp: false,
      sendVerificationEmail: async () => {
        /* no-op for local; configure Resend/sendVerificationEmail for staging/prod */
      },
    },
  }),

  // Configure OAuth behavior
  oauth: {
    // Default redirect URL after successful login
    defaultCallbackUrl: SYSTEM_CONFIG.redirectAfterSignIn,
    // URL to redirect to on error
    errorCallbackUrl: "/auth/error",
    // Whether to link accounts with the same email
    linkAccountsByEmail: true,
  },

  plugins: [
    twoFactor(),
    solanaAuthPlugin(),
    ethereumAuthPlugin(),
    telegramAuthPlugin(),
  ],

  // AUTH_SECRET is required in production for security
  secret: (() => {
    if (process.env.AUTH_SECRET) {
      return process.env.AUTH_SECRET;
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET environment variable is required in production",
      );
    }
    // Development fallback - never use in production
    return "dev-secret-min-32-chars-for-better-auth-local";
  })(),

  // Only include social providers if credentials are available
  socialProviders,

  user: {
    // Identity/profile fields used by auth (sign-up, OAuth, session).
    // Notification preference fields are also included so Better Auth adapter knows about them.
    additionalFields: {
      age: {
        input: true,
        required: false,
        type: "number",
      },
      firstName: {
        input: true,
        required: false,
        type: "string",
      },
      lastName: {
        input: true,
        required: false,
        type: "string",
      },
      phone: {
        input: true,
        required: false,
        type: "string",
      },
      // Notification preferences - transactional (per channel)
      transactionalEmail: {
        input: false,
        required: false,
        type: "boolean",
        defaultValue: true,
      },
      transactionalWebsite: {
        input: false,
        required: false,
        type: "boolean",
        defaultValue: true,
      },
      transactionalSms: {
        input: false,
        required: false,
        type: "boolean",
        defaultValue: false,
      },
      transactionalTelegram: {
        input: false,
        required: false,
        type: "boolean",
        defaultValue: false,
      },
      transactionalAiCompanion: {
        input: false,
        required: false,
        type: "boolean",
        defaultValue: false,
      },
      // Notification preferences - marketing (per channel)
      marketingEmail: {
        input: false,
        required: false,
        type: "boolean",
        defaultValue: true,
      },
      marketingWebsite: {
        input: false,
        required: false,
        type: "boolean",
        defaultValue: false,
      },
      marketingSms: {
        input: false,
        required: false,
        type: "boolean",
        defaultValue: false,
      },
      marketingTelegram: {
        input: false,
        required: false,
        type: "boolean",
        defaultValue: false,
      },
      marketingAiCompanion: {
        input: false,
        required: false,
        type: "boolean",
        defaultValue: false,
      },
      // Legacy fields
      receiveMarketing: {
        input: false,
        required: false,
        type: "boolean",
        defaultValue: false,
      },
      receiveSmsMarketing: {
        input: false,
        required: false,
        type: "boolean",
        defaultValue: false,
      },
      receiveOrderNotificationsViaTelegram: {
        input: false,
        required: false,
        type: "boolean",
        defaultValue: false,
      },
    },
  },

  // Hooks for lifecycle events
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Ensure notification preference defaults are set for all user creation paths
          // (email signup, OAuth, wallet auth, etc.)
          return {
            data: {
              ...user,
              // Only set defaults if not already provided
              transactionalEmail: user.transactionalEmail ?? true,
              transactionalWebsite: user.transactionalWebsite ?? true,
              transactionalSms: user.transactionalSms ?? false,
              transactionalTelegram: user.transactionalTelegram ?? false,
              transactionalAiCompanion: user.transactionalAiCompanion ?? false,
              marketingEmail: user.marketingEmail ?? true,
              marketingWebsite: user.marketingWebsite ?? false,
              marketingSms: user.marketingSms ?? false,
              marketingTelegram: user.marketingTelegram ?? false,
              marketingAiCompanion: user.marketingAiCompanion ?? false,
              receiveMarketing: user.receiveMarketing ?? false,
              receiveSmsMarketing: user.receiveSmsMarketing ?? false,
              receiveOrderNotificationsViaTelegram: user.receiveOrderNotificationsViaTelegram ?? false,
            },
          };
        },
        after: async (user) => {
          // Send welcome email after user is created (only if they have a real email)
          void sendWelcomeEmail({
            to: user.email,
            user: { name: user.name, email: user.email, id: user.id },
          });
          // In-app welcome notification for first-time signup (when transactional website is enabled)
          if (await userWantsTransactionalWebsite(user.id)) {
            const template = getNotificationTemplate("welcome_email");
            void createUserNotification({
              userId: user.id,
              type: "welcome_email",
              title: template.title,
              description: template.body,
            });
          }
        },
      },
    },
  },
});

export const getCurrentUser = async (): Promise<null | UserDbType> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return null;
  }
  return session.user as UserDbType;
};

export const getCurrentUserOrRedirect = async (
  forbiddenUrl = "/login",
  okUrl = "",
  ignoreForbidden = false,
): Promise<null | UserDbType> => {
  const user = await getCurrentUser();

  // if no user is found
  if (!user) {
    // redirect to forbidden url unless explicitly ignored
    if (!ignoreForbidden) {
      redirect(forbiddenUrl);
    }
    // if ignoring forbidden, return the null user immediately
    // (don't proceed to okUrl check)
    return user; // user is null here
  }

  // if user is found and an okUrl is provided, redirect there
  if (okUrl) {
    redirect(okUrl);
  }

  // if user is found and no okUrl is provided, return the user
  return user; // user is UserDbType here
};

// Server-only: use ADMIN_EMAILS env var (not NEXT_PUBLIC_* to avoid exposing admin emails to client)
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

/** admin check only affects access to /admin routes after login; it does not block sign-in. */
export function isAdminUser(user: { email?: string } | null): boolean {
  if (!user?.email) return false;
  return ADMIN_EMAILS.has(user.email.trim().toLowerCase());
}
