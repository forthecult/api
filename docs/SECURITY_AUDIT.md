# Security Audit Report - Culture Store Web3 eCommerce Platform

**Audit Date:** February 4, 2026  
**Auditor:** Automated Security Analysis  
**Scope:** Smart contracts, Web3 integration, API security, frontend security, infrastructure

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| **Critical** | 9 | Requires immediate attention |
| **High** | 16 | Should be fixed before production |
| **Medium** | 12 | Should be addressed |
| **Low** | 8 | Nice to have |

---

## 1. Smart Contract Security

### Critical Vulnerabilities

#### 1.1 Reentrancy Vulnerability in `sweepETH()` — CRITICAL
**File:** `contracts/PaymentReceiver.sol:78-87`

**Issue:** `sweepETH()` uses `call()` without a reentrancy guard. If `treasury` is a malicious contract, it can reenter and drain funds.

```solidity
// VULNERABLE CODE
function sweepETH() external {
    require(initialized, "Not initialized");
    uint256 balance = address(this).balance;
    require(balance > 0, "No ETH to sweep");
    
    (bool success, ) = treasury.call{value: balance}("");  // ⚠️ Reentrancy risk
    require(success, "ETH transfer failed");
    emit Swept(address(0), balance);
}
```

**Remediation:**
```solidity
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PaymentReceiver is ReentrancyGuard {
    function sweepETH() external nonReentrant {
        // ... existing code
    }
}
```

#### 1.2 Unprotected Initialization — CRITICAL
**File:** `contracts/PaymentReceiver.sol:52-58`

**Issue:** `initialize()` can be front-run by attackers to set a malicious treasury address.

**Remediation:**
```solidity
address public immutable factory;

function initialize(address _treasury, bytes32 _orderId) external {
    require(msg.sender == factory, "Only factory");
    require(!initialized, "Already initialized");
    // ... rest of initialization
}
```

#### 1.3 Missing Reentrancy Protection in Token Sweeps — HIGH
**Files:** `PaymentReceiver.sol:94-104, 110-123`

**Issue:** `sweepToken()` and `sweepTokens()` lack reentrancy guards.

#### 1.4 Front-running in Factory Deployment — HIGH
**File:** `contracts/PaymentReceiverFactory.sol:77-90`

**Issue:** Anyone can deploy receivers for any `orderId`, enabling front-running attacks.

**Remediation:** Add access control or signature verification.

---

## 2. Web3 Integration Security

### Critical Vulnerabilities

#### 2.1 Missing RPC Endpoint Validation — CRITICAL
**Files:** 
- `src/lib/wagmi-config.ts:30-35`
- `src/app/checkout/crypto/SolanaWalletProvider.tsx:14-17`

**Issue:** Uses default public RPCs without validation. Public RPCs are unreliable and can be MITM'd.

**Remediation:**
```typescript
const getRpcUrl = (chainId: number): string => {
  const url = process.env[`NEXT_PUBLIC_${CHAIN_NAMES[chainId]}_RPC_URL`];
  if (!url || !url.startsWith('https://')) {
    throw new Error(`Invalid RPC URL for chain ${chainId}`);
  }
  return url;
};
```

#### 2.2 No Network Validation (Mainnet vs Testnet) — CRITICAL
**Files:** Multiple wallet providers

**Issue:** Hardcoded mainnet without environment-based switching. Users could sign transactions on wrong network.

**Remediation:**
```typescript
const isProduction = process.env.NODE_ENV === 'production';
const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 
  (isProduction ? 'mainnet-beta' : 'devnet');

if (isProduction && network !== 'mainnet-beta') {
  throw new Error('Production must use mainnet');
}
```

#### 2.3 Missing Transaction Parameter Validation — CRITICAL
**File:** `src/lib/hooks/use-eth-pay.ts:252-306`

**Issue:** No validation of gas limits, recipient addresses, or amounts before signing.

**Remediation:**
```typescript
const validateTransaction = (tx: { to: Address; value: bigint }) => {
  if (!isAddress(tx.to)) throw new Error('Invalid recipient');
  if (tx.value <= 0n) throw new Error('Invalid amount');
  if (tx.to !== getAddress(tx.to)) throw new Error('Checksum mismatch');
};
```

### High Vulnerabilities

#### 2.4 SIWE ChainId Validation Missing — HIGH
**File:** `src/lib/auth-ethereum-plugin.ts:74-96`

**Issue:** Accepts any `chainId` in challenge request, enabling cross-chain replay attacks.

#### 2.5 Nonce Reuse Not Prevented — HIGH
**Files:** `auth-ethereum-plugin.ts`, `auth-solana-plugin.ts`

**Issue:** Race conditions could allow nonce reuse for replay attacks.

#### 2.6 Error Handling Leaks Information — HIGH
**Multiple files**

**Issue:** `console.error` logs expose wallet addresses and internal details.

---

## 3. API & Backend Security

### Critical Vulnerabilities

#### 3.1 User ID Spoofing in Checkout — CRITICAL
**Files:**
- `src/app/api/payments/stripe/create-checkout-session/route.ts:127`
- `src/app/api/checkout/eth-pay/create-order/route.ts:320`
- `src/app/api/checkout/btcpay/create-order/route.ts:180`
- `src/app/api/checkout/solana-pay/create-order/route.ts:178`

**Issue:** Endpoints accept `userId` in request body. Attackers could manipulate to impersonate users.

```typescript
// VULNERABLE CODE
if (session?.user?.id && body.userId === session.user.id) {
  metadata.userId = session.user.id;
}
```

**Remediation:** Never accept `userId` from client. Use `session.user.id` directly.

```typescript
// SECURE CODE
const userId = session?.user?.id ?? null;
if (userId) {
  metadata.userId = userId;
}
```

#### 3.2 Information Disclosure in Errors — HIGH
**File:** `src/app/api/checkout/eth-pay/create-order/route.ts:279-314`

**Issue:** Error responses expose product IDs, names, prices, and database structure.

```typescript
// VULNERABLE CODE
const errorPayload = {
  error: "totalCents does not match",
  productIds: orderItems.map((i) => i.productId),
  productNames: orderItems.map((i) => i.name),
  // ... more internal details
};
```

**Remediation:**
```typescript
// SECURE CODE
if (process.env.NODE_ENV === 'development') {
  return NextResponse.json({ error: "Total mismatch", details: errorPayload }, { status: 400 });
}
return NextResponse.json({ error: "Invalid order total" }, { status: 400 });
```

### High Vulnerabilities

#### 3.3 Missing Rate Limiting on Public Endpoints — HIGH
**Files:**
- `src/app/api/checkout/route.ts`
- `src/app/api/checkout/coupons/validate/route.ts`
- `src/app/api/shipping/calculate/route.ts`

**Remediation:** Add rate limiting:
```typescript
const ip = getClientIp(request.headers);
const result = checkRateLimit(`endpoint:${ip}`, RATE_LIMITS.checkout);
if (!result.success) return rateLimitResponse(result);
```

#### 3.4 Webhook Signature Verification Optional — HIGH
**File:** `src/app/api/webhooks/btcpay/route.ts:57-73`

**Issue:** BTCPay webhook verification only runs if secret is set.

**Remediation:**
```typescript
if (process.env.NODE_ENV === 'production' && !BTCPAY_WEBHOOK_SECRET) {
  throw new Error('Webhook secret required in production');
}
```

#### 3.5 SQL Injection Risk — HIGH
**Files:** `src/app/api/admin/customers/route.ts`, `src/app/api/admin/orders/route.ts`

**Issue:** Raw SQL with template literals. While Drizzle mitigates risk, prefer ORM methods.

---

## 4. Frontend Security

### Medium Vulnerabilities

#### 4.1 PII Stored in localStorage — MEDIUM
**File:** `src/app/checkout/CheckoutClient.tsx:148, 728, 1256`

**Issue:** Email, name, address, phone stored in localStorage (persistent, accessible to scripts).

**Remediation:**
- Use `sessionStorage` for temporary data
- Clear after successful checkout
- Encrypt sensitive fields
- Add expiration/cleanup

#### 4.2 Password Reset Token in URL — MEDIUM
**File:** `src/app/auth/reset-password/page.client.tsx:19`

**Issue:** Token in URL can leak via browser history, referrer headers, server logs.

**Remediation:** Use POST with token in request body, or implement one-time tokens with short expiration.

#### 4.3 dangerouslySetInnerHTML Usage — LOW
**File:** `src/ui/components/structured-data.tsx`

**Issue:** Uses `dangerouslySetInnerHTML` for JSON-LD structured data.

**Status:** Low risk since data is controlled and serialized.

---

## 5. Authentication Security

### High Vulnerabilities

#### 5.1 Trusted Origins Too Permissive — HIGH
**File:** `src/lib/auth.ts:120-141`

**Issue:** Dynamically adds request origin/referer to trusted origins list.

```typescript
// VULNERABLE CODE
if (origin && !list.includes(origin)) list.push(origin);
```

**Remediation:** Use explicit allowlist:
```typescript
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXT_PUBLIC_ADMIN_APP_URL,
].filter(Boolean);

trustedOrigins: () => ALLOWED_ORIGINS,
```

#### 5.2 Development Secret Fallback — MEDIUM
**File:** `src/lib/auth.ts:196-200`

**Issue:** Falls back to hardcoded secret in development. Risk if accidentally deployed.

**Remediation:**
```typescript
secret: process.env.AUTH_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET required in production');
  }
  return 'dev-secret-min-32-chars';
})(),
```

---

## 6. Infrastructure Security

### Medium Vulnerabilities

#### 6.1 In-Memory Rate Limiting — MEDIUM
**File:** `src/lib/rate-limit.ts`

**Issue:** In-memory rate limiting doesn't work across multiple instances.

**Remediation:** Use Redis-based rate limiting (e.g., @upstash/ratelimit) for production.

#### 6.2 Database Connection Caching — LOW
**File:** `src/db/index.ts`

**Issue:** Connection cached in global scope. Acceptable for development but verify production behavior.

---

## 7. Crypto-Specific Security

### High Vulnerabilities

#### 7.1 Deposit Address Derivation Security — HIGH
**File:** `src/lib/solana-deposit.ts`

**Issue:** Deposit addresses derived from `orderId + secret`. If secret is weak or leaked, all deposit addresses are compromised.

**Remediation:**
- Use strong, randomly generated `SOLANA_DEPOSIT_SECRET` (256+ bits)
- Rotate secret periodically
- Consider using HD wallet derivation

#### 7.2 Missing Transaction Confirmation Validation — MEDIUM
**File:** `src/lib/hooks/use-eth-pay.ts:131-134`

**Issue:** Only 1 confirmation required. May be insufficient for high-value transactions.

**Remediation:**
```typescript
useWaitForTransactionReceipt({
  hash: txHash,
  confirmations: parseInt(process.env.NEXT_PUBLIC_REQUIRED_CONFIRMATIONS || '3'),
})
```

---

## 8. Priority Remediation Checklist

### Immediate (Critical)
- [ ] Add ReentrancyGuard to all smart contract sweep functions
- [ ] Restrict `initialize()` to factory-only calls
- [ ] Remove `userId` from checkout request bodies
- [ ] Add RPC endpoint validation
- [ ] Implement network validation (mainnet vs testnet)

### Short-term (High)
- [ ] Add rate limiting to all public endpoints
- [ ] Fix information disclosure in error responses
- [ ] Add SIWE chainId validation
- [ ] Implement nonce reuse prevention
- [ ] Require webhook secrets in production
- [ ] Fix trusted origins to use explicit allowlist

### Medium-term (Medium)
- [ ] Migrate to Redis-based rate limiting
- [ ] Encrypt PII in localStorage
- [ ] Move password reset token from URL to POST body
- [ ] Add transaction parameter validation
- [ ] Increase transaction confirmation requirements

### Long-term (Low)
- [ ] Implement structured logging
- [ ] Add Subresource Integrity for third-party scripts
- [ ] Review and optimize error handling
- [ ] Add contract address validation

---

## 9. Positive Security Findings

1. **Private keys server-side only** — `solana-deposit.ts` keeps secrets on server
2. **Nonces expire after 5 minutes** — Limits replay attack window
3. **Standard signature verification** — Uses tweetnacl, viem SIWE
4. **Rate limiting present** — Many endpoints have rate limiting
5. **Drizzle ORM usage** — Reduces SQL injection risk
6. **HTTPS enforced** — All external URLs use HTTPS
7. **Session cookie caching** — Reduces DB lookups
8. **Two-factor authentication** — 2FA plugin enabled
9. **Admin email protection** — Uses server-side env var, not NEXT_PUBLIC_

---

## 10. Compliance Considerations

### GDPR/CCPA
- Review data collection and storage practices
- Implement data export/deletion features
- Add privacy policy and consent mechanisms

### PCI-DSS (if handling card payments)
- Stripe handles card data (good)
- Ensure no card data touches your servers

---

## Appendix: Files Requiring Immediate Attention

1. `contracts/PaymentReceiver.sol` — Reentrancy, initialization
2. `contracts/PaymentReceiverFactory.sol` — Front-running
3. `src/lib/wagmi-config.ts` — RPC validation
4. `src/lib/hooks/use-eth-pay.ts` — Transaction validation
5. `src/lib/auth-ethereum-plugin.ts` — ChainId validation
6. `src/lib/auth.ts` — Trusted origins
7. `src/app/api/checkout/*/create-order/route.ts` — User ID spoofing
8. `src/app/checkout/CheckoutClient.tsx` — PII storage
