"use client";

import Link from "next/link";
import { LiveProtocolStats } from "@/components/live-protocol-stats";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Flame,
  Globe2,
  Layers,
  Plus,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";

export function LandingDesktop() {
  const protocolPillars = [
    {
      icon: Users,
      label: "Real People",
      tone: "from-blue-50/90 to-blue-100/60 border-blue-200/80 text-[#0052FF] shadow-[0_4px_16px_rgba(0,82,255,0.12)]",
      aura: "bg-blue-400/20",
    },
    {
      icon: Flame,
      label: "Real Stakes",
      tone: "from-amber-50/90 to-amber-100/60 border-amber-200/80 text-amber-600 shadow-[0_4px_16px_rgba(245,158,11,0.14)]",
      aura: "bg-amber-400/20",
    },
    {
      icon: ShieldCheck,
      label: "Clear Proof",
      tone: "from-emerald-50/90 to-emerald-100/60 border-emerald-200/80 text-emerald-600 shadow-[0_4px_16px_rgba(16,185,129,0.14)]",
      aura: "bg-emerald-400/20",
    },
    {
      icon: Layers,
      label: "Built on Base",
      tone: "from-indigo-50/90 to-indigo-100/60 border-indigo-200/80 text-indigo-600 shadow-[0_4px_16px_rgba(99,102,241,0.14)]",
      aura: "bg-indigo-400/20",
    },
  ];


  return (
    <main className="relative mx-auto w-full max-w-[1360px] px-6 lg:px-10 pt-8 pb-24 space-y-12 bg-white overflow-hidden">
      {/* Background Ambient Moving Light Spheres */}
      <div className="pointer-events-none absolute -top-24 -left-20 h-96 w-96 rounded-full bg-gradient-to-br from-blue-200/25 to-indigo-100/15 blur-3xl animate-drift" />
      <div
        className="pointer-events-none absolute top-96 -right-24 h-[420px] w-[420px] rounded-full bg-gradient-to-bl from-rose-100/25 via-amber-100/20 to-blue-100/20 blur-3xl animate-drift"
        style={{ animationDelay: "-6s" }}
      />

      {/* Hero Section */}
      <section className="glass-card-interactive relative overflow-hidden rounded-3xl p-10 lg:p-14 shadow-[0_8px_35px_rgba(15,23,42,0.035)]">
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Hero Copy */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-gradient-to-r from-blue-50/90 to-indigo-50/80 px-4 py-1.5 shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0052FF] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0052FF]" />
              </span>
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0052FF]">
                Base · Real Stakes · Clear Proof
              </span>
            </div>

            <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.04]">
              Dare someone.
              <br />
              <span className="text-gradient-soothing">
                Prove it on-chain.
              </span>
            </h1>

            <p className="max-w-xl text-base lg:text-lg leading-relaxed text-slate-600 font-medium">
              Turn real commitments into matched-stake challenges. The rules are visible,
              the money is escrowed, and the proof is verified before payouts release.
            </p>

            <div className="flex items-center gap-4 pt-2">
              <Link href="/create">
                <Button className="h-13 rounded-2xl bg-gradient-to-b from-[#0052FF] to-[#0045d8] hover:to-[#003bb8] px-7 text-sm font-black text-white shadow-[0_8px_24px_rgba(0,82,255,0.32)] hover:shadow-[0_12px_28px_rgba(0,82,255,0.4)] transition-all hover:-translate-y-1 active:scale-[0.98] cursor-pointer">
                  <div className="mr-2 flex h-5 w-5 items-center justify-center rounded-lg bg-white/20">
                    <Plus className="h-3.5 w-3.5 stroke-[3]" />
                  </div>
                  Create a Dare
                </Button>
              </Link>
              <Link
                href="/explore"
                className="inline-flex h-13 items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/95 px-7 text-sm font-bold text-slate-800 shadow-[0_4px_14px_rgba(15,23,42,0.03)] transition-all hover:bg-white hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(15,23,42,0.05)] active:scale-[0.98] cursor-pointer"
              >
                Explore Dares <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            </div>
          </div>

          {/* Right Protocol Pillars Card Stack with 3D Glass Icons */}
          <div className="lg:col-span-5 grid gap-3.5">
            {protocolPillars.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="glass-card-interactive group flex items-center gap-4 rounded-2xl p-4 transition-all"
                >
                  <div className={`relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br border ${item.tone} group-hover:scale-105 group-hover:rotate-3 transition-all duration-300`}>
                    <div className={`absolute inset-1 rounded-xl blur-xs ${item.aura}`} />
                    <Icon className="relative z-10 h-6 w-6 stroke-[2.2]" />
                  </div>
                  <strong className="text-base font-black text-slate-900">{item.label}</strong>
                  <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Verified
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Protocol Live Stats Cards */}
      <LiveProtocolStats />

{/* Informational 3-Column Grid with 3D Glass Icon Containers */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="glass-card-interactive group flex flex-col rounded-3xl p-7 transition-all">
          <div className="mb-5 relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50/90 via-white to-blue-100/60 border border-blue-200/80 shadow-[0_4px_16px_rgba(0,82,255,0.12)] group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
            <div className="absolute inset-1 rounded-xl bg-blue-400/10 blur-xs" />
            <Zap className="relative z-10 h-7 w-7 text-[#0052FF] stroke-[2.2]" />
          </div>
          <h3 className="text-lg font-black tracking-tight text-slate-900 mb-3">
            How it works
          </h3>
          <ol className="space-y-3 text-xs leading-relaxed text-slate-600 font-medium pl-4 list-decimal marker:text-[#0052FF] marker:font-black">
            <li>Create a dare with description, duration and stake.</li>
            <li>Someone accepts and locks the matching stake.</li>
            <li>They submit proof on time or you win by default.</li>
            <li>Creator or judge resolves the outcome on-chain.</li>
          </ol>
        </div>

        {/* Card 2 */}
        <div className="glass-card-interactive group flex flex-col rounded-3xl p-7 transition-all">
          <div className="mb-5 relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50/90 via-white to-emerald-100/60 border border-emerald-200/80 shadow-[0_4px_16px_rgba(16,185,129,0.12)] group-hover:scale-105 group-hover:-rotate-3 transition-all duration-300">
            <div className="absolute inset-1 rounded-xl bg-emerald-400/10 blur-xs" />
            <ShieldCheck className="relative z-10 h-7 w-7 text-emerald-600 stroke-[2.2]" />
          </div>
          <h3 className="text-lg font-black tracking-tight text-slate-900 mb-3">
            Protocol details
          </h3>
          <ul className="space-y-3 text-xs leading-relaxed text-slate-600 font-medium pl-4 list-disc marker:text-emerald-500">
            <li>Deployed on Base Sepolia testnet.</li>
            <li>ETH and supported ERC-20 tokens supported.</li>
            <li>XP, badges and limits reduce spam.</li>
            <li>All outcomes are strictly enforced by smart contracts.</li>
          </ul>
        </div>

        {/* Card 3 */}
        <div className="glass-card-interactive group flex flex-col rounded-3xl p-7 transition-all">
          <div className="mb-5 relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50/90 via-white to-indigo-100/60 border border-indigo-200/80 shadow-[0_4px_16px_rgba(99,102,241,0.12)] group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
            <div className="absolute inset-1 rounded-xl bg-indigo-400/10 blur-xs" />
            <Globe2 className="relative z-10 h-7 w-7 text-indigo-600 stroke-[2.2]" />
          </div>
          <h3 className="text-lg font-black tracking-tight text-slate-900 mb-3">
            Quick guide
          </h3>
          <ol className="space-y-3 text-xs leading-relaxed text-slate-600 font-medium pl-4 list-decimal marker:text-indigo-500 marker:font-black">
            <li>Connect your wallet on Base Sepolia network.</li>
            <li>Use Explore to browse live dares.</li>
            <li>Create a clear, verifiable challenge.</li>
            <li>Share the dare with friends on the web.</li>
          </ol>
        </div>
      </section>
    </main>
  );
}