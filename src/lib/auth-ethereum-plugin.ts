/**
 * Better Auth plugin: Sign in / Sign up with Ethereum (SIWE).
 * - POST /sign-in/ethereum/challenge: get EIP-4361 message to sign (nonce stored in verification table).
 * - POST /sign-in/ethereum/verify: verify signature, find or create user + account, create session.
 *   When link: true and user is logged in, links the Ethereum wallet to the current account instead of signing in.
 */
import { createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { APIError } from "better-call";
import { randomBytes } from "node:crypto";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import {
  createSiweMessage,
  parseSiweMessage,
  verifySiweMessage,
} from "viem/siwe";
import { z } from "zod";

import { withFkRetry } from "~/lib/auth-db-retry";
import { linkOrdersToUserByWallet } from "~/lib/link-orders-to-user";

const ETHEREUM_PROVIDER_ID = "ethereum";

/** Collect error message from error and its cause chain (e.g. Postgres wraps in cause). */
function getFullErrorMessage(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = err;
  while (current) {
    if (current instanceof Error) {
      if (current.message) parts.push(current.message);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(" ");
}

/** True if this error is a DB unique constraint on user email (duplicate signup). */
function isDuplicateUserEmailError(err: unknown): boolean {
  const msg = getFullErrorMessage(err);
  if (
    /user_email_unique/i.test(msg) &&
    /duplicate key|unique constraint/i.test(msg)
  )
    return true;
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
  if (code === "23505") return true; // PostgreSQL unique_violation
  const cause =
    err && typeof err === "object" && "cause" in err
      ? (err as { cause: unknown }).cause
      : null;
  if (
    cause &&
    typeof cause === "object" &&
    "code" in cause &&
    String((cause as { code: string }).code) === "23505"
  )
    return true;
  return false;
}
const NONCE_EXPIRY_SEC = 300; // 5 minutes

interface AccountRecord {
  id?: string;
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
interface VerificationRecord {
  expiresAt: Date;
  id: string;
  value: string;
}

function ensureProtocol(url: string): string {
  const t = url.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/+/, "")}`;
}

function getBase(): string {
  // Priority order for determining the app URL:
  // 1. NEXT_SERVER_APP_URL - explicitly set server URL (recommended for production)
  // 2. NEXT_PUBLIC_APP_URL - public app URL (works in production)
  // 3. VERCEL_URL - auto-set by Vercel deployments
  // 4. Fallback to localhost only in development
  const raw =
    process.env.NEXT_SERVER_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof process.env.VERCEL_URL === "string"
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : "http://localhost:3000");
  return ensureProtocol(raw);
}

function getDomain(): string {
  try {
    return new URL(getBase()).host;
  } catch {
    return "localhost";
  }
}

function getUri(): string {
  return getBase();
}

// Lazy public client for verifySiweMessage (needs a viem Client)
let _publicClient: null | ReturnType<typeof createPublicClient> = null;
export function ethereumAuthPlugin() {
  return {
    endpoints: {
      signInEthereumChallenge: createAuthEndpoint(
        "/sign-in/ethereum/challenge",
        {
          body: z.object({
            address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
            chainId: z.number().optional(),
          }),
          method: "POST",
        },
        async (ctx) => {
          const address = ctx.body.address.trim() as `0x${string}`;
          const chainId = ctx.body.chainId ?? 1;
          const nonce = randomBytes(32).toString("hex");
          const expiresAt = new Date(Date.now() + NONCE_EXPIRY_SEC * 1000);
          await ctx.context.internalAdapter.createVerificationValue({
            expiresAt,
            identifier: `ethereum:${address.toLowerCase()}`,
            value: nonce,
          });
          const domain = getDomain();
          const uri = getUri();
          const message = createSiweMessage({
            address,
            chainId,
            domain,
            nonce,
            statement: "Sign in to Culture",
            uri,
            version: "1",
          });
          return ctx.json({ message });
        },
      ),
      signInEthereumVerify: createAuthEndpoint(
        "/sign-in/ethereum/verify",
        {
          body: z.object({
            address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
            link: z.boolean().optional(),
            message: z.string(),
            signature: z.string(), // hex 0x...
          }),
          method: "POST",
        },
        async (ctx) => {
          try {
            const { address, link, message, signature } = ctx.body;
            const addressTrim = address.trim() as `0x${string}`;
            const signatureHex = signature.startsWith("0x")
              ? (signature as `0x${string}`)
              : (`0x${signature}` as `0x${string}`);

            console.log(
              "[ethereum-auth] Verifying signature for address:",
              addressTrim,
            );

            const parsed = parseSiweMessage(message);
            const nonce = parsed.nonce;
            if (!nonce) {
              console.error(
                "[ethereum-auth] Invalid message format - no nonce found",
              );
              throw new APIError("BAD_REQUEST", {
                message: "Invalid message format",
              });
            }

            // Use internalAdapter for database operations - adapter may be undefined in some better-auth versions
            const adapter = ctx.context.adapter ?? ctx.context.internalAdapter;
            const verification = (await adapter.findOne({
              model: "verification",
              where: [
                {
                  field: "identifier",
                  value: `ethereum:${addressTrim.toLowerCase()}`,
                },
                { field: "value", value: nonce },
              ],
            })) as null | VerificationRecord;
            if (!verification) {
              console.error(
                "[ethereum-auth] No verification found for:",
                `ethereum:${addressTrim.toLowerCase()}`,
              );
              throw new APIError("BAD_REQUEST", {
                message: "Challenge expired or invalid",
              });
            }
            if (new Date(verification.expiresAt) < new Date()) {
              console.error("[ethereum-auth] Verification expired");
              throw new APIError("BAD_REQUEST", {
                message: "Challenge expired or invalid",
              });
            }

            // Always delete the nonce after lookup, regardless of verification outcome
            const deleteNonce = async () => {
              try {
                await adapter.delete({
                  model: "verification",
                  where: [{ field: "id", value: verification.id }],
                });
              } catch {
                try {
                  await adapter.deleteMany({
                    model: "verification",
                    where: [{ field: "id", value: verification.id }],
                  });
                } catch {
                  console.warn(
                    "[ethereum-auth] Could not delete verification token",
                  );
                }
              }
            };

            const client = getPublicClient();
            let valid = false;
            try {
              valid = await verifySiweMessage(client, {
                address: addressTrim,
                message,
                signature: signatureHex,
              });
            } catch (siweErr) {
              console.error(
                "[ethereum-auth] SIWE verification error:",
                siweErr,
              );
              await deleteNonce();
              throw new APIError("UNAUTHORIZED", {
                message: "Signature verification failed",
              });
            }

            if (!valid) {
              console.error(
                "[ethereum-auth] Invalid signature for address:",
                addressTrim,
              );
              await deleteNonce();
              throw new APIError("UNAUTHORIZED", {
                message: "Invalid signature",
              });
            }

            console.log("[ethereum-auth] Signature verified successfully");

            // Delete the used verification token
            await deleteNonce();

            const existingAccount = (await adapter.findOne({
              model: "account",
              where: [
                { field: "providerId", value: ETHEREUM_PROVIDER_ID },
                { field: "accountId", value: addressTrim.toLowerCase() },
              ],
            })) as AccountRecord | null;

            if (link) {
              const session = await getSessionFromCtx(ctx);
              if (!session?.user?.id) {
                throw new APIError("UNAUTHORIZED", {
                  message: "Sign in first to link this wallet",
                });
              }
              if (existingAccount) {
                if (
                  existingAccount.userId === (session.user as { id: string }).id
                ) {
                  return ctx.json({ linked: true, user: session.user });
                }
                throw new APIError("BAD_REQUEST", {
                  message: "This wallet is already linked to another account",
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
                accountId: addressTrim.toLowerCase(),
                providerId: ETHEREUM_PROVIDER_ID,
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

            const generateId =
              typeof (
                ctx.context as {
                  generateId?: (opts?: {
                    model?: string;
                    size?: number;
                  }) => string;
                }
              ).generateId === "function"
                ? (
                    ctx.context as {
                      generateId: (opts?: {
                        model?: string;
                        size?: number;
                      }) => string;
                    }
                  ).generateId
                : () => randomBytes(16).toString("hex");

            if (!user) {
              const email = `ethereum_${addressTrim.slice(2, 10)}@wallet.local`;
              const now = new Date();
              const userId = generateId({ model: "user" });
              console.log(
                "[ethereum-auth] No existing account for",
                addressTrim,
                "— creating new user",
                userId,
                "with email",
                email,
              );
              try {
                await adapter.create({
                  data: {
                    createdAt: now,
                    email,
                    emailVerified: true,
                    id: userId,
                    marketingAiCompanion: false,
                    marketingDiscord: false,
                    marketingEmail: true,
                    marketingSms: false,
                    marketingTelegram: false,
                    marketingWebsite: false,
                    name: "Ethereum User",
                    receiveMarketing: false,
                    receiveOrderNotificationsViaTelegram: false,
                    receiveSmsMarketing: false,
                    // Notification preference defaults (explicit to avoid NOT NULL violations
                    // when databaseHooks.user.create.before does not run for raw adapter calls)
                    role: "user",
                    transactionalAiCompanion: false,
                    transactionalDiscord: false,
                    transactionalEmail: true,
                    transactionalSms: false,
                    transactionalTelegram: false,
                    transactionalWebsite: true,
                    twoFactorEnabled: false,
                    updatedAt: now,
                  },
                  model: "user",
                });
              } catch (createUserErr) {
                console.error(
                  "[ethereum-auth] User creation failed:",
                  createUserErr,
                );
                if (isDuplicateUserEmailError(createUserErr)) {
                  console.log(
                    "[ethereum-auth] Duplicate email detected, looking up existing user for",
                    email,
                  );
                  const existingUser = (await adapter.findOne({
                    model: "user",
                    where: [{ field: "email", value: email }],
                  })) as null | UserRecord;
                  if (existingUser) {
                    user = existingUser;
                    const existingAccountForWallet = (await adapter.findOne({
                      model: "account",
                      where: [
                        { field: "providerId", value: ETHEREUM_PROVIDER_ID },
                        {
                          field: "accountId",
                          value: addressTrim.toLowerCase(),
                        },
                      ],
                    })) as AccountRecord | null;
                    if (!existingAccountForWallet) {
                      const accountRowId = generateId({ model: "account" });
                      try {
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
                              accountId: addressTrim.toLowerCase(),
                              createdAt: now,
                              id: accountRowId,
                              providerId: ETHEREUM_PROVIDER_ID,
                              updatedAt: now,
                              userId: existingUser.id,
                            }),
                          "ethereum-auth createAccount (link existing user)",
                        );
                      } catch (linkErr) {
                        console.error(
                          "[ethereum-auth] createAccount (link existing user) failed:",
                          linkErr,
                        );
                        throw linkErr;
                      }
                    }
                  }
                }
                if (!user) throw createUserErr;
              }
              if (!user) {
                console.log(
                  "[ethereum-auth] Linking new Ethereum account for user",
                  userId,
                );
                const accountRowId = generateId({ model: "account" });
                try {
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
                        accountId: addressTrim.toLowerCase(),
                        createdAt: now,
                        id: accountRowId,
                        providerId: ETHEREUM_PROVIDER_ID,
                        updatedAt: now,
                        userId,
                      }),
                    "ethereum-auth createAccount",
                  );
                } catch (createAccountErr) {
                  console.error(
                    "[ethereum-auth] createAccount failed:",
                    createAccountErr,
                  );
                  throw createAccountErr;
                }
                user = (await adapter.findOne({
                  model: "user",
                  where: [{ field: "id", value: userId }],
                })) as null | UserRecord;
              }
            }

            if (!user) {
              console.error(
                "[ethereum-auth] User record not found after creation for address:",
                addressTrim,
              );
              throw new APIError("INTERNAL_SERVER_ERROR", {
                message: "Failed to get user",
              });
            }
            console.log(
              "[ethereum-auth] User ready:",
              user.id,
              "— creating session",
            );

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
              "ethereum-auth createSession",
            );
            if (!session) {
              throw new APIError("INTERNAL_SERVER_ERROR", {
                message: "Failed to create session",
              });
            }

            // Link any guest orders paid with this wallet to this user
            void linkOrdersToUserByWallet(user.id, addressTrim.toLowerCase(), {
              isEvm: true,
            }).catch((err) =>
              console.warn(
                "[ethereum-auth] linkOrdersToUserByWallet failed:",
                err,
              ),
            );

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
          } catch (err) {
            console.error("[ethereum-auth] Verify error:", err);
            if (err instanceof APIError) throw err;
            // Always use generic message — never expose raw error details to the client
            const raw =
              err instanceof Error ? err.message : "Verification failed";
            console.error("[wallet-auth] Verification error:", raw);
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message:
                "Something went wrong on our end. Please try again or contact support.",
            });
          }
        },
      ),
    },
    id: "ethereum-auth",
  };
}

function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: mainnet,
      transport: http(),
    });
  }
  return _publicClient;
}
