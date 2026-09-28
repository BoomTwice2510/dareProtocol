export interface DareData {
  id: number;
  creator: string;
  accepter: string;
  description: string;
  token: string;
  stake: bigint;
  createdAt: bigint;
  deadline: bigint;
  proofSubmitted: boolean;
  proofURI: string;
  proofTime: bigint;
  disputeTime: bigint;
  status: number;
  proofRequired?: boolean;
}

export interface UserStats {
  activeCountCreator: bigint;
  activeCountAccepter: bigint;
  xpPoints: bigint;
  totalWins: bigint;
  totalLosses: bigint;
  totalVolume: bigint;
  totalDisputeWins: bigint;
}

export enum DareStatus {
  Open = 0,
  Running = 1,
  ProofSubmitted = 2,
  Disputed = 3,
  Resolved = 4,
  Cancelled = 5,
}

export enum Badge {
  NONE = 0,
  ROOKIE = 1,
  CHALLENGER = 2,
  CONTENDER = 3,
  GLADIATOR = 4,
  CHAMPION = 5,
  LEGEND = 6,
  MYTHIC = 7,
}
