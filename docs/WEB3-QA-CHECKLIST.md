# Web3 QA Checklist

Use this checklist for wallet auth, token, membership, or on-chain UX changes.

## Wallet/Auth Reliability

- Wallet sign-in modal opens from `/login`.
- Desktop only shows installed Solana wallets (no forced external browser hops).
- Multi-chain wallet flow shows network selection when expected.
- Wallet auth failures are surfaced with user-friendly error states.

## Web3 Surface Integrity

- `/membership` and `/token` pages return 2xx and render key content.
- Token-gated product UX still shows guardrails and does not expose gated content accidentally.
- Wallet-driven flows do not crash when session lookup fails (schema drift tolerance).

## Security & Safety

- No signing requests are triggered automatically without clear user action.
- No private keys, signatures, or sensitive wallet payloads are logged.
- Rate limits remain enabled for auth-adjacent public endpoints.

## Required Commands

- `bun run check`
- `bun run smoke:web3`
- `bun run smoke:extended` (for broad auth/UI impact)

## Staging Verification

- `bun run smoke:staging:web3`
- Review staging smoke artifacts on failure before promote-to-production.
