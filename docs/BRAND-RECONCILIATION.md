# Brand Reconciliation

Status: items 1–6 resolved. No open contradictions.

This document exists so every inconsistency has one home. Resolve each item in the source file, then move the entry to the "Resolved" section. No brand copy should be edited to "match" another doc until the canonical answer is chosen.

## Canonical order (current)

When docs disagree, the intended order is:

1. [CULTURE-BRAND-GUIDE.md](CULTURE-BRAND-GUIDE.md) — voice, visual system, vocabulary (banned/approved words).
2. [CULTURE-BRAND-VISION.md](CULTURE-BRAND-VISION.md) — strategy, audience, pillars, 2030 vision.
3. [Culture-Bible.md](Culture-Bible.md) — internal training supplement. Must not contradict 1 or 2.
4. [Culture Store Thesis.md](Culture%20Store%20Thesis.md) — archived early thesis. Not authoritative.

The Guide governs tone and word choice. The Vision governs strategy and numbers. Where the Bible or Thesis disagree, they yield.

## Resolved

### 1. Pump.fun / memecoin framing — resolved

**Decision:** Pump.fun is the launch venue for CULT. It is **not** part of the brand identity. It is one small target market — useful for bootstrapping the token — and should never lead the brand narrative.

**Identity:** Culture's audience is people roughly 18–48 who want to live well — technology-literate, longevity-minded, early adopters, interested in smart home and everyday tools that make their lives better. Pump.fun traders are a subset; leading with Pump.fun alienates the broader audience.

**Applied language rules:**
- CULT is described as **reward points** used in Culture's rewards program, tracked on the Solana network. Utility first; never lead with "token" or "loyalty token."
- "Launched on Pump.fun" is acceptable as a factual detail in operational or token-specific sections. It must not appear in brand or identity-level copy.
- "Memecoin launchpad," "dialed into the latest trends," and similar hype framing stay out of any document that defines what Culture is.

**Edits applied:**
- [Culture-Bible.md](Culture-Bible.md) line 5 — rewritten. Identity framing replaces the Pump.fun lead.
- [Culture-Bible.md](Culture-Bible.md) line 114 — rewritten. Heading changed from "CULT token" to "CULT rewards." Body: "CULT is the points used in Culture's rewards program, tracked on the Solana network. It was launched on Pump.fun."

### 2. Token max supply: 1T vs 1B — resolved

**Decision:** Max supply is **1,000,000,000 CULT** (1 billion). The Bible is correct; the Thesis was wrong.

**Evidence (on-chain, Solana mainnet):**
- Mint: `6jCCBeaJD63L62c496VrV4HVPLJF5N3WyTWRwPappump` (Token-2022, 6 decimals)
- Current total supply (via `getTokenSupply`): **991,628,579.244285 CULT**. The delta (8,371,420.755715 CULT) has been burned via the buyback-and-burn mechanism. See [BUYBACK-BURN.md](BUYBACK-BURN.md).

**Public supply feed:** live numbers are exposed at `/api/supply` (JSON) and `/api/supply/{total,circulating,max,burned}` (plain text). See [TOKEN-SUPPLY-API.md](TOKEN-SUPPLY-API.md). These are the URLs to hand to CoinMarketCap and CoinGecko for listing forms.

**Edits applied:** none needed in the Bible. The Thesis is archived; its "1 trillion" figure is known-wrong and should be corrected if the doc is ever unarchived.

### 3. "Biohacking" terminology — resolved

**Decision:** **Drop "biohack" / "biohacking" everywhere.** The Brand Guide already bans it ("overused — say what the practice actually is"); the other docs need to follow the Guide.

**Edits applied:**
- [CULTURE-BRAND-VISION.md](CULTURE-BRAND-VISION.md) line 90 — "longevity, biohacking, clean eating" → "longevity, clean eating, evidence-based wellness, and toxin-free living."
- [CULTURE-BRAND-VISION.md](CULTURE-BRAND-VISION.md) line 143 — "Biohacking test kits" → "At-home health and lab test kits."
- [Culture-Bible.md](Culture-Bible.md) line 89 — "Biohacking test kits" → "At-home health and lab test kits."
- [Culture Store Thesis.md](Culture%20Store%20Thesis.md) line 359 — "biohacking test kits" → "at-home health and lab test kits."

### 4. Brand name / acronym — resolved

**Naming standard (apply consistently across all surfaces):**

| Context | Term | Where used |
|---------|------|------------|
| Primary customer-facing brand name | **Culture** | Headlines, meta titles, nav, footers, emails, marketing copy |
| Wordmark / legal / URL | **For the Cult** | Logo, legal entity name, `forthecult.store` |
| Community identifier | **the Cult** | "Join the Cult," "Cult members" — community affinity (from the Brand Guide) |
| Tagline variant (optional) | **For the Culture** | Tagline / campaign copy only; not a brand name |
| Token ticker | **CULT** (all caps) | On-chain, exchange listings, payment UIs, receipts |
| Internal engineering shorthand | **Culture monorepo** | AGENTS.md, SKILL.md files, CODEOWNERS, internal docs |

**Retired (do not use going forward):**
- **FTC** / **ftc** as a brand term. Reasons: (a) ambiguous with the US Federal Trade Commission, which undermines trust and creates avoidable friction; (b) it is a remnant of the upstream `ftc` template. The listed conventions ("For the Cult," "For the Culture," "Culture," "Cult") cover every case without it.

**Edits applied (internal docs — "Cult monorepo" → "Culture monorepo"):**
- [.agents/AGENTS.md](../../.agents/AGENTS.md)
- [.cursor/rules/general-rules.mdc](../../.cursor/rules/general-rules.mdc)
- [.cursor/skills/code-standards/SKILL.md](../../.cursor/skills/code-standards/SKILL.md)
- [.cursor/skills/repo-workflow/SKILL.md](../../.cursor/skills/repo-workflow/SKILL.md)
- [.github/CODEOWNERS](../../.github/CODEOWNERS)
- [SECURITY.md](../../SECURITY.md)
- [webapp/README.md](../README.md)
- [docs/ARCHITECTURE-ANALYSIS.md](../../docs/ARCHITECTURE-ANALYSIS.md)
- [docs/security-report-Cult-20260423.md](../../docs/security-report-Cult-20260423.md)

**Runtime / code renames applied** (owner confirmed no third-party API consumers, so nothing was gated):

| Location | Old | New | Notes |
|----------|-----|-----|-------|
| `webapp/package.json` + `bun.lock` | `"name": "ftc"` | `"name": "culture-webapp"` | Description also retitled. |
| Chat localStorage keys across 8 files | `ftc-ai-*` | `culture-ai-*` | One-shot migration in `src/lib/ai-local-bundle.ts::migrateLegacyAiKeys()`, wired into `/chat` and the floating AI widget. Guarded by `culture-ai-migrated-from-ftc` sentinel — idempotent. |
| Admin storefront-origin meta tag + env reader | `meta[name="ftc-storefront-origin"]` | `meta[name="culture-storefront-origin"]` | Both the writer (`admin/src/app/layout.tsx`) and the reader (`admin/src/lib/env.ts`) changed in this pass — deploy together. |
| Smoke test title regex | `/FTC\|For the Cult/i` | `/Culture\|For the Cult/i` | Current SEO config resolves to "For the Cult" so the live title still matches; "Culture" added for forward compat. |
| Email preview template appName | `"FTC"` | `"Culture"` | Preview-only script. |
| Solana x402 memo | `FTC Order: {orderId}` | `Culture Order: {orderId}` | Past memos remain on-chain as-is. No reconciliation reader parses the memo. |
| Discord slash command | `/ftc` (name + handler) | `/culture` (registered), with `/ftc` still accepted by the interaction handler for legacy bot registrations | Bots need to re-register to surface `/culture` in Discord UI. |
| Link-code message | `ftc link <code>` | `link <code>` or `culture link <code>` | Parser renamed `parseFtcLinkCodeFromMessage` → `parseLinkCodeFromMessage`. Regex still accepts the legacy `ftc link` form. Slack copy updated. |
| Admin README | "if your repo root is `ftc`" | "if your repo root is `webapp/`" | Doc of a local-dev quirk. |
| `notes.txt` | "Why choose FTC for bitcoin merchandize?" | "Why choose Culture for bitcoin merchandise?" | Internal backlog; also fixed the typo. |
| `webapp/.github/workflows/seed-staging.yml` stale `ftc/` resolver | removed in earlier sprint | n/a | Verified absent; already logged under `docs/compliance-audit-soc2-20260423.md`. |
| `.agents/AGENTS.md` brand-voice line | "prefer **For the Cult** / **FTC**" | "prefer **Culture** / **For the Cult** / **CULT** — do not use **FTC** / **ftc**" | Removes the only remaining internal directive that contradicted the naming standard. |

Items deliberately left untouched (internal, non-brand, risk > benefit):
- `webapp/src/app.ts::repoName: "ftc", repoOwner: "blefnk"` — this is the upstream Reliverse template link used only for the "GitHub stars" hero badge, not a brand surface.
- `webapp/scripts/start-local-db.sh` creates a local dev DB named `ftc` — renaming would orphan every developer's existing local DB. Not worth the churn.
- Internal chat IDs (`ftc-chat-*`, `ftc-widget-ai-*`) — server-invisible, never rendered.
- Historical references in `docs/ARCHITECTURE-ANALYSIS.md` and `docs/compliance-audit-soc2-20260423.md` — these describe previously shipped work and should not be rewritten.

### 5. Wellness Seeker / "clean eating" — resolved

**Decision:** **"Clean eating" is approved language.** It is descriptive, widely understood, and aligns with the "considered, direct, knowing, warm" voice the Guide defines. No edits needed.

### 6. Regulatory-risky token language — resolved

**Decision:** Replace "stake / stakers / stakeholders / revenue share / portion of profits" with "lock / locked-CULT holders / members / member rewards / buyback-and-burn" across all brand and narrative docs. The on-chain program and its TypeScript wrappers keep their existing identifiers (renaming a deployed Solana program is a separate migration). The distinction going forward:

- **Brand + marketing copy:** use the softer vocabulary below.
- **Engineering / on-chain identifiers:** `cult-solana-membership-staking`, `/api/governance/stake/prepare`, `use-stake-transaction`, etc. remain. They are not customer-facing and changing them breaks deployed contracts and clients.

**Softer vocabulary (canonical):**

| Avoid (regulator-risky) | Prefer (product-utility) |
|-------------------------|--------------------------|
| "Holders are stakeholders." | "CULT holders are members of the community." |
| "Stake CULT" / "staking" (as a product verb for CULT) | "Hold and lock CULT" / "locking" |
| "Stakers" | "Locked-CULT holders" or "members" |
| "Revenue share" / "share of the brand's revenue" | "Member benefits" / "member rewards" |
| "Portion of profits" / "share of profits" | "A share of program fees funds CULT buyback-and-burn." |
| "Stake CULT to unlock benefits" (also uses banned "unlock") | "Hold and lock CULT for member benefits." |

**Edits applied:**
- [Culture-Bible.md](Culture-Bible.md) lines 115–128 — entire "Holder Benefits / Token Economics / Creator Fee Distribution" block rewritten with the softer vocabulary above; section header changed from "Holder Benefits" to "Member Benefits."
- [CULTURE-BRAND-GUIDE.md](CULTURE-BRAND-GUIDE.md) glossary entry for "Stake" replaced with a "Lock" entry that explicitly flags "stake" as the preferred avoid-word for CULT while keeping the idiomatic "skin in the game" sense.
- [CULTURE-BRAND-GUIDE.md](CULTURE-BRAND-GUIDE.md) "Words the Brand Never Uses" extended with three new rows: `Stakeholder` (for CULT holders), `Revenue share` / `share of profits`, and `Staking` / `stakers` (for CULT as a product verb).
- [CULTURE-BRAND-GUIDE.md](CULTURE-BRAND-GUIDE.md) Section 4 "Community / Social Proof" framing copy — "stakeholders…earn a share of the brand's revenue" → "members…earn member rewards as the program grows." Design note switched from "staking stats" to "locked-CULT totals."
- [CULTURE-BRAND-GUIDE.md](CULTURE-BRAND-GUIDE.md) About page narrative — "they are stakeholders. Stake CULT for membership benefits…and a share of the brand's revenue" → "Hold and lock CULT for member benefits…" plus the tagline corrected from "this is ownership" to "this is a rewards program, made in the open."
- [CULTURE-BRAND-VISION.md](CULTURE-BRAND-VISION.md) "The CULT" section rewritten: "stakeholders in our mission" → "members of the community"; "Stake CULT for membership benefits that range based on your stake" → "Hold and lock CULT for member benefits that scale with your tier"; "5% to stakers" → "5% to locked-CULT holders"; "Transaction Fee Revenue" → "Creator Fees Funding Operations"; "Deflationary mechanism to reward holders" → "Deflationary mechanism that reduces supply over time."
- [Culture Store Thesis.md](Culture%20Store%20Thesis.md) line 188 — "Staked CULT token holders (5%)" → "Locked-CULT holders (5%)."
- [TOKEN-SUPPLY-API.md](TOKEN-SUPPLY-API.md) — "Staked tokens (held in the staking vault) count as circulating" → "Locked tokens (held in the member-locking vault) count as circulating."
- [webapp/src/app/membership/page.tsx](../src/app/membership/page.tsx) meta description — "Stake CULT to unlock exclusive membership benefits" → "Hold and lock CULT for member benefits" (also removes the banned word "unlock").

## Non-contradictions (noted so they are not revisited)

- Origin story (2015 founding, 2019 pause, return) is consistent across Guide, Vision, and Bible.
- Two pillars (Health, Autonomy) are consistent across Guide, Vision, and Bible.
- Natural fibers, no polyester policy is consistent.
- Data privacy posture is consistent across Vision and the customer-surface security doc.
- **"Crypto is a means — never the identity"** ([CULTURE-BRAND-GUIDE.md](CULTURE-BRAND-GUIDE.md) preamble) is intentional. The more literal construction is "a means, not an end," but "identity" is chosen deliberately. The point: crypto is a channel, like the internet. Saying crypto is your identity is like saying the internet is your identity — it conflates the medium with the self. Do not "correct" this line to "an end."

## Not in scope for this document

- Engineering conventions. See [.cursor/skills/code-standards/SKILL.md](../../.cursor/skills/code-standards/SKILL.md).
- Security posture. See [../../SECURITY.md](../../SECURITY.md) and [SECURITY-DEVELOPMENT-STANDARDS.md](SECURITY-DEVELOPMENT-STANDARDS.md).
- Agent behavior. See [../../.agents/AGENTS.md](../../.agents/AGENTS.md).
- Public supply API for exchange listings. See [TOKEN-SUPPLY-API.md](TOKEN-SUPPLY-API.md).
