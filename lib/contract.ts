import { parseAbi, type Address } from "viem";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const chainIdFromEnv = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "84532");
export const BASE_CHAIN_ID = chainIdFromEnv;

const SEP_TESTNET_DEPLOYMENT = "0x1efc689ddc93ae683bcb99170609a5cd055d9fe0" as Address;

export const CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_DARE_CONTRACT_ADDRESS ||
  (chainIdFromEnv === 84532 ? SEP_TESTNET_DEPLOYMENT : ZERO_ADDRESS)
) as Address;

export const BASE_USDC = (
  chainIdFromEnv === 8453
    ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    : "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
) as Address;

export const ETH_USD_FEED = (
  chainIdFromEnv === 8453
    ? "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70"
    : (process.env.NEXT_PUBLIC_ETH_USD_FEED || ZERO_ADDRESS)
) as Address;

export const TOKEN_MAP: Record<string, { name: string; symbol: string; decimals: number }> = {
  [ZERO_ADDRESS]: { name: "Ethereum", symbol: "ETH", decimals: 18 },
  [BASE_USDC]: { name: "USD Coin", symbol: "USDC", decimals: 6 },
};

export const ALLOWED_TOKENS = [
  { address: ZERO_ADDRESS, name: "Ethereum", symbol: "ETH", decimals: 18 },
  { address: BASE_USDC, name: "USD Coin", symbol: "USDC", decimals: 6 },
] as const;

export const STATUS_LABELS: Record<number, string> = {
  0: "Open",
  1: "Running",
  2: "Proof Submitted",
  3: "Disputed",
  4: "Resolved",
  5: "Cancelled",
};

export const BADGE_LABELS: Record<number, string> = {
  0: "None",
  1: "Rookie",
  2: "Challenger",
  3: "Contender",
  4: "Gladiator",
  5: "Champion",
  6: "Legend",
  7: "Mythic",
};

export const BADGE_XP_THRESHOLDS: Record<string, { min: number; max: number | null }> = {
  None: { min: 0, max: 0 },
  Rookie: { min: 1, max: 499 },
  Challenger: { min: 500, max: 999 },
  Contender: { min: 1000, max: 1999 },
  Gladiator: { min: 2000, max: 2999 },
  Champion: { min: 3000, max: 4999 },
  Legend: { min: 5000, max: 7499 },
  Mythic: { min: 7500, max: null },
};

export const DARE_ABI = parseAbi([
  "function createDare(string description,uint256 duration,address token,uint256 stake,bool proofRequired) payable",
  "function acceptDare(uint256 id) payable",
  "function cancelOpenDare(uint256 id)",
  "function expireUnacceptedDare(uint256 id)",
  "function submitProof(uint256 id,string proofURI,bytes32 proofHash)",
  "function confirmSuccess(uint256 id)",
  "function disputeDare(uint256 id,bytes32 reasonHash)",
  "function submitEvidence(uint256 id,string uri,bytes32 contentHash)",
  "function resolveAfterConfirmTimeout(uint256 id)",
  "function resolveAfterProofTimeout(uint256 id)",
  "function resolveNoProofRequired(uint256 id)",
  "function judgeResolve(uint256 id,bool creatorWins,bytes32 reasonHash)",
  "function judge() view returns (address)",
  "function treasury() view returns (address)",
  "function admin() view returns (address)",
  "function paused() view returns (bool)",
  "function feeBps() view returns (uint256)",
  "function MIN_DURATION() view returns (uint256)",
  "function MAX_DURATION() view returns (uint256)",
  "function MIN_ETH_STAKE() view returns (uint256)",
  "function MIN_USDC_STAKE() view returns (uint256)",
  "function MAX_USD_STAKE_6() view returns (uint256)",
  "function dareCount() view returns (uint256)",
  "function getDare(uint256 id) view returns (address creator,address accepter,string description,address token,uint256 stake,uint256 createdAt,uint256 deadline,bool proofSubmitted,string proofURI,uint256 proofTime,uint256 disputeTime,uint8 status)",
  "function getDareMeta(uint256 id) view returns (bool proofRequired,uint256 acceptBy,uint256 proofDeadline,uint256 evidenceDeadline,bytes32 proofHash,bytes32 disputeReasonHash,bytes32 judgeReasonHash,uint256 baseFeeBps,uint256 stakeUsd6,uint256 duration)",
  "function getEvidenceCount(uint256 id) view returns (uint256)",
  "function getEvidence(uint256 id,uint256 index) view returns ((address submitter,string uri,bytes32 contentHash,uint256 submittedAt))",
  "function getUserStats(address user) view returns (uint256 activeCountCreator,uint256 activeCountAccepter,int256 xpPoints,uint256 totalWins,uint256 totalLosses,uint256 totalVolumeUsd6,uint256 totalDisputeWins)",
  "function getUserBadge(address user) view returns (uint8)",
  "function getUserFeeDiscountBps(address user) view returns (uint256)",
  "function getUserMaxDares(address user) view returns (uint256)",
  "function getCreateCooldown(address user) view returns (uint256)",
  "function winnerOf(uint256) view returns (address)",
  "function xp(address) view returns (int256)",
  "function wins(address) view returns (uint256)",
  "function losses(address) view returns (uint256)",
  "function volumeUsd6(address) view returns (uint256)",
  "function accumulatedFees(address) view returns (uint256)",
  "function outstandingLiability(address) view returns (uint256)",
] as const)

export const ERC20_ABI = parseAbi([
  "function approve(address spender,uint256 amount) returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
] as const);

export const DARE_CONTRACT_CONFIG = {
  address: CONTRACT_ADDRESS,
  abi: DARE_ABI,
  chainId: BASE_CHAIN_ID,
} as const;
