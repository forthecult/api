## Summary

<!-- What changed and why -->

## QA / Security Checklist (Required)

- [ ] I ran `bun run check`.
- [ ] I ran `bun run smoke:core -- --list` (or full `bun run smoke:core` for risky changes).
- [ ] I verified no customer-data/security regressions (auth, PII, payments, rate limits).
- [ ] I confirmed no shared-env `db:push` usage was introduced.

### Web3 Changes (Required if touching wallet/auth/web3)

- [ ] I ran `bun run smoke:web3 -- --list` (or full `bun run smoke:web3`).
- [ ] Wallet sign-in modal still opens and routes correctly.
- [ ] Token/membership pages still render and do not 5xx.

### Staging Release Readiness

- [ ] Post-deploy staging smoke workflow will run for this commit.
- [ ] Rollback strategy is clear for this change.
- [ ] Any required migration uses reviewed SQL via controlled runner.

## Risk / Rollback

<!-- What could break and exactly how to revert -->
