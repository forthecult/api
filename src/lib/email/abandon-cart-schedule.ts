/**
 * Abandon-cart timing (industry-aligned).
 *
 * **Why these windows:** studies and large retailers typically send the first
 * recovery email **1–4 hours** after intent drops (cart idle), a second around
 * **24 hours**, and a final incentive **48–72 hours** later. Sending in the
 * first hour often duplicates “still shopping” sessions; waiting **~1 hour**
 * after the last server sync reduces noise while staying inside the intent window.
 *
 * **How we detect abandon:** the storefront syncs a **server snapshot** on a
 * debounced timer while the customer is signed in. A **cron** enrolls shoppers
 * whose snapshot is idle for `ABANDON_CART_IDLE_SYNC_HOURS` and who still have
 * line items, have not completed a purchase, and allow marketing email. This is
 * more reliable than a pure “tab closed” beacon (mobile kills tabs, blockers,
 * background throttling). An optional `visibilitychange` hook can still call
 * the same sync endpoint to refresh `last_synced_at` sooner—it does not replace
 * the cron, it only sharpens idle detection.
 */
export const ABANDON_CART_IDLE_SYNC_HOURS = 1;

/** Delay after enrollment before the first drip send (lets the next funnel cron pick it up without racing the enroll cron). */
export const ABANDON_FUNNEL_FIRST_SEND_DELAY_MS = 120_000;
