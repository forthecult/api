"use client";

import { Coins, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

import { getAdminApiBaseUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/card";

const API_BASE = getAdminApiBaseUrl();

interface SolanaSweepResult {
  configError?: string;
  dryRun: boolean;
  ok: boolean;
  ordersCount: number;
  recipient?: string;
  results: SweepOrderResult[];
  scope: SweepScope;
}

interface SweepOrderResult {
  depositAddress: string;
  error?: string;
  orderId: string;
  skipped?: string;
  solToSweepFormatted?: number;
  solToSweepLamports?: number;
  tokens?: TokenSweepItem[];
  txSignature?: string;
}

type SweepScope = "all" | "paid" | "pending";

interface TokenSweepItem {
  amount: string;
  amountFormatted: number;
  decimals: number;
  mint: string;
  symbol?: string;
}

export default function AdminSolanaPayPage() {
  const [loading, setLoading] = useState<
    `${SweepScope}-dry` | `${SweepScope}-sweep` | null
  >(null);
  const [paidResult, setPaidResult] = useState<null | SolanaSweepResult>(null);
  const [pendingResult, setPendingResult] = useState<null | SolanaSweepResult>(
    null,
  );
  const [paidError, setPaidError] = useState<null | string>(null);
  const [pendingError, setPendingError] = useState<null | string>(null);

  const runSweep = useCallback(async (scope: SweepScope, dryRun: boolean) => {
    const setResult = scope === "paid" ? setPaidResult : setPendingResult;
    const setError = scope === "paid" ? setPaidError : setPendingError;
    setError(null);
    setResult(null);
    setLoading(`${scope}-${dryRun ? "dry" : "sweep"}`);
    try {
      const res = await fetch(`${API_BASE}/api/admin/solana-sweep`, {
        body: JSON.stringify({ dryRun, scope }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data: SolanaSweepResult = await res.json();
      if (!res.ok) {
        setError(data.configError ?? `Request failed: ${res.status}`);
        setResult(null);
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setLoading(null);
    }
  }, []);

  const loadingPaid = loading?.startsWith("paid");
  const loadingPending = loading?.startsWith("pending");

  return (
    <>
      <div className="flex items-center gap-2">
        <Coins className="h-7 w-7" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Solana Pay – Sweep deposits
        </h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Sweep SOL and SPL tokens from order deposit addresses into your main
        wallet (NEXT_PUBLIC_SOLANA_PAY_RECIPIENT). Use <strong>Paid</strong> for
        confirmed orders (safe anytime). Use <strong>Pending</strong> only when
        no customer is on checkout. Budget ~0.00005–0.0001 SOL per order.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Paid orders</CardTitle>
          <CardDescription>
            Confirmed paid orders only. Safe to run anytime.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={loading !== null}
              onClick={() => void runSweep("paid", true)}
              variant="outline"
            >
              {loadingPaid && loading?.endsWith("dry") ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Dry run
            </Button>
            <Button
              disabled={loading !== null}
              onClick={() => void runSweep("paid", false)}
              variant="default"
            >
              {loadingPaid && loading?.endsWith("sweep") ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Sweep
            </Button>
          </div>
          {paidError && (
            <div
              className={`
                rounded-md border border-destructive/50 bg-destructive/10 px-4
                py-3 text-sm text-destructive
              `}
              role="alert"
            >
              {paidError}
            </div>
          )}
          {paidResult && <AdminSweepResultBlock result={paidResult} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending orders</CardTitle>
          <CardDescription>
            Unconfirmed orders (e.g. PUMP that wasn’t auto-confirmed). Only run
            when no customer is on the checkout page.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={loading !== null}
              onClick={() => void runSweep("pending", true)}
              variant="outline"
            >
              {loadingPending && loading?.endsWith("dry") ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Dry run
            </Button>
            <Button
              disabled={loading !== null}
              onClick={() => void runSweep("pending", false)}
              variant="default"
            >
              {loadingPending && loading?.endsWith("sweep") ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Sweep
            </Button>
          </div>
          {pendingError && (
            <div
              className={`
                rounded-md border border-destructive/50 bg-destructive/10 px-4
                py-3 text-sm text-destructive
              `}
              role="alert"
            >
              {pendingError}
            </div>
          )}
          {pendingResult && <AdminSweepResultBlock result={pendingResult} />}
        </CardContent>
      </Card>
    </>
  );
}

function AdminSweepResultBlock({ result }: { result: SolanaSweepResult }) {
  return (
    <div className="space-y-3">
      {result.configError && (
        <div
          className={`
            rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3
            text-sm text-destructive
          `}
          role="alert"
        >
          {result.configError}
        </div>
      )}
      {result.ok && result.recipient && (
        <p className="text-sm text-muted-foreground">
          Recipient:{" "}
          <code className="rounded bg-muted px-1">{result.recipient}</code>
          {result.ordersCount > 0 && <> · {result.ordersCount} order(s)</>}
        </p>
      )}
      {result.results.length > 0 && (
        <ul className="space-y-2 rounded-md border p-3 text-sm">
          {result.results.map((r) => (
            <SweepResultRow dryRun={result.dryRun} key={r.orderId} row={r} />
          ))}
        </ul>
      )}
      {result.ok && result.results.length === 0 && result.ordersCount === 0 && (
        <p className="text-sm text-muted-foreground">
          No orders with deposit addresses found.
        </p>
      )}
    </div>
  );
}

function SweepResultRow({
  dryRun,
  row,
}: {
  dryRun: boolean;
  row: SweepOrderResult;
}) {
  const hasWork =
    (row.solToSweepLamports != null && row.solToSweepLamports > 0) ||
    (row.tokens != null && row.tokens.length > 0);

  return (
    <li className="rounded border bg-muted/30 p-2">
      <div className="font-mono text-xs text-muted-foreground">
        Order {row.orderId.slice(0, 12)}…
      </div>
      {row.skipped && (
        <div className="text-muted-foreground">{row.skipped}</div>
      )}
      {hasWork && (
        <div className="mt-1 space-y-0.5">
          {row.solToSweepFormatted != null && row.solToSweepFormatted > 0 && (
            <div>
              {dryRun ? "Would sweep " : "Swept "}
              <strong>{row.solToSweepFormatted.toFixed(6)} SOL</strong>
            </div>
          )}
          {row.tokens?.map((t) => (
            <div key={t.mint}>
              {dryRun ? "Would sweep " : "Swept "}
              <strong>{t.amountFormatted}</strong>{" "}
              {t.symbol ?? `(mint ${t.mint.slice(0, 8)}…)`}
            </div>
          ))}
          {row.txSignature && (
            <div className="text-muted-foreground">
              Tx:{" "}
              <code className="text-xs">{row.txSignature.slice(0, 16)}…</code>
            </div>
          )}
          {row.error && <div className="text-destructive">{row.error}</div>}
        </div>
      )}
    </li>
  );
}
