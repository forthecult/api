"use client";

import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useSolanaConnection, useSolanaWallet } from "~/app/checkout/crypto/solana-wallet-stub";
import {
  type Connection,
  type RpcResponseAndContext,
  type TokenAmount,
  PublicKey,
} from "@solana/web3.js";
import { ArrowDown } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useStakeTransaction } from "~/hooks/use-stake-transaction";
import {
  buildSwapCultToSol,
  buildSwapSolToCult,
  estimateCultFromSol,
  estimateSolFromCult,
} from "~/lib/pump-swap-cult";
import { CULT_MINT_MAINNET, TOKEN_2022_PROGRAM_ID_BASE58 } from "~/lib/token-config";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";

const CULT_DECIMALS = 6;

export function CultSwapBlock() {
  const { connection } = useSolanaConnection();
  const { publicKey, sendTransaction } = useSolanaWallet();
  const { openConnectModal, wallet: connectedWallet } = useStakeTransaction();
  const wallet = publicKey?.toBase58() ?? null;
  const conn = connection as Connection | undefined;
  const pk = publicKey ? new PublicKey(publicKey.toBase58()) : null;

  const [tokenSymbol, setTokenSymbol] = useState("CULT");
  const [swapDirection, setSwapDirection] = useState<"solToCult" | "cultToSol">("solToCult");
  const [solBalanceLamports, setSolBalanceLamports] = useState<number>(0);
  const [solAmount, setSolAmount] = useState("");
  const [cultAmount, setCultAmount] = useState("");
  const [estimatedCult, setEstimatedCult] = useState<null | string>(null);
  const [estimatedSol, setEstimatedSol] = useState<null | string>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [swapPending, setSwapPending] = useState(false);
  const [cultBalance, setCultBalance] = useState<string | null>(null);
  const [cultBalanceLoading, setCultBalanceLoading] = useState(false);

  const solBalanceSol = solBalanceLamports / 1e9;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/governance/token-price")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { data?: { token?: { symbol?: string } } } | null) => {
        if (!cancelled && data?.data?.token?.symbol) setTokenSymbol(data.data.token.symbol);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!pk || !conn) {
      setSolBalanceLamports(0);
      return;
    }
    let cancelled = false;
    conn.getBalance(pk).then((bal) => {
      if (!cancelled) setSolBalanceLamports(bal);
    }).catch(() => {
      if (!cancelled) setSolBalanceLamports(0);
    });
    return () => { cancelled = true; };
  }, [pk, conn]);

  useEffect(() => {
    if (!wallet) {
      setCultBalance(null);
      return;
    }
    setCultBalanceLoading(true);
    if (conn && pk) {
      let cancelled = false;
      const mint = new PublicKey(CULT_MINT_MAINNET);
      const programs = [
        new PublicKey(TOKEN_2022_PROGRAM_ID_BASE58),
        new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      ];
      const tryNext = (i: number) => {
        if (cancelled || i >= programs.length) {
          if (!cancelled) {
            setCultBalance(null);
            setCultBalanceLoading(false);
          }
          return;
        };
        const ata = getAssociatedTokenAddressSync(
          mint,
          pk,
          false,
          programs[i]!,
        );
        conn
          .getTokenAccountBalance(ata)
          .then((info: RpcResponseAndContext<TokenAmount>) => {
            if (cancelled) return;
            const v = info.value;
            const balance =
              v.uiAmountString != null && v.uiAmountString !== ""
                ? v.uiAmountString
                : v.amount === "0"
                  ? "0"
                  : (Number(v.amount) / 10 ** v.decimals).toFixed(v.decimals);
            setCultBalance(balance);
            setCultBalanceLoading(false);
          })
          .catch(() => tryNext(i + 1));
      };
      tryNext(0);
      return () => { cancelled = true; };
    }
    let cancelled = false;
    fetch(`/api/governance/wallet-balance?wallet=${encodeURIComponent(wallet)}`)
      .then((r) => r.json())
      .then((data: { balance?: string }) => {
        if (!cancelled) setCultBalance(data.balance ?? "0");
      })
      .catch(() => {
        if (!cancelled) setCultBalance(null);
      })
      .finally(() => {
        if (!cancelled) setCultBalanceLoading(false);
      });
    return () => { cancelled = true; };
  }, [wallet, conn, pk]);

  useEffect(() => {
    if (swapDirection !== "solToCult") {
      setEstimatedCult(null);
      return;
    }
    const solAmountNum = Number.parseFloat(solAmount);
    if (!Number.isFinite(solAmountNum) || solAmountNum <= 0) {
      setEstimatedCult(null);
      return;
    }
    const solLamports = Math.floor(solAmountNum * 1e9);
    if (solLamports <= 0) {
      setEstimatedCult(null);
      return;
    }
    let cancelled = false;
    setEstimateLoading(true);
    const setResult = (est: string | null) => {
      if (!cancelled) {
        setEstimatedCult(est);
        setEstimateLoading(false);
      }
    };
    const apiPromise = fetch(
      `/api/swap/sol-cult/estimate?solAmount=${encodeURIComponent(solAmountNum)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { cultAmount?: string } | null) => data?.cultAmount ?? null)
      .catch(() => null);
    const clientPromise =
      conn != null
        ? estimateCultFromSol(conn, solLamports)
            .then((est) => est?.cultAmount ?? null)
            .catch(() => null)
        : Promise.resolve(null);
    const priceFallbackPromise = fetch("/api/crypto/prices")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { CULT?: number; SOL?: number } | null) => {
        if (!data?.SOL || !data?.CULT || data.CULT <= 0) return null;
        const cultAmount = (solAmountNum * data.SOL) / data.CULT;
        return cultAmount.toFixed(6);
      })
      .catch(() => null);
    void Promise.all([apiPromise, clientPromise]).then(([apiVal, clientVal]) => {
      if (cancelled) return;
      const val = apiVal ?? clientVal ?? null;
      if (val != null) {
        setResult(val);
        return;
      }
      void priceFallbackPromise.then((priceVal) => {
        if (!cancelled) setResult(priceVal ?? null);
      });
    });
    return () => { cancelled = true; };
  }, [solAmount, conn, swapDirection]);

  useEffect(() => {
    if (swapDirection !== "cultToSol") {
      setEstimatedSol(null);
      return;
    }
    const n = Number.parseFloat(cultAmount);
    if (!Number.isFinite(n) || n <= 0) {
      setEstimatedSol(null);
      return;
    }
    const cultRaw = Math.floor(n * 10 ** CULT_DECIMALS).toString();
    if (cultRaw === "0") {
      setEstimatedSol(null);
      return;
    }
    let cancelled = false;
    setEstimateLoading(true);
    const setResult = (est: string | null) => {
      if (!cancelled) {
        setEstimatedSol(est);
        setEstimateLoading(false);
      }
    };
    const apiPromise = fetch(
      `/api/swap/cult-sol/estimate?cultAmount=${encodeURIComponent(n)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { solAmount?: string } | null) => data?.solAmount ?? null)
      .catch(() => null);
    const clientPromise =
      conn != null
        ? estimateSolFromCult(conn, cultRaw)
            .then((est) => est?.solAmount ?? null)
            .catch(() => null)
        : Promise.resolve(null);
    const priceFallbackPromise = fetch("/api/crypto/prices")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { CULT?: number; SOL?: number } | null) => {
        if (!data?.SOL || !data?.CULT || data.SOL <= 0) return null;
        const solAmount = (n * data.CULT) / data.SOL;
        return solAmount.toFixed(6);
      })
      .catch(() => null);
    void Promise.all([apiPromise, clientPromise]).then(([apiVal, clientVal]) => {
      if (cancelled) return;
      const val = apiVal ?? clientVal ?? null;
      if (val != null) {
        setResult(val);
        return;
      }
      void priceFallbackPromise.then((priceVal) => {
        if (!cancelled) setResult(priceVal ?? null);
      });
    });
    return () => { cancelled = true; };
  }, [cultAmount, conn, swapDirection]);

  const handleSwapSolToCult = useCallback(async () => {
    if (!pk || !conn || !sendTransaction) {
      toast.error("Connect your wallet first");
      return;
    }
    const solAmountNum = Number.parseFloat(solAmount);
    if (!Number.isFinite(solAmountNum) || solAmountNum <= 0) return;
    const solLamports = Math.floor(solAmountNum * 1e9);
    setSwapPending(true);
    try {
      const { transaction } = await buildSwapSolToCult(conn, pk, solLamports);
      const sig = await sendTransaction(transaction, conn, {
        preflightCommitment: "confirmed",
        skipPreflight: false,
      });
      toast.success("Swap submitted: " + sig.slice(0, 8) + "…");
      setSolAmount("");
      setEstimatedCult(null);
      setTimeout(() => {
        fetch(`/api/governance/wallet-balance?wallet=${encodeURIComponent(pk.toBase58())}`)
          .then((r) => r.json())
          .then((d: { balance?: string }) => setCultBalance(d.balance ?? "0"))
          .catch(() => {});
      }, 2000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Swap failed");
    }
    setSwapPending(false);
  }, [pk, conn, sendTransaction, solAmount]);

  const handleSwapCultToSol = useCallback(async () => {
    if (!pk || !conn || !sendTransaction) {
      openConnectModal?.();
      return;
    }
    const n = Number.parseFloat(cultAmount);
    if (!Number.isFinite(n) || n <= 0) return;
    const cultRaw = Math.floor(n * 10 ** CULT_DECIMALS).toString();
    setSwapPending(true);
    try {
      const { transaction } = await buildSwapCultToSol(conn, pk, cultRaw);
      const sig = await sendTransaction(transaction, conn, {
        preflightCommitment: "confirmed",
        skipPreflight: false,
      });
      toast.success("Swap submitted: " + sig.slice(0, 8) + "…");
      setCultAmount("");
      setEstimatedSol(null);
      setTimeout(() => {
        fetch(`/api/governance/wallet-balance?wallet=${encodeURIComponent(pk.toBase58())}`)
          .then((r) => r.json())
          .then((d: { balance?: string }) => setCultBalance(d.balance ?? "0"))
          .catch(() => {});
      }, 2000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Swap failed");
    }
    setSwapPending(false);
  }, [pk, conn, sendTransaction, cultAmount, openConnectModal]);

  const handleSwapDirectionFlip = useCallback(() => {
    setSwapDirection((d) => (d === "solToCult" ? "cultToSol" : "solToCult"));
    setSolAmount("");
    setCultAmount("");
    setEstimatedCult(null);
    setEstimatedSol(null);
  }, []);

  return (
    <section
      className="py-16 md:py-20"
      id="swap"
    >
      <div className="mx-auto max-w-xl">
        <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
          CULT Swap
        </h2>
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="space-y-3 p-6">
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Sell
              </p>
              <div className="flex items-center gap-2">
                <Input
                  className="font-mono text-lg"
                  min={0}
                  onChange={(e) =>
                    swapDirection === "solToCult"
                      ? setSolAmount(e.target.value)
                      : setCultAmount(e.target.value)
                  }
                  placeholder="0.00"
                  step="any"
                  type="number"
                  value={swapDirection === "solToCult" ? solAmount : cultAmount}
                />
                <div className="flex min-w-[100px] items-center justify-end gap-2 rounded-lg border border-border bg-background px-3 py-2 font-medium">
                  {swapDirection === "solToCult" ? (
                    <>
                      <Image alt="SOL" height={24} src="/crypto/solana/solanaLogoMark.svg" width={24} />
                      SOL
                    </>
                  ) : (
                    <>
                      <Image alt={tokenSymbol} height={24} src="/crypto/cult/cult-logo.svg" width={24} />
                      {tokenSymbol}
                    </>
                  )}
                </div>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {swapDirection === "solToCult"
                  ? publicKey
                    ? `Balance: ${solBalanceSol.toFixed(4)} SOL`
                    : "Connect wallet to see balance"
                  : wallet
                    ? cultBalanceLoading
                      ? "Loading…"
                      : `Balance: ${cultBalance != null ? Number(cultBalance).toLocaleString(undefined, { maximumFractionDigits: 6 }) : "0"} ${tokenSymbol}`
                    : "Connect wallet to see balance"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {swapDirection === "solToCult" ? (
                  <>
                    <Button onClick={() => setSolAmount("")} size="sm" type="button" variant="secondary">
                      Reset
                    </Button>
                    {[0.1, 0.5, 1].map((n) => (
                      <Button
                        key={n}
                        disabled={!publicKey || solBalanceSol < n}
                        onClick={() => setSolAmount(String(n))}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        {n} SOL
                      </Button>
                    ))}
                    {publicKey && solBalanceSol > 0.01 && (
                      <Button
                        onClick={() => setSolAmount(Math.max(0, solBalanceSol - 0.01).toFixed(6))}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Max
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button onClick={() => setCultAmount("")} size="sm" type="button" variant="secondary">
                      Reset
                    </Button>
                    {[25, 50, 75, 100].map((pct) => (
                      <Button
                        key={pct}
                        disabled={
                          !wallet ||
                          cultBalance == null ||
                          Number(cultBalance) <= 0
                        }
                        onClick={() => {
                          const bal = Number(cultBalance);
                          if (!Number.isFinite(bal) || bal <= 0) return;
                          const value = (bal * pct) / 100;
                          setCultAmount(value.toFixed(6));
                        }}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        {pct}%
                      </Button>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                aria-label="Flip swap direction"
                className="h-10 w-10 rounded-full"
                onClick={handleSwapDirectionFlip}
                size="icon"
                type="button"
                variant="outline"
              >
                <ArrowDown className="h-5 w-5" />
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Buy
              </p>
              <div className="flex items-center gap-2">
                <div className="font-mono flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-lg text-foreground">
                  {estimateLoading
                    ? "…"
                    : swapDirection === "solToCult"
                      ? solAmount.trim() && Number.parseFloat(solAmount) > 0
                        ? estimatedCult ?? "—"
                        : "0"
                      : cultAmount.trim() && Number.parseFloat(cultAmount) > 0
                        ? estimatedSol ?? "—"
                        : "0"}
                </div>
                <div className="flex min-w-[100px] items-center justify-end gap-2 rounded-lg border border-border bg-background px-3 py-2 font-medium">
                  {swapDirection === "solToCult" ? (
                    <>
                      <Image alt={tokenSymbol} height={24} src="/crypto/cult/cult-logo.svg" width={24} />
                      {tokenSymbol}
                    </>
                  ) : (
                    <>
                      <Image alt="SOL" height={24} src="/crypto/solana/solanaLogoMark.svg" width={24} />
                      SOL
                    </>
                  )}
                </div>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {swapDirection === "solToCult"
                  ? wallet
                    ? cultBalanceLoading
                      ? "Balance: …"
                      : `Balance: ${cultBalance != null ? Number(cultBalance).toLocaleString(undefined, { maximumFractionDigits: 6 }) : "0"} ${tokenSymbol}`
                    : "Connect wallet to see balance"
                  : publicKey
                    ? `Balance: ${solBalanceSol.toFixed(4)} SOL`
                    : "Connect wallet to see balance"}
              </p>
            </div>

            <Button
              className="w-full"
              disabled={
                swapPending ||
                !!(publicKey &&
                  (swapDirection === "solToCult"
                    ? !solAmount.trim() || Number.parseFloat(solAmount) <= 0
                    : !cultAmount.trim() || Number.parseFloat(cultAmount) <= 0))
              }
              onClick={() => {
                if (!publicKey || !sendTransaction) {
                  openConnectModal?.();
                  return;
                }
                if (swapDirection === "solToCult") void handleSwapSolToCult();
                else void handleSwapCultToSol();
              }}
              size="lg"
            >
              {!publicKey
                ? "Connect wallet to swap"
                : swapPending
                  ? "Swapping…"
                  : swapDirection === "solToCult"
                    ? "Swap SOL → CULT"
                    : `Swap ${tokenSymbol} → SOL`}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
