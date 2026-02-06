/**
 * Better Auth plugin: Sign in / Sign up with Telegram Login Widget.
 * See https://core.telegram.org/widgets/login
 *
 * - POST /sign-in/telegram: accepts widget payload (id, first_name, last_name, username, photo_url, auth_date, hash).
 *   Verifies HMAC-SHA256 hash, then finds or creates user + account and creates session.
 *   When link: true and user is logged in, links the Telegram account to the current user.
 */
import { createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { APIError } from "better-call";
import { createHmac, createHash } from "node:crypto";
import { z } from "zod";

import { setSessionCookie } from "better-auth/cookies";

const TELEGRAM_PROVIDER_ID = "telegram";
const AUTH_DATE_MAX_AGE_SEC = 86400 * 7; // 7 days

type AccountRecord = { userId: string };
type UserRecord = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const telegramPayloadSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.number().int().positive(),
  hash: z.string().min(1),
  link: z.boolean().optional(),
});

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token?.trim()) {
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: "Telegram login is not configured (TELEGRAM_BOT_TOKEN)",
    });
  }
  return token.trim();
}

/**
 * Build data-check-string: all received fields except hash, sorted alphabetically by key.
 * https://core.telegram.org/widgets/login#checking-authorization
 */
function buildDataCheckString(
  params: Record<string, string | number | undefined>,
): string {
  const entries = Object.entries(params)
    .filter(
      ([k, v]) => k !== "hash" && k !== "link" && v !== undefined && v !== "",
    )
    .map(([k, v]) => [k, String(v)] as [string, string]);
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k}=${v}`).join("\n");
}

function verifyTelegramHash(
  params: Record<string, string | number | boolean | undefined> & { hash: string },
): boolean {
  const token = getBotToken();
  const dataCheckString = buildDataCheckString(params as Record<string, string | number | undefined> & { hash: string });
  // Telegram docs: secret_key = SHA256(bot_token)
  const secretKey = createHash("sha256").update(token).digest();
  const computedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  return computedHash === params.hash;
}

export function telegramAuthPlugin() {
  return {
    id: "telegram-auth",
    endpoints: {
      signInTelegram: createAuthEndpoint(
        "/sign-in/telegram",
        {
          method: "POST",
          body: telegramPayloadSchema,
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
              if (existingAccount.userId === (session.user as { id: string }).id) {
                return ctx.json({ linked: true, user: session.user });
              }
              throw new APIError("BAD_REQUEST", {
                message:
                  "This Telegram account is already linked to another user",
              });
            }
            await (ctx.context.internalAdapter as { linkAccount: (data: { userId: string; accountId: string; providerId: string }) => Promise<unknown> }).linkAccount({
              userId: (session.user as { id: string }).id,
              accountId,
              providerId: TELEGRAM_PROVIDER_ID,
            });
            return ctx.json({ linked: true, user: session.user });
          }

          let user: UserRecord | null = null;
          if (existingAccount) {
            user = (await adapter.findOne({
              model: "user",
              where: [{ field: "id", value: existingAccount.userId }],
            })) as UserRecord | null;
          }

          if (!user) {
            const userId = (ctx.context as { generateId: (opts?: { model?: string; size?: number }) => string }).generateId({ model: "user" });
            const email = `telegram_${accountId}@telegram.local`;
            const name =
              [body.first_name, body.last_name]
                .filter(Boolean)
                .join(" ")
                .trim() || "Telegram User";
            const date = new Date();
            await adapter.create({
              model: "user",
              data: {
                id: userId,
                email,
                name,
                emailVerified: true,
                createdAt: date,
                updatedAt: date,
                firstName: body.first_name,
                lastName: body.last_name ?? null,
                image: body.photo_url ?? null,
              },
            });
            const newAccountId = (ctx.context as { generateId: (opts?: { model?: string; size?: number }) => string }).generateId({ model: "account" });
            await (ctx.context.internalAdapter as {
              createAccount: (data: {
                id: string;
                userId: string;
                accountId: string;
                providerId: string;
                createdAt: Date;
                updatedAt: Date;
              }) => Promise<unknown>;
            }).createAccount({
              id: newAccountId,
              userId,
              accountId,
              providerId: TELEGRAM_PROVIDER_ID,
              createdAt: date,
              updatedAt: date,
            });
            user = (await adapter.findOne({
              model: "user",
              where: [{ field: "id", value: userId }],
            })) as UserRecord | null;
          }

          if (!user) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Failed to get user",
            });
          }

          const session = await (ctx.context.internalAdapter as { createSession: (userId: string, request?: Request, cookie?: boolean) => Promise<{ id: string; userId: string } | null> }).createSession(
            user.id,
            ctx.request as Request | undefined,
            false,
          );
          if (!session) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Failed to create session",
            });
          }

          await setSessionCookie(ctx, { session, user } as Parameters<typeof setSessionCookie>[1], false as boolean | undefined);
          return ctx.json({
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image,
              emailVerified: user.emailVerified,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            },
          });
        },
      ),
    },
  };
}
