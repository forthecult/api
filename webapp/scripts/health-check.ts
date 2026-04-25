/**
 * Post-restore health check.
 *
 * Run immediately after a Postgres restore (or a staging refresh) to confirm
 * the database is alive, seeded, and writable. Used as the canonical pass/fail
 * gate during disaster-recovery drills — see docs/DR-DRILL-LOG.md.
 *
 * SOC 2 mapping: CC7.5 / A1.3 (tests of backup restoration).
 *
 * Exits 0 on success, non-zero on any failed probe. Probes are additive;
 * more checks can be bolted on without changing the drill procedure.
 *
 * Usage:
 *   DATABASE_URL=... bun run scripts/health-check.ts
 *   DATABASE_URL=... bun run scripts/health-check.ts --skip-write
 */
import "dotenv/config";
import { sql } from "drizzle-orm";

import { db } from "~/db";

type Probe = {
  fn: () => Promise<string>;
  name: string;
};

const SKIP_WRITE = process.argv.includes("--skip-write");

const probes: Probe[] = [
  {
    fn: async () => {
      const rows = (await db.execute(sql`SELECT 1 AS ok`)) as unknown as Array<{
        ok: number;
      }>;
      if (rows[0]?.ok !== 1) throw new Error("SELECT 1 returned unexpected");
      return "select_one=ok";
    },
    name: "postgres_select_one",
  },
  {
    fn: async () => {
      const rows = (await db.execute(
        sql`SELECT current_setting('server_version') AS v`,
      )) as unknown as Array<{ v: string }>;
      const v = rows[0]?.v ?? "unknown";
      return `server_version=${v}`;
    },
    name: "postgres_version",
  },
  {
    fn: async () => {
      // A healthy restore has the expected core tables present. We intentionally
      // list a small representative set; the full migration chain is verified
      // by drizzle-kit push elsewhere.
      const required = [
        "admin_audit_log",
        "passkey",
        "session",
        "user",
        "webhook_registration",
      ];
      const rows = (await db.execute(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `)) as unknown as Array<{ table_name: string }>;
      const present = new Set(rows.map((r) => r.table_name));
      const missing = required.filter((t) => !present.has(t));
      if (missing.length > 0) {
        throw new Error(`missing_tables=${missing.join(",")}`);
      }
      return `tables_present=${required.length}`;
    },
    name: "required_tables",
  },
  {
    fn: async () => {
      const rows = (await db.execute(sql`
        SELECT COUNT(*)::int AS n FROM "user"
      `)) as unknown as Array<{ n: number }>;
      const n = rows[0]?.n ?? 0;
      if (n === 0) throw new Error("user_table_empty_post_restore");
      return `user_rows=${n}`;
    },
    name: "user_row_count",
  },
  {
    fn: async () => {
      const rows = (await db.execute(sql`
        SELECT MAX(created_at) AS latest FROM admin_audit_log
      `)) as unknown as Array<{ latest: null | string }>;
      const latest = rows[0]?.latest ?? "never";
      return `admin_audit_latest=${latest}`;
    },
    name: "admin_audit_recency",
  },
  {
    fn: async () => {
      if (SKIP_WRITE) return "skipped";
      // Prove write path works on a transient ephemeral row, then undo it.
      // Using a temp table keeps us from polluting real data even on staging.
      await db.execute(sql`CREATE TEMP TABLE _hc_write (n int)`);
      await db.execute(sql`INSERT INTO _hc_write VALUES (1)`);
      const rows = (await db.execute(
        sql`SELECT COUNT(*)::int AS n FROM _hc_write`,
      )) as unknown as Array<{ n: number }>;
      if (rows[0]?.n !== 1) throw new Error("temp_write_failed");
      return "write_round_trip=ok";
    },
    name: "temp_write_round_trip",
  },
];

async function main(): Promise<void> {
  const started = Date.now();
  let failed = 0;

  console.log(
    `[health-check] starting at ${new Date().toISOString()} (skip_write=${SKIP_WRITE})`,
  );
  for (const probe of probes) {
    const probeStart = Date.now();
    try {
      const detail = await probe.fn();
      const elapsed = Date.now() - probeStart;
      console.log(`  ok  ${probe.name} (${elapsed} ms) — ${detail}`);
    } catch (err) {
      const elapsed = Date.now() - probeStart;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL ${probe.name} (${elapsed} ms) — ${msg}`);
      failed += 1;
    }
  }

  const elapsed = Date.now() - started;
  console.log(
    `[health-check] finished in ${elapsed} ms — ${failed === 0 ? "PASS" : `FAIL (${failed} probe${failed === 1 ? "" : "s"})`}`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

await main();
