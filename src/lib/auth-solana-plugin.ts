/**
 * Better Auth plugin: Sign in / Sign up with Solana wallet.
 * - POST /sign-in/solana/challenge: get message to sign (nonce stored in verification table).
 * - POST /sign-in/solana/verify: verify signature, find or create user + account, create session.
 *   When link: true and user is logged in, links the Solana wallet to the current account instead of signing in.
 */
import { createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { APIError } from "better-call";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { z } from "zod";

import { setSessionCookie } from "better-auth/cookies";
import { randomBytes } from "node:crypto";
import { PublicKey } from "@solana/web3.js";

import { linkOrdersToUserByWallet } from "~/lib/link-orders-to-user";

const SOLANA_PROVIDER_ID = "solana";
const MESSAGE_PREFIX = "Sign this message to sign in to";
const NONCE_EXPIRY_SEC = 300; // 5 minutes

type VerificationRecord = { id: string; expiresAt: Date };
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

function getAppName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME ?? "For the Culture";
}

function makeMessage(nonce: string): string {
  return `${MESSAGE_PREFIX} ${getAppName()}:\n\n${nonce}`;
}

function extractNonceFromMessage(message: string): string | null {
  const prefix = `${MESSAGE_PREFIX} ${getAppName()}:`;
  if (!message.startsWith(prefix)) return null;
  const rest = message.slice(prefix.length).trim();
  const lines = rest.split("\n");
  const lastLine = lines[lines.length - 1]?.trim();
  return lastLine ?? null;
}

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
  if (/user_email_unique/i.test(msg) && /duplicate key|unique constraint/i.test(msg)) return true;
  const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
  if (code === "23505") return true; // PostgreSQL unique_violation
  const cause = err && typeof err === "object" && "cause" in err ? (err as { cause: unknown }).cause : null;
  if (cause && typeof cause === "object" && "code" in cause && String((cause as { code: string }).code) === "23505") return true;
  return false;
}

function getSignatureBytes(params: {
  signature?: string;
  signatureBase58?: string;
}): Uint8Array | null {
  if (params.signatureBase58) {
    try {
      const decoded = bs58.decode(params.signatureBase58);
      if (decoded.length < 64) return null;
      return decoded.length === 64 ? decoded : decoded.slice(0, 64);
    } catch {
      return null;
    }
  }
  if (params.signature) {
    try {
      const buf = Buffer.from(params.signature, "base64");
      if (buf.length < 64) return null;
      return new Uint8Array(buf.length === 64 ? buf : buf.subarray(0, 64));
    } catch {
      return null;
    }
  }
  return null;
}

function verifySolanaSignature(params: {
  address: string;
  message: string;
  signature?: string;
  signatureBase58?: string;
}): boolean {
  try {
    const signature = getSignatureBytes(params);
    if (!signature || signature.length !== 64) {
      console.error(
        "[solana-auth] Invalid signature length:",
        signature?.length,
      );
      return false;
    }

    const publicKey = new PublicKey(params.address);
    const publicKeyBytes = publicKey.toBytes();
    const messageBytes = new TextEncoder().encode(params.message);

    // Use tweetnacl for ed25519 signature verification (standard for Solana)
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signature,
      publicKeyBytes,
    );

    if (!isValid) {
      console.error(
        "[solana-auth] Signature verification failed for address:",
        params.address,
      );
    }

    return isValid;
  } catch (err) {
    console.error("[solana-auth] Verification error:", err);
    return false;
  }
}

export function solanaAuthPlugin() {
  return {
    id: "solana-auth",
    endpoints: {
      signInSolanaChallenge: createAuthEndpoint(
        "/sign-in/solana/challenge",
        {
          method: "POST",
          body: z.object({
            address: z.string().min(32).max(64),
          }),
        },
        async (ctx) => {
          const address = ctx.body.address.trim();
          const nonce = randomBytes(32).toString("hex");
          const expiresAt = new Date(Date.now() + NONCE_EXPIRY_SEC * 1000);
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: `solana:${address}`,
            value: nonce,
            expiresAt,
          });
          const message = makeMessage(nonce);
          return ctx.json({ message });
        },
      ),
      signInSolanaVerify: createAuthEndpoint(
        "/sign-in/solana/verify",
        {
          method: "POST",
          body: z.object({
            address: z.string().min(32).max(64),
            message: z.string(),
            signature: z.string().optional(), // base64 (from wallet adapter Uint8Array)
            signatureBase58: z.string().optional(), // base58 (from Phantom and some wallets)
            link: z.boolean().optional(), // when true and session exists, link wallet to current user
          }),
        },
        async (ctx) => {
          try {
            const { address, message, signature, signatureBase58, link } =
              ctx.body;
            if (!signature && !signatureBase58) {
              throw new APIError("BAD_REQUEST", {
                message: "signature or signatureBase58 required",
              });
            }
            const addressTrim = address.trim();

            const nonce = extractNonceFromMessage(message);
            if (!nonce) {
              throw new APIError("BAD_REQUEST", {
                message: "Invalid message format",
              });
            }

            // Use internalAdapter for database operations - adapter may be undefined in some better-auth versions
            const adapter = ctx.context.adapter ?? ctx.context.internalAdapter;
            const verification = (await adapter.findOne({
              model: "verification",
              where: [
                { field: "identifier", value: `solana:${addressTrim}` },
                { field: "value", value: nonce },
              ],
            })) as VerificationRecord | null;
            if (!verification || new Date(verification.expiresAt) < new Date()) {
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
                  console.warn("[solana-auth] Could not delete verification token");
                }
              }
            };

            const valid = verifySolanaSignature({
              address: addressTrim,
              message,
              signature: signature ?? undefined,
              signatureBase58: signatureBase58 ?? undefined,
            });
            if (!valid) {
              await deleteNonce();
              throw new APIError("UNAUTHORIZED", {
                message: "Invalid signature",
              });
            }

            // Delete the used verification token
            await deleteNonce();

            const existingAccount = (await adapter.findOne({
              model: "account",
              where: [
                { field: "providerId", value: SOLANA_PROVIDER_ID },
                { field: "accountId", value: addressTrim },
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
                if (existingAccount.userId === (session.user as { id: string }).id) {
                  return ctx.json({ linked: true, user: session.user });
                }
                throw new APIError("BAD_REQUEST", {
                  message: "This wallet is already linked to another account",
                });
              }
              await (ctx.context.internalAdapter as { linkAccount: (data: { userId: string; accountId: string; providerId: string }) => Promise<unknown> }).linkAccount({
                userId: (session.user as { id: string }).id,
                accountId: addressTrim,
                providerId: SOLANA_PROVIDER_ID,
              });
              return ctx.json({ linked: true, user: session.user });
            }

            const generateId =
              typeof (ctx.context as { generateId?: (opts?: { model?: string; size?: number }) => string }).generateId === "function"
                ? (ctx.context as { generateId: (opts?: { model?: string; size?: number }) => string }).generateId
                : () => randomBytes(16).toString("hex");

            let user: UserRecord | null = null;
            if (existingAccount) {
              user = (await adapter.findOne({
                model: "user",
                where: [{ field: "id", value: existingAccount.userId }],
              })) as UserRecord | null;
            }

            if (!user) {
              const email = `solana_${addressTrim.slice(0, 8)}@wallet.local`;
              const now = new Date();
              const userId = generateId({ model: "user" });
              console.log("[solana-auth] No existing account for", addressTrim, "— creating new user", userId, "with email", email);
              try {
                await adapter.create({
                  model: "user",
                  data: {
                    id: userId,
                    email,
                    name: "Solana User",
                    emailVerified: true,
                    createdAt: now,
                    updatedAt: now,
                    // Notification preference defaults (explicit to avoid NOT NULL violations
                    // when databaseHooks.user.create.before does not run for raw adapter calls)
                    role: "user",
                    transactionalEmail: true,
                    transactionalWebsite: true,
                    transactionalSms: false,
                    transactionalTelegram: false,
                    transactionalDiscord: false,
                    transactionalAiCompanion: false,
                    marketingEmail: true,
                    marketingWebsite: false,
                    marketingSms: false,
                    marketingTelegram: false,
                    marketingDiscord: false,
                    marketingAiCompanion: false,
                    receiveMarketing: false,
                    receiveSmsMarketing: false,
                    receiveOrderNotificationsViaTelegram: false,
                  },
                });
              } catch (createUserErr) {
                console.error("[solana-auth] User creation failed:", createUserErr);
                if (isDuplicateUserEmailError(createUserErr)) {
                  console.log("[solana-auth] Duplicate email detected, looking up existing user for", email);
                  const existingUser = (await adapter.findOne({
                    model: "user",
                    where: [{ field: "email", value: email }],
                  })) as UserRecord | null;
                  if (existingUser) {
                    user = existingUser;
                    const existingAccountForWallet = (await adapter.findOne({
                      model: "account",
                      where: [
                        { field: "providerId", value: SOLANA_PROVIDER_ID },
                        { field: "accountId", value: addressTrim },
                      ],
                    })) as AccountRecord | null;
                    if (!existingAccountForWallet) {
                      const accountId = generateId({ model: "account" });
                      try {
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
                          id: accountId,
                          userId: existingUser.id,
                          accountId: addressTrim,
                          providerId: SOLANA_PROVIDER_ID,
                          createdAt: now,
                          updatedAt: now,
                        });
                      } catch (linkAccountErr) {
                        console.error(
                          "[solana-auth] createAccount (link existing user) failed:",
                          linkAccountErr,
                        );
                        throw linkAccountErr;
                      }
                    }
                  }
                }
                if (!user) throw createUserErr;
              }
              if (!user) {
                console.log("[solana-auth] Linking new Solana account for user", userId);
                const accountId = generateId({ model: "account" });
                try {
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
                    id: accountId,
                    userId,
                    accountId: addressTrim,
                    providerId: SOLANA_PROVIDER_ID,
                    createdAt: now,
                    updatedAt: now,
                  });
                } catch (createAccountErr) {
                  console.error("[solana-auth] createAccount failed:", createAccountErr);
                  throw createAccountErr;
                }
                user = (await adapter.findOne({
                  model: "user",
                  where: [{ field: "id", value: userId }],
                })) as UserRecord | null;
              }
            }

            if (!user) {
              console.error("[solana-auth] User record not found after creation for address:", addressTrim);
              throw new APIError("INTERNAL_SERVER_ERROR", {
                message: "Failed to get user",
              });
            }
            console.log("[solana-auth] User ready:", user.id, "— creating session");

            // createSession(userId, request, dontRememberMe) - false = remember me (longer expiry)
            const session = await (ctx.context.internalAdapter as { createSession: (userId: string, request?: Request, dontRememberMe?: boolean) => Promise<{ id: string; userId: string } | null> }).createSession(
              user.id,
              ctx.request as Request | undefined,
              false,
            );
            if (!session) {
              throw new APIError("INTERNAL_SERVER_ERROR", {
                message: "Failed to create session",
              });
            }

            // Link any guest orders paid with this wallet to this user
            void linkOrdersToUserByWallet(user.id, addressTrim, {
              isEvm: false,
            }).catch((err) =>
              console.warn("[solana-auth] linkOrdersToUserByWallet failed:", err),
            );

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
          } catch (err) {
            // Log full error server-side for debugging (e.g. Railway logs)
            console.error("[solana-auth] Verify error:", err);
            if (err instanceof Error && err.stack) {
              console.error("[solana-auth] Stack:", err.stack);
            }
            if (err instanceof APIError) throw err;
            // Always use generic message — never expose raw error details to the client
            const raw =
              err instanceof Error ? err.message : "Verification failed";
            console.error("[wallet-auth] Verification error:", raw);
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Something went wrong on our end. Please try again or contact support.",
            });
          }
        },
      ),
    },
  };
}
