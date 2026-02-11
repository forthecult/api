"use client";

import { Coins, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

import type { SolanaSweepResult, SweepOrderResult, SweepScope } from "~/lib/solana-sweep";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/ui/primitives/card";
import { Alert, AlertDescription } from "~/ui/primitives/alert";

export function SolanaSweepPageClient() {
  const [loading, setLoading] = useState<`${SweepScope}-dry` | `${SweepScope}-sweep` | null>(null);
  const [paidResult, setPaidResult] = useState<SolanaSweepResult | null>(null);
  const [pendingResult, setPendingResult] = useState<SolanaSweepResult | null>(null);
  const [paidError, setPaidError] = useState<string | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const runSweep = useCallback(async (scope: SweepScope, dryRun: boolean) => {
    const setResult = scope === "paid" ? setPaidResult : setPendingResult;
    const setError = scope === "paid" ? setPaidError : setPendingError;
    setError(null);
    setResult(null);
    setLoading(`${scope}-${dryRun ? "dry" : "sweep"}`);
    try {
      const res = await fetch("/api/admin/solana-sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, scope }),
        credentials: "include",
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
        wallet (NEXT_PUBLIC_SOLANA_PAY_RECIPIENT). Use <strong>Paid</strong>{" "}
        for confirmed orders (safe anytime). Use <strong>Pending</strong> only
        when no customer is on checkout to avoid racing their payment. Fee
        payer: <code className="rounded bg-muted px-1">SOLANA_SWEEP_FEE_PAYER_SECRET</code>; budget
        ~0.00005–0.0001 SOL per order.
      </p>

      {/* Paid orders — safe to run anytime */}
      <Card>
        <CardHeader>
          <CardTitle>Paid orders</CardTitle>
          <CardDescription>
            Confirmed paid orders only. Safe to run anytime; no race with
            customers paying.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={loading !== null}
              onClick={() => void runSweep("paid", true)}
            >
              {loadingPaid && loading?.endsWith("dry") ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Dry run
            </Button>
            <Button
              variant="default"
              disabled={loading !== null}
              onClick={() => void runSweep("paid", false)}
            >
              {loadingPaid && loading?.endsWith("sweep") ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Sweep
            </Button>
          </div>
          {paidError && (
            <Alert variant="destructive">
              <AlertDescription>{paidError}</AlertDescription>
            </Alert>
          )}
          {paidResult && (
            <SweepResultBlock result={paidResult} />
          )}
        </CardContent>
      </Card>

      {/* Pending orders — run only when no one is on checkout */}
      <Card>
        <CardHeader>
          <CardTitle>Pending orders</CardTitle>
          <CardDescription>
            Unconfirmed orders (e.g. Token-2022 like PUMP that wasn’t
            auto-confirmed). Only run when no customer is on the checkout page
            to avoid sweeping while they are paying.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={loading !== null}
              onClick={() => void runSweep("pending", true)}
            >
              {loadingPending && loading?.endsWith("dry") ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Dry run
            </Button>
            <Button
              variant="default"
              disabled={loading !== null}
              onClick={() => void runSweep("pending", false)}
            >
              {loadingPending && loading?.endsWith("sweep") ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Sweep
            </Button>
          </div>
          {pendingError && (
            <Alert variant="destructive">
              <AlertDescription>{pendingError}</AlertDescription>
            </Alert>
          )}
          {pendingResult && (
            <SweepResultBlock result={pendingResult} />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function SweepResultBlock({ result }: { result: SolanaSweepResult }) {
  return (
    <div className="space-y-3">
      {result.configError && (
        <Alert variant="destructive">
          <AlertDescription>{result.configError}</AlertDescription>
        </Alert>
      )}
      {result.ok && result.recipient && (
        <p className="text-sm text-muted-foreground">
          Recipient: <code className="rounded bg-muted px-1">{result.recipient}</code>
          {result.ordersCount > 0 && (
            <> · {result.ordersCount} order(s)</>
          )}
        </p>
      )}
      {result.results.length > 0 && (
        <ul className="space-y-2 rounded-md border p-3 text-sm">
          {result.results.map((r) => (
            <SweepResultRow
              key={r.orderId}
              row={r}
              dryRun={result.dryRun}
            />
          ))}
        </ul>
      )}
      {result.ok && result.results.length === 0 && result.ordersCount === 0 && (
        <p className="text-sm text-muted-foreground">No orders with deposit addresses found.</p>
      )}
    </div>
  );
}

function SweepResultRow({
  row,
  dryRun,
}: {
  row: SweepOrderResult;
  dryRun: boolean;
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
              Tx: <code className="text-xs">{row.txSignature.slice(0, 16)}…</code>
            </div>
          )}
          {row.error && (
            <div className="text-destructive">{row.error}</div>
          )}
        </div>
      )}
    </li>
  );
}
