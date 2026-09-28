"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useWeb3 } from "@/lib/web3-provider";
import { ALLOWED_TOKENS, ZERO_ADDRESS } from "@/lib/contract";
import { DareStatus, type DareData } from "@/lib/types";
import {
  shortenAddress,
  formatStake,
  getStatusLabel,
  getStatusColor,
  timeRemaining,
  isDeadlinePassed,
  isInProofWindow,
  isInConfirmWindow,
  isInJudgeWindow,
} from "@/lib/helpers";
import { DareTimeline } from "@/components/dare-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Clock,
  User,
  Swords,
  FileCheck,
  ShieldAlert,
  Gavel,
  XCircle,
  Ban,
  Sparkles,
  ShieldCheck,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Address, type Hash } from "viem";
import Link from "next/link";

interface DareDetailProps {
  dare: DareData | null;
  onRefresh: () => void;
}

function symbolToDisplayName(symbol: string) {
  if (symbol === "USDC9CIRCLE0" || symbol === "USDC_CIRCLE") return "USDC";
  if (symbol === "TKN1" || symbol === "TOKEN1") return "JESSE";
  if (symbol === "TKN4" || symbol === "TOKEN4") return "AERO";
  if (symbol === "TKN5" || symbol === "TOKEN5") return "ZORA";
  if (symbol === "ETH") return "ETH";
  return symbol;
}

function tokenMetaFromAddress(tokenAddress: string) {
  if (
    tokenAddress === ZERO_ADDRESS ||
    tokenAddress === "0x0000000000000000000000000000000000000000"
  ) {
    return { symbol: "ETH", icon: "/images/eth.png" };
  }

  const meta = ALLOWED_TOKENS.find(
    (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
  );
  if (!meta) {
    return { symbol: "???", icon: "/images/eth.png" };
  }
  const display = symbolToDisplayName(meta.symbol);
  return {
    symbol: display,
    icon: `/images/${display.toLowerCase()}.png`,
  };
}

function formatDurationShort(totalSeconds: number) {
  if (totalSeconds <= 0) return "0m";
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

type ProfileMeta = {
  username: string | null;
  avatar_url: string | null;
  badge: number | null;
};

function useProfileMeta(address: string | null) {
  const [profile, setProfile] = useState<ProfileMeta>({
    username: null,
    avatar_url: null,
    badge: null,
  });

  useEffect(() => {
    if (!address) return;

    let cancelled = false;

    fetch(`/api/profile?address=${encodeURIComponent(address)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.profile) {
          setProfile({
            username: data.profile.username ?? null,
            avatar_url: data.profile.avatar_url ?? null,
            badge:
              typeof data.profile.badge === "number"
                ? data.profile.badge
                : data.profile.badge != null
                  ? Number(data.profile.badge)
                  : null,
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [address]);

  return profile;
}

const PROFILE_BADGES = [
  "None",
  "Rookie",
  "Challenger",
  "Contender",
  "Gladiator",
  "Champion",
  "Legend",
  "Mythic",
] as const;

function ProfileIdentity({
  address,
  role,
  accent,
}: {
  address: string;
  role: string;
  accent: "creator" | "accepter";
}) {
  const profile = useProfileMeta(address);
  const badge =
    profile.badge != null && PROFILE_BADGES[profile.badge]
      ? PROFILE_BADGES[profile.badge]
      : null;

  return (
    <>
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.username || role}
            className="block h-full w-full object-cover"
          />
        ) : (
          <div className={cn(
            "flex h-full w-full items-center justify-center",
            accent === "creator"
              ? "bg-gradient-to-br from-amber-50 via-white to-amber-100/70 text-amber-600"
              : "bg-gradient-to-br from-blue-50 via-white to-blue-100/70 text-[#0052FF]"
          )}>
            {accent === "creator" ? (
              <User className="h-6 w-6 stroke-[2.2]" />
            ) : (
              <Swords className="h-6 w-6 stroke-[2.2]" />
            )}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          {role}
        </span>
        {profile.username ? (
          <span className="truncate text-xs sm:text-sm font-black text-slate-900">
            @{profile.username}
          </span>
        ) : (
          <span className="truncate font-mono text-xs sm:text-sm font-black text-slate-900">
            {shortenAddress(address)}
          </span>
        )}
        <div className="flex min-w-0 items-center gap-1.5">
          {badge && badge !== "None" && (
            <span className="truncate rounded-full border border-indigo-200/80 bg-indigo-50 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-indigo-700">
              {badge}
            </span>
          )}
          {profile.username && (
            <span className="truncate font-mono text-[9px] text-slate-400">
              {shortenAddress(address)}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl bg-slate-100/80 border border-slate-200/60",
        className
      )}
    />
  );
}

export function DareDetail({ dare, onRefresh }: DareDetailProps) {
  const {
    address,
    isConnected,
    writeContract,
    approveToken,
    getAllowance,
    readContract,
    connect,
  } = useWeb3();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [proofURI, setProofURI] = useState("");
  const [proofError, setProofError] = useState("");
  const [copied, setCopied] = useState(false);
  const [judgeAddress, setJudgeAddress] = useState<string>("");
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [txStage, setTxStage] = useState<
    "idle" | "sign" | "pending" | "success" | "error"
  >("idle");
  const [acceptStep, setAcceptStep] = useState<0 | 1 | 2>(0);

  const [confirmAction, setConfirmAction] = useState<
    | null
    | {
        type:
          | "cancel"
          | "expire"
          | "dispute"
          | "resolveConfirmTimeout"
          | "resolveProofTimeout"
          | "judgeCreator"
          | "judgeAccepter";
        label: string;
      }
  >(null);

  useEffect(() => {
    if (!confirmAction) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirmAction(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmAction]);

  useEffect(() => {
    readContract("judge")
      .then((j) => setJudgeAddress(j as string))
      .catch(() => {});
  }, [readContract]);

  const isJudge = address?.toLowerCase() === judgeAddress?.toLowerCase();

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const executeAction = async (action: () => Promise<Hash>, label: string) => {
    setError("");
    setSuccess("");
    setIsLoading(true);
    setTxHash(null);
    setTxStage("sign");
    setAcceptStep(0);
    try {
      const hash = await action();
      setTxHash(hash);
      setTxStage("pending");
      setSuccess(`${label} submitted. Waiting for confirmation...`);
      onRefresh();
    } catch (err: any) {
      const message = err?.message ?? "Transaction failed";
      setError(message);
      setTxStage("error");
      console.error(err);
    } finally {
      setIsLoading(false);
      setConfirmAction(null);
    }
  };

  if (!dare) {
    return (
      <div className="flex flex-col gap-6 text-slate-900">
        <SkeletonBlock className="h-10 w-48" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SkeletonBlock className="h-8 w-32 rounded-full" />
          <SkeletonBlock className="h-10 w-52 rounded-2xl" />
        </div>
        <SkeletonBlock className="h-32 w-full rounded-3xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <SkeletonBlock className="h-20 w-full rounded-2xl" />
          <SkeletonBlock className="h-20 w-full rounded-2xl" />
        </div>
        <SkeletonBlock className="h-6 w-64" />
      </div>
    );
  }

  const stakeFormatted = formatStake(dare.stake);
  const tokenMeta = tokenMetaFromAddress(dare.token);
  const isETH =
    dare.token === ZERO_ADDRESS ||
    dare.token === "0x0000000000000000000000000000000000000000";
  const isCreator = address?.toLowerCase() === dare.creator.toLowerCase();
  const isAccepter = address?.toLowerCase() === dare.accepter.toLowerCase();
  const noAccepter =
    dare.accepter === ZERO_ADDRESS ||
    dare.accepter === "0x0000000000000000000000000000000000000000";

  const now = useMemo(() => Math.floor(Date.now() / 1000), []);
  const proofWindowText = useMemo(() => {
    if (!isDeadlinePassed(dare.deadline) || !isInProofWindow(dare.deadline)) {
      return null;
    }
    const proofEnd = Number(dare.deadline) + 24 * 60 * 60;
    const remaining = proofEnd - now;
    return `Proof window ends in ${formatDurationShort(remaining)}`;
  }, [dare.deadline, now]);

  const confirmWindowText = useMemo(() => {
    if (!dare.proofTime || !isInConfirmWindow(dare.proofTime)) return null;
    const confirmEnd = Number(dare.proofTime) + 24 * 60 * 60;
    const remaining = confirmEnd - now;
    return `Creator has ${formatDurationShort(remaining)} to confirm or dispute`;
  }, [dare.proofTime, now]);

  const judgeWindowText = useMemo(() => {
    if (!dare.disputeTime || !isInJudgeWindow(dare.disputeTime)) return null;
    const judgeEnd = Number(dare.disputeTime) + 72 * 60 * 60;
    const remaining = judgeEnd - now;
    return `Judge has ${formatDurationShort(remaining)} left to decide`;
  }, [dare.disputeTime, now]);

  const handleAcceptDare = () =>
    executeAction(
      async () => {
        if (!address) throw new Error("Wallet not connected");

        if (!isETH) {
          const allowance = await getAllowance(dare.token as Address, address);
          if (allowance < dare.stake) {
            setAcceptStep(1);
            setTxStage("sign");
            const approveHash = await approveToken(
              dare.token as Address,
              dare.stake
            );
            setTxHash(approveHash);
            setTxStage("pending");
            await new Promise((r) => setTimeout(r, 3000));
          }
        }

        setAcceptStep(2);
        setTxStage("sign");
        const hash = await writeContract(
          "acceptDare",
          [BigInt(dare.id)],
          isETH ? dare.stake : undefined
        );
        return hash;
      },
      "Dare accepted"
    );

  const handleCancel = () =>
    executeAction(
      () => writeContract("cancelOpenDare", [BigInt(dare.id)]),
      "Dare cancelled"
    );

  const handleExpire = () =>
    executeAction(
      () => writeContract("expireUnacceptedDare", [BigInt(dare.id)]),
      "Dare expired"
    );

  const handleSubmitProof = () =>
    executeAction(
      () => writeContract("submitProof", [BigInt(dare.id), proofURI]),
      "Proof submitted"
    );

  const handleConfirmSuccess = () =>
    executeAction(
      () => writeContract("confirmSuccess", [BigInt(dare.id)]),
      "Dare confirmed"
    );

  const handleDispute = () =>
    executeAction(
      () => writeContract("disputeDare", [BigInt(dare.id)]),
      "Dare disputed"
    );

  const handleResolveConfirmTimeout = () =>
    executeAction(
      () => writeContract("resolveAfterConfirmTimeout", [BigInt(dare.id)]),
      "Resolved"
    );

  const handleResolveProofTimeout = () =>
    executeAction(
      () =>
        dare.proofRequired
          ? writeContract("resolveAfterProofTimeout", [BigInt(dare.id)])
          : writeContract("resolveNoProofRequired", [BigInt(dare.id)]),
      "Resolved"
    );

  const handleJudgeResolve = (creatorWins: boolean) =>
    executeAction(
      () => writeContract("judgeResolve", [BigInt(dare.id), creatorWins]),
      "Judge resolved"
    );

  const validateProof = (value: string) => {
    const v = value.trim();
    if (!v) {
      setProofError("");
      return;
    }
    if (v.length < 8) {
      setProofError("Proof link looks too short.");
      return;
    }
    if (!v.startsWith("http://") && !v.startsWith("https://")) {
      setProofError("Proof URL must start with http:// or https://");
      return;
    }
    setProofError("");
  };

  const handleProofKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!isLoading && proofURI.trim() && !proofError) {
        handleSubmitProof();
      }
    }
  };

  const primaryAcceptLabel = `Accept Dare (${stakeFormatted} ${tokenMeta.symbol})`;

  return (
    <div className="flex flex-col gap-6 text-slate-900">
      {/* Timeline with Frosted Glass Container */}
      <div className="glass-panel rounded-3xl p-5 sm:p-6 shadow-xs">
        <DareTimeline status={dare.status} />
      </div>

      {/* Status Badge + Staking Pool Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          key={dare.status}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider border shadow-xs transition-all duration-300",
            dare.status === DareStatus.Resolved
              ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-[0_0_20px_rgba(16,185,129,0.25)] scale-[1.02]"
              : dare.status === DareStatus.Open
              ? "bg-emerald-50/90 text-emerald-700 border-emerald-200/80"
              : dare.status === DareStatus.Disputed
              ? "bg-rose-50 text-rose-700 border-rose-200/80"
              : "bg-blue-50/90 text-[#0052FF] border-blue-200/80",
            getStatusColor(dare.status)
          )}
        >
          {dare.status === DareStatus.Open && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          )}
          {getStatusLabel(dare.status)}
        </span>

        {/* Stake Module */}
        <div className="glass-card-interactive flex items-center gap-2.5 rounded-2xl px-4 py-2 shadow-xs">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white p-1 border border-slate-100 shadow-xs">
            <Image
              src={tokenMeta.icon}
              alt={tokenMeta.symbol}
              width={22}
              height={22}
              className="h-full w-full object-contain"
            />
          </div>
          <span className="font-mono text-sm sm:text-base font-black text-slate-900">
            {stakeFormatted} {tokenMeta.symbol}
          </span>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            each side
          </span>
        </div>
      </div>

      {/* Description Glass Card */}
      <div className="glass-card-interactive max-md:rounded-2xl max-md:p-4 rounded-[26px] p-5 sm:p-7 shadow-xs">
        <div className="mb-2 inline-flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-[0.14em] text-[#0052FF]">
          <Sparkles className="h-3.5 w-3.5" /> Challenge Statement
        </div>
        <p className="text-base sm:text-lg font-bold leading-relaxed text-slate-900 whitespace-pre-wrap">
          {dare.description}
        </p>
      </div>

      {/* Participants with Bigger 3D Glass Avatars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Creator Card */}
        <div className="glass-card-interactive group flex items-center gap-3.5 rounded-2xl p-4 shadow-xs">
          <Link
            href={`/profile/${dare.creator}`}
            className="flex min-w-0 flex-1 items-center gap-3.5"
          >
            <ProfileIdentity address={dare.creator} role="Creator" accent="creator" />
          </Link>
          <button
            onClick={() => copyAddress(dare.creator)}
            className="ml-auto shrink-0 flex h-9 w-9 max-md:h-11 max-md:w-11 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-400 hover:text-slate-900 hover:bg-slate-50 active:scale-90 transition-all shadow-xs cursor-pointer"
            aria-label="Copy address"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500 stroke-[3]" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Accepter Card */}
        {!noAccepter ? (
          <div className="glass-card-interactive group flex items-center gap-3.5 rounded-2xl p-4 shadow-xs">
            <Link
              href={`/profile/${dare.accepter}`}
              className="flex min-w-0 flex-1 items-center gap-3.5"
            >
              <ProfileIdentity address={dare.accepter} role="Accepter" accent="accepter" />
            </Link>
            <button
              onClick={() => copyAddress(dare.accepter)}
              className="ml-auto shrink-0 flex h-9 w-9 max-md:h-11 max-md:w-11 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-400 hover:text-slate-900 hover:bg-slate-50 active:scale-90 transition-all shadow-xs cursor-pointer"
              aria-label="Copy address"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="glass-panel flex items-center gap-3.5 rounded-2xl border-dashed p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200/70 text-slate-400">
              <Swords className="h-6 w-6 stroke-[1.8]" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Challenger Slot</span>
              <p className="text-xs font-bold text-slate-700">Open for anyone to accept</p>
            </div>
          </div>
        )}
      </div>

      {/* Time & Windows Info */}
      <div className="glass-panel flex flex-col gap-2 rounded-2xl p-4 text-xs font-semibold text-slate-500 shadow-xs">
        <div className="flex flex-wrap gap-3.5 items-center">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>
              Deadline:{" "}
              <b className="text-slate-800">
                {new Date(Number(dare.deadline) * 1000).toLocaleDateString()}{" "}
                {new Date(Number(dare.deadline) * 1000).toLocaleTimeString()}
              </b>
            </span>
          </div>
          {(dare.status === DareStatus.Open ||
            dare.status === DareStatus.Running) && (
            <div className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-[#0052FF]">
              <span>{timeRemaining(dare.deadline)} remaining</span>
            </div>
          )}
        </div>

        {proofWindowText && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            <span>{proofWindowText}</span>
          </div>
        )}

        {confirmWindowText && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
            <Clock className="h-3.5 w-3.5 text-emerald-500" />
            <span>{confirmWindowText}</span>
          </div>
        )}

        {judgeWindowText && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600">
            <Gavel className="h-3.5 w-3.5 text-indigo-500" />
            <span>{judgeWindowText}</span>
          </div>
        )}
      </div>

      {/* Proof Info Box */}
      {dare.proofSubmitted && dare.proofURI && (
        <div className="glass-card-interactive rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <FileCheck className="h-4 w-4" />
            </div>
            <span className="text-sm font-black text-slate-900">
              Verified Proof Submitted
            </span>
          </div>
          <a
            href={dare.proofURI}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#0052FF] hover:underline break-all"
          >
            <span>
              {dare.proofURI.length > 60
                ? dare.proofURI.slice(0, 60) + "..."
                : dare.proofURI}
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
        </div>
      )}

      {/* Transaction Status Banner */}
      {txStage !== "idle" && (
        <div className="glass-panel flex items-start gap-3 rounded-2xl p-4 text-xs font-semibold text-slate-700 shadow-xs">
          <Loader2
            className={`h-4 w-4 mt-0.5 shrink-0 text-[#0052FF] ${
              txStage === "sign" || txStage === "pending" ? "animate-spin" : ""
            }`}
          />
          <div className="flex flex-col gap-1">
            {txStage === "sign" && (
              <span>
                {acceptStep === 1
                  ? "Step 1/2: Approving token spend. Check your wallet to sign."
                  : acceptStep === 2
                  ? "Step 2/2: Accepting dare collateral. Check your wallet to sign."
                  : "Check your wallet and sign the transaction."}
              </span>
            )}
            {txStage === "pending" && (
              <span>
                {acceptStep === 1
                  ? "Step 1/2: Token approval sent. Waiting for Base confirmation…"
                  : acceptStep === 2
                  ? "Step 2/2: Accept transaction sent. Locking collateral in escrow…"
                  : "Transaction sent. Waiting for Base Sepolia block confirmation…"}
              </span>
            )}
            {txStage === "success" && (
              <span className="text-emerald-600 font-bold">Transaction confirmed on-chain!</span>
            )}
            {txStage === "error" && (
              <span className="text-rose-600 font-bold">
                Transaction failed. Please check the error details below.
              </span>
            )}
            {txHash && (
              <a
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-[#0052FF] hover:underline break-all"
              >
                View on BaseScan: {txHash} ↗
              </a>
            )}
          </div>
        </div>
      )}

      {/* Action States */}
      <div className="flex flex-col gap-3">
        {/* --- OPEN STATE --- */}
        {dare.status === DareStatus.Open && (
          <>
            {isConnected && !isCreator && (
              <Button
                onClick={handleAcceptDare}
                disabled={isLoading}
                className="animate-pulse-glow h-13 w-full min-h-[50px] rounded-2xl bg-gradient-to-b from-[#0052FF] to-[#0045d8] hover:to-[#003bb8] text-white text-base font-black shadow-[0_8px_24px_rgba(0,82,255,0.32)] active:scale-[0.98] transition-all cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Swords className="mr-2 h-5 w-5 stroke-[2.2]" />
                )}
                {primaryAcceptLabel}
              </Button>
            )}

            {isConnected && isCreator && !isDeadlinePassed(dare.deadline) && (
              <Button
                onClick={() =>
                  setConfirmAction({
                    type: "cancel",
                    label: "Cancel Dare",
                  })
                }
                disabled={isLoading}
                variant="outline"
                className="h-12 w-full min-h-[48px] rounded-2xl border-rose-200 bg-rose-50/60 text-rose-600 hover:bg-rose-100/70 text-sm font-bold transition-all cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Cancel Dare & Unlock Stake
              </Button>
            )}

            {isDeadlinePassed(dare.deadline) && (
              <Button
                onClick={() =>
                  setConfirmAction({
                    type: "expire",
                    label: "Expire & Refund Creator",
                  })
                }
                disabled={isLoading}
                variant="outline"
                className="h-12 w-full min-h-[48px] rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-bold transition-all cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Ban className="mr-2 h-4 w-4" />
                )}
                Expire & Refund Creator
              </Button>
            )}

            {!isConnected && (
              <Button
                onClick={connect}
                className="h-13 w-full min-h-[50px] rounded-2xl bg-gradient-to-b from-[#0052FF] to-[#0045d8] text-white text-base font-black shadow-[0_8px_24px_rgba(0,82,255,0.32)] active:scale-[0.98] transition-all cursor-pointer"
              >
                Connect Wallet to Accept
              </Button>
            )}
          </>
        )}

        {/* --- RUNNING STATE --- */}
        {dare.status === DareStatus.Running && (
          <>
            {isConnected &&
              isAccepter &&
              isDeadlinePassed(dare.deadline) &&
              isInProofWindow(dare.deadline) && (
                <div className="glass-card-interactive flex flex-col gap-3.5 max-md:rounded-2xl max-md:p-4 rounded-[24px] p-5 sm:p-6 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0052FF]">
                      <FileCheck className="h-5 w-5 stroke-[2.2]" />
                    </div>
                    <span className="text-sm font-black text-slate-900">
                      Submit Your Verifiable Proof
                    </span>
                  </div>
                  <Input
                    value={proofURI}
                    onChange={(e) => {
                      setProofURI(e.target.value);
                      validateProof(e.target.value);
                    }}
                    onKeyDown={handleProofKeyDown}
                    placeholder="Proof URL (e.g. Strava link, X post, image URI, IPFS)"
                    className="h-12 rounded-2xl border-slate-200/80 bg-white/95 text-slate-900 text-sm focus-visible:border-[#0052FF] focus-visible:ring-4 focus-visible:ring-blue-100/70 shadow-xs"
                  />
                  {proofError && (
                    <p className="text-xs font-bold text-rose-500">{proofError}</p>
                  )}
                  <Button
                    onClick={handleSubmitProof}
                    disabled={
                      isLoading || !proofURI.trim() || proofError.length > 0
                    }
                    className="h-12 w-full min-h-[48px] rounded-2xl bg-gradient-to-b from-[#0052FF] to-[#0045d8] text-white font-black shadow-[0_6px_20px_rgba(0,82,255,0.28)] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileCheck className="mr-2 h-4 w-4" />
                    )}
                    Submit Proof On-Chain
                  </Button>
                </div>
              )}

            {isAccepter && !isDeadlinePassed(dare.deadline) && (
              <div className="glass-panel flex items-center gap-3 rounded-2xl p-4 text-xs sm:text-sm font-semibold text-slate-600 shadow-xs">
                <Clock className="h-4 w-4 text-[#0052FF] shrink-0" />
                <span>
                  Challenge is currently in progress. Submit proof after the deadline (
                  <b className="text-slate-900">{timeRemaining(dare.deadline)}</b> remaining).
                </span>
              </div>
            )}

            {isDeadlinePassed(dare.deadline) &&
              !isInProofWindow(dare.deadline) &&
              !dare.proofSubmitted &&
              dare.proofRequired !== undefined && (
                <Button
                  onClick={() =>
                    setConfirmAction({
                      type: "resolveProofTimeout",
                      label: "Resolve (No Proof - Creator Wins)",
                    })
                  }
                  disabled={isLoading}
                  className="h-12 w-full min-h-[48px] rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black shadow-[0_6px_20px_rgba(245,158,11,0.25)] active:scale-[0.98] transition-all cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Gavel className="mr-2 h-4 w-4" />
                  )}
                  Resolve (No Proof - Creator Wins)
                </Button>
              )}
          </>
        )}

        {/* --- PROOF SUBMITTED STATE --- */}
        {dare.status === DareStatus.ProofSubmitted && (
          <>
            {isConnected && isCreator && isInConfirmWindow(dare.proofTime) && (
              <div className="glass-panel flex flex-col gap-3 rounded-[24px] p-5 shadow-xs">
                <p className="text-xs sm:text-sm font-semibold text-slate-600">
                  Review the submitted proof above and choose to confirm or dispute within 24 hours.
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={handleConfirmSuccess}
                    disabled={isLoading}
                    className="flex-1 h-12 min-h-[48px] rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 text-white font-black shadow-[0_6px_20px_rgba(16,185,129,0.25)] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4 stroke-[3]" />
                    )}
                    Confirm & Release Stake
                  </Button>
                  <Button
                    onClick={() =>
                      setConfirmAction({
                        type: "dispute",
                        label: "Open Dispute",
                      })
                    }
                    disabled={isLoading}
                    variant="outline"
                    className="flex-1 h-12 min-h-[48px] rounded-2xl border-rose-200 bg-rose-50/60 text-rose-600 hover:bg-rose-100 font-bold active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldAlert className="mr-2 h-4 w-4" />
                    )}
                    Dispute Proof
                  </Button>
                </div>
              </div>
            )}

            {!isInConfirmWindow(dare.proofTime) && (
              <Button
                onClick={() =>
                  setConfirmAction({
                    type: "resolveConfirmTimeout",
                    label: "Resolve (Creator Inactive - Accepter Wins)",
                  })
                }
                disabled={isLoading}
                className="h-12 w-full min-h-[48px] rounded-2xl bg-gradient-to-b from-[#0052FF] to-[#0045d8] text-white font-black shadow-[0_6px_20px_rgba(0,82,255,0.25)] active:scale-[0.98] transition-all cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Gavel className="mr-2 h-4 w-4" />
                )}
                Resolve (Creator Inactive - Accepter Wins)
              </Button>
            )}
          </>
        )}

        {/* --- DISPUTED STATE --- */}
        {dare.status === DareStatus.Disputed && (
          <>
            {isJudge && isInJudgeWindow(dare.disputeTime) && (
              <div className="glass-card-interactive flex flex-col gap-3.5 rounded-[24px] p-5 shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Gavel className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-black text-slate-900">
                    Judge Official Resolution
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-500">
                  As the designated protocol judge, review the proof evidence and award the escrowed pool.
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() =>
                      setConfirmAction({
                        type: "judgeCreator",
                        label: "Creator Wins",
                      })
                    }
                    disabled={isLoading}
                    className="flex-1 h-12 min-h-[48px] rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black shadow-xs active:scale-[0.98] cursor-pointer"
                  >
                    Creator Wins
                  </Button>
                  <Button
                    onClick={() =>
                      setConfirmAction({
                        type: "judgeAccepter",
                        label: "Accepter Wins",
                      })
                    }
                    disabled={isLoading}
                    className="flex-1 h-12 min-h-[48px] rounded-2xl bg-[#0052FF] hover:bg-[#0045d8] text-white font-black shadow-xs active:scale-[0.98] cursor-pointer"
                  >
                    Accepter Wins
                  </Button>
                </div>
              </div>
            )}

            {!isJudge && (
              <div className="glass-panel flex items-center gap-3 rounded-2xl border-rose-200 bg-rose-50/70 p-4 text-xs sm:text-sm font-bold text-rose-700 shadow-xs">
                <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600" />
                <span>
                  This dare is currently under dispute review. The protocol judge will inspect the evidence and declare a winner within 72 hours.
                </span>
              </div>
            )}
          </>
        )}

        {/* --- RESOLVED --- */}
        {dare.status === DareStatus.Resolved && (
          <div className="glass-panel rounded-3xl border-emerald-200 bg-emerald-50/70 p-5 text-center shadow-xs">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100/80 text-emerald-700">
              <Check className="h-6 w-6 stroke-[3]" />
            </div>
            <p className="text-sm font-black text-emerald-800">
              Dare Resolved & Payout Released
            </p>
          </div>
        )}

        {/* --- CANCELLED --- */}
        {dare.status === DareStatus.Cancelled && (
          <div className="glass-panel rounded-3xl p-5 text-center shadow-xs">
            <Ban className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            <p className="text-sm font-black text-slate-600">
              Dare Cancelled & Funds Refunded
            </p>
          </div>
        )}
      </div>

      {/* Feedback Messages */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-xs font-bold text-rose-700 shadow-xs">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs font-bold text-emerald-700 shadow-xs">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 stroke-[3]" />
          <span>{success}</span>
        </div>
      )}

      {/* Confirmation Modal with Frosted Glass Backdrop */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/40 max-md:backdrop-blur-none sm:backdrop-blur-md p-4 animate-menu-slide">
          <div className="glass-panel w-full sm:max-w-md max-md:rounded-2xl max-md:p-4 rounded-[28px] p-6 space-y-4 shadow-[0_24px_70px_rgba(15,23,42,0.25)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <span className="text-base font-black text-slate-900">
                Confirm Action
              </span>
            </div>
            
            <p className="text-xs sm:text-sm leading-relaxed text-slate-600 font-medium">
              {confirmAction.type === "cancel" &&
                "Are you sure you want to cancel this open dare? Escrowed collateral will be refunded to your wallet."}
              {confirmAction.type === "expire" &&
                "Expire this dare and refund the creator? Anyone can trigger this after the deadline."}
              {confirmAction.type === "dispute" &&
                "Open an official dispute on this dare? The designated protocol judge will review the evidence and declare a winner."}
              {confirmAction.type === "resolveConfirmTimeout" &&
                "Resolve in favor of the accepter because the creator did not respond within the 24h window?"}
              {confirmAction.type === "resolveProofTimeout" &&
                "Resolve in favor of the creator because no verifiable proof was uploaded on time?"}
              {confirmAction.type === "judgeCreator" &&
                "Confirm judge ruling that the creator wins this disputed challenge?"}
              {confirmAction.type === "judgeAccepter" &&
                "Confirm judge ruling that the accepter wins this disputed challenge?"}
            </p>

            <div className="flex gap-2.5 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-11 min-h-[44px] rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                onClick={() => setConfirmAction(null)}
                disabled={isLoading}
              >
                Go Back
              </Button>
              <Button
                className="flex-1 h-11 min-h-[44px] rounded-xl bg-gradient-to-b from-[#0052FF] to-[#0045d8] text-white hover:to-[#003bb8] text-xs font-black shadow-[0_4px_14px_rgba(0,82,255,0.25)] cursor-pointer"
                disabled={isLoading}
                onClick={() => {
                  if (confirmAction.type === "cancel") return handleCancel();
                  if (confirmAction.type === "expire") return handleExpire();
                  if (confirmAction.type === "dispute") return handleDispute();
                  if (confirmAction.type === "resolveConfirmTimeout")
                    return handleResolveConfirmTimeout();
                  if (confirmAction.type === "resolveProofTimeout")
                    return handleResolveProofTimeout();
                  if (confirmAction.type === "judgeCreator")
                    return handleJudgeResolve(true);
                  if (confirmAction.type === "judgeAccepter")
                    return handleJudgeResolve(false);
                }}
              >
                {isLoading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Confirm Action
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
