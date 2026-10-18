"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileCode2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

type Transaction = {
  hash: string;
  blockNumber: number | null;
  timestamp: string | null;
  from: string | null;
  to: string | null;
  value: string;
  fee: string | null;
  result: string | null;
  method: string | null;
  status: string | null;
};

type ActivityResponse = {
  source: string;
  chain: string;
  chainId: number;
  contractAddress: string;
  explorerBase: string;
  contract?: {
    name: string | null;
    isContract: boolean | null;
    isVerified: boolean | null;
    transactionCount: number | string | null;
    coinBalance: string | null;
  };
  transactions?: Transaction[];
  fetchedAt?: string;
  error?: string;
};

function shortAddress(value?: string | null) {
  if (!value) return "Unknown";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Timestamp unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatEth(value?: string | null) {
  if (value == null) return "0 ETH";
  try {
    const amount = Number(value) / 1e18;
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`;
  } catch {
    return "Value unavailable";
  }
}

export default function OnchainPage() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/blockscout/activity", { cache: "no-store" });
      const payload = (await response.json()) as ActivityResponse;
      if (!response.ok) throw new Error(payload.error || "Blockscout request failed.");
      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load Blockscout data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadActivity(); }, [loadActivity]);

  const explorer = data?.explorerBase || "https://base-sepolia.blockscout.com";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-16 lg:pt-12">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#0052FF]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> LIVE EXPLORER DATA
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">On-chain Activity</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              DareProtocol contract activity fetched directly from Blockscout API v2 on Base Sepolia.
            </p>
          </div>
          <button onClick={() => void loadActivity()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-[#0052FF] disabled:opacity-60 sm:self-auto">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh data
          </button>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.035)]">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0052FF]"><FileCode2 className="h-5 w-5" /></div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Network</p>
            <p className="mt-1 text-xl font-black">Base Sepolia</p>
            <p className="mt-1 text-xs text-slate-500">Chain ID 84532 · Testnet</p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.035)]">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><ShieldCheck className="h-5 w-5" /></div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Contract verification</p>
            <p className="mt-1 text-xl font-black">{loading ? "Checking…" : data?.contract?.isVerified === true ? "Verified" : data?.contract?.isVerified === false ? "Not verified" : "Not reported"}</p>
            <p className="mt-1 text-xs text-slate-500">Status returned by Blockscout</p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.035)]">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Activity className="h-5 w-5" /></div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Transactions fetched</p>
            <p className="mt-1 text-xl font-black">{loading ? "Loading…" : error ? "Unavailable" : (data?.transactions?.length ?? 0).toLocaleString()}</p>
            <p className="mt-1 text-xs text-slate-500">Transactions returned in this API response</p>
          </section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.035)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black">Recent contract transactions</h2>
              <p className="mt-1 text-xs text-slate-500">Live results from the Blockscout address transactions endpoint.</p>
            </div>
            {data?.contractAddress && <a href={`${explorer}/address/${data.contractAddress}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0052FF] hover:underline">View contract in Blockscout <ExternalLink className="h-3.5 w-3.5" /></a>}
          </div>

          {error && <div className="m-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Blockscout data could not be loaded</p><p className="mt-1 break-words text-xs leading-5">{error}</p><p className="mt-2 text-xs">Check the API host configuration or try again shortly. The page does not substitute mock transactions.</p></div></div>}

          {loading && !data ? <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div> : null}

          {!loading && !error && data?.transactions?.length === 0 && <div className="p-10 text-center"><Activity className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-bold text-slate-800">No indexed transactions returned</p><p className="mt-1 text-sm text-slate-500">The API responded successfully, but this address has no transactions in the returned page.</p></div>}

          {data?.transactions && data.transactions.length > 0 && <div className="divide-y divide-slate-100">
            {data.transactions.map((tx) => <div key={tx.hash} className="flex flex-col gap-3 p-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tx.result?.toLowerCase().includes("success") || tx.status?.toLowerCase().includes("ok") ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-[#0052FF]"}`}><CheckCircle2 className="h-4 w-4" /></div>
                <div className="min-w-0">
                  <a href={`${explorer}/tx/${tx.hash}`} target="_blank" rel="noreferrer" className="block truncate font-mono text-xs font-bold text-[#0052FF] hover:underline">{shortAddress(tx.hash)}</a>
                  <p className="mt-1 truncate text-xs text-slate-500">{tx.method || "Contract interaction"} · Block {tx.blockNumber?.toLocaleString() ?? "N/A"}</p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><Clock3 className="h-3 w-3" />{formatDate(tx.timestamp)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 pl-12 sm:justify-end sm:pl-0">
                <div className="text-left sm:text-right"><p className="text-sm font-black text-slate-800">{formatEth(tx.value)}</p><p className="mt-1 text-[11px] text-slate-400">{tx.from ? `From ${shortAddress(tx.from)}` : "Sender unavailable"}</p></div>
                <a href={`${explorer}/tx/${tx.hash}`} target="_blank" rel="noreferrer" aria-label="Open transaction in Blockscout" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-blue-200 hover:text-[#0052FF]"><ExternalLink className="h-4 w-4" /></a>
              </div>
            </div>)}
          </div>}
          <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-[11px] text-slate-500">
            Data provider: <strong className="text-slate-700">{data?.source || "Blockscout API v2"}</strong>{data?.fetchedAt ? ` · Last fetched ${formatDate(data.fetchedAt)}` : ""}. API results may be delayed or incomplete.
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6">
          <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#0052FF] shadow-sm"><ArrowDownLeft className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h2 className="font-black text-slate-900">Explorer-backed transparency</h2><p className="mt-1 text-sm leading-6 text-slate-600">This view reads contract metadata and transaction history from Blockscout. DareProtocol contract state and settlement rules still come from the deployed smart contract, not from the explorer index.</p><div className="mt-4 flex flex-wrap gap-3"><a href={`${explorer}/address/${data?.contractAddress || ""}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#0052FF] px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700">Open contract <ExternalLink className="h-3.5 w-3.5" /></a><Link href="/explore" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:border-blue-200 hover:text-[#0052FF]"><ArrowUpRight className="h-3.5 w-3.5" /> Explore dares</Link></div></div></div>
        </section>
      </main>
    </div>
  );
}
