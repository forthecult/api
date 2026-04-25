# Shipping System (Staging -> Production)

This is the canonical release system for secure, low-defect shipping.

## 1) Local Dev Gate

Before opening PR:

- `bun run check`
- `bun run smoke:core`
- `bun run smoke:web3` (if web3/auth touched)
- Confirm migration path is reviewed SQL (never shared-env `db:push`)

## 2) PR Gate

Required:

- PR checklist completed (`.github/pull_request_template.md`)
- `PR Checklist Gate` workflow passes
- `CI (typecheck + build)` passes
- `Security Audit` passes
- `Snyk PR Security Gate` passes

## 3) Staging Gate

After merge to `staging`:

- `Staging Smoke (post-deploy)` runs core smoke against deployed SHA
- Extended + web3 suites run for additional signal
- On failure:
  - alert webhook
  - optional auto-heal redeploy (`Staging Auto Heal`)

## 4) Continuous Staging QA

- Nightly: `Staging Nightly Extended QA`
  - runs extended + web3 suites against staging URL
  - catches drift and flaky regressions outside merge windows

## 5) Production Promotion

Promote only when:

- staging deploy is healthy
- staging core smoke passes
- no unresolved high/critical security findings
- migration (if any) applied via controlled migration runner

Post-deploy production checks:

- `Production Smoke (post-deploy)` runs against deployed production SHA.
- On failure:
  - alert webhook
  - optional rollback webhook (production-only automation)

## 6) Incident / Rollback

- Rollback automation is production-only.
- Staging failures should auto-heal or be fixed forward, then re-tested.
- For migration incidents, use DR runbook in `docs/DISASTER-RECOVERY.md`.

## 7) Principle

Default to blocking bad code before humans test it:

- automate detection early (PR + pre-staging)
- automate verification late (post-deploy + nightly)
- automate safe response (alert + auto-heal on staging, rollback on production)
