"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWeb3 } from "@/lib/web3-provider";
import { ALLOWED_TOKENS, DARE_ABI, TOKEN_MAP, ZERO_ADDRESS } from "@/lib/contract";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coins,
  FileCheck2,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { formatUnits, parseUnits, type Address } from "viem";
import Image from "next/image";

const CREATE_TOKENS = ALLOWED_TOKENS.filter((t) => t.symbol === "ETH" || t.symbol === "USDC");
const FALLBACK_MAX_DURATION_SECONDS = 7 * 24 * 60 * 60;

type ProofMode = "required" | "none";

export function CreateDareForm() {
  const { isConnected, address, writeContract, approveToken, getAllowance, connect, readContract } = useWeb3();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<1 | 2>(1);
  const [description, setDescription] = useState<string>("");
  const [durationValue, setDurationValue] = useState(3);
  const [durationType, setDurationType] = useState<"hours" | "days">("days");
  const [token, setToken] = useState<string>(ZERO_ADDRESS);
  const [stake, setStake] = useState("");
  const [proofMode, setProofMode] = useState<ProofMode>("required");
  const [proofSample, setProofSample] = useState<string>("");
  const [samplesExpanded, setSamplesExpanded] = useState(false);
  const [provable, setProvable] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
  const [contractLimits, setContractLimits] = useState<{
    minStake: bigint;
    maxUsdStake6: bigint;
    maxDuration: bigint;
    feeBps: bigint;
  } | null>(null);
  const [limitsLoading, setLimitsLoading] = useState(true);

  const selectedToken = useMemo(
    () => CREATE_TOKENS.find((t) => t.address === token) ?? CREATE_TOKENS[0],
    [token],
  );
  const symbol = selectedToken?.symbol ?? "ETH";
  const tokenMeta = TOKEN_MAP[token] ?? { decimals: symbol === "USDC" ? 6 : 18 };
  const isETH = token === ZERO_ADDRESS;
  const maxDurationSeconds = contractLimits?.maxDuration
    ? Number(contractLimits.maxDuration)
    : FALLBACK_MAX_DURATION_SECONDS;
  const maxHours = Math.max(1, Math.floor(maxDurationSeconds / 3600));
  const maxDays = Math.max(1, Math.floor(maxDurationSeconds / 86400));
  const durationSeconds = durationType === "hours" ? durationValue * 3600 : durationValue * 86400;
  const stakeUnits = stake ? parseUnits(stake, tokenMeta.decimals) : 0n;
  const totalPot = stake ? Number(stake) * 2 : 0;
  const feeRate = contractLimits ? Number(contractLimits.feeBps) / 10000 : 0;
  const platformFee = totalPot * feeRate;
  const winnerAmount = totalPot - platformFee;

  useEffect(() => {
    let cancelled = false;
    async function loadLimits() {
      setLimitsLoading(true);
      try {
        const [minEthResult, minUsdcResult, maxUsdResult, maxDurationResult, feeBpsResult] = await Promise.all([
          readContract("MIN_ETH_STAKE"),
          readContract("MIN_USDC_STAKE"),
          readContract("MAX_USD_STAKE_6"),
          readContract("MAX_DURATION"),
          readContract("feeBps"),
        ]);

        const minStake = token === ZERO_ADDRESS
          ? (minEthResult as bigint)
          : (minUsdcResult as bigint);
        const maxUsdStake6 = maxUsdResult as bigint;
        const maxDuration = maxDurationResult as bigint;
        const feeBps = feeBpsResult as bigint;

        if (!cancelled) {
          setContractLimits({
            minStake,
            maxUsdStake6,
            maxDuration,
            feeBps,
          });
        }
      } catch (err) {
        console.error("Unable to read current contract limits", err);
        if (!cancelled) {
          setContractLimits((previous) => previous ?? {
            minStake: 0n,
            maxUsdStake6: 500_000_000n,
            maxDuration: BigInt(FALLBACK_MAX_DURATION_SECONDS),
            feeBps: 300n,
          });
        }
      } finally {
        if (!cancelled) setLimitsLoading(false);
      }
    }
    loadLimits();
    return () => {
      cancelled = true;
    };
  }, [readContract, token]);

  useEffect(() => {
    if (!contractLimits) return;
    if (durationSeconds <= maxDurationSeconds) return;
    if (maxDays >= 1 && maxDurationSeconds >= 86400) {
      setDurationType("days");
      setDurationValue(maxDays);
    } else {
      setDurationType("hours");
      setDurationValue(maxHours);
    }
  }, [contractLimits, durationSeconds, maxDurationSeconds, maxDays, maxHours]);

  useEffect(() => {
    const title = searchParams.get("flashTitle");
    const desc = searchParams.get("flashDesc");
    const proof = searchParams.get("flashProof");
    const deadlineStr = searchParams.get("flashDeadline");

    if (!title || !desc || !proof || !deadlineStr) return;

    const deadline = Number(deadlineStr);
    if (!deadline || Number.isNaN(deadline)) return;

    const isDays = deadline % 86400 === 0;
    const nextType: "hours" | "days" = isDays ? "days" : "hours";
    const nextValue = Math.max(1, isDays ? Math.min(maxDays, deadline / 86400) : Math.min(maxHours, Math.round(deadline / 3600)));

    setDescription(`${title}\n\n${desc}`);
    setProofMode("required");
    setProofSample(proof);
    setDurationType(nextType);
    setDurationValue(nextValue);
  }, [searchParams, maxDays, maxHours]);

  const createAbiItem = DARE_ABI.find(
    (item: any) => item?.type === "function" && item?.name === "createDare",
  ) as any;
  const createInputs = createAbiItem?.inputs ?? [];
  const hasDedicatedProofArgument = createInputs.length === 5 && createInputs[4]?.type === "bool";

  const proofText = proofMode === "required"
    ? `Proof required: ${proofSample.trim() || "Provide clear evidence that an accepter can independently inspect."}`
    : "Proof required: No. Outcome is resolved by the protocol rules without submitted evidence.";

  const finalDescription = hasDedicatedProofArgument
    ? description.trim()
    : `${description.trim()}\n\n${proofText}`.trim();

  function validateForReview() {
    setError("");
    if (!description.trim()) return setError("Describe exactly what the accepter must do.");
    if (description.trim().length < 12) return setError("Make the dare specific enough to be objectively checked.");
    if (limitsLoading || !contractLimits) return setError("Contract limits are not available yet. Refresh after the current contract is loaded.");
    if (!stake || Number(stake) <= 0) return setError("Enter a stake amount.");
    if (stakeUnits < contractLimits.minStake) return setError(`Stake is below the contract minimum (${formatUnits(contractLimits.minStake, tokenMeta.decimals)} ${symbol}).`);
    if (durationSeconds > maxDurationSeconds) return setError(`Duration exceeds the contract maximum of ${formatDuration(maxDurationSeconds)}.`);
    if (proofMode === "required" && !proofSample.trim()) return setError("Add a provable sample so the accepter knows what evidence counts.");
    setProvable(null);
    setSamplesExpanded(false);
    setStep(2);
  }

  async function createDare() {
    setError("");

    if (provable !== true) {
      setError("Confirm Yes: the accepter can prove this dare from the stated evidence.");
      return;
    }

    if (!isConnected || !address) {
      await connect();
      return;
    }

    if (!description.trim() || !stake) {
      setStep(1);
      setError("Complete the dare details first.");
      return;
    }

    if (!contractLimits) {
      setError("Contract limits are not available yet. Refresh after the current contract is loaded.");
      setStep(1);
      return;
    }
    if (stakeUnits < contractLimits.minStake) {
      setError(`Stake is below the contract minimum (${formatUnits(contractLimits.minStake, tokenMeta.decimals)} ${symbol}).`);
      setStep(1);
      return;
    }
    if (durationSeconds > maxDurationSeconds) {
      setError(`Duration exceeds the contract maximum of ${formatDuration(maxDurationSeconds)}.`);
      setStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      if (!isETH) {
        const allowance = await getAllowance(token as Address, address);
        if (allowance < stakeUnits) {
          await approveToken(token as Address, stakeUnits);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }

      const createAbi = DARE_ABI.find(
        (item: any) => item?.type === "function" && item?.name === "createDare",
      ) as any;
      const inputs = createAbi?.inputs ?? [];
      const args: any[] = [finalDescription, BigInt(durationSeconds), token as Address, stakeUnits];

      if (inputs.length === 5) {
        const fifthType = inputs[4]?.type;
        if (fifthType === "bool") args.push(proofMode === "required");
        else if (fifthType === "string") args.push(proofSample.trim());
        else if (fifthType?.startsWith("bytes")) args.push(proofSample.trim());
        else throw new Error(`Unsupported createDare ABI fifth parameter: ${fifthType}`);
      } else if (inputs.length !== 4) {
        throw new Error(`createDare ABI expects ${inputs.length} parameters; update the frontend ABI to match the deployed contract.`);
      }

      const txHash = await writeContract(
        "createDare",
        args,
        isETH ? stakeUnits : undefined,
      );

      setSuccessTxHash(typeof txHash === "string" ? txHash : null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      setError(message.includes("Wait") ? "Please wait before creating another dare." : message.slice(0, 220));
    } finally {
      setIsSubmitting(false);
    }
  }

  /* Success Confirmation Screen */
  if (successTxHash) {
    return (
      <div className="glass-card-interactive mx-auto max-w-2xl max-md:rounded-2xl max-md:p-4 rounded-[30px] p-6 sm:p-9 shadow-[0_12px_45px_rgba(16,185,129,0.08)]">
        <div className="flex items-start gap-4 sm:gap-5">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70 border border-emerald-200/80 shadow-[0_6px_20px_rgba(16,185,129,0.18)]">
            <div className="absolute inset-1 rounded-xl bg-emerald-400/10 blur-xs" />
            <CheckCircle2 className="relative z-10 h-8 w-8 text-emerald-600 stroke-[2.2]" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/90 border border-emerald-200/70 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Dare Live On-Chain
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              Challenge Locked in Escrow
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-600 font-medium">
              Your challenge configuration was signed and deposited directly to the Base Sepolia contract.
            </p>
          </div>
        </div>

        {successTxHash && (
          <a
            href={`https://sepolia.basescan.org/tx/${successTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-xs sm:text-sm font-bold text-[#0052FF] shadow-xs hover:bg-slate-50/80 hover:border-[#0052FF]/30 transition-all cursor-pointer"
          >
            <span>View verified transaction on BaseScan</span>
            <ChevronRight className="h-4 w-4" />
          </a>
        )}

        <Button
          onClick={() => router.push("/explore")}
          className="mt-4 h-12 w-full rounded-2xl bg-gradient-to-b from-[#0052FF] to-[#0045d8] text-white text-sm font-black shadow-[0_6px_20px_rgba(0,82,255,0.28)] hover:shadow-[0_8px_24px_rgba(0,82,255,0.36)] active:scale-[0.98] transition-all cursor-pointer"
        >
          Explore Live Dares
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden max-md:rounded-2xl max-md:shadow-none rounded-[28px] shadow-[0_8px_35px_rgba(15,23,42,0.035)]">
      {/* Visual Stepper Bar */}
      <div className="border-b border-slate-100/90 bg-white/70 px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black transition-all shadow-xs",
              step === 1
                ? "bg-gradient-to-br from-[#0052FF] to-[#0045d8] text-white ring-4 ring-blue-100/70"
                : "bg-emerald-500 text-white"
            )}
          >
            {step === 1 ? "1" : <Check className="h-4 w-4 stroke-[3]" />}
          </div>
          <div className="h-0.5 flex-1 bg-gradient-to-r from-blue-100 to-slate-100 rounded-full" />
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black transition-all shadow-xs",
              step === 2
                ? "bg-gradient-to-br from-[#0052FF] to-[#0045d8] text-white ring-4 ring-blue-100/70"
                : "bg-slate-100 text-slate-400"
            )}
          >
            2
          </div>
          <div className="text-xs font-black text-slate-800 tracking-tight">
            {step === 1 ? "1. Configure Challenge" : "2. Review & Deposit"}
          </div>
        </div>
      </div>

      {step === 1 ? (
        <form onSubmit={(e) => { e.preventDefault(); validateForReview(); }} className="max-md:p-4 p-5 sm:p-7 md:p-8">
          <div className="grid gap-5 lg:gap-7 lg:grid-cols-[1.45fr_0.8fr]">
            
            {/* Left Configuration Column */}
            <div className="space-y-6">
              
              {/* Sample Tasks + Task Description */}
              <section className="space-y-3">
                <div className="rounded-2xl border border-pink-200 bg-pink-50/90 p-4 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setSamplesExpanded((value) => !value)}
                    className="flex min-h-11 w-full items-start gap-3 text-left touch-manipulation"
                    aria-expanded={samplesExpanded}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-100 text-pink-600">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-pink-600">
                        Sample Tasks
                      </div>
                      <div className="mt-0.5 text-sm font-black text-slate-900">
                        Need an idea? Pick a proven challenge
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                        Tap to browse examples. Selecting one will fill the form below.
                      </p>
                    </div>
                    <ChevronRight
                      className={cn(
                        "mt-1 h-4 w-4 shrink-0 text-pink-500 transition-transform duration-200",
                        samplesExpanded && "rotate-90",
                      )}
                    />
                  </button>

                  {samplesExpanded && (
                    <div className="mt-3 grid max-h-[min(58vh,460px)] gap-1.5 overflow-y-auto sm:grid-cols-2">
                      {SAMPLE_TASKS.map((sample) => (
                        <button
                          key={sample.title}
                          type="button"
                          onClick={() => {
                            setDescription(sample.task);
                            setProofMode("required");
                            setProofSample(sample.proof);
                            setError("");
                            setSamplesExpanded(false);
                          }}
                          className={cn(
                            "w-full rounded-xl border p-3 text-left transition-colors touch-manipulation",
                            description === sample.task
                              ? "border-pink-300 bg-pink-50"
                              : "border-pink-100 bg-white/90 hover:border-pink-200 hover:bg-white",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-black text-slate-900">{sample.title}</div>
                            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                              Provable
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] leading-snug text-slate-600 font-medium">
                            {sample.task}
                          </div>
                          <div className="mt-2 rounded-lg border border-pink-100 bg-pink-50/60 px-2.5 py-1.5 text-[10px] leading-relaxed text-pink-800">
                            <span className="font-black">Proof:</span> {sample.proof}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <label htmlFor="description" className="block text-sm font-black text-slate-900">
                  What exactly must happen?
                </label>
                <p className="text-xs leading-relaxed text-slate-500 font-medium">
                  Write your own clear, objective challenge, or select a sample above.
                </p>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Example: Complete a 5 km outdoor run in a single continuous session."
                  maxLength={500}
                  className="min-h-[125px] w-full resize-none rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-xs sm:text-sm text-slate-900 placeholder-slate-400 shadow-[inset_0_2px_4px_rgba(15,23,42,0.02)] outline-none transition-all focus:border-[#0052FF] focus:ring-4 focus:ring-blue-100/70"
                />
                <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                  <span>Objective, verifiable & measurable</span>
                  <span>{description.length}/500</span>
                </div>

              </section>

              {/* Duration Settings */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                  <span className="block text-sm font-black text-slate-900">Duration</span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700 ring-1 ring-blue-200">{durationValue} {durationType}</span>
                </div>
                    <span className="text-[11px] font-medium text-slate-400">
                      Contract limit: {limitsLoading ? "loading..." : formatDuration(maxDurationSeconds)}
                    </span>
                  </div>
                  <div className="rounded-full bg-blue-50/90 border border-blue-200/70 px-3 py-1 text-xs font-black text-[#0052FF] shadow-xs">
                    {durationValue} {durationType === "days" ? "day" : "hour"}{durationValue === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="grid grid-cols-2 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-1.5 backdrop-blur-xs">
                  {(["hours", "days"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const nextMax = type === "hours" ? maxHours : maxDays;
                        const nextDefault = type === "hours" ? 24 : 3;
                        setDurationType(type);
                        setDurationValue(Math.min(nextDefault, nextMax));
                      }}
                      className={cn(
                        "rounded-xl py-2 text-xs font-bold transition-all cursor-pointer",
                        durationType === type
                          ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 shadow-[0_2px_8px_rgba(66,133,244,0.10)] font-black scale-[1.01]"
                          : "text-slate-500 hover:text-slate-900"
                      )}
                    >
                      {type === "hours" ? "Hours" : "Days"}
                    </button>
                  ))}
                </div>

                <input
                  aria-label="Duration"
                  type="range"
                  min={1}
                  max={Math.max(1, durationType === "hours" ? maxHours : maxDays)}
                  value={Math.min(durationValue, Math.max(1, durationType === "hours" ? maxHours : maxDays))}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    const max = Math.max(1, durationType === "hours" ? maxHours : maxDays);
                    setDurationValue(Math.min(Math.max(1, next), max));
                  }}
                  className="w-full accent-[#7aa7ff] cursor-pointer touch-manipulation"
                />
                <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                  <span>{durationType === "hours" ? "1 hour" : "1 day"}</span>
                  <span>{durationType === "hours" ? `${maxHours} hours` : `${maxDays} days`}</span>
                </div>
              </section>

              {/* Stake Token Selection with 3D Layered Glass Icons */}
              <section className="space-y-3">
                <span className="block text-sm font-black text-slate-900">Stake Asset</span>
                <div className="grid grid-cols-2 gap-3">
                  {CREATE_TOKENS.map((item) => (
                    <button
                      key={item.address}
                      type="button"
                      onClick={() => setToken(item.address)}
                      className={cn(
                        "glass-card-interactive group flex items-center gap-3.5 rounded-2xl p-3.5 text-left transition-all cursor-pointer",
                        token === item.address
                          ? "border-[#6f9dff] bg-blue-50/80 ring-2 ring-blue-200 shadow-[0_4px_16px_rgba(66,133,244,0.16)]"
                          : "border-slate-200/80 bg-white/90 hover:bg-slate-50"
                      )}
                    >
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-100 p-1.5 shadow-xs group-hover:scale-105 transition-transform">
                        <Image
                          src={`/images/${item.symbol.toLowerCase()}.png`}
                          alt={item.symbol}
                          width={26}
                          height={26}
                          className="h-6 w-6 object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="block text-sm font-black text-slate-900">{item.symbol}</span>
                          {token === item.address && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-700">Selected</span>
                          )}
                        </div>
                        <span className="block text-[10px] font-bold text-[#6683a5] uppercase tracking-wider">Base Sepolia</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Stake Amount Input */}
              <section className="space-y-2">
                <label htmlFor="stake" className="block text-sm font-black text-slate-900">
                  Stake Amount
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#0052FF]">
                    <Coins className="h-4 w-4" />
                  </div>
                  <Input
                    id="stake"
                    type="number"
                    min={contractLimits ? formatUnits(contractLimits.minStake, tokenMeta.decimals) : undefined}
                    step="any"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    placeholder={`Enter ${symbol} amount`}
                    className="h-12 rounded-2xl border-slate-200/80 bg-white/90 pl-12 pr-16 font-mono text-sm font-black text-slate-900 placeholder:font-sans focus-visible:border-[#0052FF] focus-visible:ring-4 focus-visible:ring-blue-100/70 shadow-xs"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                    {symbol}
                  </span>
                </div>
                <div className="grid gap-2 text-[11px] font-semibold text-slate-500 sm:grid-cols-2 pt-1">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2">
                    Min Required: <b className="font-mono text-slate-900">{limitsLoading || !contractLimits ? "Loading..." : `${formatUnits(contractLimits.minStake, tokenMeta.decimals)} ${symbol}`}</b>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2">
                    Max Allowed: <b className="font-mono text-slate-900">{limitsLoading || !contractLimits ? "Loading..." : "$500 USD equivalent"}</b>
                  </div>
                </div>
              </section>

              {/* Proof Specification Switch */}
              <section className="space-y-3">
                <span className="block text-sm font-black text-slate-900">Does this dare need proof?</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setProofMode("none")}
                    className={cn(
                      "glass-card-interactive rounded-2xl p-4 text-left transition-all cursor-pointer",
                      proofMode === "none"
                        ? "border-[#6f9dff] bg-blue-50/80 ring-2 ring-blue-200 shadow-[0_4px_16px_rgba(66,133,244,0.16)]"
                        : "border-slate-200/80 bg-white/90 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-xs sm:text-sm font-black text-slate-900">No Proof</div>
                      {proofMode === "none" && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">Selected</span>}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 font-medium">Outcome resolved strictly by contract deadline.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProofMode("required")}
                    className={cn(
                      "glass-card-interactive rounded-2xl p-4 text-left transition-all cursor-pointer",
                      proofMode === "required"
                        ? "border-[#6f9dff] bg-blue-50/80 ring-2 ring-blue-200 shadow-[0_4px_16px_rgba(66,133,244,0.16)]"
                        : "border-slate-200/80 bg-white/90 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-xs sm:text-sm font-black text-slate-900">Proof Required</div>
                      {proofMode === "required" && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-700">Selected</span>}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 font-medium">Accepter must upload verifiable proof before deadline.</div>
                  </button>
                </div>

                {proofMode === "required" && (
                  <div className="rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50/60 to-white p-4 shadow-xs">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0052FF]">
                        <FileCheck2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900">Required Evidence Specification</div>
                        <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500 font-medium">
                          State what qualifies as proof. E.g., “Strava activity link showing 5 km with matching date.”
                        </div>
                        <textarea
                          value={proofSample}
                          onChange={(e) => setProofSample(e.target.value)}
                          maxLength={280}
                          placeholder="Example: Strava link or screenshot showing 5 km..."
                          className="mt-3 min-h-[75px] w-full resize-none rounded-xl border border-slate-200/80 bg-white p-3 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#0052FF] focus:ring-4 focus:ring-blue-100/70 shadow-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Right Sticky Summary Card */}
            <aside className="h-fit rounded-3xl border border-slate-100 bg-slate-50/70 p-5 lg:sticky lg:top-20 space-y-4 shadow-xs">
              <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#0052FF]">
                <Sparkles className="h-3.5 w-3.5" /> Challenge Overview
              </div>

              <div className="space-y-2.5">
                <InfoRow icon={<Clock3 className="h-4 w-4" />} label="Duration" value={`${durationValue} ${durationType}`} />
                <InfoRow icon={<Wallet className="h-4 w-4" />} label="Stake" value={stake ? `${stake} ${symbol}` : "Not set"} />
                <InfoRow icon={<Coins className="h-4 w-4" />} label="Matched Pot" value={stake ? `${totalPot.toFixed(4)} ${symbol}` : "Not set"} />
                <InfoRow icon={<ShieldCheck className="h-4 w-4" />} label="Proof" value={proofMode === "required" ? "Required" : "None"} />
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white/90 p-3.5 text-[11px] leading-relaxed text-slate-500 font-medium shadow-xs">
                <b className="text-slate-800">Creator Verification:</b> On step 2 you must explicitly confirm that the outcome is provable by an independent party before the transaction signs.
              </div>
            </aside>
          </div>

          {error && <ErrorBox message={error} />}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="submit"
              className="h-12 rounded-2xl bg-gradient-to-b from-[#0052FF] to-[#0045d8] hover:to-[#003bb8] px-7 text-xs sm:text-sm font-black text-white shadow-[0_8px_22px_rgba(0,82,255,0.32)] active:scale-[0.98] transition-all cursor-pointer"
            >
              Next: Review Dare <ChevronRight className="ml-1 h-4 w-4 stroke-[2.5]" />
            </Button>
          </div>
        </form>
      ) : (
        /* Step 2: Final Creator Review Screen */
        <div className="max-md:p-4 p-5 sm:p-7 md:p-8">
          <div className="grid gap-7 lg:grid-cols-[1fr_340px]">
            <div className="space-y-5">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50/90 border border-blue-200/70 text-[#0052FF] shadow-xs">
                  <ShieldCheck className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900">Final Creator Review</div>
                  <div className="mt-0.5 text-xs text-slate-500 font-medium">Verify exactly what will be recorded on Base.</div>
                </div>
              </div>

              {/* Challenge Description Card */}
              <div className="rounded-2xl border border-slate-100 bg-white/95 p-5 shadow-xs">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0052FF]">Challenge Description</div>
                <div className="mt-2 whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-900">
                  {description}
                </div>
              </div>

              {/* Review Metrics 2-Col Grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                <ReviewCard label="Duration" value={`${durationValue} ${durationType}`} />
                <ReviewCard label="Stake Asset" value={`${stake || "0"} ${symbol}`} />
                <ReviewCard label="Matched Total Pot" value={`${totalPot.toFixed(4)} ${symbol}`} />
                <ReviewCard
                  label={`Protocol Escrow Fee (${contractLimits ? `${Number(contractLimits.feeBps) / 100}%` : "3%"})`}
                  value={`${platformFee.toFixed(4)} ${symbol}`}
                />
                <ReviewCard label="Winner Payout" value={`${winnerAmount.toFixed(4)} ${symbol}`} />
                <ReviewCard label="Proof Status" value={proofMode === "required" ? "Required" : "None"} />
              </div>

              {proofMode === "required" && (
                <div className="rounded-2xl border border-blue-200/70 bg-blue-50/40 p-4 shadow-xs">
                  <div className="flex gap-3">
                    <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0052FF]" />
                    <div>
                      <div className="text-xs font-black text-slate-900">Required Proof Specification</div>
                      <div className="mt-1 text-xs leading-relaxed text-slate-600 font-medium">{proofSample}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Provable Confirmation Aside */}
            <aside className="h-fit rounded-3xl border border-slate-100 bg-slate-50/70 p-5 space-y-4 shadow-xs">
              <div className="text-sm font-black text-slate-900">Is this objectively provable?</div>
              <p className="text-xs leading-relaxed text-slate-500 font-medium">
                Confirm only if any independent accepter can complete and verify the challenge outcome.
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setProvable(true)}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-2xl border py-3 text-xs font-black transition-all cursor-pointer",
                    provable === true
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-xs scale-[1.02]"
                      : "border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Check className="mb-1 h-5 w-5 stroke-[2.5]" /> Yes
                </button>

                <button
                  type="button"
                  onClick={() => setProvable(false)}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-2xl border py-3 text-xs font-black transition-all cursor-pointer",
                    provable === false
                      ? "border-rose-300 bg-rose-50 text-rose-700 shadow-xs scale-[1.02]"
                      : "border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <ArrowLeft className="mb-1 h-5 w-5 stroke-[2.5]" /> No
                </button>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white/90 p-3.5 text-[11px] leading-relaxed text-slate-500 font-medium shadow-xs">
                <b className="text-slate-800">Contract Safeguards:</b> {limitsLoading || !contractLimits ? "Loading parameters..." : `${formatDuration(maxDurationSeconds)} maximum duration; ${formatUnits(contractLimits.minStake, tokenMeta.decimals)} ${symbol} minimum stake.`}
              </div>
            </aside>
          </div>

          {error && <ErrorBox message={error} />}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setStep(1); setProvable(null); setSamplesExpanded(false); setError(""); }}
              className="h-12 rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-bold cursor-pointer"
            >
              Back to Edit
            </Button>

            <Button
              type="button"
              onClick={createDare}
              disabled={isSubmitting || provable !== true}
              className="animate-pulse-glow h-12 rounded-2xl bg-gradient-to-b from-[#0052FF] to-[#0045d8] hover:to-[#003bb8] px-8 text-xs sm:text-sm font-black text-white shadow-[0_8px_24px_rgba(0,82,255,0.32)] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none active:scale-[0.98] transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Locking on Base...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4 stroke-[2.5]" /> Lock & Create Dare
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const SAMPLE_TASKS = [
  { title: "Run 5 km", task: "Complete a 5 km run in one continuous activity.", proof: "Strava, Garmin or Apple Health activity link/screenshot showing 5 km, date and one continuous activity." },
  { title: "30-min workout", task: "Complete one 30-minute workout session.", proof: "Fitness app activity screenshot showing at least 30 minutes and the session date." },
  { title: "8,000 steps", task: "Reach at least 8,000 steps on the same calendar day.", proof: "Apple Health, Google Fit or equivalent screenshot showing the date and 8,000+ steps." },
  { title: "Close a GitHub issue", task: "Close one specified GitHub issue with the required fix merged.", proof: "Public GitHub issue and merged pull request links showing the issue was closed by the required change." },
  { title: "10 coding problems", task: "Complete 10 specified coding problems before the deadline.", proof: "Public submission links or repository commits showing all 10 completed problems." },
  { title: "10 acts of kindness", task: "Complete 10 distinct, documented acts of kindness before the deadline.", proof: "A dated list with independently inspectable evidence for each act where practical." },
  { title: "Cycle 10 km", task: "Complete a 10 km outdoor cycling session before the deadline.", proof: "Strava, Garmin or equivalent activity link showing 10 km, date and one continuous ride." },
  { title: "Read 30 pages", task: "Read at least 30 pages of a specified book before the deadline.", proof: "A dated reading log plus a photo of the completed pages or a verifiable reading-app record." },
  { title: "Ship a GitHub PR", task: "Open and merge one specified GitHub pull request containing the required change.", proof: "Public pull request URL showing the required changes and merged status before the deadline." },
  { title: "20-min meditation", task: "Complete one uninterrupted 20-minute meditation session before the deadline.", proof: "Timestamped meditation-app session record or another independently inspectable activity record." },
  { title: "Deploy a project", task: "Deploy the specified project to a public URL with the required feature working before the deadline.", proof: "Public deployment URL plus repository commit or release showing the required feature." },
] as const;

function formatDuration(seconds: number) {
  if (seconds % 86400 === 0) return `${seconds / 86400} day${seconds / 86400 === 1 ? "" : "s"}`;
  if (seconds % 3600 === 0) return `${seconds / 3600} hour${seconds / 3600 === 1 ? "" : "s"}`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/95 px-3.5 py-2.5 shadow-xs">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <span className="text-[#0052FF]">{icon}</span>
        {label}
      </div>
      <div className="font-mono text-xs font-black text-slate-900">{value}</div>
    </div>
  );
}

function ReviewCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-xs">
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 font-mono text-sm sm:text-base font-black text-slate-900">{value}</div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/80 p-4 text-xs font-bold text-rose-700 shadow-xs">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
      <span>{message}</span>
    </div>
  );
}
