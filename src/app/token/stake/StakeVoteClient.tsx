"use client";

import { type Connection, PublicKey } from "@solana/web3.js";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  RefreshCw,
  Vote,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  useSolanaConnection,
  useSolanaWallet,
} from "~/app/checkout/crypto/solana-wallet-stub";
import { useStakeTransaction } from "~/hooks/use-stake-transaction";
import { LOCK_12_MONTHS, LOCK_30_DAYS } from "~/lib/cult-staking";
import { formatDateTime, formatPower } from "~/lib/format";
import { buildSwapSolToCult, estimateCultFromSol } from "~/lib/pump-swap-cult";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Skeleton } from "~/ui/primitives/skeleton";

// ─── Constants ──────────────────────────────────────────────────────

const CULT_DECIMALS = 6;
const LAMPORTS_PER_SOL = 1e9;
/** Show "Get CULT" when wallet CULT balance is below this (raw units). 0.01 CULT = 10_000. */
const GET_CULT_THRESHOLD_RAW = 10_000;
const SEND_OPTS = {
  preflightCommitment: "confirmed" as const,
  skipPreflight: false,
};

// ─── Types ──────────────────────────────────────────────────────────

interface Proposal {
  createdAt: string;
  createdBy: null | string;
  description: string;
  endAt: string;
  id: string;
  startAt: string;
  status: string;
  title: string;
  updatedAt: string;
}

interface ProposalCardProps {
  detail: ProposalDetail | undefined;
  onVote: (proposalId: string, choice: "abstain" | "against" | "for") => void;
  openConnectModal: () => void;
  proposal: Proposal;
  votingId: null | string;
  wallet: null | string;
}

// ─── StakeForm ──────────────────────────────────────────────────────

type ProposalDetail = Proposal & {
  totals: { abstain: number; against: number; for: number };
  userVote: null | { choice: string; votingPower: number };
};

interface StakeFormProps {
  currentLockTier: null | number;
  openConnectModal: () => void;
  refreshBalances: () => void;
  stake: (amount: string, lockDuration: number) => Promise<boolean>;
  stakePending: boolean;
  unstake: (lockTier: number) => Promise<boolean>;
  unstakePending: boolean;
  wallet: null | string;
}

// ─── ProposalCard ───────────────────────────────────────────────────

export function StakeVoteClient() {
  const { connection } = useSolanaConnection();
  const { publicKey, sendTransaction } = useSolanaWallet();
  const conn = connection as Connection | undefined;
  const pk = publicKey ? new PublicKey(publicKey.toBase58()) : null;
  const {
    openConnectModal,
    stake,
    stakePending,
    unstake,
    unstakePending,
    wallet,
  } = useStakeTransaction();

  const [votingPower, setVotingPower] = useState<null | number>(null);
  const [walletBalanceRaw, setWalletBalanceRaw] = useState<null | number>(null);
  const [stakedBalanceRaw, setStakedBalanceRaw] = useState<null | number>(null);
  const [currentLockTier, setCurrentLockTier] = useState<null | number>(null);
  const [votingPowerLoading, setVotingPowerLoading] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [details, setDetails] = useState<Record<string, ProposalDetail>>({});
  const [votingId, setVotingId] = useState<null | string>(null);

  // Get CULT (swap SOL → CULT) state
  const [solBalanceLamports, setSolBalanceLamports] = useState<number>(0);
  const [solAmount, setSolAmount] = useState("");
  const [estimatedCult, setEstimatedCult] = useState<null | string>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [swapPending, setSwapPending] = useState(false);

  const refreshBalances = useCallback(() => {
    if (!wallet) return;
    setVotingPowerLoading(true);
    Promise.all([
      fetch(
        `/api/governance/voting-power?wallet=${encodeURIComponent(wallet)}`,
      ).then((r) => r.json()),
      fetch(
        `/api/governance/staked-balance?wallet=${encodeURIComponent(wallet)}`,
      ).then((r) => r.json()),
    ])
      .then(([powerRaw, stakedRaw]) => {
        const powerData = powerRaw as {
          stakedBalanceRaw?: string;
          votingPowerRaw?: string;
          walletBalanceRaw?: string;
        };
        const stakedData = stakedRaw as {
          lock?: { lockTier?: null | number };
        };
        const total = powerData.votingPowerRaw
          ? BigInt(powerData.votingPowerRaw)
          : 0n;
        const walletRaw = powerData.walletBalanceRaw
          ? BigInt(powerData.walletBalanceRaw)
          : 0n;
        const stakedFromPower = powerData.stakedBalanceRaw
          ? BigInt(powerData.stakedBalanceRaw)
          : 0n;
        setVotingPower(Number(total));
        setWalletBalanceRaw(Number(walletRaw));
        setStakedBalanceRaw(Number(stakedFromPower));
        setCurrentLockTier(stakedData.lock?.lockTier ?? null);
      })
      .catch(() => {
        setVotingPower(0);
        setWalletBalanceRaw(0);
        setStakedBalanceRaw(0);
        setCurrentLockTier(null);
      })
      .finally(() => setVotingPowerLoading(false));
  }, [wallet]);

  // Fetch balances when wallet changes
  useEffect(() => {
    if (!wallet) {
      setVotingPower(null);
      setWalletBalanceRaw(null);
      setStakedBalanceRaw(null);
      setSolBalanceLamports(0);
      return;
    }
    refreshBalances();
  }, [wallet, refreshBalances]);

  // Fetch SOL balance when wallet changes (for Get CULT)
  useEffect(() => {
    if (!pk || !conn) return;
    conn
      .getBalance(pk)
      .then(setSolBalanceLamports)
      .catch(() => setSolBalanceLamports(0));
  }, [conn, pk]);

  // Estimate CULT when SOL amount changes (debounced)
  useEffect(() => {
    const raw = solAmount.trim();
    const solNum = Number.parseFloat(raw);
    if (!raw || !Number.isFinite(solNum) || solNum <= 0) {
      setEstimatedCult(null);
      return;
    }
    const lamports = Math.floor(solNum * LAMPORTS_PER_SOL);
    if (lamports <= 0) {
      setEstimatedCult(null);
      return;
    }
    let cancelled = false;
    setEstimateLoading(true);
    if (!conn) {
      setEstimateLoading(false);
      return () => {
        cancelled = true;
      };
    }
    estimateCultFromSol(conn, lamports)
      .then((res) => {
        if (!cancelled && res) setEstimatedCult(res.cultAmount);
        else if (!cancelled) setEstimatedCult(null);
      })
      .catch(() => {
        if (!cancelled) setEstimatedCult(null);
      })
      .finally(() => {
        if (!cancelled) setEstimateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conn, solAmount]);

  // Fetch proposals on mount
  useEffect(() => {
    let cancelled = false;
    setProposalsLoading(true);
    fetch("/api/governance/proposals")
      .then((r) => r.json())
      .then((raw: unknown) => {
        const data = raw as { proposals?: Proposal[] };
        if (!cancelled && data.proposals) setProposals(data.proposals ?? []);
      })
      .catch(() => {
        if (!cancelled) setProposals([]);
      })
      .finally(() => {
        if (!cancelled) setProposalsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchProposalDetail = useCallback(
    async (id: string) => {
      const url = wallet
        ? `/api/governance/proposals/${id}?wallet=${encodeURIComponent(wallet)}`
        : `/api/governance/proposals/${id}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        proposal: Proposal;
        totals: { abstain: number; against: number; for: number };
        userVote: null | { choice: string; votingPower: number };
      };
      setDetails((prev) => ({
        ...prev,
        [id]: {
          ...data.proposal,
          totals: data.totals,
          userVote: data.userVote,
        },
      }));
      return data;
    },
    [wallet],
  );

  // Fetch details for each proposal
  useEffect(() => {
    for (const p of proposals) {
      void fetchProposalDetail(p.id);
    }
  }, [proposals, fetchProposalDetail]);

  const vote = useCallback(
    async (proposalId: string, choice: "abstain" | "against" | "for") => {
      if (!wallet) {
        openConnectModal();
        return;
      }
      setVotingId(proposalId);
      try {
        const res = await fetch(
          `/api/governance/proposals/${proposalId}/vote`,
          {
            body: JSON.stringify({ choice, wallet }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok) {
          toast.error(data.error ?? "Failed to vote");
          return;
        }
        toast.success("Vote recorded");
        await fetchProposalDetail(proposalId);
      } finally {
        setVotingId(null);
      }
    },
    [wallet, openConnectModal, fetchProposalDetail],
  );

  const totalPower =
    votingPower !== null ? votingPower / 10 ** CULT_DECIMALS : 0;
  const walletPower =
    walletBalanceRaw !== null ? walletBalanceRaw / 10 ** CULT_DECIMALS : 0;
  const stakedPower =
    stakedBalanceRaw !== null ? stakedBalanceRaw / 10 ** CULT_DECIMALS : 0;

  const showGetCult =
    !!wallet &&
    (walletBalanceRaw === null || walletBalanceRaw < GET_CULT_THRESHOLD_RAW);
  const solBalanceSol = solBalanceLamports / LAMPORTS_PER_SOL;

  const handleSwapSolToCult = useCallback(async () => {
    if (!pk || !conn || !sendTransaction) {
      openConnectModal();
      return;
    }
    const raw = solAmount.trim();
    const solNum = Number.parseFloat(raw);
    if (!Number.isFinite(solNum) || solNum <= 0) {
      toast.error("Enter a positive SOL amount");
      return;
    }
    const lamports = Math.floor(solNum * LAMPORTS_PER_SOL);
    if (lamports <= 0) {
      toast.error("Amount too small");
      return;
    }
    if (lamports > solBalanceLamports) {
      toast.error("Insufficient SOL balance");
      return;
    }
    setSwapPending(true);
    try {
      const { transaction } = await buildSwapSolToCult(conn, pk, lamports);
      const sig = await sendTransaction(transaction, conn, SEND_OPTS);
      toast.success(`Swap submitted: ${sig.slice(0, 8)}…`);
      setSolAmount("");
      setEstimatedCult(null);
      await refreshBalances();
      conn.getBalance(pk).then(setSolBalanceLamports);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Swap failed");
    } finally {
      setSwapPending(false);
    }
  }, [
    conn,
    pk,
    sendTransaction,
    solAmount,
    solBalanceLamports,
    openConnectModal,
    refreshBalances,
  ]);

  return (
    <div
      className={`
        container mx-auto flex max-w-7xl flex-col gap-10 px-4 py-10
        sm:px-6
        lg:px-8
      `}
    >
      {/* Voting power card */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div
            className={`
              flex flex-col gap-4
              sm:flex-row sm:items-center sm:justify-between
            `}
          >
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Vote className="h-5 w-5 text-primary" />
                Your voting power
              </CardTitle>
              <CardDescription>
                Voting power = CULT in your wallet + CULT staked on-chain.
                Connect your Solana wallet to stake and vote.
              </CardDescription>
            </div>
            {!wallet ? (
              <Button className="gap-2" onClick={openConnectModal}>
                <Wallet className="h-4 w-4" />
                Connect wallet
              </Button>
            ) : (
              <div
                className={`
                  flex items-center gap-2 rounded-lg border border-border
                  bg-muted/30 px-4 py-2
                `}
              >
                {votingPowerLoading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <span className="font-mono text-lg font-semibold">
                    {totalPower.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 0,
                    })}{" "}
                    CULT
                  </span>
                )}
              </div>
            )}
          </div>
          {wallet && (
            <CardContent className="pt-0">
              <div
                className={`flex flex-wrap gap-4 text-sm text-muted-foreground`}
              >
                <span>
                  Wallet:{" "}
                  {votingPowerLoading ? (
                    "…"
                  ) : (
                    <span className="font-medium text-foreground">
                      {walletPower.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 0,
                      })}{" "}
                      CULT
                    </span>
                  )}
                </span>
                <span>
                  Staked:{" "}
                  {votingPowerLoading ? (
                    "…"
                  ) : (
                    <span className="font-medium text-foreground">
                      {stakedPower.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 0,
                      })}{" "}
                      CULT
                    </span>
                  )}
                </span>
              </div>
            </CardContent>
          )}
        </CardHeader>
      </Card>

      {/* Get CULT: swap SOL → CULT when user has no / very low CULT */}
      {showGetCult && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <RefreshCw className="h-5 w-5 text-primary" />
              Get CULT
            </CardTitle>
            <CardDescription>
              Swap SOL for CULT on PumpSwap to stake and vote. You need a small
              amount of SOL for transaction fees.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">SOL amount</label>
              <div className="flex gap-2">
                <Input
                  className="font-mono"
                  min={0}
                  onChange={(e) => setSolAmount(e.target.value)}
                  placeholder="0"
                  step="any"
                  type="number"
                  value={solAmount}
                />
                <Button
                  disabled={swapPending}
                  onClick={() =>
                    setSolAmount(Math.max(0, solBalanceSol - 0.01).toFixed(6))
                  }
                  type="button"
                  variant="secondary"
                >
                  Max
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Balance: {solBalanceSol.toFixed(4)} SOL
              </p>
            </div>
            {estimateLoading && solAmount.trim() && (
              <p className="text-sm text-muted-foreground">Estimating…</p>
            )}
            {!estimateLoading && estimatedCult != null && (
              <p className="text-sm font-medium text-foreground">
                You will receive ≈ {estimatedCult} CULT (before slippage)
              </p>
            )}
            <Button
              disabled={
                swapPending ||
                !solAmount.trim() ||
                Number.parseFloat(solAmount) <= 0 ||
                (estimatedCult == null && !!solAmount.trim())
              }
              onClick={() => void handleSwapSolToCult()}
            >
              {swapPending ? "Swapping…" : "Swap SOL → CULT"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* On-chain staking — always visible; connect wallet to use */}
      <StakeForm
        currentLockTier={currentLockTier}
        openConnectModal={openConnectModal}
        refreshBalances={refreshBalances}
        stake={stake}
        stakePending={stakePending}
        unstake={unstake}
        unstakePending={unstakePending}
        wallet={wallet}
      />

      {/* Proposals */}
      <div>
        <h2 className="font-display mb-4 text-2xl font-semibold text-foreground">
          Proposals
        </h2>
        {proposalsLoading ? (
          <div className="flex flex-col gap-4">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : proposals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent
              className={`
                flex flex-col items-center justify-center py-12 text-center
              `}
            >
              <Clock className="mb-2 h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">No proposals yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Community proposals will appear here. Check back soon.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {proposals.map((p) => (
              <ProposalCard
                detail={details[p.id]}
                key={p.id}
                onVote={vote}
                openConnectModal={openConnectModal}
                proposal={p}
                votingId={votingId}
                wallet={wallet}
              />
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-2 text-center">
        <Link href="/token">
          <Button className="gap-2" variant="outline">
            About CULT token
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <p className="text-sm text-muted-foreground">
          Fair launch on{" "}
          <a
            className={`
              inline-flex items-center gap-0.5 text-primary
              hover:underline
            `}
            href="https://pump.fun"
            rel="noopener noreferrer"
            target="_blank"
          >
            pump.fun
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </p>
      </div>
    </div>
  );
}

function ProposalCard({
  detail,
  onVote,
  openConnectModal,
  proposal,
  votingId,
  wallet,
}: ProposalCardProps) {
  const isActive = proposal.status === "active";
  const totalVotes = detail
    ? detail.totals.for + detail.totals.against + detail.totals.abstain
    : 0;
  const forPct =
    totalVotes > 0 && detail ? (detail.totals.for / totalVotes) * 100 : 0;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-lg">{proposal.title}</CardTitle>
          <span
            className={`
              rounded-full px-2.5 py-0.5 text-xs font-medium
              ${
                isActive
                  ? `
                    bg-green-500/15 text-green-700
                    dark:text-green-400
                  `
                  : `bg-muted text-muted-foreground`
              }
            `}
          >
            {isActive ? "Active" : "Ended"}
          </span>
        </div>
        <CardDescription className="whitespace-pre-wrap">
          {proposal.description}
        </CardDescription>
        <p className="text-xs text-muted-foreground">
          Ends: {formatDateTime(proposal.endAt)}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {detail && (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  For {formatPower(detail.totals.for, CULT_DECIMALS)} · Against{" "}
                  {formatPower(detail.totals.against, CULT_DECIMALS)}
                  {detail.totals.abstain > 0 &&
                    ` · Abstain ${formatPower(detail.totals.abstain, CULT_DECIMALS)}`}
                </span>
              </div>
              <div
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={forPct}
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                title={`For ${forPct.toFixed(0)}%`}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${forPct}%` }}
                />
              </div>
            </div>
            {detail.userVote && (
              <p
                className={`
                  flex items-center gap-1.5 text-sm text-muted-foreground
                `}
              >
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                You voted{" "}
                <span className="font-medium text-foreground">
                  {detail.userVote.choice}
                </span>{" "}
                with{" "}
                {(
                  detail.userVote.votingPower /
                  10 ** CULT_DECIMALS
                ).toLocaleString()}{" "}
                CULT
              </p>
            )}
          </>
        )}
        {isActive && !detail?.userVote && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              disabled={!wallet || votingId === proposal.id}
              onClick={() => onVote(proposal.id, "for")}
              size="sm"
              variant="default"
            >
              {votingId === proposal.id ? "Submitting…" : "Vote For"}
            </Button>
            <Button
              disabled={!wallet || votingId === proposal.id}
              onClick={() => onVote(proposal.id, "against")}
              size="sm"
              variant="secondary"
            >
              Vote Against
            </Button>
            <Button
              disabled={!wallet || votingId === proposal.id}
              onClick={() => onVote(proposal.id, "abstain")}
              size="sm"
              variant="outline"
            >
              Abstain
            </Button>
            {!wallet && (
              <Button onClick={openConnectModal} size="sm" variant="ghost">
                Connect wallet to vote
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

function StakeForm({
  currentLockTier,
  openConnectModal: _openConnectModal,
  refreshBalances,
  stake,
  stakePending,
  unstake,
  unstakePending,
  wallet,
}: StakeFormProps) {
  const [stakeAmount, setStakeAmount] = useState("");
  const [lockDuration, setLockDuration] = useState<number>(LOCK_30_DAYS);

  const handleStake = useCallback(async () => {
    const ok = await stake(stakeAmount, lockDuration);
    if (ok) {
      setStakeAmount("");
      refreshBalances();
    }
  }, [stake, stakeAmount, lockDuration, refreshBalances]);

  const handleUnstake = useCallback(async () => {
    const tier = currentLockTier ?? 0;
    const ok = await unstake(tier);
    if (ok) refreshBalances();
  }, [unstake, currentLockTier, refreshBalances]);

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Lock className="h-5 w-5 text-primary" />
          Stake CULT
        </CardTitle>
        <CardDescription>
          Stake CULT on-chain. Staked balance counts toward voting power. Choose
          a lock period (30 days or 12 months). Tokens cannot be unstaked until
          the lock expires.
          {!wallet && " Connect your Solana wallet above to stake or unstake."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!wallet && (
          <p
            className={`
              rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm
              text-muted-foreground
            `}
          >
            Connect your wallet to use the form below.
          </p>
        )}
        {/* Lock duration selector */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Lock Duration</label>
          <div className="flex gap-2">
            <Button
              onClick={() => setLockDuration(LOCK_30_DAYS)}
              size="sm"
              type="button"
              variant={lockDuration === LOCK_30_DAYS ? "default" : "outline"}
            >
              30 Days
            </Button>
            <Button
              onClick={() => setLockDuration(LOCK_12_MONTHS)}
              size="sm"
              type="button"
              variant={lockDuration === LOCK_12_MONTHS ? "default" : "outline"}
            >
              12 Months
            </Button>
          </div>
        </div>
        <div
          className={`
            grid gap-4
            sm:grid-cols-2
          `}
        >
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Stake (CULT)</label>
            <div className="flex gap-2">
              <Input
                className="font-mono"
                min={0}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="0"
                step="any"
                type="number"
                value={stakeAmount}
              />
              <Button
                disabled={stakePending || !stakeAmount.trim()}
                onClick={handleStake}
              >
                {stakePending ? "Sending…" : "Stake"}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Unstake</label>
            <p className="text-xs text-muted-foreground">
              Unstake your full staked balance once the lock period expires.
            </p>
            <Button
              disabled={unstakePending || currentLockTier === null}
              onClick={handleUnstake}
              variant="secondary"
            >
              {unstakePending ? "Sending…" : "Unstake All"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
