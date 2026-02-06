# Guest orders and sign-up

## 1. Why did I see "duplicate email" when signing up with my wallet?

That message was **not** from using your wallet on the pay/checkout page. Checkout does not create a user account; it only creates an order with your email and leaves `userId` null (guest order).

The duplicate-email case happens when you **sign up** with a Solana (or EVM) wallet that was already used to create an account before. We generate a synthetic email from your wallet address (e.g. `solana_HfEMNhEN@wallet.local`). If that user already exists (e.g. from a previous sign-up attempt), the second attempt would hit a unique constraint. We now treat that as "existing user" and link the wallet to that account and sign you in, instead of failing.

## 2. Checkout with wallet, then sign up later

- **Crypto (Solana / EVM)**  
  When you pay with a wallet, we store the **payer wallet address** on the order when payment is confirmed (Solana: from the connected wallet when the client confirms; EVM: from the chain when we verify the transfer). When you later **sign up or sign in** with that same wallet, we automatically link any guest orders paid with that wallet to your new account. Those orders then appear under **My Orders**.

- **Email**  
  Guest orders are stored with the email you entered at checkout. We do **not** attach those orders to your account until you prove you own that email (see below).

## 3. Sign up with email and see previous orders (with verification)

- If you **sign up** with an email you used for a guest checkout, we do **not** show those orders in **My Orders** until your email is **verified**. That way someone cannot sign up with your email and see your order history without proving they control the inbox.

- After your email is verified:
  - Opening **My Orders** will **claim** any guest orders that have that email (set their `userId` to you).
  - Those orders then show up in **My Orders** and in order details.

- Viewing a **single order** by ID (e.g. from a link) is allowed by email match **only if** your account is email-verified. Unverified users can only see orders that already have their `userId` (i.e. orders they placed while logged in).

## Summary

| Scenario | What happens |
|----------|----------------|
| Pay with wallet (no account) | Order created with email + deposit address; payer wallet stored on confirm. |
| Sign up later with same wallet | Wallet auth links those guest orders to you; they appear in My Orders. |
| Pay with email (no account) | Order created with that email, `userId` null. |
| Sign up later with same email | Orders stay unlinked until email is verified. |
| After email verified | My Orders claims guest orders by email; single-order view allows email match. |
