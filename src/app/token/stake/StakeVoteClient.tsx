"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  Vote,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { LOCK_12_MONTHS, LOCK_30_DAYS } from "~/lib/cult-staking";
import { OPEN_SOLANA_WALLET_MODAL } from "~/ui/components/auth/auth-wallet-modal";
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
import { toast } from "sonner";

// ─── Constants & Helpers ────────────────────────────────────────────

const CULT_DECIMALS = 6;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function formatPower(raw: number): string {
  const human = raw / Math.pow(10, CULT_DECIMALS);
  if (human >= 1e6) return (human / 1e6).toFixed(2) + "M";
  if (human >= 1e3) return (human / 1e3).toFixed(2) + "K";
  return human.toFixed(2);
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ─── Types ──────────────────────────────────────────────────────────

type Proposal = {
  id: string;
  title: string;
  description: string;
  status: string;
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
};

type ProposalDetail = Proposal & {
  totals: { for: number; against: number; abstain: number };
  userVote: { choice: string; votingPower: number } | null;
};

// ─── StakeForm ──────────────────────────────────────────────────────

type StakeFormProps = {
  wallet: string | null;
  sendTransaction: ReturnType<typeof useWallet>["sendTransaction"];
  connection: ReturnType<typeof useConnection>["connection"];
  openConnectModal: () => void;
  refreshBalances: () => void;
};

function StakeForm({
  wallet,
  sendTransaction,
  connection,
  openConnectModal,
  refreshBalances,
}: StakeFormProps) {
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [lockDuration, setLockDuration] = useState<number>(LOCK_30_DAYS);
  const [stakeTxPending, setStakeTxPending] = useState(false);
  const [unstakeTxPending, setUnstakeTxPending] = useState(false);

  const handleStake = useCallback(async () => {
    if (!wallet || !sendTransaction) {
      openConnectModal();
      return;
    }
    const amount = stakeAmount.trim();
    if (!amount || Number.parseFloat(amount) <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    setStakeTxPending(true);
    try {
      const res = await fetch("/api/governance/stake/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, amount, lockDuration }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503) {
          toast.error("Staking is not available yet. Deploy the program and set CULT_STAKING_PROGRAM_ID.");
        } else {
          toast.error(data.error ?? "Failed to prepare stake");
        }
        return;
      }
      const txBuf = base64ToUint8Array(data.transaction);
      const tx = Transaction.from(txBuf);
      const sig = await sendTransaction(tx, connection, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      toast.success("Stake submitted: " + sig.slice(0, 8) + "…");
      setStakeAmount("");
      refreshBalances();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stake failed");
    } finally {
      setStakeTxPending(false);
    }
  }, [wallet, sendTransaction, connection, stakeAmount, lockDuration, openConnectModal, refreshBalances]);

  const handleUnstake = useCallback(async () => {
    if (!wallet || !sendTransaction) {
      openConnectModal();
      return;
    }
    const amount = unstakeAmount.trim();
    if (!amount || Number.parseFloat(amount) <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    setUnstakeTxPending(true);
    try {
      const res = await fetch("/api/governance/unstake/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503) {
          toast.error("Staking is not available yet.");
        } else {
          toast.error(data.error ?? "Failed to prepare unstake");
        }
        return;
      }
      const txBuf = base64ToUint8Array(data.transaction);
      const tx = Transaction.from(txBuf);
      const sig = await sendTransaction(tx, connection, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      toast.success("Unstake submitted: " + sig.slice(0, 8) + "…");
      setUnstakeAmount("");
      refreshBalances();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unstake failed");
    } finally {
      setUnstakeTxPending(false);
    }
  }, [wallet, sendTransaction, connection, unstakeAmount, openConnectModal, refreshBalances]);

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Lock className="h-5 w-5 text-primary" />
          Stake CULT
        </CardTitle>
        <CardDescription>
          Stake CULT on-chain. Staked balance counts toward voting power. Choose a lock period (30 days or 12 months). Tokens cannot be unstaked until the lock expires.
          {!wallet && " Connect your Solana wallet above to stake or unstake."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!wallet && (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Connect your wallet to use the form below.
          </p>
        )}
        {/* Lock duration selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Lock Duration</label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={lockDuration === LOCK_30_DAYS ? "default" : "outline"}
              onClick={() => setLockDuration(LOCK_30_DAYS)}
            >
              30 Days
            </Button>
            <Button
              type="button"
              size="sm"
              variant={lockDuration === LOCK_12_MONTHS ? "default" : "outline"}
              onClick={() => setLockDuration(LOCK_12_MONTHS)}
            >
              12 Months
            </Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Stake (CULT)</label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="0"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="font-mono"
              />
              <Button
                onClick={handleStake}
                disabled={stakeTxPending || !stakeAmount.trim()}
              >
                {stakeTxPending ? "Sending…" : "Stake"}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Unstake (CULT)</label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="0"
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
                className="font-mono"
              />
              <Button
                variant="secondary"
                onClick={handleUnstake}
                disabled={unstakeTxPending || !unstakeAmount.trim()}
              >
                {unstakeTxPending ? "Sending…" : "Unstake"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── ProposalCard ───────────────────────────────────────────────────

type ProposalCardProps = {
  proposal: Proposal;
  detail: ProposalDetail | undefined;
  wallet: string | null;
  votingId: string | null;
  onVote: (proposalId: string, choice: "for" | "against" | "abstain") => void;
  openConnectModal: () => void;
};

function ProposalCard({
  proposal,
  detail,
  wallet,
  votingId,
  onVote,
  openConnectModal,
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
              ${isActive ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"}
            `}
          >
            {isActive ? "Active" : "Ended"}
          </span>
        </div>
        <CardDescription className="whitespace-pre-wrap">
          {proposal.description}
        </CardDescription>
        <p className="text-xs text-muted-foreground">
          Ends: {formatDate(proposal.endAt)}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {detail && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  For {formatPower(detail.totals.for)} · Against{" "}
                  {formatPower(detail.totals.against)}
                  {detail.totals.abstain > 0 &&
                    ` · Abstain ${formatPower(detail.totals.abstain)}`}
                </span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                title={`For ${forPct.toFixed(0)}%`}
                role="progressbar"
                aria-valuenow={forPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${forPct}%` }}
                />
              </div>
            </div>
            {detail.userVote && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                You voted{" "}
                <span className="font-medium text-foreground">
                  {detail.userVote.choice}
                </span>{" "}
                with{" "}
                {(
                  detail.userVote.votingPower /
                  Math.pow(10, CULT_DECIMALS)
                ).toLocaleString()}{" "}
                CULT
              </p>
            )}
          </>
        )}
        {isActive && !detail?.userVote && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              variant="default"
              disabled={!wallet || votingId === proposal.id}
              onClick={() => onVote(proposal.id, "for")}
            >
              {votingId === proposal.id ? "Submitting…" : "Vote For"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!wallet || votingId === proposal.id}
              onClick={() => onVote(proposal.id, "against")}
            >
              Vote Against
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!wallet || votingId === proposal.id}
              onClick={() => onVote(proposal.id, "abstain")}
            >
              Abstain
            </Button>
            {!wallet && (
              <Button
                size="sm"
                variant="ghost"
                onClick={openConnectModal}
              >
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

export function StakeVoteClient() {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;

  const [votingPower, setVotingPower] = useState<number | null>(null);
  const [walletBalanceRaw, setWalletBalanceRaw] = useState<number | null>(null);
  const [stakedBalanceRaw, setStakedBalanceRaw] = useState<number | null>(null);
  const [votingPowerLoading, setVotingPowerLoading] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [details, setDetails] = useState<Record<string, ProposalDetail>>({});
  const [votingId, setVotingId] = useState<string | null>(null);

  const openConnectModal = useCallback(() => {
    window.dispatchEvent(new CustomEvent(OPEN_SOLANA_WALLET_MODAL));
  }, []);

  const refreshBalances = useCallback(() => {
    if (!wallet) return;
    setVotingPowerLoading(true);
    fetch(`/api/governance/voting-power?wallet=${encodeURIComponent(wallet)}`)
      .then((r) => r.json())
      .then((data) => {
        const total = data.votingPowerRaw ? BigInt(data.votingPowerRaw) : 0n;
        const walletRaw = data.walletBalanceRaw ? BigInt(data.walletBalanceRaw) : 0n;
        const stakedRaw = data.stakedBalanceRaw ? BigInt(data.stakedBalanceRaw) : 0n;
        setVotingPower(Number(total));
        setWalletBalanceRaw(Number(walletRaw));
        setStakedBalanceRaw(Number(stakedRaw));
      })
      .catch(() => {
        setVotingPower(0);
        setWalletBalanceRaw(0);
        setStakedBalanceRaw(0);
      })
      .finally(() => setVotingPowerLoading(false));
  }, [wallet]);

  // Fetch balances when wallet changes
  useEffect(() => {
    if (!wallet) {
      setVotingPower(null);
      setWalletBalanceRaw(null);
      setStakedBalanceRaw(null);
      return;
    }
    refreshBalances();
  }, [wallet, refreshBalances]);

  // Fetch proposals on mount
  useEffect(() => {
    let cancelled = false;
    setProposalsLoading(true);
    fetch("/api/governance/proposals")
      .then((r) => r.json())
      .then((data) => {
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

  const fetchProposalDetail = useCallback(async (id: string) => {
    const url = wallet
      ? `/api/governance/proposals/${id}?wallet=${encodeURIComponent(wallet)}`
      : `/api/governance/proposals/${id}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      proposal: Proposal;
      totals: { for: number; against: number; abstain: number };
      userVote: { choice: string; votingPower: number } | null;
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
  }, [wallet]);

  // Fetch details for each proposal
  useEffect(() => {
    for (const p of proposals) {
      void fetchProposalDetail(p.id);
    }
  }, [proposals, fetchProposalDetail]);

  const vote = useCallback(
    async (proposalId: string, choice: "for" | "against" | "abstain") => {
      if (!wallet) {
        openConnectModal();
        return;
      }
      setVotingId(proposalId);
      try {
        const res = await fetch(`/api/governance/proposals/${proposalId}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet, choice }),
        });
        const data = await res.json().catch(() => ({}));
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
    votingPower !== null ? votingPower / Math.pow(10, CULT_DECIMALS) : 0;
  const walletPower =
    walletBalanceRaw !== null ? walletBalanceRaw / Math.pow(10, CULT_DECIMALS) : 0;
  const stakedPower =
    stakedBalanceRaw !== null ? stakedBalanceRaw / Math.pow(10, CULT_DECIMALS) : 0;

  return (
    <div className="container mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      {/* Voting power card */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            {!connected ? (
              <Button onClick={openConnectModal} className="gap-2">
                <Wallet className="h-4 w-4" />
                Connect wallet
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2">
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
          {connected && (
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
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

      {/* On-chain staking — always visible; connect wallet to use */}
      <StakeForm
        wallet={wallet}
        sendTransaction={sendTransaction}
        connection={connection}
        openConnectModal={openConnectModal}
        refreshBalances={refreshBalances}
      />

      {/* Proposals */}
      <div>
        <h2 className="mb-4 font-display text-2xl font-semibold text-foreground">
          Proposals
        </h2>
        {proposalsLoading ? (
          <div className="space-y-4">
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
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="mb-2 h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">No proposals yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Community proposals will appear here. Check back soon.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {proposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                detail={details[p.id]}
                wallet={wallet}
                votingId={votingId}
                onVote={vote}
                openConnectModal={openConnectModal}
              />
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-2 text-center">
        <Link href="/token">
          <Button variant="outline" className="gap-2">
            About CULT token
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <p className="text-sm text-muted-foreground">
          Fair launch on{" "}
          <a
            href="https://pump.fun"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            pump.fun
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </p>
      </div>
    </div>
  );
}
