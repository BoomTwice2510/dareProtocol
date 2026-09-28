"use client";

import Link from "next/link";
import Image from "next/image";
import type { DareData } from "@/lib/types";
import { shortenAddress, formatStake, getStatusLabel, timeRemaining, timeAgo, isInProofWindow } from "@/lib/helpers";
import { ZERO_ADDRESS, ALLOWED_TOKENS } from "@/lib/contract";
import { useEffect, useState } from "react";
import { ArrowRight, Clock, Share2, User, Swords, RotateCcw } from "lucide-react";

type CardProfile = {
  username: string | null;
  avatar_url: string | null;
  badge: number | null;
};

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

function CardProfileIdentity({ address, role, accent }: { address: string; role: "Creator" | "Accepter"; accent: "creator" | "accepter" }) {
  const [profile, setProfile] = useState<CardProfile>({ username: null, avatar_url: null, badge: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profile?address=${encodeURIComponent(address)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.profile) {
          setProfile({
            username: data.profile.username ?? null,
            avatar_url: data.profile.avatar_url ?? null,
            badge: null,
          });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [address]);

  const badge = profile.badge != null ? PROFILE_BADGES[profile.badge] : null;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.username || role} className="block h-full w-full object-cover" />
        ) : (
          <div className={`flex h-full w-full items-center justify-center ${accent === "creator" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-[#0052FF]"}`}>
            {accent === "creator" ? <User className="h-4 w-4" /> : <Swords className="h-4 w-4" />}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[9px] font-black uppercase tracking-wider text-[#4f6b8a]">{role}</span>
        <span className="block truncate text-[10.5px] font-black text-[#203b5b]">{profile.username ? `@${profile.username}` : shortenAddress(address)}</span>
        <div className="flex min-w-0 items-center gap-1.5">
          {badge && badge !== "None" && <span className="truncate rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[7.5px] font-black uppercase tracking-wider text-indigo-700">{badge}</span>}
          {profile.username && <span className="truncate font-mono text-[8px] text-[#6a83a0]">{shortenAddress(address)}</span>}
        </div>
      </div>
    </div>
  );
}

function tokenMeta(address: string) {
  if (address === ZERO_ADDRESS || address === "0x0000000000000000000000000000000000000000") return { symbol: "ETH", icon: "/images/eth.png" };
  const token = ALLOWED_TOKENS.find((item) => item.address.toLowerCase() === address.toLowerCase());
  const symbol = token?.symbol === "USDC" ? "USDC" : token?.symbol || "ETH";
  return { symbol, icon: `/images/${symbol.toLowerCase()}.png` };
}

type DareCardData = DareData & { proofRequired?: boolean; proofDeadline?: bigint | number };

export function DareCard({ dare }: { dare: DareCardData }) {
  const meta = tokenMeta(dare.token);
  const [now, setNow] = useState(() => Date.now());
  const url = typeof window === "undefined" ? "https://dareprotocol.com" : window.location.origin;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const share = (network: "x" | "whatsapp") => {
    const link = `${url}/dare/${dare.id}`;
    const shareText = `On-chain dare: ${dare.description.slice(0, 120)}`;
    const target = network === "x"
      ? `https://twitter.com/intent/tweet?${new URLSearchParams({ text: shareText, url: link })}`
      : `https://wa.me/?${new URLSearchParams({ text: `${shareText} ${link}` })}`;
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const zeroAddress = ZERO_ADDRESS.toLowerCase();
  const accepterAddress = dare.accepter.toLowerCase();
  const hasAccepter = accepterAddress !== zeroAddress && accepterAddress !== "0x0000000000000000000000000000000000000000";
  const deadlineMs = Number(dare.deadline) * 1000;
  const deadlinePassed = Number.isFinite(deadlineMs) && now >= deadlineMs;
  const proofRequired = Boolean((dare as DareCardData).proofRequired);
  const proofDeadlineSeconds = Number((dare as DareCardData).proofDeadline ?? 0);
  const proofWindowEndMs = (Number.isFinite(proofDeadlineSeconds) && proofDeadlineSeconds > 0)
    ? proofDeadlineSeconds * 1000
    : deadlineMs + 24 * 60 * 60 * 1000;
  const proofWindowOpen = hasAccepter && dare.status === 1 && deadlinePassed && isInProofWindow(dare.deadline) && now < proofWindowEndMs && !dare.proofSubmitted && proofRequired;
  const unacceptedExpired = dare.status === 0 && deadlinePassed && !hasAccepter;
  const acceptedExpired = hasAccepter && dare.status === 1 && deadlinePassed && proofRequired;
  const proofWindowRemaining = Math.max(0, proofWindowEndMs - now);
  const statusLabel = unacceptedExpired || acceptedExpired ? "Expired" : getStatusLabel(dare.status);
  const formatCountdown = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

  const statusStyle = unacceptedExpired
    ? {
        pill: "bg-rose-50/95 text-rose-700 border-rose-200/90 shadow-[0_2px_14px_rgba(244,63,94,0.2)]",
        dot: "bg-rose-500",
      }
    : acceptedExpired
      ? {
          pill: "bg-orange-50/95 text-orange-700 border-orange-200/90 shadow-[0_2px_14px_rgba(249,115,22,0.2)]",
          dot: "bg-orange-500",
        }
      : statusLabel === "Open"
        ? { pill: "bg-amber-50/95 text-amber-700 border-amber-200/90 shadow-[0_2px_12px_rgba(245,158,11,0.18)]", dot: "bg-amber-500" }
        : statusLabel === "Running"
          ? { pill: "bg-emerald-50/95 text-emerald-700 border-emerald-200/90 shadow-[0_2px_12px_rgba(16,185,129,0.18)]", dot: "bg-emerald-500" }
          : statusLabel === "Proof"
            ? { pill: "bg-orange-50/95 text-orange-700 border-orange-200/90 shadow-[0_2px_12px_rgba(249,115,22,0.18)]", dot: "bg-orange-500" }
            : statusLabel === "Disputed"
              ? { pill: "bg-rose-50/95 text-rose-700 border-rose-200/90 shadow-[0_2px_12px_rgba(244,63,94,0.2)]", dot: "bg-rose-500" }
              : { pill: "bg-emerald-50/95 text-emerald-700 border-emerald-200/90 shadow-[0_2px_12px_rgba(16,185,129,0.18)]", dot: "bg-emerald-500" };

  const topTime = unacceptedExpired
    ? "Deadline passed"
    : acceptedExpired
      ? proofWindowOpen
        ? `Proof window ${formatCountdown(proofWindowRemaining)} left`
        : "Proof window ended"
      : dare.status === 0 || dare.status === 1
        ? timeRemaining(dare.deadline)
        : timeAgo(dare.createdAt);

  return (
    <article className="glass-card-interactive group relative flex flex-col overflow-hidden max-md:rounded-2xl rounded-[26px] border border-slate-200/80 transition-all duration-300">
      <div className="pointer-events-none max-md:hidden absolute -top-20 -right-20 h-40 w-40 rounded-full bg-blue-100/30 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <Link href={`/dare/${dare.id}`} className="block min-w-0 max-md:p-4 p-5 sm:p-5.5">
        <div className="flex items-start justify-between gap-3">
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[10.5px] font-black tracking-wide border ${statusStyle.pill}`}>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusStyle.dot} opacity-50`} />
              <span className={`relative h-2 w-2 rounded-full ${statusStyle.dot}`} />
            </span>
            {statusLabel}
          </span>
          <span className={`min-w-0 text-right text-[10.5px] sm:text-[11.5px] font-black ${acceptedExpired ? "text-orange-700" : unacceptedExpired ? "text-rose-700" : "text-[#4f6b8a]"}`}>
            <Clock className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
            {topTime}
          </span>
        </div>

        <h2 className="mt-3.5 line-clamp-2 text-base sm:text-[17px] font-black leading-snug text-slate-900 group-hover:text-[#0052FF] transition-colors">
          {dare.description}
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/55 p-3.5">
            <span className="block text-[9.5px] font-black uppercase tracking-[0.14em] text-[#4f6b8a]">Stake each side</span>
            <div className="mt-1.5 flex items-center gap-2 font-mono text-sm sm:text-base font-black text-slate-900">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white p-0.5 shadow-xs border border-blue-100">
                <Image src={meta.icon} alt={meta.symbol} width={18} height={18} className="h-4 w-4 object-contain" />
              </div>
              <span className="truncate">{formatStake(dare.stake)} {meta.symbol}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/45 p-3.5 text-right">
            <span className="block text-[9.5px] font-black uppercase tracking-[0.14em] text-[#4f6b8a]">Matched pool</span>
            <div className="mt-1.5 font-mono text-sm sm:text-base font-black text-[#0052FF]">
              {formatStake(dare.stake * 2n)} {meta.symbol}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 text-[10px] sm:text-[11px]">
          <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2">
            <CardProfileIdentity address={dare.creator} role="Creator" accent="creator" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2">
            {hasAccepter ? (
              <CardProfileIdentity address={dare.accepter} role="Accepter" accent="accepter" />
            ) : (
              <div className="flex min-h-[44px] items-center">
                <span className="font-black text-[#0052FF]">Waiting for accepter</span>
              </div>
            )}
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2">
            <span className="block font-black uppercase tracking-wider text-[#4f6b8a]">Proof</span>
            <span className={`mt-0.5 block truncate font-bold ${dare.proofSubmitted ? "text-emerald-700" : proofRequired ? "text-orange-700" : "text-[#203b5b]"}`}>
              {dare.proofSubmitted ? "Submitted" : proofRequired ? "Required" : "Not required"}
            </span>
          </div>
        </div>
        {(proofWindowOpen || unacceptedExpired) && (
          <div className={`mt-3 flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 ${proofWindowOpen ? "dare-proof-breathe border-orange-200 bg-orange-50/80" : "dare-claim-breathe border-rose-200 bg-rose-50/80"}`}>
            <div className="flex min-w-0 items-center gap-2.5">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${proofWindowOpen ? "bg-orange-100 text-orange-600" : "bg-rose-100 text-rose-600"}`}>
                {proofWindowOpen ? <Clock className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className={`text-[10px] font-black uppercase tracking-wider ${proofWindowOpen ? "text-orange-700" : "text-rose-700"}`}>
                  {proofWindowOpen ? "Proof submitting" : "Stake recovery"}
                </div>
                <div className={`mt-0.5 truncate text-xs font-black ${proofWindowOpen ? "text-orange-900" : "text-rose-900"}`}>
                  {proofWindowOpen ? `${formatCountdown(proofWindowRemaining)} remaining` : "Dare expired without an accepter"}
                </div>
              </div>
            </div>
            {unacceptedExpired && (
              <span className="shrink-0 rounded-full border border-rose-300 bg-white px-3 py-1.5 text-[10px] font-black text-rose-700 shadow-xs">
                Claim stake back
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-end text-xs font-black text-[#0052FF]">
          View full dare <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      </Link>

      <div className="mt-auto flex items-center justify-between border-t border-blue-100/80 bg-blue-50/35 px-4 sm:px-5 py-2.5 text-xs">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-black text-[#4f6b8a]">
          <Share2 className="h-3.5 w-3.5 text-[#0052FF]" /> Share challenge
        </span>
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Share on X" onClick={() => share("x")} className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-100 bg-white text-slate-600 hover:bg-blue-50 active:scale-90 transition-all shadow-xs cursor-pointer touch-manipulation">
            <Image src="/icons/x.svg" alt="X" width={12} height={12} />
          </button>
          <button type="button" aria-label="Share on WhatsApp" onClick={() => share("whatsapp")} className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-100 bg-white text-emerald-600 hover:bg-emerald-50 active:scale-90 transition-all shadow-xs cursor-pointer touch-manipulation">
            <Image src="/icons/whatsapp.svg" alt="WhatsApp" width={12} height={12} />
          </button>
        </div>
      </div>
    </article>
  );
}
