"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { keccak256, stringToHex, formatEther } from "viem";
import { useWeb3 } from "@/lib/web3-provider";
import { Header } from "@/components/header";
import {
  Scale, ShieldCheck, RefreshCw, Loader2, AlertTriangle, ExternalLink,
  Clock3, FileText, CheckCircle2, XCircle, Gavel, Wallet, ArrowUpRight,
} from "lucide-react";

const ZERO = "0x0000000000000000000000000000000000000000";
const EXPLORER = "https://sepolia.basescan.org";

type Evidence = { submitter: string; uri: string; contentHash: string; submittedAt: bigint };
type Dispute = {
  id: number; creator: string; accepter: string; description: string; token: string;
  stake: bigint; createdAt: bigint; disputeTime: bigint; status: number;
  evidenceDeadline: bigint; evidence: Evidence[];
};

function short(address: string) { return `${address.slice(0, 6)}…${address.slice(-4)}`; }
function dateTime(value: bigint) {
  if (!value) return "Not available";
  return new Date(Number(value) * 1000).toLocaleString();
}
function errorText(error: any) {
  return error?.shortMessage || error?.message?.split("\n")[0] || "Transaction failed. Please try again.";
}

export default function JudgePage() {
  const { address, isConnected, chainId, connect, readContract, writeContract, publicClient } = useWeb3();
  const [judgeAddress, setJudgeAddress] = useState<string | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [clockNow, setClockNow] = useState(() => Math.floor(Date.now() / 1000));

  // Keep deadline-based controls in sync without requiring a manual page refresh.
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Math.floor(Date.now() / 1000)), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const isJudge = Boolean(address && judgeAddress && address.toLowerCase() === judgeAddress.toLowerCase());
  const isBaseSepolia = chainId === 84532;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const configuredJudge = await readContract("judge", []);
      setJudgeAddress(String(configuredJudge));
      const count = Number(await readContract("dareCount", []));
      const start = Math.max(0, count - 300);
      const found: Dispute[] = [];
      for (let id = count - 1; id >= start; id--) {
        try {
          const [d, meta] = await Promise.all([
            readContract("getDare", [BigInt(id)]),
            readContract("getDareMeta", [BigInt(id)]),
          ]);
          if (Number(d[11]) !== 3) continue;
          const evidenceCount = Number(await readContract("getEvidenceCount", [BigInt(id)]));
          const evidence: Evidence[] = [];
          for (let i = 0; i < Math.min(evidenceCount, 20); i++) {
            try {
              const item = await readContract("getEvidence", [BigInt(id), BigInt(i)]);
              // viem versions/RPCs may expose a returned Solidity struct as either
              // a positional tuple or a named object. Handle both representations.
              const result = item as any;
              const row = Array.isArray(result) && result.length === 1 ? result[0] : result;
              const submitter = row?.submitter ?? row?.[0];
              const uri = row?.uri ?? row?.[1];
              const contentHash = row?.contentHash ?? row?.[2];
              const submittedAt = row?.submittedAt ?? row?.[3];
              if (submitter && uri != null && contentHash && submittedAt != null) {
                evidence.push({ submitter: String(submitter), uri: String(uri), contentHash: String(contentHash), submittedAt: BigInt(submittedAt) });
              }
            } catch { /* keep the rest of the evidence visible */ }
          }
          found.push({
            id, creator: String(d[0]), accepter: String(d[1]), description: String(d[2]),
            token: String(d[3]), stake: BigInt(d[4]), createdAt: BigInt(d[5]),
            disputeTime: BigInt(d[10]), status: Number(d[11]), evidenceDeadline: BigInt(meta[3]), evidence,
          });
        } catch { /* ignore a single unreadable dare */ }
      }
      setDisputes(found);
    } catch (e: any) {
      setError(errorText(e));
    } finally { setLoading(false); }
  }, [readContract]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => ({
    open: disputes.length,
    evidenceReady: disputes.filter((d) => BigInt(clockNow) >= d.evidenceDeadline).length,
  }), [disputes, clockNow]);

  async function resolve(dispute: Dispute, creatorWins: boolean) {
    const reason = (reasons[dispute.id] || "").trim();
    if (reason.length < 8) { setError("Resolution reason must be at least 8 characters."); return; }
    if (!isJudge) { setError("Only the contract's designated judge wallet can resolve disputes."); return; }
    if (!isBaseSepolia) { setError("Switch your wallet to Base Sepolia before resolving."); return; }
    setBusyId(dispute.id); setError(""); setNotice("");
    try {
      const reasonHash = keccak256(stringToHex(reason));
      const hash = await writeContract("judgeResolve", [BigInt(dispute.id), creatorWins, reasonHash]);
      setNotice(`Resolution submitted for Dare #${dispute.id}. Waiting for on-chain confirmation…`);
      await publicClient.waitForTransactionReceipt({ hash });
      setNotice(`Dare #${dispute.id} has been resolved on-chain.`);
      await load();
    } catch (e: any) { setError(errorText(e)); }
    finally { setBusyId(null); }
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700 shadow-sm"><Scale size={14}/> Judge console</div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Dispute resolution</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Review submitted evidence and resolve disputed Dares. Decisions are recorded by the smart contract.</p>
          </div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/> Refresh disputes</button>
        </div>

        {!isConnected ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Wallet size={26}/></div>
            <h2 className="text-xl font-extrabold">Connect the judge wallet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">This console is restricted to the judge address configured in the DareProtocol contract.</p>
            <button onClick={() => void connect()} className="mt-5 rounded-xl bg-[#0052FF] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_0_#003bc4] transition hover:-translate-y-0.5">Connect wallet</button>
          </section>
        ) : !judgeAddress ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading the judge address from the contract…</section>
        ) : !isJudge ? (
          <section className="rounded-3xl border border-amber-200 bg-white p-7 shadow-sm sm:p-10">
            <div className="flex items-start gap-4"><div className="rounded-2xl bg-amber-50 p-3 text-amber-600"><ShieldCheck size={26}/></div><div><h2 className="text-xl font-extrabold">Judge access only</h2><p className="mt-2 text-sm leading-6 text-slate-600">The connected wallet is not the judge configured in the smart contract. The dispute list and resolution controls are hidden.</p><div className="mt-4 grid gap-2 text-xs sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><span className="block font-semibold text-slate-400">Connected wallet</span><code className="mt-1 block break-all text-slate-700">{address}</code></div><div className="rounded-xl bg-slate-50 p-3"><span className="block font-semibold text-slate-400">Designated judge</span><code className="mt-1 block break-all text-slate-700">{judgeAddress}</code></div></div></div></div>
          </section>
        ) : (
          <>
            <section className="mb-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_5px_18px_rgba(15,23,42,.04)]"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Disputed Dares</p><p className="mt-2 text-3xl font-black">{stats.open}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_5px_18px_rgba(15,23,42,.04)]"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Evidence window ended</p><p className="mt-2 text-3xl font-black text-emerald-600">{stats.evidenceReady}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_5px_18px_rgba(15,23,42,.04)]"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Judge wallet</p><p className="mt-2 truncate text-sm font-extrabold">{short(address || "")}</p><p className="mt-1 text-xs text-emerald-600">Contract-authorized</p></div>
            </section>
            {!isBaseSepolia && <div className="mb-5 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><AlertTriangle size={18} className="shrink-0"/> Switch the connected wallet to Base Sepolia before submitting a resolution.</div>}
            {error && <div role="alert" className="mb-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><AlertTriangle size={18} className="shrink-0"/>{error}</div>}
            {notice && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
            {loading ? <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-sm text-slate-500"><Loader2 className="animate-spin" size={20}/> Loading disputed Dares…</div> : disputes.length === 0 ? <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm"><CheckCircle2 className="mx-auto text-emerald-500" size={34}/><h2 className="mt-3 text-xl font-extrabold">No open disputes</h2><p className="mt-2 text-sm text-slate-500">No disputed Dares were found in the latest 300 contract records.</p></div> : <div className="space-y-5">{disputes.map((d) => {
              const now = BigInt(clockNow);
              const evidenceOpen = now < d.evidenceDeadline;
              const judgeWindowEnd = d.disputeTime + 48n * 60n * 60n;
              const judgeWindowOpen = now <= judgeWindowEnd;
              const canResolve = !evidenceOpen && judgeWindowOpen;
              return <article key={d.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,.055)]">
                <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-rose-700">Disputed</span><span className="text-xs font-bold text-slate-400">DARE #{d.id}</span></div><h2 className="mt-3 text-lg font-extrabold leading-snug">{d.description}</h2><p className="mt-2 text-xs text-slate-500">Disputed: {dateTime(d.disputeTime)}</p></div><div className="shrink-0 rounded-2xl bg-slate-50 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Stake each side</p><p className="mt-1 text-lg font-black">{d.token.toLowerCase() === ZERO.toLowerCase() ? `${formatEther(d.stake)} ETH` : `${(Number(d.stake) / 1e6).toFixed(2)} USDC`}</p></div></div>
                <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6"><div className="rounded-xl border border-slate-100 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Creator</p><code className="mt-1 block break-all text-xs text-slate-700">{d.creator}</code><a className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600" href={`${EXPLORER}/address/${d.creator}`} target="_blank" rel="noreferrer">View wallet <ArrowUpRight size={12}/></a></div><div className="rounded-xl border border-slate-100 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Accepter</p><code className="mt-1 block break-all text-xs text-slate-700">{d.accepter === ZERO ? "Not accepted" : d.accepter}</code>{d.accepter !== ZERO && <a className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600" href={`${EXPLORER}/address/${d.accepter}`} target="_blank" rel="noreferrer">View wallet <ArrowUpRight size={12}/></a>}</div></div>
                <div className="px-5 pb-5 sm:px-6"><div className={`mb-4 flex items-start gap-2 rounded-xl p-3 text-xs ${evidenceOpen ? "bg-amber-50 text-amber-800" : canResolve ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}><Clock3 size={15} className="mt-0.5 shrink-0"/><span>{evidenceOpen ? `Evidence window ends ${dateTime(d.evidenceDeadline)}. Contract will reject resolution until then.` : canResolve ? `Evidence window ended. Judge resolution window ends ${dateTime(judgeWindowEnd)}.` : `Judge resolution window ended ${dateTime(judgeWindowEnd)}. The contract may no longer accept judge resolution.`}</span></div>
                  <div className="mb-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold"><FileText size={16}/> Submitted evidence ({d.evidence.length})</h3>{d.evidence.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No evidence entries found on-chain.</p> : <div className="space-y-2">{d.evidence.map((ev, i) => <div key={`${ev.contentHash}-${i}`} className="rounded-xl border border-slate-100 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-slate-700">Submitted by {short(ev.submitter)}</span><span className="text-[11px] text-slate-400">{dateTime(ev.submittedAt)}</span></div><a href={ev.uri} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 break-all text-xs font-bold text-blue-600 hover:underline">{ev.uri}<ExternalLink size={12} className="shrink-0"/></a><p className="mt-2 break-all font-mono text-[10px] text-slate-400">Hash: {ev.contentHash}</p></div>)}</div>}</div>
                  <label htmlFor={`reason-${d.id}`} className="mb-2 block text-sm font-extrabold">Resolution rationale <span className="font-normal text-slate-400">(hashed on-chain)</span></label><textarea id={`reason-${d.id}`} value={reasons[d.id] || ""} onChange={(e) => setReasons((p) => ({ ...p, [d.id]: e.target.value }))} maxLength={1000} placeholder="Summarize why the evidence supports your decision…" className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"/><p className="mt-1 text-[11px] text-slate-400">Only the reason hash is stored on-chain. Keep your detailed notes in your case records.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2"><button disabled={!canResolve || !isBaseSepolia || busyId !== null || (reasons[d.id] || "").trim().length < 8} onClick={() => void resolve(d, true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white shadow-[0_4px_0_#047857] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"><CheckCircle2 size={17}/>{busyId === d.id ? "Waiting for wallet…" : "Rule for creator"}</button><button disabled={!canResolve || !isBaseSepolia || busyId !== null || (reasons[d.id] || "").trim().length < 8 || d.accepter === ZERO} onClick={() => void resolve(d, false)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-4 py-3 text-sm font-extrabold text-white shadow-[0_4px_0_#003bc4] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"><Gavel size={17}/>{busyId === d.id ? "Waiting for wallet…" : "Rule for accepter"}</button></div>
                  <p className="mt-3 text-[11px] leading-5 text-slate-400">Resolution is irreversible once confirmed. Verify both parties, evidence and deadlines before submitting. The contract enforces judge permissions and timing.</p>
                  {evidenceOpen && <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">Decision buttons are locked until the 24-hour evidence window ends. This is enforced by the deployed smart contract, so an earlier ruling would revert. Keep reviewing the evidence; the buttons will unlock when the deadline passes.</p>}
                  {!evidenceOpen && !judgeWindowOpen && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold leading-5 text-rose-700">The judge resolution window has expired. The deployed contract will reject a new ruling for this dispute.</p>}
                  {!evidenceOpen && judgeWindowOpen && (reasons[d.id] || "").trim().length < 8 && <p className="mt-3 text-[11px] font-semibold text-amber-700">Enter a resolution rationale of at least 8 characters to enable the decision buttons.</p>}
                  <div className="mt-3"><Link href={`/dare/${d.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">Open public Dare page <ArrowUpRight size={12}/></Link></div>
                </div>
              </article>;
            })}</div>}
          </>
        )}
      </main>
    </div>
  );
}
