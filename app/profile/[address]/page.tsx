"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useWeb3 } from "@/lib/web3-provider";
import { Header } from "@/components/header";
import { DareCard } from "@/components/dare-card";
import { BadgeDisplay } from "@/components/badge-display";
import type { DareData, UserStats } from "@/lib/types";
import { shortenAddress } from "@/lib/helpers";
import {
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Trophy,
  Target,
  Swords,
  Activity,
  Coins,
  ShieldCheck,
  ChevronRight,
  Pencil,
  Camera,
  X,
  Save,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const INITIAL_LIMIT = 20;
const SECOND_LIMIT = 30;
const MAX_LIMIT = 50;
const SCAN_WINDOW = 200;

const BADGES = [
  "None",
  "Rookie",
  "Challenger",
  "Contender",
  "Gladiator",
  "Champion",
  "Legend",
  "Mythic",
] as const;

const BADGE_MIN_XP = [0, 1, 500, 1000, 2000, 3000, 5000, 7500];

function badgeFromXp(xp: number) {
  for (let i = BADGE_MIN_XP.length - 1; i >= 0; i--) {
    if (xp >= BADGE_MIN_XP[i]) return i;
  }
  return 0;
}

function xpProgress(xp: number, badge: number) {
  if (badge >= 7) return 100;
  const current = BADGE_MIN_XP[badge];
  const next = BADGE_MIN_XP[badge + 1];
  return Math.min(100, Math.max(0, ((xp - current) / (next - current)) * 100));
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: paramAddress } = use(params);
  const { readContract, address: connectedAddress, signMessage } = useWeb3();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [badge, setBadge] = useState<number>(0);
  const [userDares, setUserDares] = useState<DareData[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [displayLimit, setDisplayLimit] = useState<number>(INITIAL_LIMIT);
  const [totalFound, setTotalFound] = useState<number>(0);
  const [profileMeta, setProfileMeta] = useState<{
    username: string | null;
    avatar_url: string | null;
  }>({ username: null, avatar_url: null });
  const [editingProfile, setEditingProfile] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState("");

  const profileAddress = paramAddress;
  const isOwnProfile =
    connectedAddress?.toLowerCase() === profileAddress.toLowerCase();

  const fetchProfileMeta = useCallback(async () => {
    try {
      const res = await fetch(`/api/profile?address=${encodeURIComponent(profileAddress)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setProfileMeta({
        username: data.profile?.username ?? null,
        avatar_url: data.profile?.avatar_url ?? null,
      });
    } catch {
      // Supabase profile metadata is optional; on-chain profile remains usable.
    }
  }, [profileAddress]);

  useEffect(() => {
    fetchProfileMeta();
  }, [fetchProfileMeta]);

  const handleAvatarChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileSaveError("Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileSaveError("Avatar must be 2 MB or smaller.");
      return;
    }
    setProfileSaveError("");
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    if (!connectedAddress || !isOwnProfile) return;

    const username = usernameInput.trim();
    if (username && !/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      setProfileSaveError("Username must be 3-24 characters: letters, numbers or underscore.");
      return;
    }

    setSavingProfile(true);
    setProfileSaveError("");

    try {
      const challengeRes = await fetch("/api/profile/challenge", { cache: "no-store" });
      const challengeData = await challengeRes.json();
      if (!challengeRes.ok || !challengeData?.message) throw new Error("Could not start profile verification.");
      const signature = await signMessage(challengeData.message);

      const form = new FormData();
      form.append("wallet", connectedAddress);
      form.append("username", username);
      form.append("signature", signature);
      if (avatarFile) form.append("avatar", avatarFile);

      const res = await fetch("/api/profile", {
        method: "POST",
        body: form,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Could not save profile.");
      }

      setProfileMeta({
        username: data.profile?.username ?? null,
        avatar_url: data.profile?.avatar_url ?? null,
      });
      setAvatarFile(null);
      setAvatarPreview(null);
      setEditingProfile(false);
    } catch (error: any) {
      setProfileSaveError(error?.message || "Could not save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResult, dareCount] = await Promise.all([
        readContract("getUserStats", [profileAddress]),
        readContract("dareCount"),
      ]);

      const s = statsResult as [
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint
      ];

      setStats({
        activeCountCreator: s[0],
        activeCountAccepter: s[1],
        xpPoints: s[2],
        totalWins: s[3],
        totalLosses: s[4],
        totalVolume: s[5],
        totalDisputeWins: s[6],
      });

      const xpNumber = Number(s[2]);
      setBadge(badgeFromXp(xpNumber));

      const total = Number(dareCount as bigint);
      const start = Math.max(0, total - SCAN_WINDOW);
      const found: DareData[] = [];

      for (let i = total - 1; i >= start; i--) {
        if (found.length >= MAX_LIMIT) break;
        try {
          const result = (await readContract("getDare", [BigInt(i)])) as [
            string,
            string,
            string,
            string,
            bigint,
            bigint,
            bigint,
            boolean,
            string,
            bigint,
            bigint,
            number
          ];

          const creator = result[0];
          const accepter = result[1];

          if (
            creator.toLowerCase() === profileAddress.toLowerCase() ||
            accepter.toLowerCase() === profileAddress.toLowerCase()
          ) {
            found.push({
              id: i,
              creator,
              accepter,
              description: result[2],
              token: result[3],
              stake: result[4],
              createdAt: result[5],
              deadline: result[6],
              proofSubmitted: result[7],
              proofURI: result[8],
              proofTime: result[9],
              disputeTime: result[10],
              status: result[11],
            });
          }
        } catch {
          // Ignore an unreadable dare and continue the scan.
        }
      }

      setUserDares(found);
      setTotalFound(found.length);
      setDisplayLimit(INITIAL_LIMIT);
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoading(false);
    }
  }, [profileAddress, readContract]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleCopy = () => {
    navigator.clipboard.writeText(profileAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeDaresAll = userDares.filter((d) => d.status <= 3);
  const pastDaresAll = userDares.filter((d) => d.status >= 4);
  const activeDares = activeDaresAll.slice(0, displayLimit);
  const pastDares = pastDaresAll.slice(0, displayLimit);
  const canExpand =
    !loading && totalFound > displayLimit && displayLimit < MAX_LIMIT;

  const handleExpand = () => {
    setDisplayLimit((prev) => {
      if (prev < SECOND_LIMIT) return SECOND_LIMIT;
      if (prev < MAX_LIMIT) return MAX_LIMIT;
      return prev;
    });
  };

  const xp = stats ? Number(stats.xpPoints) : 0;
  const progress = xpProgress(xp, badge);
  const nextBadge = badge < 7 ? BADGES[badge + 1] : "Max rank";
  const nextXp = badge < 7 ? BADGE_MIN_XP[badge + 1] : BADGE_MIN_XP[7];

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white text-slate-900">
      {/* Background Ambient Moving Light Spheres */}
      <div className="pointer-events-none max-md:hidden absolute -top-24 -left-20 h-96 w-96 rounded-full bg-gradient-to-br from-blue-200/20 via-indigo-100/15 to-transparent blur-3xl animate-drift" />
      <div
        className="pointer-events-none max-md:hidden absolute top-1/3 -right-24 h-[420px] w-[420px] rounded-full bg-gradient-to-bl from-rose-100/15 via-amber-100/15 to-blue-100/15 blur-3xl animate-drift"
        style={{ animationDelay: "-6s" }}
      />

      <Header />

      <main className="relative mx-auto w-full max-w-[1240px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-8 lg:pb-20 lg:pt-8">
        
        {/* Top Navigation Row */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/explore"
            className="glass-card-interactive group inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black text-slate-600 hover:text-[#0052FF] transition-all"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to Explore</span>
          </Link>
          
          <div className="glass-panel inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-black text-slate-700 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>On-Chain Identity</span>
          </div>
        </div>

        {/* User Profile Card */}
        <section className="glass-panel relative overflow-hidden rounded-[32px] p-5 sm:p-8 shadow-[0_12px_45px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start sm:items-center gap-4 sm:gap-5">
              
              {/* 3D Glass Avatar Container: strictly locked to 64px on mobile, 80px on sm */}
              <div className="relative h-16 w-16 min-w-[4rem] max-w-[4rem] sm:h-20 sm:w-20 sm:min-w-[5rem] sm:max-w-[5rem] shrink-0">
                <div className="relative flex h-full w-full items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-50 via-white to-blue-100/80 border border-blue-200/80 shadow-[0_4px_18px_rgba(0,82,255,0.14)] overflow-hidden">
                  {profileMeta.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profileMeta.avatar_url || ""}
                      alt={profileMeta.username || "Profile"}
                      className="block h-full w-full max-h-full max-w-full aspect-square object-cover"
                    />
                  ) : (
                    <UserRound className="h-8 w-8 sm:h-9 sm:w-9 text-slate-400" />
                  )}
                </div>

                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setUsernameInput(profileMeta.username || "");
                      setEditingProfile((value) => !value);
                      setProfileSaveError("");
                    }}
                    className="absolute -bottom-1.5 -right-1.5 sm:-bottom-2 sm:-right-2 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl border border-white bg-[#0052FF] text-white shadow-md transition hover:bg-[#0045d8] hover:scale-105 active:scale-90 cursor-pointer"
                    aria-label="Edit profile"
                  >
                    <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </button>
                )}
              </div>

              {/* User Address & Identity Details */}
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1 rounded-full bg-blue-50/90 border border-blue-200/70 px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-[0.16em] text-[#0052FF] shadow-xs">
                    Base Reputation
                  </div>

                  {isOwnProfile && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50/90 border border-amber-200/80 px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-amber-700 shadow-xs">
                      <Sparkles className="h-3 w-3" /> Connected Wallet
                    </span>
                  )}
                </div>

                {profileMeta.username && (
                  <div className="truncate text-xs font-bold text-slate-500 mb-0.5">
                  </div>
                )}

                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-indigo-200/80 bg-indigo-50 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-indigo-700">
                    {BADGES[badge]}
                  </span>
                </div>

                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono text-base sm:text-lg font-black text-slate-900">
                    {shortenAddress(profileAddress)}
                  </span>
                  
                  <button
                    onClick={handleCopy}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-400 hover:text-slate-900 hover:bg-slate-50 active:scale-90 transition-all shadow-xs cursor-pointer"
                    aria-label="Copy address"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-500 stroke-[3]" /> : <Copy className="h-4 w-4" />}
                  </button>

                  <a
                    href={`https://basescan.org/address/${profileAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-400 hover:text-[#0052FF] hover:bg-slate-50 active:scale-90 transition-all shadow-xs"
                    aria-label="View on BaseScan"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                <p className="mt-1 text-xs font-semibold text-slate-400 truncate sm:whitespace-normal">
                  {isOwnProfile ? "Your decentralized challenge history on Base" : "Public profile & on-chain track record"}
                </p>
              </div>
            </div>

            {/* Quick Header Metric Pills */}
            <div className="grid grid-cols-2 gap-3 sm:min-w-[260px]">
              <div className="glass-card-interactive flex flex-col justify-between rounded-2xl p-3.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Wins</span>
                <div className="mt-1.5 flex items-center gap-2 font-mono text-xl sm:text-2xl font-black text-emerald-600">
                  <Trophy className="h-5 w-5" />
                  {stats ? Number(stats.totalWins) : 0}
                </div>
              </div>
              
              <div className="glass-card-interactive flex flex-col justify-between rounded-2xl p-3.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total XP</span>
                <div className="mt-1.5 font-mono text-xl sm:text-2xl font-black text-[#0052FF]">
                  {xp.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Profile Customizer Drawer */}
        {isOwnProfile && editingProfile && (
          <section className="glass-panel mt-4 rounded-[28px] p-6 shadow-xs animate-menu-slide">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#0052FF]">
                  <Sparkles className="h-3 w-3" /> Identity Settings
                </div>
                <h2 className="mt-1 text-lg font-black text-slate-900">Customize Your Dare Profile</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">Username and avatar are stored off-chain. Your wallet reputation remains verifiable on Base.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingProfile(false);
                  setAvatarFile(null);
                  setAvatarPreview(null);
                  setProfileSaveError("");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
                aria-label="Close profile editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
              <label className="group relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition shadow-xs">
                {avatarPreview || profileMeta.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview || profileMeta.avatar_url || ""}
                    alt="Avatar preview"
                    className="block h-full w-full aspect-square object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-[#0052FF]">
                    <Camera className="h-6 w-6 stroke-[2.2]" />
                    <span className="text-[10px] font-black uppercase">Upload DP</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(event) => handleAvatarChange(event.target.files?.[0] || null)}
                />
              </label>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Custom Handle
                </label>
                <div className="mt-2 flex gap-2">
                  <div className="flex min-w-0 flex-1 items-center rounded-2xl border border-slate-200/80 bg-white px-3.5 shadow-xs">
                    <span className="text-sm font-bold text-slate-400">@</span>
                    <input
                      value={usernameInput}
                      onChange={(event) => setUsernameInput(event.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24))}
                      placeholder="your_handle"
                      className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-300"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-b from-[#0052FF] to-[#0045d8] px-5 py-3 text-xs font-black text-white shadow-[0_6px_20px_rgba(0,82,255,0.25)] active:scale-95 transition disabled:opacity-60 cursor-pointer"
                  >
                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>Save</span>
                  </button>
                </div>
                <p className="mt-2 text-[10.5px] font-semibold text-slate-400">3-24 characters (letters, numbers, underscore). Maximum avatar size: 5 MB.</p>
                {profileSaveError && (
                  <p className="mt-2 text-xs font-bold text-rose-600">{profileSaveError}</p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="glass-panel flex flex-col items-center justify-center max-md:rounded-2xl max-md:py-16 rounded-[32px] py-24 gap-3 text-center shadow-xs mt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0052FF] shadow-xs">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-500">Reading on-chain profile data from Base…</p>
          </div>
        )}

        {!loading && stats && (
          <>
            {/* Rank Showcase & Level Up Progression */}
            <section className="glass-panel mt-6 overflow-hidden max-md:rounded-2xl max-md:p-4 rounded-[30px] p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-4.5">
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 via-white to-amber-100/80 border border-amber-200/90 text-amber-600 shadow-[0_4px_16px_rgba(245,158,11,0.16)]">
                    <div className="absolute inset-1 rounded-xl bg-amber-400/10 blur-xs" />
                    <Trophy className="relative z-10 h-8 w-8 stroke-[2.2]" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Current Protocol Tier</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2.5">
                      <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">{BADGES[badge]}</h1>
                      <span className="rounded-xl border border-blue-200/80 bg-blue-50 px-2.5 py-0.5 text-xs font-black text-[#0052FF]">{xp.toLocaleString()} XP</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {badge >= 7 ? "Maximum on-chain reputation tier achieved." : `${Math.max(0, nextXp - xp).toLocaleString()} XP required to reach ${nextBadge}.`}
                    </p>
                  </div>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full lg:max-w-[500px]">
                  <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>{BADGES[badge]}</span>
                    <span className="text-[#0052FF]">{badge >= 7 ? "MAX" : nextBadge}</span>
                  </div>
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100 p-0.5 shadow-inner">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#0052FF] via-indigo-500 to-emerald-500 transition-all duration-700 shadow-xs"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="mt-1.5 text-right text-[11px] font-bold text-slate-400">{progress.toFixed(0)}% completed</div>
                </div>
              </div>

              {/* 4-Stat Border Grid */}
              <div className="mt-8 grid border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {([
                  { label: "Total Wins", value: Number(stats.totalWins), Icon: Trophy, color: "text-emerald-600" },
                  { label: "Total Losses", value: Number(stats.totalLosses), Icon: Target, color: "text-rose-500" },
                  { label: "Dispute Wins", value: Number(stats.totalDisputeWins), Icon: Swords, color: "text-amber-600" },
                  { label: "Active Dares", value: Number(stats.activeCountCreator) + Number(stats.activeCountAccepter), Icon: Activity, color: "text-[#0052FF]" },
                ] as const).map(({ label, value, Icon: StatIcon, color }) => {
                  return (
                    <div key={String(label)} className="glass-card-interactive flex flex-col justify-between rounded-2xl p-4">
                      <div className={cn("flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider", color)}>
                        <StatIcon className="h-4 w-4 stroke-[2.2]" />
                        <span>{label}</span>
                      </div>
                      <div className="mt-2 font-mono text-2xl font-black text-slate-900">{String(value)}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Sub-Metrics Row */}
            <section className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="glass-card-interactive flex flex-col max-md:rounded-xl max-md:p-4 rounded-2xl p-4.5">
                <div className="flex items-center gap-2 text-[10.5px] font-black uppercase tracking-wider text-slate-400">
                  <Coins className="h-4 w-4 text-[#0052FF]" /> Matched Volume
                </div>
                <div className="mt-2.5 font-mono text-xl font-black text-slate-900">
                  ${(Number(stats.totalVolume) / 1_000_000).toFixed(2)}
                </div>
                <div className="mt-1 text-[11px] font-medium text-slate-400">Tracked on Base smart contract escrow</div>
              </div>

              <div className="glass-card-interactive flex flex-col max-md:rounded-xl max-md:p-4 rounded-2xl p-4.5">
                <div className="flex items-center gap-2 text-[10.5px] font-black uppercase tracking-wider text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Creator Activity
                </div>
                <div className="mt-2.5 font-mono text-xl font-black text-slate-900">
                  {Number(stats.activeCountCreator)} Active
                </div>
                <div className="mt-1 text-[11px] font-medium text-slate-400">Challenges currently awaiting match or review</div>
              </div>

              <div className="glass-card-interactive flex flex-col max-md:rounded-xl max-md:p-4 rounded-2xl p-4.5">
                <div className="flex items-center gap-2 text-[10.5px] font-black uppercase tracking-wider text-slate-400">
                  <Activity className="h-4 w-4 text-[#0052FF]" /> Challenger Activity
                </div>
                <div className="mt-2.5 font-mono text-xl font-black text-slate-900">
                  {Number(stats.activeCountAccepter)} Active
                </div>
                <div className="mt-1 text-[11px] font-medium text-slate-400">Challenges accepted and currently in progress</div>
              </div>
            </section>

            {/* Dares Activity Tabs */}
            <Tabs defaultValue="active" className="mt-8">
              <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#0052FF]">
                    <Sparkles className="h-3 w-3" /> Challenge Log
                  </div>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">On-Chain History</h2>
                </div>

                <TabsList className="glass-panel grid h-12 w-full grid-cols-2 rounded-2xl p-1 sm:w-[320px] shadow-xs">
                  <TabsTrigger
                    value="active"
                    className="rounded-xl text-xs font-black transition-all data-[state=active]:bg-[#0052FF] data-[state=active]:text-white data-[state=active]:shadow-xs"
                  >
                    Active ({activeDaresAll.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="rounded-xl text-xs font-black transition-all data-[state=active]:bg-[#0052FF] data-[state=active]:text-white data-[state=active]:shadow-xs"
                  >
                    History ({pastDaresAll.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="active" className="mt-5">
                {activeDares.length === 0 ? (
                  <div className="glass-panel flex flex-col items-center justify-center rounded-[28px] border-dashed py-16 text-center text-xs sm:text-sm font-bold text-slate-400">
                    No active challenges found for this wallet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5">{activeDares.map((d) => <DareCard key={d.id} dare={d} />)}</div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-5">
                {pastDares.length === 0 ? (
                  <div className="glass-panel flex flex-col items-center justify-center rounded-[28px] border-dashed py-16 text-center text-xs sm:text-sm font-bold text-slate-400">
                    No completed challenges in protocol archive yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5">{pastDares.map((d) => <DareCard key={d.id} dare={d} />)}</div>
                )}
              </TabsContent>
            </Tabs>

            {/* Expand / Show More Button */}
            {canExpand && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={handleExpand}
                  className="glass-card-interactive inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-xs sm:text-sm font-black text-slate-700 hover:text-[#0052FF] transition cursor-pointer"
                >
                  <span>Show More Dares</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}