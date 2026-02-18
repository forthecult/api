/**
 * Better Auth plugin: Sign in / Sign up with Telegram Login Widget.
 * See https://core.telegram.org/widgets/login
 *
 * - POST /sign-in/telegram: accepts widget payload (id, first_name, last_name, username, photo_url, auth_date, hash).
 *   Verifies HMAC-SHA256 hash, then finds or creates user + account and creates session.
 *   When link: true and user is logged in, links the Telegram account to the current user.
 */
import { createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { APIError } from "better-call";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { withFkRetry } from "~/lib/auth-db-retry";

const TELEGRAM_PROVIDER_ID = "telegram";
const AUTH_DATE_MAX_AGE_SEC = 300; // 5 minutes

interface AccountRecord {
  userId: string;
}
interface UserRecord {
  createdAt: Date;
  email: string;
  emailVerified: boolean;
  id: string;
  image?: null | string;
  name: string;
  updatedAt: Date;
}

const telegramPayloadSchema = z.object({
  auth_date: z.number().int().positive(),
  first_name: z.string().min(1),
  hash: z.string().min(1),
  id: z.number().int().positive(),
  last_name: z.string().optional(),
  link: z.boolean().optional(),
  photo_url: z.string().url().optional(),
  username: z.string().optional(),
});

export function telegramAuthPlugin() {
  return {
    endpoints: {
      signInTelegram: createAuthEndpoint(
        "/sign-in/telegram",
        {
          body: telegramPayloadSchema,
          method: "POST",
        },
        async (ctx) => {
          const body = ctx.body;
          const accountId = String(body.id);

          if (!verifyTelegramHash(body)) {
            throw new APIError("UNAUTHORIZED", {
              message: "Invalid Telegram login data",
            });
          }

          const now = Date.now() / 1000;
          if (Math.abs(body.auth_date - now) > AUTH_DATE_MAX_AGE_SEC) {
            throw new APIError("BAD_REQUEST", {
              message: "Telegram login data has expired",
            });
          }

          const adapter = ctx.context.adapter ?? ctx.context.internalAdapter;

          const existingAccount = (await adapter.findOne({
            model: "account",
            where: [
              { field: "providerId", value: TELEGRAM_PROVIDER_ID },
              { field: "accountId", value: accountId },
            ],
          })) as AccountRecord | null;

          if (body.link) {
            const session = await getSessionFromCtx(ctx);
            if (!session?.user?.id) {
              throw new APIError("UNAUTHORIZED", {
                message: "Sign in first to link your Telegram account",
              });
            }
            if (existingAccount) {
              if (
                existingAccount.userId === (session.user as { id: string }).id
              ) {
                return ctx.json({ linked: true, user: session.user });
              }
              throw new APIError("BAD_REQUEST", {
                message:
                  "This Telegram account is already linked to another user",
              });
            }
            await (
              ctx.context.internalAdapter as {
                linkAccount: (data: {
                  accountId: string;
                  providerId: string;
                  userId: string;
                }) => Promise<unknown>;
              }
            ).linkAccount({
              accountId,
              providerId: TELEGRAM_PROVIDER_ID,
              userId: (session.user as { id: string }).id,
            });
            return ctx.json({ linked: true, user: session.user });
          }

          let user: null | UserRecord = null;
          if (existingAccount) {
            user = (await adapter.findOne({
              model: "user",
              where: [{ field: "id", value: existingAccount.userId }],
            })) as null | UserRecord;
          }

          if (!user) {
            const userId = (
              ctx.context as {
                generateId: (opts?: {
                  model?: string;
                  size?: number;
                }) => string;
              }
            ).generateId({ model: "user" });
            const email = `telegram_${accountId}@telegram.local`;
            const name =
              [body.first_name, body.last_name]
                .filter(Boolean)
                .join(" ")
                .trim() || "Telegram User";
            const date = new Date();
            try {
              await adapter.create({
                data: {
                  createdAt: date,
                  email,
                  emailVerified: true,
                  firstName: body.first_name,
                  id: userId,
                  image: body.photo_url ?? null,
                  lastName: body.last_name ?? null,
                  name,
                  updatedAt: date,
                },
                model: "user",
              });
            } catch (createErr) {
              // Handle duplicate email race condition
              const errMsg =
                createErr instanceof Error ? createErr.message : "";
              if (/duplicate|unique|already exists/i.test(errMsg)) {
                // Another request created this user concurrently, find them
                const existing = (await adapter.findOne({
                  model: "account",
                  where: [
                    { field: "providerId", value: TELEGRAM_PROVIDER_ID },
                    { field: "accountId", value: accountId },
                  ],
                })) as AccountRecord | null;
                if (existing) {
                  user = (await adapter.findOne({
                    model: "user",
                    where: [{ field: "id", value: existing.userId }],
                  })) as null | UserRecord;
                }
                if (!user) throw createErr; // re-throw if we still can't find the user
              } else {
                throw createErr;
              }
            }
            if (!user) {
              const newAccountId = (
                ctx.context as {
                  generateId: (opts?: {
                    model?: string;
                    size?: number;
                  }) => string;
                }
              ).generateId({ model: "account" });
              await withFkRetry(
                () =>
                  (
                    ctx.context.internalAdapter as {
                      createAccount: (data: {
                        accountId: string;
                        createdAt: Date;
                        id: string;
                        providerId: string;
                        updatedAt: Date;
                        userId: string;
                      }) => Promise<unknown>;
                    }
                  ).createAccount({
                    accountId,
                    createdAt: date,
                    id: newAccountId,
                    providerId: TELEGRAM_PROVIDER_ID,
                    updatedAt: date,
                    userId,
                  }),
                "telegram-auth createAccount",
              );
              user = (await adapter.findOne({
                model: "user",
                where: [{ field: "id", value: userId }],
              })) as null | UserRecord;
            }
          }

          if (!user) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Failed to get user",
            });
          }

          const createSessionFn = (
            ctx.context.internalAdapter as {
              createSession: (
                userId: string,
                request?: Request,
                cookie?: boolean,
              ) => Promise<null | { id: string; userId: string }>;
            }
          ).createSession.bind(ctx.context.internalAdapter);
          const session = await withFkRetry(
            () =>
              createSessionFn(
                user.id,
                ctx.request as Request | undefined,
                false,
              ),
            "telegram-auth createSession",
          );
          if (!session) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Failed to create session",
            });
          }

          await setSessionCookie(
            ctx,
            { session, user } as Parameters<typeof setSessionCookie>[1],
            false as boolean | undefined,
          );
          return ctx.json({
            user: {
              createdAt: user.createdAt,
              email: user.email,
              emailVerified: user.emailVerified,
              id: user.id,
              image: user.image,
              name: user.name,
              updatedAt: user.updatedAt,
            },
          });
        },
      ),
    },
    id: "telegram-auth",
  };
}

/**
 * Build data-check-string: all received fields except hash, sorted alphabetically by key.
 * https://core.telegram.org/widgets/login#checking-authorization
 */
function buildDataCheckString(
  params: Record<string, number | string | undefined>,
): string {
  const entries = Object.entries(params)
    .filter(
      ([k, v]) => k !== "hash" && k !== "link" && v !== undefined && v !== "",
    )
    .map(([k, v]) => [k, String(v)] as [string, string]);
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k}=${v}`).join("\n");
}

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token?.trim()) {
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: "Telegram login is not configured (TELEGRAM_BOT_TOKEN)",
    });
  }
  return token.trim();
}

function verifyTelegramHash(
  params: Record<string, boolean | number | string | undefined> & {
    hash: string;
  },
): boolean {
  const token = getBotToken();
  const dataCheckString = buildDataCheckString(
    params as Record<string, number | string | undefined> & { hash: string },
  );
  // Telegram docs: secret_key = SHA256(bot_token)
  const secretKey = createHash("sha256").update(token).digest();
  const computedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  const computedBuf = Buffer.from(computedHash, "hex");
  const hashBuf = Buffer.from(params.hash, "hex");
  if (computedBuf.length !== hashBuf.length) return false;
  return timingSafeEqual(computedBuf, hashBuf);
}
