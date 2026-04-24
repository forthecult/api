# Email deliverability (Resend + DNS)

Transactional and marketing email should authenticate with **SPF**, **DKIM**, and **DMARC** on the domain you send from (`RESEND_FROM_EMAIL`). Resend sends via Amazon SES infrastructure; follow the DNS records Resend shows for your domain in the dashboard.

## 1. SPF (TXT on `@` or delegated subdomain)

- Include Resend’s SPF include (see current Resend docs — often `include:amazonses.com` alongside your existing includes).
- **One flattened SPF record** per DNS label; avoid more than ~10 DNS lookups total.

## 2. DKIM (CNAMEs)

- Add the two DKIM **CNAME** records Resend provides for your sending domain.
- Wait for propagation (often minutes, sometimes up to 48h).

## 3. DMARC (TXT on `_dmarc.yourdomain`)

Example (tune after monitoring):

```txt
_dmarc.yourdomain TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain; adkim=s; aspf=s"
```

- Start with `p=none` while collecting reports, then move to `quarantine` / `reject`.
- `rua` should be a mailbox you monitor (or a DMARC report service).

## 4. MTA-STS + TLS-RPT (recommended)

- **MTA-STS**: host policy at `https://mta-sts.yourdomain/.well-known/mta-sts.txt` and publish `SMTP TLS Reporting` / `_mta-sts` TXT per RFC 8461.
- **TLS-RPT**: `_smtp._tls` TXT pointing at a `mailto:` for TLS aggregate reports.

## 5. BIMI (optional)

- Requires strong DMARC (`p=quarantine` or `reject`) and a **VMC** (verified mark certificate) for most inbox logos.
- Treat as polish after SPF/DKIM/DMARC are stable.

## 6. List-Unsubscribe (bulk / marketing)

- Marketing templates set `List-Unsubscribe` (mailto + HTTPS one-click) and `List-Unsubscribe-Post` per Gmail/Yahoo bulk-sender expectations.
- HTTPS target: `/api/email/unsubscribe` with signed tokens (`EMAIL_UNSUBSCRIBE_SECRET`).

## 7. Verification checklist

After changing DNS:

```bash
dig +short TXT yourdomain.com
dig +short TXT _dmarc.yourdomain.com
dig +short CNAME resend._domainkey.yourdomain.com
```

In Resend: **Domains** → your domain → verify DKIM/SPF/DMARC status.

## 8. Webhooks

- Configure Resend webhook URL: `https://<your-store>/api/webhooks/resend`
- Set `RESEND_WEBHOOK_SECRET` to the Svix signing secret from the Resend dashboard.
- Hard bounces and complaints create `email_suppression` rows; opens/clicks/delivered update `email_event`.

## 9. Database migrations

1. Apply Drizzle schema (`bun run db:push` in `webapp/`) so `email_event`, `email_suppression`, and `newsletter_subscriber` exist.
2. Run RLS script: `bun run db:migrate-rls` (or `psql -f scripts/migrate-enable-rls-auth-tables.sql`).
