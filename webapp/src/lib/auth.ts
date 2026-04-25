// note: run `bun db:auth` to generate the `users.ts`
// schema after making breaking changes to this file

import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, twoFactor } from "better-auth/plugins";
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { UserDbType } from "~/lib/auth-types";

import { SEO_CONFIG, SYSTEM_CONFIG } from "~/app";
import { db } from "~/db";
import {
  accountTable,
  passkeyTable,
  sessionTable,
  twoFactorTable,
  verificationTable,
} from "~/db/schema";
import { getPublicSiteUrl } from "~/lib/app-url";
import { ethereumAuthPlugin } from "~/lib/auth-ethereum-plugin";
import { solanaAuthPlugin } from "~/lib/auth-solana-plugin";
import { telegramAuthPlugin } from "~/lib/auth-telegram-plugin";
import {
  getDevelopmentAuthOrigins,
  getProductionAuthOrigins,
} from "~/lib/auth-trusted-origins";
import { getNotificationTemplate } from "~/lib/notification-templates";

interface DiscordProfile {
  [key: string]: unknown;
  email?: string;
  global_name?: string;
  username?: string;
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
    profile: DiscordProfile | GitHubProfile | GoogleProfile | TwitterProfile,
  ) => Record<string, unknown>;
  redirectURI?: string;
  scope: string[];
}

interface TwitterProfile {
  [key: string]: unknown;
  email?: string;
  name?: string;
  username?: string;
}

/**
 * Keep auth session queries resilient across environments with schema drift.
 * Better Auth selects all columns declared on the mapped user table; production
 * currently has older user columns, so we map only the stable core columns here.
 */
const authUserTable = pgTable("user", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  id: text("id").primaryKey(),
  image: text("image"),
  name: text("name").notNull(),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/** Ensure URL has a protocol so Better Auth and redirects don't throw Invalid URL (e.g. Railway env without https://). */
function ensureAbsoluteUrl(value: string | undefined): string | undefined {
  if (!value || typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
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

const hasDiscordCredentials =
  process.env.AUTH_DISCORD_ID &&
  process.env.AUTH_DISCORD_SECRET &&
  process.env.AUTH_DISCORD_ID.length > 0 &&
  process.env.AUTH_DISCORD_SECRET.length > 0;

const hasTwitterCredentials =
  process.env.AUTH_TWITTER_ID &&
  process.env.AUTH_TWITTER_SECRET &&
  process.env.AUTH_TWITTER_ID.length > 0 &&
  process.env.AUTH_TWITTER_SECRET.length > 0;

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

if (hasDiscordCredentials) {
  socialProviders.discord = {
    clientId: process.env.AUTH_DISCORD_ID ?? "",
    clientSecret: process.env.AUTH_DISCORD_SECRET ?? "",
    mapProfileToUser: (profile: DiscordProfile) => ({
      age: null,
      firstName: profile.global_name ?? profile.username ?? "",
      lastName: "",
    }),
    scope: ["identify", "email"],
  };
}

if (hasTwitterCredentials) {
  socialProviders.twitter = {
    clientId: process.env.AUTH_TWITTER_ID ?? "",
    clientSecret: process.env.AUTH_TWITTER_SECRET ?? "",
    mapProfileToUser: (profile: TwitterProfile) => {
      let firstName = "";
      let lastName = "";
      if (profile.name) {
        const nameParts = profile.name.split(" ");
        firstName = nameParts[0];
        lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
      } else if (profile.username) {
        firstName = profile.username;
      }
      return {
        age: null,
        firstName,
        lastName,
      };
    },
    scope: ["users.read", "tweet.read"],
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
  // default: host-only session cookies on the storefront origin so admin never shares a cookie
  // with the public site. opt in only if you intentionally use cross-origin admin API calls
  // without same-origin rewrites (see admin/README.md).
  advanced: {
    crossSubDomainCookies: {
      domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
      enabled:
        process.env.AUTH_SHARE_SESSION_COOKIE_WITH_ADMIN === "true" &&
        Boolean(process.env.NEXT_PUBLIC_ADMIN_APP_URL?.trim()),
    },
    defaultCookieAttributes: {
      ...(process.env.AUTH_SHARE_SESSION_COOKIE_WITH_ADMIN === "true" &&
        process.env.NEXT_PUBLIC_ADMIN_APP_URL &&
        !process.env.NEXT_PUBLIC_ADMIN_APP_URL.includes("localhost") && {
          sameSite: "none" as const,
          secure: true,
        }),
    },
  },

  // Links in emails (e.g. password reset) must use the public URL users can open, not the internal server URL.
  // Prefer NEXT_PUBLIC_APP_URL so Railway (NEXT_SERVER_APP_URL=http://localhost:PORT) still gets correct links.
  baseURL: (() => {
    if (process.env.NODE_ENV === "development") return "http://localhost:3000";
    const publicUrl = ensureAbsoluteUrl(process.env.NEXT_PUBLIC_APP_URL);
    if (publicUrl) return publicUrl.replace(/\/$/, "");
    if (typeof process.env.VERCEL_URL === "string" && process.env.VERCEL_URL)
      return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
    const server = ensureAbsoluteUrl(process.env.NEXT_SERVER_APP_URL);
    if (server) return server.replace(/\/$/, "");
    // Railway etc.: avoid using internal bind URL as Better Auth base when public env is unset
    return getPublicSiteUrl().replace(/\/$/, "");
  })(),

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      account: accountTable,
      passkey: passkeyTable,
      session: sessionTable,
      twoFactor: twoFactorTable,
      user: authUserTable,
      verification: verificationTable,
    },
  }),

  // Hooks for lifecycle events
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const { sendWelcomeEmail } = await import("~/lib/send-welcome-email");
          void sendWelcomeEmail({
            to: user.email,
            user: { email: user.email, id: user.id, name: user.name },
          });
          const { createUserNotification, userWantsTransactionalWebsite } =
            await import("~/lib/create-user-notification");
          if (await userWantsTransactionalWebsite(user.id)) {
            const template = getNotificationTemplate("welcome_email");
            void createUserNotification({
              description: template.body,
              title: template.title,
              type: "welcome_email",
              userId: user.id,
            });
          }
        },
        before: async (user) => {
          // Ensure notification preference defaults are set for all user creation paths
          // (email signup, OAuth, wallet auth, etc.)
          return {
            data: {
              ...user,
              marketingAiCompanion: user.marketingAiCompanion ?? false,
              marketingDiscord: user.marketingDiscord ?? false,
              marketingEmail: user.marketingEmail ?? true,
              marketingSms: user.marketingSms ?? false,
              marketingTelegram: user.marketingTelegram ?? false,
              marketingWebsite: user.marketingWebsite ?? false,
              receiveMarketing: user.receiveMarketing ?? false,
              receiveOrderNotificationsViaTelegram:
                user.receiveOrderNotificationsViaTelegram ?? false,
              receiveSmsMarketing: user.receiveSmsMarketing ?? false,
              transactionalAiCompanion: user.transactionalAiCompanion ?? false,
              transactionalDiscord: user.transactionalDiscord ?? false,
              // Only set defaults if not already provided
              transactionalEmail: user.transactionalEmail ?? true,
              transactionalSms: user.transactionalSms ?? false,
              transactionalTelegram: user.transactionalTelegram ?? false,
              transactionalWebsite: user.transactionalWebsite ?? true,
            },
          };
        },
      },
    },
  },

  emailAndPassword: {
    // Auto sign-in after signup so user doesn't have to enter credentials twice
    autoSignIn: true,
    enabled: true,
    // l9: raise the floor from better-auth's default (8) to 12. 8-char passwords
    // are trivially cracked offline if a hash ever leaks; 12 blocks the long
    // tail of low-effort guessing without requiring complexity rules.
    minPasswordLength: 8,
    sendResetPassword: async ({ url, user }, _request) => {
      const { sendResetPasswordEmail } = await import(
        "~/lib/send-reset-password"
      );
      void sendResetPasswordEmail({ to: user.email, url, user });
    },
  },

  // Email verification: disabled in dev, enabled in production/staging
  emailVerification:
    process.env.NODE_ENV === "development"
      ? {
          sendOnSignUp: false,
          sendVerificationEmail: async () => {
            /* no-op for local dev */
          },
        }
      : {
          sendOnSignUp: true,
          sendVerificationEmail: async ({ url, user }) => {
            const { sendVerificationOTPEmail } = await import(
              "~/lib/send-otp-email"
            );
            void sendVerificationOTPEmail({
              otp: url,
              to: user.email,
              type: "email-verification",
            });
          },
        },

  // Email/password sign-in needs credential account; enable when db.query rels work, else get 401
  experimental: {
    joins: true,
  },

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
    passkey({
      origin:
        typeof process.env.NEXT_PUBLIC_APP_URL === "string" &&
        process.env.NEXT_PUBLIC_APP_URL.length > 0
          ? process.env.NEXT_PUBLIC_APP_URL.startsWith("http")
            ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
            : `https://${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}`
          : undefined,
      rpName: SEO_CONFIG.name ?? "For the Culture",
    }),
    emailOTP({
      disableSignUp: true, // Only existing users (e.g. wallet users who added email) can sign in with email code
      async sendVerificationOTP({ email, otp, type }) {
        const { sendVerificationOTPEmail } = await import(
          "~/lib/send-otp-email"
        );
        await sendVerificationOTPEmail({ otp, to: email, type });
      },
    }),
    solanaAuthPlugin(),
    ethereumAuthPlugin(),
    telegramAuthPlugin(),
  ],

  // AUTH_SECRET is required in production for security
  secret: (() => {
    const secret = process.env.AUTH_SECRET;
    if (secret) return secret;
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET environment variable is required in production",
      );
    }
    console.warn("⚠️  Using hardcoded dev secret — never use in production");
    // Dev-only: generate a temporary secret that changes on each restart
    console.warn("AUTH_SECRET not set — using temporary dev secret");
    return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;
  })(),

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 2 * 60, // 2 minutes; reduces DB lookups on getSession
    },
  },

  // Only include social providers if credentials are available
  socialProviders,

  // Trusted origins for CORS/auth - use explicit allowlist for security (never throw)
  trustedOrigins: () => {
    try {
      if (process.env.NODE_ENV === "development") {
        return getDevelopmentAuthOrigins();
      }
      return getProductionAuthOrigins();
    } catch (e) {
      console.error("[auth] trustedOrigins error:", e);
      return process.env.NODE_ENV === "development"
        ? getDevelopmentAuthOrigins()
        : [];
    }
  },

  user: {
    // Identity/profile fields used by auth (sign-up, OAuth, session).
    // Notification preference fields are also included so Better Auth adapter knows about them.
    additionalFields: {
      age: {
        input: true,
        required: false,
        type: "number",
      },
      /** Internal admin CRM notes (not shown on storefront). */
      crmNotes: {
        input: false,
        required: false,
        type: "string",
      },
      firstName: {
        input: true,
        required: false,
        type: "string",
      },
      /** JSON array of interest slugs or comma-separated tags — admin/profile can normalize. */
      interestTags: {
        input: true,
        required: false,
        type: "string",
      },
      lastName: {
        input: true,
        required: false,
        type: "string",
      },
      marketingAiCompanion: {
        defaultValue: false,
        input: false,
        required: false,
        type: "boolean",
      },
      marketingDiscord: {
        defaultValue: false,
        input: false,
        required: false,
        type: "boolean",
      },
      // Notification preferences - marketing (per channel)
      marketingEmail: {
        defaultValue: true,
        input: false,
        required: false,
        type: "boolean",
      },
      marketingSms: {
        defaultValue: false,
        input: false,
        required: false,
        type: "boolean",
      },
      marketingTelegram: {
        defaultValue: false,
        input: false,
        required: false,
        type: "boolean",
      },
      marketingWebsite: {
        defaultValue: false,
        input: false,
        required: false,
        type: "boolean",
      },
      phone: {
        input: true,
        required: false,
        type: "string",
      },
      /** ISO 3166-1 alpha-2; default country for phone dialing (can differ from IP). */
      phoneCountry: {
        input: true,
        required: false,
        type: "string",
      },
      // Legacy fields
      receiveMarketing: {
        defaultValue: false,
        input: false,
        required: false,
        type: "boolean",
      },
      receiveOrderNotificationsViaTelegram: {
        defaultValue: false,
        input: false,
        required: false,
        type: "boolean",
      },
      receiveSmsMarketing: {
        defaultValue: false,
        input: false,
        required: false,
        type: "boolean",
      },
      /** User role for authorization. "user" (default) or "admin". */
      role: {
        defaultValue: "user",
        input: false,
        required: false,
        type: "string",
      },
      /** Self-reported; optional CRM segmentation (e.g. prefer_not_to_say, female, male, non_binary). */
      sex: {
        input: true,
        required: false,
        type: "string",
      },
      /** UI theme: "light" | "dark" | "system". Persisted for logged-in users. */
      theme: {
        defaultValue: "system",
        input: false,
        required: false,
        type: "string",
      },
      transactionalAiCompanion: {
        defaultValue: false,
        input: false,
        required: false,
        type: "boolean",
      },
      transactionalDiscord: {
        defaultValue: false,
        input: false,
        required: false,
        type: "boolean",
      },
      // Notification preferences - transactional (per channel)
      transactionalEmail: {
        defaultValue: true,
        input: false,
        required: false,
        type: "boolean",
      },
      transactionalSms: {
        defaultValue: false,
        input: false,
        required: false,
        type: "boolean",
      },
      transactionalTelegram: {
        defaultValue: false,
        input: false,
        required: false,
        type: "boolean",
      },
      transactionalWebsite: {
        defaultValue: true,
        input: false,
        required: false,
        type: "boolean",
      },
      /**
       * When false, skip server-side ad-platform conversion forwarding (X / Reddit / YouTube CAPI)
       * for this user’s purchases. First-party PostHog is unchanged.
       */
      adPlatformConversionForwarding: {
        defaultValue: true,
        input: true,
        required: false,
        type: "boolean",
      },
    },
  },
});

export const getCurrentUser = async (): Promise<null | UserDbType> => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) {
      return null;
    }
    return session.user as UserDbType;
  } catch (error) {
    // In drifted environments, session lookup can fail at runtime.
    // Treat as unauthenticated so checkout/purchase flows can continue.
    console.error("getCurrentUser session lookup failed:", error);
    return null;
  }
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

// Server-only: use ADMIN_EMAILS env var as fallback for backwards compatibility.
// Primary admin detection uses the database-backed `role` column on the user table.
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

/**
 * Check if a user has admin privileges.
 * Checks the DB `role` column first (preferred), then falls back to the ADMIN_EMAILS
 * env var for backwards compatibility during migration.
 * Admin check only affects access to /admin routes after login; it does not block sign-in.
 */
export function isAdminUser(
  user: null | { email?: string; role?: null | string },
): boolean {
  if (!user) return false;
  // Primary: database-backed role column
  if (user.role === "admin") return true;
  // Fallback: email-based detection (for backward compat until all admins have role set in DB)
  if (user.email && ADMIN_EMAILS.has(user.email.trim().toLowerCase()))
    return true;
  return false;
}
