"use client";

import { Coins, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

type TokenSweepItem = {
  mint: string;
  amount: string;
  decimals: number;
  amountFormatted: number;
};

type SweepOrderResult = {
  orderId: string;
  depositAddress: string;
  skipped?: string;
  solToSweepLamports?: number;
  solToSweepFormatted?: number;
  tokens?: TokenSweepItem[];
  txSignature?: string;
  error?: string;
};

type SolanaSweepResult = {
  ok: boolean;
  dryRun: boolean;
  configError?: string;
  recipient?: string;
  ordersCount: number;
  results: SweepOrderResult[];
};

export default function AdminSolanaPayPage() {
  const [loading, setLoading] = useState<"dry" | "sweep" | null>(null);
  const [result, setResult] = useState<SolanaSweepResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSweep = useCallback(async (dryRun: boolean) => {
    setError(null);
    setResult(null);
    setLoading(dryRun ? "dry" : "sweep");
    try {
      const res = await fetch(`${API_BASE}/api/admin/solana-sweep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
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

  return (
    <>
      <div className="flex items-center gap-2">
        <Coins className="h-7 w-7" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Solana Pay – Sweep deposits
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sweep to main wallet</CardTitle>
          <CardDescription>
            Move SOL and SPL tokens from paid Solana Pay order deposit addresses
            into your main wallet (NEXT_PUBLIC_SOLANA_PAY_RECIPIENT). Dry run
            only lists what would be swept; Sweep performs the transfers.
          </CardDescription>
          <p className="text-sm text-muted-foreground">
            <strong>Fees (gas):</strong> The fee payer wallet (
            <code className="rounded bg-muted px-1">SOLANA_SWEEP_FEE_PAYER_SECRET</code>
            ) pays in SOL. Budget ~0.00005–0.0001 SOL per order; for 10 orders
            keep ~0.001 SOL in the fee payer.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={loading !== null}
              onClick={() => void runSweep(true)}
            >
              {loading === "dry" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Dry run
            </Button>
            <Button
              variant="default"
              disabled={loading !== null}
              onClick={() => void runSweep(false)}
            >
              {loading === "sweep" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Sweep funds
            </Button>
          </div>

          {error && (
            <div
              className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              {result.configError && (
                <div
                  className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  role="alert"
                >
                  {result.configError}
                </div>
              )}
              {result.ok && result.recipient && (
                <p className="text-sm text-muted-foreground">
                  Recipient: <code className="rounded bg-muted px-1">{result.recipient}</code>
                  {result.ordersCount > 0 && (
                    <> · {result.ordersCount} paid order(s) with deposit addresses</>
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
                <p className="text-sm text-muted-foreground">
                  No paid Solana Pay orders with deposit addresses found.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
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
              <strong>{t.amountFormatted}</strong> (mint {t.mint.slice(0, 8)}…)
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
