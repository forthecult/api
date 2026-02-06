/**
 * Better Auth plugin: Sign in / Sign up with Ethereum (SIWE).
 * - POST /sign-in/ethereum/challenge: get EIP-4361 message to sign (nonce stored in verification table).
 * - POST /sign-in/ethereum/verify: verify signature, find or create user + account, create session.
 *   When link: true and user is logged in, links the Ethereum wallet to the current account instead of signing in.
 */
import { createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { APIError } from "better-call";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import {
  createSiweMessage,
  parseSiweMessage,
  verifySiweMessage,
} from "viem/siwe";
import { z } from "zod";

import { setSessionCookie } from "better-auth/cookies";
import { randomBytes } from "node:crypto";

const ETHEREUM_PROVIDER_ID = "ethereum";
const NONCE_EXPIRY_SEC = 300; // 5 minutes

type VerificationRecord = { id: string; expiresAt: Date; value: string };
type AccountRecord = { userId: string; id?: string };
type UserRecord = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function ensureProtocol(url: string): string {
  const t = url.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/+/, "")}`;
}

function getBase(): string {
  const raw =
    process.env.NEXT_SERVER_APP_URL ||
    (typeof process.env.VERCEL_URL === "string"
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
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
let _publicClient: ReturnType<typeof createPublicClient> | null = null;
function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: mainnet,
      transport: http(),
    });
  }
  return _publicClient;
}

export function ethereumAuthPlugin() {
  return {
    id: "ethereum-auth",
    endpoints: {
      signInEthereumChallenge: createAuthEndpoint(
        "/sign-in/ethereum/challenge",
        {
          method: "POST",
          body: z.object({
            address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
            chainId: z.number().optional(),
          }),
        },
        async (ctx) => {
          const address = ctx.body.address.trim() as `0x${string}`;
          const chainId = ctx.body.chainId ?? 1;
          const nonce = randomBytes(32).toString("hex");
          const expiresAt = new Date(Date.now() + NONCE_EXPIRY_SEC * 1000);
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: `ethereum:${address.toLowerCase()}`,
            value: nonce,
            expiresAt,
          });
          const domain = getDomain();
          const uri = getUri();
          const message = createSiweMessage({
            address,
            chainId,
            domain,
            nonce,
            uri,
            version: "1",
            statement: "Sign in to Culture",
          });
          return ctx.json({ message });
        },
      ),
      signInEthereumVerify: createAuthEndpoint(
        "/sign-in/ethereum/verify",
        {
          method: "POST",
          body: z.object({
            address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
            message: z.string(),
            signature: z.string(), // hex 0x...
            link: z.boolean().optional(),
          }),
        },
        async (ctx) => {
          try {
            const { address, message, signature, link } = ctx.body;
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
            })) as VerificationRecord | null;
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
              throw new APIError("UNAUTHORIZED", {
                message: "Signature verification failed",
              });
            }

            if (!valid) {
              console.error(
                "[ethereum-auth] Invalid signature for address:",
                addressTrim,
              );
              throw new APIError("UNAUTHORIZED", {
                message: "Invalid signature",
              });
            }

            console.log("[ethereum-auth] Signature verified successfully");

            // Delete the used verification token
            try {
              await adapter.delete({
                model: "verification",
                where: [{ field: "id", value: verification.id }],
              });
            } catch {
              // Fallback: some adapters use deleteMany
              try {
                await adapter.deleteMany({
                  model: "verification",
                  where: [{ field: "id", value: verification.id }],
                });
              } catch {
                // Ignore if delete fails - verification will expire anyway
                console.warn(
                  "[ethereum-auth] Could not delete verification token",
                );
              }
            }

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
                if (existingAccount.userId === (session.user as { id: string }).id) {
                  return ctx.json({ linked: true, user: session.user });
                }
                throw new APIError("BAD_REQUEST", {
                  message: "This wallet is already linked to another account",
                });
              }
              await (ctx.context.internalAdapter as { linkAccount: (data: { userId: string; accountId: string; providerId: string }) => Promise<unknown> }).linkAccount({
                userId: (session.user as { id: string }).id,
                accountId: addressTrim.toLowerCase(),
                providerId: ETHEREUM_PROVIDER_ID,
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
              const email = `ethereum_${addressTrim.slice(2, 10)}@wallet.local`;
              const now = new Date();
              await adapter.create({
                model: "user",
                data: {
                  id: userId,
                  email,
                  name: "Ethereum User",
                  emailVerified: true,
                  createdAt: now,
                  updatedAt: now,
                  // Notification preferences are set by databaseHooks.user.create.before in auth.ts
                },
              });
              // Use internalAdapter.createAccount so the account row goes through Better Auth's
              // createWithHooks; pass id explicitly because the account table requires a primary key.
              const accountRowId = (ctx.context as { generateId: (opts?: { model?: string; size?: number }) => string }).generateId({ model: "account" });
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
                id: accountRowId,
                userId,
                accountId: addressTrim.toLowerCase(),
                providerId: ETHEREUM_PROVIDER_ID,
                createdAt: now,
                updatedAt: now,
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
          } catch (err) {
            console.error("[ethereum-auth] Verify error:", err);
            if (err instanceof APIError) throw err;
            // Don't expose raw DB/query errors to the client
            const raw = err instanceof Error ? err.message : "Verification failed";
            const isDbError = /insert into|update.*set|Failed query|relation .* does not exist/i.test(raw);
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: isDbError
                ? "Something went wrong on our end. Please try again or contact support."
                : raw,
            });
          }
        },
      ),
    },
  };
}
