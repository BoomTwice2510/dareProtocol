"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useWeb3 } from "@/lib/web3-provider";
import { Header } from "@/components/header";
import { DareDetail } from "@/components/dare-detail";
import type { DareData } from "@/lib/types";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  Clock,
  Trophy,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function DareDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { readContract } = useWeb3();
  const [dare, setDare] = useState<DareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [winnerAddress, setWinnerAddress] = useState<string | null>(null);
  const [winnerProfile, setWinnerProfile] = useState<{
    username: string | null;
    avatar_url: string | null;
    badge: number | null;
  }>({ username: null, avatar_url: null, badge: null });

  const dareId = parseInt(id, 10);

  const fetchDare = useCallback(async () => {
    if (isNaN(dareId)) {
      setError("Invalid dare ID");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = (await readContract("getDare", [BigInt(dareId)])) as [
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
      const meta = (await readContract("getDareMeta", [BigInt(dareId)])) as [
        boolean,
        bigint,
        bigint,
        bigint,
        string,
        string,
        string,
        bigint,
        bigint,
        bigint
      ];

      setDare({
        id: dareId,
        creator: result[0],
        accepter: result[1],
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
        proofRequired: meta[0],
      });

      // Fetch winner if resolved
      if (result[11] === 4) {
        try {
          const winner = (await readContract("winnerOf", [
            BigInt(dareId),
          ])) as string;
          setWinnerAddress(winner);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setError("Failed to load dare data");
    } finally {
      setLoading(false);
    }
  }, [dareId, readContract]);

  useEffect(() => {
    fetchDare();
  }, [fetchDare]);

  useEffect(() => {
    if (!winnerAddress) {
      setWinnerProfile({ username: null, avatar_url: null, badge: null });
      return;
    }

    let cancelled = false;

    fetch(`/api/profile?address=${encodeURIComponent(winnerAddress)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.profile) {
          setWinnerProfile({
            username: data.profile.username ?? null,
            avatar_url: data.profile.avatar_url ?? null,
            badge:
              data.profile.badge != null ? Number(data.profile.badge) : null,
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [winnerAddress]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white text-slate-900">
      {/* Background Ambient Moving Light Spheres */}
      <div className="pointer-events-none max-md:hidden absolute -top-24 -left-20 h-96 w-96 rounded-full bg-gradient-to-br from-blue-200/20 via-indigo-100/15 to-transparent blur-3xl animate-drift" />
      <div
        className="pointer-events-none max-md:hidden absolute top-1/3 -right-24 h-[420px] w-[420px] rounded-full bg-gradient-to-bl from-rose-100/15 via-amber-100/15 to-blue-100/15 blur-3xl animate-drift"
        style={{ animationDelay: "-6s" }}
      />

      <Header />

      <main className="relative mx-auto w-full max-w-[1240px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-8 lg:pb-20 lg:pt-8">
        
        {/* Top Navigation Row */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/explore"
            className="glass-card-interactive group inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black text-slate-600 hover:text-[#0052FF] transition-all"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
            <span>Back to Explore</span>
          </Link>

          <div className="glass-panel inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-black text-slate-700 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0052FF] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0052FF]" />
            </span>
            <span>On-Chain Escrow</span>
          </div>
        </div>

        {/* Hero Header when Loaded */}
        {dare && !loading && !error && (
          <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50/90 border border-blue-200/70 px-3 py-1 text-[10.5px] font-black uppercase tracking-[0.16em] text-[#0052FF] shadow-xs">
                <Sparkles className="h-3 w-3" />
                <span>Base Challenge Protocol</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-tight">
                Dare <span className="text-gradient-soothing">#{dareId}</span>
              </h1>

              <p className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-400">
                <Clock className="h-4 w-4 text-slate-400" />
                Created on {new Date(Number(dare.createdAt) * 1000).toLocaleDateString()} at {new Date(Number(dare.createdAt) * 1000).toLocaleTimeString()}
              </p>
            </div>

            {/* Winner Badge Card */}
            {winnerAddress &&
              winnerAddress !==
                "0x0000000000000000000000000000000000000000" && (
                <Link
                  href={`/profile/${winnerAddress}`}
                  className="glass-card-interactive group flex items-center gap-3.5 rounded-2xl p-3.5 shadow-xs"
                >
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 via-white to-emerald-100/80 border border-emerald-200/80 text-emerald-600 shadow-xs group-hover:scale-105 transition-transform">
                    <div className="absolute inset-1 rounded-lg bg-emerald-400/10 blur-xs" />
                    <Trophy className="relative z-10 h-5 w-5 stroke-[2.2]" />
                  </div>
                  
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                      Verified Winner
                    </span>
                    <span className="font-mono text-xs sm:text-sm font-black text-slate-900 group-hover:text-[#0052FF] transition-colors">
                      {winnerAddress.slice(0, 6)}...{winnerAddress.slice(-4)}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors">
                      View profile <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              )}
          </section>
        )}

        {/* Loading Skeleton View */}
        {loading && (
          <div className="glass-panel flex flex-col items-center justify-center rounded-[30px] py-24 gap-3.5 text-center shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0052FF] shadow-xs">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-500">
              Fetching verified on-chain dare data from Base...
            </p>
          </div>
        )}

        {/* Error Feedback View */}
        {error && !loading && (
          <div className="glass-panel flex flex-col items-center justify-center rounded-[30px] border-rose-200 py-20 gap-3 text-center shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 shadow-xs">
              <AlertCircle className="h-6 w-6" />
            </div>
            <p className="text-base font-black text-slate-900">{error}</p>
            <p className="text-xs text-slate-400 font-medium">
              Please check your wallet connection and network, then refresh.
            </p>
          </div>
        )}

        {/* Dare Content Core Wrapper */}
        {dare && !loading && !error && (
          <div className="glass-panel relative rounded-[32px] p-5 sm:p-7 md:p-8 shadow-[0_12px_45px_rgba(15,23,42,0.04)]">
            <DareDetail dare={dare} onRefresh={fetchDare} />
          </div>
        )}
      </main>
    </div>
  );
}